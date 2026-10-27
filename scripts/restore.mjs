import { open, mkdir, readdir, stat, lstat, unlink, rmdir, rm } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { resolve, dirname, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
const [archive,destination]=process.argv.slice(2);
if(!archive||!destination)throw new Error('Usage: node scripts/restore.mjs backup.tar NEW_EMPTY_DATA_DIRECTORY');
const target=resolve(destination);
let targetInfo;
try { targetInfo=await lstat(target); } catch (error) { if(error.code!=='ENOENT') throw error; }
if(targetInfo?.isSymbolicLink() || (targetInfo && !targetInfo.isDirectory())) throw new Error('Restore target must be a real directory, not a link or file.');
if(targetInfo && (await readdir(target)).length) throw new Error('Restore target must be empty. Stop the app and restore into a NEW directory.');
const stage=resolve(dirname(target),`.${basename(target)}.restore-${randomUUID()}`);
await mkdir(dirname(target),{recursive:true});
await mkdir(stage,{mode:0o700});
let input;
try { input=await open(resolve(archive),'r'); } catch(error) { await rm(stage,{recursive:true,force:true}); throw error; }
const total=(await input.stat()).size;let position=0,count=0,hasDatabase=false,terminated=false;
try {
  while(position+512<=total){const block=Buffer.alloc(512);const {bytesRead:headerBytes}=await input.read(block,0,512,position);if(headerBytes!==512)throw new Error('Truncated backup header.');position+=512;if(block.every(b=>b===0)){const end=Buffer.alloc(512);const {bytesRead:endBytes}=await input.read(end,0,512,position);if(endBytes!==512||!end.every(b=>b===0))throw new Error('Truncated backup end marker.');position+=512;terminated=true;break;}
    const checksumField=block.toString('ascii',148,156).replace(/[\0 ]/g,'');const checksum=/^[0-7]{1,7}$/.test(checksumField)?Number.parseInt(checksumField,8):NaN;const expected=[...block].reduce((sum,value,index)=>sum+(index>=148&&index<156?32:value),0);
    const rawSize=block.toString('ascii',124,136).replace(/\0/g,'').trim();const name=block.toString('utf8',0,100).split('\0')[0];const size=/^[0-7]+$/.test(rawSize)?Number.parseInt(rawSize,8):NaN;const type=String.fromCharCode(block[156]);
    if(!Number.isSafeInteger(checksum)||checksum!==expected||!/^(social\.sqlite|media\/[a-f0-9-]+\.(jpg|png|webp|mp4|mov))$/.test(name)||!['0','\0'].includes(type)||!Number.isSafeInteger(size)||size<0||position+size>total||(name==='social.sqlite'&&hasDatabase))throw new Error('Invalid or unsafe backup entry. Restore cancelled.');
    if(name==='social.sqlite')hasDatabase=true;
    if(name.startsWith('media/'))await mkdir(resolve(stage,'media'),{recursive:true});const output=await open(resolve(stage,name),'wx',0o600);try{let remaining=size;while(remaining){const chunk=Buffer.alloc(Math.min(remaining,1024*1024));const {bytesRead}=await input.read(chunk,0,chunk.length,position);if(!bytesRead)throw new Error('Truncated backup.');await output.write(chunk,0,bytesRead);remaining-=bytesRead;position+=bytesRead;}}finally{await output.close();}const padding=(512-size%512)%512;if(position+padding>total)throw new Error('Truncated backup padding.');position+=padding;count++;
  }
}catch(error){await rm(stage,{recursive:true,force:true});throw error;}finally{await input.close();}
let promotionStarted=false;
const createdFiles=[],createdDirectories=[];
try {
  if(!terminated||!hasDatabase)throw new Error('Backup is incomplete or does not contain a database. Restore cancelled.');
  await stat(resolve(stage,'social.sqlite'));const db=new DatabaseSync(resolve(stage,'social.sqlite'));let check;try{check=db.prepare('PRAGMA integrity_check').get();}finally{db.close();}if(check.integrity_check!=='ok')throw new Error('Restored database failed integrity validation.');
  let currentTarget;
  try { currentTarget=await lstat(target); } catch(error) { if(error.code!=='ENOENT')throw error; }
  if(currentTarget?.isSymbolicLink()||(currentTarget&&!currentTarget.isDirectory())||(currentTarget&&(await readdir(target)).length))throw new Error('Restore target changed during validation. Keep it empty and try again.');
  promotionStarted=true;
  if(!currentTarget){await mkdir(target,{mode:0o700});createdDirectories.push(target);}
  const entries=await readdir(stage,{withFileTypes:true});
  async function promoteFile(source,destination) {
    const output=createWriteStream(destination,{flags:'wx',mode:0o600});
    await new Promise((resolve,reject)=>{output.once('open',resolve);output.once('error',reject);});
    createdFiles.push(destination);await pipeline(createReadStream(source),output);
  }
  for(const entry of entries) {
    if(entry.isDirectory()) {
      const from=resolve(stage,entry.name),to=resolve(target,entry.name);
      try {await mkdir(to,{mode:0o700});createdDirectories.push(to);} catch(error) {if(error.code!=='EEXIST')throw error;const info=await lstat(to);if(info.isSymbolicLink()||!info.isDirectory())throw new Error('Restore target changed during validation.');}
      for(const filename of await readdir(from)) {const source=resolve(from,filename),destination=resolve(to,filename);await promoteFile(source,destination);}
    } else {const source=resolve(stage,entry.name),destination=resolve(target,entry.name);await promoteFile(source,destination);}
  }
  await rm(stage,{recursive:true,force:true});
}catch(error){
  await rm(stage,{recursive:true,force:true});
  if(promotionStarted){for(const file of createdFiles.reverse())await unlink(file).catch(()=>{});for(const directory of createdDirectories.reverse())await rmdir(directory).catch(()=>{});}
  throw error;
}
console.log(`Restored ${count} files to ${target}. Point DATA_DIR at this directory, then restart. Sessions and password hashes are included; protect this directory.`);
