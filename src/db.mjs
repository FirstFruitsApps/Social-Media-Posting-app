import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export function openDatabase(directory) {
  mkdirSync(directory, { recursive: true });
  mkdirSync(resolve(directory, 'media'), { recursive: true });
  const db = new DatabaseSync(resolve(directory, 'social.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL, password TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, size INTEGER NOT NULL, filename TEXT NOT NULL, alt TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, title TEXT NOT NULL, kind TEXT NOT NULL, caption TEXT NOT NULL, status TEXT NOT NULL, scheduled_at TEXT, payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS deliveries (id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id), platform TEXT NOT NULL, profile TEXT NOT NULL, status TEXT NOT NULL, request_id TEXT, remote_id TEXT, url TEXT, message TEXT NOT NULL DEFAULT '', attempts INTEGER NOT NULL DEFAULT 0, next_check TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(post_id,platform,profile));
    CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, subject TEXT NOT NULL, created_at TEXT NOT NULL);
    PRAGMA user_version=1;`);
  const defaults = { company: 'Advanced Storage', website: 'https://storageaz.com', timezone: 'America/Phoenix', requireApproval: false, locations: [{ id: 'tucson', name: 'Tucson, AZ', profile: '' }] };
  db.prepare('INSERT OR IGNORE INTO settings VALUES (?,?)').run('workspace', JSON.stringify(defaults));
  return db;
}
export function settings(db) { return JSON.parse(db.prepare('SELECT value FROM settings WHERE key=?').get('workspace').value); }
export function audit(db, actor, action, subject) { db.prepare('INSERT INTO audit VALUES (?,?,?,?,?)').run(id(), actor, action, subject, now()); }
export function postView(db, row) {
  if (!row) return null;
  return { ...JSON.parse(row.payload), ...row, payload: undefined, deliveries: db.prepare('SELECT * FROM deliveries WHERE post_id=?').all(row.id) };
}
