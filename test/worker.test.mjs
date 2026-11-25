// Runs the real Worker + Durable Object code with stand-in WebSocketPair / Response.
import assert from 'node:assert/strict';
class Sock extends EventTarget { constructor() { super(); this.peer = null; this.open = true; } accept() { } send(d) { if (!this.open) throw new Error('closed'); const p = this.peer; setTimeout(() => { const e = new Event("message"); e.data = d; p.dispatchEvent(e); }, 0); } close() { if (!this.open) return; this.open = false; this.peer.open = false; const p = this.peer; queueMicrotask(() => { p.dispatchEvent(new Event('close')); this.dispatchEvent(new Event('close')); }); } }
globalThis.WebSocketPair = class { constructor() { const a = new Sock(), b = new Sock(); a.peer = b; b.peer = a; this[0] = a; this[1] = b; } };
globalThis.Response = class { constructor(body, init = {}) { this.body = body; Object.assign(this, init); this.status = init.status || 200; } };
const { default: worker, Room } = await import('../src/worker.js');
const rooms = new Map(), env = { ROOMS: { idFromName: n => n, get: id => rooms.get(id) || rooms.set(id, new Room()).get(id) } };
const req = (path, ws = true) => new Request('https://x.dev' + path, { headers: ws ? { Upgrade: 'websocket' } : {} });
const join = async (path) => { const r = await worker.fetch(req(path), env); assert.equal(r.status, 101); const msgs = []; r.webSocket.addEventListener('message', e => msgs.push(JSON.parse(e.data))); return { ws: r.webSocket, msgs }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

assert.equal((await worker.fetch(req('/nope'), env)).status, 404);
assert.equal((await worker.fetch(req('/ws/ABCDEF', false), env)).status, 426);
assert.equal((await worker.fetch(req('/ws/1234'), env)).status, 400, 'quest-store: old 4-digit codes are refused');
assert.equal((await worker.fetch(req('/ws/ABCDE0'), env)).status, 400, 'no look-alike characters');
const a = await join('/ws/abcdef?name=VIPER-27'), b = await join('/ws/ABCDEF?name=bad%20words'), c = await join('/ws/ZZZ999?name=Other');
await sleep(200);
assert.equal(a.msgs[0].t, 'welcome'); assert.equal(b.msgs[0].slot, 1); assert.equal(rooms.size, 2, 'room codes are case-insensitive and isolated');
const snapA = a.msgs.filter(m => m.t === 's').at(-1); assert.equal(snapA.P[0][1], 'VIPER-27'); assert.match(snapA.P[1][1], /^OFFICER-\d\d$/, 'quest-store: free-text names are replaced');
assert.equal(c.msgs.filter(m => m.t === 's').at(-1).P.length, 1);
b.ws.send(JSON.stringify({ t: 'pose', h: [1, 1.6, 2, 0, 0, 0, 1], l: [1, 1, 2, 0, 0, 0, 1], r: null, g: [2, 0] })); a.ws.send(JSON.stringify({ t: 'start' })); a.ws.send('not json');
await sleep(250);
assert.ok(b.msgs.some(m => m.t === 'init'), 'both players get the new mission'); const s2 = a.msgs.filter(m => m.t === 's').at(-1);
assert.equal(s2.ph, 'active'); assert.deepEqual(s2.P[1][5].slice(0, 3), [1, 1.6, 2]); assert.deepEqual(s2.P[1][8], [2, 0]);
const n1 = a.msgs.filter(m => m.t === 's').length; await sleep(400); const rate = (a.msgs.filter(m => m.t === 's').length - n1) / 0.4; assert.ok(rate > 10 && rate < 20, 'tick rate ' + rate);
// voice chat set-up passes from one player to the other untouched, tagged with the sender, and never reaches the game
const idA = a.msgs[0].id, idB = b.msgs[0].id; a.ws.send(JSON.stringify({ t: 'sig', to: idB, data: { desc: { type: 'offer', sdp: 'v=0' } } })); await sleep(100);
const sig = b.msgs.find(m => m.t === 'sig'); assert.ok(sig && sig.from === idA && sig.data.desc.type === 'offer', 'signal relayed'); assert.ok(!c.msgs.some(m => m.t === 'sig'), 'only to the addressee');
for (let i = 0; i < 4; i++) await join('/ws/FULLRM?name=p' + i); const extra = await join('/ws/FULLRM?name=late'); await sleep(100); assert.equal(extra.msgs[0].t, 'full');
// quest-store: the first player in owns the room; only they can remove someone, and the owner passes on when they leave
{ const o = await join('/ws/PWNRRR?name=Owner'), g = await join('/ws/PWNRRR?name=Guest'), h = await join('/ws/PWNRRR?name=Third'); await sleep(100);
  const oid = o.msgs[0].id, gid = g.msgs[0].id, hid = h.msgs[0].id;
  assert.equal(g.msgs.filter(m => m.t === 'owner').at(-1).id, oid, 'everyone is told the owner');
  g.ws.send(JSON.stringify({ t: 'boot', p: oid })); await sleep(100); assert.ok(!o.msgs.some(m => m.t === 'booted'), 'a guest cannot remove anyone');
  o.ws.send(JSON.stringify({ t: 'boot', p: hid })); await sleep(150); assert.ok(h.msgs.some(m => m.t === 'booted'), 'the owner removes a player'); assert.equal(h.ws.open, false);
  assert.equal(o.msgs.filter(m => m.t === 's').at(-1).P.filter(p => !(p[9] & 1 << 17)).length, 2, 'removed player leaves the mission');
  o.ws.close(); await sleep(150); assert.equal(g.msgs.filter(m => m.t === 'owner').at(-1).id, gid, 'ownership passes on'); g.ws.close(); }
b.ws.close(); await sleep(200); assert.equal(a.msgs.filter(m => m.t === 's').at(-1).P.filter(p => !(p[9] & 1 << 17)).length, 1); assert.equal(s2.P.filter(p => p[9] & 1 << 17).length, 2, 'two humans: two bots');
a.ws.close(); await sleep(200); assert.equal(rooms.get('ABCDEF').timer, null, 'room stops ticking when empty');
// quest-store: the development unlock checks the creator code on the Worker; wrong or missing codes are refused
{ const post = (code, env2) => worker.fetch({ url: 'https://x.dev/api/unlock', method: 'POST', headers: { get: () => null }, json: async () => ({ code }) }, env2);
  assert.equal((await post('s3cret', { ...env, CREATOR_CODE: 's3cret' })).status, 200);
  assert.equal((await post('guess', { ...env, CREATOR_CODE: 's3cret' })).status, 403);
  assert.equal((await post('', env)).status, 403, 'no creator code set: nothing unlocks'); }
// quest-store: who owns the full game is checked with Meta on the server. /api/me asks verify_entitlement (with the app secret) and
// signs a pass for the account; a room lets only a pass holder pick a mission outside the demo. Without the secret nothing is checked.
{ const realFetch = globalThis.fetch, calls = [];
  globalThis.fetch = async (u, o) => { if (String(u).includes('graph.oculus.com')) { const b = new URLSearchParams(o.body); calls.push([String(u), b.get('user_id'), b.get('sku'), b.get('access_token')]); return { status: 200, json: async () => ({ success: b.get('user_id') === '111111111' }) }; } return realFetch(u, o); };
  const env2 = { ...env, CREATOR_CODE: 's3cret', META_APP_SECRET: 'appsecret' }, me = body => worker.fetch(new Request('https://x.dev/api/me', { method: 'POST', body: JSON.stringify(body) }), env2).then(r => r.body ? JSON.parse(r.body) : r.json());
  const owner = await me({ token: 'purchase-token-1', uid: '111111111' }), demo = await me({ token: 'guest-device-2', uid: '222222222' }), nouid = await me({ token: 'guest-device-3' });
  assert.ok(owner.full && owner.pass && owner.check === 'yes', 'Meta says yes: a pass'); assert.ok(!demo.full && !demo.pass && demo.check === 'no'); assert.equal(nouid.check, 'no user id');
  assert.deepEqual(calls[0].slice(1), ['111111111', 'full_game', 'OC|1766163904906396|appsecret']); assert.match(calls[0][0], /graph\.oculus\.com\/1766163904906396\/verify_entitlement$/);
  const dev = await worker.fetch({ url: 'https://x.dev/api/unlock', method: 'POST', headers: { get: () => null }, json: async () => ({ code: 's3cret' }) }, env2).then(r => JSON.parse(r.body));
  assert.ok((await me({ token: 'dev-device-4', dev: dev.dev })).full, 'the creator-code unlock also gets a pass');
  const j2 = async path => { const r = await worker.fetch(req(path), env2); const msgs = []; r.webSocket.addEventListener('message', e => msgs.push(JSON.parse(e.data))); return { ws: r.webSocket, msgs }; };
  const host = await j2('/ws/GATEAA?name=Host&t=' + encodeURIComponent(demo.ticket)), buyer = await j2('/ws/GATEAA?name=Buyer&t=' + encodeURIComponent(owner.ticket) + '&fp=' + encodeURIComponent(owner.pass));
  const thief = await j2('/ws/GATEAA?name=Thief&t=' + encodeURIComponent(demo.ticket) + '&fp=' + encodeURIComponent(owner.pass)); await sleep(100);
  host.ws.send(JSON.stringify({ t: 'choose', m: 'terminal' })); await sleep(100); assert.ok(host.msgs.some(m => m.t === 'locked'), 'the demo host cannot pick a full-game mission');
  host.ws.send(JSON.stringify({ t: 'choose', m: 'mansion' })); thief.ws.send(JSON.stringify({ t: 'choose', m: 'airport' })); await sleep(100);
  assert.equal(host.msgs.filter(m => m.t === 'locked').length, 1, 'the mansion is free'); assert.ok(thief.msgs.some(m => m.t === 'locked'), "someone else's pass does not work");
  buyer.ws.send(JSON.stringify({ t: 'choose', m: 'terminal' })); await sleep(100); assert.ok(!buyer.msgs.some(m => m.t === 'locked'), 'the buyer picks it for the room');
  for (const x of [host, buyer, thief]) x.ws.close(); await sleep(150);
  const free = await j2.call(null, '/ws/GATEBB?name=Free'); free.ws.close();
  const env3 = { ...env, CREATOR_CODE: 's3cret' }, r3 = await worker.fetch(req('/ws/GATECC?name=Old'), env3); const m3 = []; r3.webSocket.addEventListener('message', e => m3.push(JSON.parse(e.data))); await sleep(50);
  r3.webSocket.send(JSON.stringify({ t: 'choose', m: 'terminal' })); await sleep(100); assert.ok(!m3.some(m => m.t === 'locked'), 'no app secret: rooms do not check'); r3.webSocket.close();
  globalThis.fetch = realFetch; }
// test mode: a test map picked by a headset the room does not know as a tester is refused out loud; the token sent later counts
{ const { makeTesterToken } = await import('../src/social.js'), rm = new Map(), envT = { CREATOR_CODE: 's3cret', TEST_CODE: '123456' }; envT.ROOMS = { idFromName: n => n, get: id => rm.get(id) || rm.set(id, new Room(null, envT)).get(id) };
  const r = await worker.fetch(req('/ws/TESTAA?name=Tester'), envT), msgs = []; r.webSocket.addEventListener('message', e => msgs.push(JSON.parse(e.data))); await sleep(50);
  r.webSocket.send(JSON.stringify({ t: 'choose', m: 'winery' })); await sleep(100); assert.ok(msgs.some(m => m.t === 'testonly'), 'told the map is test-only');
  r.webSocket.send(JSON.stringify({ t: 'tester', tt: 'tst.bad' })); await sleep(100); assert.ok(!msgs.some(m => m.t === 'testerok'), 'a bad token does nothing');
  r.webSocket.send(JSON.stringify({ t: 'tester', tt: await makeTesterToken(envT) })); await sleep(100); assert.ok(msgs.some(m => m.t === 'testerok'), 'a good one makes a tester');
  const n = msgs.filter(m => m.t === 'testonly').length; r.webSocket.send(JSON.stringify({ t: 'choose', m: 'winery' })); await sleep(100); assert.equal(msgs.filter(m => m.t === 'testonly').length, n, 'now the test map can be picked');
  r.webSocket.close(); await sleep(50);
  const r2 = await worker.fetch(req('/ws/TESTAB?name=Late'), envT), m2 = []; r2.webSocket.addEventListener('message', e => m2.push(JSON.parse(e.data))); await sleep(50);
  r2.webSocket.send(JSON.stringify({ t: 'choose', m: 'winery', tt: await makeTesterToken(envT) })); r2.webSocket.send(JSON.stringify({ t: 'restart', map: 'winery', tt: await makeTesterToken(envT) })); await sleep(300);
  const room = rm.get('TESTAB'); assert.ok(!m2.some(m => m.t === 'testonly'), 'a pick carrying the token is taken'); assert.equal(room.host.sim.mapId, 'winery', 'and the mission starts on the winery');
  r2.webSocket.close(); await sleep(50); }
console.log('worker tests passed'); process.exit(0);
