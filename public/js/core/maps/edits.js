// The map-editing rules, shared by the 2D level editor (editor.js) and the VR editor (vredit.js): what each tool does to a map
// document (the JSON format in custom.js), with no screen or input code. A placement returns { err } (a message for the builder)
// or { apply } (a function that makes the change; the caller runs it inside its own undo step), sometimes with { sel } (what to
// select afterwards). Coordinates are metres on the map, F is the floor being edited.
import { FURN, FURN_H, STAIR_W, STAIR_L, LIMITS, TREES, SHRUBS, PWALLS, terDims, relax } from './custom.js';

export const snap = v => Math.round(v * 2) / 2;
export const FURN_SIZE = { table: [1.6, 0.9], counter: [2, 0.6], shelf: [1.6, 0.4], cabinet: [1, 0.5], sofa: [2, 0.9], bed: [1.6, 2.1], crate: [1, 1], console: [1.6, 0.6], seats: [2, 0.6], column: [0.6, 0.6], wall: [2, 0.2], hedge: [2, 0.6] };
export const LISTS = ['rooms', 'openings', 'glass', 'furniture', 'stairs', 's', 'c', 'b', 'trees', 'shrubs', 'pwalls', 'gates'];
export const blank = creator => ({ v: 1, name: 'My map', creator: creator || 'Anon', size: [60, 50], floors: 1, H: 3.2, time: 600, counts: { s: 6, c: 3, b: 1 }, style: { preset: 'house', night: false }, rooms: [], openings: [], glass: [], furniture: [], stairs: [], spawn: null, exit: null, breaker: null, hvt: null, s: [], c: [], b: [], trees: [], shrubs: [], pwalls: [], gates: [], ter: null });
// a working copy of a map: every list present and copied, the ground the right size or none
export function normalize(m, creator) {
  const M = Object.assign(blank(creator), m); for (const k of LISTS) M[k] = (M[k] || []).map(a => a.slice());
  M.ter = Array.isArray(M.ter) && M.ter.length === terDims(...M.size).reduce((a, b) => a * b) ? M.ter.slice() : null;
  M.style = Object.assign({ preset: 'house' }, M.style); M.counts = Object.assign({ s: 6, c: 3, b: 1 }, M.counts); return M;
}

// ---- geometry ----
export const roomsOn = (M, f) => M.rooms.filter(r => r[0] === f);
export const inRoom = (M, f, x, z) => M.rooms.some(r => r[0] === f && x > r[1] && x < r[3] && z > r[2] && z < r[4]);
export function sides(M, f) { const out = []; for (const [, x0, z0, x1, z1] of roomsOn(M, f)) out.push([x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]); return out; }
export function nearestSide(M, f, x, z, max = 0.8) {
  let best = null, bd = max;
  for (const s of sides(M, f)) { const h = s[1] === s[3], d = h ? (x >= s[0] - 0.2 && x <= s[2] + 0.2 ? Math.abs(z - s[1]) : 1e9) : (z >= s[1] - 0.2 && z <= s[3] + 0.2 ? Math.abs(x - s[0]) : 1e9); if (d < bd) { bd = d; best = { s, h }; } }
  return best;
}
export const segDist = (px, pz, x0, z0, x1, z1) => { const dx = x1 - x0, dz = z1 - z0, l = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / l)); return Math.hypot(px - x0 - dx * t, pz - z0 - dz * t); };
const segOverlap = (o, h, line_, lo, hi) => h ? o[2] === o[4] && o[2] === line_ && o[1] < hi && o[3] > lo : o[1] === o[3] && o[1] === line_ && o[2] < hi && o[4] > lo;

// ---- picking, removing, moving ----
export function itemAt(M, F, x, z) {
  const r = 0.6;
  for (const k of ['s', 'c', 'b']) { const i = M[k].findIndex(p => p[0] === F && Math.hypot(p[1] - x, p[2] - z) < r); if (i >= 0) return { t: k, i }; }
  if (M.hvt && M.hvt[0] === F && Math.hypot(M.hvt[1] - x, M.hvt[2] - z) < r) return { t: 'hvt' };
  if (M.breaker && M.breaker[0] === F && Math.hypot(M.breaker[1] - x, M.breaker[2] - z) < r) return { t: 'breaker' };
  if (F === 0 && M.spawn && Math.hypot(M.spawn[0] - x, M.spawn[1] - z) < 1.2) return { t: 'spawn' };
  for (const k of ['openings', 'glass']) { const i = M[k].findIndex(o => o[0] === F && segDist(x, z, o[1], o[2], o[3], o[4]) < 0.35); if (i >= 0) return { t: k, i }; }
  let i = M.furniture.findIndex(q => q[0] === F && x >= q[1] && x <= q[3] && z >= q[2] && z <= q[4]); if (i >= 0) return { t: 'furniture', i };
  i = M.stairs.findIndex(q => (q[0] === F || q[0] === F - 1) && x >= q[1] && x <= q[3] && z >= q[2] && z <= q[4]); if (i >= 0) return { t: 'stairs', i };
  i = M.gates.findIndex(q => segDist(x, z, q[0], q[1], q[2], q[3]) < 0.4); if (i >= 0) return { t: 'gates', i };
  i = M.pwalls.findIndex(q => segDist(x, z, q[0], q[1], q[2], q[3]) < 0.4); if (i >= 0) return { t: 'pwalls', i };
  i = M.shrubs.findIndex(q => Math.hypot(q[0] - x, q[1] - z) < 0.6); if (i >= 0) return { t: 'shrubs', i };
  i = M.trees.findIndex(q => Math.hypot(q[0] - x, q[1] - z) < 1.0); if (i >= 0) return { t: 'trees', i };
  if (F === 0 && M.exit && x >= M.exit[0] && x <= M.exit[2] && z >= M.exit[1] && z <= M.exit[3]) return { t: 'exit' };
  for (let k = M.rooms.length - 1; k >= 0; k--) { const q = M.rooms[k]; if (q[0] === F && x >= q[1] && x <= q[3] && z >= q[2] && z <= q[4]) return { t: 'rooms', i: k }; }
  return null;
}
export function remove(M, it) { if (!it) return; if (it.i != null) M[it.t].splice(it.i, 1); else M[it.t] = null; }
export function rectOf(M, it) { if (!it) return null; if (it.t === 'rooms' || it.t === 'furniture' || it.t === 'stairs') { const q = M[it.t][it.i]; return [q[1], q[2], q[3], q[4]]; } if (it.t === 'exit') return M.exit.slice(); return null; }
export function moveItem(M, it, dx, dz) {
  const step = it.t === 'furniture' ? 0.25 : 0.5, q = v => Math.round(v / step) * step, ddx = q(dx), ddz = q(dz);
  const a = it.i != null ? M[it.t][it.i] : M[it.t]; if (!a) return;
  if (it.t === 'spawn' || it.t === 'trees' || it.t === 'shrubs') { a[0] += ddx; a[1] += ddz; return; }
  if (it.t === 'pwalls') { a[0] += ddx; a[2] += ddx; a[1] += ddz; a[3] += ddz; return; }
  if (it.t === 'gates') { if (a[1] === a[3]) { a[0] += ddx; a[2] += ddx; } else { a[1] += ddz; a[3] += ddz; } return; }
  if (it.t === 'exit') { a[0] += ddx; a[2] += ddx; a[1] += ddz; a[3] += ddz; return; }
  if (it.t === 's' || it.t === 'c' || it.t === 'b' || it.t === 'hvt' || it.t === 'breaker') { a[1] += ddx; a[2] += ddz; return; }
  if (it.t === 'openings' || it.t === 'glass') { const h = a[2] === a[4]; if (h) { a[1] += ddx; a[3] += ddx; } else { a[2] += ddz; a[4] += ddz; } return; }
  a[1] += ddx; a[3] += ddx; a[2] += ddz; a[4] += ddz;
}
// drag the far corner of a selected room, piece of furniture or the exit
export function resizeItem(M, it, x, z) {
  const q = M[it.t] && M[it.t][it.i], step = it.t === 'furniture' ? 0.25 : 0.5, rs = v => Math.round(v / step) * step;
  if (it.t === 'exit') { M.exit[2] = Math.max(M.exit[0] + 1, rs(x)); M.exit[3] = Math.max(M.exit[1] + 1, rs(z)); } else if (q) { q[3] = Math.max(q[1] + (it.t === 'rooms' ? 1 : 0.25), rs(x)); q[4] = Math.max(q[2] + (it.t === 'rooms' ? 1 : 0.25), rs(z)); }
}
export function rotateFurn(q) { const cx = (q[1] + q[3]) / 2, cz = (q[2] + q[4]) / 2, w = q[3] - q[1], d = q[4] - q[2]; q[1] = cx - d / 2; q[3] = cx + d / 2; q[2] = cz - w / 2; q[4] = cz + w / 2; q[7] = ({ '+z': '-x', '-x': '-z', '-z': '+x', '+x': '+z' })[q[7]] || '+z'; }

// ---- the ground ----
export const TMAXdm = M => Math.round(2 * M.H * 10);
export function ensureTer(M) { if (!M.ter) { const [nx, nz] = terDims(...M.size); M.ter = new Array(nx * nz).fill(0); } return terDims(...M.size); }
export function groundAt(M, x, z) { if (!M.ter) return 0; const [nx, nz] = terDims(...M.size), fx = Math.max(0, Math.min(nx - 1.0001, x)), fz = Math.max(0, Math.min(nz - 1.0001, z)), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, a = j * nx + i, h = M.ter;
  return ((h[a] * (1 - u) + h[a + 1] * u) * (1 - v) + (h[a + nx] * (1 - u) + h[a + nx + 1] * u) * v) / 10; }
// one dab of the brush { mode: raise | lower | smooth | flatten, r: radius m, k: strength, flat: flatten height m } at (x, z);
// the ground the brush holds stays put and the slopes around it give way
export function dab(M, brush, x, z) {
  const [nx, nz] = ensureTer(M), h = M.ter, R = brush.r, lim = TMAXdm(M), pin = new Uint8Array(nx * nz);
  const i0 = Math.max(0, Math.floor(x - R)), i1 = Math.min(nx - 1, Math.ceil(x + R)), j0 = Math.max(0, Math.floor(z - R)), j1 = Math.min(nz - 1, Math.ceil(z + R)), old = h.slice();
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const d = Math.hypot(i - x, j - z); if (d > R) continue; const wgt = Math.pow(1 - d / R, 1.5) || 0.05, a = j * nx + i;
    if (brush.mode === 'raise') h[a] += brush.k * wgt;
    else if (brush.mode === 'lower') h[a] -= brush.k * wgt;
    else if (brush.mode === 'flatten') h[a] += (brush.flat * 10 - h[a]) * Math.min(1, wgt * 1.4);
    else { let sum = 0, n = 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; sum += old[jj * nx + ii]; n++; } h[a] += (sum / n - h[a]) * Math.min(1, wgt * 0.8); }
    h[a] = Math.max(-lim, Math.min(lim, Math.round(h[a]))); if (d < R * 0.6) pin[a] = 1;
  }
  relax(h, nx, nz, undefined, 300, pin); for (let a = 0; a < h.length; a++) h[a] = Math.max(-lim, Math.min(lim, h[a]));
}
export function resampleTer(M, oldSize) {
  if (!M.ter) return; const [ox, oz] = terDims(...oldSize), [nx, nz] = terDims(...M.size), o = M.ter, n = new Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) n[j * nx + i] = o[Math.min(j, oz - 1) * ox + Math.min(i, ox - 1)];
  M.ter = n;
}
export const clampTer = M => { if (M.ter) { const l = TMAXdm(M); M.ter = M.ter.map(v => Math.max(-l, Math.min(l, v))); } };

// ---- landscape ----
export const pickKind = (sel, table) => sel === 'mix' ? Object.keys(table)[Math.floor(Math.random() * Object.keys(table).length)] : sel;
// a tree or shrub (key 'trees' | 'shrubs', kind or 'mix'): true, or why not
export function plant(M, key, x, z, kind) {
  if (M[key].length >= LIMITS[key]) return 'That is the most ' + key + ' a map can have.';
  if (x < 0 || z < 0 || x > M.size[0] || z > M.size[1]) return 'Plants go inside the map.';
  if (inRoom(M, 0, x, z) || M.rooms.some(r => x > r[1] - 0.3 && x < r[3] + 0.3 && z > r[2] - 0.3 && z < r[4] + 0.3)) return 'Plants go outside, clear of the buildings.';   // not inside or against a building
  M[key].push([Math.round(x * 10) / 10, Math.round(z * 10) / 10, pickKind(kind, key === 'trees' ? TREES : SHRUBS)]); return true;
}
export function gate(M, x, z, width) {
  let best = null, bd = 0.8; for (const q of M.pwalls) { const d = segDist(x, z, q[0], q[1], q[2], q[3]); if (d < bd) { bd = d; best = q; } }
  if (!best) return { err: 'Tap on a property wall or fence.' };
  const h = best[1] === best[3], a = h ? best[0] : best[1], b = h ? best[2] : best[3], L = Math.min(width, b - a);
  if (L < 1) return { err: 'That wall is too short for a gate.' };
  const c = Math.max(a + L / 2, Math.min(b - L / 2, snap(h ? x : z))), lo = Math.round((c - L / 2) * 2) / 2, hi = lo + L, ln = h ? best[1] : best[0];
  return { apply: () => { M.gates = M.gates.filter(o => !(h ? o[1] === o[3] && o[1] === ln && o[0] < hi && o[2] > lo : o[0] === o[2] && o[0] === ln && o[1] < hi && o[3] > lo)); M.gates.push(h ? [lo, ln, hi, ln] : [ln, lo, ln, hi]); } };
}
export const pwSeg = (x0, z0, x1, z1) => { const h = Math.abs(x1 - x0) >= Math.abs(z1 - z0); return h ? [snap(x0), snap(z0), snap(x1), snap(z0)] : [snap(x0), snap(z0), snap(x0), snap(z1)]; };
export function pwall(M, x0, z0, x1, z1, kind) {
  const h = Math.abs(x1 - x0) >= Math.abs(z1 - z0), a = snap(h ? Math.min(x0, x1) : Math.min(z0, z1)), b = snap(h ? Math.max(x0, x1) : Math.max(z0, z1)), ln = snap(h ? z0 : x0);
  if (b - a < 0.5) return { err: 'Drag along the line to make the wall longer.' }; if (M.pwalls.length >= LIMITS.pwalls) return { err: 'That is the most property walls a map can have.' };
  return { apply: () => M.pwalls.push(h ? [a, ln, b, ln, PWALLS[kind] ? kind : 'privacy'] : [ln, a, ln, b, PWALLS[kind] ? kind : 'privacy']) };
}

// ---- building ----
export function opening(M, F, x, z, kind) {
  const ns = nearestSide(M, F, x, z); if (!ns) return { err: 'Tap on a wall of a room on this floor.' };
  const L = kind === 'door' ? 1 : kind === 'arch' ? 1.5 : 2, { s, h } = ns, a = h ? s[0] : s[1], b = h ? s[2] : s[3];
  if (b - a < L) return { err: 'That wall is too short for a ' + kind + '.' };
  const c = Math.max(a + L / 2, Math.min(b - L / 2, snap(h ? x : z))), lo = Math.round((c - L / 2) * 2) / 2, hi = lo + L, line_ = h ? s[1] : s[0];
  const ext = h ? !(inRoom(M, F, c, line_ - 0.25) && inRoom(M, F, c, line_ + 0.25)) : !(inRoom(M, F, line_ - 0.25, c) && inRoom(M, F, line_ + 0.25, c));
  return { apply: () => { M.openings = M.openings.filter(o => !(o[0] === F && segOverlap(o, h, line_, lo, hi))); M.glass = M.glass.filter(o => !(o[0] === F && segOverlap(o, h, line_, lo, hi))); M.openings.push(h ? [F, lo, line_, hi, line_, kind, ...(ext ? ['ext'] : [])] : [F, line_, lo, line_, hi, kind, ...(ext ? ['ext'] : [])]); } };
}
export function glass(M, F, x0, z0, x1, z1) {
  const ns = nearestSide(M, F, x0, z0, 1); if (!ns) return { err: 'Start the window on a wall.' };
  const { s, h } = ns, a = h ? s[0] : s[1], b = h ? s[2] : s[3], lo = Math.max(a, snap(Math.min(h ? x0 : z0, h ? x1 : z1))), hi = Math.min(b, snap(Math.max(h ? x0 : z0, h ? x1 : z1))), line_ = h ? s[1] : s[0];
  if (hi - lo < 0.5) return { err: 'Drag along the wall to make the window longer.' };
  return { apply: () => { M.glass = M.glass.filter(o => !(o[0] === F && segOverlap(o, h, line_, lo, hi))); M.glass.push(h ? [F, lo, line_, hi, line_] : [F, line_, lo, line_, hi]); } };
}
// a tap with a point tool. o: { furnKind, gateW }
export function point(M, F, tool, x, z, o = {}) {
  const [sx, sz] = [snap(x), snap(z)];
  if (tool === 'door' || tool === 'arch' || tool === 'gap') return opening(M, F, x, z, tool);
  if (tool === 'furn') { const k = o.furnKind || 'table', [w, d] = FURN_SIZE[k]; const x0 = Math.round((x - w / 2) * 4) / 4, z0 = Math.round((z - d / 2) * 4) / 4; if (M.furniture.length >= LIMITS.furniture) return { err: 'That is the most furniture a map can have.' }; return { apply: () => M.furniture.push([F, x0, z0, x0 + w, z0 + d, FURN_H[k], k, '+z']) }; }
  if (tool === 'stairs') { if (M.floors < 2) return { err: 'Stairs need a second floor: set Floors to 2 or 3 in Settings.' }; if (F >= M.floors - 1) return { err: 'Stairs climb to the floor above: switch to a lower floor.' }; if (M.stairs.length >= LIMITS.stairs) return { err: 'That is the most stairs a map can have.' }; return { apply: () => M.stairs.push([F, snap(x - STAIR_W / 2), snap(z - STAIR_L / 2), snap(x - STAIR_W / 2) + STAIR_W, snap(z - STAIR_L / 2) + STAIR_L]) }; }
  if (tool === 'spawn') { if (F !== 0) return { err: 'The squad starts on the ground floor.' }; return { apply: () => { M.spawn = [sx, sz]; if (!M.exit) M.exit = [sx - 3, sz - 1.5, sx + 3, sz + 2.5]; } }; }
  if (tool === 's' || tool === 'c' || tool === 'b') { if (M[tool].length >= LIMITS.spots) return { err: 'That is the most spots a map can have.' }; return { apply: () => M[tool].push([F, sx, sz]) }; }
  if (tool === 'hvt') return { apply: () => { M.hvt = [F, sx, sz]; } };
  if (tool === 'breaker') return { apply: () => { M.breaker = [F, sx, sz]; } };
  if (tool === 'gate') return gate(M, x, z, o.gateW || 1.5);
  if (tool === 'erase') { const it = itemAt(M, F, x, z); return it ? { apply: () => remove(M, it) } : { err: '' }; }
  return { err: '' };
}
// a drag with a box tool, corners already snapped
export function rect(M, F, tool, x0, z0, x1, z1, o = {}) {
  const a = Math.min(x0, x1), b = Math.min(z0, z1), c = Math.max(x0, x1), d = Math.max(z0, z1);
  if (tool === 'room') { if (c - a < 1 || d - b < 1) return { err: 'Rooms are at least 1 × 1 m.' }; if (M.rooms.length >= LIMITS.rooms) return { err: 'That is the most rooms a map can have.' }; return { apply: () => M.rooms.push([F, a, b, c, d, '']), sel: { t: 'rooms', i: M.rooms.length } }; }
  if (tool === 'exit') { if (F !== 0) return { err: 'The exit is on the ground floor.' }; return { apply: () => { M.exit = [a, b, c, d]; } }; }
  if (tool === 'furn') { if (c - a < 0.3 || d - b < 0.3) return point(M, F, 'furn', (x0 + x1) / 2, (z0 + z1) / 2, o); if (M.furniture.length >= LIMITS.furniture) return { err: 'That is the most furniture a map can have.' }; const k = o.furnKind || 'table'; return { apply: () => M.furniture.push([F, a, b, c, d, FURN_H[k], k, '+z']) }; }
  return { err: '' };
}
export { FURN, FURN_H, TREES, SHRUBS, PWALLS, LIMITS };
