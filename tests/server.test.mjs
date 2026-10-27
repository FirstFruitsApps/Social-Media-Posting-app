import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp,rm,writeFile,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:net';
import { request } from 'node:http';
const fixture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
async function freePort(){const socket=createServer();await new Promise((ok,fail)=>{socket.once('error',fail);socket.listen(0,'127.0.0.1',ok);});const port=socket.address().port;await new Promise(ok=>socket.close(ok));return port;}
async function start(dir,port,production=false,aiKey=''){
  const child=spawn(process.execPath,['src/server.mjs'],{cwd:resolve('.'),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:dir,NODE_ENV:production?'production':'development',APP_ORIGIN:`${production?'https':'http'}://127.0.0.1:${port}`,UPLOAD_POST_API_KEY:'',OPENAI_API_KEY:aiKey,BOOTSTRAP_ADMIN_EMAIL:production?'owner@example.com':'',BOOTSTRAP_ADMIN_PASSWORD:production?'test-owner-password-12345':''},stdio:'pipe'});
  let stderr='',stdout='';child.stderr.on('data',d=>stderr+=d);child.stdout.on('data',d=>stdout+=d);
  try {for(let n=0;n<200;n++){
    if(child.exitCode!==null)throw new Error(stderr||'Server exited');
    // A healthy unrelated process on a busy port must never satisfy readiness.
    if(stdout.includes('Storage Social listening on ')){
      try{if((await fetch(`http://127.0.0.1:${port}/healthz`,{signal:AbortSignal.timeout(1000)})).ok)return child;}catch{}
    }
    await delay(50);
  }throw new Error('Server did not start.');}catch(error){await stop(child);throw error;}
}
async function stop(child){if(child.exitCode!==null)return;const done=new Promise(r=>child.once('exit',r));child.kill();await done;}

test('concurrent state changes cannot be overwritten by stale draft edits',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'social-revisions-')),port=await freePort(),base=`http://127.0.0.1:${port}`;
  const child=await start(dir,port);
  const call=(path,method='GET',data)=>fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':'local-preview'},body:data===undefined?undefined:JSON.stringify(data)});
  try {
    for(const value of [null,[],true,'text'])assert.equal((await call('/posts','POST',value)).status,400);
    const original=await(await call('/posts','POST',{title:'Original',kind:'photo',caption:'Saved facts'})).json();
    const pending=await(await call(`/posts/${original.id}/submit`,'POST',{})).json();
    const approved=await(await call(`/posts/${original.id}/approve`,'POST',{})).json();
    assert.equal(pending.revision,original.revision+1);assert.equal(approved.revision,pending.revision+1);
    assert.equal((await call(`/posts/${original.id}`,'PUT',{...original,title:'Stale change'})).status,409);
    const draft=await(await call(`/posts/${original.id}/unschedule`,'POST',{})).json();
    const payload=JSON.stringify({...draft,title:'Delayed overwrite'});
    let writer;
    const response=new Promise((ok,fail)=>{
      writer=request(base+`/api/posts/${draft.id}`,{method:'PUT',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload),'X-CSRF-Token':'local-preview',Expect:'100-continue'}},r=>{r.resume();r.on('end',()=>ok(r.statusCode));});
      writer.once('error',fail);
    });
    const waiting=new Promise(ok=>writer.once('continue',ok));writer.flushHeaders();await waiting;
    const archived=await(await call(`/posts/${draft.id}/archive`,'POST',{})).json();
    assert.equal(archived.revision,draft.revision+1);
    writer.end(payload);assert.equal(await response,409);
    const final=await(await call(`/posts/${draft.id}`)).json();assert.equal(final.status,'archived');assert.equal(final.title,'Original');
  }finally{await stop(child);await rm(dir,{recursive:true,force:true});}
});
test('password change verifies identity, rejects invalid requests and revokes only this account sessions',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'social-password-')),port=await freePort(),base=`http://127.0.0.1:${port}`;
  let child=await start(dir,port,true);
  const oldPassword='test-owner-password-12345',newPassword='replacement-test-password-45678';
  const login=async(email,password)=>fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  const headersFor=async(response)=>{assert.equal(response.status,200);const Cookie=response.headers.get('set-cookie').split(';')[0];const session=await(await fetch(base+'/api/session',{headers:{Cookie}})).json();return {Cookie,'Content-Type':'application/json','X-CSRF-Token':session.user.csrf};};
  try {
    const owner=await headersFor(await login('owner@example.com',oldPassword));
    const second=await headersFor(await login('owner@example.com',oldPassword));
    const input={currentPassword:oldPassword,newPassword,confirmPassword:newPassword};
    const change=(data=input,headers=owner)=>fetch(base+'/api/password',{method:'POST',headers,body:JSON.stringify(data)});
    assert.equal((await change(input,{})).status,401);
    assert.equal((await change(input,{...owner,'X-CSRF-Token':'bad'})).status,403);
    assert.equal((await change(input,{...owner,Origin:'https://attacker.example'})).status,403);
    assert.equal((await change({...input,newPassword:'short',confirmPassword:'short'})).status,400);
    assert.equal((await change({...input,confirmPassword:'does-not-match'})).status,400);
    assert.equal((await change({...input,currentPassword:'incorrect-current-password'})).status,400);
    assert.equal((await change({...input,newPassword:oldPassword,confirmPassword:oldPassword})).status,400);
    assert.equal((await fetch(base+'/api/bootstrap',{headers:owner})).status,200);
    const created=await fetch(base+'/api/users',{method:'POST',headers:owner,body:JSON.stringify({name:'Editor',email:'editor@example.com',password:'test-editor-password-12345',role:'editor'})});assert.equal(created.status,201);
    const editor=await headersFor(await login('editor@example.com','test-editor-password-12345'));
    const response=await change();assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/Max-Age=0.*Secure/);
    assert.equal((await fetch(base+'/api/bootstrap',{headers:owner})).status,401);
    assert.equal((await fetch(base+'/api/bootstrap',{headers:second})).status,401);
    assert.equal((await fetch(base+'/api/bootstrap',{headers:editor})).status,200);
    assert.equal((await login('owner@example.com',oldPassword)).status,401);
    const updated=await headersFor(await login('owner@example.com',newPassword));
    const activity=await(await fetch(base+'/api/audit',{headers:updated})).json();assert(activity.some(x=>x.action==='password_changed'));assert(!JSON.stringify(activity).includes(newPassword));
    await stop(child);child=await start(dir,port,true);
    assert.equal((await login('owner@example.com',newPassword)).status,200);
    assert.equal((await login('owner@example.com',oldPassword)).status,401);
  }finally{await stop(child);await rm(dir,{recursive:true,force:true});}
});
test('AI controls require owner authorization, CSRF and explicit opt-in without calling OpenAI',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'social-ai-auth-')),port=await freePort(),base=`http://127.0.0.1:${port}`;
  const child=await start(dir,port,true,'test-only-not-a-real-key');
  try {
    assert.equal((await fetch(base+'/api/ai/caption',{method:'POST',body:'{}'})).status,401);
    async function login(email,password){const response=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(response.status,200);const Cookie=response.headers.get('set-cookie').split(';')[0];const session=await(await fetch(base+'/api/session',{headers:{Cookie}})).json();return {Cookie,'Content-Type':'application/json','X-CSRF-Token':session.user.csrf};}
    const owner=await login('owner@example.com','test-owner-password-12345');
    const call=(path,method,data,headers=owner)=>fetch(base+'/api'+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});
    let state=await(await call('/bootstrap','GET')).json();assert.equal(state.ai.configured,true);assert.equal(state.ai.enabled,false);assert(!JSON.stringify(state).includes('test-only-not-a-real-key'));
    assert.equal((await call('/ai/settings','PUT',{enabled:true,monthlyBudget:10},{...owner,'X-CSRF-Token':'wrong'})).status,403);
    assert.equal((await call('/ai/settings','PUT',{enabled:true,monthlyBudget:100})).status,400);
    assert.equal((await call('/ai/caption','POST',{})).status,403);
    assert.equal((await call('/users','POST',{name:'Editor',email:'editor@example.com',password:'test-editor-password-12345',role:'editor'})).status,201);
    const editor=await login('editor@example.com','test-editor-password-12345');
    assert.equal((await call('/ai/settings','PUT',{enabled:true,monthlyBudget:10},editor)).status,403);
    assert.equal((await call('/ai/settings','PUT',{enabled:true,monthlyBudget:10})).status,200);
    state=await(await call('/bootstrap','GET')).json();assert.equal(state.aiEnabled,true);
    assert.equal((await call('/ai/settings','PUT',{enabled:false,monthlyBudget:10})).status,200);
    assert.equal((await call('/ai/caption','POST',{},editor)).status,403);
  } finally {await stop(child);await rm(dir,{recursive:true,force:true});}
});
test('uploads, revision conflicts, scheduling, restart persistence and full backup restore',async()=>{const dir=await mkdtemp(join(tmpdir(),'social-api-'));const port=await freePort(),base=`http://127.0.0.1:${port}`;let child=await start(dir,port);const call=async(path,method='GET',data,extra={})=>{const response=await fetch(base+'/api'+path,{method,headers:{'X-CSRF-Token':'local-preview','Content-Type':'application/json',...extra},body:data===undefined?undefined:JSON.stringify(data)});return {status:response.status,data:await response.json()};};try{
  assert.equal((await call('/bootstrap')).status,200);
  assert.equal((await fetch(base+'/time.js')).status,200);
  assert.equal((await fetch(base+'/draft-safety.js')).status,200);
  const guide=await fetch(base+'/storage-social-user-guide.pdf');assert.equal(guide.status,200);assert.match(guide.headers.get('content-type')||'',/^application\/pdf/);assert((await guide.arrayBuffer()).byteLength>10000);
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
test('production requires login, secure cookies and CSRF',async()=>{const dir=await mkdtemp(join(tmpdir(),'social-auth-'));const port=await freePort(),base=`http://127.0.0.1:${port}`;const child=await start(dir,port,true);try{assert.equal((await fetch(base+'/api/bootstrap')).status,401);const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'owner@example.com',password:'test-owner-password-12345'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie');assert(cookie.includes('HttpOnly'));assert(cookie.includes('Secure'));const session=await(await fetch(base+'/api/session',{headers:{Cookie:cookie.split(';')[0]}})).json();assert.equal(session.user.role,'owner');assert.equal((await fetch(base+'/api/posts',{method:'POST',headers:{Cookie:cookie.split(';')[0],'Content-Type':'application/json'},body:'{}'})).status,403);}finally{await stop(child);await rm(dir,{recursive:true,force:true});}});
