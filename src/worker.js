// BREACHLINE Worker: static app comes from /public; /ws/<ROOM> connects to that room's Durable Object;
// /api/maps and /api/tex are the published-map library (one Library Durable Object with SQLite storage).
import { RoomHost, TICK } from '../public/js/core/host.js';
import { buildLevel, findPath, registerMap, MAPS } from '../public/js/core/level.js';
import { compile, check } from '../public/js/core/maps/custom.js';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const library = env => env.LIBRARY.get(env.LIBRARY.idFromName('library'));

export default {
  async fetch(req, env) {
    const url = new URL(req.url), m = url.pathname.match(/^\/ws\/([A-Za-z0-9]{3,8})$/);
    if (m) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
      return env.ROOMS.get(env.ROOMS.idFromName(m[1].toUpperCase())).fetch(req);
    }
    if (url.pathname === '/api/ice') return json(await iceServers(env));   // voice chat connection servers
    if (url.pathname.startsWith('/api/')) {
      // the creator code travels to the library in a header, set by this Worker from its secret, never from the client
      const fwd = new Request(req); fwd.headers.set('x-creator-code', env.CREATOR_CODE || ''); return library(env).fetch(fwd);
    }
    return new Response('Not found', { status: 404 });
  },
};

// Voice chat connection servers (same as Kerbside). With a Cloudflare TURN key (TURN_KEY_ID and TURN_KEY_API_TOKEN secrets),
// voice also works on networks that block direct connections. Credentials are short-lived and cached.
let iceCache = null;
async function iceServers(env) {
  const stun = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return { iceServers: stun, turn: false };
  if (iceCache && iceCache.until > Date.now()) return iceCache.value;
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, { method: 'POST', headers: { Authorization: 'Bearer ' + env.TURN_KEY_API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ ttl: 86400 }) });
    if (!r.ok) throw new Error('TURN ' + r.status);
    const j = await r.json();
    const list = (Array.isArray(j.iceServers) ? j.iceServers : [j.iceServers]).map(x => ({ ...x, urls: (Array.isArray(x.urls) ? x.urls : [x.urls]).filter(u => !/:53(\?|$)/.test(u)) })).filter(x => x.urls.length);   // port 53 is blocked by browsers
    const value = { iceServers: list, turn: true }; iceCache = { value, until: Date.now() + 12 * 3600e3 }; return value;
  } catch (e) { return { iceServers: stun, turn: false, error: String(e.message || e) }; }
}

// ---- published maps and textures ----
export class Library {
  constructor(state) {
    this.sql = state.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS maps (id TEXT PRIMARY KEY, name TEXT, creator TEXT, data TEXT, updated INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS tex (id TEXT PRIMARY KEY, data BLOB, updated INTEGER)');
  }
  async fetch(req) {
    const url = new URL(req.url), p = url.pathname, code = req.headers.get('x-creator-code') || '';
    const authed = async body => { if (!code) return 'Publishing is switched off: set the CREATOR_CODE secret on the Worker'; if (!body || body.code !== code) return 'Wrong creator code'; return null; };
    const newId = () => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; const r = crypto.getRandomValues(new Uint8Array(8)); for (const b of r) s += a[b % a.length]; return s; };
    try {
      if (p === '/api/maps' && req.method === 'GET') return json({ maps: [...this.sql.exec('SELECT id, name, creator, updated FROM maps ORDER BY updated DESC LIMIT 200')], publishing: !!code });
      let mm = p.match(/^\/api\/maps\/([a-z0-9]{6,24})$/);
      if (mm && req.method === 'GET') { const r = [...this.sql.exec('SELECT data FROM maps WHERE id = ?', mm[1])][0]; return r ? new Response(r.data, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }) : json({ error: 'No such map' }, 404); }
      if (p === '/api/check' && req.method === 'POST') { const b = await req.json(); const r = check(b.map, { buildLevel, findPath, registerMap }); return json({ ok: r.ok, errors: r.errors, warnings: r.warnings }); }
      if (p === '/api/maps' && req.method === 'POST') {   // publish (new, or an update when the id is given)
        const b = await req.json(), err = await authed(b); if (err) return json({ error: err }, 403);
        const r = check(b.map, { buildLevel, findPath, registerMap }); if (!r.ok) return json({ error: 'The map has problems', errors: r.errors, warnings: r.warnings }, 400);
        const id = typeof b.id === 'string' && /^[a-z0-9]{6,24}$/.test(b.id) ? b.id : newId(), data = JSON.stringify(r.map);
        this.sql.exec('INSERT OR REPLACE INTO maps (id, name, creator, data, updated) VALUES (?, ?, ?, ?, ?)', id, r.map.name, r.map.creator, data, Date.now());
        return json({ id, warnings: r.warnings });
      }
      if (mm && req.method === 'DELETE') { const b = await req.json().catch(() => null), err = await authed(b); if (err) return json({ error: err }, 403); this.sql.exec('DELETE FROM maps WHERE id = ?', mm[1]); return json({ ok: true }); }
      if (p === '/api/tex' && req.method === 'POST') {   // a texture: the editor has already shrunk it to a small JPEG
        const b = await req.json(), err = await authed(b); if (err) return json({ error: err }, 403);
        const m2 = typeof b.jpeg === 'string' && b.jpeg.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/); if (!m2) return json({ error: 'Expected a JPEG' }, 400);
        const bin = Uint8Array.from(atob(m2[1]), c => c.charCodeAt(0)); if (bin.length > 400000) return json({ error: 'Texture too large (max 400 KB)' }, 400);
        const id = newId(); this.sql.exec('INSERT INTO tex (id, data, updated) VALUES (?, ?, ?)', id, bin, Date.now()); return json({ id });
      }
      mm = p.match(/^\/api\/tex\/([a-z0-9]{6,24})$/);
      if (mm && req.method === 'GET') { const r = [...this.sql.exec('SELECT data FROM tex WHERE id = ?', mm[1])][0]; return r ? new Response(r.data, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' } }) : new Response('Not found', { status: 404 }); }
      return json({ error: 'Not found' }, 404);
    } catch (e) { return json({ error: 'Bad request: ' + (e && e.message) }, 400); }
  }
}

// ---- game rooms ----
export class Room {
  constructor(state, env) {
    this.env = env; this.socks = new Map(); this.next = 1; this.timer = null; this.queue = Promise.resolve();
    this.host = new RoomHost((id, obj) => {
      const s = JSON.stringify(obj);
      if (id == null) { for (const ws of this.socks.values()) try { ws.send(s); } catch {} }
      else { try { this.socks.get(id)?.send(s); } catch {} }
    });
  }
  // a message that names a published map loads it from the library first (once per room)
  async ensureMap(mid) {
    if (typeof mid !== 'string' || !/^u_[a-z0-9]{6,24}$/.test(mid) || MAPS[mid] || !this.env || !this.env.LIBRARY) return;
    const r = await library(this.env).fetch(new Request('https://library/api/maps/' + mid.slice(2))); if (!r.ok) return;
    registerMap(compile(await r.json(), mid));
  }
  async fetch(req) {
    const name = new URL(req.url).searchParams.get('name') || 'Officer';
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const id = this.next++; this.socks.set(id, server);
    if (!this.host.join(id, name)) { this.socks.delete(id); server.close(4000, 'Room full'); return new Response(null, { status: 101, webSocket: client }); }
    const bye = () => { if (!this.socks.delete(id)) return; this.host.leave(id); if (!this.socks.size && this.timer) { clearInterval(this.timer); this.timer = null; } };
    server.addEventListener('message', e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m && m.t === 'sig') { const to = this.socks.get(m.to); if (to && m.data && JSON.stringify(m.data).length < 20000) try { to.send(JSON.stringify({ t: 'sig', from: id, data: m.data })); } catch {} return; }   // voice chat set-up, passed straight to the other person
      const mid = m && (m.m || m.map);
      if (typeof mid === 'string' && mid.startsWith('u_') && !MAPS[mid]) this.queue = this.queue.then(() => this.ensureMap(mid)).catch(() => {}).then(() => { try { this.host.message(id, m); } catch {} });
      else this.queue = this.queue.then(() => { try { this.host.message(id, m); } catch {} });
    });
    server.addEventListener('close', bye); server.addEventListener('error', bye);
    if (!this.timer) { let last = Date.now(); this.timer = setInterval(() => { const now = Date.now(), dt = Math.min(0.25, (now - last) / 1000); last = now; this.host.tick(dt); }, TICK * 1000); }
    return new Response(null, { status: 101, webSocket: client });
  }
}
