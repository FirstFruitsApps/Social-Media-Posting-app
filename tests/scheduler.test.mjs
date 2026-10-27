import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, now } from '../src/db.mjs';
import { createScheduler } from '../src/scheduler.mjs';

function fixture(status='draft', mediaExists=true) {
  const directory=mkdtempSync(join(tmpdir(),'social-scheduler-'));
  const db=openDatabase(directory);
  const stamp=now();
  const payload={title:'Storage unit offer',kind:'photo',caption:'Confirmed product details.',mediaIds:['image-1'],platforms:['facebook'],variants:{},options:{},product:'Storage',price:'',offer:'',link:'',locationId:'tucson',scheduled_at:null};
  if(mediaExists) db.prepare('INSERT INTO media(id,name,type,size,filename,created_at) VALUES (?,?,?,?,?,?)').run('image-1','product.jpg','image/jpeg',12,'image-1.jpg',stamp);
  db.prepare('UPDATE settings SET value=? WHERE key=?').run(JSON.stringify({company:'Storage',website:'',timezone:'America/Phoenix',requireApproval:false,locations:[{id:'tucson',name:'Tucson',profile:'storage-profile'}]}),'workspace');
  db.prepare('INSERT INTO posts(id,title,kind,caption,status,scheduled_at,payload,revision,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run('post-1',payload.title,payload.kind,payload.caption,status,null,JSON.stringify(payload),1,stamp,stamp);
  return {db,directory};
}

test('enqueue permits only a ready draft, approved post, or scheduled post',()=>{
  for(const status of ['archived','pending_approval','published','publishing','partial','needs_attention']) {
    const {db,directory}=fixture(status);
    try {
      const scheduler=createScheduler(db,{configured:true});
      assert.throws(()=>scheduler.enqueue('post-1','owner'),{status:409},status);
      assert.equal(db.prepare('SELECT COUNT(*) n FROM deliveries').get().n,0,status);
    } finally {db.close();rmSync(directory,{recursive:true,force:true});}
  }
});

test('publishing and delivery completion advance revision only when post status changes',async()=>{
  const {db,directory}=fixture();
  try {
    let sends=0,polls=0;
    const provider={configured:true,async send(){sends++;return {success:true};},async status(){polls++;return {status:'published',message:'Confirmed',url:'https://facebook.com/post/1',remote_id:'remote-1'};}};
    const scheduler=createScheduler(db,provider);
    scheduler.enqueue('post-1','owner');
    let postRow=db.prepare('SELECT status,revision FROM posts WHERE id=?').get('post-1');
    assert.equal(postRow.status,'publishing');assert.equal(postRow.revision,2);
    await scheduler.tick();
    assert.equal(sends,1);
    postRow=db.prepare('SELECT status,revision FROM posts WHERE id=?').get('post-1');
    assert.equal(postRow.status,'publishing');assert.equal(postRow.revision,2);
    db.prepare('UPDATE deliveries SET next_check=NULL').run();
    // A newly created scheduler instance recovers an in-flight delivery by polling only.
    await createScheduler(db,provider).tick();
    assert.equal(sends,1);
    assert.equal(polls,1);
    postRow=db.prepare('SELECT status,revision FROM posts WHERE id=?').get('post-1');
    assert.equal(postRow.status,'published');assert.equal(postRow.revision,3);
    createScheduler(db,provider).setStatus('post-1');
    assert.equal(db.prepare('SELECT revision FROM posts WHERE id=?').get('post-1').revision,3);
  } finally {db.close();rmSync(directory,{recursive:true,force:true});}
});

test('an uncertain send stays processing and survives scheduler restart without resending',async()=>{
  const {db,directory}=fixture();
  try {
    let sends=0,polls=0;
    const provider={configured:true,async send(){sends++;throw new Error('connection lost after request');},async status(){polls++;return {status:'processing',message:'Still processing'};}};
    createScheduler(db,provider).enqueue('post-1','owner');
    await createScheduler(db,provider).tick();
    db.prepare('UPDATE deliveries SET next_check=NULL').run();
    await createScheduler(db,provider).tick();
    assert.equal(sends,1);
    assert.equal(polls,1);
    assert.equal(db.prepare('SELECT status FROM deliveries').get().status,'processing');
    assert.equal(db.prepare('SELECT attempts FROM deliveries').get().attempts,1);
    assert.equal(db.prepare('SELECT revision FROM posts').get().revision,2);
  } finally {db.close();rmSync(directory,{recursive:true,force:true});}
});

test('missing selected media produces a readable validation error',()=>{
  const {db,directory}=fixture('draft',false);
  try {
    assert.throws(()=>createScheduler(db,{configured:true}).enqueue('post-1','owner'),/selected files is no longer available/);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM deliveries').get().n,0);
  } finally {db.close();rmSync(directory,{recursive:true,force:true});}
});
