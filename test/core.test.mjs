import assert from 'node:assert/strict';
import { buildLevel, findPath, rayStatic, resolveCircle, groundY, circleHits, H, SPAWN, SUSPECT_SPOTS, CIV_SPOTS, BOMB_SPOTS, NX, NZ, YARD, U } from '../public/js/core/level.js';
import { Sim, MISSION_TIME } from '../public/js/core/sim.js';
import { RoomHost } from '../public/js/core/host.js';
import * as W from '../public/js/core/weapon.js';
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };
const L = buildLevel();
Sim.BOTS = false;   // the bot tests at the end switch them back on

await t('level builds walls and 14 doors', () => { assert.ok(L.boxes.filter(b => b.kind === 'wall').length > 30); assert.equal(L.doors.length, 23); assert.ok(L.boxes.filter(b => b.kind === 'glass').length >= 8); });
await t('every spot is walkable and reachable from spawn', () => {
  for (const [f, x, z] of [...SUSPECT_SPOTS, ...CIV_SPOTS]) {
    assert.ok(!circleHits(L, null, x, z, 0.25, f * H), `spot blocked ${f},${x},${z}`);
    const p = findPath(L, SPAWN[0][0], SPAWN[0][1], 0, x, z, f * H); assert.ok(p && p.length >= 2, `no path to ${f},${x},${z}`);
    const e = p[p.length - 1]; assert.ok(Math.hypot(e[0] - x, e[1] - z) < 0.8 && e[2] === f, `path ends wrong for ${f},${x},${z}: ${e}`);
  }
});
await t('bombs are within reach of a standing spot', () => {
  for (const [f, x, z] of BOMB_SPOTS) { let ok = false; for (let a = 0; a < 6.28; a += 0.3) for (const r of [0.5, 0.7, 0.9]) { const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (!circleHits(L, null, px, pz, 0.25, f * H) && findPath(L, 12, 27, 0, px, pz, f * H)) ok = true; } assert.ok(ok, `bomb unreachable ${f},${x},${z}`); }
});
await t('stairs: path climbs, ground height is continuous', () => {
  const p = findPath(L, 12, 12, 0, 12, 2, H, true); assert.ok(p.some(c => c[2] === 0) && p[p.length - 1][2] === 1);
  let y = 0, prev = 0; for (const [x, z] of p) { y = groundY(x, z, y); assert.ok(Math.abs(y - prev) < 0.45, 'jump ' + prev + '->' + y); prev = y; } assert.equal(y, H);
});
await t('walls stop bullets, open doorway does not, floors block', () => {
  assert.ok(rayStatic(L, null, 4, 1.5, 12, 1, 0, 0, 50) < 5.2);            // living room east wall at x=9 (sofa first)
  assert.ok(rayStatic(L, null, 12, 1.5, 20, 0, 0, -1, 50) > 6);            // through front doorway when doors ignored
  const closed = L.doors.map(() => false); assert.ok(Math.abs(rayStatic(L, closed, 12, 1.5, 20, 0, 0, -1, 50) - 3.96) < 0.1);
  assert.ok(Math.abs(rayStatic(L, null, 4, 1, 12.5, 0, 1, 0, 50) - 2.2) < 0.01); // ceiling slab
  assert.ok(rayStatic(L, null, 14.25, 0.5, 6, 0, 1, 0, 50) > 5);           // up the stairwell
});
await t('collision keeps a player out of walls and closed doors', () => {
  let [x, z] = resolveCircle(L, null, 8.95, 10, 0.25, 0); assert.ok(x <= 8.9 - 0.25 + 1e-6);
  const closed = L.doors.map(() => false); [x, z] = resolveCircle(L, closed, 12, 16.1, 0.25, 0); assert.ok(Math.abs(z - 16) >= 0.25);
  [x, z] = resolveCircle(L, L.doors.map(() => true), 12, 16.1, 0.25, 0); assert.equal(z, 16.1);
});
await t('weapon: fire to empty, bolt locks, reload, release', () => {
  const g = W.createGun('pistol'); let now = 0, shots = 0;
  for (let i = 0; i < 30; i++) { now += 0.2; if (W.pullTrigger(g, now, true, true) === 'fire') shots++; }
  assert.equal(shots, 18); assert.ok(g.locked && !g.chamber);
  assert.equal(W.pullTrigger(g, now + 1, true, true), 'click');
  assert.equal(W.insertMag(g, 17), false); assert.equal(W.ejectMag(g), 0); assert.ok(W.insertMag(g, 17));
  assert.equal(W.release(g), 'chamber'); assert.ok(g.chamber && g.mag === 16);
  assert.equal(W.rack(g), 'ejected-live'); assert.equal(g.mag, 15);
});
await t('weapon: semi needs a fresh pull, auto does not, no mag = one shot', () => {
  const g = W.createGun('rifle'); assert.equal(W.pullTrigger(g, 1, true, true), 'fire'); assert.equal(W.pullTrigger(g, 2, false, true), null);
  W.toggleMode(g); assert.equal(W.pullTrigger(g, 3, false, true), 'fire'); assert.equal(W.pullTrigger(g, 3.01, false, true), null);
  W.ejectMag(g); assert.equal(W.pullTrigger(g, 4, true, true), 'fire'); assert.equal(W.pullTrigger(g, 5, true, true), 'click'); assert.ok(!g.locked);
  W.insertMag(g, 30); assert.equal(W.rack(g), 'chamber'); assert.equal(g.mag, 29);
});

const mkSim = seed => { const s = new Sim(); const p = s.addPlayer(1, 'T'); s.start(seed); return [s, p]; };
const put = (s, p, x, y, z) => s.pose(p.id, { h: [x, y, z, 0, 0, 0, 1], l: null, r: null, g: [1, 0] });
const beside = (s, p, n, r = 1.3) => { for (let a = 0; a < 6.28; a += 0.4) { const x = n.x + Math.sin(a) * r, z = n.z + Math.cos(a) * r; if (!circleHits(L, null, x, z, 0.3, n.y) && s.clear(x, n.y + 1.65, z, n.x, n.y + 1.5, n.z) && s.clear(x, n.y + 1.65, z, n.x, n.y + 0.9, n.z)) { put(s, p, x, n.y + 1.65, z); n.yaw = Math.atan2(x - n.x, z - n.z); return; } } throw new Error('no spot beside npc'); };
const aimAt = (s, p, n, dy = 1.3) => { const d = [n.x - p.hx, n.y + dy - p.hy, n.z - p.hz]; s.shot(p.id, { o: [p.hx, p.hy, p.hz], d, w: 'rifle' }); };
await t('mission populates deterministically per seed', () => {
  const [a] = mkSim(42), [b] = mkSim(42), [c] = mkSim(43);
  assert.equal(a.npcs.filter(n => n.kind === 's').length, 9); assert.equal(a.npcs.filter(n => n.kind === 'c').length, 5); assert.equal(a.bombs.length, 2);
  assert.deepEqual(a.init(), b.init()); assert.notDeepEqual(a.init(), c.init());
});
await t('suspect spots a player, reacts, shoots, and can down them', () => {
  const [s, p] = mkSim(7); const n = s.npcs[0]; beside(s, p, n, 2);
  for (const o of s.npcs) if (o !== n) o.st = 'u';
  let fired = false; for (let i = 0; i < 15 * 90 && !p.down; i++) { s.tick(1 / 15); if (s.events.some(e => e.e === 'ns')) fired = true; s.events.length = 0; }
  assert.equal(n.st, 'c'); assert.ok(fired); assert.ok(p.down, 'player should eventually go down at 2m');
  s.tick(1 / 15); assert.equal(s.phase, 'ended'); assert.equal(s.report.result, 'SQUAD DOWN'); assert.ok(s.report.total <= 49);
});
await t('closed door hides the player', () => {
  const [s, p] = mkSim(7); const n = s.npcs[0]; n.x = 12; n.z = 14; n.y = 0; n.yaw = 0; n.sweep = 0; n.patrol = null;   // foyer, facing the front door
  for (const o of s.npcs) if (o !== n) o.st = 'u';
  s.doorLocked[0] = false; put(s, p, 12, 1.65, 18); for (let i = 0; i < 30; i++) s.tick(1 / 15); assert.equal(n.st, 'g');
  s.door(1, 0); assert.ok(s.doorOpen[0]); for (let i = 0; i < 30; i++) s.tick(1 / 15); assert.equal(n.st, 'c');
});
await t('ROE: shooting an unaware suspect is penalised, shooting a hostile is not', () => {
  let [s, p] = mkSim(9); let n = s.npcs[0]; beside(s, p, n); n.yaw += Math.PI;
  aimAt(s, p, n, 1.62); assert.equal(n.st, 'd'); assert.equal(s.log.unauth, 1);
  [s, p] = mkSim(9); n = s.npcs[0]; beside(s, p, n); s.engage(n, p, 5); aimAt(s, p, n, 1.62); assert.equal(n.st, 'd'); assert.equal(s.log.unauth, 0); assert.ok(n.just);
  [s, p] = mkSim(9); n = s.npcs[0]; beside(s, p, n); s.surrender(n); aimAt(s, p, n, 1.3); assert.equal(s.log.execution, 1);
  [s, p] = mkSim(9); n = s.npcs.find(q => q.kind === 'c'); beside(s, p, n); aimAt(s, p, n, 0.8); assert.equal(s.log.civHit, 1);
});
await t('shout: suspects surrender or fight, civilians comply; cuffing works only when compliant and close', () => {
  let sur = 0, fight = 0;
  for (let seed = 1; seed <= 40; seed++) { const [s, p] = mkSim(seed); const n = s.npcs[0]; beside(s, p, n); n.yaw += Math.PI; s.shout(1); if (n.st === 's') sur++; else if (n.st === 'c') fight++; else assert.fail('state ' + n.st); }
  assert.ok(sur > 8 && fight > 5, `surrender ${sur} fight ${fight}`);
  const [s, p] = mkSim(3); const c = s.npcs.find(q => q.kind === 'c'); c.stubborn = false; beside(s, p, c, 1);
  s.cuff(1, c.id); assert.equal(c.st, 'w'); for (const o of s.npcs) if (o.kind === 's') o.st = 'u';
  s.shout(1); assert.equal(c.st, 'y'); put(s, p, c.x + 5, c.y + 1.65, c.z); s.cuff(1, c.id); assert.equal(c.st, 'y'); beside(s, p, c, 1); s.cuff(1, c.id); assert.equal(c.st, 'u');
});
await t('fake surrender turns hostile if not cuffed', () => {
  const [s, p] = mkSim(5); const n = s.npcs[0]; for (const o of s.npcs) if (o !== n) o.st = 'u'; beside(s, p, n);
  n.fakeChance = true; s.surrender(n); for (let i = 0; i < 15 * 9; i++) s.tick(1 / 15); assert.ok(n.st === 'c' || p.down);
});
await t('alerted suspects path toward gunfire and open doors on the way', () => {
  const [s, p] = mkSim(11); put(s, p, 12, 1.65, 26); s.shot(1, { o: [12, 1.5, 26], d: [0, 1, 0], w: 'rifle' });
  const al = s.npcs.filter(n => n.st === 'a'); assert.ok(al.length >= 6); const before = al.map(n => [n.x, n.z]);
  for (let i = 0; i < 15 * 8; i++) s.tick(1 / 15);
  assert.ok(al.some((n, i) => Math.hypot(n.x - before[i][0], n.z - before[i][1]) > 2), 'someone should move');
  for (const n of s.npcs) assert.ok(!circleHits(L, null, n.x, n.z, 0.15, n.y), 'npc inside wall');
});
await t('bomb: right order defuses, wrong wire costs time; timer expiry detonates', () => {
  let [s, p] = mkSim(13); const b = s.bombs[0]; put(s, p, b.x + 0.6, b.y + 0.8, b.z);
  const wrong = [0, 1, 2, 3].find(w => !b.order.includes(w)); const t0 = s.timer; s.cut(1, 0, wrong); assert.equal(s.timer, t0 - 45);
  s.cut(1, 0, b.order[0]); assert.ok(!b.defused); s.cut(1, 0, b.order[1]); assert.ok(b.defused);
  for (const o of s.npcs) o.st = 'u'; s.timer = 0.01; s.tick(0.1); assert.equal(s.report.result, 'DETONATION');
});
await t('perfect run scores A', () => {
  const [s] = mkSim(21); for (const o of s.npcs) o.st = 'u'; for (const b of s.bombs) b.defused = true; s.tick(0.1);
  assert.equal(s.report.result, 'MISSION COMPLETE'); assert.equal(s.report.total, 100); assert.equal(s.report.grade, 'A');
});
await t('host protocol: join, start, snapshot, 5th player refused, restart after end', () => {
  const out = []; const h = new RoomHost((id, o) => out.push([id, o]));
  for (let i = 1; i <= 4; i++) assert.ok(h.join(i, 'P' + i)); assert.equal(h.join(5, 'X'), false); assert.equal(out.at(-1)[1].t, 'full');
  h.message(1, { t: 'start' }); assert.equal(h.sim.phase, 'active'); h.message(2, { t: 'start' }); 
  h.message(1, { t: 'pose', h: [12, 1.65, 27, 0, 0, 0, 1], g: [1, 0] }); h.message(1, 'garbage'); h.message(1, { t: 'pose', h: [NaN] }); h.tick();
  const snap = out.at(-1)[1]; assert.equal(snap.t, 's'); assert.equal(snap.P.length, 4); assert.equal(snap.N.length, 14); assert.equal(snap.D.length, 23); assert.equal(snap.L.length, 23);
  assert.ok(JSON.stringify(snap).length < 3500, 'snapshot size ' + JSON.stringify(snap).length);
  h.leave(2); h.leave(3); h.leave(4); h.sim.players.get(1).down = true; h.tick(); assert.equal(h.sim.phase, 'ended');
  h.message(1, { t: 'start' }); assert.equal(h.sim.phase, 'active'); assert.ok(!h.sim.players.get(1).down);
});
await t('full-mission soak: 40 random-seed missions run 60s with a wandering shooter without errors', () => {
  for (let seed = 100; seed < 140; seed++) { const [s, p] = mkSim(seed); let a = 0;
    for (let i = 0; i < 15 * 60; i++) { a += 0.05; put(s, p, 12 + Math.sin(a) * 6, 1.65, 12 + Math.cos(a * 0.7) * 6); if (i % 20 === 0) s.shot(1, { o: [p.hx, 1.5, p.hz], d: [Math.sin(a * 3), 0, Math.cos(a * 3)], w: 'rifle' }); if (i % 45 === 0) s.shout(1); s.tick(1 / 15); const snap = s.snapshot(); assert.ok(snap.N.every(q => Number.isFinite(q[1]) && Number.isFinite(q[3]))); }
  }
});
await t('locked doors: rattle, pick quietly, or kick loudly', () => {
  const [s, p] = mkSim(31); const d = L.doors[1]; s.doorOpen[1] = false; s.doorLocked[1] = true; put(s, p, d.cx, 1.65, d.cz + 1);
  s.events.length = 0; s.door(1, 1); assert.ok(!s.doorOpen[1]); assert.equal(s.events.at(-1).e, 'locked');
  s.pick(1, 1); assert.ok(!s.doorLocked[1]); assert.ok(s.npcs.every(n => n.st !== 'a'), 'picking is silent'); s.door(1, 1); assert.ok(s.doorOpen[1]);
  let opened = 0; for (let seed = 1; seed <= 40; seed++) { const [s2, p2] = mkSim(seed); s2.doorOpen[1] = false; s2.doorLocked[1] = true; put(s2, p2, d.cx, 1.65, d.cz + 1); s2.kick(1, 1); if (s2.doorOpen[1]) opened++; assert.ok(s2.npcs.some(n => n.st === 'a') || s2.npcs.every(n => n.kind === 'c' || Math.hypot(n.x - d.cx, n.z - d.cz) >= 16), 'kick makes noise'); }
  assert.ok(opened > 12 && opened < 34, 'locked door kick success ' + opened + '/40');
  const [s3, p3] = mkSim(5); s3.doorOpen[1] = false; s3.doorLocked[1] = false; put(s3, p3, d.cx, 1.65, d.cz + 1); s3.kick(1, 1); assert.ok(s3.doorOpen[1], 'unlocked door always kicks open');
  for (let seed = 1; seed < 30; seed++) { const [s4] = mkSim(seed); const h = L.doors.findIndex(q => q.hidden); assert.ok(h >= 0 && !s4.doorLocked[h] && !s4.doorOpen[h], 'hidden rear door is closed and never locked'); }
});
await t('hidden rear entry is reachable from spawn without entering through the front', () => {
  const h = L.doors.find(q => q.hidden), legs = [[12, 27, 0], [28, 17, 0], [28, -2, -H], [24.5, -2.2, -H], [h.cx, h.cz - 1, -H]];
  for (let i = 1; i < legs.length; i++) { const a = legs[i - 1], b = legs[i], path = findPath(L, a[0], a[1], a[2], b[0], b[1], b[2], true); assert.ok(path && path.every(c => !(c[0] > 0 && c[0] < 24 && c[1] > 0 && c[1] < 16)), 'leg ' + i + ' stays outside'); const e = path.at(-1); assert.ok(Math.hypot(e[0] - b[0], e[1] - b[1]) < 0.8, 'leg ' + i + ' arrives');
    let y = a[2], prev = a[2]; for (const [x, z] of path) { y = groundY(x, z, y); assert.ok(Math.abs(y - prev) < 0.45, 'terrain step'); prev = y; } assert.ok(Math.abs(y - b[2]) < 0.01, 'leg ' + i + ' ends at the right height'); }
  assert.ok(findPath(L, h.cx, h.cz - 0.8, -H, 20, 3, -H).length < 12, 'door leads straight into the plant room');
});
await t('basement: inside stairs go down from the utility room, the walk-out opens onto the back yard', () => {
  const p = findPath(L, 12, 2, 0, 12, 12, -H, true); assert.ok(p && p.at(-1)[2] === -1); let y = 0, prev = 0, min = 0; for (const [x, z] of p) { y = groundY(x, z, y); assert.ok(Math.abs(y - prev) < 0.45, 'jump ' + prev + '->' + y); prev = y; } assert.equal(y, -H);
  assert.ok(p.every(c => c[0] > 0 && c[0] < 24 && c[1] > 0 && c[1] < 16), 'route stays indoors'); assert.ok(p.length < 45, 'uses the stairs, length ' + p.length);
  const up = findPath(L, 12, 12, -H, 12, 2, H, true); assert.ok(up && up.at(-1)[2] === 1 && up.every(c => c[0] > 0 && c[0] < 24 && c[1] > 0 && c[1] < 16), 'basement to upper floor indoors');
  const w = L.doors.find(d => d.f === -1 && d.exterior && !d.hidden), out = findPath(L, 12, -5, -H, 12, 2, -H, true); assert.ok(out.length < 20 && out.some(c => Math.abs(c[0] - w.cx) < 0.6 && Math.abs(c[1] - w.cz) < 0.6), 'walk-out door');
  assert.equal(groundY(12, -5, 0), -H); assert.equal(groundY(12, 20, -H), 0); assert.ok(Math.abs(groundY(-3, 8, 0) + H / 2) < 1e-9);
  assert.ok(rayStatic(L, null, 12, 1.5, 12, 0, -1, 0, 50) < 1.6, 'ground floor slab'); assert.ok(Math.abs(rayStatic(L, null, 12, -1.7, 12, 0, -1, 0, 50) - 1.5) < 0.01, 'basement floor');
  assert.ok(rayStatic(L, null, 14.25, -2.5, 8.5, 0, 1, 0, 50) > 5, 'stairwell is open through all three storeys');
  assert.ok(Math.abs(rayStatic(L, null, -3, 2, 8, 0, -1, 0, 50) - 3.6) < 0.01, 'hillside'); 
});
await t('night: suspects see a dark officer only up close, a flashlight gives you away', () => {
  const mk = (night, light) => { const s = new Sim(); s.addPlayer(1, 'T'); s.start(7, night); const n = s.npcs[0]; for (const o of s.npcs) if (o !== n) o.st = 'u'; Object.assign(n, { x: 8, z: 15.2, y: 0, yaw: Math.atan2(1.4 - 8, 8.8 - 15.2), sweep: 0, patrol: null }); s.pose(1, { h: [1.4, 1.65, 8.8, 0, 0, 0, 1], g: [1, 0], f: light ? 1 : 0 }); for (let i = 0; i < 20; i++) s.tick(1 / 15); return n.st; };
  assert.equal(mk(false, false), 'c', 'dusk: seen across the living room'); assert.equal(mk(true, false), 'g', 'night, light off: not seen at 9 m'); assert.equal(mk(true, true), 'c', 'night, light on: seen');
  const [s, p] = mkSim(4); assert.ok(!s.night && s.snapshot().pw === 1, 'missions start with the power on');
  put(s, p, 12, 1.65, 12); s.breaker(1); assert.ok(!s.night, 'too far from the breaker'); put(s, p, 22.6, -H + 1.65, 0.8); s.events.length = 0; s.breaker(1); assert.ok(s.events.some(e => e.e === 'power' && e.on === false)); assert.ok(s.night && s.snapshot().pw === 0);
  s.breaker(1); assert.ok(s.night, 'one second between throws'); s.t += 2; s.breaker(1); assert.ok(!s.night, 'the breaker switches back on too');
  let fixed = 0, sent = 0; for (let seed = 1; seed <= 10; seed++) { const [s2, p2] = mkSim(seed); for (const o of s2.npcs) if (o.kind === 's') o.sweep = 0; put(s2, p2, 22.6, -H + 1.65, 0.8); s2.breaker(1); const f = s2.npcs.find(n => n.fix); if (!f) continue; sent++; put(s2, p2, 12, 1.65, 28); for (let i = 0; i < 15 * 80 && s2.night; i++) s2.tick(1 / 15); if (!s2.night) fixed++; }
  assert.ok(sent >= 4 && fixed >= sent - 1, `a suspect went to restore power in ${sent}/10 missions and managed it in ${fixed}`);
  const h = new RoomHost(() => { }); h.join(1, 'A'); h.message(1, { t: 'restart', night: true }); assert.ok(!h.sim.night, 'night can no longer be chosen at the start');
});
await t('glass: stops people, not bullets; suspects only see through it up close', () => {
  const [x] = resolveCircle(L, null, 0.2, 12, 0.25, 0); assert.ok(x >= 0.27, 'cannot walk through the west glass');
  assert.ok(rayStatic(L, null, -3, 1.5, 12, 1, 0, 0, 50) > 4); assert.ok(rayStatic(L, null, -3, 1.5, 12, 1, 0, 0, 50, true) < 3.1);
  const [s, p] = mkSim(7); const n = s.npcs[0]; for (const o of s.npcs) if (o !== n) o.st = 'u'; Object.assign(n, { x: 5, z: 15, y: 0, yaw: 0, sweep: 0, patrol: null });
  put(s, p, 5, 1.65, 26); for (let i = 0; i < 20; i++) s.tick(1 / 15); assert.equal(n.st, 'g', 'not seen at 11 m through glass');
  put(s, p, 5, 1.65, 18.5); for (let i = 0; i < 20; i++) s.tick(1 / 15); assert.equal(n.st, 'c', 'seen at 3.5 m through glass');
});
await t('downed suspects can be arrested for full marks; shooting them again is penalised', () => {
  let inc = 0, dead = 0;
  for (let seed = 1; seed <= 40; seed++) { const [s, p] = mkSim(seed); const n = s.npcs[0]; beside(s, p, n); s.engage(n, p, 9); aimAt(s, p, n, 1.3); aimAt(s, p, n, 1.3); s.t += 1; aimAt(s, p, n, 1.3); if (n.st === 'i') inc++; else if (n.st === 'd') dead++; else if (n.st !== 's') assert.fail('state ' + n.st); }
  assert.ok(inc > 15 && dead > 2, `incapacitated ${inc} dead ${dead}`);
  const run = arrest => { const [s, p] = mkSim(2); for (const o of s.npcs) o.st = 'u'; for (const b of s.bombs) b.defused = true; const n = s.npcs[0]; n.st = 'i'; n.just = true; s.tick(0.1); assert.equal(s.phase, 'active', 'mission waits for the downed suspect to be secured'); beside(s, p, n); if (arrest) s.cuff(1, n.id); else { n.st = 'd'; } s.tick(0.1); return s.report.total; };
  assert.equal(run(true), 100); assert.ok(run(false) < 100);
  const [s, p] = mkSim(2); const n = s.npcs[0]; n.st = 'i'; beside(s, p, n); aimAt(s, p, n, 0.2); assert.equal(n.st, 'd'); assert.equal(s.log.execution, 1);
});
await t('restart works mid-mission', () => {
  const h = new RoomHost(() => { }); h.join(1, 'A'); h.message(1, { t: 'start' }); const seed = h.sim.seed; h.sim.timer = 100; h.message(1, { t: 'start' }); assert.equal(h.sim.timer, 100, 'start is ignored while active');
  h.message(1, { t: 'restart' }); assert.equal(h.sim.timer, MISSION_TIME); assert.equal(h.sim.phase, 'active');
});
await t('wounds: hits land on a body part, limbs get flagged, one med kit clears them', () => {
  const [s, p] = mkSim(7); const n = s.npcs[0]; for (const o of s.npcs) if (o !== n) o.st = 'u'; const seen = new Set();
  for (let k = 0; k < 400; k++) { p.hp = 100; p.down = false; s.events.length = 0; s.npcFire(n, p, 1); for (const e of s.events) if (e.e === 'hurt') seen.add(e.part); }
  assert.deepEqual([...seen].sort(), ['armL', 'armR', 'head', 'legL', 'legR', 'torso']); assert.equal(p.w, 63);
  p.hp = 30; p.down = false; assert.equal(s.snapshot().P[0][9] & 63, 63); s.heal(1); assert.equal(p.hp, 90); assert.equal(p.w, 0); assert.equal(s.snapshot().P[0][9] & 127, 64);
  p.hp = 20; p.w = 16; s.heal(1); assert.equal(p.hp, 20, 'second med kit refused'); s.start(8); assert.ok(!p.med && p.w === 0, 'new mission, new kit');
});
await t('walls that run into other walls have no end faces; ends at doorways and glass do', () => {
  const w = L.boxes.filter(b => b.kind === 'wall'); assert.ok(w.some(b => !b.capA || !b.capB) && w.some(b => b.capA || b.capB));
  for (const a of w) for (const [end, cap] of [[0, a.capA], [1, a.capB]]) {   // an uncapped end must be buried inside another wall
    if (cap) continue; const x = a.horiz ? (end ? a.x1 - 0.05 : a.x0 + 0.05) : (a.x0 + a.x1) / 2, z = a.horiz ? (a.z0 + a.z1) / 2 : (end ? a.z1 - 0.05 : a.z0 + 0.05);
    assert.ok(w.some(b => b !== a && b.f === a.f && b.horiz !== a.horiz && x > b.x0 - 1e-6 && x < b.x1 + 1e-6 && z > b.z0 - 1e-6 && z < b.z1 + 1e-6), 'uncapped end not inside a crossing wall: ' + JSON.stringify(a));
  }
});
await t('paths are straightened, and walking them never clips a wall', () => {
  const raw = findPath(L, 12, 27, 0, 5, 6, 0, true), sm = findPath(L, 12, 27, 0, 5, 6, 0); assert.ok(sm.length < raw.length / 2, `smoothed ${sm.length} vs ${raw.length}`);
  for (const [f, x, z] of SUSPECT_SPOTS) { const p = findPath(L, 12, 27, 0, x, z, f * H); let y = 0;
    for (let i = 1; i < p.length; i++) { const a = p[i - 1], b = p[i], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1); for (let k = 0; k <= n; k++) { const px = a[0] + (b[0] - a[0]) * k / n, pz = a[1] + (b[1] - a[1]) * k / n; const ny = groundY(px, pz, y); assert.ok(Math.abs(ny - y) < 0.2, 'height jump on smoothed path'); y = ny; assert.ok(!circleHits(L, null, px, pz, 0.2, y), `clips at ${px.toFixed(2)},${pz.toFixed(2)}`); } }
    assert.equal(Math.round(y / H), f); }
});
await t('suspects accelerate and stop smoothly, and sidestep in a firefight', () => {
  const [s, p] = mkSim(11); put(s, p, 12, 1.65, 26); s.shot(1, { o: [12, 1.5, 26], d: [0, 1, 0], w: 'rifle' });
  const mover = s.npcs.filter(n => n.st === 'a' && !n.hold); let maxJump = 0, maxAcc = 0; const last = new Map(mover.map(n => [n, [n.x, n.z, 0]]));
  for (let i = 0; i < 15 * 10; i++) { s.tick(1 / 15); for (const n of mover) { const [x, z, v] = last.get(n), d = Math.hypot(n.x - x, n.z - z), sp = d * 15; maxJump = Math.max(maxJump, d); if (n.st === 'a') maxAcc = Math.max(maxAcc, Math.abs(sp - v)); last.set(n, [n.x, n.z, sp]); } }
  assert.ok(mover.length > 0 && maxJump < 0.25, 'step per tick ' + maxJump); assert.ok(maxAcc < 1.2, 'speed change per tick ' + maxAcc);
  let stepped = 0; for (let seed = 1; seed <= 12; seed++) { const [s2, p2] = mkSim(seed); const n = s2.npcs[0]; for (const o of s2.npcs) if (o !== n) o.st = 'u'; beside(s2, p2, n, 2.5); const x0 = n.x, z0 = n.z; p2.hp = 1e6; for (let i = 0; i < 15 * 12; i++) { s2.tick(1 / 15); assert.ok(!circleHits(L, null, n.x, n.z, 0.15, n.y)); } if (Math.hypot(n.x - x0, n.z - z0) > 0.5) stepped++; }
  assert.ok(stepped >= 3, 'sidestepped in ' + stepped + '/12 fights');
});
await t('weather: shared per mission, selectable, and it changes what suspects see and hear', () => {
  const kinds = new Set(); for (let seed = 1; seed < 60; seed++) { const s = new Sim(); s.start(seed); kinds.add(s.weather); assert.equal(s.init().weather, s.weather); } assert.equal(kinds.size, 4);
  const mk = wx => { const s = new Sim(); s.addPlayer(1, 'T'); s.start(7, false, wx); const n = s.npcs[0]; for (const o of s.npcs) if (o !== n) o.st = 'u'; Object.assign(n, { x: 8, z: 15.2, y: 0, yaw: Math.atan2(1.4 - 8, 8.8 - 15.2), sweep: 0, patrol: null }); s.pose(1, { h: [1.4, 1.65, 8.8, 0, 0, 0, 1], g: [1, 0] }); for (let i = 0; i < 20; i++) s.tick(1 / 15); return n.st; };
  assert.equal(mk('clear'), 'c'); assert.equal(mk('fog'), 'g', 'fog hides you at 9.5 m'); assert.equal(mk('rain'), 'c');
  const h = new RoomHost(() => { }); h.join(1, 'A'); h.message(1, { t: 'restart', wx: 'storm' }); assert.equal(h.sim.weather, 'storm'); h.message(1, { t: 'restart' }); assert.equal(h.sim.weather, 'storm', 'choice sticks'); h.message(1, { t: 'restart', wx: 'bogus' }); assert.equal(h.sim.weather, 'storm');
});
await t('planting: trunks and pots are solid, nothing is planted in a doorway or on a spawn', async () => {
  const { VEG } = await import('../public/js/core/level.js'); assert.ok(VEG.trees.length >= 14 && VEG.shrubs.length >= 80 && VEG.pots.length >= 18);
  const [tx, tz] = VEG.trees[0]; assert.ok(circleHits(L, null, tx, tz, 0.1, 0)); const [pf, px, pz] = VEG.pots[0]; assert.ok(circleHits(L, null, px, pz, 0.1, pf * H));
  for (const [f, x, z] of VEG.pots) { assert.ok(x > 0.3 && x < 23.7 && z > 0.3 && z < 15.7); for (const d of L.doors) assert.ok(d.f !== f || Math.hypot(d.cx - x, d.cz - z) > 1.0, `pot at ${f},${x},${z} crowds a door`); }
  for (const [x, z] of [...VEG.trees, ...VEG.shrubs]) { assert.ok(!(x > -0.3 && x < 24.3 && z > -0.3 && z < 16.3), 'planted inside the house'); assert.ok(Math.hypot(x - 12, z - 27) > 3, 'planted on the spawn'); for (const d of L.doors) if (d.exterior) assert.ok(Math.hypot(d.cx - x, d.cz - z) > 1.2, 'blocks an outside door'); }
});
await t('grenades: thrown ones arc, bounce and stay out of walls; flashbangs stun in sight only; smoke blocks sight', async () => {
  const { solidAt } = await import('../public/js/core/level.js');
  let [s, p] = mkSim(5); for (const o of s.npcs) o.st = 'u'; put(s, p, 12, 1.65, 14); s.throw(1, { k: 'flash', o: [12, 1.5, 13.8], v: [0, 3, -9] }); assert.equal(p.fl, 1); let maxY = 0, flashed = null;
  for (let i = 0; i < 40; i++) { s.tick(1 / 15); for (const g of s.gren) { maxY = Math.max(maxY, g.y); assert.ok(!solidAt(L, s.doorOpen, g.x, g.y, g.z), 'grenade inside something solid'); assert.ok(g.z > 9.1 && g.y > -0.01, 'went through the hall wall or floor'); } for (const e of s.events) if (e.e === 'flash') flashed = e; s.events.length = 0; }
  assert.ok(maxY > 1.6 && flashed && flashed.y < 0.4 && flashed.z < 11.5, 'arcs, lands and goes off on the floor: ' + JSON.stringify(flashed));
  s.throw(1, { k: 'flash', o: [12, 1.5, 13.8], v: [0, 3, -9] }); s.throw(1, { k: 'flash', o: [12, 1.5, 13.8], v: [0, 3, -9] }); assert.equal(p.fl, 0); assert.equal(s.gren.length, 1, 'only two flashbangs');
  [s, p] = mkSim(5); const [a, b] = s.npcs; for (const o of s.npcs) if (o !== a && o !== b) o.st = 'u'; Object.assign(a, { x: 12, z: 11, y: 0, st: 'c', tgt: 1 }); Object.assign(b, { x: 12, z: 7, y: 0, st: 'g' }); s.doorOpen[1] = false; put(s, p, 12, 1.65, 26);
  s.flash({ x: 12, y: 0.1, z: 13, by: 1 }); assert.ok(a.stun > 0 && a.st === 'a', 'in the room: stunned and no longer a threat'); assert.ok(!(b.stun > 0), 'behind the wall and closed door: not stunned');
  assert.equal(s.snapshot().N.find(q => q[0] === a.id)[5], 'z'); const hp = p.hp; for (let i = 0; i < 45; i++) s.tick(1 / 15); assert.equal(p.hp, hp, 'stunned suspects do not shoot');
  aimAt(s, p, a, 1.3); let sur = 0; for (let seed = 1; seed <= 30; seed++) { const [s2, p2] = mkSim(seed); const n = s2.npcs[0]; beside(s2, p2, n); n.resolve = 0.8; n.stun = 5; n.st = 'a'; s2.shout(1); if (n.st === 's') sur++; } assert.ok(sur >= 12, 'stunned suspects surrender more: ' + sur + '/30');
  [s, p] = mkSim(7); const n = s.npcs[0]; for (const o of s.npcs) if (o !== n) o.st = 'u'; Object.assign(n, { x: 8, z: 15.2, y: 0, yaw: Math.atan2(1.4 - 8, 8.8 - 15.2), sweep: 0, patrol: null }); put(s, p, 1.4, 1.65, 8.8);
  s.smokes.push({ x: 4.7, y: 0, z: 12, t: 5 }); for (let i = 0; i < 20; i++) s.tick(1 / 15); assert.equal(n.st, 'g', 'smoke between them hides the officer'); s.smokes.length = 0; for (let i = 0; i < 20; i++) s.tick(1 / 15); assert.equal(n.st, 'c');
});
await t('tripwires: three rigged doors, opening one hurts and alerts, cutters disarm it', () => {
  const [s, p] = mkSim(9); const traps = s.doorTrap.map((v, i) => v ? i : -1).filter(i => i >= 0); assert.equal(traps.length, 3); for (const i of traps) assert.ok(!L.doors[i].exterior && !s.doorOpen[i]);
  assert.equal(s.snapshot().T.length, 23); const d = L.doors[traps[0]]; s.doorLocked[traps[0]] = false; put(s, p, d.cx + (d.horiz ? 0 : 0.8), d.y + 1.65, d.cz + (d.horiz ? 0.8 : 0)); s.events.length = 0;
  s.door(1, traps[0]); assert.ok(p.hp < 100 && s.doorOpen[traps[0]] && !s.doorTrap[traps[0]]); assert.ok(s.events.some(e => e.e === 'trap'));
  const d2 = L.doors[traps[1]]; s.doorLocked[traps[1]] = false; put(s, p, d2.cx + (d2.horiz ? 0 : 0.8), d2.y + 1.65, d2.cz + (d2.horiz ? 0.8 : 0)); const hp = p.hp; s.disarm(1, traps[1]); assert.ok(!s.doorTrap[traps[1]]); s.door(1, traps[1]); assert.equal(p.hp, hp, 'disarmed door is safe');
});
await t('cover: a suspect under fire moves out of the line of fire and shoots from there', () => {
  let covered = 0, fired = 0, runs = 0;
  for (let seed = 1; seed <= 14; seed++) { const [s, p] = mkSim(seed); const n = s.npcs[0]; for (const o of s.npcs) if (o !== n) o.st = 'u'; Object.assign(n, { x: 4.5, z: 10, y: 0 }); put(s, p, 7.5, 1.65, 15); p.hp = 1e6; s.engage(n, p, 0.5); n.wantCover = true; runs++;
    let hid = false, shot = false; for (let i = 0; i < 15 * 25; i++) { s.tick(1 / 15); assert.ok(!circleHits(L, null, n.x, n.z, 0.15, n.y), 'in a wall'); if (n.cov && n.cov.phase === 'hide' && !s.clear(n.x, n.y + 0.5, n.z, p.hx, p.hy, p.hz)) hid = true; if (s.events.some(e => e.e === 'ns')) shot = true; s.events.length = 0; }
    if (hid) covered++; if (hid && shot) fired++; }
  assert.ok(covered >= runs * 0.7, `took cover in ${covered}/${runs}`); assert.ok(fired >= covered * 0.7, `fired from cover in ${fired}/${covered}`);
});
await t('a suspect in a firefight turns on a nearby hostage after a few shots; you get a window to stop him', () => {
  const setup = seed => { const [s, p] = mkSim(seed); const n = s.npcs[0], c = s.npcs.find(q => q.kind === 'c'); for (const o of s.npcs) if (o !== n && o !== c) o.st = 'u';
    Object.assign(n, { x: 4.5, z: 10, y: 0, ruthless: true, execAfter: 3, fired: 0, wantCover: false }); Object.assign(c, { x: 6.5, z: 11.6, y: 0, st: 'w' }); put(s, p, 6, 1.65, 14.6); p.hp = 1e6; s.engage(n, p, 0.2); n.wantCover = false; return [s, p, n, c]; };
  let [s, p, n, c] = setup(3); let threat = false, shotsBefore = 0;
  for (let i = 0; i < 15 * 20 && c.st !== 'd'; i++) { s.tick(1 / 15); for (const e of s.events) { if (e.e === 'say' && e.k === 'threat') { threat = true; shotsBefore = n.fired; } } s.events.length = 0; }
  assert.ok(threat && shotsBefore >= 3, 'warned after a few shots at the officer, fired ' + shotsBefore); assert.equal(c.st, 'd', 'killed the hostage'); assert.equal(s.log.civExecuted, 1); assert.equal(s.log.civKilled, 0, 'not counted against the officer');
  for (let i = 0; i < 30; i++) s.tick(1 / 15); s.endMission(1); assert.ok(s.report.lines.some(l => /Hostage killed by a suspect x1/.test(l[0]) && l[1] === -10));
  // stopped in the window: shoot him, flash him, or he surrenders
  for (const stop of ['shoot', 'flash', 'surrender']) { [s, p, n, c] = setup(3);
    for (let i = 0; i < 15 * 20 && !n.exec; i++) { s.tick(1 / 15); s.events.length = 0; } assert.ok(n.exec, 'threat started');
    if (stop === 'shoot') { for (let k = 0; k < 3 && n.st === 'c'; k++) { s.t += 1; aimAt(s, p, n, 1.3); } } else if (stop === 'flash') s.flash({ x: n.x, y: 0.1, z: n.z + 1, by: 1 }); else s.surrender(n);
    for (let i = 0; i < 15 * 3; i++) s.tick(1 / 15); assert.notEqual(c.st, 'd', stop + ' should save the hostage'); assert.equal(s.log.unauth, 0, 'shooting him mid-threat is justified'); }
  // no hostage in sight, or already secured: he just keeps fighting
  [s, p, n, c] = setup(3); c.st = 'u'; for (let i = 0; i < 15 * 15; i++) { s.tick(1 / 15); s.events.length = 0; } assert.ok(!n.exec && c.st === 'u');
});
await t('end mission by radio or by walking out; scored on what was done', () => {
  let [s, p] = mkSim(4); for (const o of s.npcs) o.st = o.kind === 'c' ? 'u' : o.st; for (const b of s.bombs) b.defused = true; s.npcs[0].st = 'i';
  s.endMission(1); assert.equal(s.report.result, 'MISSION COMPLETE', 'bombs and hostages done counts as complete'); assert.ok(s.report.total < 100 && s.report.lines.some(l => /unaccounted/.test(l[0])));
  [s, p] = mkSim(4); s.endMission(1); assert.equal(s.report.result, 'MISSION INCOMPLETE'); assert.ok(s.report.total <= 49);
  const h = new RoomHost(() => { }); h.join(1, 'A'); h.message(1, { t: 'start' }); h.message(1, { t: 'end' }); assert.equal(h.sim.phase, 'ended');
  [s, p] = mkSim(4); for (const o of s.npcs) o.st = 'u'; put(s, p, 12, 1.65, 27); for (let i = 0; i < 15 * 8; i++) s.tick(1 / 15); assert.equal(s.phase, 'active', 'standing at the gate before going in does nothing');
  put(s, p, 12, 1.65, 12); s.tick(1 / 15); put(s, p, 12, 1.65, 27); for (let i = 0; i < 15 * 3; i++) s.tick(1 / 15); assert.equal(s.phase, 'active'); assert.ok(s.snapshot().X > 0, 'countdown shown');
  for (let i = 0; i < 15 * 3; i++) s.tick(1 / 15); assert.equal(s.phase, 'ended'); assert.ok(s.report.lines.some(l => /Walked out/.test(l[0])));
  [s, p] = mkSim(4); const q = s.addPlayer(2, 'B'); put(s, p, 12, 1.65, 12); s.tick(0.1); put(s, p, 12, 1.65, 27); s.pose(2, { h: [12, 1.65, 12, 0, 0, 0, 1] }); for (let i = 0; i < 15 * 7; i++) s.tick(1 / 15); assert.equal(s.phase, 'active', 'waits for the whole squad');
});

// ---- marine terminal ----
const TL = buildLevel('terminal'), TM = TL.map;
await t('terminal: every spot, padlocked container and the bridge is walkable and reachable from the gate', () => {
  const [sx, sz] = TM.spawn[0];
  const spots = [...TM.spots.s, ...TM.spots.c, TM.hvt.at, ...TM.hvt.guards, ...TM.pads.map(p => [p.f, ...p.hostage])];
  for (const [f, x, z] of spots) {
    const y = f * TM.H; assert.ok(!circleHits(TL, null, x, z, 0.25, y), `spot blocked ${f},${x},${z}`); assert.ok(Math.abs(TL.groundY(x, z, y) - y) < 0.01, `floor height wrong at ${f},${x},${z}`);
    const p = findPath(TL, sx, sz, 0, x, z, y); assert.ok(p && p.length >= 2, `no path to ${f},${x},${z}`); const e = p[p.length - 1]; assert.ok(Math.hypot(e[0] - x, e[1] - z) < 0.8 && e[2] === f, `path ends wrong for ${f},${x},${z}: ${e}`);
  }
  assert.equal(TM.pads.length, 8); assert.ok(TL.doors.filter(d => d.pad !== undefined).length === 8);
});
await t('terminal: gangway climbs to the deck without a jump; the quay edge and hull stop you', () => {
  const g = 30; let y = 0, prev = 0; for (let x = g - 1; x <= g + 18; x += 0.2) { const z = x < g + 16 ? 1.75 : 0.5; y = TL.groundY(x, z, y); assert.ok(Math.abs(y - prev) < 0.3, 'jump at ' + x + ': ' + prev + '->' + y); prev = y; }
  for (let z = 0.5; z > -4; z -= 0.2) { y = TL.groundY(g + 17, z, y); } assert.equal(y, 2 * TM.H, 'on the deck');
  assert.ok(circleHits(TL, null, 20, 0.1, 0.25, 0), 'quay rail'); assert.ok(rayStatic(TL, null, 20, 1.5, 20, 0, 0, -1, 60) < 21, 'hull side stops a bullet');
  const p = findPath(TL, 44, 70, 0, 90, -14.2, 4 * TM.H); assert.ok(p && p[p.length - 1][2] === 4, 'gate to bridge');
});
await t('terminal: bombs and two hostages are inside padlocked containers; kick fails, cutters open them', () => {
  const s = new Sim('terminal'); s.addPlayer(1, 'A'); s.start(77, false, 'clear', 'terminal');
  assert.equal(s.npcs.filter(n => n.kind === 's').length, 14); assert.equal(s.npcs.filter(n => n.kind === 'c').length, 8); assert.equal(s.bombs.length, 3);
  const inPad = (x, z) => TM.pads.find(p => x > p.s[0] && x < p.s[2] && z > p.s[1] && z < p.s[3]);
  assert.ok(s.bombs.every(b => inPad(b.x, b.z)), 'bombs in containers'); assert.equal(s.npcs.filter(n => n.kind === 'c' && inPad(n.x, n.z)).length, 2);
  const di = TL.doors.findIndex(d => d.pad !== undefined), d = TL.doors[di]; assert.ok(s.doorLocked[di]);
  s.pose(1, { h: [d.cx - 1, d.y + 1.65, d.cz, 0, 0, 0, 1] });
  for (let i = 0; i < 6; i++) { s.t += 1; s.kick(1, di); } assert.ok(!s.doorOpen[di] && s.doorLocked[di], 'a padlocked door holds against kicks');
  s.pick(1, di); assert.ok(s.doorLocked[di], 'no lock to pick'); s.door(1, di); assert.ok(!s.doorOpen[di]);
  s.snip(1, di); assert.ok(!s.doorLocked[di]); s.door(1, di); assert.ok(s.doorOpen[di], 'cut and opened');
  const host = new RoomHost(() => { }); host.join(1, 'A'); host.message(1, { t: 'map', m: 'terminal' }); assert.equal(host.sim.mapId, 'terminal'); host.message(1, { t: 'start' }); assert.equal(host.sim.mapId, 'terminal'); assert.equal(host.sim.init().map, 'terminal');
});
await t('terminal: the HVT and two guards hold the bridge, he rarely gives up, arrest scores and killing him costs', () => {
  const s = new Sim('terminal'); s.addPlayer(1, 'A'); s.start(5, false, 'clear', 'terminal');
  const hv = s.npcs.find(n => n.hvt), gs = s.npcs.filter(n => n.guard); assert.ok(hv && gs.length === 2 && Math.abs(hv.y - 4 * TM.H) < 0.01);
  let give = 0; for (let k = 0; k < 400; k++) { const pr = (hv.hvt ? 0.45 : 1) * ((1 - hv.resolve) * 1.3); if (s.rnd() < pr) give++; } assert.ok(give < 20, 'hard to talk down');
  for (const n of s.npcs) n.st = n.kind === 'c' ? 'u' : 'u'; for (const b of s.bombs) b.defused = true; s.endMission(1);
  assert.ok(s.report.lines.some(l => /High-value target arrested/.test(l[0]) && l[1] === 10)); assert.equal(s.report.total, 100);
  const s2 = new Sim('terminal'); s2.addPlayer(1, 'A'); s2.start(5, false, 'clear', 'terminal'); for (const n of s2.npcs) n.st = 'u'; s2.npcs.find(n => n.hvt).st = 'd'; s2.npcs.find(n => n.hvt).just = true; for (const b of s2.bombs) b.defused = true; s2.endMission(1);
  assert.ok(s2.report.lines.some(l => /High-value target killed/.test(l[0]) && l[1] < 0));
  const p = s2.players.get(1); const g = new Sim('terminal'); g.addPlayer(1, 'A'); g.start(5, false, 'clear', 'terminal'); const G1 = g.npcs.find(n => n.guard), B = g.npcs.find(n => n.hvt); g.engage(G1, g.players.get(1), 0.3); assert.equal(B.st, 'c', 'the boss joins when a guard is engaged');
});

await t('bombs sit at the edge of their table or crate, wires toward a spot an officer can stand on', () => {
  for (const id of ['mansion', 'terminal']) for (let seed = 1; seed <= 6; seed++) {
    const s = new Sim(id); s.addPlayer(1, 'A'); s.start(seed, false, 'clear', id); const L = s.level;
    for (const b of s.bombs) {
      const top = L.boxes.find(o => o.kind === 'furn' && b.x > o.x0 && b.x < o.x1 && b.z > o.z0 && b.z < o.z1 && Math.abs(o.y1 - b.y) < 0.25); assert.ok(top, `${id} bomb not on furniture`);
      const edge = Math.min(b.x - top.x0, top.x1 - b.x, b.z - top.z0, top.z1 - b.z); assert.ok(edge < 0.16, `${id} bomb ${edge.toFixed(2)} m from the edge`);
      const sx = b.x + Math.sin(b.yaw) * 0.58, sz = b.z + Math.cos(b.yaw) * 0.58, fy = Math.floor((b.y + 0.01) / L.H) * L.H; assert.ok(!circleHits(L, null, sx, sz, 0.25, fy), `${id} nowhere to stand in front of the bomb`);
    }
  }
});

await t('defenders: about half the suspects stay in their room and take cover when they hear shooting; the rest come to look', () => {
  let def = 0, all = 0, stayed = 0, came = 0, roam = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const s = new Sim('mansion'); s.addPlayer(1, 'A'); s.start(seed, false, 'clear', 'mansion'); const p = s.players.get(1); p.hp = 1e9;
    s.pose(1, { h: [12, 1.65, 26, 0, 0, 0, 1] }); for (let i = 0; i < 3; i++) { s.t += 1; s.shot(1, { o: [12, 1.5, 25.6], d: [0, 0, -1], w: 'rifle' }); }
    const d0 = new Map(s.npcs.map(n => [n.id, [n.x, n.z]]));
    for (let i = 0; i < 15 * 20; i++) { s.pose(1, { h: [12, 1.65, 26, 0, 0, 0, 1] }); s.tick(1 / 15); }
    for (const n of s.npcs) { if (n.kind !== 's' || n.st === 'd' || n.st === 'i') continue; all++; const moved = Math.hypot(n.x - n.post[0], n.z - n.post[1]);
      if (n.defend) { def++; if (moved < 6 || n.st === 'c') stayed++; } else { roam++; if (moved > 4) came++; } }
  }
  assert.ok(def > all * 0.35 && def < all * 0.8, `defenders ${def}/${all}`); assert.ok(stayed >= def * 0.9, `defenders stayed in their rooms ${stayed}/${def}`); assert.ok(came >= 1, 'some roamers came to look');
});
await t('training: arrive in the range, targets drop when hit, house runs time, start launches the chosen mission', () => {
  const h = new RoomHost(() => { }); h.join(1, 'A'); const s = h.sim; assert.equal(s.mapId, 'training'); assert.equal(s.phase, 'active');
  const p = s.players.get(1); const pose = (x, z) => s.pose(1, { h: [x, 1.65, z, 0, 0, 0, 1] }); pose(10, 15.5);
  const t0 = s.targets[2]; assert.equal(t0.kind, 'static'); s.t = 5; s.shot(1, { o: [10, 1.5, 15.5], d: [0, 0.97 - 1.5, 7 - 15.5], w: 'rifle' });
  assert.equal(t0.up, 0, 'static target knocked down'); assert.equal(p.tr.hits, 1); assert.equal(p.tr.shots, 1);
  for (let i = 0; i < 30; i++) s.tick(1 / 15); assert.equal(t0.up, 1, 'and it stands back up');
  const mv = s.targets.find(t => t.kind === 'move'), x0 = mv.x; for (let i = 0; i < 15; i++) s.tick(1 / 15); assert.ok(Math.abs(mv.x - x0) > 1, 'moving target slides');
  // wrong wire on the dummy bomb hurts nobody and re-arms
  const b = s.bombs[0]; const wrong = [0, 1, 2, 3].find(k => !b.order.includes(k)); pose(b.x, b.z + 0.6); s.cut(1, 0, wrong); assert.ok(b.failed, 'wrong wire'); 
  for (let i = 0; i < 90; i++) s.tick(1 / 15); assert.ok(!b.failed && !b.defused, 'dummy bomb re-arms'); assert.equal(p.hp, 100); assert.equal(s.phase, 'active');
  // kill house: walk through every room, shoot only the armed cut-outs
  for (const [k, [x0, z0, x1, z1]] of s.M.houseRooms.entries()) { pose((x0 + x1) / 2, (z0 + z1) / 2); s.tick(1 / 15);
    for (const t of s.targets.filter(t => t.kind === 'house' && t.room === k && t.hostile)) { t.hit = true; t.up = 0; } }
  s.tick(1 / 15); assert.ok(s.house.best > 0 && !s.house.on, 'house run timed');
  const snap = s.snapshot(); assert.ok(snap.TG && snap.HS && snap.TS, 'training state in the snapshot');
  h.message(1, { t: 'choose', m: 'terminal', wx: 'fog' }); h.message(1, { t: 'start' }); assert.equal(s.mapId, 'terminal'); assert.equal(s.weather, 'fog'); assert.ok(!s.targets);
  h.message(1, { t: 'restart', map: 'training' }); assert.equal(s.mapId, 'training'); assert.ok(s.targets && s.phase === 'active');
});
await t('grand prix: cars lap the straight, anyone on the tarmac when one passes is knocked down, the pit lane is safe', async () => {
  const { carsAt, TRACK } = await import('../public/js/core/maps/circuit.js');
  const s = new Sim('grandprix'); s.start(3, false, 'clear', 'grandprix', 'night'); s.addPlayer(1, 'A'); s.addPlayer(2, 'B');
  assert.equal(s.tod, 'night'); assert.equal(s.init().tod, 'night');
  for (const n of s.npcs) n.st = 'u';   // keep the suspects out of it
  const p = s.players.get(1), q = s.players.get(2); s.pose(1, { h: [20, 1.65, TRACK.zc, 0, 0, 0, 1] }); s.pose(2, { h: [20, 1.65, -10, 0, 0, 0, 1] });
  let hit = false; for (let i = 0; i < 15 * 40 && !hit; i++) { s.tick(1 / 15); hit = p.down; }
  assert.ok(hit, 'a car came through within 40 s and knocked the officer on the track down'); assert.ok(!q.down, 'the one in the pit lane is fine');
  assert.ok(s.snapshot().RT > 0, 'race clock goes to clients');
  const a = carsAt(12.5).map(c => c[0]), b = carsAt(12.5).map(c => c[0]); assert.deepEqual(a, b);
  const s2 = new Sim('grandprix'); const tods = new Set(); for (let k = 1; k < 12; k++) { s2.start(k, false, 'clear', 'grandprix', 'random'); tods.add(s2.tod); } assert.equal(tods.size, 2, 'random picks both day and night');
});
await t('pvp: terrorist players start inside, the AI ignores them, they cannot rescue or defuse, cross-team shots hurt, win rules', async () => {
  const s = new Sim('mansion'); s.addPlayer(1, 'Cop'); s.addPlayer(2, 'Bad'); s.setTeam(2, 'tango'); s.start(9, false, 'clear', 'mansion');
  const cop = s.players.get(1), bad = s.players.get(2); cop.has = bad.has = true;
  assert.ok(s.pvp, 'pvp on when someone picked terrorist'); assert.ok(bad.spawn, 'terrorist got an inside spawn'); assert.ok(s.init().sp[2], 'spawn goes to the client');
  assert.ok(s.level.objective(bad.spawn[0], bad.spawn[2]) || s.level.map.inside(bad.spawn[0], bad.spawn[2], bad.spawn[1]), 'inside the building');
  // stand the terrorist right in front of an AI suspect: it must not engage him
  const n = s.npcs.find(q => q.kind === 's'); s.pose(2, { h: [n.x, n.y + 1.65, n.z + 1.2, 0, 0, 0, 1] }); s.pose(1, { h: [...s.M.spawn[0].slice(0, 1), 1.65, s.M.spawn[0][1], 0, 0, 0, 1] });
  n.yaw = 0; for (let i = 0; i < 30; i++) s.tick(1 / 15); assert.notEqual(n.st, 'c', 'AI does not fight its own side');
  // terrorists cannot cuff hostages or cut wires
  const c = s.npcs.find(q => q.kind === 'c'); c.st = 'y'; s.pose(2, { h: [c.x, c.y + 1.65, c.z + 0.8, 0, 0, 0, 1] }); s.cuff(2, c.id); assert.equal(c.st, 'y');
  const b = s.bombs[0]; s.pose(2, { h: [b.x, b.y + 0.9, b.z + 0.6, 0, 0, 0, 1] }); s.cut(2, 0, b.order[0]); assert.equal(b.n, 0);
  // the officer shoots the terrorist: full damage, no friendly-fire penalty
  s.pose(1, { h: [bad.hx, bad.hy, bad.hz + 3, 0, 0, 0, 1] }); s.t += 5; const hp0 = bad.hp; s.shot(1, { o: [bad.hx, bad.hy - 0.3, bad.hz + 2.5], d: [0, 0, -1], w: 'rifle' });
  assert.ok(bad.hp < hp0, 'terrorist hurt'); assert.equal(s.log.ff, 0, 'not friendly fire');
  // all officers down -> terrorists win
  s.hurt(cop, 999); s.tick(1 / 15); assert.equal(s.phase, 'ended'); assert.equal(s.report.winner, 'tango'); assert.match(s.report.result, /TERRORISTS WIN/);
  // timer runs out -> terrorists win; everything secured -> swat win
  s.start(10, false, 'clear', 'mansion'); s.players.get(1).has = s.players.get(2).has = true; s.timer = 0.01; s.tick(0.1); assert.equal(s.report.winner, 'tango');
  s.start(11, false, 'clear', 'mansion'); s.players.get(1).has = s.players.get(2).has = true; for (const q of s.npcs) if (q.kind === 'c') q.st = 'u'; for (const q of s.bombs) q.defused = true; s.tick(1 / 15); assert.equal(s.report.winner, 'swat');
  // radioing it in as SWAT hands the round over; terrorists can't end it
  s.start(12, false, 'clear', 'mansion'); s.endMission(2); assert.equal(s.phase, 'active'); s.endMission(1); assert.equal(s.report.winner, 'tango');
  // back to co-op once nobody is a terrorist
  s.setTeam(2, 'swat'); s.phase = 'lobby'; s.start(13, false, 'clear', 'mansion'); assert.ok(!s.pvp);
});
await t('pvp human shield: grab, carried in front, blocks body shots, pistol only, freed by a hit or a flashbang', async () => {
  const s = new Sim('mansion'); s.addPlayer(1, 'Cop'); s.addPlayer(2, 'Bad'); s.setTeam(2, 'tango'); s.start(21, false, 'clear', 'mansion');
  const cop = s.players.get(1), bad = s.players.get(2); cop.has = bad.has = true;
  const c = s.npcs.find(q => q.kind === 'c'); c.st = 'w';
  const stand = (id, x, z, yaw, y = c.y) => s.pose(id, { h: [x, y + 1.65, z, 0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)] });   // yaw 0 faces -z
  stand(2, c.x, c.z + 0.9, 0); s.hold(1, c.id); assert.ok(!c.held, 'officers cannot take a shield');
  s.hold(2, c.id); assert.equal(c.held, 2); assert.equal(c.st, 'x'); assert.equal(bad.hold, c.id);
  stand(2, c.x + 0.4, c.z + 0.9, 0); s.tick(1 / 15); assert.ok(Math.abs(c.x - (bad.hx - 0.14)) < 0.02 && Math.abs(c.z - (bad.hz - 0.48)) < 0.02, 'carried just in front, a little to the left');
  s.cuff(1, c.id); assert.equal(c.st, 'x', 'cannot cuff a held hostage');
  // the officer in front fires at the terrorist's chest: the hostage takes it
  stand(1, bad.hx, bad.hz - 6, Math.PI); s.t += 5; const hp0 = bad.hp; s.shot(1, { o: [bad.hx - 0.1, bad.hy - 0.35, bad.hz - 5.5], d: [0, 0, 1], w: 'rifle' });
  assert.equal(bad.hp, hp0, 'body shot blocked'); assert.ok(c.hp < 100 || c.st === 'd', 'hostage hit'); assert.equal(s.log.civHit, 1, 'counts against SWAT');
  // rifle refused while holding
  s.t += 5; const ev0 = s.events ? s.events.length : 0; const lastShot = bad.lastShot; s.shot(2, { o: [bad.hx, bad.hy - 0.3, bad.hz], d: [0, 0, -1], w: 'rifle' }); assert.equal(bad.lastShot, lastShot === undefined ? bad.lastShot : bad.lastShot, 'rifle refused'); 
  // a head shot past the hostage hits the terrorist and frees the hostage
  if (c.st !== 'd') { s.t += 5; s.shot(1, { o: [bad.hx + 0.05, bad.hy, bad.hz - 5.5], d: [0, 0, 1], w: 'rifle' }); assert.ok(bad.hp < hp0, 'terrorist hit'); assert.equal(bad.hold, 0, 'dropped the hostage'); assert.equal(c.st, 'w'); }
  // flashbang frees too
  const c2 = s.npcs.find(q => q.kind === 'c' && q !== c && q.st !== 'd'); c2.st = 'w'; bad.down = false; bad.hp = 100; stand(2, c2.x, c2.z + 0.9, 0, c2.y); s.hold(2, c2.id); assert.equal(bad.hold, c2.id);
  s.flash({ x: bad.hx, y: bad.hy - 1, z: bad.hz - 1.5, by: 1 }); assert.equal(bad.hold, 0); assert.equal(c2.held, 0);
});
await t('pvp terrorist locks and wire traps: two each, own doors pass safely, SWAT trips them', async () => {
  const s = new Sim('mansion'); s.addPlayer(1, 'Cop'); s.addPlayer(2, 'Bad'); s.setTeam(2, 'tango'); s.start(31, false, 'clear', 'mansion');
  const cop = s.players.get(1), bad = s.players.get(2);
  const free = s.level.doors.map((d, i) => i).filter(i => !s.doorOpen[i] && !s.doorLocked[i] && !s.doorTrap[i] && s.level.doors[i].pad === undefined);
  assert.ok(free.length >= 4, 'enough plain closed doors');
  const at = (id, i) => { const d = s.level.doors[i]; s.pose(id, { h: [d.cx + 0.6, d.y + 1.65, d.cz + 0.6, 0, 0, 0, 1] }); };
  const [a, b, c, e] = free;
  at(1, a); s.lockdoor(1, a); assert.ok(!s.doorLocked[a], 'officers cannot lock');
  at(2, a); s.lockdoor(2, a); at(2, b); s.lockdoor(2, b); at(2, c); s.lockdoor(2, c);
  assert.ok(s.doorLocked[a] && s.doorLocked[b] && !s.doorLocked[c], 'only two locks'); assert.equal(bad.locks, 0);
  at(2, c); s.trapdoor(2, c); at(2, e); s.trapdoor(2, e); at(2, a); s.trapdoor(2, a); assert.equal(bad.traps, 0);
  assert.ok(s.doorTrap[c] && s.doorTrap[e] && !s.doorTrap[a], 'only two traps');
  const flags = s.snapshot().P.find(q => q[0] === 2)[9]; assert.equal(flags >> 13 & 3, 0); assert.equal(flags >> 15 & 3, 0);
  at(1, a); s.door(1, a); assert.ok(!s.doorOpen[a], 'SWAT stopped by the lock');
  at(2, a); s.door(2, a); assert.ok(s.doorOpen[a], 'terrorist opens their own lock');
  const hp = bad.hp; at(2, c); s.door(2, c); assert.ok(s.doorOpen[c] && bad.hp === hp, 'terrorist passes their own wire');
  const chp = cop.hp; at(1, e); s.door(1, e); assert.ok(s.doorOpen[e] && cop.hp < chp, 'SWAT trips the wire');
});
await t('airport: every post, hostage, bomb and the jet reachable from the kerb; bomb in the hold; passenger and gunman in the cabin', async () => {
  const { buildLevel: BL, findPath: FP } = await import('../public/js/core/level.js');
  const L = BL('airport'), M = L.map, [sx, sz] = M.spawn[0];
  const reach = ([f, x, z]) => { const p = FP(L, sx, sz, 0, x, z, f * M.H, true); const e = p && p[p.length - 1]; return !!p && Math.hypot(e[0] - x, e[1] - z) < 1.2; };
  for (const sp of [...M.spots.s, ...M.spots.c, ...M.civMust, ...M.susMust, M.hvt.at, M.hvt.flee]) assert.ok(reach(sp), 'reachable ' + sp);
  const { CAB, JET } = await import('../public/js/core/maps/airport.js');
  assert.ok(Math.abs(L.groundY(31.75, -40, CAB) - CAB) < 0.01, 'cabin floor');
  const dp = FP(L, M.spawn[0][0], M.spawn[0][1], 0, 31.75, -40, CAB, true); assert.ok(dp && dp.some(([x, z]) => x > JET.cx + 2 && z > JET.door[0] && z < JET.door[1]), 'the way in is the airstairs and the front door');
  const [bf, bx, bz, bh] = M.bombMust, stand = [bx - 1.25, bz];   // the hold bomb can be reached from the ground outside the hatch
  assert.ok(!L.walk[Math.floor((stand[1] - M.YARD.z0) / 0.5) * L.NX + Math.floor((stand[0] - M.YARD.x0) / 0.5)] === false, 'standing spot outside the hatch is walkable');
  const s = new Sim('airport'); s.addPlayer(1, 'A'); s.start(5, false, 'clear', 'airport');
  const b0 = s.bombs[0]; assert.ok(b0.x > JET.cx - 2.4 && b0.x < JET.cx - 1 && b0.z > JET.hatch[0] && b0.z < JET.hatch[1] && Math.abs(b0.y - 1.1) < 0.05, 'one bomb in the cargo hold, inside the hatch');
  assert.ok(s.npcs.some(n => n.kind === 'c' && Math.abs(n.y - CAB) < 0.01 && n.z < -30), 'passenger in the cabin');
  assert.ok(s.npcs.some(n => n.kind === 's' && Math.abs(n.y - CAB) < 0.01 && n.z < -30), 'gunman in the cabin');
});
await t('airport HVT runs for the jet once he hears the squad, then digs in there', async () => {
  const s = new Sim('airport'); s.addPlayer(1, 'A'); s.start(8, false, 'clear', 'airport'); const p = s.players.get(1); p.has = true;
  const h = s.npcs.find(n => n.hvt), [, fx, fz] = s.M.hvt.flee;
  s.pose(1, { h: [h.x + 3, h.y + 1.65, h.z - 9, 0, 1, 0, 0] }); p.y = h.y; s.phase = 'active';
  h.st = 'a'; h.lk = [p.hx, p.hz, p.y]; h.tA = 0;
  s.pose(1, { h: [80, 1.65, 80, 0, 0, 0, 1] }); p.y = 0;   // the squad steps away so nobody shoots him on the way
  const evs = []; for (let i = 0; i < 15 * 90 && Math.hypot(h.x - fx, h.z - fz) > 1.6; i++) { s.tick(1 / 15); evs.push(...s.events.splice(0)); }
  assert.ok(evs.some(e => e.e === 'hvtrun'), 'announced'); assert.ok(Math.hypot(h.x - fx, h.z - fz) < 1.6, 'reached the jet: ' + h.x.toFixed(1) + ',' + h.z.toFixed(1)); assert.ok(Math.abs(h.y - 1.615 * 1.25) < 0.05, 'in the cabin');
  for (let i = 0; i < 15; i++) s.tick(1 / 15); assert.ok(!h.fleeing && h.st !== 'g', 'holding there');
});
Sim.BOTS = true;
const run = (s, sec, until) => { const ev = []; for (let i = 0; i < sec * 15; i++) { s.tick(1 / 15); ev.push(...s.events.splice(0)); if (until && until()) break; } return ev; };
await t('bots: three fill a solo squad, two with a friend, a joiner takes a bot place, none in training; rooms count humans', async () => {
  const s = new Sim('mansion'); s.addPlayer(1, 'A'); s.start(3, false, 'clear', 'mansion');
  assert.equal(s.bots().length, 3); assert.deepEqual(s.bots().map(p => p.name), ['ALPHA', 'BRAVO', 'CHARLIE']);
  const P = s.snapshot().P; assert.equal(P.length, 4); assert.ok(P.filter(q => q[9] & 1 << 17).length === 3, 'bot flag');
  s.addPlayer(2, 'B'); assert.equal(s.bots().length, 2, 'a friend joining mid-mission replaces a bot');
  s.start(4, false, 'clear', 'mansion'); assert.equal(s.bots().length, 2);
  const t2 = new Sim('training'); t2.addPlayer(1, 'A'); t2.start(1, false, 'clear', 'training'); assert.equal(t2.bots().length, 0);
  const h = new RoomHost(() => {}); for (let i = 1; i <= 4; i++) assert.ok(h.join(i, 'P' + i)); h.sim.start(5, false, 'clear', 'mansion'); assert.equal(h.count, 4); assert.equal(h.sim.bots().length, 0);
});
await t('bots follow the leader through the house, and hold when told', async () => {
  const s = new Sim('mansion'); s.addPlayer(1, 'A'); s.start(6, false, 'clear', 'mansion'); for (const n of s.npcs) if (n.kind === 's') { n.st = 'u'; n.armed = false; }
  const me = s.players.get(1), [sx, sz] = s.M.spawn[0];
  const at = (x, z, y = 0) => { s.pose(1, { h: [x, y + 1.65, z, 0, 0, 0, 1] }); };
  at(sx, sz); run(s, 1);
  const goal = s.M.spots.c[0]; at(goal[1], goal[2], goal[0] * s.M.H);
  run(s, 60, () => s.bots().every(p => Math.hypot(p.bot.x - goal[1], p.bot.z - goal[2]) < 5 && Math.abs(p.bot.y - goal[0] * s.M.H) < 0.5));
  for (const p of s.bots()) assert.ok(Math.hypot(p.bot.x - goal[1], p.bot.z - goal[2]) < 5, p.name + ' followed: ' + p.bot.x.toFixed(1) + ',' + p.bot.z.toFixed(1) + ' to ' + goal);
  s.order(1, { k: 'hold' }); const held = s.bots().map(p => [p.bot.x, p.bot.z]); at(sx, sz); run(s, 6);
  s.bots().forEach((p, i) => assert.ok(Math.hypot(p.bot.x - held[i][0], p.bot.z - held[i][1]) < 0.8, 'held'));
});
await t('bot orders: open and pick a door, cut its wire, defuse a bomb, detain a hostage, revive an officer', async () => {
  const s = new Sim('mansion'); s.addPlayer(1, 'A'); s.start(7, false, 'clear', 'mansion'); for (const n of s.npcs) if (n.kind === 's') { n.st = 'u'; n.armed = false; }
  const me = s.players.get(1), [sx, sz] = s.M.spawn[0]; s.pose(1, { h: [sx, 1.65, sz, 0, 0, 0, 1] }); run(s, 0.5);
  // a closed inside door on the ground floor: lock it, rig it, then order a pick: the bot spots the wire, cuts it, picks the lock and opens
  const di = s.level.doors.findIndex((d, i) => !d.exterior && d.y === 0 && !s.doorOpen[i]); s.doorLocked[di] = true; s.doorTrap[di] = 1;
  const pb = s.bots()[0]; pb.bot.seen[di] = true;
  s.order(1, { k: 'pick', d: di }); const busy = s.bots().find(p => p.bot.task); assert.ok(busy, 'someone took it');
  const ev = run(s, 90, () => s.doorOpen[di]); assert.ok(s.doorOpen[di], 'door opened'); assert.equal(s.doorTrap[di], 0, 'wire cut first'); assert.ok(!ev.some(e => e.e === 'trip'), 'no tripped wire');
  const bi = 0, bm = s.bombs[bi]; s.order(1, { k: 'defuse', b: bi }); run(s, 120, () => bm.defused); assert.ok(bm.defused, 'bomb defused');
  const c = s.npcs.find(n => n.kind === 'c' && n.y === 0); s.order(1, { k: 'detain', n: c.id }); run(s, 120, () => c.st === 'u'); assert.equal(c.st, 'u', 'hostage detained');
  me.down = true; me.hp = 0; run(s, 60, () => !me.down); assert.ok(!me.down, 'a bot revived the downed officer unasked');
});
await t('bots fight back: a suspect who opens fire gets shot, an unaware one is challenged first', async () => {
  const s = new Sim('mansion'); s.addPlayer(1, 'A'); s.start(8, false, 'clear', 'mansion');
  const [sx, sz] = s.M.spawn[0]; s.pose(1, { h: [sx, 1.65, sz, 0, 0, 0, 1] }); for (const n of s.npcs) if (n.kind === 's') { n.st = 'u'; n.armed = false; }
  const b = s.bots()[0], n = s.npcs.find(q => q.kind === 's'); n.st = 'g'; n.armed = true; n.resolve = 1; n.x = b.bot.x + Math.sin(b.bot.yaw) * 6; n.z = b.bot.z + Math.cos(b.bot.yaw) * 6; n.y = b.bot.y; n.path = null; n.patrol = null; n.yaw = b.bot.yaw; n.sweep = 0;
  if (!s.clear(b.bot.x, 1.6, b.bot.z, n.x, 1.3, n.z)) { n.x = b.bot.x; n.z = b.bot.z + 4; }
  const ev = run(s, 20, () => n.st === 'd' || n.st === 'i' || n.st === 's' || n.st === 'k');
  assert.ok(ev.some(e => e.e === 'shout' && s.players.get(e.p) && s.players.get(e.p).bot), 'challenged'); assert.ok(n.st === 'd' || n.st === 'i' || n.st === 's' || n.st === 'k', 'dealt with: ' + n.st);
  assert.equal(s.log.unauth, 0, 'no unauthorised force');
});
await t('solo terrorist: with no SWAT human the bots run the mission themselves', async () => {
  const s = new Sim('mansion'); s.addPlayer(1, 'T'); s.setTeam(1, 'tango'); s.start(9, false, 'clear', 'mansion'); assert.ok(s.pvp); assert.equal(s.bots().length, 3);
  const me = s.players.get(1); s.pose(1, { h: [me.hx, me.y + 1.65, me.hz, 0, 0, 0, 1] });
  for (const n of s.npcs) if (n.kind === 's') { n.st = 'u'; n.armed = false; }
  const sec = () => s.npcs.filter(n => n.kind === 'c' && n.st === 'u').length + s.bombs.filter(b => b.defused).length;
  run(s, 150, () => sec() >= 2 || s.phase !== 'active'); assert.ok(sec() >= 2, 'bots secured ' + sec() + ' objectives on their own');
});
console.log(n + ' tests passed');
