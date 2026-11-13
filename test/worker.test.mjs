// Runs the real Worker + Durable Object code with stand-in WebSocketPair / Response.
import assert from 'node:assert/strict';
class Sock extends EventTarget { constructor() { super(); this.peer = null; this.open = true; } accept() { } send(d) { if (!this.open) throw new Error('closed'); const p = this.peer; setTimeout(() => { const e = new Event("message"); e.data = d; p.dispatchEvent(e); }, 0); } close() { if (!this.open) return; this.open = false; this.peer.open = false; const p = this.peer; queueMicrotask(() => { p.dispatchEvent(new Event('close')); this.dispatchEvent(new Event('close')); }); } }
globalThis.WebSocketPair = class { constructor() { const a = new Sock(), b = new Sock(); a.peer = b; b.peer = a; this[0] = a; this[1] = b; } };
globalThis.Response = class { constructor(body, init = {}) { this.body = body; Object.assign(this, init); this.status = init.status || 200; } };
const { default: worker, Room } = await import('../src/worker.js');
const rooms = new Map(), env = { ROOMS: { idFromName: n => n, get: id => rooms.get(id) || rooms.set(id, new Room()).get(id) } };
const req = (path, ws = true) => ({ url: 'https://x.dev' + path, headers: { get: h => (ws && h === 'Upgrade' ? 'websocket' : null) } });
const join = async (path) => { const r = await worker.fetch(req(path), env); assert.equal(r.status, 101); const msgs = []; r.webSocket.addEventListener('message', e => msgs.push(JSON.parse(e.data))); return { ws: r.webSocket, msgs }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

assert.equal((await worker.fetch(req('/nope'), env)).status, 404);
assert.equal((await worker.fetch(req('/ws/ABCD', false), env)).status, 426);
const a = await join('/ws/abcd?name=Jordan'), b = await join('/ws/ABCD?name=Sam'), c = await join('/ws/ZZZ9?name=Other');
await sleep(200);
assert.equal(a.msgs[0].t, 'welcome'); assert.equal(b.msgs[0].slot, 1); assert.equal(rooms.size, 2, 'room codes are case-insensitive and isolated');
const snapA = a.msgs.filter(m => m.t === 's').at(-1); assert.deepEqual(snapA.P.map(p => p[1]), ['Jordan', 'Sam']);
assert.equal(c.msgs.filter(m => m.t === 's').at(-1).P.length, 1);
b.ws.send(JSON.stringify({ t: 'pose', h: [1, 1.6, 2, 0, 0, 0, 1], l: [1, 1, 2, 0, 0, 0, 1], r: null, g: [2, 0] })); a.ws.send(JSON.stringify({ t: 'start' })); a.ws.send('not json');
await sleep(250);
assert.ok(b.msgs.some(m => m.t === 'init'), 'both players get the new mission'); const s2 = a.msgs.filter(m => m.t === 's').at(-1);
assert.equal(s2.ph, 'active'); assert.deepEqual(s2.P[1][5].slice(0, 3), [1, 1.6, 2]); assert.deepEqual(s2.P[1][8], [2, 0]);
const n1 = a.msgs.filter(m => m.t === 's').length; await sleep(400); const rate = (a.msgs.filter(m => m.t === 's').length - n1) / 0.4; assert.ok(rate > 10 && rate < 20, 'tick rate ' + rate);
for (let i = 0; i < 4; i++) await join('/ws/FULL?name=p' + i); const extra = await join('/ws/FULL?name=late'); await sleep(100); assert.equal(extra.msgs[0].t, 'full');
b.ws.close(); await sleep(200); assert.equal(a.msgs.filter(m => m.t === 's').at(-1).P.filter(p => !(p[9] & 1 << 17)).length, 1); assert.equal(s2.P.filter(p => p[9] & 1 << 17).length, 2, 'two humans: two bots');
a.ws.close(); await sleep(200); assert.equal(rooms.get('ABCD').timer, null, 'room stops ticking when empty');
console.log('worker tests passed'); process.exit(0);
