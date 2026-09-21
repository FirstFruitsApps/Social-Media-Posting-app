import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { id, now } from './db.mjs';
import { AppError } from './domain.mjs';
const scrypt=promisify(scryptCallback);
export async function hashPassword(password) {const salt=randomBytes(16).toString('hex');return `${salt}:${(await scrypt(password,salt,64)).toString('hex')}`;}
export async function verifyPassword(password,stored) {const [salt,hash]=stored.split(':');const derived=await scrypt(password,salt,64);const expected=Buffer.from(hash,'hex');return derived.length===expected.length&&timingSafeEqual(derived,expected);}
export const digest=value=>createHash('sha256').update(value).digest('hex');
export async function bootstrap(db,env) {
  if(db.prepare('SELECT COUNT(*) AS n FROM users').get().n)return;
  if(!env.BOOTSTRAP_ADMIN_EMAIL || !env.BOOTSTRAP_ADMIN_PASSWORD)return;
  if(env.BOOTSTRAP_ADMIN_PASSWORD.length<14)throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain at least 14 characters.');
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run(id(),env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase().trim(),'Owner','owner',await hashPassword(env.BOOTSTRAP_ADMIN_PASSWORD),now());
}
export function sessionUser(db,request,localPreview) {
  if(localPreview)return {id:'local-owner',name:'Local owner',email:'',role:'owner',csrf:'local-preview',localPreview:true};
  const token=(request.headers.cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith('storage_session='))?.slice(16);
  if(!token)return null;
  const row=db.prepare('SELECT users.id,users.name,users.email,users.role,sessions.csrf FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND expires_at>?').get(digest(token),now());
  return row||null;
}
export function requireRole(user,roles) {if(!user || !roles.includes(user.role))throw new AppError('Your role does not allow this action.',403);}
export function createSession(db,userId,production) {
  db.prepare('DELETE FROM sessions WHERE expires_at<?').run(now());
  const token=randomBytes(32).toString('hex');const csrf=randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(digest(token),userId,csrf,new Date(Date.now()+12*60*60*1000).toISOString());
  return `storage_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${production?'; Secure':''}`;
}
