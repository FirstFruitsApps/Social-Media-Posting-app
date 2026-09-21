import { open, mkdir, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const [archive,destination]=process.argv.slice(2);
if(!archive||!destination)throw new Error('Usage: node scripts/restore.mjs backup.tar NEW_EMPTY_DATA_DIRECTORY');
const target=resolve(destination);await mkdir(target,{recursive:true});if((await readdir(target)).length)throw new Error('Restore target must be empty. Stop the app and restore into a NEW directory.');
const input=await open(resolve(archive),'r');const total=(await input.stat()).size;let position=0,count=0;
try {
  while(position+512<=total){const block=Buffer.alloc(512);await input.read(block,0,512,position);position+=512;if(block.every(b=>b===0))break;const name=block.toString('utf8',0,100).split('\0')[0];const size=parseInt(block.toString('ascii',124,136).replace(/\0/g,'').trim(),8);const type=String.fromCharCode(block[156]);
    if(!/^(social\.sqlite|media\/[a-f0-9-]+\.(jpg|png|webp|mp4|mov))$/.test(name)||!['0','\0'].includes(type)||!Number.isSafeInteger(size)||size<0||position+size>total)throw new Error('Invalid or unsafe backup entry. Restore cancelled.');
    await mkdir(resolve(target,'media'),{recursive:true});const output=await open(resolve(target,name),'wx',0o600);try{let remaining=size;while(remaining){const chunk=Buffer.alloc(Math.min(remaining,1024*1024));const {bytesRead}=await input.read(chunk,0,chunk.length,position);if(!bytesRead)throw new Error('Truncated backup.');await output.write(chunk,0,bytesRead);remaining-=bytesRead;position+=bytesRead;}}finally{await output.close();}position+=(512-size%512)%512;count++;
  }
}finally{await input.close();}
await stat(resolve(target,'social.sqlite'));const db=new DatabaseSync(resolve(target,'social.sqlite'));const check=db.prepare('PRAGMA integrity_check').get();db.close();if(check.integrity_check!=='ok')throw new Error('Restored database failed integrity validation.');
console.log(`Restored ${count} files to ${target}. Point DATA_DIR at this directory, then restart. Sessions and password hashes are included; protect this directory.`);
