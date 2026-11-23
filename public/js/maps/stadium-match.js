// The match on the stadium's pitch, no graphics (so the tests can run it): a ball passed about, the nearest player of each side after
// it, everyone else holding a 4-3-3 that drifts with play, the keepers in their goals, a referee trailing the ball.
import { XC, ZC, PITCH } from '../core/maps/stadium.js';
let seed = 23; const rr = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const SHAPE = [[-48, 0], [-34, -22], [-36, -7], [-36, 7], [-34, 22], [-18, -16], [-20, 0], [-18, 16], [-4, -20], [-2, 0], [-4, 20]];   // 4-3-3, home attacking +x
export function makeMatch() {
  const players = [];
  for (const side of [1, -1]) SHAPE.forEach(([x, z], i) => players.push({ side, gk: i === 0, home: [x * side, z * side], x: XC + x * side * 0.9, z: ZC + z * side, vx: 0, vz: 0, sp: 0, ry: side > 0 ? Math.PI / 2 : -Math.PI / 2, ph: rr() * 6 }));
  const ref = { side: 0, home: [0, 0], x: XC, z: ZC + 8, vx: 0, vz: 0, sp: 0, ry: 0, ph: 0, ref: true };
  return { players, ref, ball: { x: XC, z: ZC, y: 0.11, vx: 0, vz: 0, vy: 0, owner: null, hold: 0, free: 0 }, swing: 0 };
}
export function stepMatch(m, dt) {
  const b = m.ball, all = m.players;
  m.swing += dt * 0.05;   // play drifts end to end
  const lineX = Math.sin(m.swing) * 22;
  // the ball
  if (b.owner) { const o = b.owner; b.x = o.x + Math.sin(o.ry) * 0.5; b.z = o.z + Math.cos(o.ry) * 0.5; b.y = 0.11; b.vx = o.vx; b.vz = o.vz;
    if ((b.hold -= dt) < 0) {   // pass to a team-mate ahead (or a shot when near goal)
      const goalX = o.side > 0 ? PITCH.x1 : PITCH.x0, near = Math.abs(goalX - o.x) < 22;
      let tx, tz;
      if (near && rr() < 0.5) { tx = goalX + o.side * 1.2; tz = ZC + (rr() - 0.5) * 7; }
      else { const mates = all.filter(p => p.side === o.side && p !== o && !p.gk); const t = mates[Math.floor(rr() * mates.length)]; tx = t.x + t.vx * 0.8; tz = t.z + t.vz * 0.8; }
      const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz) || 1, sp = Math.min(24, 8 + d * 0.6);
      b.vx = dx / d * sp; b.vz = dz / d * sp; b.vy = d > 25 ? 5 : 0; b.owner = null; b.free = 0.4; } }
  else { b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt; b.vy -= 9.8 * dt; if (b.y < 0.11) { b.y = 0.11; b.vy = Math.abs(b.vy) > 1.5 ? -b.vy * 0.45 : 0; }
    const f = Math.exp(-dt * (b.y > 0.2 ? 0.1 : 0.7)); b.vx *= f; b.vz *= f; b.free -= dt;
    // out of play or in the net: the keeper or a nearby player restarts it
    if (b.x < PITCH.x0 - 1 || b.x > PITCH.x1 + 1 || b.z < PITCH.z0 - 1 || b.z > PITCH.z1 + 1) { const gk = all.find(p => p.gk && p.side === (b.x < XC ? 1 : -1)); b.x = gk.x; b.z = gk.z; b.vx = b.vz = b.vy = 0; b.owner = gk; b.hold = 1.5; } }
  // the players
  const chase = {};
  for (const s of [1, -1]) { let best = null, bd = 1e9; for (const p of all) if (p.side === s && !p.gk) { const d = Math.hypot(p.x - b.x, p.z - b.z); if (d < bd) { bd = d; best = p; } } chase[s] = best; }
  for (const p of [...all, m.ref]) {
    let tx, tz, top = 5.5;
    if (p.ref) { tx = b.x - 8; tz = b.z + 10 * Math.sign(ZC - b.z || 1); top = 6; }
    else if (p === chase[p.side] && b.owner !== p) { tx = b.x + b.vx * 0.3; tz = b.z + b.vz * 0.3; top = 7.5; }
    else if (p.gk) { const gx = p.side > 0 ? PITCH.x0 + 1.5 : PITCH.x1 - 1.5; tx = gx; tz = ZC + Math.max(-3, Math.min(3, (b.z - ZC) * 0.15)); top = 4; }
    else if (b.owner === p) { const gx = p.side > 0 ? PITCH.x1 : PITCH.x0; tx = p.x + Math.sign(gx - p.x) * 6; tz = p.z + (ZC - p.z) * 0.2; top = 6.5; }
    else { tx = XC + p.home[0] * 0.85 + lineX + (b.x - XC) * 0.25; tz = ZC + p.home[1] * 0.9 + (b.z - ZC) * 0.2; top = 4.5; }
    tx = Math.max(PITCH.x0 + 0.5, Math.min(PITCH.x1 - 0.5, tx)); tz = Math.max(PITCH.z0 + 0.5, Math.min(PITCH.z1 - 0.5, tz));
    // run like a person: turn towards where you are going (slower the faster you run), speed up and slow down at a human rate,
    // and always move the way you face (no sliding sideways); stood still, face the ball. p.ph is the stride's phase, by distance
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz), chasing = p === chase[p.side] && b.owner !== p, want = chasing ? Math.min(top, 2 + d * 1.5) : d < 0.8 ? 0 : Math.min(top, (d - 0.6) * 1.1);
    const head = Math.atan2(dx, dz), face = want > 0 ? head : (p.ref ? p.ry : Math.atan2(b.x - p.x, b.z - p.z));
    let da = Math.atan2(Math.sin(face - p.ry), Math.cos(face - p.ry)); const turn = (want > 0 ? 7 / (1 + p.sp * 0.35) : 3) * dt; p.ry += Math.max(-turn, Math.min(turn, da));
    const ahead = Math.max(0, Math.cos(da)), goal = want * ahead * ahead;   // a sharp turn slows you first
    p.sp += Math.max(-7 * dt, Math.min(4 * dt, goal - p.sp)); if (p.sp < 0.05 && goal === 0) p.sp = 0;
    p.vx = Math.sin(p.ry) * p.sp; p.vz = Math.cos(p.ry) * p.sp; p.x += p.vx * dt; p.z += p.vz * dt;
    p.x = Math.max(PITCH.x0 - 1.5, Math.min(PITCH.x1 + 1.5, p.x)); p.z = Math.max(PITCH.z0 - 1.5, Math.min(PITCH.z1 + 1.5, p.z));   // over the line chasing it, no further
    const stride = 1.2 + p.sp * 0.32;   // metres per stride (two steps): longer when sprinting
    p.ph = (p.ph + p.sp * dt / stride * 2 * Math.PI) % (2 * Math.PI); const sp = p.sp;
    if (!p.ref && !b.owner && b.free <= 0 && b.y < 1.2 && Math.hypot(p.x - b.x, p.z - b.z) < 1.0) { b.owner = p; b.hold = 0.6 + rr() * 1.6; }
  }
}

