// BREACHLINE mission simulation: suspects, civilians, bombs, rules of engagement, scoring. Pure logic.
import { buildLevel, groundY, rayStatic, raySphere, findPath, H, SPAWN, SUSPECT_SPOTS, CIV_SPOTS, BOMB_SPOTS } from './level.js';

export function rng32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const DMG = { rifle: { head: 200, torso: 60, legs: 30 }, pistol: { head: 200, torso: 40, legs: 20 } };
export const MISSION_TIME = 720, N_SUSPECTS = 9, N_CIVS = 5, N_BOMBS = 2;
const r2 = v => Math.round(v * 100) / 100;
const KNEEL = { k: 1, y: 1, u: 1, w: 1 }, DONE = { d: 1, u: 1, i: 1, j: 1 }, SECURED = { d: 1, u: 1, j: 1 };
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

export class Sim {
  constructor() { this.level = buildLevel(); this.players = new Map(); this.events = []; this.night = false; this.reset(1); }
  reset(seed) {
    this.seed = seed >>> 0; this.rnd = rng32(this.seed); const rnd = this.rnd;
    this.phase = 'lobby'; this.timer = MISSION_TIME; this.t = 0; this.report = null;
    this.log = { unauth: 0, execution: 0, civHit: 0, civKilled: 0, ff: 0, downs: 0, wrongWire: 0 };
    const pick = (arr, n) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
    this.npcs = [];
    const spots = pick(SUSPECT_SPOTS, N_SUSPECTS + 4);
    spots.slice(0, N_SUSPECTS).forEach(([f, x, z], i) => this.npcs.push({
      id: i + 1, kind: 's', v: Math.floor(rnd() * 4), x, z, y: f * H, yaw: rnd() * 6.28, hp: 100, st: 'g', post: [x, z, f * H],
      patrol: rnd() < 0.35 ? spots[N_SUSPECTS + (i % 4)] : null, pt: 0, pwait: 3 + rnd() * 6, resolve: 0.3 + rnd() * 0.65, sweep: (rnd() - 0.5) * 0.8,
      fakeChance: rnd() < 0.18, fake: false, shouts: 0, path: null, pi: 0, react: 0, cool: 0, burst: 3, lost: 0, tA: 0, tS: 0, hold: false, tgt: 0, lk: null, armed: true, flagged: false }));
    pick(CIV_SPOTS, N_CIVS).forEach(([f, x, z], i) => this.npcs.push({ id: 101 + i, kind: 'c', v: Math.floor(rnd() * 4), x, z, y: f * H, yaw: rnd() * 6.28, hp: 100, st: 'w', stubborn: rnd() < 0.25, flagged: false }));
    this.doorOpen = this.level.doors.map(d => !d.exterior && rnd() < 0.3);
    this.doorLocked = this.level.doors.map((d, i) => d.hidden ? false : d.exterior ? rnd() < 0.6 : !this.doorOpen[i] && rnd() < 0.3);
    this.bombs = pick(BOMB_SPOTS, N_BOMBS).map(([f, x, z, h]) => {
      const wires = pick([0, 1, 2, 3], 4), order = pick([0, 1, 2, 3], 2);
      return { x, z, y: f * H + h, wires, order, n: 0, cut: [false, false, false, false], defused: false };
    });
    for (const p of this.players.values()) { p.hp = 100; p.down = false; p.y = 0; p.lastShot = -9; p.lastShout = -9; }
  }
  start(seed, night = this.night) { this.night = !!night; this.reset(seed); this.phase = 'active'; this.ev({ e: 'start' }); }
  ev(o) { this.events.push(o); }
  addPlayer(id, name) {
    const used = new Set([...this.players.values()].map(p => p.slot)); let slot = 0; while (used.has(slot)) slot++;
    const [x, z] = SPAWN[slot % 4];
    const p = { id, name: String(name || 'Officer').slice(0, 14), slot, hp: 100, down: false, hx: x, hy: 1.65, hz: z, y: 0, h: [x, 1.65, z, 0, 0, 0, 1], l: null, r: null, g: [0, 0], lastShot: -9, lastShout: -9, lastKick: -9, has: false };
    this.players.set(id, p); return p;
  }
  removePlayer(id) { this.players.delete(id); }
  init() {
    return { seed: this.seed, night: this.night, npcs: this.npcs.map(n => [n.id, n.kind, n.v]), bombs: this.bombs.map(b => [b.x, b.y, b.z, b.wires, b.order]), time: MISSION_TIME };
  }
  pose(id, m) {
    const p = this.players.get(id); if (!p || !Array.isArray(m.h) || m.h.length < 7 || !m.h.every(Number.isFinite)) return;
    p.h = m.h; p.l = m.l || null; p.r = m.r || null; p.g = m.g || [0, 0]; p.hx = m.h[0]; p.hy = m.h[1]; p.hz = m.h[2]; p.has = true; p.light = !!m.f;
    p.y = groundY(p.hx, p.hz, p.hy - 1.0);
  }
  near(p, x, y, z, d) { return Math.hypot(p.hx - x, p.hz - z) < d && Math.abs(p.y - y) < 1.8; }
  clear(ax, ay, az, bx, by, bz, solidGlass = false) { const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz); if (d < 0.05) return true; return rayStatic(this.level, this.doorOpen, ax, ay, az, dx / d, dy / d, dz / d, d, solidGlass) >= d - 0.02; }
  eyeY(n) { return n.y + (KNEEL[n.st] ? 1.0 : 1.58); }

  // ---- player actions ----
  shot(id, m) {
    const p = this.players.get(id); if (!p || p.down || this.phase !== 'active' || !Array.isArray(m.o) || !Array.isArray(m.d)) return;
    const w = m.w === 'pistol' ? 'pistol' : 'rifle'; if (this.t - p.lastShot < 0.06) return; p.lastShot = this.t;
    let [ox, oy, oz] = m.o, [dx, dy, dz] = m.d; const dl = Math.hypot(dx, dy, dz); if (!(dl > 0) || !this.near(p, ox, p.y, oz, 1.6)) return; dx /= dl; dy /= dl; dz /= dl;
    let best = rayStatic(this.level, this.doorOpen, ox, oy, oz, dx, dy, dz, 80), kind = 'w', tn = null, part = null, tp = null;
    for (const n of this.npcs) { if (n.st === 'd') continue; for (const [sx, sy, sz, sr, pt] of this.spheres(n)) { const t = raySphere(ox, oy, oz, dx, dy, dz, sx, sy, sz, sr); if (t >= 0 && t < best) { best = t; kind = 'n'; tn = n; part = pt; } } }
    for (const q of this.players.values()) { if (q === p || q.down || !q.has) continue; for (const [oy2, sr] of [[0, 0.14], [-0.32, 0.21], [-0.62, 0.2]]) { const t = raySphere(ox, oy, oz, dx, dy, dz, q.hx, q.hy + oy2, q.hz, sr); if (t >= 0 && t < best) { best = t; kind = 'p'; tp = q; tn = null; } } }
    this.ev({ e: 'ps', p: id, w, o: [r2(ox), r2(oy), r2(oz)], h: [r2(ox + dx * best), r2(oy + dy * best), r2(oz + dz * best)], k: kind });
    this.noise(ox, oz, 45, p);
    if (kind === 'n') this.hitNpc(tn, DMG[w][part], p, part);
    else if (kind === 'p') { this.log.ff++; this.hurt(tp, DMG[w].torso * 0.6); }
  }
  spheres(n) { if (n.st === 'i' || n.st === 'j') return [[n.x, n.y + 0.2, n.z, 0.28, 'torso']]; const k = KNEEL[n.st] ? 0.62 : 1; return [[n.x, n.y + 1.62 * k, n.z, 0.13, 'head'], [n.x, n.y + 1.32 * k, n.z, 0.2, 'torso'], [n.x, n.y + 1.02 * k, n.z, 0.2, 'torso'], [n.x, n.y + 0.55 * k, n.z, 0.18, 'legs']]; }
  hitNpc(n, dmg, p, part) {
    n.hp -= dmg; const dead = n.hp <= 0;
    if (n.kind === 'c') { if (!n.flagged) { n.flagged = true; this.log.civHit++; } if (dead) { n.st = 'd'; this.log.civKilled++; } this.ev({ e: 'hit', n: n.id, dead }); return; }
    const justified = n.st === 'c', wasDown = n.st === 'i' || n.st === 'j';
    if (!justified && !n.flagged) { n.flagged = true; if (n.st === 's' || n.st === 'k' || n.st === 'u' || wasDown) this.log.execution++; else this.log.unauth++; }
    if (wasDown) { n.st = 'd'; n.just = false; }
    else if (dead) { n.st = part === 'head' || this.rnd() < 0.25 ? 'd' : 'i'; n.just = justified; n.armed = false; n.path = null; }   // most body hits incapacitate: the suspect can still be arrested
    else if (n.st === 'g' || n.st === 'a') this.engage(n, p, 0.3);
    else if (n.st === 'c' && n.hp < 60 && this.rnd() < 0.35) this.surrender(n);
    this.ev({ e: 'hit', n: n.id, dead });
  }
  hurt(p, dmg) { if (p.down) return; p.hp -= dmg; this.ev({ e: 'hurt', p: p.id }); if (p.hp <= 0) { p.hp = 0; p.down = true; this.log.downs++; this.ev({ e: 'down', p: p.id }); } }
  noise(x, z, radius, src) {
    for (const n of this.npcs) if (n.kind === 's' && n.st === 'g' && Math.hypot(n.x - x, n.z - z) < radius) {
      n.st = 'a'; n.tA = 0; n.lk = [src.hx, src.hz, src.y]; n.hold = this.rnd() < 0.45; n.path = null;
    }
  }
  shout(id) {
    const p = this.players.get(id); if (!p || p.down || this.phase !== 'active' || this.t - p.lastShout < 1.0) return; p.lastShout = this.t;
    this.ev({ e: 'shout', p: id });
    for (const n of this.npcs) {
      if (Math.hypot(n.x - p.hx, n.z - p.hz) > 12 || !this.clear(p.hx, p.hy, p.hz, n.x, this.eyeY(n), n.z)) continue;
      if (n.kind === 'c') { if (n.st === 'w') { if (n.stubborn) { n.stubborn = false; this.ev({ e: 'say', n: n.id, k: 'plead' }); } else { n.st = 'y'; this.ev({ e: 'say', n: n.id, k: 'comply' }); } } continue; }
      if (n.st !== 'g' && n.st !== 'a' && n.st !== 'c') continue;
      n.shouts++;
      let pr = (1 - n.resolve) * (n.st === 'g' ? 1.3 : n.st === 'c' ? 0.6 : 1) * (n.hp < 60 ? 1.6 : 1) + 0.1 * (n.shouts - 1);
      if (this.rnd() < pr) this.surrender(n);
      else { this.ev({ e: 'say', n: n.id, k: 'defy' }); if (n.st !== 'c') this.engage(n, p, 0.5 + this.rnd() * 0.4); }
    }
  }
  surrender(n) { n.st = 's'; n.tS = 0; n.path = null; n.armed = false; n.fake = n.fakeChance; n.fakeChance = false; n.fakeAt = 3.5 + this.rnd() * 4; this.ev({ e: 'say', n: n.id, k: 'surrender' }); }
  engage(n, p, react) { n.st = 'c'; n.react = react; n.cool = 0; n.burst = 2 + Math.floor(this.rnd() * 3); n.tgt = p.id; n.lost = 0; n.path = null; n.lk = [p.hx, p.hz, p.y]; }
  cuff(id, nid) {
    const p = this.players.get(id), n = this.npcs.find(q => q.id === nid); if (!p || p.down || !n || this.phase !== 'active') return;
    if ((n.st === 's' || n.st === 'k' || n.st === 'y' || n.st === 'i') && this.near(p, n.x, n.y, n.z, 1.9)) { n.st = n.st === 'i' ? 'j' : 'u'; n.fake = false; this.ev({ e: 'cuff', n: n.id, p: id }); }
  }
  revive(id, tid) { const p = this.players.get(id), q = this.players.get(tid); if (p && q && !p.down && q.down && this.near(p, q.hx, q.y, q.hz, 1.8)) { q.down = false; q.hp = 40; this.ev({ e: 'revive', p: tid }); } }
  door(id, did) {
    const p = this.players.get(id), d = this.level.doors[did]; if (!p || p.down || !d || !this.near(p, d.cx, d.y, d.cz, 2.2)) return;
    if (!this.doorOpen[did] && this.doorLocked[did]) return this.ev({ e: 'locked', d: did });
    this.doorOpen[did] = !this.doorOpen[did]; this.ev({ e: 'door', d: did, open: this.doorOpen[did] });
  }
  pick(id, did) {   // quiet: the client sends this after the lock has been worked for a few seconds
    const p = this.players.get(id), d = this.level.doors[did]; if (!p || p.down || !d || !this.near(p, d.cx, d.y, d.cz, 2.2) || !this.doorLocked[did]) return;
    this.doorLocked[did] = false; this.ev({ e: 'unlock', d: did });
  }
  kick(id, did) {   // loud: opens an unlocked door, has a chance to break a locked one
    const p = this.players.get(id), d = this.level.doors[did]; if (!p || p.down || !d || this.doorOpen[did] || !this.near(p, d.cx, d.y, d.cz, 2.2) || this.t - p.lastKick < 0.7) return;
    p.lastKick = this.t; const ok = !this.doorLocked[did] || this.rnd() < 0.55;
    if (ok) { this.doorLocked[did] = false; this.doorOpen[did] = true; }
    this.ev({ e: 'kick', d: did, ok }); if (this.phase === 'active') this.noise(d.cx, d.cz, 16, p);
  }
  cut(id, bi, wi) {
    const p = this.players.get(id), b = this.bombs[bi]; if (!p || p.down || !b || b.defused || this.phase !== 'active' || !(wi >= 0 && wi < 4) || b.cut[wi] || !this.near(p, b.x, b.y - 0.8, b.z, 2)) return;
    b.cut[wi] = true; const ok = wi === b.order[b.n];
    if (ok) { b.n++; if (b.n >= b.order.length) b.defused = true; } else { this.timer = Math.max(5, this.timer - 45); this.log.wrongWire++; }
    this.ev({ e: 'cut', b: bi, w: wi, ok, defused: b.defused });
  }

  // ---- simulation ----
  sees(n, p, d) {
    const lit = this.night && p.light;                 // in the dark a flashlight gives you away at any range, even through glass
    if (d > (this.night && !lit ? 7 : 22)) return false;
    if (d > 2.5) { const a = Math.atan2(p.hx - n.x, p.hz - n.z); if (Math.abs(angDiff(a, n.yaw)) > 1.05) return false; }
    return this.clear(n.x, this.eyeY(n), n.z, p.hx, p.hy, p.hz, d > 8 && !lit);   // a lit room's glass only shows what is close
  }
  face(n, x, z, dt, rate) { const a = Math.atan2(x - n.x, z - n.z), d = angDiff(a, n.yaw), s = rate * dt; n.yaw += Math.abs(d) < s ? d : Math.sign(d) * s; }
  goto(n, x, z, y) { n.path = findPath(this.level, n.x, n.z, n.y, x, z, y); n.pi = 1; return !!n.path; }
  walk(n, dt, speed) {
    if (!n.path || n.pi >= n.path.length) { n.path = null; return false; }
    const [tx, tz] = n.path[n.pi], dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz), s = speed * dt;
    if (d <= s) { n.x = tx; n.z = tz; n.pi++; } else { n.x += dx / d * s; n.z += dz / d * s; this.face(n, tx, tz, dt, 6); }
    n.y = groundY(n.x, n.z, n.y);
    this.level.doors.forEach((dr, i) => { if (!this.doorOpen[i] && Math.abs(dr.y - n.y) < 1 && Math.hypot(dr.cx - n.x, dr.cz - n.z) < 1.1) { this.doorOpen[i] = true; this.doorLocked[i] = false; this.ev({ e: 'door', d: i, open: true }); } });
    return true;
  }
  tickSuspect(n, dt) {
    if (DONE[n.st]) return;
    if (n.st === 's' || n.st === 'k') {
      n.tS += dt;
      if (n.fake && n.tS > n.fakeAt) { n.fake = false; n.armed = true; let bp = null, bd = 1e9; for (const p of this.players.values()) { const d = Math.hypot(p.hx - n.x, p.hz - n.z); if (!p.down && d < bd) { bd = d; bp = p; } } if (bp) { this.engage(n, bp, 0.55); this.ev({ e: 'say', n: n.id, k: 'fake' }); } }
      else if (n.st === 's' && n.tS > 1.2 && !n.fake) n.st = 'k';
      return;
    }
    let seen = null, best = 1e9;
    for (const p of this.players.values()) { if (p.down || !p.has) continue; const d = Math.hypot(p.hx - n.x, p.hy - n.y - 1.5, p.hz - n.z); if (d < best && this.sees(n, p, d)) { seen = p; best = d; } }
    if (n.st === 'g') {
      if (seen) return this.engage(n, seen, 0.6 + this.rnd() * 0.5);
      if (n.path) { if (!this.walk(n, dt, 1.3)) n.pwait = 4 + this.rnd() * 8; }
      else { n.yaw += n.sweep * dt; if (n.patrol) { n.pwait -= dt; if (n.pwait <= 0) { n.pt = 1 - n.pt; const t = n.pt ? [n.patrol[1], n.patrol[2], n.patrol[0] * H] : n.post; if (!this.goto(n, t[0], t[1], t[2])) n.pwait = 5; } } }
    } else if (n.st === 'a') {
      if (seen) return this.engage(n, seen, 0.35 + this.rnd() * 0.35);
      n.tA += dt;
      if (n.hold) this.face(n, n.lk[0], n.lk[1], dt, 3);
      else if (!n.path) { if (Math.hypot(n.lk[0] - n.x, n.lk[1] - n.z) > 3) this.goto(n, n.lk[0], n.lk[1], n.lk[2]); else n.hold = true; }
      else this.walk(n, dt, 2.2);
      if (n.tA > 25) { n.st = 'g'; n.hold = false; this.goto(n, n.post[0], n.post[1], n.post[2]); }
    } else if (n.st === 'c') {
      if (seen) {
        n.tgt = seen.id; n.lost = 0; n.lk = [seen.hx, seen.hz, seen.y]; n.path = null; this.face(n, seen.hx, seen.hz, dt, 8); n.react -= dt;
        if (n.react <= 0) { n.cool -= dt; if (n.cool <= 0) { this.npcFire(n, seen, best); n.burst--; if (n.burst > 0) n.cool = 0.16; else { n.burst = 2 + Math.floor(this.rnd() * 3); n.cool = 0.7 + this.rnd() * 0.7; } } }
      } else {
        n.lost += dt;
        if (n.lost > 1.2) { if (!n.path && Math.hypot(n.lk[0] - n.x, n.lk[1] - n.z) > 1.5) this.goto(n, n.lk[0], n.lk[1], n.lk[2]); this.walk(n, dt, 2.6); }
        if (n.lost > 12) { n.st = 'a'; n.tA = 0; n.hold = true; n.path = null; }
      }
    }
  }
  npcFire(n, p, d) {
    const hit = this.rnd() < Math.max(0.08, Math.min(0.5, 0.55 - 0.02 * d)), sp = hit ? 0 : 0.7;
    const to = [r2(p.hx + (this.rnd() - 0.5) * sp), r2(p.hy - 0.25 + (this.rnd() - 0.5) * sp), r2(p.hz + (this.rnd() - 0.5) * sp)];
    this.ev({ e: 'ns', n: n.id, to });
    if (hit) this.hurt(p, 18 + this.rnd() * 10);
  }
  tick(dt) {
    this.t += dt;
    if (this.phase !== 'active') return;
    this.timer -= dt;
    for (const n of this.npcs) if (n.kind === 's') this.tickSuspect(n, dt);
    const sus = this.npcs.filter(n => n.kind === 's'), civ = this.npcs.filter(n => n.kind === 'c'), ps = [...this.players.values()];
    let result = null;
    if (this.timer <= 0 && this.bombs.some(b => !b.defused)) result = 'DETONATION';
    else if (ps.length && ps.every(p => p.down)) result = 'SQUAD DOWN';
    else if (sus.every(n => SECURED[n.st]) && civ.every(n => n.st === 'u' || n.st === 'd') && this.bombs.every(b => b.defused)) result = 'MISSION COMPLETE';
    if (result) { this.phase = 'ended'; this.report = this.score(result); this.ev({ e: 'end', result }); }
  }
  score(result) {
    const L = this.log, sus = this.npcs.filter(n => n.kind === 's'), civ = this.npcs.filter(n => n.kind === 'c');
    const arrested = sus.filter(n => n.st === 'u' || n.st === 'j').length, killed = sus.filter(n => n.st === 'd' && n.just).length, secured = civ.filter(n => n.st === 'u').length, defused = this.bombs.filter(b => b.defused).length;
    const lines = [
      ['Bombs defused ' + defused + '/' + this.bombs.length, 15 * defused],
      ['Hostages secured ' + secured + '/' + civ.length, Math.round(25 * secured / civ.length)],
      ['Suspects arrested ' + arrested + '/' + sus.length, Math.round(30 * arrested / sus.length)],
      ['Suspects killed (justified) ' + killed, Math.round(15 * killed / sus.length)],
      ['Officers down ' + L.downs, L.downs ? -7 * L.downs : 15],
    ];
    if (L.unauth) lines.push(['Unauthorised use of force x' + L.unauth, -10 * L.unauth]);
    if (L.execution) lines.push(['Shot a surrendered suspect x' + L.execution, -20 * L.execution]);
    if (L.civHit) lines.push(['Civilian shot x' + L.civHit, -15 * L.civHit]);
    if (L.civKilled) lines.push(['Civilian killed x' + L.civKilled, -15 * L.civKilled]);
    if (L.ff) lines.push(['Friendly fire x' + L.ff, -5 * L.ff]);
    let total = Math.max(0, Math.min(100, lines.reduce((s, l) => s + l[1], 0)));
    if (result !== 'MISSION COMPLETE') total = Math.min(total, 49);
    const grade = total >= 90 ? 'A' : total >= 80 ? 'B' : total >= 70 ? 'C' : total >= 60 ? 'D' : 'F';
    return { result, lines, total, grade, time: Math.round(MISSION_TIME - this.timer) };
  }
  snapshot() {
    const P = [...this.players.values()].map(p => [p.id, p.name, p.slot, Math.round(p.hp), p.down ? 1 : 0, p.h, p.l, p.r, p.g]);
    const N = this.npcs.map(n => [n.id, r2(n.x), r2(n.y), r2(n.z), r2(n.yaw), n.st, n.kind === 's' && n.armed ? 1 : 0]);
    const E = this.events; this.events = [];
    const s = { t: 's', ph: this.phase, tm: Math.ceil(this.timer), P, N, D: this.doorOpen.map(o => o ? 1 : 0).join(''), L: this.doorLocked.map(o => o ? 1 : 0).join(''), B: this.bombs.map(b => [b.cut.map(c => c ? 1 : 0).join(''), b.defused ? 1 : 0, b.n]), E };
    if (this.report) s.R = this.report;
    return s;
  }
}
