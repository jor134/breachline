// Map: a container terminal at dusk. Container yard, ship-to-shore cranes along the quay, a moored container ship with a bridge tower.
// Everything solid is generated here from a few layout tables; core/level.js turns it into walls, collision, rays and navigation.
export const H = 3.2, DOOR_H = 2.1;
export const YARD = { x0: -6, z0: -30, x1: 116, z1: 84 };
const DECK = 2 * H;                         // ship's main deck height
export const CL = 12.2, CL20 = 6.06, CW = 2.44, CH = 2.6;   // container length (40 ft and 20 ft), width, height

let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// ---- the ship: hull, bulwark, gangways, bridge tower ----
export const HULL = { x0: 10, x1: 100, z0: -26, z1: -2 };
export const TOWER = { x0: 84, x1: 96, z0: -22, z1: -6 };
export const TSTAIR = { x0: 84.2, x1: 85.7, z0: -11.5, z1: -6.5 };
export const GANGWAYS = [30, 62].map(a => ({ a, b: a + 16, c: a + 18.4 }));   // ramp a..b on the quay (z 1..2.5), landing b..c crossing to the deck
const RAMP = { z0: 1, z1: 2.5 };

// ---- stacks: [x0, z0, x1, z1, base y, tiers, pad index or -1] ----
export const STACKS = [], PADS = [];
// padlocked containers: [block, row, end] for yard blocks, or deck bays. Bombs and some hostages are put inside a few of these each mission.
const PAD_AT = { A: [[1, 'w'], [4, 'e']], B: [[2, 'w'], [5, 'e']], C: [[3, 'e']], E: [[1, 'w']], S5: [[2, 'e']], S1: [[4, 'w']] };
function block(id, x0, z0, cols, rows, base, maxT, len = CL) {
  for (let row = 0; row < rows; row++) for (let c = 0; c < cols; c++) {
    let t = 1 + Math.floor(r() * maxT); if (r() < 0.08) t = 0;
    const spec = (PAD_AT[id] || []).find(([rw, e]) => rw === row && ((e === 'w' && c === 0) || (e === 'e' && c === cols - 1))), end = spec ? spec[1] : '', pad = !!spec;
    if (pad) t = Math.max(1, t);
    if (!t) continue;
    const s = [x0 + c * len, z0 + row * CW, x0 + (c + 1) * len, z0 + (row + 1) * CW, base, t, -1];
    if (pad) { s[6] = PADS.length; PADS.push({ s, dir: end === 'w' ? -1 : 1, f: Math.round(base / H) }); }
    STACKS.push(s);
  }
}
block('A', 4, 34, 3, 6, 0, 4); block('B', 46, 34, 3, 6, 0, 4); block('C', 88, 34, 2, 6, 0, 3);
block('D', 4, 53, 2, 3, 0, 3); block('E', 46, 53, 3, 3, 0, 3); block('F', 88, 53, 2, 3, 0, 2);
[12, 25.7, 39.4, 53.1, 66.8].forEach((x, i) => block('S' + (i + 1), x, -24.6, 1, 7, DECK, 3));
// loose boxes on the apron for cover
STACKS.push([2, 15, 2 + CL, 15 + CW, 0, 1, -1], [96, 15, 96 + CL, 15 + CW, 0, 2, -1], [74, 24, 74 + CL20, 24 + CW, 0, 1, -1], [60, 72, 60 + CL, 72 + CW, 0, 2, -1]);
for (const p of PADS) { const [x0, z0, x1, z1, y] = p.s; p.door = p.dir < 0 ? x0 : x1; p.cz = (z0 + z1) / 2; p.y = y;
  p.crate = p.dir < 0 ? [x1 - 1.3, z0 + 0.6, x1 - 0.15, z1 - 0.6] : [x0 + 0.15, z0 + 0.6, x0 + 1.3, z1 - 0.6];   // cargo at the back; a bomb sits on top of it
  p.hostage = [p.door - p.dir * 3.5, p.cz]; p.bomb = [(p.crate[0] + p.crate[2]) / 2, p.cz]; }

// ---- cranes, trucks, floodlights ----
export const STS = [20, 56, 90];            // ship-to-shore cranes along the quay (x of the centre); legs at x +-8, z 3..4.2 and 26.8..28
export const RTG = [[14, 31.8, 49.8], [62, 31.8, 49.8]];   // rubber-tyred gantries straddling a yard block: x centre, leg rows in z
export const TRUCKS = [[14, 8, 1], [50, 7.5, -1], [84, 8, 1], [34, 18, 1], [70, 17, -1], [50, 64, 1], [75, 69, -1], [96, 70, 1]].map(([x, z, d], i) => ({ x, z, d, load: i % 3 !== 2, c: i }));   // tractor + trailer, 16.5 x 2.5, along x; d = which way the cab faces
export const FLOODS = [[2, 31], [100, 31], [43, 51], [2, 66], [70, 74.6], [110, 62], [30, 31]];
export const OPS = { x0: 4, x1: 22, z0: 62, z1: 72 };
export const BREAKER = { x: 14.5, y: 1.4, z: 67.13 };
export const SPAWN = [[41, 80], [42.5, 80], [44, 80], [45.5, 80]];
export const EXIT = { x0: 38, x1: 48, z0: 76.6, z1: 84 };

export const ROOMS = [   // [floor, name, x0, z0, x1, z1, floor finish]
  [0, 'lobby', 4, 62, 12, 72, 'tile'], [0, 'control', 12, 62, 22, 67, 'carpet'], [0, 'electrical', 12, 67, 17, 72, 'tile'], [0, 'lockers', 17, 67, 22, 72, 'tile'],
  [2, 'mess', 84, -22, 90, -14, 'tile'], [2, 'galley', 90, -22, 96, -14, 'tile'], [2, 'hall', 84, -14, 96, -6, 'tile'],
  [3, 'cabin', 84, -22, 90, -16, 'carpet'], [3, 'cabin', 90, -22, 96, -16, 'carpet'], [3, 'hall', 84, -16, 90, -6, 'tile'], [3, 'office', 90, -16, 96, -6, 'carpet'],
  [4, 'bridge', 84, -22, 96, -12, 'tile'], [4, 'hall', 84, -12, 90, -6, 'tile'], [4, 'radio', 90, -12, 96, -6, 'carpet'],
];
export const OPENINGS = [
  [0, 7, 72, 8, 72, 'door', 'ext'], [0, 7.5, 62, 8.5, 62, 'door', 'ext'], [0, 12, 64, 12, 65, 'door'], [0, 12, 69, 12, 70, 'door'], [0, 17, 70, 17, 71, 'door'],
  [2, 90, -6, 91, -6, 'door', 'ext'], [2, 96, -13, 96, -12, 'door', 'ext'], [2, 84, -19, 84, -18, 'door', 'ext'], [2, 87, -14, 88, -14, 'door'], [2, 93, -14, 94, -14, 'door'], [2, 90, -18.5, 90, -17.5, 'door'],
  [3, 87, -16, 88, -16, 'door'], [3, 90, -12, 90, -11, 'door'], [3, 93, -16, 94, -16, 'door'],
  [4, 87, -12, 88, -12, 'door'], [4, 90, -9.5, 90, -8.5, 'door'], [4, 93, -12, 94, -12, 'door'],
];
export const GLASS = [
  [0, 13, 62, 21, 62], [0, 4, 64, 4, 70],
  [2, 85, -22, 89, -22], [2, 91, -22, 95, -22], [3, 84, -20.5, 84, -17.5], [3, 96, -20.5, 96, -17.5], [3, 96, -11.5, 96, -7.5],
  [4, 84, -22, 96, -22], [4, 84, -21.5, 84, -12.5], [4, 96, -21.5, 96, -12.5],
];
export const FURNITURE = [   // [floor, x0, z0, x1, z1, height, kind, face]
  [0, 13, 62.4, 21, 63.2, 0.76, 'counter', '+z'], [0, 13.2, 66.2, 15.6, 66.9, 1.9, 'shelf', '-z'], [0, 19.4, 65.6, 21.8, 66.8, 0.76, 'table'],
  [0, 4.2, 66.6, 5, 70.4, 0.45, 'sofa', '+x'], [0, 9.4, 70.8, 11.8, 71.8, 1.0, 'counter', '-z'],
  [0, 12.2, 71.2, 13.6, 71.8, 1.9, 'cabinet', '-z'], [0, 17.2, 67.2, 21.8, 67.7, 1.9, 'cabinet', '+z'], [0, 21.3, 68.2, 21.8, 71.8, 1.9, 'cabinet', '-x'], [0, 18.4, 69.2, 20.4, 69.8, 0.45, 'table'],
  [2, 84.6, -21.4, 89.4, -20.4, 0.76, 'table'], [2, 85, -17, 89, -15.6, 0.76, 'table'], [2, 90.2, -21.6, 95.8, -20.9, 0.92, 'counter', '+z'], [2, 95.1, -20.6, 95.8, -15, 0.92, 'counter', '-x'],
  [2, 92.5, -11, 95.5, -10, 0.45, 'sofa', '+z'],
  [3, 84.2, -21.8, 86.2, -19.6, 0.55, 'bed', '+x'], [3, 88.8, -21.8, 89.8, -20.2, 1.9, 'cabinet', '-x'], [3, 93.8, -21.8, 95.8, -19.6, 0.55, 'bed', '-x'], [3, 90.2, -21.8, 91.2, -20.2, 1.9, 'cabinet', '+x'],
  [3, 92, -10, 94.4, -9, 0.76, 'table'], [3, 90.2, -15.8, 92.4, -15.3, 1.9, 'shelf', '+z'], [3, 86.4, -8.4, 89.8, -7.6, 0.9, 'cabinet', '-z'],
  [4, 86, -21.6, 94, -20.6, 1.05, 'console', '+z'], [4, 89.2, -16.8, 90.8, -15.2, 1.1, 'binnacle'], [4, 84.3, -14.5, 85.5, -12.4, 1.0, 'cabinet', '+x'],
  [4, 91, -11.6, 95.6, -10.8, 0.76, 'console', '+z'], [4, 95, -10.4, 95.8, -6.4, 1.9, 'cabinet', '-x'],
];
export const SUSPECT_SPOTS = [
  [0, 16, 12.8], [0, 52, 14], [0, 88, 13], [0, 32, 22.5], [0, 70, 22], [0, 102, 24], [0, 8, 26], [0, 44, 31], [0, 86, 31.5],
  [0, 43, 40], [0, 85, 42], [0, 43, 57], [0, 85, 58], [0, 1.5, 40], [0, 114, 45], [0, 30, 51], [0, 62, 51], [0, 100, 51],
  [0, 36, 64], [0, 60, 68.5], [0, 95, 64], [0, 26, 72],
  [0, 8, 66], [0, 17, 64.5], [0, 19.5, 70.6],
  [2, 20, -5], [2, 45, -4.5], [2, 70, -5], [2, 32, -25.25], [2, 82, -14], [2, 98, -14], [2, 38.65, -15], [2, 65.95, -12],
  [2, 87, -18.5], [2, 93, -18], [2, 91, -8], [3, 87, -18.5], [3, 93, -13], [3, 88, -10], [4, 93, -8],
];
export const CIV_SPOTS = [[0, 9, 68.5], [0, 18, 64.6], [0, 20, 71], [2, 92.5, -18.5], [3, 87.5, -17.5], [3, 92.5, -17.5], [3, 93, -13.5], [0, 70, 62], [2, 81.5, -9]];
export const HVT = { at: [4, 90, -14.2], guards: [[4, 87, -14.5], [4, 93, -18.8]] };

// ---- shape helpers ----
const inR = (R, x, z) => x > R.x0 && x < R.x1 && z > R.z0 && z < R.z1;
export const inTower = (x, z) => x >= TOWER.x0 && x <= TOWER.x1 && z >= TOWER.z0 && z <= TOWER.z1;
export const inTStair = (x, z) => x > TSTAIR.x0 && x < TSTAIR.x1 && z > TSTAIR.z0 && z < TSTAIR.z1;
const stairT = z => (TSTAIR.z1 - z) / (TSTAIR.z1 - TSTAIR.z0), stairUp = z => Math.min(1, stairT(z) / 0.85) * H;
const inOps = (x, z) => x >= OPS.x0 && x <= OPS.x1 && z >= OPS.z0 && z <= OPS.z1;
function gangAt(x, z) {   // height of a gangway surface here, or NaN
  for (const g of GANGWAYS) { if (x >= g.a && x < g.b && z > RAMP.z0 && z < RAMP.z1) return (x - g.a) * DECK / 16; if (x >= g.b && x <= g.c && z > HULL.z1 - 0.01 && z < RAMP.z1) return DECK; }
  return NaN;
}
const onHull = (x, z) => x >= HULL.x0 && x <= HULL.x1 && z >= HULL.z0 && z <= HULL.z1;
function padIn(x, z) { for (const p of PADS) { const [x0, z0, x1, z1] = p.s; if (x > x0 && x < x1 && z > z0 && z < z1) return p; } return null; }
function stackTop(x, z) { for (const s of STACKS) if (x > s[0] && x < s[2] && z > s[1] && z < s[3]) return s[4] + s[5] * CH; return -Infinity; }

// Every walkable surface over (x, z) as [height, nav layer]. Layers: 0 ground, 1 main deck, 2 and 3 the upper tower floors.
function surfaces(x, z) {
  if (inTower(x, z)) {
    if (inTStair(x, z)) { const up = stairUp(z); return stairT(z) > 0.85 ? [[3 * H, 2], [4 * H, 3]] : [[DECK + up, 1], [3 * H + up, 2]]; }
    return [[DECK, 1], [3 * H, 2], [4 * H, 3]];
  }
  const g = gangAt(x, z); if (!Number.isNaN(g)) return [[g, g < H ? 0 : 1]];
  if (onHull(x, z)) return [[DECK, 1]];
  return z >= 0 ? [[0, 0]] : [];
}
const WATER = -2.5;
function floorRay(ox, oy, oz, dx, dy, dz, best) {
  if (Math.abs(dy) > 1e-9) {
    for (const py of [3 * H, 4 * H, 5 * H]) { const t = (py - oy) / dy; if (t <= 1e-6 || t >= best) continue; const x = ox + dx * t, z = oz + dz * t; if (inTower(x, z) && (py === 5 * H || !inTStair(x, z))) best = t; }
    { const t = (0 - oy) / dy; if (t > 1e-6 && t < best && oz + dz * t >= 0) best = t; }
    { const t = (WATER - oy) / dy; if (t > 1e-6 && t < best) best = t; }
  }
  for (const g of GANGWAYS) {   // ramp plane y = (x - a) * 0.4
    const k = DECK / 16, den = dy - k * dx; if (Math.abs(den) < 1e-9) continue; const t = -(oy - k * (ox - g.a)) / den;
    if (t > 1e-6 && t < best) { const x = ox + dx * t, z = oz + dz * t; if (x > g.a && x < g.b && z > RAMP.z0 && z < RAMP.z1) best = t; }
  }
  return best;
}
function solidFloor(x, y, z) {
  if (y < WATER) return true;
  if (z >= 0 && y < 0) return true;
  if (inTower(x, z)) { if (y > 5 * H - 0.2 && y < 5 * H + 0.3) return true; if (!inTStair(x, z) && ((y < 3 * H && y > 3 * H - 0.2) || (y < 4 * H && y > 4 * H - 0.2))) return true; }
  const g = gangAt(x, z); if (!Number.isNaN(g) && y < g && y > g - 0.25) return true;
  return false;
}
// What a footstep sounds like here.
function floorAt(x, z, y) {
  if (inTower(x, z) && !inTStair(x, z)) { const f = Math.round(y / H); for (const rm of ROOMS) if (rm[0] === f && x >= rm[2] && x <= rm[4] && z >= rm[3] && z <= rm[5]) return rm[6] === 'carpet' ? 'carpet' : 'metal'; }
  if (inOps(x, z) && y < 1) { for (const rm of ROOMS) if (rm[0] === 0 && x >= rm[2] && x <= rm[4] && z >= rm[3] && z <= rm[5]) return rm[6] === 'carpet' ? 'carpet' : 'concrete'; }
  if (y > 0.5 || padIn(x, z) || !Number.isNaN(gangAt(x, z))) return 'metal';
  return 'concrete';
}
function inside(x, z, y) {
  if (inTower(x, z)) return y < 5 * H;
  if (inOps(x, z)) return y < H;
  const p = padIn(x, z); return !!p && y < p.y + CH;
}
function roofY(x, z) {
  if (inTower(x, z)) return 5 * H + 0.3; if (inOps(x, z)) return H + 0.3;
  const t = stackTop(x, z); if (t > -Infinity) return t;
  const g = gangAt(x, z); if (!Number.isNaN(g)) return g;
  return onHull(x, z) ? DECK : z >= 0 ? 0 : WATER;
}
const terrainY = (z, x = 50) => roofY(x, z);

// Solids that are not room walls: containers, hull, bulwark, gangway sides, cranes, trucks, poles, fence; and the container doors.
function extra({ boxes, addDoor }) {
  const box = (kind, x0, x1, y0, y1, z0, z1, o = {}) => boxes.push(Object.assign({ f: Math.round(y0 / H), kind, x0, x1, y0, y1, z0, z1 }, o));
  for (const s of STACKS) {
    const [x0, z0, x1, z1, y, t, pi] = s;
    if (pi < 0) { box('cont', x0, x1, y, y + t * CH, z0, z1); continue; }
    const p = PADS[pi], w = 0.1, back = p.dir < 0 ? [x1 - w, x1] : [x0, x0 + w];
    box('cont', x0, x1, y, y + CH, z0, z0 + w, { pad: pi }); box('cont', x0, x1, y, y + CH, z1 - w, z1, { pad: pi });
    box('cont', back[0], back[1], y, y + CH, z0, z1, { pad: pi }); box('cont', x0, x1, y + CH - 0.1, y + CH, z0, z1, { pad: pi });
    if (t > 1) box('cont', x0, x1, y + CH, y + t * CH, z0, z1);
    box('furn', p.crate[0], p.crate[2], y, y + 0.85, p.crate[1], p.crate[3], { sub: 'crate' });
    const d = 0.04, xe = p.door, h = CH - 0.15;
    p.doorId = addDoor({ f: p.f, x0: xe, z0: z0 + w, x1: xe, z1: z1 - w, horiz: false, h, hidden: false, cx: xe, cz: p.cz, y, exterior: true, pad: pi, swing: p.dir < 0 ? -1 : 1,
      box: { kind: 'door', x0: xe - d, x1: xe + d, z0: z0 + w, z1: z1 - w, y0: y, y1: y + h } }).id;
  }
  box('hull', HULL.x0, HULL.x1, -3, DECK, HULL.z0, HULL.z1);
  const BW = DECK + 1.1, gaps = GANGWAYS.map(g => [g.b, g.c]);
  let x = HULL.x0; for (const [a, c] of gaps) { box('bulwark', x, a, DECK, BW, HULL.z1 - 0.3, HULL.z1); x = c; } box('bulwark', x, HULL.x1, DECK, BW, HULL.z1 - 0.3, HULL.z1);
  box('bulwark', HULL.x0, HULL.x1, DECK, BW, HULL.z0, HULL.z0 + 0.3); box('bulwark', HULL.x0, HULL.x0 + 0.3, DECK, BW, HULL.z0, HULL.z1); box('bulwark', HULL.x1 - 0.3, HULL.x1, DECK, BW, HULL.z0, HULL.z1);
  for (const g of GANGWAYS) {   // steel side panels the full height of the ramp; the landing is a plate bridging to the deck
    box('gang', g.a, g.b, 0, DECK + 1.1, RAMP.z0 - 0.06, RAMP.z0); box('gang', g.a, g.c, 0, DECK + 1.1, RAMP.z1, RAMP.z1 + 0.06);
    box('gang', g.c, g.c + 0.06, DECK - 0.2, DECK + 1.1, HULL.z1, RAMP.z1 + 0.06); box('gang', g.b - 0.06, g.b, DECK - 0.2, DECK + 1.1, HULL.z1, RAMP.z0);
    box('plat', g.b, g.c, DECK - 0.2, DECK, HULL.z1, RAMP.z1);
  }
  let qx = YARD.x0; box('edge', qx, YARD.x1, 0, 1.05, 0, 0.25);   // quay safety rail
  for (const c of STS) for (const lx of [c - 8, c + 8]) { box('crane', lx - 0.6, lx + 0.6, 0, 14, 3, 4.2); box('crane', lx - 0.6, lx + 0.6, 0, 14, 26.8, 28); }
  for (const c of STS) for (const z of [3, 26.8]) box('crane', c - 8.6, c + 8.6, 13, 14.6, z, z + 1.2);
  for (const [cx, za, zb] of RTG) for (const lx of [cx - 4.5, cx + 4.5]) for (const z of [za, zb]) box('crane', lx - 0.5, lx + 0.5, 0, 16, z, z + 1);
  for (const t of TRUCKS) box('truck', t.x, t.x + 16.5, 0, t.load ? 4.0 : 3.1, t.z, t.z + 2.5, { truck: t.c });
  for (const [fx, fz] of FLOODS) box('pole', fx - 0.35, fx + 0.35, 0, 24, fz - 0.35, fz + 0.35);
  box('fence', YARD.x0, EXIT.x0, 0, 2.6, 76, 76.08); box('fence', EXIT.x1, YARD.x1, 0, 2.6, 76, 76.08);
  box('fence', -5.6, -5.52, 0, 2.6, 0, 76); box('fence', 115.52, 115.6, 0, 2.6, 0, 76);
  box('furn', 37.4, 38, 0, 1.2, 75.6, 76.6, { sub: 'booth' }); box('furn', 48, 50.4, 0, 2.6, 74.2, 76, { sub: 'guard' });
}

export default {
  id: 'terminal', name: 'TERMINAL', op: 'Operation IRON TIDE', H, DOOR_H, YARD, layers: 4, layerFloor: [0, 2, 3, 4],
  spawn: SPAWN, exit: EXIT, breaker: BREAKER, cars: [], rooms: ROOMS, openings: OPENINGS, glass: GLASS, furniture: FURNITURE,
  spots: { s: SUSPECT_SPOTS, c: CIV_SPOTS, b: [] }, pads: PADS, hvt: HVT, veg: null, counts: { s: 14, c: 8, b: 3, padCivs: 2 }, time: 900, patrolMax: 32,
  stairs: [{ ...TSTAIR, yb: DECK, n: 2 }],
  lobby: { x: 48.6, y: 1.5, z: 78.6, tx: 43, tz: 80 },
  brief: ['Armed crew hold the port: 8 hostages, 3 bombs in padlocked', 'containers. Cut the lock, open up, defuse. 15:00. The boss is on', "the ship's bridge with two guards: take him alive."],
  surfaces, floorRay, solidFloor, terrainY, floorAt, extra,
  onStairs: inTStair, inside, objective: (x, z) => z < 60, roofY,
};
