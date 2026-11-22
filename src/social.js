// quest-store: accounts, friends, blocking and terrorist matchmaking. One Durable Object ("social") with SQLite storage.
//
// Account: the game has no Meta login, so an account is the purchase of the full game. The app sends the purchase token it gets
// from Meta's Digital Goods service (the same purchase on every headset signed in to that Meta account); the Worker keeps only a
// salted SHA-256 of it (acct) and hands back a signed ticket. A development-unlocked headset sends a random device id instead.
// Nothing here is free text: callsigns are the preset ones, friends are made between two people who were in the same room.
//
// Rooms report themselves here (open to strangers or not, how many SWAT and terrorist players, lobby or mission) so QUICK MATCH can
// put a stranger, as a TERRORIST, into a SWAT room whose owner opened it. Room codes are only ever given to friends and matchmade
// players, never listed.
import { cleanCallsign } from '../public/js/store/callsigns.js';

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export const sha = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const hmacKey = secret => crypto.subtle.importKey('raw', enc.encode('ych-ticket:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const sign = async (secret, msg) => hex(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(msg))).slice(0, 32);
export const socialSecret = env => env.SOCIAL_KEY || env.CREATOR_CODE || '';
export async function makeTicket(env, token) {
  const secret = socialSecret(env); if (!secret || typeof token !== 'string' || token.length < 8 || token.length > 4096) return null;
  // the account is not keyed by the secret: changing the secret signs everyone out but keeps their friends
  const acct = (await sha('ych-acct:' + token)).slice(0, 24), exp = Math.floor(Date.now() / 1000) + 7 * 86400;
  return { ticket: acct + '.' + exp + '.' + await sign(secret, acct + '.' + exp), acct };
}
export async function readTicket(env, t) {
  const secret = socialSecret(env); if (!secret || typeof t !== 'string') return null;
  const m = t.match(/^([0-9a-f]{24})\.(\d{10})\.([0-9a-f]{32})$/); if (!m || +m[2] < Date.now() / 1000) return null;
  const want = await sign(secret, m[1] + '.' + m[2]); let d = 0; for (let i = 0; i < 32; i++) d |= want.charCodeAt(i) ^ m[3].charCodeAt(i);
  return d ? null : m[1];
}

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const ONLINE = 75e3, ROOM_FRESH = 30e3, MAX_FRIENDS = 100, MAX_REQ_DAY = 40;
export const ROOM_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export class Social {
  constructor(state) {
    const q = this.sql = state.storage.sql;
    q.exec('CREATE TABLE IF NOT EXISTS acct (id TEXT PRIMARY KEY, call TEXT, seen INTEGER, room TEXT)');
    q.exec('CREATE TABLE IF NOT EXISTS friend (a TEXT, b TEXT, since INTEGER, PRIMARY KEY (a, b))');   // stored both ways
    q.exec('CREATE TABLE IF NOT EXISTS req (src TEXT, dst TEXT, at INTEGER, PRIMARY KEY (src, dst))');
    q.exec('CREATE TABLE IF NOT EXISTS block (a TEXT, b TEXT, PRIMARY KEY (a, b))');                 // a blocked b
    q.exec('CREATE TABLE IF NOT EXISTS tries (ip TEXT, day INTEGER, n INTEGER, PRIMARY KEY (ip, day))');   // tester-code attempts
    q.exec('CREATE TABLE IF NOT EXISTS room (code TEXT PRIMARY KEY, open INTEGER, swat INTEGER, tango INTEGER, n INTEGER, lobby INTEGER, accts TEXT, at INTEGER)');
  }
  all(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  one(q, ...a) { return this.all(q, ...a)[0]; }
  isFriend(a, b) { return !!this.one('SELECT 1 FROM friend WHERE a = ? AND b = ?', a, b); }
  blocked(a, b) { return !!this.one('SELECT 1 FROM block WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)', a, b, b, a); }
  befriend(a, b) { const now = Date.now(); this.sql.exec('INSERT OR IGNORE INTO friend (a, b, since) VALUES (?, ?, ?)', a, b, now); this.sql.exec('INSERT OR IGNORE INTO friend (a, b, since) VALUES (?, ?, ?)', b, a, now); this.sql.exec('DELETE FROM req WHERE (src = ? AND dst = ?) OR (src = ? AND dst = ?)', a, b, b, a); }
  unfriend(a, b) { this.sql.exec('DELETE FROM friend WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)', a, b, b, a); this.sql.exec('DELETE FROM req WHERE (src = ? AND dst = ?) OR (src = ? AND dst = ?)', a, b, b, a); }
  rel(a, b) {   // what b is to a
    if (this.one('SELECT 1 FROM block WHERE a = ? AND b = ?', a, b)) return 'blocked';
    if (this.isFriend(a, b)) return 'friend';
    if (this.one('SELECT 1 FROM req WHERE src = ? AND dst = ?', a, b)) return 'sent';
    if (this.one('SELECT 1 FROM req WHERE src = ? AND dst = ?', b, a)) return 'got';
    return '';
  }
  // a asks b (both were in the same room). b asking back, or accepting, makes them friends.
  request(a, b) {
    if (!a || !b || a === b) return 'no';
    if (this.blocked(a, b)) return 'no';
    if (this.isFriend(a, b)) return 'friend';
    if (this.one('SELECT 1 FROM req WHERE src = ? AND dst = ?', b, a)) { if (this.count(a) >= MAX_FRIENDS || this.count(b) >= MAX_FRIENDS) return 'full'; this.befriend(a, b); return 'friend'; }
    if (this.one('SELECT COUNT(*) AS n FROM req WHERE src = ? AND at > ?', a, Date.now() - 864e5).n >= MAX_REQ_DAY) return 'limit';
    this.sql.exec('INSERT OR REPLACE INTO req (src, dst, at) VALUES (?, ?, ?)', a, b, Date.now()); return 'sent';
  }
  count(a) { return this.one('SELECT COUNT(*) AS n FROM friend WHERE a = ?', a).n; }
  block(a, b) { if (!a || !b || a === b) return; this.unfriend(a, b); this.sql.exec('INSERT OR IGNORE INTO block (a, b) VALUES (?, ?)', a, b); }
  roomOf(code) { const r = this.one('SELECT * FROM room WHERE code = ? AND at > ?', code, Date.now() - ROOM_FRESH); return r || null; }

  async fetch(req) {
    const url = new URL(req.url), p = url.pathname, now = Date.now();
    let b = {}; try { b = await req.json(); } catch (e) { }
    try {
      // ---- from Room Durable Objects (never reachable from outside: the Worker forwards only /api/social/<name> to /<name>) ----
      if (p === '/internal/room') {
        if (!ROOM_RE.test(b.code || '')) return json({ ok: false });
        if (!b.n) { this.sql.exec('DELETE FROM room WHERE code = ?', b.code); return json({ ok: true }); }
        this.sql.exec('INSERT OR REPLACE INTO room (code, open, swat, tango, n, lobby, accts, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', b.code, b.open ? 1 : 0, b.swat | 0, b.tango | 0, b.n | 0, b.lobby ? 1 : 0, JSON.stringify((b.accts || []).filter(Boolean).slice(0, 8)), now);
        return json({ ok: true });
      }
      if (p === '/internal/rels') {   // [[playerId, acct], ...] -> for each player: what each other player is to them
        const list = (b.players || []).slice(0, 8), out = {};
        for (const [id, a] of list) { out[id] = {}; for (const [id2, a2] of list) if (id2 !== id && a && a2) { const r = this.rel(a, a2); if (r) out[id][id2] = r; } }
        return json({ rels: out });
      }
      if (p === '/internal/try') {   // at most 20 tester-code attempts per network address per day
        const day = Math.floor(now / 864e5), r = this.one('SELECT n FROM tries WHERE ip = ? AND day = ?', b.ip || '', day), n = r ? r.n : 0;
        if (n >= 20) return json({ ok: false });
        this.sql.exec('INSERT OR REPLACE INTO tries (ip, day, n) VALUES (?, ?, ?)', b.ip || '', day, n + 1); this.sql.exec('DELETE FROM tries WHERE day < ?', day - 1);
        return json({ ok: true });
      }
      if (p === '/internal/request') return json({ res: this.request(b.from, b.to) });
      if (p === '/internal/block') { this.block(b.from, b.to); return json({ ok: true }); }

      // ---- from players (the Worker has checked the ticket and set x-acct) ----
      const me = req.headers.get('x-acct') || ''; if (!/^[0-9a-f]{24}$/.test(me)) return json({ error: 'Not signed in' }, 401);
      if (p === '/hello') {   // presence, and my friends and requests
        const room = ROOM_RE.test(b.room || '') ? b.room : '';
        this.sql.exec('INSERT OR REPLACE INTO acct (id, call, seen, room) VALUES (?, ?, ?, ?)', me, cleanCallsign(b.call), now, room);
        const friends = this.all('SELECT f.b AS id, a.call, a.seen, a.room FROM friend f LEFT JOIN acct a ON a.id = f.b WHERE f.a = ? ORDER BY a.seen DESC', me).map(f => {
          const online = !!f.seen && now - f.seen < ONLINE, r = online && f.room ? this.roomOf(f.room) : null;
          return { id: f.id, call: f.call || 'OFFICER', online, inRoom: !!r, canJoin: !!r && r.n < 4 };
        });
        const requests = this.all('SELECT r.src AS id, a.call FROM req r LEFT JOIN acct a ON a.id = r.src WHERE r.dst = ? AND NOT EXISTS (SELECT 1 FROM block k WHERE k.a = ? AND k.b = r.src) ORDER BY r.at DESC LIMIT 20', me, me).map(r => ({ id: r.id, call: r.call || 'OFFICER' }));
        return json({ friends, requests });
      }
      const other = typeof b.id === 'string' && /^[0-9a-f]{24}$/.test(b.id) ? b.id : '';
      if (p === '/accept') { if (!other || !this.one('SELECT 1 FROM req WHERE src = ? AND dst = ?', other, me)) return json({ error: 'No such request' }, 404); if (this.count(me) >= MAX_FRIENDS) return json({ error: 'Your friends list is full (100).' }, 409); this.befriend(me, other); return json({ ok: true }); }
      if (p === '/decline') { this.sql.exec('DELETE FROM req WHERE src = ? AND dst = ?', other, me); return json({ ok: true }); }
      if (p === '/remove') { this.unfriend(me, other); return json({ ok: true }); }
      if (p === '/block') { this.block(me, other); return json({ ok: true }); }
      if (p === '/forget') {   // privacy: delete everything about this account (presence, friends both ways, requests, blocks)
        this.sql.exec('DELETE FROM acct WHERE id = ?', me); this.sql.exec('DELETE FROM friend WHERE a = ? OR b = ?', me, me); this.sql.exec('DELETE FROM req WHERE src = ? OR dst = ?', me, me); this.sql.exec('DELETE FROM block WHERE a = ? OR b = ?', me, me);
        return json({ ok: true });
      }
      if (p === '/join') {   // a friend's room code, only for a friend
        if (!other || !this.isFriend(me, other) || this.blocked(me, other)) return json({ error: 'Not your friend' }, 403);
        const f = this.one('SELECT seen, room FROM acct WHERE id = ?', other), r = f && now - f.seen < ONLINE && f.room ? this.roomOf(f.room) : null;
        if (!r) return json({ error: 'Your friend is not in a room right now.' }, 404);
        if (r.n >= 4 && !b.watch) return json({ error: "Your friend's room is full." }, 409);   // watch: spectating does not take a place
        return json({ room: r.code });
      }
      if (p === '/match') {   // QUICK MATCH: a stranger, as a terrorist, into an open SWAT room
        const rooms = this.all('SELECT * FROM room WHERE open = 1 AND lobby = 1 AND swat >= 1 AND tango < 2 AND n < 4 AND at > ? ORDER BY tango ASC, n DESC, at DESC', now - ROOM_FRESH);
        for (const r of rooms) {
          const accts = JSON.parse(r.accts || '[]'); if (accts.includes(me) || accts.some(a => this.blocked(me, a))) continue;
          this.sql.exec('UPDATE room SET n = n + 1, tango = tango + 1 WHERE code = ?', r.code);   // hold the place until the room reports again
          return json({ room: r.code });
        }
        return json({ wait: true, open: this.one('SELECT COUNT(*) AS n FROM room WHERE open = 1 AND at > ?', now - ROOM_FRESH).n });
      }
      return json({ error: 'Not found' }, 404);
    } catch (e) { return json({ error: 'Bad request: ' + (e && e.message) }, 400); }
  }
}

// ---- test mode: a signed tester token for whoever typed the TEST_CODE (Worker secret) ----
export async function makeTesterToken(env) { const secret = socialSecret(env), exp = Math.floor(Date.now() / 1000) + 90 * 86400; return 'tst.' + exp + '.' + await sign(secret, 'tester.' + exp); }
export async function readTesterToken(env, t) {
  const secret = socialSecret(env); if (!secret || !env.TEST_CODE || typeof t !== 'string') return false;
  const m = t.match(/^tst\.(\d{10})\.([0-9a-f]{32})$/); if (!m || +m[1] < Date.now() / 1000) return false;
  const want = await sign(secret, 'tester.' + m[1]); let d = 0; for (let i = 0; i < 32; i++) d |= want.charCodeAt(i) ^ m[2].charCodeAt(i); return !d;
}
export function sameCode(a, b) { if (typeof a !== 'string' || typeof b !== 'string' || !b) return false; let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0); return !d; }
