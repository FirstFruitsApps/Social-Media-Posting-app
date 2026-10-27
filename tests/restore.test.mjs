import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../src/db.mjs';
import { backupStream } from '../src/backup.mjs';

async function createArchive(parent) {
  const data=join(parent,'source');const db=openDatabase(data);let archive;const id=randomUUID(),filename=`${id}.png`,bytes=Buffer.from('small business photo fixture');
  try {
    await writeFile(join(data,'media',filename),bytes);
    db.prepare('INSERT INTO media(id,name,type,size,filename,created_at) VALUES (?,?,?,?,?,?)').run(id,'product.png','image/png',bytes.length,filename,new Date().toISOString());
    const stream=await backupStream(db,data);const parts=[];for await(const part of stream)parts.push(part);archive=Buffer.concat(parts);
  }
  finally { db.close(); }
  const path=join(parent,'valid.tar');await writeFile(path,archive);return {path,archive,filename,bytes};
}
async function restore(archive,target) {
  const child=spawn(process.execPath,['scripts/restore.mjs',archive,target],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>stderr+=chunk);const [code]=await once(child,'exit');return {code,stderr};
}

test('a valid app backup restores into both existing-empty and new destinations',async t=>{
  const parent=await mkdtemp(join(tmpdir(),'social-restore-'));t.after(()=>rm(parent,{recursive:true,force:true}));
  const {path,filename,bytes}=await createArchive(parent);const existing=join(parent,'existing');await mkdir(existing);const fresh=join(parent,'fresh');
  for(const target of [fresh,existing]) {
    const result=await restore(path,target);assert.equal(result.code,0,result.stderr);
    const db=new DatabaseSync(join(target,'social.sqlite'));try{assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(db.prepare('SELECT COUNT(*) AS count FROM media').get().count,1);}finally{db.close();}
    assert.deepEqual(await readFile(join(target,'media',filename)),bytes);
  }
});

test('a corrupt restore leaves the requested empty directory untouched and removes staging files', async t => {
  const parent=await mkdtemp(join(tmpdir(),'social-restore-'));t.after(()=>rm(parent,{recursive:true,force:true}));
  const target=join(parent,'restored');await mkdir(target);const {path,archive}=await createArchive(parent);
  const size=Number.parseInt(archive.toString('ascii',124,136).replace(/\0/g,'').trim(),8);const secondHeader=512+size+(512-size%512)%512;
  archive[secondHeader+148]=0x58;const corrupt=join(parent,'corrupt.tar');await writeFile(corrupt,archive);
  const {code}=await restore(corrupt,target);assert.notEqual(code,0);
  assert.deepEqual(await readdir(target),[]);
  assert.deepEqual((await readdir(parent)).filter(name=>name.includes('.restore-')),[]);
});

test('restore refuses a nonempty target without removing its existing files',async t=>{
  const parent=await mkdtemp(join(tmpdir(),'social-restore-'));t.after(()=>rm(parent,{recursive:true,force:true}));
  const {path}=await createArchive(parent);const target=join(parent,'occupied');await mkdir(target);const sentinel=join(target,'keep.txt');await writeFile(sentinel,'keep this file');
  const {code}=await restore(path,target);assert.notEqual(code,0);assert.equal(await readFile(sentinel,'utf8'),'keep this file');
  assert.deepEqual((await readdir(parent)).filter(name=>name.includes('.restore-')),[]);
});

