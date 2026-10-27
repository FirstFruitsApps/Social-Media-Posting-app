import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/auth.mjs';

test('password verification rejects malformed stored hashes safely',async()=>{
  assert.equal(await verifyPassword('a long password','not-a-hash'),false);
  assert.equal(await verifyPassword('a long password','0'.repeat(32)+':xyz'),false);
  assert.equal(await verifyPassword(null,'0'.repeat(32)+':'.padEnd(129,'0')),false);
  const hash=await hashPassword('a long password');assert.equal(await verifyPassword('a long password',hash),true);
});

