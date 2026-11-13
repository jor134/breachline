// BREACHLINE mission simulation: suspects, civilians, bombs, rules of engagement, scoring. Pure logic.
import { carsAt, onTrack } from './maps/circuit.js';
import { buildLevel, rayStatic, raySphere, findPath, solidAt, circleHits, U, MAPS, MISSION_IDS } from './level.js';
export { MAP_IDS, MISSION_IDS } from './level.js';

export function rng32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const DMG = { rifle: { head: 200, torso: 60, legs: 30 }, pistol: { head: 200, torso: 40, legs: 20 } };
export const MISSION_TIME = 720;   // the mansion's; each map sets its own (map.time)
const r2 = v => Math.round(v * 100) / 100;
export const PARTS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'];   // wound bits 1,2,4,8,16,32
export const WEATHER = ['clear', 'rain', 'fog', 'storm'];
const SIGHT = { clear: 1, rain: 0.8, fog: 0.4, storm: 0.7 }, HEAR = { clear: 1, rain: 0.7, fog: 1, storm: 0.5 };   // weather hides you and covers noise
const KNEEL = { k: 1, y: 1, u: 1, w: 1, h: 1 }, DONE = { d: 1, u: 1, i: 1, j: 1 }, SECURED = { d: 1, u: 1, j: 1 };
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

export class Sim {
  constructor(mapId = 'mansion') { this.setMap(mapId); this.players = new Map(); this.events = []; this.night = false; this.wxPick = 'random'; this.todPick = 'random'; this.raceT = 0; this.weather = 'clear'; this.reset(1); }
  // Put a bomb at the edge of whatever it sits on, on the side an officer can stand at, wires toward him, so it is in arm's reach.
  edgeSpot(x, z, top, floorY) {
    const L = this.level, b = L.boxes.find(o => o.kind === 'furn' && x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1 && Math.abs(o.y1 - top) < 0.25);
    if (!b) return [x, z, 0];
    let best = null;
    for (const [nx, nz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const ex = nx < 0 ? b.x0 : nx > 0 ? b.x1 : Math.max(b.x0 + 0.2, Math.min(b.x1 - 0.2, x)), ez = nz < 0 ? b.z0 : nz > 0 ? b.z1 : Math.max(b.z0 + 0.2, Math.min(b.z1 - 0.2, z));
      if (circleHits(L, null, ex + nx * 0.45, ez + nz * 0.45, 0.25, floorY)) continue;   // nowhere to stand on this side
      const cost = Math.hypot(ex - x, ez - z); if (!best || cost < best[0]) best = [cost, ex - nx * 0.13, ez - nz * 0.13, Math.atan2(nx, nz)];
    }
    return best ? best.slice(1) : [x, z, 0];
  }
  // PvP human shield: a terrorist player grabs a hostage within reach with a free hand. The hostage is held just in front
  // and a little to the left, hands up and slightly stooped, so it covers most of the body; the head and right side stay
  // exposed. Pistol only while holding. Let go by releasing the grip; also when shot by SWAT, flashed, or downed.
  hold(id, nid) {
    const p = this.players.get(id), n = this.npcs.find(q => q.id === nid);
    if (!p || !n || !this.pvp || p.team !== 'tango' || p.down || p.hold || this.phase !== 'active' || n.kind !== 'c' || n.held || n.st === 'u' || n.st === 'd') return;
    if (Math.hypot(n.x - p.hx, n.z - p.hz) > 1.5 || Math.abs(n.y - p.y) > 0.6) return;
    p.hold = nid; n.held = id; n.st = 'x'; this.ev({ e: 'grab', p: id, n: nid }); this.ev({ e: 'say', n: nid, k: 'plead' }); this.carry(p);
  }
  release(id) { const p = this.players.get(id); if (p && p.hold) this.drop(p, 'let go'); }
  drop(p, why) { const n = this.npcs.find(q => q.id === p.hold); p.hold = 0; if (n) { n.held = 0; if (n.st === 'x') n.st = 'w'; this.ev({ e: 'drop', p: p.id, n: n.id, why }); } }
  carry(p) {
    const n = this.npcs.find(q => q.id === p.hold); if (!n || n.st === 'd' || p.down) return this.drop(p, p.down ? 'down' : 'gone');
    const [qx, qy, qz, qw] = p.h ? p.h.slice(3, 7) : [0, 0, 0, 1]; let fx = -2 * (qx * qz + qw * qy), fz = -(1 - 2 * (qx * qx + qy * qy)); const L = Math.hypot(fx, fz) || 1; fx /= L; fz /= L;
    n.x = p.hx + fx * 0.48 + fz * 0.14; n.z = p.hz + fz * 0.48 - fx * 0.14; n.y = p.y; n.yaw = Math.atan2(fx, fz);
  }
  setTeam(id, team) { const p = this.players.get(id); if (!p || (this.phase === 'active' && !this.M.training) || (team !== 'swat' && team !== 'tango')) return; p.team = team; this.ev({ e: 'team', p: id, team }); }
  choose(m) { if (this.M.training && MISSION_IDS.includes(m.m)) this.nextMap = m.m; if (m.wx === 'random' || WEATHER.includes(m.wx)) this.wxPick = m.wx; if (m.tod === 'random' || m.tod === 'day' || m.tod === 'night') this.todPick = m.tod; }
  setMap(id) { this.level = buildLevel(MAPS[id] ? id : 'mansion'); this.M = this.level.map; this.mapId = this.level.id; this.targets = null; }
  reset(seed) {
    this.seed = seed >>> 0; this.rnd = rng32(this.seed); const rnd = this.rnd;
    { const r = rng32(this.seed ^ 0x9e3779b9)(); this.weather = WEATHER.includes(this.wxPick) ? this.wxPick : r < 0.35 ? 'clear' : r < 0.6 ? 'rain' : r < 0.8 ? 'fog' : 'storm'; }
    { const T = this.M.tods; this.tod = !T ? 'dusk' : T.includes(this.todPick) ? this.todPick : T[rng32(this.seed ^ 0x51ed)() < 0.5 ? 0 : 1]; }
    const M = this.M, H = M.H, C = M.counts, NS = C.s - (M.hvt ? 3 : 0);
    this.phase = 'lobby'; this.timer = M.time; this.t = 0; this.report = null;
    this.log = { unauth: 0, execution: 0, civHit: 0, civKilled: 0, civExecuted: 0, ff: 0, downs: 0, wrongWire: 0 }; this.extractT = 0; this.left = null;
    const pick = (arr, n) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
    this.npcs = [];
    const spots = pick(M.spots.s, NS + 4);
    // on a big map a suspect only walks a beat near his post (map.patrolMax)
    const mk = ([f, x, z], i, patrol) => this.npcs.push({
      id: i + 1, kind: 's', v: Math.floor(rnd() * 4), x, z, y: f * H, yaw: rnd() * 6.28, hp: 100, st: 'g', post: [x, z, f * H],
      patrol: patrol && rnd() < 0.35 ? (sp => sp && Math.hypot(sp[1] - x, sp[2] - z) + Math.abs(sp[0] - f) * 8 <= (M.patrolMax || Infinity) ? sp : null)(spots[NS + (i % 4)]) : null, pt: 0, pwait: 3 + rnd() * 6, resolve: 0.3 + rnd() * 0.65, sweep: (rnd() - 0.5) * 0.8,
      fakeChance: rnd() < 0.18, fake: false, shouts: 0, spd: 0, strafe: false, path: null, pi: 0, react: 0, cool: 0, burst: 3, lost: 0, tA: 0, tS: 0, hold: false, tgt: 0, lk: null, armed: true, flagged: false });
    spots.slice(0, NS).forEach((s, i) => mk(s, i, true));
    // the high-value target and his two bodyguards: fixed posts, hard to talk down
    if (M.hvt) { mk(M.hvt.at, NS, false); M.hvt.guards.forEach((g, k) => mk(g, NS + 1 + k, false)); const [b, g1, g2] = this.npcs.slice(-3); b.hvt = true; b.v = 4; b.resolve = 0.96; b.fakeChance = false; for (const g of [g1, g2]) { g.guard = true; g.resolve = 0.85 + rnd() * 0.12; } }
    const pads = M.pads ? pick(M.pads.map((p, i) => i), M.pads.length) : [], padCivs = (C.padCivs || 0);
    pick(M.spots.c, C.c - padCivs).concat(pads.slice(C.b, C.b + padCivs).map(i => [M.pads[i].f, ...M.pads[i].hostage])).forEach(([f, x, z], i) => this.npcs.push({ id: 101 + i, kind: 'c', v: Math.floor(rnd() * 4), x, z, y: f * H, yaw: rnd() * 6.28, hp: 100, st: 'w', stubborn: rnd() < 0.25, flagged: false }));
    // Most suspects will turn on a hostage once a firefight has gone on for a few rounds. Drawn from their own stream so the rest of the layout per seed is unchanged.
    { const rr = rng32(this.seed ^ 0x51ed27); for (const n of this.npcs) if (n.kind === 's') { n.ruthless = rr() < 0.75; n.fired = 0; n.execAfter = 3 + Math.floor(rr() * 5); n.exec = null; } }
    // about half the suspects defend the room they are in: they take cover there when they hear trouble and wait for you to come through the door
    { const rd = rng32(this.seed ^ 0x2d0f3a); for (const n of this.npcs) if (n.kind === 's') { n.defend = n.hvt || n.guard || rd() < 0.55; if (n.defend) n.patrol = null; } }
    this.doorOpen = this.level.doors.map(d => !d.exterior && rnd() < 0.3);
    this.gren = []; this.smokes = [];
    this.doorLocked = this.level.doors.map((d, i) => d.pad !== undefined ? true : d.hidden ? false : d.exterior ? rnd() < 0.6 : !this.doorOpen[i] && rnd() < 0.3);   // containers are all padlocked
    // tripwires: a few closed inside doors are rigged; 1 or 2 = which side the wire is on
    this.doorTrap = this.level.doors.map(() => 0); pick(this.level.doors.filter((d, i) => !d.exterior && !this.doorOpen[i]).map(d => d.id), 3).forEach(i => { this.doorTrap[i] = rnd() < 0.5 ? 1 : 2; });
    const bombAt = M.pads ? pads.slice(0, C.b).map(i => [M.pads[i].f, ...M.pads[i].bomb, 0.85]) : M.bombMust ? [M.bombMust, ...pick(M.spots.b, C.b - 1)] : pick(M.spots.b, C.b);
    this.bombs = bombAt.map(([f, x, z, h]) => {
      const wires = pick([0, 1, 2, 3], 4), order = pick([0, 1, 2, 3], 2);
      const [bx, bz, yaw] = this.edgeSpot(x, z, f * H + h, f * H);
      return { x: bx, z: bz, y: f * H + h, yaw, wires, order, n: 0, cut: [false, false, false, false], defused: false };
    });
    if (M.training) this.setupTraining();
    for (const p of this.players.values()) { p.entered = false; p.hp = 100; p.down = false; p.y = 0; p.lastShot = -9; p.lastShout = -9; p.w = 0; p.med = false; p.fl = 2; p.sm = 1; p.spawn = null; p.hold = 0; }
    // PvP: as soon as one player has picked the terrorist side. Terrorist players start inside, at suspect posts far from the squad's way in.
    const tangos = [...this.players.values()].filter(p => p.team === 'tango'); this.pvp = !M.training && tangos.length > 0;
    if (this.pvp) {
      const [sx, sz] = M.spawn[0], used = new Set(this.npcs.map(n => n.kind === 's' ? n.post[0] + ',' + n.post[1] : ''));
      const posts = M.spots.s.filter(([, x, z]) => !used.has(x + ',' + z)).map(([f, x, z]) => [Math.hypot(x - sx, z - sz), f, x, z]).sort((a, b) => b[0] - a[0]);
      tangos.forEach((p, i) => { const [, f, x, z] = posts[(i * 3) % Math.max(1, posts.length)] || [0, 0, ...M.spawn[0]]; p.spawn = [x, f * M.H, z]; p.hx = x; p.hz = z; p.y = f * M.H; p.hy = p.y + 1.65; });
    }
  }
  start(seed, night = false, wx = this.wxPick, map = this.mapId, tod) { this.night = !!night; if (tod === 'random' || tod === 'day' || tod === 'night') this.todPick = tod; if (map !== this.mapId && MAPS[map]) this.setMap(map);   // every mission starts with the power on; night falls when someone throws the breaker
    this.wxPick = wx === 'random' || WEATHER.includes(wx) ? wx : this.wxPick; this.reset(seed); this.phase = 'active'; this.ev({ e: 'start' }); }
  ev(o) { this.events.push(o); }
  addPlayer(id, name) {
    const used = new Set([...this.players.values()].map(p => p.slot)); let slot = 0; while (used.has(slot)) slot++;
    const [x, z] = this.M.spawn[slot % 4];
    const p = { id, name: String(name || 'Officer').slice(0, 14), slot, hp: 100, down: false, hx: x, hy: 1.65, hz: z, y: 0, h: [x, 1.65, z, 0, 0, 0, 1], l: null, r: null, g: [0, 0], lastShot: -9, lastShout: -9, lastKick: -9, lastBrk: -9, has: false, w: 0, med: false, fl: 2, sm: 1, team: 'swat' };
    if (this.M.training) p.tr = { hits: 0, shots: 0, ns: 0 };
    this.players.set(id, p); return p;
  }
  removePlayer(id) { this.players.delete(id); }
  init() {
    return { seed: this.seed, map: this.mapId, night: this.night, weather: this.weather, tod: this.tod, rt: this.raceT, pvp: !!this.pvp, ph: this.phase, sp: Object.fromEntries([...this.players.values()].filter(p => p.spawn).map(p => [p.id, p.spawn])), npcs: this.npcs.map(n => [n.id, n.kind, n.v, n.hvt ? 1 : 0]), bombs: this.bombs.map(b => [b.x, b.y, b.z, b.wires, b.order, b.yaw]), time: this.M.time };
  }
  pose(id, m) {
    const p = this.players.get(id); if (!p || !Array.isArray(m.h) || m.h.length < 7 || !m.h.every(Number.isFinite)) return;
    p.h = m.h; p.l = m.l || null; p.r = m.r || null; p.g = m.g || [0, 0]; p.hx = m.h[0]; p.hy = m.h[1]; p.hz = m.h[2]; p.has = true; p.light = !!m.f;
    p.y = this.level.groundY(p.hx, p.hz, p.hy - 1.0);
  }
  near(p, x, y, z, d) { return Math.hypot(p.hx - x, p.hz - z) < d && Math.abs(p.y - y) < 1.8; }
  clear(ax, ay, az, bx, by, bz, solidGlass = false) { const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz); if (d < 0.05) return true; return rayStatic(this.level, this.doorOpen, ax, ay, az, dx / d, dy / d, dz / d, d, solidGlass) >= d - 0.02; }
  eyeY(n) { return n.y + (KNEEL[n.st] || n.crouch ? 1.0 : 1.58); }

  // ---- player actions ----
  shot(id, m) {
    const p = this.players.get(id); if (!p || p.down || this.phase !== 'active' || !Array.isArray(m.o) || !Array.isArray(m.d)) return;
    const w = m.w === 'pistol' ? 'pistol' : 'rifle'; if (this.t - p.lastShot < 0.06) return; p.lastShot = this.t;
    let [ox, oy, oz] = m.o, [dx, dy, dz] = m.d; const dl = Math.hypot(dx, dy, dz); if (!(dl > 0) || !this.near(p, ox, p.y, oz, 1.6)) return; dx /= dl; dy /= dl; dz /= dl;
    let best = rayStatic(this.level, this.doorOpen, ox, oy, oz, dx, dy, dz, 80), kind = 'w', tn = null, part = null, tp = null;
    let tg = null; if (this.targets) { if (p.tr) p.tr.shots++; for (const t of this.targets) { if (!t.up) continue; const h = this.rayTarget(t, ox, oy, oz, dx, dy, dz, best); if (h >= 0 && h < best) { best = h; kind = 't'; tg = t; } } }
    if (p.hold && w === 'rifle') return;   // one hand on the hostage: pistol only
    for (const n of this.npcs) { if (n.st === 'd' || n.held === id) continue; for (const [sx, sy, sz, sr, pt] of this.spheres(n)) { const t = raySphere(ox, oy, oz, dx, dy, dz, sx, sy, sz, sr); if (t >= 0 && t < best) { best = t; kind = 'n'; tn = n; part = pt; } } }
    let pp = 'torso'; for (const q of this.players.values()) { if (q === p || q.down || !q.has) continue; for (const [oy2, sr, pt] of [[0, 0.14, 'head'], [-0.32, 0.21, 'torso'], [-0.62, 0.2, 'legL']]) { const t = raySphere(ox, oy, oz, dx, dy, dz, q.hx, q.hy + oy2, q.hz, sr); if (t >= 0 && t < best) { best = t; kind = 'p'; tp = q; tn = null; pp = pt; } } }
    this.ev({ e: 'ps', p: id, w, o: [r2(ox), r2(oy), r2(oz)], h: [r2(ox + dx * best), r2(oy + dy * best), r2(oz + dz * best)], k: kind });
    if (kind === 't') { const ns = !tg.hostile; if (p.tr) { if (ns) p.tr.ns++; else p.tr.hits++; } if (ns && tg.kind === 'house') this.house.ns++; tg.hit = true; if (tg.kind !== 'move') { tg.up = 0; tg.tt = tg.kind === 'static' ? 1.2 : 1 + this.rnd() * 2; } this.ev({ e: 'th', t: tg.i, ns, p: id }); return; }
    const tango = p.team === 'tango';
    if (!this.M.training && !tango) this.noise(ox, oz, 45, p);
    if (kind === 'n') { if (tango && tn.kind === 's') return; if (tango) { tn.hp -= DMG[w][part]; if (tn.hp <= 0) { tn.st = 'd'; this.log.civExecuted = (this.log.civExecuted || 0) + 1; } this.ev({ e: 'hit', n: tn.id, dead: tn.hp <= 0 }); return; } this.hitNpc(tn, DMG[w][part], p, part); }
    else if (kind === 'p' && !this.M.training) { if (tp.team !== p.team) { if (tp.hold) this.drop(tp, 'shot'); } if (tp.team !== p.team) this.hurt(tp, DMG[w][pp === 'legL' ? (this.rnd() < 0.5 ? 'legL' : 'legR') : pp] * 0.75, pp === 'legL' ? 'legL' : pp); else { this.log.ff++; this.hurt(tp, DMG[w].torso * 0.6); } }
  }
  spheres(n) { if (n.st === 'i' || n.st === 'j') return [[n.x, n.y + 0.2, n.z, 0.28, 'torso']]; const k = KNEEL[n.st] || n.crouch ? 0.62 : n.st === 'x' ? 0.93 : 1; return [[n.x, n.y + 1.62 * k, n.z, 0.13, 'head'], [n.x, n.y + 1.32 * k, n.z, 0.2, 'torso'], [n.x, n.y + 1.02 * k, n.z, 0.2, 'torso'], [n.x, n.y + 0.55 * k, n.z, 0.18, 'legs']]; }
  hitNpc(n, dmg, p, part) {
    n.hp -= dmg; const dead = n.hp <= 0;
    if (n.kind === 'c') { if (!n.flagged) { n.flagged = true; this.log.civHit++; } if (dead) { n.st = 'd'; this.log.civKilled++; } this.ev({ e: 'hit', n: n.id, dead }); return; }
    const justified = n.st === 'c', wasDown = n.st === 'i' || n.st === 'j';
    if (!justified && !n.flagged) { n.flagged = true; if (n.st === 's' || n.st === 'k' || n.st === 'u' || wasDown) this.log.execution++; else this.log.unauth++; }
    if (wasDown) { n.st = 'd'; n.just = false; }
    else if (dead) { n.cov = null; n.crouch = false; n.stun = 0; n.st = part === 'head' || this.rnd() < 0.25 ? 'd' : 'i'; n.just = justified; n.armed = false; n.path = null; }   // most body hits incapacitate: the suspect can still be arrested
    else if (n.st === 'g' || n.st === 'a') this.engage(n, p, 0.3);
    else if (n.st === 'c' && n.hp < 60 && this.rnd() < 0.35) this.surrender(n);
    if (n.exec && n.st === 'c' && this.rnd() < 0.5) n.exec = null;   // a wounded suspect may lose his nerve
    this.ev({ e: 'hit', n: n.id, dead });
  }
  hurt(p, dmg, part = 'torso') { if (p.down) return; p.hp -= dmg; p.w |= 1 << PARTS.indexOf(part); this.ev({ e: 'hurt', p: p.id, part }); if (p.hp <= 0) { p.hp = 0; p.down = true; this.log.downs++; this.ev({ e: 'down', p: p.id }); } }
  noise(x, z, radius, src) {
    radius *= HEAR[this.weather];
    for (const n of this.npcs) if (n.kind === 's' && n.st === 'g' && Math.hypot(n.x - x, n.z - z) < radius) {
      n.st = 'a'; n.tA = 0; n.lk = [src.hx, src.hz, src.y]; n.hold = this.rnd() < 0.45; n.path = null;
      if (n.defend) { n.hold = true; n.ambush = true; }
    }
  }
  shout(id) {
    const p = this.players.get(id); if (!p || p.down || this.phase !== 'active' || this.t - p.lastShout < 1.0) return; p.lastShout = this.t;
    this.ev({ e: 'shout', p: id }); if (p.team === 'tango') return;
    for (const n of this.npcs) {
      if (Math.hypot(n.x - p.hx, n.z - p.hz) > 12 || !this.clear(p.hx, p.hy, p.hz, n.x, this.eyeY(n), n.z)) continue;
      if (n.kind === 'c') { if (n.st === 'w') { if (n.stubborn) { n.stubborn = false; this.ev({ e: 'say', n: n.id, k: 'plead' }); } else { n.st = 'y'; this.ev({ e: 'say', n: n.id, k: 'comply' }); } } continue; }
      if (n.st !== 'g' && n.st !== 'a' && n.st !== 'c') continue;
      n.shouts++;
      let pr = (n.hvt ? 0.45 : 1) * ((1 - n.resolve) * (n.st === 'g' ? 1.3 : n.st === 'c' ? 0.6 : 1) * (n.hp < 60 ? 1.6 : 1) + 0.1 * (n.shouts - 1)) * (n.stun > 0 ? 2.5 : 1);   // a stunned suspect gives up far more readily
      if (this.rnd() < pr) this.surrender(n);
      else if (!(n.stun > 0)) { this.ev({ e: 'say', n: n.id, k: 'defy' }); if (n.st !== 'c') this.engage(n, p, 0.5 + this.rnd() * 0.4); }
    }
  }
  surrender(n) { n.exec = null; n.cov = null; n.crouch = false; n.stun = 0; n.st = 's'; n.tS = 0; n.path = null; n.armed = false; n.fake = n.fakeChance; n.fakeChance = false; n.fakeAt = 3.5 + this.rnd() * 4; this.ev({ e: 'say', n: n.id, k: 'surrender' }); }
  engage(n, p, react) { if ((n.hvt || n.guard) && !n.rally) { n.rally = true; for (const q of this.npcs) if ((q.hvt || q.guard) && q !== n && (q.st === 'g' || q.st === 'a')) this.engage(q, p, react + 0.3); n.rally = false; }   // the boss and his guards fight together
    n.wantCover = !n.cov && (this.rnd() < 0.85 || n.defend); n.crouch = false; n.st = 'c'; n.react = react; n.cool = 0; n.burst = 2 + Math.floor(this.rnd() * 3); n.tgt = p.id; n.lost = 0; n.path = null; n.lk = [p.hx, p.hz, p.y]; }
  cuff(id, nid) {
    const p = this.players.get(id), n = this.npcs.find(q => q.id === nid); if (!p || p.down || !n || this.phase !== 'active' || p.team === 'tango' || n.held) return;
    if ((n.st === 's' || n.st === 'k' || n.st === 'y' || n.st === 'i') && this.near(p, n.x, n.y, n.z, 1.9)) { n.st = n.st === 'i' ? 'j' : 'u'; n.fake = false; this.ev({ e: 'cuff', n: n.id, p: id }); }
  }
  heal(id) { const p = this.players.get(id); if (!p || p.down || p.med || this.phase !== 'active') return; p.med = true; p.hp = Math.min(100, p.hp + 60); p.w = 0; this.ev({ e: 'heal', p: id }); }   // one med kit per officer per mission
  revive(id, tid) { const p = this.players.get(id), q = this.players.get(tid); if (p && q && !p.down && q.down && p.team === q.team && this.near(p, q.hx, q.y, q.hz, 1.8)) { q.down = false; q.hp = 40; this.ev({ e: 'revive', p: tid }); } }
  door(id, did) {
    const p = this.players.get(id), d = this.level.doors[did]; if (!p || p.down || !d || !this.near(p, d.cx, d.y, d.cz, 2.2)) return;
    if (!this.doorOpen[did] && this.doorLocked[did]) return this.ev({ e: 'locked', d: did });
    if (!this.doorOpen[did] && this.doorTrap[did]) this.trip(did, p);
    this.doorOpen[did] = !this.doorOpen[did]; this.ev({ e: 'door', d: did, open: this.doorOpen[did] });
  }
  // Throwing the main breaker kills every light in the house. One suspect may come down to switch it back on.
  breaker(id) {
    const B = this.M.breaker, by = Math.floor(B.y / this.M.H) * this.M.H;
    const p = this.players.get(id); if (!p || p.down || this.phase !== 'active' || this.t - p.lastBrk < 1 || !this.near(p, B.x, by, B.z, 2)) return;
    p.lastBrk = this.t; this.night = !this.night; this.ev({ e: 'power', on: !this.night });
    if (this.night && this.rnd() < 0.7) { let best = null, bd = 1e9; for (const n of this.npcs) if (n.kind === 's' && n.st === 'g') { const d = Math.hypot(n.x - B.x, n.z - B.z) + Math.abs(n.y - by) * 3; if (d < bd) { bd = d; best = n; } }
      if (best) { best.st = 'a'; best.tA = 0; best.hold = false; best.path = null; best.fix = true; best.fixT = 0; best.lk = [B.x, B.z + 0.7, by]; } }
  }
  // A rigged door goes off when it is opened: hurts anyone close and wakes the house. Cut the wire first (cutters).
  trip(did, p) {
    const d = this.level.doors[did]; this.doorTrap[did] = 0; this.ev({ e: 'trap', d: did });
    if (!this.M.training) for (const q of this.players.values()) if (!q.down && this.near(q, d.cx, d.y, d.cz, 3.5)) this.hurt(q, 28 + this.rnd() * 18, this.rnd() < 0.5 ? 'legL' : this.rnd() < 0.5 ? 'legR' : 'torso');
    if (this.phase === 'active') this.noise(d.cx, d.cz, 38, p);
  }
  disarm(id, did) {
    const p = this.players.get(id), d = this.level.doors[did]; if (!p || p.down || !d || !this.doorTrap[did] || !this.near(p, d.cx, d.y, d.cz, 2.2)) return;
    this.doorTrap[did] = 0; this.ev({ e: 'disarm', d: did });
  }
  // ---- grenades ----
  throw(id, m) {
    const p = this.players.get(id), k = m.k === 'smoke' ? 'smoke' : 'flash'; if (!p || p.down || this.phase !== 'active' || !Array.isArray(m.o) || !Array.isArray(m.v) || ![...m.o, ...m.v].every(Number.isFinite) || !this.near(p, m.o[0], p.y, m.o[2], 1.8)) return;
    if (k === 'flash' ? p.fl <= 0 : p.sm <= 0) return; if (k === 'flash') p.fl--; else p.sm--;
    let [vx, vy, vz] = m.v; const sp = Math.hypot(vx, vy, vz), cap = 15; if (sp > cap) { vx *= cap / sp; vy *= cap / sp; vz *= cap / sp; }
    this.gren.push({ k, x: m.o[0], y: m.o[1], z: m.o[2], vx, vy, vz, t: 0, fuse: k === 'flash' ? 1.7 : 1.3, by: id }); this.ev({ e: 'throw', p: id, k });
  }
  tickGrenades(dt) {
    for (const g of this.gren) {
      g.t += dt; g.vy -= 9.8 * dt; const sp = Math.hypot(g.vx, g.vy, g.vz), n = Math.max(1, Math.ceil(sp * dt / 0.08)), h = dt / n;
      for (let i = 0; i < n; i++) {   // small steps, one axis at a time, so it bounces off whatever it meets
        if (solidAt(this.level, this.doorOpen, g.x + g.vx * h, g.y, g.z)) { g.vx *= -0.35; g.vz *= 0.8; } else g.x += g.vx * h;
        if (solidAt(this.level, this.doorOpen, g.x, g.y, g.z + g.vz * h)) { g.vz *= -0.35; g.vx *= 0.8; } else g.z += g.vz * h;
        if (solidAt(this.level, this.doorOpen, g.x, g.y + g.vy * h, g.z)) { if (g.vy < -1.5) this.ev({ e: 'clink', x: r2(g.x), y: r2(g.y), z: r2(g.z) }); g.vy *= -0.3; g.vx *= 0.6; g.vz *= 0.6; if (Math.abs(g.vy) < 0.6) g.vy = 0; } else g.y += g.vy * h;
      }
      if (g.t >= g.fuse) { g.done = true; if (g.k === 'flash') this.flash(g); else { this.smokes.push({ x: g.x, y: g.y, z: g.z, t: 0 }); this.ev({ e: 'smoke', x: r2(g.x), y: r2(g.y), z: r2(g.z) }); } }
    }
    this.gren = this.gren.filter(g => !g.done); for (const s of this.smokes) s.t += dt; this.smokes = this.smokes.filter(s => s.t < 20);
  }
  flash(g) {
    this.ev({ e: 'flash', x: r2(g.x), y: r2(g.y), z: r2(g.z) }); const by = this.players.get(g.by);
    for (const n of this.npcs) {
      if (n.kind !== 's' || !(n.st === 'g' || n.st === 'a' || n.st === 'c')) continue; const d = Math.hypot(n.x - g.x, n.y + 1.2 - g.y, n.z - g.z);
      if (d > 8 || !this.clear(g.x, g.y + 0.15, g.z, n.x, this.eyeY(n), n.z)) continue;
      n.stun = d < 4 ? 6 : 4.5; n.exec = null; n.cov = null; n.crouch = false; n.strafe = false; n.path = null; n.spd = 0; n.wantCover = false; n.st = 'a'; n.tA = 0; n.hold = true; n.fix = false; n.lk = [g.x, g.z, n.y];   // blind and deaf: no longer a threat until it wears off
    }
    for (const q of this.players.values()) if (q.hold && Math.hypot(q.hx - g.x, q.hy - g.y, q.hz - g.z) < 8 && this.clear(g.x, g.y + 0.15, g.z, q.hx, q.hy, q.hz)) this.drop(q, 'flash');
    if (by) this.noise(g.x, g.z, 30, by);
  }
  inSmoke(ax, ay, az, bx, by, bz) {   // does the sight line pass through a smoke cloud?
    for (const s of this.smokes) { const r = Math.min(3.4, 0.8 + s.t * 1.6) * (s.t > 16 ? (20 - s.t) / 4 : 1), dx = bx - ax, dy = by - ay, dz = bz - az, L2 = dx * dx + dy * dy + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((s.x - ax) * dx + (s.y + 1 - ay) * dy + (s.z - az) * dz) / L2)), px = ax + dx * t - s.x, py = ay + dy * t - s.y - 1, pz = az + dz * t - s.z; if (px * px + py * py * 0.5 + pz * pz < r * r) return true; }
    return false;
  }
  // ---- cover ----
  // Look nearby for somewhere a crouched body is hidden from this officer: behind furniture (stand up to shoot) or round a corner (step out to shoot).
  findCover(n, p, leash = n.defend ? (Math.hypot(n.x - n.post[0], n.z - n.post[1]) < 6 && Math.abs(n.y - n.post[2]) < 0.5 ? n.post : [n.x, n.z, n.y]) : null) {   // leash: a defender only uses cover in his own room, near his post
    const L = this.level, { NX, NZ, YARD } = L, N = NX * NZ, li = L.layerOf(n.x, n.z, n.y), ci = Math.floor((n.x - YARD.x0) / U), cj = Math.floor((n.z - YARD.z0) / U); let best = null, bs = 1e9;
    const ok = (i, j) => { if (i < 0 || j < 0 || i >= NX || j >= NZ) return NaN; const id = li * N + j * NX + i; return L.walk[id] && Math.abs(L.cy[id] - n.y) < 0.3 ? L.cy[id] : NaN; };
    for (let dj = -11; dj <= 11; dj++) for (let di = -11; di <= 11; di++) {
      const i = ci + di, j = cj + dj, y = ok(i, j); if (Number.isNaN(y)) continue; const x = YARD.x0 + (i + 0.5) * U, z = YARD.z0 + (j + 0.5) * U; if (L.onStairs(x, z)) continue;
      const d = Math.hypot(x - n.x, z - n.z), dp = Math.hypot(x - p.hx, z - p.hz); if (d > 5.5 || dp < 3.5) continue;
      if (leash) { const dl = Math.hypot(x - leash[0], z - leash[1]); if (dl > 5 || Math.abs(y - leash[2]) > 0.5 || (dl > 2.5 && !this.clear(x, y + 1.2, z, leash[0], leash[2] + 1.2, leash[1]))) continue; }
      if (this.clear(x, y + 0.5, z, p.hx, p.hy, p.hz) || this.clear(x, y + 0.9, z, p.hx, p.hy, p.hz)) continue;
      let fx = x, fz = z; const low = this.clear(x, y + 1.5, z, p.hx, p.hy, p.hz);
      if (!low) { let found = false; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) { if (Number.isNaN(ok(i + a, j + b)) || Number.isNaN(ok(i + Math.sign(a), j + Math.sign(b)))) continue; const x2 = x + a * U, z2 = z + b * U; if (this.clear(x2, y + 1.5, z2, p.hx, p.hy, p.hz)) { fx = x2; fz = z2; found = true; break; } } if (!found) continue; }
      const score = d + (low ? 0 : 1.2) + Math.abs(dp - 8) * 0.12; if (score < bs) { bs = score; best = { hx: x, hz: z, fx, fz, low, phase: 'go', t: 0, age: 0, shots: 0, seenT: 0 }; }
    }
    return best;
  }
  tickCover(n, dt, seen, dist) {
    const C = n.cov, p = this.players.get(n.tgt); if (!p || p.down) { n.cov = null; n.crouch = false; return; }
    if (seen) { n.lk = [seen.hx, seen.hz, seen.y]; n.lost = 0; n.tgt = seen.id; C.seenT += dt; } else { n.lost += dt; C.seenT = 0; }
    C.age += dt; n.react -= dt;
    if (C.phase === 'go') { n.crouch = false; if (!this.walk(n, dt, 3.1)) { C.phase = 'hide'; C.t = 0.5 + this.rnd() * 1.2; C.age = 0; } }
    else if (C.phase === 'hide') {
      n.crouch = C.low; this.face(n, n.lk[0], n.lk[1], dt, 6); C.t -= dt;
      if (C.seenT > 0.7 || (C.age > 5 && this.clear(n.x, n.y + 0.5, n.z, p.hx, p.hy, p.hz))) { const nc = this.findCover(n, p); n.crouch = false; if (nc && this.goto(n, nc.hx, nc.hz, n.y)) n.cov = nc; else { n.cov = null; } return; }   // flanked: move or fight in the open
      if (C.t <= 0) { C.phase = 'peek'; C.shots = 2 + Math.floor(this.rnd() * 3); C.t = 2.6; n.cool = 0.25; if (!C.low) { n.path = [[n.x, n.z, 0], [C.fx, C.fz, 0]]; n.pi = 1; } }
    } else if (C.phase === 'peek') {
      n.crouch = false; this.face(n, n.lk[0], n.lk[1], dt, 8); if (n.path) { this.walk(n, dt, 2.2, true); return; }
      C.t -= dt; if (seen && n.react <= 0) { n.cool -= dt; if (n.cool <= 0) { this.npcFire(n, seen, dist); C.shots--; n.cool = 0.17; } }
      if (C.shots <= 0 || C.t <= 0) { C.phase = C.low ? 'hide' : 'back'; C.t = 0.9 + this.rnd() * 1.6; C.age = 0; if (!C.low) { n.path = [[n.x, n.z, 0], [C.hx, C.hz, 0]]; n.pi = 1; } }
    } else { this.face(n, n.lk[0], n.lk[1], dt, 8); if (!this.walk(n, dt, 2.4, true)) { C.phase = 'hide'; } }
    if (n.lost > 14) { n.cov = null; n.crouch = false; n.st = 'a'; n.tA = 0; n.hold = true; n.path = null; }
  }
  pick(id, did) {   // quiet: the client sends this after the lock has been worked for a few seconds
    const p = this.players.get(id), d = this.level.doors[did]; if (!p || p.down || !d || !this.near(p, d.cx, d.y, d.cz, 2.2) || !this.doorLocked[did] || d.pad !== undefined) return;
    this.doorLocked[did] = false; this.ev({ e: 'unlock', d: did });
  }
  snip(id, did) {   // bolt cutters through a container's padlock
    const p = this.players.get(id), d = this.level.doors[did]; if (!p || p.down || !d || d.pad === undefined || !this.doorLocked[did] || !this.near(p, d.cx, d.y, d.cz, 2.2)) return;
    this.doorLocked[did] = false; this.ev({ e: 'unlock', d: did, k: 'cut' }); if (this.phase === 'active') this.noise(d.cx, d.cz, 6, p);
  }
  kick(id, did) {   // loud: opens an unlocked door, has a chance to break a locked one
    const p = this.players.get(id), d = this.level.doors[did]; if (!p || p.down || !d || this.doorOpen[did] || !this.near(p, d.cx, d.y, d.cz, 2.2) || this.t - p.lastKick < 0.7) return;
    p.lastKick = this.t; const ok = !this.doorLocked[did] || (d.pad === undefined && this.rnd() < 0.55);   // a padlocked container door does not give
    if (ok) { if (this.doorTrap[did]) this.trip(did, p); this.doorLocked[did] = false; this.doorOpen[did] = true; }
    this.ev({ e: 'kick', d: did, ok }); if (this.phase === 'active') this.noise(d.cx, d.cz, 16, p);
  }
  cut(id, bi, wi) {
    const p = this.players.get(id), b = this.bombs[bi]; if (!p || p.down || p.team === 'tango' || !b || b.defused || b.failed || this.phase !== 'active' || !(wi >= 0 && wi < 4) || b.cut[wi] || !this.near(p, b.x, b.y - 0.8, b.z, 2)) return;
    b.cut[wi] = true; const ok = wi === b.order[b.n];
    if (ok) { b.n++; if (b.n >= b.order.length) b.defused = true; } else if (this.M.training) b.failed = true; else { this.timer = Math.max(5, this.timer - 45); this.log.wrongWire++; }
    this.ev({ e: 'cut', b: bi, w: wi, ok, defused: b.defused });
  }


  // ---- training facility: targets, kill-house runs, practice doors and a dummy bomb that re-arm themselves; nobody gets hurt ----
  setupTraining() {
    const M = this.M, D = M.doorsOf, rnd = this.rnd;
    this.doorOpen = this.level.doors.map(() => false); this.doorLocked = this.level.doors.map((d, i) => i === D.pick || i === D.kick); this.doorTrap = this.level.doors.map((d, i) => i === D.trap ? 1 : 0);
    this.targets = M.targets.map((t, i) => ({ ...t, i, up: t.kind === 'static' || t.kind === 'move' ? 1 : 0, tt: 1 + rnd() * 3, hostile: true, hit: false }));
    this.house = { on: false, t: 0, best: this.house ? this.house.best : 0, last: this.house ? this.house.last : 0, rooms: [], ns: 0, away: 0 };
    this.rearm = {}; this.nextMap = this.nextMap && MISSION_IDS.includes(this.nextMap) ? this.nextMap : MISSION_IDS[0];
    this.phase = 'active'; this.timer = 0; for (const p of this.players.values()) p.tr = { hits: 0, shots: 0, ns: 0 };
  }
  tickTraining(dt) {
    const rnd = this.rnd, H = this.house, D = this.M.doorsOf, ps = [...this.players.values()].filter(p => p.has);
    for (const t of this.targets) {
      if (t.kind === 'pop') { if ((t.tt -= dt) <= 0) { t.up = t.up ? 0 : 1; t.tt = t.up ? 2.2 + rnd() * 1.8 : 1 + rnd() * 2.5; } }
      else if (t.kind === 'move') { t.x += t.v * dt; if (t.x > t.x1 || t.x < t.x0) { t.v = -t.v; t.x = Math.max(t.x0, Math.min(t.x1, t.x)); } if (!t.up && (t.tt -= dt) <= 0) t.up = 1; }
      else if (t.kind === 'static' && !t.up && (t.tt -= dt) <= 0) t.up = 1;
    }
    // kill house: each room's two cut-outs stand up when the first officer steps in; the run ends when every armed one is down
    const roomOf = p => this.M.houseRooms.findIndex(([x0, z0, x1, z1]) => p.hx > x0 && p.hx < x1 && p.hz > z0 && p.hz < z1), inHouse = ps.map(roomOf).filter(k => k >= 0);
    if (inHouse.length) {
      H.away = 0; if (!H.on) { H.on = true; H.t = 0; H.rooms = []; H.ns = 0; for (const t of this.targets) if (t.kind === 'house') { t.up = 0; t.hit = false; } }
      for (const k of inHouse) if (!H.rooms.includes(k)) { H.rooms.push(k); const ts = this.targets.filter(t => t.kind === 'house' && t.room === k), arm = rnd() < 0.25 ? -1 : Math.floor(rnd() * ts.length); ts.forEach((t, n) => { t.up = 1; t.hit = false; t.hostile = arm < 0 || n === arm; }); }
    } else if (H.on && (H.away += dt) > 3) { H.on = false; for (const t of this.targets) if (t.kind === 'house') t.up = 0; }
    if (H.on) { H.t += dt; const hs = this.targets.filter(t => t.kind === 'house');
      if (H.rooms.length === this.M.houseRooms.length && hs.every(t => !t.hostile || t.hit)) { const time = Math.round((H.t + H.ns * 5) * 10) / 10; H.last = time; if (!H.best || time < H.best) H.best = time; H.on = false; this.ev({ e: 'house', time, best: H.best, ns: H.ns }); for (const t of hs) t.up = 0; } }
    // practice doors lock again and the trip wire is re-rigged once they have been shut for a few seconds; the dummy bomb re-arms
    for (const [k, lock] of [[D.pick, true], [D.kick, true], [D.trap, false]]) { if (this.doorOpen[k]) { this.rearm[k] = 0; continue; } this.rearm[k] = (this.rearm[k] || 0) + dt; if (this.rearm[k] > 4) { if (lock) this.doorLocked[k] = true; else this.doorTrap[k] = 1; } }
    for (const b of this.bombs) if (b.defused || b.failed) { b.wait = (b.wait || 0) + dt; if (b.wait > 5) { Object.assign(b, { wires: [0, 1, 2, 3].sort(() => rnd() - 0.5), order: [0, 1, 2, 3].sort(() => rnd() - 0.5).slice(0, 2), n: 0, cut: [false, false, false, false], defused: false, failed: false, wait: 0 }); this.ev({ e: 'bombreset', b: this.bombs.indexOf(b), wires: b.wires, order: b.order }); } }
  }
  // a ray against a cut-out: a thin board turned to face its own way
  rayTarget(t, ox, oy, oz, dx, dy, dz, max) {
    const f = t.face || 0, c = Math.cos(-f), sn = Math.sin(-f), lx = ox - t.x, lz = oz - t.z, px = lx * c + lz * sn, pz = -lx * sn + lz * c, qx = dx * c + dz * sn, qz = -dx * sn + dz * c;
    if (Math.abs(qz) < 1e-6) return -1; const tt = -pz / qz; if (tt < 0 || tt > max) return -1;
    const hx = px + qx * tt, hy = oy + dy * tt; return Math.abs(hx) <= t.w / 2 && hy >= t.y && hy <= t.y + t.h ? tt : -1;
  }

  // the race keeps running: anyone standing on the tarmac when a car comes through is knocked down
  tickRace() {
    const cars = carsAt(this.raceT, this._cars || (this._cars = []));
    for (const p of this.players.values()) {
      if (!p.has || p.down || !onTrack(p.hx, p.hz)) continue;
      for (const [x, z, v] of cars) if (Math.abs(p.hx - x) < 2.9 && Math.abs(p.hz - z) < 1.15) { this.hurt(p, 200, 'torso'); this.ev({ e: 'carhit', p: p.id, x, z, v }); this.log.carHits = (this.log.carHits || 0) + 1; break; }
    }
    for (const n of this.npcs) {
      if (n.st === 'd' || !onTrack(n.x, n.z)) continue;
      for (const [x, z] of cars) if (Math.abs(n.x - x) < 2.9 && Math.abs(n.z - z) < 1.15) { n.hp = 0; n.st = 'd'; this.ev({ e: 'carhit', n: n.id, x, z }); break; }
    }
  }
  // ---- simulation ----
  sees(n, p, d) {
    const lit = this.night && p.light;                 // in the dark a flashlight gives you away at any range, even through glass
    if (d > Math.max(3.5, (this.night && !lit ? 7 : 22) * SIGHT[this.weather])) return false;
    if (d > 2.5) { const a = Math.atan2(p.hx - n.x, p.hz - n.z); if (Math.abs(angDiff(a, n.yaw)) > 1.05) return false; }
    if (this.smokes.length && this.inSmoke(n.x, this.eyeY(n), n.z, p.hx, p.hy, p.hz)) return false;
    return this.clear(n.x, this.eyeY(n), n.z, p.hx, p.hy, p.hz, d > 8 && !lit);   // a lit room's glass only shows what is close
  }
  face(n, x, z, dt, rate) { const a = Math.atan2(x - n.x, z - n.z), d = angDiff(a, n.yaw), s = rate * dt; n.yaw += Math.abs(d) < s ? d : Math.sign(d) * s; }
  goto(n, x, z, y) { n.path = findPath(this.level, n.x, n.z, n.y, x, z, y); n.pi = 1; return !!n.path; }
  // Follow the path with momentum: speed builds and bleeds off, and the body turns before it commits to a new direction.
  walk(n, dt, speed, keepFacing = false) {
    if (!n.path || n.pi >= n.path.length) { n.path = null; n.spd = 0; return false; }
    const [tx, tz] = n.path[n.pi], dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz), last = n.pi === n.path.length - 1;
    let want = speed;
    if (!keepFacing) { const off = Math.abs(angDiff(Math.atan2(dx, dz), n.yaw)); this.face(n, tx, tz, dt, 5.5); if (off > 1.2) want *= 0.15; else if (off > 0.5) want *= 0.55; }
    if (last) want = Math.min(want, 0.6 + d * 2.2);                       // ease to a stop at the end
    n.spd += Math.max(-7 * dt, Math.min(4.5 * dt, want - n.spd));
    let rem = n.spd * dt;                                               // carry leftover distance past each corner so speed never hiccups
    while (rem > 0 && n.pi < n.path.length) { const [wx, wz] = n.path[n.pi], ex = wx - n.x, ez = wz - n.z, e = Math.hypot(ex, ez); if (e <= rem + 0.02) { n.x = wx; n.z = wz; n.pi++; rem -= e; } else { n.x += ex / e * rem; n.z += ez / e * rem; rem = 0; } }
    n.y = this.level.groundY(n.x, n.z, n.y);
    this.level.doors.forEach((dr, i) => { if (!this.doorOpen[i] && !(dr.pad !== undefined && this.doorLocked[i]) && Math.abs(dr.y - n.y) < 1 && Math.hypot(dr.cx - n.x, dr.cz - n.z) < 1.1) { this.doorOpen[i] = true; this.doorLocked[i] = false; this.doorTrap[i] = 0; this.ev({ e: 'door', d: i, open: true }); } });   // suspects know their own tripwires
    return true;
  }
  // In a firefight, shift a step or two sideways between bursts instead of standing rooted.
  sidestep(n, p) {
    const dx = p.hx - n.x, dz = p.hz - n.z, d = Math.hypot(dx, dz) || 1, side = this.rnd() < 0.5 ? 1 : -1, r = 1 + this.rnd() * 0.8;
    const path = findPath(this.level, n.x, n.z, n.y, n.x + dz / d * side * r, n.z - dx / d * side * r, n.y);
    if (path && path.length >= 2 && path.length <= 4) { n.path = path; n.pi = 1; n.strafe = true; }
  }
  tickSuspect(n, dt) {
    if (DONE[n.st]) return;
    if (n.stun > 0) { n.stun -= dt; return; }
    if (n.st === 's' || n.st === 'k') {
      n.tS += dt;
      if (n.fake && n.tS > n.fakeAt) { n.fake = false; n.armed = true; let bp = null, bd = 1e9; for (const p of this.players.values()) { const d = Math.hypot(p.hx - n.x, p.hz - n.z); if (!p.down && p.team !== 'tango' && d < bd) { bd = d; bp = p; } } if (bp) { this.engage(n, bp, 0.55); this.ev({ e: 'say', n: n.id, k: 'fake' }); } }
      else if (n.st === 's' && n.tS > 1.2 && !n.fake) n.st = 'k';
      return;
    }
    let seen = null, best = 1e9;
    for (const p of this.players.values()) { if (p.down || !p.has || p.team === 'tango') continue; const d = Math.hypot(p.hx - n.x, p.hy - n.y - 1.5, p.hz - n.z); if (d < best && this.sees(n, p, d)) { seen = p; best = d; } }   // human terrorists are on their side
    if (n.st === 'g') {
      if (seen) return this.engage(n, seen, 0.6 + this.rnd() * 0.5);
      if (n.path) { if (!this.walk(n, dt, 1.3)) n.pwait = 4 + this.rnd() * 8; }
      else { n.yaw += n.sweep * dt; if (n.patrol) { n.pwait -= dt; if (n.pwait <= 0) { n.pt = 1 - n.pt; const t = n.pt ? [n.patrol[1], n.patrol[2], n.patrol[0] * this.M.H] : n.post; if (!this.goto(n, t[0], t[1], t[2])) n.pwait = 5; } } }
    } else if (n.st === 'a') {
      if (seen) return this.engage(n, seen, 0.35 + this.rnd() * 0.35);
      n.tA += dt;
      if (n.fix && !this.night) n.fix = false;
      const B = this.M.breaker;
      if (n.fix && Math.hypot(n.x - B.x, n.z - B.z) < 1.5 && Math.abs(n.y - Math.floor(B.y / this.M.H) * this.M.H) < 0.5) { n.path = null; this.face(n, B.x, B.z, dt, 5); if ((n.fixT += dt) > 2) { this.night = false; n.fix = false; n.hold = true; this.ev({ e: 'power', on: true, by: n.id }); } }
      else if (n.ambush) {   // get behind something between the post and where the trouble came from, crouch, and watch that way
        n.ambush = false; const c = this.findCover(n, { hx: n.lk[0], hz: n.lk[1], hy: n.lk[2] + 1.6 }); if (c && this.goto(n, c.hx, c.hz, n.y)) n.waitLow = c.low;
      }
      else if (n.path) { this.walk(n, dt, 2.4); if (!n.path) n.crouch = !!n.waitLow; }
      else if (n.hold) this.face(n, n.lk[0], n.lk[1], dt, 3);
      else if (!n.path) { if (Math.hypot(n.lk[0] - n.x, n.lk[1] - n.z) > (n.fix ? 0.6 : 3)) this.goto(n, n.lk[0], n.lk[1], n.lk[2]); else n.hold = true; }
      else this.walk(n, dt, 2.2);
      if (n.tA > (n.fix ? 90 : n.defend ? 60 : 25)) { n.fix = false; n.st = 'g'; n.hold = false; n.crouch = false; this.goto(n, n.post[0], n.post[1], n.post[2]); }
    } else if (n.st === 'c') {
      if (n.exec) return this.tickExec(n, dt);
      if (n.ruthless && n.fired >= n.execAfter) { const c = this.hostageNear(n); if (c) { n.exec = { id: c.id, t: 1.4 + this.rnd() * 0.8 }; n.cov = null; n.crouch = false; n.path = null; n.strafe = false; n.spd = 0; this.ev({ e: 'say', n: n.id, k: 'threat' }); this.ev({ e: 'say', n: c.id, k: 'plead' }); return; } }
      if (n.wantCover) { n.wantCover = false; const p = seen || this.players.get(n.tgt); const c = p && this.findCover(n, p); if (c && this.goto(n, c.hx, c.hz, n.y)) { n.cov = c; n.strafe = false; } }
      if (n.cov) return this.tickCover(n, dt, seen, best);
      if (seen) {
        n.tgt = seen.id; n.lost = 0; n.lk = [seen.hx, seen.hz, seen.y]; this.face(n, seen.hx, seen.hz, dt, 8); n.react -= dt;
        if (n.strafe) { if (!this.walk(n, dt, 1.9, true)) n.strafe = false; }
        else { n.path = null; n.spd = 0; if (n.react <= 0) { n.cool -= dt; if (n.cool <= 0) { this.npcFire(n, seen, best); n.burst--; if (n.burst > 0) n.cool = 0.16; else { n.burst = 2 + Math.floor(this.rnd() * 3); n.cool = 0.7 + this.rnd() * 0.7; if (this.rnd() < 0.4) this.sidestep(n, seen); } } } }
      } else {
        n.lost += dt; if (n.strafe) { n.strafe = false; n.path = null; }
        if (n.lost > 1.2 && n.defend) { if (!n.path && Math.hypot(n.post[0] - n.x, n.post[1] - n.z) > 5) this.goto(n, n.post[0], n.post[1], n.post[2]); if (n.path) this.walk(n, dt, 2.2); else { n.crouch = true; this.face(n, n.lk[0], n.lk[1], dt, 3); } }   // a defender falls back to his room and waits
        else if (n.lost > 1.2) { if (!n.path && Math.hypot(n.lk[0] - n.x, n.lk[1] - n.z) > 1.5) this.goto(n, n.lk[0], n.lk[1], n.lk[2]); this.walk(n, dt, 2.6); }
        if (n.lost > 12) { n.st = 'a'; n.tA = 0; n.hold = true; n.path = null; }
      }
    }
  }
  // An unsecured hostage this suspect can see on the same floor, nearest first.
  hostageNear(n) {
    let best = null, bd = 8;
    for (const c of this.npcs) { if (c.kind !== 'c' || !(c.st === 'w' || c.st === 'y') || Math.abs(c.y - n.y) > 1) continue; const d = Math.hypot(c.x - n.x, c.z - n.z); if (d < bd && this.clear(n.x, this.eyeY(n), n.z, c.x, c.y + 0.8, c.z)) { bd = d; best = c; } }
    return best;
  }
  // He has said what he will do: turn the rifle on the hostage. You have about a second and a half to drop him, flash him or make him give up.
  tickExec(n, dt) {
    const c = this.npcs.find(q => q.id === n.exec.id);
    if (!c || c.st === 'd' || c.st === 'u') { n.exec = null; return; }
    this.face(n, c.x, c.z, dt, 6); n.path = null; n.spd = 0;
    if ((n.exec.t -= dt) > 0) return;
    for (let i = 0; i < 2; i++) this.ev({ e: 'ns', n: n.id, to: [r2(c.x), r2(c.y + 0.7), r2(c.z)] });
    c.hp = 0; c.st = 'd'; c.byS = true; this.log.civExecuted++; this.ev({ e: 'hit', n: c.id, dead: true });
    n.exec = null; n.execAfter = n.fired + 6 + Math.floor(this.rnd() * 5); n.react = 0.3;
  }
  // Anyone may call it: the mission ends now and is scored on what has been done. Complete only if every bomb is safe and every hostage is accounted for.
  endMission(id, how = 'radio') {
    if (this.phase !== 'active' || !this.players.has(id) || this.M.training) return;
    if (this.pvp) { if (this.players.get(id).team === 'tango') return; return this.endPvp('tango', how === 'exit' ? 'SWAT WALKED OUT' : 'SWAT CALLED IT OFF'); }
    const civ = this.npcs.filter(n => n.kind === 'c'), done = this.bombs.every(b => b.defused) && civ.every(n => n.st === 'u' || n.st === 'd');
    this.left = how; this.phase = 'ended'; this.report = this.score(done ? 'MISSION COMPLETE' : 'MISSION INCOMPLETE'); this.ev({ e: 'end', result: this.report.result });
  }
  npcFire(n, p, d) {
    n.fired = (n.fired || 0) + 1;
    const hit = this.rnd() < Math.max(0.08, Math.min(0.5, 0.55 - 0.02 * d)), sp = hit ? 0 : 0.7;
    const to = [r2(p.hx + (this.rnd() - 0.5) * sp), r2(p.hy - 0.25 + (this.rnd() - 0.5) * sp), r2(p.hz + (this.rnd() - 0.5) * sp)];
    this.ev({ e: 'ns', n: n.id, to });
    if (hit) { const r = this.rnd(), part = r < 0.1 ? 'head' : r < 0.55 ? 'torso' : r < 0.65 ? 'armL' : r < 0.75 ? 'armR' : r < 0.875 ? 'legL' : 'legR';   // helmet and vest take the worst of it; limb hits hurt less but slow you or shake your aim
      this.hurt(p, part === 'head' ? 26 + this.rnd() * 8 : part === 'torso' ? 18 + this.rnd() * 10 : 12 + this.rnd() * 6, part); }
  }
  tick(dt) {
    this.t += dt; if (this.M.race) this.raceT += dt;
    if (this.phase !== 'active') return;
    if (this.M.training) { if (this.gren.length || this.smokes.length) this.tickGrenades(dt); return this.tickTraining(dt); }
    this.timer -= dt; if (this.gren.length || this.smokes.length) this.tickGrenades(dt);
    if (this.M.race) this.tickRace();
    for (const p of this.players.values()) if (p.hold) this.carry(p);
    for (const n of this.npcs) if (n.kind === 's') this.tickSuspect(n, dt);
    const sus = this.npcs.filter(n => n.kind === 's'), civ = this.npcs.filter(n => n.kind === 'c'), ps = [...this.players.values()];
    if (this.pvp) {
      const sw = ps.filter(p => p.team !== 'tango'), tg = ps.filter(p => p.team === 'tango'), objectives = civ.every(n => n.st === 'u' || n.st === 'd') && this.bombs.every(b => b.defused);
      if (sw.length && sw.every(p => p.down)) return this.endPvp('tango', 'SQUAD DOWN');
      if (objectives) return this.endPvp('swat', 'HOSTAGES AND BOMBS SECURED');
      if (tg.every(p => p.down) && sus.every(n => SECURED[n.st])) return this.endPvp('swat', 'ALL TERRORISTS DOWN');
      if (this.timer <= 0) return this.endPvp('tango', this.bombs.some(b => !b.defused) ? 'TIME UP - DETONATION' : 'TIME UP');
      return;
    }
    let result = null;
    if (this.timer <= 0 && this.bombs.some(b => !b.defused)) result = 'DETONATION';
    else if (ps.length && ps.every(p => p.down)) result = 'SQUAD DOWN';
    else if (sus.every(n => SECURED[n.st]) && civ.every(n => n.st === 'u' || n.st === 'd') && this.bombs.every(b => b.defused)) result = 'MISSION COMPLETE';
    if (result) { this.phase = 'ended'; this.report = this.score(result); this.ev({ e: 'end', result }); return; }
    // walk out: once someone has been inside, every officer still standing at the front gate for 5 seconds ends the mission
    const EX = this.M.exit; for (const p of ps) if (p.has && this.level.objective(p.hx, p.hz)) p.entered = true;
    const up = ps.filter(p => !p.down && p.has), atGate = p => p.hx > EX.x0 && p.hx < EX.x1 && p.hz > EX.z0 && p.hz < EX.z1 && Math.abs(p.y - (EX.y || 0)) < 0.5;
    if (up.length && ps.some(p => p.entered) && up.every(atGate)) { if ((this.extractT += dt) >= 5) this.endMission(up[0].id, 'exit'); } else this.extractT = 0;
  }
  endPvp(winner, why) {
    this.phase = 'ended'; const result = (winner === 'swat' ? 'SWAT WIN' : 'TERRORISTS WIN') + ': ' + why;
    const ps = [...this.players.values()], sus = this.npcs.filter(n => n.kind === 's'), civ = this.npcs.filter(n => n.kind === 'c'), names = t => ps.filter(p => (p.team === 'tango') === t).map(p => p.name + (p.down ? ' (down)' : '')).join(', ') || '-';
    this.report = { result, winner, pvp: true, time: Math.round(this.M.time - this.timer), grade: '-', total: 0, lines: [
      ['Why: ' + why.toLowerCase(), null],
      ['Hostages secured ' + civ.filter(n => n.st === 'u').length + '/' + civ.length + (civ.some(n => n.st === 'd') ? ', ' + civ.filter(n => n.st === 'd').length + ' killed' : ''), null],
      ['Bombs defused ' + this.bombs.filter(b => b.defused).length + '/' + this.bombs.length, null],
      ['AI crew down or arrested ' + sus.filter(n => SECURED[n.st]).length + '/' + sus.length, null],
      ['SWAT: ' + names(false), null], ['Terrorists: ' + names(true), null]] };
    this.ev({ e: 'end', result });
  }
  score(result) {
    const L = this.log, sus = this.npcs.filter(n => n.kind === 's'), civ = this.npcs.filter(n => n.kind === 'c');
    const arrested = sus.filter(n => n.st === 'u' || n.st === 'j').length, killed = sus.filter(n => n.st === 'd' && n.just).length, secured = civ.filter(n => n.st === 'u').length, defused = this.bombs.filter(b => b.defused).length;
    const hvt = sus.find(n => n.hvt), AR = hvt ? 20 : 30;
    const lines = [
      ['Bombs defused ' + defused + '/' + this.bombs.length, 15 * defused],
      ['Hostages secured ' + secured + '/' + civ.length, Math.round(25 * secured / civ.length)],
      ['Suspects arrested ' + arrested + '/' + sus.length, Math.round(AR * arrested / sus.length)],
      ['Suspects killed (justified) ' + killed, Math.round(15 * killed / sus.length)],
      ['Officers down ' + L.downs, L.downs ? -7 * L.downs : 15],
    ];
    if (hvt) lines.push(hvt.st === 'u' || hvt.st === 'j' ? ['High-value target arrested', 10] : hvt.st === 'd' ? ['High-value target killed', -5] : ['High-value target at large', 0]);
    if (L.unauth) lines.push(['Unauthorised use of force x' + L.unauth, -10 * L.unauth]);
    if (L.execution) lines.push(['Shot a surrendered suspect x' + L.execution, -20 * L.execution]);
    if (L.civHit) lines.push(['Civilian shot x' + L.civHit, -15 * L.civHit]);
    if (L.civKilled) lines.push(['Civilian killed x' + L.civKilled, -15 * L.civKilled]);
    if (L.civExecuted) lines.push(['Hostage killed by a suspect x' + L.civExecuted, -10 * L.civExecuted]);
    if (L.ff) lines.push(['Friendly fire x' + L.ff, -5 * L.ff]);
    const loose = sus.filter(n => !SECURED[n.st]).length, unsafe = this.bombs.length - defused, left = civ.filter(n => n.st === 'w' || n.st === 'y').length;
    if (this.left) lines.push([(this.left === 'exit' ? 'Walked out' : 'Ended by radio') + (loose ? ', ' + loose + ' suspect' + (loose > 1 ? 's' : '') + ' unaccounted for' : '') + (left ? ', ' + left + ' hostage' + (left > 1 ? 's' : '') + ' left inside' : '') + (unsafe ? ', ' + unsafe + ' bomb' + (unsafe > 1 ? 's' : '') + ' live' : ''), null]);
    let total = Math.max(0, Math.min(100, lines.reduce((s, l) => s + (l[1] || 0), 0)));
    if (result !== 'MISSION COMPLETE') total = Math.min(total, 49);
    const grade = total >= 90 ? 'A' : total >= 80 ? 'B' : total >= 70 ? 'C' : total >= 60 ? 'D' : 'F';
    return { result, lines, total, grade, time: Math.round(this.M.time - this.timer) };
  }
  snapshot() {
    const P = [...this.players.values()].map(p => [p.id, p.name, p.slot, Math.round(p.hp), p.down ? 1 : 0, p.h, p.l, p.r, p.g, p.w | (p.med ? 64 : 0) | (p.fl << 7) | (p.sm << 9) | (p.team === 'tango' ? 2048 : 0) | (p.hold ? 4096 : 0)]);
    const N = this.npcs.map(n => [n.id, r2(n.x), r2(n.y), r2(n.z), r2(n.yaw), n.stun > 0 && (n.st === 'a' || n.st === 'g' || n.st === 'c') ? 'z' : n.st === 'c' && n.crouch ? 'h' : n.st, n.kind === 's' && n.armed ? 1 : 0]);
    const E = this.events; this.events = [];
    const s = { t: 's', X: this.extractT > 0 ? Math.ceil(5 - this.extractT) : 0, ph: this.phase, tm: Math.ceil(this.timer), P, N, D: this.doorOpen.map(o => o ? 1 : 0).join(''), L: this.doorLocked.map(o => o ? 1 : 0).join(''), pw: this.night ? 0 : 1, T: this.doorTrap.join(''), G: this.gren.map(g => [g.k === 'flash' ? 0 : 1, r2(g.x), r2(g.y), r2(g.z)]), SM: this.smokes.map(s => [r2(s.x), r2(s.y), r2(s.z), Math.round(s.t * 10) / 10]), B: this.bombs.map(b => [b.cut.map(c => c ? 1 : 0).join(''), b.defused ? 1 : 0, b.n]), E };
    if (this.report) s.R = this.report;
    if (this.M.race) s.RT = Math.round(this.raceT * 100) / 100;
    if (this.M.training) s.TP = this.todPick;
    if (this.targets && this.M.training) { s.TG = this.targets.map(t => [t.up, r2(t.x), t.hostile ? 1 : 0]); const H = this.house; s.HS = [H.on ? 1 : 0, Math.round(H.t * 10) / 10, H.best, H.last, H.ns]; s.TS = [...this.players.values()].map(p => [p.id, p.tr ? p.tr.hits : 0, p.tr ? p.tr.shots : 0, p.tr ? p.tr.ns : 0]); s.NM = this.nextMap; s.WP = this.wxPick; }
    return s;
  }
}
