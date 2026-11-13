// BREACHLINE level engine: builds walls, doors, collision, bullet rays and navigation from a map definition (core/maps/*).
// Pure logic (no DOM, no three). Runs in the Durable Object and in the browser.
import mansion from './maps/mansion.js';
import terminal from './maps/terminal.js';
import training from './maps/training.js';
import grandprix from './maps/grandprix.js';
import airport from './maps/airport.js';
export const MAPS = { training, mansion, terminal, grandprix, airport };
export const MAP_IDS = Object.keys(MAPS);
export const MISSION_IDS = MAP_IDS.filter(k => !MAPS[k].training);
export const U = 0.5, T = 0.2;
const GRID = 4;   // spatial index bucket size (m)

const cache = new Map();
export function buildLevel(id = 'mansion') {
  if (!MAPS[id]) id = 'mansion';
  if (cache.has(id)) return cache.get(id);
  const map = MAPS[id], H = map.H, DOOR_H = map.DOOR_H, YARD = map.YARD, NX = Math.round((YARD.x1 - YARD.x0) / U), NZ = Math.round((YARD.z1 - YARD.z0) / U), LAYERS = map.layers;
  const level = { id, map, H, YARD, NX, NZ, layers: LAYERS, boxes: [], doors: [], walk: null, cy: null };

  // ---- walls from room plans: every unit edge of every room is a wall unless an opening or glass takes it ----
  const edges = new Set(), k = (f, i, j, o) => f + '|' + i + '|' + j + '|' + o, rooms = map.rooms || [];
  for (const [f, , x0, z0, x1, z1] of rooms) {
    const i0 = Math.round(x0 / U), i1 = Math.round(x1 / U), j0 = Math.round(z0 / U), j1 = Math.round(z1 / U);
    for (let i = i0; i < i1; i++) { edges.add(k(f, i, j0, 'h')); edges.add(k(f, i, j1, 'h')); }
    for (let j = j0; j < j1; j++) { edges.add(k(f, i0, j, 'v')); edges.add(k(f, i1, j, 'v')); }
  }
  const roomAt = map.indoor || ((f, x, z) => rooms.some(r => r[0] === f && x > r[2] && x < r[4] && z > r[3] && z < r[5]));
  // which side of a wall line is outdoors: 'z'/'x' = the negative side, 'Z'/'X' = the positive side, '' = indoors both sides
  const outSide = (f, o, line, u) => { const a = o === 'h' ? roomAt(f, u, line + 0.05) : roomAt(f, line + 0.05, u), b = o === 'h' ? roomAt(f, u, line - 0.05) : roomAt(f, line - 0.05, u); return a && !b ? (o === 'h' ? 'z' : 'x') : b && !a ? (o === 'h' ? 'Z' : 'X') : ''; };
  const boxes = level.boxes, doors = level.doors, openEnds = new Set(), gedges = new Set();
  for (const [f, x0, z0, x1, z1] of map.glass || []) {
    openEnds.add(f + '|' + x0 + '|' + z0); openEnds.add(f + '|' + x1 + '|' + z1);
    if (z0 === z1) for (let i = Math.round(x0 / U); i < Math.round(x1 / U); i++) { if (edges.delete(k(f, i, Math.round(z0 / U), 'h'))) gedges.add(k(f, i, Math.round(z0 / U), 'h')); }
    else for (let j = Math.round(z0 / U); j < Math.round(z1 / U); j++) { if (edges.delete(k(f, Math.round(x0 / U), j, 'v'))) gedges.add(k(f, Math.round(x0 / U), j, 'v')); }
  }
  const addDoor = (d) => { d.id = doors.length; doors.push(d); return d; };
  for (const [f, x0, z0, x1, z1, kind, tag] of map.openings || []) {
    if (z0 === z1) for (let i = Math.round(x0 / U); i < Math.round(x1 / U); i++) edges.delete(k(f, i, Math.round(z0 / U), 'h'));
    else for (let j = Math.round(z0 / U); j < Math.round(z1 / U); j++) edges.delete(k(f, Math.round(x0 / U), j, 'v'));
    const hz = z0 === z1, out = outSide(f, hz ? 'h' : 'v', hz ? z0 : x0, hz ? (x0 + x1) / 2 : (z0 + z1) / 2);
    openEnds.add(f + '|' + x0 + '|' + z0); openEnds.add(f + '|' + x1 + '|' + z1);
    if (kind !== 'gap') boxes.push({ f, kind: 'lintel', out, x0: hz ? x0 : x0 - T / 2, x1: hz ? x1 : x0 + T / 2, z0: hz ? z0 - T / 2 : z0, z1: hz ? z0 + T / 2 : z1, y0: f * H + DOOR_H, y1: f * H + H });
    if (kind === 'door') {
      const d = 0.04;
      addDoor({ f, x0, z0, x1, z1, horiz: hz, h: DOOR_H, hidden: tag === 'hidden', cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, y: f * H, exterior: !!tag,
        box: { kind: 'door', x0: hz ? x0 : x0 - d, x1: hz ? x1 : x0 + d, z0: hz ? z0 - d : z0, z1: hz ? z0 + d : z1, y0: f * H, y1: f * H + DOOR_H } });
    }
  }
  const merge = (set, kind, th) => {
    const runs = new Map();
    for (const e of set) { const [f, i, j, o] = e.split('|'); const key = f + '|' + o + '|' + (o === 'h' ? j : i); (runs.get(key) || runs.set(key, []).get(key)).push(+(o === 'h' ? i : j)); }
    for (const [key, arr] of runs) {
      const [f, o, c] = key.split('|'); const fl = +f, line = +c * U; arr.sort((a, b) => a - b);
      let a = arr[0], p = arr[0];
      const flush = () => {
        let s = a * U, e = (p + 1) * U, capA = true, capB = true;
        // An end that runs into a crossing wall is buried in it (no end face, so nothing is coplanar). At a doorway, a free end or a glass line it gets a visible end face.
        const crossing = (set, n) => o === 'h' ? set.has(k(fl, n, +c, 'v')) || set.has(k(fl, n, +c - 1, 'v')) : set.has(k(fl, +c, n, 'h')) || set.has(k(fl, +c - 1, n, 'h'));
        if (kind === 'wall') {
          if (crossing(edges, a)) { s -= T / 2; capA = false; } else if (crossing(gedges, a)) s -= 0.04;
          if (crossing(edges, p + 1)) { e += T / 2; capB = false; } else if (crossing(gedges, p + 1)) e += 0.04;
        }
        const out = outSide(fl, o, line, (a + 0.5) * U), ext = !!out;
        boxes.push(o === 'h' ? { f: fl, kind, ext, out, capA, capB, horiz: true, x0: s, x1: e, z0: line - th / 2, z1: line + th / 2, y0: fl * H, y1: fl * H + H }
          : { f: fl, kind, ext, out, capA, capB, horiz: false, x0: line - th / 2, x1: line + th / 2, z0: s, z1: e, y0: fl * H, y1: fl * H + H });
      };
      for (let n = 1; n < arr.length; n++) { if (arr[n] !== p + 1) { flush(); a = arr[n]; } p = arr[n]; }
      flush();
    }
  };
  merge(edges, 'wall', T); merge(gedges, 'glass', 0.06);
  for (const [f, x0, z0, x1, z1, h, kind, face] of map.furniture || []) boxes.push({ f, kind: 'furn', sub: kind, face, x0, x1, z0, z1, y0: f * H, y1: f * H + h });
  const veg = map.veg;
  if (veg) {
    for (const [x, z] of veg.trees) { const y = map.terrainY(z, x); boxes.push({ f: y < -H / 2 ? -1 : 0, kind: 'trunk', x0: x - 0.17, x1: x + 0.17, z0: z - 0.17, z1: z + 0.17, y0: y, y1: y + 3.2 }); }
    for (const [f, x, z] of veg.pots) boxes.push({ f, kind: 'furn', sub: 'pot', x0: x - 0.22, x1: x + 0.22, z0: z - 0.22, z1: z + 0.22, y0: f * H, y1: f * H + 0.5 });
  }
  // map-specific solids (containers, hull, cranes, slabs) and extra doors (container doors)
  if (map.extra) map.extra({ boxes, addDoor, H });

  // ---- spatial index: boxes bucketed on a coarse xz grid ----
  const G = level.grid = { cs: GRID, x0: YARD.x0 - GRID, z0: YARD.z0 - GRID, nx: Math.ceil((YARD.x1 - YARD.x0) / GRID) + 2, nz: Math.ceil((YARD.z1 - YARD.z0) / GRID) + 2, cells: null, mark: new Uint32Array(boxes.length), stamp: 0 };
  G.cells = Array.from({ length: G.nx * G.nz }, () => []);
  const cl = (v, n) => Math.max(0, Math.min(n - 1, v));
  boxes.forEach((b, bi) => {
    const i0 = cl(Math.floor((b.x0 - G.x0) / GRID), G.nx), i1 = cl(Math.floor((b.x1 - G.x0) / GRID), G.nx), j0 = cl(Math.floor((b.z0 - G.z0) / GRID), G.nz), j1 = cl(Math.floor((b.z1 - G.z0) / GRID), G.nz);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) G.cells[j * G.nx + i].push(bi);
  });

  // ---- surfaces and heights ----
  const surf = map.surfaces;
  level.surfaces = surf;
  level.cellY = (li, x, z) => { for (const s of surf(x, z)) if (s[1] === li) return s[0]; return NaN; };
  // the walking height under (x, z) for something whose feet are at prevY: the highest surface it can step onto
  level.groundY = (x, z, prevY) => { const ss = surf(x, z); let best = -Infinity, low = Infinity; for (const [h] of ss) { if (h <= prevY + 0.6 && h > best) best = h; if (h < low) low = h; } return best > -Infinity ? best : low < Infinity ? low : prevY; };   // nowhere to stand (open water): stay level
  level.layerOf = (x, z, y) => { let best = 0, bd = Infinity; for (const [h, li] of surf(x, z)) { const d = Math.abs(h - y); if (d < bd) { bd = d; best = li; } } return best; };
  level.onStairs = map.onStairs || (() => false);
  level.inside = map.inside; level.objective = map.objective; level.floorAt = map.floorAt; level.roofY = map.roofY;
  level.terrainY = map.terrainY;
  // what rain lands on (roof, stack top, ground): sampled once on a 1 m grid because the client asks thousands of times a frame
  let roof = null; const RX = Math.ceil(YARD.x1 - YARD.x0), RZ = Math.ceil(YARD.z1 - YARD.z0);
  level.roofAt = (x, z) => { const i = Math.floor(x - YARD.x0), j = Math.floor(z - YARD.z0); if (i < 0 || j < 0 || i >= RX || j >= RZ) return map.roofY(x, z);
    if (!roof) { roof = new Float32Array(RX * RZ); for (let b = 0; b < RZ; b++) for (let a = 0; a < RX; a++) roof[b * RX + a] = map.roofY(YARD.x0 + a + 0.5, YARD.z0 + b + 0.5); } return roof[j * RX + i]; };

  // ---- navigation grid: one walkability layer per storey ----
  const N = NX * NZ, walk = new Uint8Array(LAYERS * N), cy = new Float32Array(LAYERS * N).fill(NaN);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = YARD.x0 + (i + 0.5) * U, z = YARD.z0 + (j + 0.5) * U;
    for (const [y, li] of surf(x, z)) { const id = li * N + j * NX + i; cy[id] = y; walk[id] = !circleHits(level, null, x, z, 0.235, y) ? 1 : 0; }
  }
  level.cy = cy; level.walk = walk;
  level.pf = { g: new Float32Array(LAYERS * N), from: new Int32Array(LAYERS * N), seen: new Uint32Array(LAYERS * N), closed: new Uint32Array(LAYERS * N), gen: 0 };
  cache.set(id, level);
  return level;
}

const blocksAt = (b, feetY) => b.y0 < feetY + 1.2 && b.y1 > feetY + 0.25;
// visit each box whose bucket overlaps the xz rectangle once
function eachNear(level, x0, z0, x1, z1, fn) {
  const G = level.grid, stamp = ++G.stamp, cs = G.cs;
  const i0 = Math.max(0, Math.floor((x0 - G.x0) / cs)), i1 = Math.min(G.nx - 1, Math.floor((x1 - G.x0) / cs)), j0 = Math.max(0, Math.floor((z0 - G.z0) / cs)), j1 = Math.min(G.nz - 1, Math.floor((z1 - G.z0) / cs));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const bi of G.cells[j * G.nx + i]) { if (G.mark[bi] === stamp) continue; G.mark[bi] = stamp; if (fn(level.boxes[bi]) === true) return true; }
  return false;
}
// doorOpen: array of booleans (closed doors block) or null to ignore doors
export function circleHits(level, doorOpen, x, z, r, feetY) {
  const hit = b => { if (!blocksAt(b, feetY) || x <= b.x0 - r || x >= b.x1 + r || z <= b.z0 - r || z >= b.z1 + r) return false; const dx = x - Math.max(b.x0, Math.min(x, b.x1)), dz = z - Math.max(b.z0, Math.min(z, b.z1)); return dx * dx + dz * dz < r * r; };
  if (eachNear(level, x - r, z - r, x + r, z + r, hit)) return true;
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
    eachNear(level, x - r - 0.5, z - r - 0.5, x + r + 0.5, z + r + 0.5, push);
    if (doorOpen) for (const d of level.doors) if (!doorOpen[d.id]) push(d.box);
  }
  const Y = level.YARD;
  x = Math.max(Y.x0 + 0.4, Math.min(Y.x1 - 0.4, x)); z = Math.max(Y.z0 + 0.4, Math.min(Y.z1 - 0.4, z));
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
// Walks the spatial index cell by cell along the ray (2D DDA) and stops once the next cell starts beyond the nearest hit.
export function rayStatic(level, doorOpen, ox, oy, oz, dx, dy, dz, max, solidGlass = false) {
  let best = max; const G = level.grid, stamp = ++G.stamp, cs = G.cs, boxes = level.boxes;
  let ci = Math.floor((ox - G.x0) / cs), cj = Math.floor((oz - G.z0) / cs);
  const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1, ax = Math.abs(dx), az = Math.abs(dz);
  const tdx = ax > 1e-12 ? cs / ax : Infinity, tdz = az > 1e-12 ? cs / az : Infinity;
  let tmx = ax > 1e-12 ? (dx > 0 ? (G.x0 + (ci + 1) * cs - ox) : (ox - (G.x0 + ci * cs))) / ax : Infinity;
  let tmz = az > 1e-12 ? (dz > 0 ? (G.z0 + (cj + 1) * cs - oz) : (oz - (G.z0 + cj * cs))) / az : Infinity;
  for (let guard = 0, t = 0; guard < G.nx + G.nz + 4 && t <= best; guard++) {
    if (ci >= 0 && cj >= 0 && ci < G.nx && cj < G.nz) for (const bi of G.cells[cj * G.nx + ci]) {
      if (G.mark[bi] === stamp) continue; G.mark[bi] = stamp; const b = boxes[bi];
      if ((b.kind === 'glass' && !solidGlass) || b.kind === 'fence') continue; const h = rayBox(b, ox, oy, oz, dx, dy, dz, best); if (h >= 0 && h < best) best = h;
    } else if ((ci < 0 && sx < 0) || (cj < 0 && sz < 0) || (ci >= G.nx && sx > 0) || (cj >= G.nz && sz > 0)) break;
    if (tmx < tmz) { t = tmx; tmx += tdx; ci += sx; } else { t = tmz; tmz += tdz; cj += sz; }
  }
  if (doorOpen) for (const d of level.doors) if (!doorOpen[d.id]) { const h = rayBox(d.box, ox, oy, oz, dx, dy, dz, best); if (h >= 0 && h < best) best = h; }
  return level.map.floorRay(ox, oy, oz, dx, dy, dz, best);
}
// Is this point inside something solid (wall, glass, furniture, closed door, floor slab, ground)? Used for thrown objects.
export function solidAt(level, doorOpen, x, y, z) {
  if (eachNear(level, x, z, x, z, b => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1 && z > b.z0 && z < b.z1)) return true;
  if (doorOpen) for (const d of level.doors) if (!doorOpen[d.id]) { const b = d.box; if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1 && z > b.z0 && z < b.z1) return true; }
  return level.map.solidFloor(x, y, z);
}
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const mx = ox - cx, my = oy - cy, mz = oz - cz, b = mx * dx + my * dy + mz * dz, c = mx * mx + my * my + mz * mz - r * r;
  if (c > 0 && b > 0) return -1; const disc = b * b - c; if (disc < 0) return -1;
  return Math.max(0, -b - Math.sqrt(disc));
}

function nearestWalk(level, x, z, l) {
  const { NX, NZ, YARD, layers } = level, N = NX * NZ, ci = Math.floor((x - YARD.x0) / U), cj = Math.floor((z - YARD.z0) / U); let best = -1, bd = 1e9;
  for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
    const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= NX || j >= NZ) continue;
    for (let ll = 0; ll < layers; ll++) { const id = ll * N + j * NX + i; if (!level.walk[id]) continue; const d = di * di + dj * dj + Math.abs(ll - l) * 100; if (d < bd) { bd = d; best = id; } }
  }
  return best;
}
// Can something walk the straight line a -> b ([x, z, floor])? Only on one floor and off the stairs.
function clearWalk(level, a, b) {
  if (a[2] !== b[2] || level.onStairs(a[0], a[1]) || level.onStairs(b[0], b[1])) return false;
  const li = level.map.layerFloor.indexOf(a[2]), dx = b[0] - a[0], dz = b[1] - a[1], n = Math.ceil(Math.hypot(dx, dz) / 0.15);
  let y0 = level.cellY(li, a[0], a[1]);
  for (let i = 1; i < n; i++) { const x = a[0] + dx * i / n, z = a[1] + dz * i / n, y = level.cellY(li, x, z); if (Number.isNaN(y) || Math.abs(y - y0) > 0.3 || level.onStairs(x, z) || circleHits(level, null, x, z, 0.25, y)) return false; y0 = y; }
  return true;
}
// Drop the grid's zig-zag: keep only the corners a walker actually has to turn at.
function smoothPath(level, p) {
  if (p.length < 3) return p; const out = [p[0]]; let i = 0;
  while (i < p.length - 1) { let j = Math.min(p.length - 1, i + 14); while (j > i + 1 && !clearWalk(level, p[i], p[j])) j--; out.push(p[j]); i = j; }
  return out;
}
// A* over the layered grid. Doors are treated as passable. Returns [[x, z, floor], ...] or null. Gives up after maxNodes expansions.
export function findPath(level, sx, sz, sy, tx, tz, ty, raw = false, maxNodes = 150000) {
  const { NX, NZ, YARD, layers } = level, N = NX * NZ, start = nearestWalk(level, sx, sz, level.layerOf(sx, sz, sy)), goal = nearestWalk(level, tx, tz, level.layerOf(tx, tz, ty));
  if (start < 0 || goal < 0) return null;
  const P = level.pf, gen = ++P.gen, g = P.g, from = P.from, seen = P.seen, closed = P.closed, W = level.walk, CY = level.cy, LF = level.map.layerFloor;
  const gc = goal % N, gi = gc % NX, gj = (gc - gi) / NX, gl = (goal - gc) / N;
  const hcost = id => { const c = id % N, i = c % NX, j = (c - i) / NX, dx = Math.abs(i - gi), dz = Math.abs(j - gj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz) + Math.abs((id - c) / N - gl) * 4; };
  const heap = [], hf = [];
  const pushH = (id, f) => { let n = heap.length; heap.push(id); hf.push(f); while (n > 0) { const p = (n - 1) >> 1; if (hf[p] <= hf[n]) break; [heap[p], heap[n]] = [heap[n], heap[p]]; [hf[p], hf[n]] = [hf[n], hf[p]]; n = p; } };
  const popH = () => { const top = heap[0], lid = heap.pop(), lf = hf.pop(); if (heap.length) { heap[0] = lid; hf[0] = lf; let n = 0; for (;;) { let m = n; const a = 2 * n + 1, b = a + 1; if (a < heap.length && hf[a] < hf[m]) m = a; if (b < heap.length && hf[b] < hf[m]) m = b; if (m === n) break; [heap[m], heap[n]] = [heap[n], heap[m]]; [hf[m], hf[n]] = [hf[n], hf[m]]; n = m; } } return top; };
  g[start] = 0; seen[start] = gen; from[start] = -1; pushH(start, hcost(start)); let found = start === goal, count = 0;
  while (heap.length && !found) {
    const cur = popH(); if (closed[cur] === gen) continue; closed[cur] = gen;
    if (cur === goal) { found = true; break; }
    if (++count > maxNodes) break;
    const c = cur % N, l = (cur - c) / N, i = c % NX, j = (c - i) / NX, y = CY[cur];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const i2 = i + di, j2 = j + dj; if (i2 < 0 || j2 < 0 || i2 >= NX || j2 >= NZ) continue;
      const c2 = j2 * NX + i2, diag = di && dj; let nid = -1;
      if (diag) { if (W[l * N + c2] && Math.abs(CY[l * N + c2] - y) < 0.3 && W[l * N + j * NX + i2] && W[l * N + j2 * NX + i]) nid = l * N + c2; }
      else for (const l2 of [l, l + 1, l - 1]) { if (l2 < 0 || l2 >= layers) continue; const id = l2 * N + c2; if (W[id] && Math.abs(CY[id] - y) < 0.6) { nid = id; break; } }   // steps and slopes join layers where heights meet
      if (nid < 0 || closed[nid] === gen) continue;
      const ng = g[cur] + (diag ? 1.414 : 1);
      if (seen[nid] !== gen || ng < g[nid]) { g[nid] = ng; seen[nid] = gen; from[nid] = cur; pushH(nid, ng + hcost(nid)); }
    }
  }
  if (!found) return null;
  const out = []; for (let id = goal; id >= 0; id = from[id]) { const c = id % N, i = c % NX, j = (c - i) / NX; out.push([YARD.x0 + (i + 0.5) * U, YARD.z0 + (j + 0.5) * U, LF[(id - c) / N]]); if (id === start) break; }
  out.reverse(); return raw ? out : smoothPath(level, out);
}

// ---- compatibility: the mansion's constants and height rules under their old names (tests and older call sites) ----
export { H, DOOR_H, FOOT, YARD, STAIR, BREAKER, CAR, SPAWN, ROOMS, FURNITURE, SUSPECT_SPOTS, CIV_SPOTS, BOMB_SPOTS, VEG, EXIT, terrainY, floorAt, inStair, inFoot } from './maps/mansion.js';
const M0 = () => buildLevel('mansion');
export const groundY = (x, z, y) => M0().groundY(x, z, y);
export const layerOf = (x, z, y) => M0().layerOf(x, z, y);
export const NX = Math.round((mansion.YARD.x1 - mansion.YARD.x0) / U), NZ = Math.round((mansion.YARD.z1 - mansion.YARD.z0) / U);
