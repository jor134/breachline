import assert from 'node:assert/strict';
import { buildLevel, findPath, rayStatic, resolveCircle, groundY, circleHits, H, SPAWN, SUSPECT_SPOTS, CIV_SPOTS, BOMB_SPOTS, NX, NZ, YARD, U } from '../public/js/core/level.js';
import { Sim, MISSION_TIME } from '../public/js/core/sim.js';
import { RoomHost } from '../public/js/core/host.js';
import * as W from '../public/js/core/weapon.js';
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };
const L = buildLevel();

t('level builds walls and 14 doors', () => { assert.ok(L.boxes.filter(b => b.kind === 'wall').length > 30); assert.equal(L.doors.length, 14); });
t('every spot is walkable and reachable from spawn', () => {
  for (const [f, x, z] of [...SUSPECT_SPOTS, ...CIV_SPOTS]) {
    assert.ok(!circleHits(L, null, x, z, 0.25, f * H), `spot blocked ${f},${x},${z}`);
    const p = findPath(L, SPAWN[0][0], SPAWN[0][1], 0, x, z, f * H); assert.ok(p && p.length > 5, `no path to ${f},${x},${z}`);
    const e = p[p.length - 1]; assert.ok(Math.hypot(e[0] - x, e[1] - z) < 0.8 && e[2] === f, `path ends wrong for ${f},${x},${z}: ${e}`);
  }
});
t('bombs are within reach of a standing spot', () => {
  for (const [f, x, z] of BOMB_SPOTS) { let ok = false; for (let a = 0; a < 6.28; a += 0.3) for (const r of [0.5, 0.7, 0.9]) { const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (!circleHits(L, null, px, pz, 0.25, f * H) && findPath(L, 12, 27, 0, px, pz, f * H)) ok = true; } assert.ok(ok, `bomb unreachable ${f},${x},${z}`); }
});
t('stairs: path climbs, ground height is continuous', () => {
  const p = findPath(L, 12, 12, 0, 12, 2, H); assert.ok(p.some(c => c[2] === 0) && p[p.length - 1][2] === 1);
  let y = 0, prev = 0; for (const [x, z] of p) { y = groundY(x, z, y); assert.ok(Math.abs(y - prev) < 0.45, 'jump ' + prev + '->' + y); prev = y; } assert.equal(y, H);
});
t('walls stop bullets, open doorway does not, floors block', () => {
  assert.ok(rayStatic(L, null, 4, 1.5, 12, 1, 0, 0, 50) < 5.2);            // living room east wall at x=9 (sofa first)
  assert.ok(rayStatic(L, null, 12, 1.5, 20, 0, 0, -1, 50) > 6);            // through front doorway when doors ignored
  const closed = L.doors.map(() => false); assert.ok(Math.abs(rayStatic(L, closed, 12, 1.5, 20, 0, 0, -1, 50) - 3.96) < 0.1);
  assert.ok(Math.abs(rayStatic(L, null, 4, 1, 12.5, 0, 1, 0, 50) - 2.2) < 0.01); // ceiling slab
  assert.ok(rayStatic(L, null, 14.25, 0.5, 6, 0, 1, 0, 50) > 5);           // up the stairwell
});
t('collision keeps a player out of walls and closed doors', () => {
  let [x, z] = resolveCircle(L, null, 8.95, 10, 0.25, 0); assert.ok(x <= 8.9 - 0.25 + 1e-6);
  const closed = L.doors.map(() => false); [x, z] = resolveCircle(L, closed, 12, 16.1, 0.25, 0); assert.ok(Math.abs(z - 16) >= 0.25);
  [x, z] = resolveCircle(L, L.doors.map(() => true), 12, 16.1, 0.25, 0); assert.equal(z, 16.1);
});
t('weapon: fire to empty, bolt locks, reload, release', () => {
  const g = W.createGun('pistol'); let now = 0, shots = 0;
  for (let i = 0; i < 30; i++) { now += 0.2; if (W.pullTrigger(g, now, true, true) === 'fire') shots++; }
  assert.equal(shots, 18); assert.ok(g.locked && !g.chamber);
  assert.equal(W.pullTrigger(g, now + 1, true, true), 'click');
  assert.equal(W.insertMag(g, 17), false); assert.equal(W.ejectMag(g), 0); assert.ok(W.insertMag(g, 17));
  assert.equal(W.release(g), 'chamber'); assert.ok(g.chamber && g.mag === 16);
  assert.equal(W.rack(g), 'ejected-live'); assert.equal(g.mag, 15);
});
t('weapon: semi needs a fresh pull, auto does not, no mag = one shot', () => {
  const g = W.createGun('rifle'); assert.equal(W.pullTrigger(g, 1, true, true), 'fire'); assert.equal(W.pullTrigger(g, 2, false, true), null);
  W.toggleMode(g); assert.equal(W.pullTrigger(g, 3, false, true), 'fire'); assert.equal(W.pullTrigger(g, 3.01, false, true), null);
  W.ejectMag(g); assert.equal(W.pullTrigger(g, 4, true, true), 'fire'); assert.equal(W.pullTrigger(g, 5, true, true), 'click'); assert.ok(!g.locked);
  W.insertMag(g, 30); assert.equal(W.rack(g), 'chamber'); assert.equal(g.mag, 29);
});

const mkSim = seed => { const s = new Sim(); const p = s.addPlayer(1, 'T'); s.start(seed); return [s, p]; };
const put = (s, p, x, y, z) => s.pose(p.id, { h: [x, y, z, 0, 0, 0, 1], l: null, r: null, g: [1, 0] });
const beside = (s, p, n, r = 1.3) => { for (let a = 0; a < 6.28; a += 0.4) { const x = n.x + Math.sin(a) * r, z = n.z + Math.cos(a) * r; if (!circleHits(L, null, x, z, 0.3, n.y) && s.clear(x, n.y + 1.65, z, n.x, n.y + 1.5, n.z) && s.clear(x, n.y + 1.65, z, n.x, n.y + 0.9, n.z)) { put(s, p, x, n.y + 1.65, z); n.yaw = Math.atan2(x - n.x, z - n.z); return; } } throw new Error('no spot beside npc'); };
const aimAt = (s, p, n, dy = 1.3) => { const d = [n.x - p.hx, n.y + dy - p.hy, n.z - p.hz]; s.shot(p.id, { o: [p.hx, p.hy, p.hz], d, w: 'rifle' }); };
t('mission populates deterministically per seed', () => {
  const [a] = mkSim(42), [b] = mkSim(42), [c] = mkSim(43);
  assert.equal(a.npcs.filter(n => n.kind === 's').length, 8); assert.equal(a.npcs.filter(n => n.kind === 'c').length, 5); assert.equal(a.bombs.length, 2);
  assert.deepEqual(a.init(), b.init()); assert.notDeepEqual(a.init(), c.init());
});
t('suspect spots a player, reacts, shoots, and can down them', () => {
  const [s, p] = mkSim(7); const n = s.npcs[0]; beside(s, p, n, 2);
  for (const o of s.npcs) if (o !== n) o.st = 'u';
  let fired = false; for (let i = 0; i < 15 * 30 && !p.down; i++) { s.tick(1 / 15); if (s.events.some(e => e.e === 'ns')) fired = true; }
  assert.equal(n.st, 'c'); assert.ok(fired); assert.ok(p.down, 'player should eventually go down at 2m');
  s.tick(1 / 15); assert.equal(s.phase, 'ended'); assert.equal(s.report.result, 'SQUAD DOWN'); assert.ok(s.report.total <= 49);
});
t('closed door hides the player', () => {
  const [s, p] = mkSim(7); const n = s.npcs[0]; n.x = 12; n.z = 14; n.y = 0; n.yaw = 0; n.sweep = 0; n.patrol = null;   // foyer, facing the front door
  for (const o of s.npcs) if (o !== n) o.st = 'u';
  put(s, p, 12, 1.65, 18); for (let i = 0; i < 30; i++) s.tick(1 / 15); assert.equal(n.st, 'g');
  s.door(1, 0); assert.ok(s.doorOpen[0]); for (let i = 0; i < 30; i++) s.tick(1 / 15); assert.equal(n.st, 'c');
});
t('ROE: shooting an unaware suspect is penalised, shooting a hostile is not', () => {
  let [s, p] = mkSim(9); let n = s.npcs[0]; beside(s, p, n); n.yaw += Math.PI;
  aimAt(s, p, n, 1.62); assert.equal(n.st, 'd'); assert.equal(s.log.unauth, 1);
  [s, p] = mkSim(9); n = s.npcs[0]; beside(s, p, n); s.engage(n, p, 5); aimAt(s, p, n, 1.62); assert.equal(n.st, 'd'); assert.equal(s.log.unauth, 0); assert.ok(n.killJust);
  [s, p] = mkSim(9); n = s.npcs[0]; beside(s, p, n); s.surrender(n); aimAt(s, p, n, 1.3); assert.equal(s.log.execution, 1);
  [s, p] = mkSim(9); n = s.npcs.find(q => q.kind === 'c'); beside(s, p, n); aimAt(s, p, n, 0.8); assert.equal(s.log.civHit, 1);
});
t('shout: suspects surrender or fight, civilians comply; cuffing works only when compliant and close', () => {
  let sur = 0, fight = 0;
  for (let seed = 1; seed <= 40; seed++) { const [s, p] = mkSim(seed); const n = s.npcs[0]; beside(s, p, n); n.yaw += Math.PI; s.shout(1); if (n.st === 's') sur++; else if (n.st === 'c') fight++; else assert.fail('state ' + n.st); }
  assert.ok(sur > 8 && fight > 5, `surrender ${sur} fight ${fight}`);
  const [s, p] = mkSim(3); const c = s.npcs.find(q => q.kind === 'c'); c.stubborn = false; beside(s, p, c, 1);
  s.cuff(1, c.id); assert.equal(c.st, 'w'); for (const o of s.npcs) if (o.kind === 's') o.st = 'u';
  s.shout(1); assert.equal(c.st, 'y'); put(s, p, c.x + 5, c.y + 1.65, c.z); s.cuff(1, c.id); assert.equal(c.st, 'y'); beside(s, p, c, 1); s.cuff(1, c.id); assert.equal(c.st, 'u');
});
t('fake surrender turns hostile if not cuffed', () => {
  const [s, p] = mkSim(5); const n = s.npcs[0]; for (const o of s.npcs) if (o !== n) o.st = 'u'; beside(s, p, n);
  n.fakeChance = true; s.surrender(n); for (let i = 0; i < 15 * 9; i++) s.tick(1 / 15); assert.ok(n.st === 'c' || p.down);
});
t('alerted suspects path toward gunfire and open doors on the way', () => {
  const [s, p] = mkSim(11); put(s, p, 12, 1.65, 26); s.shot(1, { o: [12, 1.5, 26], d: [0, 1, 0], w: 'rifle' });
  const al = s.npcs.filter(n => n.st === 'a'); assert.ok(al.length >= 6); const before = al.map(n => [n.x, n.z]);
  for (let i = 0; i < 15 * 8; i++) s.tick(1 / 15);
  assert.ok(al.some((n, i) => Math.hypot(n.x - before[i][0], n.z - before[i][1]) > 2), 'someone should move');
  for (const n of s.npcs) assert.ok(!circleHits(L, null, n.x, n.z, 0.15, n.y), 'npc inside wall');
});
t('bomb: right order defuses, wrong wire costs time; timer expiry detonates', () => {
  let [s, p] = mkSim(13); const b = s.bombs[0]; put(s, p, b.x + 0.6, b.y + 0.8, b.z);
  const wrong = [0, 1, 2, 3].find(w => !b.order.includes(w)); const t0 = s.timer; s.cut(1, 0, wrong); assert.equal(s.timer, t0 - 45);
  s.cut(1, 0, b.order[0]); assert.ok(!b.defused); s.cut(1, 0, b.order[1]); assert.ok(b.defused);
  for (const o of s.npcs) o.st = 'u'; s.timer = 0.01; s.tick(0.1); assert.equal(s.report.result, 'DETONATION');
});
t('perfect run scores A', () => {
  const [s] = mkSim(21); for (const o of s.npcs) o.st = 'u'; for (const b of s.bombs) b.defused = true; s.tick(0.1);
  assert.equal(s.report.result, 'MISSION COMPLETE'); assert.equal(s.report.total, 100); assert.equal(s.report.grade, 'A');
});
t('host protocol: join, start, snapshot, 5th player refused, restart after end', () => {
  const out = []; const h = new RoomHost((id, o) => out.push([id, o]));
  for (let i = 1; i <= 4; i++) assert.ok(h.join(i, 'P' + i)); assert.equal(h.join(5, 'X'), false); assert.equal(out.at(-1)[1].t, 'full');
  h.message(1, { t: 'start' }); assert.equal(h.sim.phase, 'active'); h.message(2, { t: 'start' }); 
  h.message(1, { t: 'pose', h: [12, 1.65, 27, 0, 0, 0, 1], g: [1, 0] }); h.message(1, 'garbage'); h.message(1, { t: 'pose', h: [NaN] }); h.tick();
  const snap = out.at(-1)[1]; assert.equal(snap.t, 's'); assert.equal(snap.P.length, 4); assert.equal(snap.N.length, 13); assert.equal(snap.D.length, 14);
  assert.ok(JSON.stringify(snap).length < 3000, 'snapshot size ' + JSON.stringify(snap).length);
  h.leave(2); h.leave(3); h.leave(4); h.sim.players.get(1).down = true; h.tick(); assert.equal(h.sim.phase, 'ended');
  h.message(1, { t: 'start' }); assert.equal(h.sim.phase, 'active'); assert.ok(!h.sim.players.get(1).down);
});
t('full-mission soak: 40 random-seed missions run 60s with a wandering shooter without errors', () => {
  for (let seed = 100; seed < 140; seed++) { const [s, p] = mkSim(seed); let a = 0;
    for (let i = 0; i < 15 * 60; i++) { a += 0.05; put(s, p, 12 + Math.sin(a) * 6, 1.65, 12 + Math.cos(a * 0.7) * 6); if (i % 20 === 0) s.shot(1, { o: [p.hx, 1.5, p.hz], d: [Math.sin(a * 3), 0, Math.cos(a * 3)], w: 'rifle' }); if (i % 45 === 0) s.shout(1); s.tick(1 / 15); const snap = s.snapshot(); assert.ok(snap.N.every(q => Number.isFinite(q[1]) && Number.isFinite(q[3]))); }
  }
});
console.log(n + ' tests passed');
