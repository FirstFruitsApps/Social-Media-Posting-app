import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { openDatabase } from '../src/db.mjs';
import { backupStream } from '../src/backup.mjs';
const directory=resolve(process.env.DATA_DIR||'data');const out=resolve('backups');await mkdir(out,{recursive:true});
const db=openDatabase(directory);const file=resolve(out,`storage-social-${new Date().toISOString().replace(/[:.]/g,'-')}.tar`);
await pipeline(await backupStream(db,directory),createWriteStream(file,{flags:'wx',mode:0o600}));db.close();console.log(`Backup saved: ${file}`);
