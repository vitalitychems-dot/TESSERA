import test from 'node:test'; import assert from 'node:assert';
import { cachedGet, changedPRs } from './pr-cache.mjs';
test('etag 304 reuses body', async () => {
  const c={etags:{},seen:{}}; let calls=[];
  const f=async(u,h)=>{calls.push(h); return h['If-None-Match']==='"e1"'?{status:304}:{status:200,etag:'"e1"',body:[1]};};
  assert.deepEqual((await cachedGet(c,'u',f)).body,[1]);
  const r=await cachedGet(c,'u',f); assert.ok(r.fromCache); assert.deepEqual(r.body,[1]);
});
test('skips unchanged heads', () => {
  const c={etags:{},seen:{}}; const prs=[{number:1,head:{sha:'a'}},{number:2,head:{sha:'b'}}];
  assert.equal(changedPRs(c,prs).length,2); assert.equal(changedPRs(c,prs).length,0);
  assert.deepEqual(changedPRs(c,[{number:1,head:{sha:'c'}},prs[1]]).map(p=>p.number),[1]);
});
