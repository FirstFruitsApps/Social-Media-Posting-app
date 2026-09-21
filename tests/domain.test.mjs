import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aggregate, normalizeResult, normalizePost, validateReady, safeUrl } from '../src/domain.mjs';
import { openDatabase,postView } from '../src/db.mjs';
import { localTimeToUtc } from '../public/time.js';
import { hashPassword,verifyPassword } from '../src/auth.mjs';

test('a partial publish never becomes fully published',()=>{assert.equal(aggregate([{status:'published'},{status:'needs_attention'}]),'partial');assert.equal(aggregate([{status:'processing'},{status:'published'}]),'publishing');});
test('queued success and TikTok inbox fallback are not publications',()=>{assert.equal(normalizeResult({results:[{platform:'tiktok',success:true,fallback_to_inbox:true}]},'tiktok').status,'manual_action');assert.equal(normalizeResult({results:[{platform:'facebook',success:true,message:'Queued'}]},'facebook').status,'processing');assert.equal(normalizeResult({status:'completed',results:[{platform:'facebook',skipped:true,success:true}]},'facebook').status,'needs_attention');assert.equal(normalizeResult({results:[{platform:'facebook',success:true,post_url:'https://facebook.com/post/1'}]},'facebook').status,'published');});
test('unsafe external links rejected',()=>{assert.throws(()=>safeUrl('javascript:alert(1)'));assert.throws(()=>safeUrl('https://user:password@example.com'));assert.equal(safeUrl('https://storageaz.com'),'https://storageaz.com/');});
test('schedule uses Arizona and rejects DST gaps and ambiguity',()=>{assert.equal(localTimeToUtc('2026-09-22T09:00','America/Phoenix'),'2026-09-22T16:00:00.000Z');assert.throws(()=>localTimeToUtc('2026-03-08T02:30','America/New_York'),/does not exist/);assert.throws(()=>localTimeToUtc('2026-11-01T01:30','America/New_York'),/occurs twice/);});
test('password verification uses salted hashes',async()=>{const hash=await hashPassword('long-example-password');assert.equal(await verifyPassword('long-example-password',hash),true);assert.equal(await verifyPassword('incorrect',hash),false);});
test('media workflow and authoritative status are preserved',()=>{const dir=mkdtempSync(join(tmpdir(),'social-domain-'));const db=openDatabase(dir);try{db.prepare('INSERT INTO media(id,name,type,size,filename,created_at) VALUES (?,?,?,?,?,?)').run('m','test.mp4','video/mp4',10,'m.mp4',new Date().toISOString());assert.throws(()=>normalizePost({kind:'photo',title:'Product',mediaIds:['m']},db),/separate/);assert.throws(()=>normalizePost({kind:'photo',title:'Product',platforms:['youtube']},db),/does not support/);const row={id:'p',title:'New',status:'scheduled',revision:2,payload:JSON.stringify({status:'draft',title:'Old',revision:1})};const result=postView(db,row);assert.equal(result.status,'scheduled');assert.equal(result.title,'New');assert.equal(result.revision,2);}finally{db.close();rmSync(dir,{recursive:true,force:true});}});
test('required platform metadata blocks incomplete posts',()=>{const p={mediaIds:['m'],platforms:['youtube','tiktok'],caption:'Product video',kind:'video',options:{},variants:{}};const errors=validateReady(p,[{type:'video/mp4'}]);assert(errors.some(x=>x.includes('YouTube')));assert(errors.some(x=>x.includes('TikTok')));});
