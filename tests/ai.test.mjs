import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {openDatabase,settings} from '../src/db.mjs';
import {createAi,AI_MODEL} from '../src/ai.mjs';

const result={title:'Product spotlight',caption:'Explore our storage options. Contact us for details.',variants:{facebook:'Explore our storage options. Contact us for details.'},reviewNotes:['Confirm availability before publishing.']};
function success(value=result){return Response.json({status:'completed',usage:{input_tokens:1200,output_tokens:300},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});}
async function setup(t){const dir=await mkdtemp(join(tmpdir(),'social-ai-')),db=openDatabase(dir);t.after(async()=>{db.close();await rm(dir,{recursive:true,force:true});});
  db.prepare('UPDATE settings SET value=? WHERE key=?').run(JSON.stringify({...settings(db),aiEnabled:true,aiMonthlyBudget:10}),'workspace');
  const mid=randomUUID();const filename=mid+'.png';const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yS6sAAAAASUVORK5CYII=','base64');await writeFile(join(dir,'media',filename),bytes);
  db.prepare('INSERT INTO media(id,name,type,size,filename,created_at) VALUES (?,?,?,?,?,?)').run(mid,'product.png','image/png',bytes.length,filename,new Date().toISOString());
  return {dir,db,user:{id:'owner'},input:{requestId:randomUUID(),kind:'photo',product:'Storage container',price:'',offer:'',link:'https://storageaz.com',notes:'Friendly',mediaIds:[mid],platforms:['facebook'],locationId:'tucson'}};
}
test('AI sends only selected facts/photos and returns suggestions without saving or publishing',async t=>{const f=await setup(t);let requests=0;
 const ai=createAi(f.db,join(f.dir,'media'),'test-secret',async(url,options)=>{requests++;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);assert.equal(body.model,AI_MODEL);assert.equal(body.store,false);assert.equal(body.reasoning.effort,'low');assert.equal(body.text.format.strict,true);assert.equal(body.input[0].content[1].detail,'low');assert.match(body.input[0].content[1].image_url,/^data:image\/png;base64,/);assert(!options.body.includes(f.dir));assert(!options.body.includes('test-secret'));return success();});
 assert.deepEqual(await ai.generate(f.input,f.user),result);assert.equal(ai.status().estimatedSpend,0.006);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM posts').get().n,0);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM deliveries').get().n,0);
 assert.deepEqual(await ai.generate(f.input,f.user),result);assert.equal(requests,1);assert(!JSON.stringify(ai.status()).includes('test-secret'));
});
test('missing key, disabled AI, malformed input and wrong media cannot incur calls',async t=>{const f=await setup(t);let calls=0;const fetcher=()=>{calls++;throw Error('Must not call');};
 await assert.rejects(createAi(f.db,join(f.dir,'media'),'',fetcher).generate(f.input,f.user),/key/i);
 const ai=createAi(f.db,join(f.dir,'media'),'fake',fetcher);
 for(const patch of [{product:''},{kind:'invalid'},{platforms:['youtube']},{mediaIds:['missing']},{link:'javascript:alert(1)'},{notes:'x'.repeat(2001)}])await assert.rejects(ai.generate({...f.input,...patch},f.user));
 f.db.prepare('UPDATE settings SET value=? WHERE key=?').run(JSON.stringify({...settings(f.db),aiEnabled:false}),'workspace');await assert.rejects(ai.generate(f.input,f.user),/enable/i);assert.equal(calls,0);
});
test('video caption requests send written facts without reading or transmitting video',async t=>{const f=await setup(t);const ai=createAi(f.db,join(f.dir,'media'),'fake',async(url,options)=>{assert.equal(JSON.parse(options.body).input[0].content.length,1);return success();});await ai.generate({...f.input,kind:'video',mediaIds:['not-even-a-local-file'],notes:'A walkthrough of the container.'},f.user);});
test('overlapping generation is blocked, and request allowance survives restart',async t=>{const f=await setup(t);let release,entered;const started=new Promise(r=>entered=r);const ai=createAi(f.db,join(f.dir,'media'),'fake',()=>{entered();return new Promise(r=>release=r);});const running=ai.generate(f.input,f.user);await started;await assert.rejects(ai.generate({...f.input,requestId:randomUUID()},f.user),/Another/);release(success());await running;
 f.db.prepare('UPDATE settings SET value=? WHERE key=?').run(JSON.stringify({...settings(f.db),aiMonthlyBudget:0.25}),'workspace');const reboot=createAi(f.db,join(f.dir,'media'),'fake',()=>{throw Error('No call allowed');});await assert.rejects(reboot.generate({...f.input,requestId:randomUUID()},f.user),/allowance/);
});
test('network uncertainty retains cost reservation and never leaks provider secrets',async t=>{const f=await setup(t);const ai=createAi(f.db,join(f.dir,'media'),'fake',async()=>{throw Error('Authorization fake-secret');});await assert.rejects(ai.generate(f.input,f.user),e=>e.status===502&&!e.message.includes('fake-secret'));assert.equal(ai.status().estimatedSpend,0.25);assert.equal(f.db.prepare('SELECT status FROM ai_requests').get().status,'uncertain');});
test('billing rejection and invalid model output preserve drafts with actionable errors',async t=>{const f=await setup(t);let reply=new Response('private provider error',{status:429});const ai=createAi(f.db,join(f.dir,'media'),'fake',async()=>reply);await assert.rejects(ai.generate(f.input,f.user),/billing or rate limit/);assert.equal(ai.status().estimatedSpend,0);
 reply=success({...result,caption:'x'.repeat(451)});await assert.rejects(ai.generate({...f.input,requestId:randomUUID()},f.user),/caption limits/);assert.equal(ai.status().estimatedSpend,0.006);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM posts').get().n,0);
});
test('100 monthly attempts stop further calls even when API rejected earlier attempts',async t=>{const f=await setup(t);const ai=createAi(f.db,join(f.dir,'media'),'fake',async()=>{throw Error('No call allowed');});for(let i=0;i<100;i++)f.db.prepare('INSERT INTO ai_requests VALUES (?,?,?,?,?,?,?,?,?)').run(randomUUID(),'owner',new Date().toISOString().slice(0,7),'rejected',0,null,null,null,new Date().toISOString());await assert.rejects(ai.generate(f.input,f.user),/allowance/);});
