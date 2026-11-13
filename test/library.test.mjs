// Map library API (publish / list / get / delete / textures) and a room loading a published map, on Node's SQLite.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
const { default: worker, Library, Room } = await import('../src/worker.js');
const db = new DatabaseSync(':memory:');
const sql = { exec: (q, ...a) => { const st = db.prepare(q); return /^\s*select/i.test(q) ? st.all(...a) : (st.run(...a), []); } };
const lib = new Library({ storage: { sql } });
const env = code => ({ CREATOR_CODE: code, LIBRARY: { idFromName: n => n, get: () => lib }, ROOMS: { idFromName: n => n, get: () => null } });
const call = async (e, method, path, body) => { const r = await worker.fetch(new Request('https://x.dev' + path, { method, body: body ? JSON.stringify(body) : undefined, headers: { 'x-creator-code': 'forged' } }), e); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { } return { status: r.status, j, t }; };
const map = JSON.parse(readFileSync(new URL('../public/maps/sample.json', import.meta.url)));
// publishing off without the secret, and a forged header does not help
let r = await call(env(''), 'POST', '/api/maps', { code: 'forged', map }); assert.equal(r.status, 403); assert.match(r.j.error, /switched off/);
r = await call(env('s3cret'), 'POST', '/api/maps', { code: 'nope', map }); assert.equal(r.status, 403);
// a broken map is refused with reasons
r = await call(env('s3cret'), 'POST', '/api/maps', { code: 's3cret', map: { ...map, s: [] } }); assert.equal(r.status, 400); assert.ok(r.j.errors.some(e => /SUSPECT/.test(e)));
r = await call(env('s3cret'), 'POST', '/api/check', { map: { ...map, s: [[0, 2, 2]], spawn: [26, 33] } }); assert.equal(r.j.ok, true, 'an outdoor suspect spot is still reachable');
// publish, list, fetch, update, delete
r = await call(env('s3cret'), 'POST', '/api/maps', { code: 's3cret', map }); assert.equal(r.status, 200); const id = r.j.id; assert.match(id, /^[a-z0-9]{8}$/);
r = await call(env('s3cret'), 'GET', '/api/maps'); assert.equal(r.j.maps.length, 1); assert.equal(r.j.maps[0].name, 'Safe House'); assert.equal(r.j.publishing, true);
r = await call(env('s3cret'), 'GET', '/api/maps/' + id); assert.equal(r.j.name, 'Safe House'); assert.equal(r.j.rooms.length, 7);
r = await call(env('s3cret'), 'POST', '/api/maps', { code: 's3cret', id, map: { ...map, name: 'Safe House 2' } }); assert.equal(r.j.id, id);
r = await call(env('s3cret'), 'GET', '/api/maps'); assert.equal(r.j.maps.length, 1); assert.equal(r.j.maps[0].name, 'Safe House 2');
// a texture
const jpeg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]).toString('base64');
r = await call(env('s3cret'), 'POST', '/api/tex', { code: 's3cret', jpeg }); const tid = r.j.id; assert.ok(tid);
const tr = await worker.fetch(new Request('https://x.dev/api/tex/' + tid), env('s3cret')); assert.equal(tr.headers.get('content-type'), 'image/jpeg'); assert.equal((await tr.arrayBuffer()).byteLength, 9);
// a room that is asked for the published map loads it from the library
const room = new Room({}, env('s3cret')); await room.ensureMap('u_' + id); const { MAPS, MISSION_IDS } = await import('../public/js/core/level.js'); assert.ok(MAPS['u_' + id] && MISSION_IDS.includes('u_' + id));
room.host.join(1, 'A'); room.host.message(1, { t: 'choose', m: 'u_' + id }); assert.equal(room.host.sim.nextMap, 'u_' + id);
r = await call(env('s3cret'), 'DELETE', '/api/maps/' + id, { code: 's3cret' }); assert.equal(r.j.ok, true); r = await call(env('s3cret'), 'GET', '/api/maps'); assert.equal(r.j.maps.length, 0);
console.log('library tests passed'); process.exit(0);
