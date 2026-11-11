// BREACHLINE level: mansion geometry, collision, raycast, navigation. Pure logic (no DOM, no three).
export const H = 3.2, U = 0.5, T = 0.2, DOOR_H = 2.1;
export const FOOT = { x0: 0, z0: 0, x1: 24, z1: 16 };
export const YARD = { x0: -8, z0: -16, x1: 32, z1: 30 };   // front yard at street level, back yard one storey lower, cliff edge at z0
export const STAIR = { x0: 13.5, x1: 15, z0: 4, z1: 9 };
export const SPAWN = [[10.5, 27], [11.5, 27], [12.5, 27], [13.5, 27]];

// [floor, name, x0, z0, x1, z1, floorMaterial]
export const ROOMS = [
  [0, 'Living room', 0, 8, 9, 16, 'wood'], [0, 'Foyer', 9, 9, 15, 16, 'marble'], [0, 'Dining room', 15, 8, 24, 16, 'wood'],
  [0, 'Kitchen', 15, 0, 24, 8, 'tile'], [0, 'Hall', 9, 4, 13.5, 9, 'wood'], [0, 'Study', 0, 0, 9, 8, 'carpet'],
  [0, 'Utility', 9, 0, 15, 4, 'tile'],
  [-1, 'Rec room', 0, 0, 9, 8, 'wood'], [-1, 'Cinema', 0, 8, 9, 16, 'carpet'], [-1, 'Lower hall', 9, 9, 15, 16, 'tile'], [-1, 'Gym', 15, 8, 24, 16, 'carpet'],
  [-1, 'Wine cellar', 9, 4, 13.5, 9, 'tile'], [-1, 'Pool lounge', 9, 0, 15, 4, 'marble'], [-1, 'Plant room', 15, 0, 24, 8, 'tile'],
  [1, 'Landing', 9, 0, 15, 4, 'wood'], [1, 'Corridor', 9, 4, 13.5, 9, 'wood'], [1, 'Master bedroom', 0, 8, 9, 16, 'carpet'],
  [1, 'Office', 0, 4, 9, 8, 'wood'], [1, 'Bedroom 2', 0, 0, 9, 4, 'carpet'], [1, 'Lounge', 9, 9, 15, 16, 'wood'],
  [1, 'Bedroom 3', 15, 8, 24, 16, 'carpet'], [1, 'Bedroom 4', 15, 0, 24, 8, 'carpet'],
];
// [floor, x0, z0, x1, z1, kind]  kind: door (leaf), arch (lintel, no leaf), gap (no lintel)
const OPENINGS = [   // optional 7th item: 'ext' (outside door, starts closed) or 'hidden' (concealed outside door, never locked)
  [0, 11.5, 16, 12.5, 16, 'door', 'ext'], [0, 10.5, 9, 11.5, 9, 'door'], [0, 9, 12, 9, 13.5, 'arch'], [0, 15, 12, 15, 13.5, 'arch'],
  [0, 13.5, 9, 15, 9, 'gap'], [0, 9, 5.5, 9, 6.5, 'door'], [0, 11, 4, 12, 4, 'door'], [0, 19, 8, 20, 8, 'door'],
  [0, 15, 1.5, 15, 2.5, 'door'], [0, 4, 8, 5, 8, 'door'], [0, 14, 4, 15, 4, 'door'],
  [1, 9, 4, 15, 4, 'gap'], [1, 9, 12, 9, 13, 'door'], [1, 9, 1.5, 9, 2.5, 'door'], [1, 9, 5.5, 9, 6.5, 'door'],
  [1, 10.5, 9, 11.5, 9, 'door'], [1, 15, 12, 15, 13, 'door'], [1, 15, 1.5, 15, 2.5, 'door'],
  [-1, 13.5, 9, 15, 9, 'gap'], [-1, 9, 12, 9, 13, 'door'], [-1, 15, 12, 15, 13, 'door'], [-1, 10.5, 9, 11.5, 9, 'door'], [-1, 11, 4, 12, 4, 'door'],
  [-1, 9, 1.5, 9, 3, 'arch'], [-1, 15, 1.5, 15, 2.5, 'door'], [-1, 4, 8, 5, 8, 'door'], [-1, 19, 8, 20, 8, 'door'],
  [-1, 11.5, 0, 12.5, 0, 'door', 'ext'], [-1, 20, 0, 21, 0, 'door', 'hidden'],
];
// Floor-to-ceiling glazing on the outside walls: [floor, x0, z0, x1, z1]. Blocks movement, not bullets or (close) sight.
const GLASS = [
  [0, 1, 16, 8.5, 16], [0, 15.5, 16, 23, 16], [1, 1, 16, 8.5, 16], [1, 9.5, 16, 14.5, 16], [1, 15.5, 16, 23, 16],
  [0, 0, 9, 0, 15], [1, 0, 9, 0, 15], [1, 24, 9, 24, 15],
  [-1, 1, 0, 8.5, 0], [-1, 9.5, 0, 11.5, 0], [-1, 12.5, 0, 14.5, 0], [0, 2, 0, 7, 0], [1, 2, 0, 7, 0], [1, 16, 0, 23, 0],
];
// [floor, x0, z0, x1, z1, height, kind]
export const FURNITURE = [
  [0, 2, 11, 5, 12, 0.8, 'sofa'], [0, 1, 13, 2, 15.5, 0.8, 'sofa'], [0, 3, 13, 4.5, 14, 0.45, 'table'], [0, 0.2, 8.3, 0.7, 10.5, 2, 'shelf'],
  [0, 18, 11, 21.5, 12.5, 0.78, 'table'], [0, 23.2, 9, 23.8, 12, 0.9, 'cabinet'],
  [0, 18, 3, 21, 4.2, 0.92, 'counter'], [0, 23.2, 0.3, 23.8, 6, 0.92, 'counter'], [0, 15.3, 5, 15.9, 7.5, 0.92, 'counter'], [0, 16, 0.3, 19.5, 0.9, 0.92, 'counter'],
  [0, 3, 3, 5, 4, 0.76, 'table'], [0, 0.2, 0.3, 0.7, 6, 2, 'shelf'], [0, 2, 0.2, 7, 0.7, 2, 'shelf'], [0, 6.5, 5, 7.5, 6, 0.8, 'sofa'],
  [0, 9.3, 10, 9.8, 11.5, 0.85, 'cabinet'], [0, 9.3, 0.3, 9.8, 3, 1.8, 'shelf'], [0, 13.5, 0.3, 14.7, 1, 0.9, 'counter'],
  [0, 2.5, 19.5, 10, 23.5, 0.55, 'pool'], [0, 14.5, 19.6, 20, 20, 0.9, 'wall'], [0, 21, 22, 23, 26.4, 1.5, 'car'], [0, -4, 18, -3.4, 24, 0.9, 'wall'],
  [-1, 5, -13.5, 19, -7.5, 0.35, 'pool'], [-1, 15.5, -4.6, 18.5, -3.7, 0.8, 'sofa'], [-1, 21, -11, 22.4, -9.6, 0.5, 'wall'], [-1, 1, -6, 1.8, -4, 0.4, 'bed'], [-1, 2.6, -6, 3.4, -4, 0.4, 'bed'],
  [-1, 18.6, -1.6, 19.6, -0.5, 1.5, 'hedge'], [-1, 21.4, -1.6, 22.4, -0.5, 1.5, 'hedge'], [-1, 18.8, -3.3, 22.2, -2.8, 1.7, 'hedge'],
  [-1, 3.2, 3, 5.6, 4.3, 0.8, 'table'], [-1, 0.3, 6.6, 4, 7.2, 1.05, 'counter'], [-1, 6, 1.5, 6.9, 4, 0.8, 'sofa'],
  [-1, 2, 11, 6, 12, 0.8, 'sofa'], [-1, 2, 13.2, 6, 14.2, 0.8, 'sofa'], [-1, 8.2, 9, 8.7, 15, 0.5, 'cabinet'],
  [-1, 17, 10, 18, 12, 0.5, 'cabinet'], [-1, 20, 10, 21, 12.5, 0.9, 'cabinet'], [-1, 23.2, 9, 23.8, 14, 1.8, 'shelf'],
  [-1, 9.3, 4.3, 9.8, 8.5, 2, 'shelf'], [-1, 12.9, 5, 13.3, 8.5, 2, 'shelf'], [-1, 10.5, 1, 13, 1.9, 0.8, 'sofa'],
  [-1, 17, 1, 19, 2.5, 1.9, 'cabinet'], [-1, 21.5, 4, 23.5, 6.5, 1.6, 'cabinet'], [-1, 15.3, 5, 15.9, 7.5, 0.9, 'counter'],
  [1, 3, 11, 5.2, 13.2, 0.6, 'bed'], [1, 0.2, 8.3, 0.8, 11, 2, 'shelf'], [1, 6, 15.2, 8, 15.8, 0.85, 'cabinet'],
  [1, 2, 1, 4, 3, 0.6, 'bed'], [1, 6.5, 0.2, 8, 0.8, 0.76, 'table'], [1, 3, 5.5, 5, 6.5, 0.76, 'table'], [1, 0.2, 4.3, 0.7, 7, 1.6, 'shelf'],
  [1, 10.5, 13, 13.5, 14, 0.8, 'sofa'], [1, 11, 11, 13, 12, 0.45, 'table'], [1, 19, 11, 21.2, 13.2, 0.6, 'bed'], [1, 23.2, 9, 23.8, 12, 2, 'shelf'],
  [1, 19, 3, 21.2, 5.2, 0.6, 'bed'], [1, 16, 0.2, 18, 0.8, 0.76, 'table'], [1, 10, 0.2, 11.5, 0.7, 0.9, 'cabinet'],
];
// candidate positions [floor, x, z]
export const SUSPECT_SPOTS = [
  [0, 5, 14.5], [0, 7, 10], [0, 12, 11], [0, 20, 14], [0, 17, 10], [0, 17, 2], [0, 22, 6.8], [0, 5, 6], [0, 7.5, 2], [0, 11, 6.5], [0, 12, 2],
  [-1, 5, 6], [-1, 7, 12.6], [-1, 12, 11], [-1, 19, 14], [-1, 11.5, 6.5], [-1, 12, 3], [-1, 19.5, 5.5], [-1, 22, 1.5],
  [1, 12, 2], [1, 11, 6.5], [1, 6, 10], [1, 2, 14.5], [1, 6, 2.5], [1, 7, 6], [1, 12, 15], [1, 10, 10.5], [1, 17, 14], [1, 22, 14], [1, 17, 6], [1, 22, 2],
];
export const CIV_SPOTS = [
  [-1, 1, 15], [-1, 22.5, 15], [-1, 8, 0.8], [-1, 23, 7.3],
  [0, 7.5, 15], [0, 22, 15], [0, 21.5, 7], [0, 8, 7], [0, 14, 3], [1, 7.5, 14.5], [1, 1, 3.2], [1, 8, 5], [1, 16.5, 9.5], [1, 23, 7], [1, 14, 10],
];
// [floor, x, z, surfaceHeight]
export const BOMB_SPOTS = [
  [-1, 4.4, 4.05, 0.8], [-1, 2, 6.9, 1.05], [-1, 15.6, 6.2, 0.9],
  [0, 19.5, 12.25, 0.78], [0, 19.5, 3.95, 0.92], [0, 4, 3.75, 0.76], [1, 7, 15.4, 0.85], [1, 17, 0.6, 0.76], [0, 14.1, 0.75, 0.9], [1, 4, 6.25, 0.76],
];

export const NX = (YARD.x1 - YARD.x0) / U, NZ = (YARD.z1 - YARD.z0) / U;
const inStair = (x, z) => x > STAIR.x0 && x < STAIR.x1 && z > STAIR.z0 && z < STAIR.z1;
const stairT = z => (STAIR.z1 - z) / (STAIR.z1 - STAIR.z0);
const inFoot = (x, z) => x >= FOOT.x0 && x <= FOOT.x1 && z >= FOOT.z0 && z <= FOOT.z1;
export { inStair, inFoot };

// Outside the house the land steps down from the street (y 0) to the back yard (y -H) along the sides.
export function terrainY(z) { return z >= 12 ? 0 : z <= 4 ? -H : -H * (12 - z) / 8; }
const stairUp = z => Math.min(1, stairT(z) / 0.85) * H;   // the flight to the upper floor; the basement flight runs exactly one storey beneath it
// Height of the walking surface under (x,z) for something currently at feet height prevY.
export function groundY(x, z, prevY) {
  if (!inFoot(x, z)) return terrainY(z);
  if (inStair(x, z)) { const up = stairUp(z); return prevY > up - H / 2 ? up : up - H; }
  return Math.max(-1, Math.min(1, Math.round(prevY / H))) * H;
}
// Nav layers 0,1,2 = basement, ground, upper. Height of layer li at a point, or NaN where that layer has no floor.
function cellY(li, x, z) {
  if (!inFoot(x, z)) { const y = terrainY(z); return (y < -H / 2 ? 0 : 1) === li ? y : NaN; }
  if (inStair(x, z)) { const top = stairT(z) > 0.85, up = stairUp(z); return li === 2 ? (top ? H : NaN) : li === 1 ? (top ? 0 : up) : (top ? NaN : up - H); }
  return (li - 1) * H;
}
export function layerOf(x, z, y) { let best = 1, bd = 1e9; for (let li = 0; li < 3; li++) { const d = Math.abs(cellY(li, x, z) - y); if (d < bd) { bd = d; best = li; } } return best; }

let cached = null;
export function buildLevel() {
  if (cached) return cached;
  const edges = new Set();
  const k = (f, i, j, o) => f + '|' + i + '|' + j + '|' + o;
  for (const [f, , x0, z0, x1, z1] of ROOMS) {
    const i0 = x0 / U, i1 = x1 / U, j0 = z0 / U, j1 = z1 / U;
    for (let i = i0; i < i1; i++) { edges.add(k(f, i, j0, 'h')); edges.add(k(f, i, j1, 'h')); }
    for (let j = j0; j < j1; j++) { edges.add(k(f, i0, j, 'v')); edges.add(k(f, i1, j, 'v')); }
  }
  const boxes = [], doors = [], openEnds = new Set(), gedges = new Set(), glassPts = new Set();
  for (const [f, x0, z0, x1, z1] of GLASS) {
    if (z0 === z1) for (let x = x0; x <= x1; x += U) glassPts.add(f + '|' + x + '|' + z0); else for (let z = z0; z <= z1; z += U) glassPts.add(f + '|' + x0 + '|' + z);
    openEnds.add(f + '|' + x0 + '|' + z0); openEnds.add(f + '|' + x1 + '|' + z1);
    if (z0 === z1) for (let i = x0 / U; i < x1 / U; i++) { if (edges.delete(k(f, i, z0 / U, 'h'))) gedges.add(k(f, i, z0 / U, 'h')); }
    else for (let j = z0 / U; j < z1 / U; j++) { if (edges.delete(k(f, x0 / U, j, 'v'))) gedges.add(k(f, x0 / U, j, 'v')); }
  }
  for (const [f, x0, z0, x1, z1, kind, tag] of OPENINGS) {
    if (z0 === z1) for (let i = x0 / U; i < x1 / U; i++) edges.delete(k(f, i, z0 / U, 'h'));
    else for (let j = z0 / U; j < z1 / U; j++) edges.delete(k(f, x0 / U, j, 'v'));
    const hz = z0 === z1;
    openEnds.add(f + '|' + x0 + '|' + z0); openEnds.add(f + '|' + x1 + '|' + z1);
    if (kind !== 'gap') boxes.push({ f, kind: 'lintel', x0: hz ? x0 : x0 - T / 2, x1: hz ? x1 : x0 + T / 2, z0: hz ? z0 - T / 2 : z0, z1: hz ? z0 + T / 2 : z1, y0: f * H + DOOR_H, y1: f * H + H });
    if (kind === 'door') {
      const d = 0.04;
      doors.push({ id: doors.length, f, x0, z0, x1, z1, horiz: hz, hidden: tag === 'hidden', cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, y: f * H, exterior: !!tag,
        box: { kind: 'door', x0: hz ? x0 : x0 - d, x1: hz ? x1 : x0 + d, z0: hz ? z0 - d : z0, z1: hz ? z0 + d : z1, y0: f * H, y1: f * H + DOOR_H } });
    }
  }
  // merge unit edges into wall runs (solid walls, then glass panes)
  const merge = (set, kind, th) => {
    const runs = new Map();
    for (const e of set) { const [f, i, j, o] = e.split('|'); const key = f + '|' + o + '|' + (o === 'h' ? j : i); (runs.get(key) || runs.set(key, []).get(key)).push(+(o === 'h' ? i : j)); }
    for (const [key, arr] of runs) {
      const [f, o, c] = key.split('|'); const fl = +f, line = +c * U; arr.sort((a, b) => a - b);
      let a = arr[0], p = arr[0];
      const flush = () => {
        let s = a * U, e = (p + 1) * U, capA = true, capB = true;
        const pt = v => o === 'h' ? fl + '|' + v + '|' + line : fl + '|' + line + '|' + v;
        // An end that runs into a crossing wall is buried in it (no end face, so nothing is coplanar). At a doorway, a free end or a glass line it gets a visible end face.
        const crossing = (set, n) => o === 'h' ? set.has(k(fl, n, +c, 'v')) || set.has(k(fl, n, +c - 1, 'v')) : set.has(k(fl, +c, n, 'h')) || set.has(k(fl, +c - 1, n, 'h'));
        if (kind === 'wall') {
          if (crossing(edges, a)) { s -= T / 2; capA = false; } else if (crossing(gedges, a)) s -= 0.04;
          if (crossing(edges, p + 1)) { e += T / 2; capB = false; } else if (crossing(gedges, p + 1)) e += 0.04;
        }
        const ext = o === 'h' ? (line === FOOT.z0 || line === FOOT.z1) : (line === FOOT.x0 || line === FOOT.x1);
        boxes.push(o === 'h' ? { f: fl, kind, ext, capA, capB, horiz: true, x0: s, x1: e, z0: line - th / 2, z1: line + th / 2, y0: fl * H, y1: fl * H + H }
          : { f: fl, kind, ext, capA, capB, horiz: false, x0: line - th / 2, x1: line + th / 2, z0: s, z1: e, y0: fl * H, y1: fl * H + H });
      };
      for (let n = 1; n < arr.length; n++) { if (arr[n] !== p + 1) { flush(); a = arr[n]; } p = arr[n]; }
      flush();
    }
  };
  merge(edges, 'wall', T); merge(gedges, 'glass', 0.06);
  for (const [f, x0, z0, x1, z1, h, kind] of FURNITURE) boxes.push({ f, kind: 'furn', sub: kind, x0, x1, z0, z1, y0: f * H, y1: f * H + h });
  const level = { boxes, doors, walk: null };
  // nav grid, three layers
  const walk = new Uint8Array(3 * NX * NZ), cy = new Float32Array(3 * NX * NZ);
  for (let l = 0; l < 3; l++) for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = YARD.x0 + (i + 0.5) * U, z = YARD.z0 + (j + 0.5) * U, y = cellY(l, x, z), id = l * NX * NZ + j * NX + i;
    cy[id] = y; walk[id] = !Number.isNaN(y) && !circleHits(level, null, x, z, 0.235, y) ? 1 : 0;
  }
  level.cy = cy;
  level.walk = walk;
  return (cached = level);
}

const blocksAt = (b, feetY) => b.y0 < feetY + 1.2 && b.y1 > feetY + 0.25;
// doorOpen: array of booleans (closed doors block) or null to ignore doors
export function circleHits(level, doorOpen, x, z, r, feetY) {
  for (const b of level.boxes) if (blocksAt(b, feetY) && x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) {
    const dx = x - Math.max(b.x0, Math.min(x, b.x1)), dz = z - Math.max(b.z0, Math.min(z, b.z1));
    if (dx * dx + dz * dz < r * r) return true;
  }
  if (doorOpen) for (const d of level.doors) if (!doorOpen[d.id]) { const b = d.box; if (blocksAt(b, feetY) && x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return true; }
  return false;
}
// Push a circle out of walls/furniture/closed doors. Returns [x, z].
export function resolveCircle(level, doorOpen, x, z, r, feetY) {
  const push = b => {
    if (!blocksAt(b, feetY) || x <= b.x0 - r || x >= b.x1 + r || z <= b.z0 - r || z >= b.z1 + r) return;
    const nx = Math.max(b.x0, Math.min(x, b.x1)), nz = Math.max(b.z0, Math.min(z, b.z1));
    let dx = x - nx, dz = z - nz; const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return;
    if (d2 > 1e-9) { const d = Math.sqrt(d2); x = nx + dx / d * r; z = nz + dz / d * r; }
    else { // centre inside the box: leave by the nearest face
      const l = x - b.x0, rr = b.x1 - x, t = z - b.z0, bt = b.z1 - z, m = Math.min(l, rr, t, bt);
      if (m === l) x = b.x0 - r; else if (m === rr) x = b.x1 + r; else if (m === t) z = b.z0 - r; else z = b.z1 + r;
    }
  };
  for (let pass = 0; pass < 2; pass++) {
    for (const b of level.boxes) push(b);
    if (doorOpen) for (const d of level.doors) if (!doorOpen[d.id]) push(d.box);
  }
  x = Math.max(YARD.x0 + 0.4, Math.min(YARD.x1 - 0.4, x)); z = Math.max(YARD.z0 + 0.4, Math.min(YARD.z1 - 0.4, z));
  return [x, z];
}

function rayBox(b, ox, oy, oz, dx, dy, dz, max) {
  let t0 = 0, t1 = max, a, c;
  if (Math.abs(dx) < 1e-9) { if (ox < b.x0 || ox > b.x1) return -1; } else { a = (b.x0 - ox) / dx; c = (b.x1 - ox) / dx; if (a > c) { const s = a; a = c; c = s; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return -1; }
  if (Math.abs(dy) < 1e-9) { if (oy < b.y0 || oy > b.y1) return -1; } else { a = (b.y0 - oy) / dy; c = (b.y1 - oy) / dy; if (a > c) { const s = a; a = c; c = s; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return -1; }
  if (Math.abs(dz) < 1e-9) { if (oz < b.z0 || oz > b.z1) return -1; } else { a = (b.z0 - oz) / dz; c = (b.z1 - oz) / dz; if (a > c) { const s = a; a = c; c = s; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return -1; }
  return t0;
}
// Distance along a unit ray to the first solid surface (walls, furniture, closed doors, floors), or max.
export function rayStatic(level, doorOpen, ox, oy, oz, dx, dy, dz, max, solidGlass = false) {
  let best = max;
  for (const b of level.boxes) { if (b.kind === 'glass' && !solidGlass) continue; const t = rayBox(b, ox, oy, oz, dx, dy, dz, best); if (t >= 0 && t < best) best = t; }
  if (doorOpen) for (const d of level.doors) if (!doorOpen[d.id]) { const t = rayBox(d.box, ox, oy, oz, dx, dy, dz, best); if (t >= 0 && t < best) best = t; }
  if (Math.abs(dy) > 1e-9) for (const py of [-H, 0, H, 2 * H]) {
    const t = (py - oy) / dy; if (t <= 1e-6 || t >= best) continue;
    const x = ox + dx * t, z = oz + dz * t;
    if (py === -H || (inFoot(x, z) ? !(py < 2 * H && inStair(x, z)) : (py === 0 && z >= 12))) best = t;
  }
  const den = dy - 0.4 * dz;   // the sloped ground beside the house: y = 0.4 z - 4.8 for z in 4..12
  if (Math.abs(den) > 1e-9) { const t = -(oy - 0.4 * oz + 4.8) / den; if (t > 1e-6 && t < best) { const x = ox + dx * t, z = oz + dz * t; if (z > 4 && z < 12 && !inFoot(x, z)) best = t; } }
  return best;
}
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const mx = ox - cx, my = oy - cy, mz = oz - cz, b = mx * dx + my * dy + mz * dz, c = mx * mx + my * my + mz * mz - r * r;
  if (c > 0 && b > 0) return -1; const disc = b * b - c; if (disc < 0) return -1;
  return Math.max(0, -b - Math.sqrt(disc));
}

const cellOf = (x, z) => [Math.floor((x - YARD.x0) / U), Math.floor((z - YARD.z0) / U)];
const cellXZ = (i, j) => [YARD.x0 + (i + 0.5) * U, YARD.z0 + (j + 0.5) * U];
function nearestWalk(level, x, z, l) {
  const [ci, cj] = cellOf(x, z); let best = -1, bd = 1e9;
  for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
    const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= NX || j >= NZ) continue;
    for (let ll = 0; ll < 3; ll++) { const id = ll * NX * NZ + j * NX + i; if (!level.walk[id]) continue; const d = di * di + dj * dj + Math.abs(ll - l) * 100; if (d < bd) { bd = d; best = id; } }
  }
  return best;
}
// A* over the three-layer grid. Doors are treated as passable. Returns [[x,z,storey],...] (storey -1, 0, 1) or null.
export function findPath(level, sx, sz, sy, tx, tz, ty) {
  const N = NX * NZ, T3 = 3 * N, start = nearestWalk(level, sx, sz, layerOf(sx, sz, sy)), goal = nearestWalk(level, tx, tz, layerOf(tx, tz, ty));
  if (start < 0 || goal < 0) return null;
  const g = new Float32Array(T3).fill(Infinity), from = new Int32Array(T3).fill(-1), closed = new Uint8Array(T3), W = level.walk, CY = level.cy;
  const gc = goal % N, gi = gc % NX, gj = (gc - gi) / NX, gl = (goal - gc) / N;
  const hcost = id => { const c = id % N, i = c % NX, j = (c - i) / NX, dx = Math.abs(i - gi), dz = Math.abs(j - gj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz) + Math.abs((id - c) / N - gl) * 4; };
  const heap = [], hf = [];
  const pushH = (id, f) => { let n = heap.length; heap.push(id); hf.push(f); while (n > 0) { const p = (n - 1) >> 1; if (hf[p] <= hf[n]) break; [heap[p], heap[n]] = [heap[n], heap[p]]; [hf[p], hf[n]] = [hf[n], hf[p]]; n = p; } };
  const popH = () => { const top = heap[0], lid = heap.pop(), lf = hf.pop(); if (heap.length) { heap[0] = lid; hf[0] = lf; let n = 0; for (;;) { let m = n; const a = 2 * n + 1, b = a + 1; if (a < heap.length && hf[a] < hf[m]) m = a; if (b < heap.length && hf[b] < hf[m]) m = b; if (m === n) break; [heap[m], heap[n]] = [heap[n], heap[m]]; [hf[m], hf[n]] = [hf[n], hf[m]]; n = m; } } return top; };
  g[start] = 0; pushH(start, hcost(start));
  while (heap.length) {
    const cur = popH(); if (closed[cur]) continue; closed[cur] = 1;
    if (cur === goal) break;
    const c = cur % N, l = (cur - c) / N, i = c % NX, j = (c - i) / NX, y = CY[cur];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const i2 = i + di, j2 = j + dj; if (i2 < 0 || j2 < 0 || i2 >= NX || j2 >= NZ) continue;
      const c2 = j2 * NX + i2, diag = di && dj; let nid = -1;
      if (diag) { if (W[l * N + c2] && Math.abs(CY[l * N + c2] - y) < 0.3 && W[l * N + j * NX + i2] && W[l * N + j2 * NX + i]) nid = l * N + c2; }
      else for (const l2 of [l, l + 1, l - 1]) { if (l2 < 0 || l2 > 2) continue; const id = l2 * N + c2; if (W[id] && Math.abs(CY[id] - y) < 0.6) { nid = id; break; } }   // steps and slopes join layers where heights meet
      if (nid < 0) continue;
      const ng = g[cur] + (diag ? 1.414 : 1);
      if (ng < g[nid]) { g[nid] = ng; from[nid] = cur; pushH(nid, ng + hcost(nid)); }
    }
  }
  if (from[goal] < 0 && goal !== start) return null;
  const out = []; for (let id = goal; id >= 0; id = from[id]) { const c = id % N, i = c % NX, j = (c - i) / NX; const [x, z] = cellXZ(i, j); out.push([x, z, (id - c) / N - 1]); if (id === start) break; }
  return out.reverse();
}
