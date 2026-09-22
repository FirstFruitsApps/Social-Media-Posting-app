import http from 'node:http';
import { createReadStream, createWriteStream } from 'node:fs';
import { readFile, stat, unlink, open } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { openDatabase, settings, audit, id, now, postView } from './db.mjs';
import { platforms, AppError, normalizePost, validateReady } from './domain.mjs';
import { bootstrap, sessionUser, requireRole, createSession, verifyPassword, hashPassword, digest } from './auth.mjs';
import { UploadPostProvider } from './provider.mjs';
import { createScheduler } from './scheduler.mjs';
import { backupStream } from './backup.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const directory=resolve(process.env.DATA_DIR||resolve(root,'data'));
const production=process.env.NODE_ENV==='production';
const host=process.env.HOST||'127.0.0.1';const port=Number(process.env.PORT||3080);
const origin=process.env.APP_ORIGIN||`http://127.0.0.1:${port}`;
if(production && !origin.startsWith('https://'))throw new Error('Production requires an HTTPS APP_ORIGIN.');
if(!production && !['127.0.0.1','localhost','::1'].includes(host))throw new Error('Development preview must bind to loopback. Use production mode for network hosting.');
const db=openDatabase(directory);await bootstrap(db,process.env);
const provider=new UploadPostProvider(process.env.UPLOAD_POST_API_KEY,resolve(directory,'media'));
const scheduler=createScheduler(db,provider);
const rateLimits=new Map();
function json(res,status,data) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req,limit=1024*1024) {let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>limit)throw new AppError('Request is too large.',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{throw new AppError('Invalid JSON.');}}
function getPost(postId) {const p=postView(db,db.prepare('SELECT * FROM posts WHERE id=?').get(postId));if(!p)throw new AppError('Post not found.',404);return p;}
function localRequest(req) {return !production && ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);}
function originCheck(req) {
  if(req.headers.origin && req.headers.origin!==origin)throw new AppError('This request came from another website.',403);
  if(req.headers['sec-fetch-site']==='cross-site')throw new AppError('Cross-site requests are not allowed.',403);
  if(req.headers.host!==new URL(origin).host)throw new AppError('Unexpected host.',403);
}
function rateLimit(key,max=8) {const t=Date.now();if(rateLimits.size>10000)for(const [k,v]of rateLimits)if(v.until<t)rateLimits.delete(k);const record=rateLimits.get(key)||{n:0,until:t+15*60*1000};if(record.until<t){record.n=0;record.until=t+15*60*1000;}record.n++;rateLimits.set(key,record);if(record.n>max)throw new AppError('Too many attempts. Please try again in 15 minutes.',429);}
function mediaView(m) {return {...m,filename:undefined,url:`/api/media/${m.id}`};}
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.pdf':'application/pdf'};

const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if(production)res.setHeader('Strict-Transport-Security','max-age=31536000');
  try {
    const u=new URL(req.url,origin);const path=u.pathname;const method=req.method;
    if(path==='/healthz')return json(res,200,{ok:true});
    if(path.startsWith('/api/')) {
      originCheck(req);
      const localPreview=localRequest(req);const user=sessionUser(db,req,localPreview);
      if(path==='/api/session' && method==='GET')return json(res,200,{user,localPreview,setupRequired:!db.prepare('SELECT COUNT(*) n FROM users').get().n,aiEnabled:false});
      if(path==='/api/login' && method==='POST') {
        rateLimit(req.socket.remoteAddress);const input=await body(req);const row=db.prepare('SELECT * FROM users WHERE email=?').get(String(input.email||'').toLowerCase().trim());
        const pw=String(input.password||'');if(pw.length>512)throw new AppError('Invalid credentials.',401);
        const valid=row?await verifyPassword(pw,row.password):await verifyPassword(pw,'00000000000000000000000000000000:'+ '00'.repeat(64));
        if(!row||!valid)throw new AppError('Email or password is incorrect.',401);
        res.setHeader('Set-Cookie',createSession(db,row.id,production));return json(res,200,{ok:true});
      }
      if(!user)throw new AppError('Please sign in.',401);
      if(!['GET','HEAD'].includes(method) && req.headers['x-csrf-token']!==user.csrf)throw new AppError('Please refresh this page and try again.',403);
      if(path==='/api/logout' && method==='POST') {const token=(req.headers.cookie||'').match(/storage_session=([^;]+)/)?.[1];if(token)db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));res.setHeader('Set-Cookie','storage_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(res,200,{ok:true});}
      if(path==='/api/bootstrap' && method==='GET')return json(res,200,{settings:settings(db),platforms,media:db.prepare('SELECT * FROM media ORDER BY created_at DESC').all().map(mediaView),posts:db.prepare('SELECT * FROM posts ORDER BY updated_at DESC').all().map(r=>postView(db,r)),providerConfigured:provider.configured,aiEnabled:false,user});
      if(path==='/api/settings' && method==='PUT') {
        requireRole(user,['owner']);const input=await body(req);const s=settings(db);
        if(!String(input.company||'').trim())throw new AppError('Enter a company name.');
        try{new Intl.DateTimeFormat('en-US',{timeZone:input.timezone});}catch{throw new AppError('Choose a valid time zone.');}
        if(!Array.isArray(input.locations)||!input.locations.length||input.locations.length>30)throw new AppError('Add between 1 and 30 locations.');
        const locations=input.locations.map(l=>({id:String(l.id||id()).slice(0,100),name:String(l.name||'').trim().slice(0,100),profile:String(l.profile||'').trim().slice(0,100)}));
        if(locations.some(l=>!l.name) || new Set(locations.map(l=>l.id)).size!==locations.length)throw new AppError('Location names are required and IDs must be unique.');
        const next={...s,company:String(input.company).slice(0,120),website:String(input.website||'').slice(0,2000),timezone:input.timezone,requireApproval:Boolean(input.requireApproval),locations};
        db.prepare('UPDATE settings SET value=? WHERE key=?').run(JSON.stringify(next),'workspace');audit(db,user.id,'settings_updated','workspace');return json(res,200,next);
      }
      if(path==='/api/posts' && method==='POST') {
        requireRole(user,['owner','editor','approver']);const p=normalizePost(await body(req),db);const pid=id();const stamp=now();
        db.prepare('INSERT INTO posts(id,title,kind,caption,status,scheduled_at,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(pid,p.title,p.kind,p.caption,'draft',p.scheduled_at,JSON.stringify(p),stamp,stamp);audit(db,user.id,'draft_created',pid);return json(res,201,getPost(pid));
      }
      const postMatch=path.match(/^\/api\/posts\/([a-f0-9-]+)(?:\/(\w+))?$/);
      if(postMatch) {
        const [,pid,action]=postMatch;const current=getPost(pid);
        if(method==='GET' && !action)return json(res,200,current);
        requireRole(user,['owner','editor','approver']);
        if(method==='PUT' && !action) {
          if(!['draft','pending_approval','approved'].includes(current.status))throw new AppError('Return this post to drafts before editing. Posts already sent cannot be edited here.',409);
          const input=await body(req);if(input.revision!==current.revision)throw new AppError('This post changed in another window. Reload before editing.',409);const p=normalizePost(input,db);
          const change=db.prepare('UPDATE posts SET title=?,kind=?,caption=?,scheduled_at=?,payload=?,status=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').run(p.title,p.kind,p.caption,p.scheduled_at,JSON.stringify(p),'draft',now(),pid,current.revision);
          if(!change.changes)throw new AppError('This post changed in another window.',409);audit(db,user.id,'draft_updated',pid);return json(res,200,getPost(pid));
        }
        if(method==='POST' && action==='duplicate') {const p={...current,scheduled_at:null};delete p.deliveries;delete p.id;const copy=id();db.prepare('INSERT INTO posts(id,title,kind,caption,status,scheduled_at,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(copy,`${current.title} (copy)`,current.kind,current.caption,'draft',null,JSON.stringify({...p,title:`${current.title} (copy)`}),now(),now());return json(res,201,getPost(copy));}
        if(method==='POST' && action==='submit') {if(current.status!=='draft')throw new AppError('Only drafts can be submitted.',409);db.prepare('UPDATE posts SET status=?,updated_at=? WHERE id=?').run('pending_approval',now(),pid);audit(db,user.id,'approval_requested',pid);return json(res,200,getPost(pid));}
        if(method==='POST' && action==='approve') {requireRole(user,['owner','approver']);if(current.status!=='pending_approval')throw new AppError('This post is not awaiting approval.',409);db.prepare('UPDATE posts SET status=?,updated_at=? WHERE id=?').run('approved',now(),pid);audit(db,user.id,'approved',pid);return json(res,200,getPost(pid));}
        if(method==='POST' && ['schedule','publish'].includes(action)) {
          if(settings(db).requireApproval && current.status!=='approved')throw new AppError('Submit this post for approval first.',409);
          if(settings(db).requireApproval)requireRole(user,['owner','approver']);
          if(!['draft','approved'].includes(current.status))throw new AppError('This post is not ready to schedule or publish.',409);
          const errors=validateReady(current,current.mediaIds.map(mid=>db.prepare('SELECT * FROM media WHERE id=?').get(mid)));if(errors.length)throw new AppError(errors.join('\n'));
          if(action==='schedule') {if(!current.scheduled_at || Date.parse(current.scheduled_at)<Date.now()+60000)throw new AppError('Schedule at least one minute in the future.');db.prepare('UPDATE posts SET status=?,updated_at=? WHERE id=?').run('scheduled',now(),pid);audit(db,user.id,'scheduled',pid);}
          else scheduler.enqueue(pid,user.id);
          return json(res,200,getPost(pid));
        }
        if(method==='POST' && action==='unschedule') {if(current.deliveries.length || !['scheduled','pending_approval','approved','needs_attention'].includes(current.status))throw new AppError('This post cannot be returned to drafts.',409);db.prepare('UPDATE posts SET status=?,updated_at=? WHERE id=?').run('draft',now(),pid);audit(db,user.id,'returned_to_draft',pid);return json(res,200,getPost(pid));}
        if(method==='POST' && action==='archive') {if(current.status==='publishing')throw new AppError('Wait until publishing finishes before archiving.',409);db.prepare('UPDATE posts SET status=?,updated_at=? WHERE id=?').run('archived',now(),pid);audit(db,user.id,'archived',pid);return json(res,200,getPost(pid));}
      }
      if(path==='/api/media' && method==='POST') {
        requireRole(user,['owner','editor','approver']);
        const type=(req.headers['content-type']||'').split(';')[0];const extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/quicktime':'mov'};
        if(!extensions[type])throw new AppError('Use JPEG, PNG, WebP, MP4 or MOV files.');
        const max=(type.startsWith('image/')?20:Number(process.env.MAX_UPLOAD_MB||250))*1024*1024;
        if(Number(req.headers['content-length'])>max)throw new AppError('This file exceeds the upload limit.',413);
        const mid=id();const filename=`${mid}.${extensions[type]}`;const dest=resolve(directory,'media',filename);let size=0;
        const counter=new Transform({transform(chunk,enc,callback){size+=chunk.length;callback(size>max?new AppError('This file exceeds the upload limit.',413):null,chunk);}});
        try {
          await pipeline(req,counter,createWriteStream(dest,{flags:'wx',mode:0o600}));
          const file=await open(dest,'r');const bytes=Buffer.alloc(16);await file.read(bytes,0,16,0);await file.close();
          const valid=type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:type==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/webp'?bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP':['ftyp','moov','mdat','wide'].includes(bytes.toString('ascii',4,8));
          if(!valid||!size)throw new AppError('The file does not match its media type.');
          const name=decodeURIComponent(req.headers['x-file-name']||'upload').replace(/[\r\n\x00]/g,'').slice(0,200);
          db.prepare('INSERT INTO media(id,name,type,size,filename,created_at) VALUES (?,?,?,?,?,?)').run(mid,name,type,size,filename,now());audit(db,user.id,'media_uploaded',mid);return json(res,201,mediaView(db.prepare('SELECT * FROM media WHERE id=?').get(mid)));
        }catch(e){await unlink(dest).catch(()=>{});throw e;}
      }
      const mediaMatch=path.match(/^\/api\/media\/([a-f0-9-]+)$/);
      if(mediaMatch && method==='GET') {
        const m=db.prepare('SELECT * FROM media WHERE id=?').get(mediaMatch[1]);if(!m)throw new AppError('File not found.',404);const file=resolve(directory,'media',m.filename);const info=await stat(file);
        res.setHeader('Content-Type',m.type);res.setHeader('Cache-Control','private, max-age=300');res.setHeader('Accept-Ranges','bytes');
        const range=req.headers.range;
        if(range) {const match=range.match(/^bytes=(\d*)-(\d*)$/);if(!match)throw new AppError('Invalid range.',416);const start=match[1]?Number(match[1]):Math.max(0,info.size-Number(match[2]));const end=match[1]?(match[2]?Math.min(Number(match[2]),info.size-1):info.size-1):info.size-1;if(start>=info.size||start>end){res.setHeader('Content-Range',`bytes */${info.size}`);throw new AppError('Invalid range.',416);}res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${info.size}`,'Content-Length':end-start+1});await pipeline(createReadStream(file,{start,end}),res);}
        else {res.setHeader('Content-Length',info.size);await pipeline(createReadStream(file),res);}return;
      }
      if(path==='/api/provider/profiles' && method==='GET') {requireRole(user,['owner']);return json(res,200,{profiles:await provider.profiles()});}
      if(path==='/api/provider/connect' && method==='POST') {requireRole(user,['owner']);const {locationId}=await body(req);const l=settings(db).locations.find(x=>x.id===locationId);if(!l?.profile)throw new AppError('Link a publishing profile to this location in Settings first.');return json(res,200,{url:await provider.connect(l.profile,origin)});}
      if(path==='/api/provider/options' && method==='GET') {const l=settings(db).locations.find(x=>x.id===u.searchParams.get('location'));if(!l?.profile)throw new AppError('Link a publishing profile first.');return json(res,200,await provider.options(l.profile,u.searchParams.get('platform')));}
      if(path==='/api/audit' && method==='GET') {requireRole(user,['owner','approver']);return json(res,200,db.prepare('SELECT * FROM audit ORDER BY created_at DESC LIMIT 200').all());}
      if(path==='/api/users' && method==='GET') {requireRole(user,['owner']);return json(res,200,db.prepare('SELECT id,email,name,role,created_at FROM users').all());}
      if(path==='/api/users' && method==='POST') {requireRole(user,['owner']);const v=await body(req);if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email||'')||!['owner','editor','approver'].includes(v.role)||String(v.password||'').length<14)throw new AppError('Enter a valid email, role and password of at least 14 characters.');if(db.prepare('SELECT id FROM users WHERE email=?').get(v.email.toLowerCase()))throw new AppError('This email is already registered.',409);db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run(id(),v.email.toLowerCase(),String(v.name||v.email).slice(0,100),v.role,await hashPassword(v.password),now());audit(db,user.id,'user_created',v.email);return json(res,201,{ok:true});}
      if(path==='/api/backup' && method==='GET') {requireRole(user,['owner']);const stream=await backupStream(db,directory);audit(db,user.id,'backup_exported','workspace');res.writeHead(200,{'Content-Type':'application/x-tar','Content-Disposition':`attachment; filename="storage-social-${now().slice(0,10)}.tar"`,'Cache-Control':'no-store'});await pipeline(stream,res);return;}
      if(path==='/api/export' && method==='GET') {const data={schemaVersion:1,exportedAt:now(),settings:settings(db),posts:db.prepare('SELECT * FROM posts').all().map(r=>postView(db,r)),media:db.prepare('SELECT * FROM media').all().map(mediaView)};res.setHeader('Content-Disposition','attachment; filename="storage-social-posts.json"');return json(res,200,data);}
      throw new AppError('Endpoint not found.',404);
    }
    if(!['GET','HEAD'].includes(method))throw new AppError('Method not allowed.',405);
    const publicFiles={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/time.js':'time.js','/styles.css':'styles.css','/favicon.svg':'favicon.svg','/storage-social-user-guide.pdf':'storage-social-user-guide.pdf'};
    const name=publicFiles[path];if(!name)throw new AppError('Page not found.',404);const data=await readFile(resolve(root,'public',name));res.writeHead(200,{'Content-Type':MIME[extname(name)],'Cache-Control':'no-cache'});res.end(method==='HEAD'?undefined:data);
  }catch(e) {
    if(!res.headersSent&&!res.destroyed)json(res,e.status||500,{error:e.status?e.message:'Something went wrong. Your saved work is retained. Please try again.'});
    if(!e.status)console.error('Request failed:',e.name,e.code||'internal_error');
  }
});
server.requestTimeout=5*60*1000;server.headersTimeout=30000;
server.listen(port,host,()=>console.log(`Storage Social listening on ${origin} (${production?'production':'local preview; AI disabled'})`));
const timer=setInterval(()=>scheduler.tick().catch(e=>console.error('Scheduler:',e.name)),10000);timer.unref();
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(timer);server.close(()=>{db.close();process.exit(0);});});
