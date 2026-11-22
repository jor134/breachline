// BREACHLINE Worker: static app comes from /public; /ws/<ROOM> connects to that room's Durable Object;
// /api/maps and /api/tex are the published-map library (one Library Durable Object with SQLite storage).
import { RoomHost, TICK } from '../public/js/core/host.js';
import { buildLevel, findPath, registerMap, MAPS } from '../public/js/core/level.js';
import { compile, check } from '../public/js/core/maps/custom.js';
import { cleanCallsign } from '../public/js/store/callsigns.js';
import { Social, makeTicket, readTicket, ROOM_RE } from './social.js';
export { Social };

const ASSET_LINKS = [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: 'com.jordanbreccia.youcanthide', sha256_cert_fingerprints: ['5D:F8:23:37:37:DC:A0:A5:13:6E:92:74:2C:AE:D3:BE:C3:79:6A:E2:24:18:6F:93:25:4B:6B:5E:84:11:69:0C'] } }];
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const library = env => env.LIBRARY.get(env.LIBRARY.idFromName('library'));
const social = env => env.SOCIAL && env.SOCIAL.get(env.SOCIAL.idFromName('social'));
const SOCIAL_API = ['hello', 'accept', 'decline', 'remove', 'block', 'join', 'match', 'forget'];

export default {
  async fetch(req, env) {
    const url = new URL(req.url), m = url.pathname.match(/^\/ws\/([A-Za-z0-9]{1,12})$/);
    if (m) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
      // quest-store: 6-character room codes from an alphabet without look-alikes (no I, O, 0, 1): about a billion rooms, so a code
      // cannot be guessed. The old 4-digit codes are refused.
      const code = m[1].toUpperCase(); if (!ROOM_RE.test(code)) return new Response('Room codes have 6 characters', { status: 400 });
      // the player's account (from their signed ticket) goes to the room as ?acct=; anything the client put there is dropped
      const acct = await readTicket(env, url.searchParams.get('t')); url.searchParams.delete('t'); url.searchParams.delete('acct'); if (acct) url.searchParams.set('acct', acct);
      return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(new Request(url.toString(), req));
    }
    // quest-store: Digital Asset Links, so the Quest app (a Trusted Web Activity) may open this site full screen in VR. The
    // fingerprint is the public SHA-256 of the app's signing certificate (not a secret). An immersive app will not launch without it.
    if (url.pathname === '/.well-known/assetlinks.json') return new Response(JSON.stringify(ASSET_LINKS), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=300' } });
    if (url.pathname === '/api/ice') return json(await iceServers(env));   // voice chat connection servers
    if (url.pathname === '/api/unlock' && req.method === 'POST') {   // quest-store: unlocks the full game on a development device (?dev=<creator code>)
      const body = await req.json().catch(() => ({})), want = env.CREATOR_CODE || '', got = typeof body.code === 'string' ? body.code : '';
      let diff = want.length === got.length && want.length > 0 ? 0 : 1; for (let i = 0; i < Math.min(want.length, got.length); i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
      await new Promise(r => setTimeout(r, 400));   // slows guessing
      return json({ ok: !diff }, diff ? 403 : 200);
    }
    // quest-store: accounts and friends (src/social.js). /api/me turns the full-game purchase token into a signed ticket.
    if (url.pathname === '/api/me' && req.method === 'POST') {
      const b = await req.json().catch(() => ({})), t = await makeTicket(env, b.token);
      return t ? json({ ticket: t.ticket, acct: t.acct.slice(0, 6) }) : json({ error: 'Friends are switched off' }, 503);
    }
    const sm = url.pathname.match(/^\/api\/social\/([a-z]+)$/);
    if (sm) {
      if (req.method !== 'POST' || !SOCIAL_API.includes(sm[1]) || !social(env)) return json({ error: 'Not found' }, 404);
      const acct = await readTicket(env, (req.headers.get('authorization') || '').replace(/^Bearer /, '')); if (!acct) return json({ error: 'Not signed in' }, 401);
      return social(env).fetch(new Request('https://social/' + sm[1], { method: 'POST', headers: { 'content-type': 'application/json', 'x-acct': acct }, body: await req.text() }));
    }
    if (url.pathname.startsWith('/api/admin/')) await new Promise(r => setTimeout(r, 400));   // slows guessing the creator code
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
    // quest-store: maps players share with friends. Unlisted: only someone given the 8-digit code can load one. A shared map's
    // name is replaced by its code and its creator by the sharer's preset callsign (no free text reaches anyone else); a report
    // hides it at once; maps not touched for 180 days are removed; one network address may share 20 a day.
    this.sql.exec('CREATE TABLE IF NOT EXISTS shared (id TEXT PRIMARY KEY, data TEXT, created INTEGER, used INTEGER, reports INTEGER DEFAULT 0, ip TEXT)');
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
      if (p === '/api/share' && req.method === 'POST') {   // share with friends: anyone may, the creator code is not needed
        const b = await req.json(), ip = req.headers.get('cf-connecting-ip') || '', now = Date.now();
        this.sql.exec('DELETE FROM shared WHERE used < ?', now - 180 * 864e5);
        const n = [...this.sql.exec('SELECT COUNT(*) AS n FROM shared WHERE ip = ? AND created > ?', ip, now - 864e5)][0].n; if (n >= 20) return json({ error: 'Too many maps shared today. Try again tomorrow.' }, 429);
        const r = check(b.map, { buildLevel, findPath, registerMap }); if (!r.ok) return json({ error: 'The map has problems', errors: r.errors, warnings: r.warnings }, 400);
        let id; do { id = String(10000000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 90000000)); } while ([...this.sql.exec('SELECT 1 FROM shared WHERE id = ?', id)].length);
        const map = Object.assign({}, r.map, { name: 'FRIEND MAP ' + id.slice(0, 4) + ' ' + id.slice(4), creator: cleanCallsign(b.by) });
        this.sql.exec('INSERT INTO shared (id, data, created, used, reports, ip) VALUES (?, ?, ?, ?, 0, ?)', id, JSON.stringify(map), now, now, ip);
        return json({ id, warnings: r.warnings });
      }
      let sm = p.match(/^\/api\/share\/(\d{8})$/);
      if (sm && req.method === 'GET') { const r = [...this.sql.exec('SELECT data, reports FROM shared WHERE id = ?', sm[1])][0];
        if (!r) return json({ error: 'No map has that code' }, 404); if (r.reports > 0) return json({ error: 'That map was reported and is hidden' }, 410);
        this.sql.exec('UPDATE shared SET used = ? WHERE id = ?', Date.now(), sm[1]); return new Response(r.data, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }); }
      sm = p.match(/^\/api\/share\/(\d{8})\/report$/);
      if (sm && req.method === 'POST') { this.sql.exec('UPDATE shared SET reports = reports + 1 WHERE id = ?', sm[1]); return json({ ok: true }); }
      // quest-store: the admin page (/admin.html): reported friend maps, behind the creator code
      if (p.startsWith('/api/admin/') && req.method === 'POST') {
        const b = await req.json().catch(() => null), err = await authed(b); if (err) return json({ error: err }, 403);
        const id = typeof b.id === 'string' && /^\d{8}$/.test(b.id) ? b.id : '';
        if (p === '/api/admin/reported') return json({ maps: [...this.sql.exec('SELECT id, data, created, used, reports FROM shared WHERE reports > 0 ORDER BY used DESC LIMIT 100')].map(r => ({ id: r.id, created: r.created, used: r.used, reports: r.reports, map: JSON.parse(r.data) })), total: [...this.sql.exec('SELECT COUNT(*) AS n FROM shared')][0].n });
        if (!id) return json({ error: 'Which map?' }, 400);
        if (p === '/api/admin/restore') { this.sql.exec('UPDATE shared SET reports = 0 WHERE id = ?', id); return json({ ok: true }); }
        if (p === '/api/admin/delete') { this.sql.exec('DELETE FROM shared WHERE id = ?', id); return json({ ok: true }); }
        return json({ error: 'Not found' }, 404);
      }
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
    // quest-store: who each player is (account, from the ticket the Worker checked) and who came in through QUICK MATCH
    this.acct = new Map(); this.mm = new Set(); this.specs = new Map();   // specs: spectators (up to 4, on top of the 4 players; not in the mission)
    this.open = false; this.code = ''; this.reportT = 0; this.lastRep = '';
    this.host = new RoomHost((id, obj) => {
      const s = JSON.stringify(obj);
      if (id == null) { for (const ws of this.socks.values()) try { ws.send(s); } catch {} for (const ws of this.specs.values()) try { ws.send(s); } catch {} }
      else { try { this.socks.get(id)?.send(s); } catch {} }
    });
  }
  social(path, body) {
    const S = this.env && this.env.SOCIAL; if (!S) return Promise.resolve(null);
    return S.get(S.idFromName('social')).fetch(new Request('https://social' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).then(r => r.json()).catch(() => null);
  }
  // a message that names a published map loads it from the library first (once per room)
  async ensureMap(mid) {
    if (typeof mid !== 'string' || !/^(u_[a-z0-9]{6,24}|s_\d{8})$/.test(mid) || MAPS[mid] || !this.env || !this.env.LIBRARY) return;
    const r = await library(this.env).fetch(new Request('https://library/api/' + (mid[0] === 's' ? 'share/' : 'maps/') + mid.slice(2))); if (!r.ok) return;
    registerMap(compile(await r.json(), mid));
  }
  // quest-store: the longest-connected player owns the room and may remove others (store policy: players need a way to deal
  // with someone abusive in a lobby). Everyone is told who the owner is whenever it can change.
  owner() { for (const id of this.socks.keys()) return id; return 0; }
  bcast(o) { const s = JSON.stringify(o); for (const ws of this.socks.values()) try { ws.send(s); } catch {} for (const ws of this.specs.values()) try { ws.send(s); } catch {} }
  announceOwner() { this.bcast({ t: 'owner', id: this.owner(), open: this.open, mm: [...this.mm], specs: [...this.specs.keys()] }); }
  boot(from, target) {
    if (from !== this.owner() || target === from) return; const ws = this.socks.get(target); if (!ws) return;
    try { ws.send(JSON.stringify({ t: 'booted' })); } catch {}
    try { ws.close(4001, 'Removed by the room owner'); } catch {}
    this.gone(target);
  }
  gone(id) { if (this.specs.delete(id)) { this.announceOwner(); return; } if (!this.socks.delete(id)) return; this.acct.delete(id); this.mm.delete(id); this.host.leave(id); this.announceOwner(); this.refresh(); if (!this.socks.size && this.timer) { clearInterval(this.timer); this.timer = null; } }
  // QUICK MATCH may put a stranger in only while the owner has the room open and the squad is in the lobby
  lobby() { const s = this.host.sim; return s.phase !== 'active' || !!s.M.training; }
  teams() { let swat = 0, tango = 0; for (const p of this.host.sim.players.values()) if (!p.bot) { if (p.team === 'tango') tango++; else swat++; } return { swat, tango }; }
  // tell each player what the others are to them (friend, request sent or received, blocked) and the matchmaker how the room stands
  refresh() {
    const players = [...this.socks.keys()].map(id => [id, this.acct.get(id) || '']);
    if (players.filter(p => p[1]).length > 1) this.social('/internal/rels', { players }).then(r => { if (!r || !r.rels) return; for (const [id] of players) try { this.socks.get(id)?.send(JSON.stringify({ t: 'rel', m: r.rels[id] || {} })); } catch {} });
    this.report(true);
  }
  report(force) {
    if (!this.code) return; const { swat, tango } = this.teams(), rep = { code: this.code, open: this.open, swat, tango, n: this.socks.size, lobby: this.lobby(), accts: [...this.acct.values()] }, k = JSON.stringify(rep);
    if (!force && k === this.lastRep && Date.now() - this.reportT < 15000) return; this.lastRep = k; this.reportT = Date.now(); this.social('/internal/room', rep);
  }
  async fetch(req) {
    const url = new URL(req.url), q = url.searchParams, name = cleanCallsign(q.get('name'));   // quest-store: preset callsigns only, no free text
    this.code = (url.pathname.split('/').pop() || '').toUpperCase();
    const acct = /^[0-9a-f]{24}$/.test(q.get('acct') || '') ? q.get('acct') : '', mm = q.get('mm') === '1', mmBack = q.get('mm') === '2';   // 2: a matchmade player rejoining after a drop
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    // quest-store: a spectator (?spec=1, from a friend's room or a room code) watches without playing: not in the mission, invisible,
    // never heard (only voice set-up passes from them, and players keep them muted), up to 4 of them
    if (q.get('spec') === '1') {
      if (this.specs.size >= 4) { try { server.send(JSON.stringify({ t: 'specfull' })); } catch {} server.close(4003, 'Enough spectators'); return new Response(null, { status: 101, webSocket: client }); }
      const id = this.next++; this.specs.set(id, server);
      try { server.send(JSON.stringify({ t: 'welcome', id, spec: true, slot: -1, init: this.host.sim.init(), n: this.host.count, ph: this.host.sim.phase })); } catch {}
      this.announceOwner();
      server.addEventListener('message', e => { let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m && m.t === 'sig') { const to = this.socks.get(m.to); if (to && m.data && JSON.stringify(m.data).length < 20000) try { to.send(JSON.stringify({ t: 'sig', from: id, data: m.data })); } catch {} } });
      const bye = () => this.gone(id); server.addEventListener('close', bye); server.addEventListener('error', bye);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (mm && (!this.open || !this.lobby() || this.teams().swat < 1)) { try { server.send(JSON.stringify({ t: 'mmgone' })); } catch {} server.close(4002, 'That game is no longer open'); return new Response(null, { status: 101, webSocket: client }); }
    if (!this.socks.size) this.open = q.get('open') === '1';   // the first one in decides whether strangers may come
    const id = this.next++; this.socks.set(id, server);
    if (!this.host.join(id, name)) { this.socks.delete(id); server.close(4000, 'Room full'); return new Response(null, { status: 101, webSocket: client }); }
    if (acct) this.acct.set(id, acct);
    if (mm || mmBack) { this.mm.add(id); this.host.sim.setTeam(id, 'tango'); }   // strangers play the terrorists
    const bye = () => this.gone(id);
    this.announceOwner(); this.refresh();
    server.addEventListener('message', e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m && m.t === 'boot') { this.boot(id, m.p); return; }   // quest-store: the room owner removes a player
      if (m && m.t === 'open') { if (id === this.owner()) { this.open = !!m.v; this.announceOwner(); this.report(true); } return; }   // the owner opens the room to strangers or closes it
      if (m && m.t === 'friend') { const a = this.acct.get(id), b = this.acct.get(m.p); if (!a || !b) { try { server.send(JSON.stringify({ t: 'friendres', p: m.p, res: 'noacct' })); } catch {} return; }
        this.social('/internal/request', { from: a, to: b }).then(r => { try { server.send(JSON.stringify({ t: 'friendres', p: m.p, res: r && r.res || 'error' })); } catch {} if (r && (r.res === 'sent' || r.res === 'friend')) { try { this.socks.get(m.p)?.send(JSON.stringify({ t: 'friendreq', p: id, res: r.res })); } catch {} } this.refresh(); }); return; }
      if (m && m.t === 'block') { const a = this.acct.get(id), b = this.acct.get(m.p); if (a && b) this.social('/internal/block', { from: a, to: b }).then(() => this.refresh()); return; }
      if (m && m.t === 'rels') { this.refresh(); return; }
      if (m && m.t === 'team' && this.mm.has(id)) return;   // a matchmade stranger stays a terrorist
      if (m && m.t === 'sig') { const to = this.socks.get(m.to) || this.specs.get(m.to); if (to && m.data && JSON.stringify(m.data).length < 20000) try { to.send(JSON.stringify({ t: 'sig', from: id, data: m.data })); } catch {} return; }   // voice chat set-up, passed straight to the other person
      const mid = m && (m.m || m.map);
      if (typeof mid === 'string' && (mid.startsWith('u_') || mid.startsWith('s_')) && !MAPS[mid]) this.queue = this.queue.then(() => this.ensureMap(mid)).catch(() => {}).then(() => { try { this.host.message(id, m); } catch {} });
      else this.queue = this.queue.then(() => { try { this.host.message(id, m); } catch {} });
      if (m && (m.t === 'team' || m.t === 'start' || m.t === 'restart')) setTimeout(() => this.report(false), 100);
    });
    server.addEventListener('close', bye); server.addEventListener('error', bye);
    if (!this.timer) { let last = Date.now(); this.timer = setInterval(() => { const now = Date.now(), dt = Math.min(0.25, (now - last) / 1000); last = now; try { this.host.tick(dt); } catch (e) { if (!this.tickErr || now - this.tickErr > 10000) { this.tickErr = now; console.error('room tick failed', e && e.stack || e); } } if (now - this.reportT > 5000) this.report(false); }, TICK * 1000); }   // a bad tick is logged, it does not stop the room
    return new Response(null, { status: 101, webSocket: client });
  }
}
