import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp,rm,writeFile,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
const fixture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
async function start(dir,port,production=false){const child=spawn(process.execPath,['src/server.mjs'],{cwd:resolve('.'),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:dir,NODE_ENV:production?'production':'development',APP_ORIGIN:`${production?'https':'http'}://127.0.0.1:${port}`,UPLOAD_POST_API_KEY:'',BOOTSTRAP_ADMIN_EMAIL:production?'owner@example.com':'',BOOTSTRAP_ADMIN_PASSWORD:production?'test-owner-password-12345':''},stdio:'pipe'});let stderr='';child.stderr.on('data',d=>stderr+=d);for(let n=0;n<60;n++){try{if((await fetch(`http://127.0.0.1:${port}/healthz`)).ok)return child;}catch{}if(child.exitCode!==null)throw new Error(stderr||'Server exited');await delay(50);}child.kill();throw new Error('Server did not start.');}
async function stop(child){if(child.exitCode!==null)return;const done=new Promise(r=>child.once('exit',r));child.kill();await done;}
test('uploads, revision conflicts, scheduling, restart persistence and full backup restore',async()=>{const dir=await mkdtemp(join(tmpdir(),'social-api-'));const port=3191,base=`http://127.0.0.1:${port}`;let child=await start(dir,port);const call=async(path,method='GET',data,extra={})=>{const response=await fetch(base+'/api'+path,{method,headers:{'X-CSRF-Token':'local-preview','Content-Type':'application/json',...extra},body:data===undefined?undefined:JSON.stringify(data)});return {status:response.status,data:await response.json()};};try{
  assert.equal((await call('/bootstrap')).status,200);
  assert.equal((await fetch(base+'/time.js')).status,200);
  assert.equal((await call('/posts','POST',{title:'Blocked'}, {'X-CSRF-Token':'bad'})).status,403);
  assert.equal((await call('/posts','POST',{}, {Origin:'https://attacker.example'})).status,403);
  const upload=await fetch(base+'/api/media',{method:'POST',headers:{'Content-Type':'image/png','X-File-Name':'test.png','X-CSRF-Token':'local-preview'},body:fixture});assert.equal(upload.status,201);const media=await upload.json();
  const invalid=await fetch(base+'/api/media',{method:'POST',headers:{'Content-Type':'image/png','X-File-Name':'fake.png','X-CSRF-Token':'local-preview'},body:'not a picture'});assert.equal(invalid.status,400);
  const data={title:'Product test',kind:'photo',caption:'A confirmed product description.',mediaIds:[media.id],platforms:['facebook'],variants:{},options:{},locationId:'tucson',scheduled_at:new Date(Date.now()+86400000).toISOString()};
  const created=await call('/posts','POST',data);assert.equal(created.status,201);const p=created.data;
  assert.equal((await call('/posts/'+p.id,'PUT',{...data,revision:999})).status,409);
  assert.equal((await call('/posts/'+p.id+'/publish','POST',{})).status,503);
  assert.equal((await call('/posts/'+p.id+'/schedule','POST',{})).data.status,'scheduled');
  assert.equal((await call('/posts/'+p.id,'PUT',{...data,revision:1})).status,409);
  const duplicated=await call('/posts/'+p.id+'/duplicate','POST',{});assert.equal(duplicated.data.status,'draft');assert.equal(duplicated.data.scheduled_at,null);
  const ranged=await fetch(base+media.url,{headers:{Range:'bytes=0-7'}});assert.equal(ranged.status,206);assert.equal((await ranged.arrayBuffer()).byteLength,8);
  const backup=await fetch(base+'/api/backup');assert.equal(backup.status,200);const tar=Buffer.from(await backup.arrayBuffer());assert(tar.includes(fixture));const archive=join(dir,'test-backup.tar');await writeFile(archive,tar);
  const restored=join(dir,'restored');const restore=spawn(process.execPath,['scripts/restore.mjs',archive,restored],{stdio:'pipe'});const code=await new Promise(r=>restore.on('exit',r));assert.equal(code,0);const restoredDb=new DatabaseSync(join(restored,'social.sqlite'));assert.equal(restoredDb.prepare('SELECT COUNT(*) n FROM posts').get().n,2);restoredDb.close();
  await stop(child);child=await start(dir,port);assert.equal((await call('/posts/'+p.id)).data.status,'scheduled');assert.equal((await fetch(base+media.url)).status,200);
}finally{await stop(child);await rm(dir,{recursive:true,force:true});}});
test('production requires login, secure cookies and CSRF',async()=>{const dir=await mkdtemp(join(tmpdir(),'social-auth-'));const port=3192,base=`http://127.0.0.1:${port}`;const child=await start(dir,port,true);try{assert.equal((await fetch(base+'/api/bootstrap')).status,401);const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'owner@example.com',password:'test-owner-password-12345'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie');assert(cookie.includes('HttpOnly'));assert(cookie.includes('Secure'));const session=await(await fetch(base+'/api/session',{headers:{Cookie:cookie.split(';')[0]}})).json();assert.equal(session.user.role,'owner');assert.equal((await fetch(base+'/api/posts',{method:'POST',headers:{Cookie:cookie.split(';')[0],'Content-Type':'application/json'},body:'{}'})).status,403);}finally{await stop(child);await rm(dir,{recursive:true,force:true});}});
