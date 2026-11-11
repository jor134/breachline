// BREACHLINE level: mansion geometry, collision, raycast, navigation. Pure logic (no DOM, no three).
export const H = 3.2, U = 0.5, T = 0.2, DOOR_H = 2.1;
export const FOOT = { x0: 0, z0: 0, x1: 24, z1: 16 };
export const YARD = { x0: -8, z0: -8, x1: 32, z1: 30 };
export const STAIR = { x0: 13.5, x1: 15, z0: 4, z1: 9 };
export const SPAWN = [[10.5, 27], [11.5, 27], [12.5, 27], [13.5, 27]];

// [floor, name, x0, z0, x1, z1, floorMaterial]
export const ROOMS = [
  [0, 'Living room', 0, 8, 9, 16, 'wood'], [0, 'Foyer', 9, 9, 15, 16, 'marble'], [0, 'Dining room', 15, 8, 24, 16, 'wood'],
  [0, 'Kitchen', 15, 0, 24, 8, 'tile'], [0, 'Hall', 9, 4, 13.5, 9, 'wood'], [0, 'Study', 0, 0, 9, 8, 'carpet'],
  [0, 'Utility', 9, 0, 15, 4, 'tile'],
  [1, 'Landing', 9, 0, 15, 4, 'wood'], [1, 'Corridor', 9, 4, 13.5, 9, 'wood'], [1, 'Master bedroom', 0, 8, 9, 16, 'carpet'],
  [1, 'Office', 0, 4, 9, 8, 'wood'], [1, 'Bedroom 2', 0, 0, 9, 4, 'carpet'], [1, 'Lounge', 9, 9, 15, 16, 'wood'],
  [1, 'Bedroom 3', 15, 8, 24, 16, 'carpet'], [1, 'Bedroom 4', 15, 0, 24, 8, 'carpet'],
];
// [floor, x0, z0, x1, z1, kind]  kind: door (leaf), arch (lintel, no leaf), gap (no lintel)
const OPENINGS = [
  [0, 11.5, 16, 12.5, 16, 'door'], [0, 9, 12, 9, 13.5, 'arch'], [0, 15, 12, 15, 13.5, 'arch'], [0, 10.5, 9, 11.5, 9, 'door'],
  [0, 13.5, 9, 15, 9, 'gap'], [0, 9, 5.5, 9, 6.5, 'door'], [0, 11, 4, 12, 4, 'door'], [0, 19, 8, 20, 8, 'door'],
  [0, 15, 1.5, 15, 2.5, 'door'], [0, 20, 0, 21, 0, 'door'], [0, 4, 8, 5, 8, 'door'],
  [1, 9, 4, 15, 4, 'gap'], [1, 9, 12, 9, 13, 'door'], [1, 9, 1.5, 9, 2.5, 'door'], [1, 9, 5.5, 9, 6.5, 'door'],
  [1, 10.5, 9, 11.5, 9, 'door'], [1, 15, 12, 15, 13, 'door'], [1, 15, 1.5, 15, 2.5, 'door'],
];
// [floor, x0, z0, x1, z1, height, kind]
export const FURNITURE = [
  [0, 2, 11, 5, 12, 0.8, 'sofa'], [0, 1, 13, 2, 15.5, 0.8, 'sofa'], [0, 3, 13, 4.5, 14, 0.45, 'table'], [0, 0.2, 8.3, 0.7, 10.5, 2, 'shelf'],
  [0, 18, 11, 21.5, 12.5, 0.78, 'table'], [0, 23.2, 9, 23.8, 12, 0.9, 'cabinet'],
  [0, 18, 3, 21, 4.2, 0.92, 'counter'], [0, 23.2, 0.3, 23.8, 6, 0.92, 'counter'], [0, 15.3, 5, 15.9, 7.5, 0.92, 'counter'], [0, 16, 0.3, 19.5, 0.9, 0.92, 'counter'],
  [0, 3, 3, 5, 4, 0.76, 'table'], [0, 0.2, 0.3, 0.7, 6, 2, 'shelf'], [0, 2, 0.2, 7, 0.7, 2, 'shelf'], [0, 6.5, 5, 7.5, 6, 0.8, 'sofa'],
  [0, 9.3, 10, 9.8, 11.5, 0.85, 'cabinet'], [0, 9.3, 0.3, 9.8, 3, 1.8, 'shelf'], [0, 13.5, 0.3, 14.7, 1, 0.9, 'counter'],
  [0, 5, 20, 7, 24.5, 1.4, 'car'], [0, 9, 19, 10.5, 19.6, 0.9, 'planter'], [0, 13.5, 19, 15, 19.6, 0.9, 'planter'], [0, 17, 21, 19, 25.5, 1.4, 'car'],
  [1, 3, 11, 5.2, 13.2, 0.6, 'bed'], [1, 0.2, 8.3, 0.8, 11, 2, 'shelf'], [1, 6, 15.2, 8, 15.8, 0.85, 'cabinet'],
  [1, 2, 1, 4, 3, 0.6, 'bed'], [1, 6.5, 0.2, 8, 0.8, 0.76, 'table'], [1, 3, 5.5, 5, 6.5, 0.76, 'table'], [1, 0.2, 4.3, 0.7, 7, 1.6, 'shelf'],
  [1, 10.5, 13, 13.5, 14, 0.8, 'sofa'], [1, 11, 11, 13, 12, 0.45, 'table'], [1, 19, 11, 21.2, 13.2, 0.6, 'bed'], [1, 23.2, 9, 23.8, 12, 2, 'shelf'],
  [1, 19, 3, 21.2, 5.2, 0.6, 'bed'], [1, 16, 0.2, 18, 0.8, 0.76, 'table'], [1, 10, 0.2, 11.5, 0.7, 0.9, 'cabinet'],
];
// candidate positions [floor, x, z]
export const SUSPECT_SPOTS = [
  [0, 5, 14.5], [0, 7, 10], [0, 12, 11], [0, 20, 14], [0, 17, 10], [0, 17, 2], [0, 22, 6.8], [0, 5, 6], [0, 7.5, 2], [0, 11, 6.5], [0, 12, 2],
  [1, 12, 2], [1, 11, 6.5], [1, 6, 10], [1, 2, 14.5], [1, 6, 2.5], [1, 7, 6], [1, 12, 15], [1, 10, 10.5], [1, 17, 14], [1, 22, 14], [1, 17, 6], [1, 22, 2],
];
export const CIV_SPOTS = [
  [0, 7.5, 15], [0, 22, 15], [0, 21.5, 7], [0, 8, 7], [0, 14, 3], [1, 7.5, 14.5], [1, 1, 3.2], [1, 8, 5], [1, 16.5, 9.5], [1, 23, 7], [1, 14, 10],
];
// [floor, x, z, surfaceHeight]
export const BOMB_SPOTS = [
  [0, 19.5, 12.25, 0.78], [0, 19.5, 3.95, 0.92], [0, 4, 3.75, 0.76], [1, 7, 15.4, 0.85], [1, 17, 0.6, 0.76], [0, 14.1, 0.75, 0.9], [1, 4, 6.25, 0.76],
];

export const NX = (YARD.x1 - YARD.x0) / U, NZ = (YARD.z1 - YARD.z0) / U;
const inStair = (x, z) => x > STAIR.x0 && x < STAIR.x1 && z > STAIR.z0 && z < STAIR.z1;
const stairT = z => (STAIR.z1 - z) / (STAIR.z1 - STAIR.z0);
const inFoot = (x, z) => x >= FOOT.x0 && x <= FOOT.x1 && z >= FOOT.z0 && z <= FOOT.z1;
export { inStair, inFoot };

// Height of the walking surface under (x,z) for something currently at feet height prevY.
export function groundY(x, z, prevY) {
  if (inStair(x, z)) return Math.min(1, stairT(z) / 0.85) * H;
  return prevY > H / 2 && inFoot(x, z) ? H : 0;
}
export function layerOf(x, z, y) { return inStair(x, z) ? (stairT(z) > 0.85 ? 1 : 0) : (y > H / 2 ? 1 : 0); }

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
  const boxes = [], doors = [], openEnds = new Set();
  for (const [f, x0, z0, x1, z1, kind] of OPENINGS) {
    if (z0 === z1) for (let i = x0 / U; i < x1 / U; i++) edges.delete(k(f, i, z0 / U, 'h'));
    else for (let j = z0 / U; j < z1 / U; j++) edges.delete(k(f, x0 / U, j, 'v'));
    const hz = z0 === z1;
    openEnds.add(f + '|' + x0 + '|' + z0); openEnds.add(f + '|' + x1 + '|' + z1);
    if (kind !== 'gap') boxes.push({ f, kind: 'lintel', x0: hz ? x0 : x0 - T / 2, x1: hz ? x1 : x0 + T / 2, z0: hz ? z0 - T / 2 : z0, z1: hz ? z0 + T / 2 : z1, y0: f * H + DOOR_H, y1: f * H + H });
    if (kind === 'door') {
      const d = 0.04;
      doors.push({ id: doors.length, f, x0, z0, x1, z1, horiz: hz, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, y: f * H, exterior: z0 === 16 || (z0 === 0 && z1 === 0),
        box: { kind: 'door', x0: hz ? x0 : x0 - d, x1: hz ? x1 : x0 + d, z0: hz ? z0 - d : z0, z1: hz ? z0 + d : z1, y0: f * H, y1: f * H + DOOR_H } });
    }
  }
  // merge unit edges into wall runs
  const runs = new Map();
  for (const e of edges) { const [f, i, j, o] = e.split('|'); const key = f + '|' + o + '|' + (o === 'h' ? j : i); (runs.get(key) || runs.set(key, []).get(key)).push(+(o === 'h' ? i : j)); }
  for (const [key, arr] of runs) {
    const [f, o, c] = key.split('|'); const fl = +f, line = +c * U; arr.sort((a, b) => a - b);
    let a = arr[0], p = arr[0];
    const flush = () => {
      let s = a * U, e = (p + 1) * U;
      const pt = v => o === 'h' ? fl + '|' + v + '|' + line : fl + '|' + line + '|' + v;
      if (!openEnds.has(pt(s))) s -= T / 2; if (!openEnds.has(pt(e))) e += T / 2;
      const ext = o === 'h' ? (line === FOOT.z0 || line === FOOT.z1) : (line === FOOT.x0 || line === FOOT.x1);
      boxes.push(o === 'h' ? { f: fl, kind: 'wall', ext, x0: s, x1: e, z0: line - T / 2, z1: line + T / 2, y0: fl * H, y1: fl * H + H }
        : { f: fl, kind: 'wall', ext, x0: line - T / 2, x1: line + T / 2, z0: s, z1: e, y0: fl * H, y1: fl * H + H });
    };
    for (let n = 1; n < arr.length; n++) { if (arr[n] !== p + 1) { flush(); a = arr[n]; } p = arr[n]; }
    flush();
  }
  for (const [f, x0, z0, x1, z1, h, kind] of FURNITURE) boxes.push({ f, kind: 'furn', sub: kind, x0, x1, z0, z1, y0: f * H, y1: f * H + h });
  const level = { boxes, doors, walk: null };
  // nav grid, two layers
  const walk = new Uint8Array(2 * NX * NZ);
  for (let l = 0; l < 2; l++) for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = YARD.x0 + (i + 0.5) * U, z = YARD.z0 + (j + 0.5) * U;
    let ok, y = l * H;
    if (inStair(x, z)) { ok = (stairT(z) > 0.85 ? 1 : 0) === l; y = groundY(x, z, 0); }
    else ok = l === 0 ? true : inFoot(x, z);
    if (ok && circleHits(level, null, x, z, 0.22, y)) ok = false;
    walk[l * NX * NZ + j * NX + i] = ok ? 1 : 0;
  }
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
export function rayStatic(level, doorOpen, ox, oy, oz, dx, dy, dz, max) {
  let best = max;
  for (const b of level.boxes) { const t = rayBox(b, ox, oy, oz, dx, dy, dz, best); if (t >= 0 && t < best) best = t; }
  if (doorOpen) for (const d of level.doors) if (!doorOpen[d.id]) { const t = rayBox(d.box, ox, oy, oz, dx, dy, dz, best); if (t >= 0 && t < best) best = t; }
  if (Math.abs(dy) > 1e-9) for (const py of [0, H, 2 * H]) {
    const t = (py - oy) / dy; if (t <= 1e-6 || t >= best) continue;
    const x = ox + dx * t, z = oz + dz * t;
    if (py === 0 || (inFoot(x, z) && !(py === H && inStair(x, z)))) best = t;
  }
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
    for (const ll of [l, 1 - l]) { const id = ll * NX * NZ + j * NX + i; if (!level.walk[id]) continue; const d = di * di + dj * dj + (ll === l ? 0 : 100); if (d < bd) { bd = d; best = id; } }
  }
  return best;
}
// A* over the two-layer grid. Doors are treated as passable. Returns [[x,z,layer],...] or null.
export function findPath(level, sx, sz, sy, tx, tz, ty) {
  const N = NX * NZ, start = nearestWalk(level, sx, sz, layerOf(sx, sz, sy)), goal = nearestWalk(level, tx, tz, layerOf(tx, tz, ty));
  if (start < 0 || goal < 0) return null;
  const g = new Float32Array(2 * N).fill(Infinity), from = new Int32Array(2 * N).fill(-1), closed = new Uint8Array(2 * N);
  const gi = goal % N % NX, gj = (goal % N - gi) / NX, gl = goal >= N ? 1 : 0;
  const hcost = id => { const c = id % N, i = c % NX, j = (c - i) / NX, dx = Math.abs(i - gi), dz = Math.abs(j - gj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz) + ((id >= N ? 1 : 0) !== gl ? 4 : 0); };
  const heap = [], hf = [];
  const pushH = (id, f) => { let n = heap.length; heap.push(id); hf.push(f); while (n > 0) { const p = (n - 1) >> 1; if (hf[p] <= hf[n]) break; [heap[p], heap[n]] = [heap[n], heap[p]]; [hf[p], hf[n]] = [hf[n], hf[p]]; n = p; } };
  const popH = () => { const top = heap[0], lid = heap.pop(), lf = hf.pop(); if (heap.length) { heap[0] = lid; hf[0] = lf; let n = 0; for (;;) { let m = n; const a = 2 * n + 1, b = a + 1; if (a < heap.length && hf[a] < hf[m]) m = a; if (b < heap.length && hf[b] < hf[m]) m = b; if (m === n) break; [heap[m], heap[n]] = [heap[n], heap[m]]; [hf[m], hf[n]] = [hf[n], hf[m]]; n = m; } } return top; };
  g[start] = 0; pushH(start, hcost(start));
  while (heap.length) {
    const cur = popH(); if (closed[cur]) continue; closed[cur] = 1;
    if (cur === goal) break;
    const l = cur >= N ? 1 : 0, c = cur % N, i = c % NX, j = (c - i) / NX; const [cx, cz] = cellXZ(i, j), cs = inStair(cx, cz);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const i2 = i + di, j2 = j + dj; if (i2 < 0 || j2 < 0 || i2 >= NX || j2 >= NZ) continue;
      const [x2, z2] = cellXZ(i2, j2), ns = inStair(x2, z2), diag = di && dj;
      let nid = l * N + j2 * NX + i2;
      if (!level.walk[nid]) { if (cs && ns && !diag && level.walk[(1 - l) * N + j2 * NX + i2]) nid = (1 - l) * N + j2 * NX + i2; else continue; }
      if (diag && (cs || ns || !level.walk[l * N + j * NX + i2] || !level.walk[l * N + j2 * NX + i])) continue;
      const ng = g[cur] + (diag ? 1.414 : 1);
      if (ng < g[nid]) { g[nid] = ng; from[nid] = cur; pushH(nid, ng + hcost(nid)); }
    }
  }
  if (from[goal] < 0 && goal !== start) return null;
  const out = []; for (let id = goal; id >= 0; id = from[id]) { const c = id % N, i = c % NX, j = (c - i) / NX; const [x, z] = cellXZ(i, j); out.push([x, z, id >= N ? 1 : 0]); if (id === start) break; }
  return out.reverse();
}
