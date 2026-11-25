// quest-store: the real Worker and rooms on localhost:8790 (static files, /api, /ws) for end-to-end runs of the client: node test/e2e-server.mjs
// local end-to-end: static files + the real Worker (api, rooms) behind a minimal WebSocket server
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
class Sock extends EventTarget { constructor() { super(); this.peer = null; this.open = true; } accept() { } send(d) { if (!this.open) throw new Error('closed'); const p = this.peer; setTimeout(() => { const e = new Event('message'); e.data = d; p.dispatchEvent(e); }, 0); } close() { if (!this.open) return; this.open = false; this.peer.open = false; const p = this.peer; queueMicrotask(() => { p.dispatchEvent(new Event('close')); this.dispatchEvent(new Event('close')); }); } }
globalThis.WebSocketPair = class { constructor() { const a = new Sock(), b = new Sock(); a.peer = b; b.peer = a; this[0] = a; this[1] = b; } };
const RealResponse = globalThis.Response;
const { default: worker, Room } = await import(new URL('../src/worker.js', import.meta.url));
const { makeTesterToken } = await import(new URL('../src/social.js', import.meta.url));
const rooms = new Map(), env = { CREATOR_CODE: 's3cret', TEST_CODE: '123456', NO_DELAY: 1, META_APP_SECRET: 'x' }; env.ROOMS = { idFromName: n => n, get: id => rooms.get(id) || rooms.set(id, new Room(null, env)).get(id) };
fs.writeFileSync('/tmp/bl-e2e-token.txt', await makeTesterToken(env));
const PUB = new URL('../public', import.meta.url).pathname, TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.webmanifest': 'application/json', '.png': 'image/png', '.css': 'text/css', '.mp3': 'audio/mpeg' };
const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname.startsWith('/api/')) { let body = ''; for await (const c of req) body += c;
    try { const r = await worker.fetch(new Request('http://localhost' + req.url, { method: req.method, headers: req.headers, body: req.method === 'POST' ? body : undefined }), env); const b = r.body && typeof r.body === 'string' ? r.body : r.text ? await r.text() : ''; res.writeHead(r.status || 200, { 'content-type': 'application/json' }); res.end(b); } catch (e) { res.writeHead(500); res.end(String(e)); } return; }
  let p = path.join(PUB, decodeURIComponent(u.pathname)); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (err, d) => { if (err) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
});
srv.on('upgrade', async (req, socket) => {
  const key = req.headers['sec-websocket-key'], acc = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  globalThis.Response = class { constructor(body, init = {}) { this.body = body; Object.assign(this, init); this.status = init.status || 200; } };
  const r = await worker.fetch(new Request('http://localhost' + req.url, { headers: { Upgrade: 'websocket' } }), env); globalThis.Response = RealResponse;
  if (r.status !== 101) { socket.destroy(); return; }
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  const ws = r.webSocket; ws.addEventListener('message', e => { const d = Buffer.from(String(e.data)); let h; if (d.length < 126) h = Buffer.from([0x81, d.length]); else if (d.length < 65536) { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 126; h.writeUInt16BE(d.length, 2); } else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeBigUInt64BE(BigInt(d.length), 2); } try { socket.write(Buffer.concat([h, d])); } catch { } });
  let buf = Buffer.alloc(0);
  socket.on('data', c => { buf = Buffer.concat([buf, c]); for (;;) { if (buf.length < 2) break; const op = buf[0] & 15; let len = buf[1] & 127, o = 2; if (len === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); o = 4; } else if (len === 127) { if (buf.length < 10) break; len = Number(buf.readBigUInt64BE(2)); o = 10; }
    if (buf.length < o + 4 + len) break; const mask = buf.slice(o, o + 4), pl = buf.slice(o + 4, o + 4 + len); for (let i = 0; i < len; i++) pl[i] ^= mask[i & 3]; buf = buf.slice(o + 4 + len);
    if (op === 8) { try { ws.close(); } catch { } socket.end(); return; } if (op === 1) { try { ws.send(pl.toString()); } catch { } } } });
  socket.on('close', () => { try { ws.close(); } catch { } }); socket.on('error', () => { });
});
srv.listen(8790, () => console.log('up'));
