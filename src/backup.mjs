import { backup } from 'node:sqlite';
import { mkdir, stat, readdir, unlink } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';

function header(name,size) {
  const block=Buffer.alloc(512);
  block.write(name,0,100);block.write('0000600\0',100,8);block.write('0000000\0',108,8);block.write('0000000\0',116,8);
  block.write(size.toString(8).padStart(11,'0')+'\0',124,12);block.write(Math.floor(Date.now()/1000).toString(8).padStart(11,'0')+'\0',136,12);
  block.fill(32,148,156);block.write('0',156);block.write('ustar\0',257,6);block.write('00',263,2);
  block.write([...block].reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ',148,8);return block;
}
export async function backupStream(db,directory) {
  const temp=resolve(directory,'backups');await mkdir(temp,{recursive:true});const snapshot=resolve(temp,`${randomUUID()}.sqlite`);
  await backup(db,snapshot);
  const files=[{name:'social.sqlite',path:snapshot}];
  for(const name of await readdir(resolve(directory,'media'))) if(/^[a-f0-9-]+\.(jpg|png|webp|mp4|mov)$/.test(name))files.push({name:`media/${name}`,path:resolve(directory,'media',name)});
  async function* generate() {
    try {
      for(const file of files) {const info=await stat(file.path);yield header(file.name,info.size);for await(const chunk of createReadStream(file.path))yield chunk;const padding=(512-info.size%512)%512;if(padding)yield Buffer.alloc(padding);}
      yield Buffer.alloc(1024);
    }finally{await unlink(snapshot).catch(()=>{});}
  }
  return Readable.from(generate());
}
