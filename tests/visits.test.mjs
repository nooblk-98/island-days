import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequest } from '../functions/api/visits.js';

const origin = 'https://dayoff.itsnooblk.com';
const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  const env = { VISITS_DB: { prepare: sql => ({ first: async () => db.prepare(sql).get() }) } };
  const request = (method = 'GET', headers = {}) => onRequest({ env, request: new Request(`${origin}/api/visits`, { method, headers: { Origin: origin, ...headers } }) });
  return { db, request };
}
test('parallel page opens increment atomically; reading the count and reapplying schema never increment or reset it', async () => {
  const { db, request } = fixture();
  try {
    const responses = await Promise.all(Array.from({ length: 50 }, () => request('POST')));
    assert.ok(responses.every(r => r.status === 200));
    db.exec(schema);
    const response = await request();
    const result = await response.json();
    assert.equal(result.total, 50);
    assert.match(result.since, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal((await (await request()).json()).total, 50);
  } finally { db.close(); }
});
test('cross-site requests cannot inflate the visit count; unsupported methods are rejected', async () => {
  const { db, request } = fixture();
  try {
    assert.equal((await request('POST', { Origin: 'https://example.com' })).status, 403);
    assert.equal((await request('POST', { Origin: 'null' })).status, 403);
    assert.equal((await request('POST', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    assert.equal((await request('PUT')).status, 405);
    assert.equal((await (await request()).json()).total, 0);
  } finally { db.close(); }
});
test('unavailable counters return no fabricated total or database details', async () => {
  const request = new Request(`${origin}/api/visits`);
  for (const env of [{}, { VISITS_DB: { prepare() { throw new Error('private database details'); } } }]) {
    const response = await onRequest({ request, env });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Counter unavailable' });
  }
});
