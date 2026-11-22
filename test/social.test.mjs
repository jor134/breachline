// quest-store: accounts, friends, blocking and terrorist QUICK MATCH (src/social.js + the Room in src/worker.js), on a real SQLite.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
class Sock extends EventTarget { constructor() { super(); this.peer = null; this.open = true; this.code = 0; } accept() { } send(d) { if (!this.open) throw new Error('closed'); const p = this.peer; setTimeout(() => { const e = new Event('message'); e.data = d; p.dispatchEvent(e); }, 0); } close(code) { if (!this.open) return; this.open = false; this.peer.open = false; const p = this.peer; p.code = code; queueMicrotask(() => { p.dispatchEvent(new Event('close')); this.dispatchEvent(new Event('close')); }); } }
globalThis.WebSocketPair = class { constructor() { const a = new Sock(), b = new Sock(); a.peer = b; b.peer = a; this[0] = a; this[1] = b; } };
const RealResponse = globalThis.Response;
globalThis.Response = class { constructor(body, init = {}) { this.body = body; Object.assign(this, init); this.status = init.status || 200; } async json() { return JSON.parse(this.body); } };
const { default: worker, Room, Social } = await import('../src/worker.js');
const db = new DatabaseSync(':memory:');
const sql = { exec: (q, ...a) => { const st = db.prepare(q); return /^\s*SELECT/i.test(q) ? st.all(...a) : (st.run(...a), []); } };
const soc = new Social({ storage: { sql } });
const rooms = new Map(), env = { CREATOR_CODE: 'secret', SOCIAL: { idFromName: n => n, get: () => soc }, ROOMS: { idFromName: n => n, get: id => rooms.get(id) || rooms.set(id, new Room(null, env)).get(id) } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const body = r => typeof r.body === 'string' ? JSON.parse(r.body) : r.body;
const post = (path, b, ticket) => worker.fetch(new Request('https://x.dev' + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(ticket ? { authorization: 'Bearer ' + ticket } : {}) }, body: JSON.stringify(b) }), env).then(body);
const join = async (path) => { const r = await worker.fetch(new Request('https://x.dev' + path, { headers: { Upgrade: 'websocket' } }), env); assert.equal(r.status, 101); const msgs = []; r.webSocket.addEventListener('message', e => msgs.push(JSON.parse(e.data))); await sleep(60); return { ws: r.webSocket, msgs, id: msgs.find(m => m.t === 'welcome')?.id, last: t => msgs.filter(m => m.t === t).at(-1) }; };

// accounts: the same purchase token gives the same account; tickets are checked
const A = await post('/api/me', { token: 'purchase-token-alice-0001' }), A2 = await post('/api/me', { token: 'purchase-token-alice-0001' }), B = await post('/api/me', { token: 'purchase-token-bob-00002' }), C = await post('/api/me', { token: 'purchase-token-carol-003' });
assert.ok(A.ticket && B.ticket); assert.equal(A.ticket.split('.')[0], A2.ticket.split('.')[0], 'same purchase, same account'); assert.notEqual(A.ticket.split('.')[0], B.ticket.split('.')[0]);
assert.equal((await post('/api/social/hello', { call: 'VIPER-27' }, A.ticket.slice(0, -1) + (A.ticket.endsWith('0') ? '1' : '0'))).error, 'Not signed in', 'a forged ticket is refused');
assert.equal((await post('/api/social/hello', {}, null)).error, 'Not signed in');
assert.equal((await post('/api/me', { token: 'x' })).error, 'Friends are switched off', 'too short a token');
assert.equal(body(await worker.fetch(new Request('https://x.dev/api/social/internal', { method: 'POST', body: '{}' }), env)).error, 'Not found', 'internal calls are not reachable from outside');

// two players meet in a room; Alice asks Bob, Bob accepts in the room -> friends
const ra = await join('/ws/MEET22?name=VIPER-27&t=' + A.ticket), rb = await join('/ws/MEET22?name=HAWK-11&t=' + B.ticket);
ra.ws.send(JSON.stringify({ t: 'friend', p: rb.id })); await sleep(120);
assert.equal(ra.last('friendres').res, 'sent'); assert.equal(rb.last('friendreq').p, ra.id, 'Bob is told in the room'); assert.equal(rb.last('rel').m[ra.id], 'got');
let hb = await post('/api/social/hello', { call: 'HAWK-11', room: 'MEET22' }, B.ticket); assert.equal(hb.requests.length, 1); assert.equal(hb.requests[0].call, 'OFFICER', 'Alice has not said hello yet');
rb.ws.send(JSON.stringify({ t: 'friend', p: ra.id })); await sleep(120);
assert.equal(rb.last('friendres').res, 'friend'); assert.equal(ra.last('rel').m[rb.id], 'friend');
// presence: Alice sees Bob online in a room she can join without a code
await sleep(10); let ha = await post('/api/social/hello', { call: 'VIPER-27', room: '' }, A.ticket);
assert.equal(ha.friends.length, 1); assert.equal(ha.friends[0].call, 'HAWK-11'); assert.ok(ha.friends[0].online && ha.friends[0].canJoin);
assert.equal((await post('/api/social/join', { id: ha.friends[0].id }, A.ticket)).room, 'MEET22');
assert.equal((await post('/api/social/join', { id: ha.friends[0].id }, C.ticket)).error, 'Not your friend', 'only friends get the code');
// remove and block
await post('/api/social/remove', { id: ha.friends[0].id }, A.ticket); assert.equal((await post('/api/social/hello', { call: 'VIPER-27' }, A.ticket)).friends.length, 0);
ra.ws.send(JSON.stringify({ t: 'block', p: rb.id })); await sleep(120); assert.equal(ra.last('rel').m[rb.id], 'blocked');
rb.ws.send(JSON.stringify({ t: 'friend', p: ra.id })); await sleep(120); assert.equal(rb.last('friendres').res, 'no', 'a blocked player cannot ask again');
ra.ws.close(); rb.ws.close(); await sleep(80);

// QUICK MATCH: Carol's SWAT room is closed -> nothing; she opens it -> Alice is matched in as a terrorist
const rc = await join('/ws/SWAT33?name=WOLF-40&t=' + C.ticket);
assert.equal((await post('/api/social/match', {}, A.ticket)).wait, true, 'closed rooms take no strangers');
const mm0 = await join('/ws/SWAT33?name=VIPER-27&mm=1&t=' + A.ticket); assert.equal(mm0.ws.open, false, 'a stranger cannot slip into a closed room'); assert.equal(mm0.ws.code, 4002);
rc.ws.send(JSON.stringify({ t: 'open', v: true })); await sleep(80); assert.equal(rc.last('owner').open, true);
const m = await post('/api/social/match', {}, A.ticket); assert.equal(m.room, 'SWAT33');
const ma = await join('/ws/SWAT33?name=VIPER-27&mm=1&t=' + A.ticket); await sleep(150);
const me = ma.last('s').P.find(p => p[0] === ma.id); assert.ok(me[9] & 2048, 'the stranger plays a terrorist'); assert.deepEqual(rc.last('owner').mm, [ma.id], 'everyone knows who came in as a stranger');
ma.ws.send(JSON.stringify({ t: 'team', team: 'swat' })); await sleep(150); assert.ok(ma.last('s').P.find(p => p[0] === ma.id)[9] & 2048, 'and stays one');
// Bob, whom Alice blocked, is never matched into a room with her
const rb2 = await join('/ws/SWAT33?name=HAWK-11&t=' + B.ticket); await sleep(50);
const solo = await join('/ws/THERE4?name=ECHO-12&t=' + (await post('/api/me', { token: 'purchase-token-dave-0004' })).ticket); solo.ws.send(JSON.stringify({ t: 'open', v: true })); await sleep(80);
assert.equal((await post('/api/social/match', {}, B.ticket)).room, 'THERE4', 'skips the room with someone who blocked you');
// the owner can close it again
rc.ws.send(JSON.stringify({ t: 'open', v: false })); await sleep(80); assert.equal(rc.last('owner').open, false);
// spectators: watch a room without being in the mission; up to 4; only voice set-up passes from them
const sp = await join('/ws/SWAT33?name=ECHO-12&spec=1'); await sleep(120);
assert.equal(sp.msgs[0].t, 'welcome'); assert.equal(sp.msgs[0].spec, true); assert.ok(sp.last('s'), 'a spectator gets the snapshots');
assert.ok(!sp.last('s').P.some(p => p[0] === sp.msgs[0].id), 'and is not in the mission'); assert.deepEqual(rc.last('owner').specs, [sp.msgs[0].id], 'players are told who is watching');
const inits = rc.msgs.filter(m => m.t === 'init').length; sp.ws.send(JSON.stringify({ t: 'start' })); sp.ws.send(JSON.stringify({ t: 'restart', map: 'mansion' })); await sleep(150); assert.equal(rc.msgs.filter(m => m.t === 'init').length, inits, 'a spectator cannot start or play');
sp.ws.send(JSON.stringify({ t: 'sig', to: rc.id, data: { desc: { type: 'offer', sdp: 'x' } } })); await sleep(80); assert.equal(rc.msgs.filter(m => m.t === 'sig').at(-1).from, sp.msgs[0].id, 'voice set-up still passes');
const more = []; for (let i = 0; i < 4; i++) more.push(await join('/ws/SWAT33?name=ECHO-12&spec=1')); await sleep(80); assert.equal(more[3].ws.open, false, 'four spectators at most');
for (const r of [sp, ...more]) r.ws.close(); await sleep(80); assert.deepEqual(rc.last('owner').specs, []);
for (const r of [rc, ma, rb2, solo]) r.ws.close(); await sleep(80);
assert.equal(soc.all('SELECT * FROM room').length, 0, 'empty rooms leave the list');
console.log('social tests passed'); process.exit(0);
