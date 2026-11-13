// BREACHLINE level editor: draw a map top-down (mouse or touch), test it solo in the game, publish it to the map library.
// The map format and its checks live in core/maps/custom.js, shared with the game and the Worker.
import { buildLevel, findPath, registerMap } from './core/level.js';
import { clean, check, FINISHES, FURN, FURN_H, PRESETS, STAIR_W, STAIR_L, LIMITS } from './core/maps/custom.js';

const $ = id => document.getElementById(id), cv = $('cv'), g = cv.getContext('2d');
const snap = v => Math.round(v * 2) / 2;
const FURN_SIZE = { table: [1.6, 0.9], counter: [2, 0.6], shelf: [1.6, 0.4], cabinet: [1, 0.5], sofa: [2, 0.9], bed: [1.6, 2.1], crate: [1, 1], console: [1.6, 0.6], seats: [2, 0.6], column: [0.6, 0.6], wall: [2, 0.2], hedge: [2, 0.6] };
const FIN_COL = { wood: '#5c4630', carpet: '#3d3f5c', tile: '#4a5662', marble: '#6c6c74', stone: '#575249', paver: '#514b43', gravel: '#474747', concrete: '#55575a' };
const TOOLS = [['h', 'Build'], ['select', 'Select / move'], ['room', 'Room'], ['door', 'Door'], ['arch', 'Archway'], ['gap', 'Open gap'], ['glass', 'Window'], ['furn', 'Furniture'], ['stairs', 'Stairs'],
  ['h', 'Mission'], ['spawn', 'Squad spawn'], ['exit', 'Exit zone'], ['s', 'Suspect'], ['c', 'Hostage'], ['b', 'Bomb'], ['hvt', 'HVT'], ['breaker', 'Breaker'], ['h', 'Edit'], ['erase', 'Erase'], ['pan', 'Pan']];
const HINT = { select: 'Tap something to select it, drag to move it. Drag a room or furniture corner to resize.', room: 'Drag a rectangle. Rooms on the same floor share walls.', door: 'Tap a wall to put a door in it.', arch: 'Tap a wall for an archway (no door).', gap: 'Tap a wall for a wide opening.', glass: 'Drag along a wall to glaze it.', furn: 'Tap to place, or drag to size it. Pick the kind in Settings.', stairs: 'Tap where the stairs start: they climb to the floor above, toward the top of the screen.', spawn: 'Tap where the squad starts (outside).', exit: 'Drag the zone the squad walks out through.', s: 'Tap to add a place a suspect may start.', c: 'Tap to add a place a hostage may be.', b: 'Tap to add a bomb spot (put it on furniture).', hvt: 'Tap where the high-value target waits.', breaker: 'Tap next to a wall inside a room: the main breaker goes on that wall.', erase: 'Tap something to delete it.', pan: 'Drag to move around. Pinch or scroll to zoom.' };

// ---- state ----
let M = null, pubId = null, F = 0, tool = 'room', furnKind = 'table', sel = null, hist = [], dirty = false;
const view = { ox: 40, oy: 40, s: 14 };
const blank = () => ({ v: 1, name: 'My map', creator: localStorage.getItem('bl_name') || 'Anon', size: [60, 50], floors: 1, H: 3.2, time: 600, counts: { s: 6, c: 3, b: 1 }, style: { preset: 'house', night: false }, rooms: [], openings: [], glass: [], furniture: [], stairs: [], spawn: null, exit: null, breaker: null, hvt: null, s: [], c: [], b: [] });
function load(m, id = null) { M = Object.assign(blank(), m); for (const k of ['rooms', 'openings', 'glass', 'furniture', 'stairs', 's', 'c', 'b']) M[k] = (M[k] || []).map(a => a.slice()); M.style = Object.assign({ preset: 'house' }, M.style); M.counts = Object.assign({ s: 6, c: 3, b: 1 }, M.counts); pubId = id; F = 0; sel = null; hist = []; fit(); ui(); draw(); }
function save() { try { localStorage.setItem('bl_edit', JSON.stringify({ map: M, pubId })); } catch (e) { } }
function change(fn) { hist.push(JSON.stringify(M)); if (hist.length > 80) hist.shift(); fn(); dirty = true; save(); ui(); draw(); }
function undo() { if (!hist.length) return; M = JSON.parse(hist.pop()); sel = null; save(); ui(); draw(); }

// ---- view ----
function resize() { const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; cv.width = r.width * d; cv.height = r.height * d; g.setTransform(d, 0, 0, d, 0, 0); draw(); }
function fit() { const r = cv.getBoundingClientRect(); view.s = Math.max(3, Math.min((r.width - 40) / M.size[0], (r.height - 40) / M.size[1])); view.ox = (r.width - M.size[0] * view.s) / 2; view.oy = (r.height - M.size[1] * view.s) / 2; }
const W2S = (x, z) => [view.ox + x * view.s, view.oy + z * view.s], S2W = (sx, sy) => [(sx - view.ox) / view.s, (sy - view.oy) / view.s];

// ---- geometry helpers ----
const roomsOn = f => M.rooms.filter(r => r[0] === f);
const inRoom = (f, x, z) => M.rooms.some(r => r[0] === f && x > r[1] && x < r[3] && z > r[2] && z < r[4]);
function sides(f) { const out = []; for (const [, x0, z0, x1, z1] of roomsOn(f)) out.push([x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]); return out; }
function nearestSide(x, z, f, max = 0.8) {
  let best = null, bd = max;
  for (const s of sides(f)) { const h = s[1] === s[3], d = h ? (x >= s[0] - 0.2 && x <= s[2] + 0.2 ? Math.abs(z - s[1]) : 1e9) : (z >= s[1] - 0.2 && z <= s[3] + 0.2 ? Math.abs(x - s[0]) : 1e9); if (d < bd) { bd = d; best = { s, h }; } }
  return best;
}
const segDist = (px, pz, x0, z0, x1, z1) => { const dx = x1 - x0, dz = z1 - z0, l = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / l)); return Math.hypot(px - x0 - dx * t, pz - z0 - dz * t); };
function itemAt(x, z) {
  const r = 0.6;
  for (const k of ['s', 'c', 'b']) { const i = M[k].findIndex(p => p[0] === F && Math.hypot(p[1] - x, p[2] - z) < r); if (i >= 0) return { t: k, i }; }
  if (M.hvt && M.hvt[0] === F && Math.hypot(M.hvt[1] - x, M.hvt[2] - z) < r) return { t: 'hvt' };
  if (M.breaker && M.breaker[0] === F && Math.hypot(M.breaker[1] - x, M.breaker[2] - z) < r) return { t: 'breaker' };
  if (F === 0 && M.spawn && Math.hypot(M.spawn[0] - x, M.spawn[1] - z) < 1.2) return { t: 'spawn' };
  for (const k of ['openings', 'glass']) { const i = M[k].findIndex(o => o[0] === F && segDist(x, z, o[1], o[2], o[3], o[4]) < 0.35); if (i >= 0) return { t: k, i }; }
  let i = M.furniture.findIndex(q => q[0] === F && x >= q[1] && x <= q[3] && z >= q[2] && z <= q[4]); if (i >= 0) return { t: 'furniture', i };
  i = M.stairs.findIndex(q => (q[0] === F || q[0] === F - 1) && x >= q[1] && x <= q[3] && z >= q[2] && z <= q[4]); if (i >= 0) return { t: 'stairs', i };
  if (F === 0 && M.exit && x >= M.exit[0] && x <= M.exit[2] && z >= M.exit[1] && z <= M.exit[3]) return { t: 'exit' };
  for (let k = M.rooms.length - 1; k >= 0; k--) { const q = M.rooms[k]; if (q[0] === F && x >= q[1] && x <= q[3] && z >= q[2] && z <= q[4]) return { t: 'rooms', i: k }; }
  return null;
}
function remove(it) { if (!it) return; if (it.i != null) M[it.t].splice(it.i, 1); else M[it.t] = null; }
function rectOf(it) { if (!it) return null; if (it.t === 'rooms' || it.t === 'furniture' || it.t === 'stairs') { const q = M[it.t][it.i]; return [q[1], q[2], q[3], q[4]]; } if (it.t === 'exit') return M.exit.slice(); return null; }

// ---- drawing ----
function draw() {
  if (!M) return; const r = cv.getBoundingClientRect(), [W, D] = M.size, s = view.s;
  g.fillStyle = '#08101a'; g.fillRect(0, 0, r.width, r.height);
  const [ax, ay] = W2S(0, 0); g.fillStyle = M.style.night ? '#0b1420' : '#112018'; g.fillRect(ax, ay, W * s, D * s);
  // grid: half metres faint, metres, every 5 m stronger
  const step = s < 6 ? 5 : s < 12 ? 1 : 0.5;
  for (let x = 0; x <= W + 1e-6; x += step) { const [px] = W2S(x, 0); g.strokeStyle = x % 5 === 0 ? 'rgba(140,180,220,0.22)' : x % 1 === 0 ? 'rgba(140,180,220,0.1)' : 'rgba(140,180,220,0.05)'; g.beginPath(); g.moveTo(px, ay); g.lineTo(px, ay + D * s); g.stroke(); }
  for (let z = 0; z <= D + 1e-6; z += step) { const [, py] = W2S(0, z); g.strokeStyle = z % 5 === 0 ? 'rgba(140,180,220,0.22)' : z % 1 === 0 ? 'rgba(140,180,220,0.1)' : 'rgba(140,180,220,0.05)'; g.beginPath(); g.moveTo(ax, py); g.lineTo(ax + W * s, py); g.stroke(); }
  g.strokeStyle = '#3a6ea5'; g.lineWidth = 2; g.strokeRect(ax, ay, W * s, D * s); g.lineWidth = 1;
  // the floor below, as a ghost
  if (F > 0) for (const [, x0, z0, x1, z1] of roomsOn(F - 1)) { const [a, b] = W2S(x0, z0); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.setLineDash([4, 4]); g.strokeRect(a, b, (x1 - x0) * s, (z1 - z0) * s); g.setLineDash([]); }
  // rooms
  M.rooms.forEach((q, i) => { if (q[0] !== F) return; const [a, b] = W2S(q[1], q[2]); const fin = q[5] || PRESETS[M.style.preset].floor; g.fillStyle = fin.startsWith('utex:') ? '#3f6152' : FIN_COL[fin] || '#4a5662'; g.fillRect(a, b, (q[3] - q[1]) * s, (q[4] - q[2]) * s); });
  // walls
  g.strokeStyle = '#e8e2d6'; g.lineWidth = Math.max(2, s * 0.18); g.lineCap = 'square';
  for (const q of roomsOn(F)) { const [a, b] = W2S(q[1], q[2]); g.strokeRect(a, b, (q[3] - q[1]) * s, (q[4] - q[2]) * s); }
  g.lineCap = 'butt';
  // glass and openings cut the walls
  for (const o of M.glass) if (o[0] === F) { const [a, b] = W2S(o[1], o[2]), [c, d] = W2S(o[3], o[4]); g.strokeStyle = '#08101a'; g.lineWidth = Math.max(3, s * 0.24); line(a, b, c, d); g.strokeStyle = '#8fd8ff'; g.lineWidth = Math.max(2, s * 0.12); line(a, b, c, d); }
  for (const o of M.openings) if (o[0] === F) {
    const [a, b] = W2S(o[1], o[2]), [c, d] = W2S(o[3], o[4]); g.strokeStyle = '#08101a'; g.lineWidth = Math.max(4, s * 0.3); line(a, b, c, d);
    if (o[5] === 'door') { g.strokeStyle = o[6] === 'ext' ? '#7dffa0' : '#c08a50'; g.lineWidth = Math.max(2, s * 0.1); const h = o[2] === o[4], L = Math.hypot(c - a, d - b); g.beginPath(); g.moveTo(a, b); if (h) g.lineTo(a, b - L); else g.lineTo(a - L, b); g.stroke(); g.beginPath(); if (h) g.arc(a, b, L, -Math.PI / 2, 0); else g.arc(a, b, L, Math.PI, Math.PI * 1.5); g.globalAlpha = 0.4; g.stroke(); g.globalAlpha = 1; }
    else { g.strokeStyle = o[5] === 'arch' ? '#c0b080' : '#706a5a'; g.lineWidth = 2; const h = o[2] === o[4]; for (const [px, py] of [[a, b], [c, d]]) { g.beginPath(); if (h) { g.moveTo(px, py - s * 0.25); g.lineTo(px, py + s * 0.25); } else { g.moveTo(px - s * 0.25, py); g.lineTo(px + s * 0.25, py); } g.stroke(); } }
  }
  // stairs: this floor's flights (UP) and the ones arriving from below (DOWN)
  for (const q of M.stairs) { if (q[0] !== F && q[0] !== F - 1) continue; const up = q[0] === F, [a, b] = W2S(q[1], q[2]), w = (q[3] - q[1]) * s, h = (q[4] - q[2]) * s;
    g.fillStyle = up ? 'rgba(200,170,120,0.85)' : 'rgba(200,170,120,0.3)'; g.fillRect(a, b, w, h); g.strokeStyle = '#3a2e20'; g.lineWidth = 1; for (let k = 1; k < 12; k++) line(a, b + h * k / 12, a + w, b + h * k / 12);
    g.fillStyle = '#111'; g.font = 'bold ' + Math.max(9, s * 0.5) + 'px sans-serif'; g.textAlign = 'center'; g.fillText(up ? 'UP ▲' : 'DOWN', a + w / 2, b + h / 2); }
  // furniture
  for (const q of M.furniture) { if (q[0] !== F) continue; const [a, b] = W2S(q[1], q[2]), w = (q[3] - q[1]) * s, h = (q[4] - q[2]) * s; g.fillStyle = q[6] === 'hedge' ? '#2f5a2a' : q[6] === 'column' ? '#bbb' : '#9a8a70'; g.fillRect(a, b, w, h); g.strokeStyle = '#2a2418'; g.strokeRect(a, b, w, h);
    if (s > 9) { g.fillStyle = '#1a1610'; g.font = Math.max(8, Math.min(12, s * 0.45)) + 'px sans-serif'; g.textAlign = 'center'; g.fillText(q[6], a + w / 2, b + h / 2 + 4); }
    const [fx, fz] = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] }[q[7]] || [0, 1]; g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(a + w / 2 + fx * w * 0.42, b + h / 2 + fz * h * 0.42, Math.max(2, s * 0.08), 0, 7); g.fill(); }
  // mission markers
  if (F === 0 && M.exit) { const [a, b] = W2S(M.exit[0], M.exit[1]); g.strokeStyle = '#40e070'; g.setLineDash([6, 4]); g.lineWidth = 2; g.strokeRect(a, b, (M.exit[2] - M.exit[0]) * s, (M.exit[3] - M.exit[1]) * s); g.setLineDash([]); g.fillStyle = '#40e070'; g.font = 'bold 12px sans-serif'; g.textAlign = 'left'; g.fillText('EXIT', a + 3, b + 13); }
  if (F === 0 && M.spawn) for (let k = 0; k < 4; k++) dot(M.spawn[0] - 1.5 + k, M.spawn[1], '#40e070', k === 1 ? 'P' : '');
  const mk = { s: ['#e04848', 'S'], c: ['#4890ff', 'H'], b: ['#ff9a30', 'B'] };
  for (const k of ['s', 'c', 'b']) for (const p of M[k]) if (p[0] === F) dot(p[1], p[2], mk[k][0], mk[k][1]);
  if (M.hvt && M.hvt[0] === F) dot(M.hvt[1], M.hvt[2], '#b060ff', 'V');
  if (M.breaker && M.breaker[0] === F) dot(M.breaker[1], M.breaker[2], '#ffd400', '⚡');
  // selection and the drag preview
  const R = rectOf(sel); if (R) { const [a, b] = W2S(R[0], R[1]); g.strokeStyle = '#7dffa0'; g.lineWidth = 2; g.strokeRect(a - 2, b - 2, (R[2] - R[0]) * s + 4, (R[3] - R[1]) * s + 4); if (sel.t !== 'stairs') { g.fillStyle = '#7dffa0'; const [c, d] = W2S(R[2], R[3]); g.fillRect(c - 6, d - 6, 12, 12); } }
  else if (sel) { const P = selPoint(sel); if (P) { const [a, b] = W2S(P[0], P[1]); g.strokeStyle = '#7dffa0'; g.lineWidth = 2; g.beginPath(); g.arc(a, b, Math.max(10, s * 0.6), 0, 7); g.stroke(); } }
  if (drag && drag.rect) { const [x0, z0, x1, z1] = drag.rect, [a, b] = W2S(Math.min(x0, x1), Math.min(z0, z1)); g.strokeStyle = '#7dffa0'; g.setLineDash([5, 4]); g.lineWidth = 2; g.strokeRect(a, b, Math.abs(x1 - x0) * s, Math.abs(z1 - z0) * s); g.setLineDash([]); g.fillStyle = '#7dffa0'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText(Math.abs(x1 - x0) + ' × ' + Math.abs(z1 - z0) + ' m', a + 4, b - 6); }
  if (drag && drag.seg) { const [x0, z0, x1, z1] = drag.seg, [a, b] = W2S(x0, z0), [c, d] = W2S(x1, z1); g.strokeStyle = '#8fd8ff'; g.lineWidth = 4; line(a, b, c, d); }
  g.fillStyle = '#9fb0c3'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText('Floor ' + (F + 1) + ' of ' + M.floors + '   ' + M.size[0] + ' × ' + M.size[1] + ' m', 8, r.height - 8);
}
const line = (a, b, c, d) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); };
function dot(x, z, col, txt) { const [a, b] = W2S(x, z), r = Math.max(6, view.s * 0.38); g.fillStyle = col; g.beginPath(); g.arc(a, b, r, 0, 7); g.fill(); if (txt) { g.fillStyle = '#fff'; g.font = 'bold ' + Math.round(r * 1.2) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, a, b + 1); g.textBaseline = 'alphabetic'; } }
function selPoint(it) { if (it.i != null && (it.t === 's' || it.t === 'c' || it.t === 'b')) return [M[it.t][it.i][1], M[it.t][it.i][2]]; if (it.t === 'hvt' || it.t === 'breaker') return [M[it.t][1], M[it.t][2]]; if (it.t === 'spawn') return M.spawn; if (it.t === 'openings' || it.t === 'glass') { const o = M[it.t][it.i]; return [(o[1] + o[3]) / 2, (o[2] + o[4]) / 2]; } return null; }

// ---- placing things ----
function placeOpening(x, z, kind) {
  const ns = nearestSide(x, z, F); if (!ns) return msg('Tap on a wall of a room on this floor.', 'err');
  const L = kind === 'door' ? 1 : kind === 'arch' ? 1.5 : 2, { s, h } = ns, a = h ? s[0] : s[1], b = h ? s[2] : s[3];
  if (b - a < L) return msg('That wall is too short for a ' + kind + '.', 'err');
  const c = Math.max(a + L / 2, Math.min(b - L / 2, snap(h ? x : z))), lo = Math.round((c - L / 2) * 2) / 2, hi = lo + L, line_ = h ? s[1] : s[0];
  const ext = h ? !(inRoom(F, c, line_ - 0.25) && inRoom(F, c, line_ + 0.25)) : !(inRoom(F, line_ - 0.25, c) && inRoom(F, line_ + 0.25, c));
  change(() => { M.openings = M.openings.filter(o => !(o[0] === F && segOverlap(o, h, line_, lo, hi))); M.glass = M.glass.filter(o => !(o[0] === F && segOverlap(o, h, line_, lo, hi))); M.openings.push(h ? [F, lo, line_, hi, line_, kind, ...(ext ? ['ext'] : [])] : [F, line_, lo, line_, hi, kind, ...(ext ? ['ext'] : [])]); });
}
const segOverlap = (o, h, line_, lo, hi) => h ? o[2] === o[4] && o[2] === line_ && o[1] < hi && o[3] > lo : o[1] === o[3] && o[1] === line_ && o[2] < hi && o[4] > lo;
function placeGlass(x0, z0, x1, z1) {
  const ns = nearestSide(x0, z0, F, 1); if (!ns) return msg('Start the window on a wall.', 'err');
  const { s, h } = ns, a = h ? s[0] : s[1], b = h ? s[2] : s[3], lo = Math.max(a, snap(Math.min(h ? x0 : z0, h ? x1 : z1))), hi = Math.min(b, snap(Math.max(h ? x0 : z0, h ? x1 : z1))), line_ = h ? s[1] : s[0];
  if (hi - lo < 0.5) return msg('Drag along the wall to make the window longer.', 'err');
  change(() => { M.glass = M.glass.filter(o => !(o[0] === F && segOverlap(o, h, line_, lo, hi))); M.glass.push(h ? [F, lo, line_, hi, line_] : [F, line_, lo, line_, hi]); });
}
function clampIn(x, z) { return [Math.max(0, Math.min(M.size[0], x)), Math.max(0, Math.min(M.size[1], z))]; }
function tap(x, z) {
  const [sx, sz] = [snap(x), snap(z)];
  if (tool === 'door' || tool === 'arch' || tool === 'gap') return placeOpening(x, z, tool);
  if (tool === 'furn') { const [w, d] = FURN_SIZE[furnKind]; const x0 = Math.round((x - w / 2) * 4) / 4, z0 = Math.round((z - d / 2) * 4) / 4; return change(() => M.furniture.push([F, x0, z0, x0 + w, z0 + d, FURN_H[furnKind], furnKind, '+z'])); }
  if (tool === 'stairs') { if (M.floors < 2) return msg('Stairs need a second floor: set Floors to 2 or 3 in Settings.', 'err'); if (F >= M.floors - 1) return msg('Stairs climb to the floor above: switch to a lower floor.', 'err'); return change(() => M.stairs.push([F, snap(x - STAIR_W / 2), snap(z - STAIR_L / 2), snap(x - STAIR_W / 2) + STAIR_W, snap(z - STAIR_L / 2) + STAIR_L])); }
  if (tool === 'spawn') { if (F !== 0) return msg('The squad starts on the ground floor.', 'err'); return change(() => { M.spawn = [sx, sz]; if (!M.exit) M.exit = [sx - 3, sz - 1.5, sx + 3, sz + 2.5]; }); }
  if (tool === 's' || tool === 'c' || tool === 'b') { if (M[tool].length >= LIMITS.spots) return msg('That is the most spots a map can have.', 'err'); return change(() => M[tool].push([F, sx, sz])); }
  if (tool === 'hvt') return change(() => { M.hvt = [F, sx, sz]; });
  if (tool === 'breaker') return change(() => { M.breaker = [F, sx, sz]; });
  if (tool === 'erase') { const it = itemAt(x, z); if (it) change(() => remove(it)); return; }
  if (tool === 'select') { sel = itemAt(x, z); ui(); draw(); }
}
function finishRect(x0, z0, x1, z1) {
  const a = Math.min(x0, x1), b = Math.min(z0, z1), c = Math.max(x0, x1), d = Math.max(z0, z1);
  if (tool === 'room') { if (c - a < 1 || d - b < 1) return msg('Rooms are at least 1 × 1 m.', 'err'); if (M.rooms.length >= LIMITS.rooms) return msg('That is the most rooms a map can have.', 'err'); change(() => M.rooms.push([F, a, b, c, d, ''])); sel = { t: 'rooms', i: M.rooms.length - 1 }; ui(); draw(); }
  else if (tool === 'exit') { if (F !== 0) return msg('The exit is on the ground floor.', 'err'); change(() => { M.exit = [a, b, c, d]; }); }
  else if (tool === 'furn') { if (c - a < 0.3 || d - b < 0.3) return tap((x0 + x1) / 2, (z0 + z1) / 2); change(() => M.furniture.push([F, a, b, c, d, FURN_H[furnKind], furnKind, '+z'])); }
}

// ---- pointer input: one finger or the mouse uses the tool; two fingers (or the right button, or space) pan and zoom ----
const ptrs = new Map(); let drag = null, pinch = null, spaceDown = false;
const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, pos(e));
  if (ptrs.size === 2) { drag = null; const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], s: view.s, ox: view.ox, oy: view.oy }; draw(); return; }
  const [sx, sy] = pos(e), [x, z] = S2W(sx, sy);
  if (tool === 'pan' || e.button === 1 || e.button === 2 || spaceDown) { drag = { pan: true, sx, sy, ox: view.ox, oy: view.oy }; return; }
  drag = { x0: x, z0: z, sx, sy, moved: false };
  if (tool === 'select') {
    const R = rectOf(sel); if (R && sel.t !== 'stairs' && Math.hypot(...W2S(R[2], R[3]).map((v, i) => v - [sx, sy][i])) < 14) { drag.resize = true; hist.push(JSON.stringify(M)); return; }
    const it = itemAt(x, z); sel = it; if (it) { drag.move = true; drag.orig = JSON.stringify(M); } ui(); draw();
  }
});
cv.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) { const [x, z] = S2W(...pos(e)); $('hint').textContent = (HINT[tool] || '') + '   (' + snap(x) + ', ' + snap(z) + ')'; return; }
  ptrs.set(e.pointerId, pos(e));
  if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], k = Math.max(0.2, Math.min(8, d / pinch.d)); const ns = Math.max(2, Math.min(80, pinch.s * k));
    view.ox = c[0] - (pinch.c[0] - pinch.ox) * ns / pinch.s; view.oy = c[1] - (pinch.c[1] - pinch.oy) * ns / pinch.s; view.s = ns; draw(); return; }
  if (!drag) return; const [sx, sy] = pos(e), [x, z] = S2W(sx, sy);
  if (Math.hypot(sx - drag.sx, sy - drag.sy) > 6) drag.moved = true;
  if (drag.pan) { view.ox = drag.ox + sx - drag.sx; view.oy = drag.oy + sy - drag.sy; draw(); return; }
  if (!drag.moved) return;
  if (tool === 'room' || tool === 'exit' || tool === 'furn') { const q = tool === 'furn' ? v => Math.round(v * 4) / 4 : snap; drag.rect = [q(drag.x0), q(drag.z0), q(x), q(z)]; draw(); return; }
  if (tool === 'glass') { drag.seg = [snap(drag.x0), snap(drag.z0), snap(x), snap(z)]; draw(); return; }
  if (tool === 'select' && sel && drag.resize) { const q = M[sel.t] && M[sel.t][sel.i], step = sel.t === 'furniture' ? 0.25 : 0.5, rs = v => Math.round(v / step) * step;
    if (sel.t === 'exit') { M.exit[2] = Math.max(M.exit[0] + 1, rs(x)); M.exit[3] = Math.max(M.exit[1] + 1, rs(z)); } else if (q) { q[3] = Math.max(q[1] + (sel.t === 'rooms' ? 1 : 0.25), rs(x)); q[4] = Math.max(q[2] + (sel.t === 'rooms' ? 1 : 0.25), rs(z)); } draw(); return; }
  if (tool === 'select' && sel && drag.move) { M = JSON.parse(drag.orig); moveItem(sel, x - drag.x0, z - drag.z0); draw(); }
});
function moveItem(it, dx, dz) {
  const step = it.t === 'furniture' ? 0.25 : 0.5, q = v => Math.round(v / step) * step, ddx = q(dx), ddz = q(dz);
  const a = it.i != null ? M[it.t][it.i] : M[it.t]; if (!a) return;
  if (it.t === 'spawn') { a[0] += ddx; a[1] += ddz; return; }
  if (it.t === 'exit') { a[0] += ddx; a[2] += ddx; a[1] += ddz; a[3] += ddz; return; }
  if (it.t === 's' || it.t === 'c' || it.t === 'b' || it.t === 'hvt' || it.t === 'breaker') { a[1] += ddx; a[2] += ddz; return; }
  if (it.t === 'openings' || it.t === 'glass') { const h = a[2] === a[4]; if (h) { a[1] += ddx; a[3] += ddx; } else { a[2] += ddz; a[4] += ddz; } return; }
  a[1] += ddx; a[3] += ddx; a[2] += ddz; a[4] += ddz;
}
const endPtr = e => {
  ptrs.delete(e.pointerId); if (pinch) { if (ptrs.size < 2) pinch = null; drag = null; return; }
  if (!drag) return; const d = drag; drag = null; const [sx, sy] = pos(e), [x, z] = S2W(sx, sy);
  if (d.pan) return;
  if (tool === 'select') { if (d.move && d.moved) { hist.push(d.orig); dirty = true; save(); ui(); } if (d.resize) { dirty = true; save(); ui(); } draw(); return; }
  if (!d.moved) { tap(x, z); return; }
  if (tool === 'room' || tool === 'exit' || tool === 'furn') { const q = tool === 'furn' ? v => Math.round(v * 4) / 4 : snap; finishRect(q(d.x0), q(d.z0), q(x), q(z)); draw(); return; }
  if (tool === 'glass') { placeGlass(d.x0, d.z0, x, z); draw(); return; }
  tap(x, z);
};
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); drag = null; pinch = null; draw(); });
cv.addEventListener('wheel', e => { e.preventDefault(); const [sx, sy] = pos(e), k = Math.exp(-e.deltaY * 0.0015), ns = Math.max(2, Math.min(80, view.s * k)); view.ox = sx - (sx - view.ox) * ns / view.s; view.oy = sy - (sy - view.oy) * ns / view.s; view.s = ns; draw(); }, { passive: false });
addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; if (e.code === 'Space') { spaceDown = true; e.preventDefault(); }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); undo(); } if ((e.code === 'Delete' || e.code === 'Backspace') && sel) { change(() => remove(sel)); sel = null; ui(); draw(); } });
addEventListener('keyup', e => { if (e.code === 'Space') spaceDown = false; });
addEventListener('resize', resize);

// ---- panels ----
function msg(t, kind = '') { const m = $('msg'); m.textContent = t; m.className = kind; m.style.display = 'block'; clearTimeout(msg.t); msg.t = setTimeout(() => { m.style.display = 'none'; }, kind === 'err' ? 6000 : 4000); }
function toolsUI() {
  const el = $('tools'); el.innerHTML = '';
  for (const [k, t] of TOOLS) { if (k === 'h') { const d = document.createElement('div'); d.className = 'h'; d.textContent = t; el.appendChild(d); continue; }
    const b = document.createElement('button'); b.textContent = t; b.className = k === tool ? 'on' : ''; b.onclick = () => { tool = k; if (k !== 'select') sel = null; $('hint').textContent = HINT[k] || ''; toolsUI(); ui(); draw(); }; el.appendChild(b); }
}
const TEX = () => { try { return JSON.parse(localStorage.getItem('bl_tex') || '[]'); } catch (e) { return []; } };
function finishOptions(cur, withDefault) { const t = TEX(); return (withDefault ? '<option value="">(style default)</option>' : '') + FINISHES.map(f => `<option value="${f}"${f === cur ? ' selected' : ''}>${f}</option>`).join('') + t.map(x => `<option value="utex:${x.id}"${'utex:' + x.id === cur ? ' selected' : ''}>texture: ${esc(x.name)}</option>`).join(''); }
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
function ui() {
  const fl = $('floor'); fl.innerHTML = Array.from({ length: M.floors }, (_, i) => `<option value="${i}"${i === F ? ' selected' : ''}>Floor ${i + 1}${i === 0 ? ' (ground)' : ''}</option>`).join(''); fl.onchange = () => { F = +fl.value; sel = null; ui(); draw(); };
  const S = $('side'); let h = '';
  if (sel) {
    h += '<h3>Selected</h3>';
    if (sel.t === 'rooms') { const q = M.rooms[sel.i]; h += `<label>Floor finish <select id="pFin">${finishOptions(q[5], true)}</select></label><label>Size <span>${q[3] - q[1]} × ${q[4] - q[2]} m</span></label>`; }
    if (sel.t === 'furniture') { const q = M.furniture[sel.i]; h += `<label>Kind <select id="pKind">${FURN.map(k => `<option${k === q[6] ? ' selected' : ''}>${k}</option>`).join('')}</select></label><label>Height (m) <input id="pH" type="number" step="0.05" min="0.3" max="3" value="${q[5]}"></label><button id="pRot">Rotate 90°</button> `; }
    if (sel.t === 'openings') { const q = M.openings[sel.i]; h += `<label>Kind <select id="pOk">${['door', 'arch', 'gap'].map(k => `<option${k === q[5] ? ' selected' : ''}>${k}</option>`).join('')}</select></label><label>Outside door (starts closed, may be locked) <input id="pExt" type="checkbox"${q[6] === 'ext' ? ' checked' : ''}></label>`; }
    h += `<button id="pDel" class="warn">Delete</button>`;
  }
  if (tool === 'furn') h += `<h3>Furniture to place</h3><label>Kind <select id="tKind">${FURN.map(k => `<option${k === furnKind ? ' selected' : ''}>${k}</option>`).join('')}</select></label>`;
  h += `<h3>Map</h3>
  <label>Name <input id="mName" type="text" maxlength="${LIMITS.name}" value="${esc(M.name)}"></label>
  <label>Creator <input id="mBy" type="text" maxlength="${LIMITS.creator}" value="${esc(M.creator)}"></label>
  <label>Width (m) <input id="mW" type="number" min="20" max="120" step="2" value="${M.size[0]}"></label>
  <label>Depth (m) <input id="mD" type="number" min="20" max="120" step="2" value="${M.size[1]}"></label>
  <label>Floors <select id="mF">${[1, 2, 3].map(n => `<option${n === M.floors ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
  <label>Ceiling height (m) <input id="mH" type="number" min="2.8" max="4.5" step="0.1" value="${M.H}"></label>
  <label>Time limit (min) <input id="mT" type="number" min="3" max="30" step="1" value="${Math.round(M.time / 60)}"></label>
  <h3>Mission</h3>
  <label>Suspects <input id="cS" type="number" min="1" max="20" value="${M.counts.s}"></label>
  <label>Hostages <input id="cC" type="number" min="0" max="20" value="${M.counts.c}"></label>
  <label>Bombs <input id="cB" type="number" min="0" max="6" value="${M.counts.b}"></label>
  <div style="font-size:12px;color:#9fb0c3">Spots placed: ${M.s.length} suspect, ${M.c.length} hostage, ${M.b.length} bomb. Each game picks from them at random; add more spots than the counts for variety.</div>
  <h3>Style</h3>
  <label>Look <select id="sP">${Object.keys(PRESETS).map(k => `<option${k === M.style.preset ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
  <label>Night <input id="sN" type="checkbox"${M.style.night ? ' checked' : ''}></label>
  ${['wall', 'outer', 'ground', 'floor'].map(k => `<label class="tex">${({ wall: 'Inside walls', outer: 'Outside walls', ground: 'Ground', floor: 'Default floor' })[k]} ${texThumb(M.style[k])}<span><button data-up="${k}">Upload</button>${M.style[k] ? ` <button data-clr="${k}">×</button>` : ''}</span></label>`).join('')}
  <div style="font-size:12px;color:#9fb0c3">Uploads need your creator code. Pictures are cropped square and shrunk to 512 px. Rooms can use them too (select a room).</div>
  <h3>Help</h3><div style="font-size:12px;color:#9fb0c3;line-height:1.4">Draw rooms, then doors and windows on their walls. Upper floors: switch floor, draw rooms over the ones below, and put STAIRS on the floor below. Place the squad spawn and exit outside, then suspect, hostage and bomb spots. CHECK finds problems, TEST plays it solo, PUBLISH puts it on the mission board for everyone.<br>Mouse: scroll to zoom, right-drag or space-drag to pan, Ctrl+Z undo. Touch: pinch to zoom, two fingers to pan.</div>`;
  S.innerHTML = h;
  const on = (id, ev, fn) => { const e = $(id); if (e) e[ev] = fn; };
  on('pFin', 'onchange', e => change(() => { M.rooms[sel.i][5] = e.target.value; }));
  on('pKind', 'onchange', e => change(() => { const q = M.furniture[sel.i]; q[6] = e.target.value; q[5] = FURN_H[q[6]]; }));
  on('pH', 'onchange', e => change(() => { M.furniture[sel.i][5] = Math.max(0.3, Math.min(3, +e.target.value || 1)); }));
  on('pRot', 'onclick', () => change(() => { const q = M.furniture[sel.i], cx = (q[1] + q[3]) / 2, cz = (q[2] + q[4]) / 2, w = q[3] - q[1], d = q[4] - q[2]; q[1] = cx - d / 2; q[3] = cx + d / 2; q[2] = cz - w / 2; q[4] = cz + w / 2; q[7] = ({ '+z': '-x', '-x': '-z', '-z': '+x', '+x': '+z' })[q[7]] || '+z'; }));
  on('pOk', 'onchange', e => change(() => { M.openings[sel.i][5] = e.target.value; }));
  on('pExt', 'onchange', e => change(() => { const q = M.openings[sel.i]; q.length = 6; if (e.target.checked) q.push('ext'); }));
  on('pDel', 'onclick', () => { change(() => remove(sel)); sel = null; ui(); draw(); });
  on('tKind', 'onchange', e => { furnKind = e.target.value; });
  on('mName', 'onchange', e => change(() => { M.name = e.target.value; })); on('mBy', 'onchange', e => change(() => { M.creator = e.target.value; localStorage.setItem('bl_name', e.target.value); }));
  on('mW', 'onchange', e => change(() => { M.size[0] = Math.max(20, Math.min(120, Math.round(+e.target.value / 2) * 2 || 60)); })); on('mD', 'onchange', e => change(() => { M.size[1] = Math.max(20, Math.min(120, Math.round(+e.target.value / 2) * 2 || 50)); }));
  on('mF', 'onchange', e => change(() => { M.floors = +e.target.value; F = Math.min(F, M.floors - 1); }));
  on('mH', 'onchange', e => change(() => { M.H = Math.max(2.8, Math.min(4.5, +e.target.value || 3.2)); })); on('mT', 'onchange', e => change(() => { M.time = Math.max(3, Math.min(30, +e.target.value || 10)) * 60; }));
  on('cS', 'onchange', e => change(() => { M.counts.s = Math.max(1, +e.target.value || 1); })); on('cC', 'onchange', e => change(() => { M.counts.c = Math.max(0, +e.target.value || 0); })); on('cB', 'onchange', e => change(() => { M.counts.b = Math.max(0, +e.target.value || 0); }));
  on('sP', 'onchange', e => change(() => { M.style.preset = e.target.value; })); on('sN', 'onchange', e => change(() => { M.style.night = e.target.checked; }));
  for (const b of S.querySelectorAll('[data-up]')) b.onclick = () => upload(b.dataset.up);
  for (const b of S.querySelectorAll('[data-clr]')) b.onclick = () => change(() => { M.style[b.dataset.clr] = null; });
}
function texThumb(v) { return v && v.startsWith('utex:') ? `<img src="api/tex/${v.slice(5)}" alt="">` : '<span style="color:#9fb0c3;font-size:12px">(style)</span>'; }

// ---- dialogs ----
function dialog(html, wire) { const d = $('dlg'), c = $('dlgc'); c.innerHTML = html + '<div class="row" style="justify-content:flex-end"><button id="dClose">Close</button></div>'; d.style.display = 'flex'; $('dClose').onclick = () => { d.style.display = 'none'; }; if (wire) wire(c); }
const closeDlg = () => { $('dlg').style.display = 'none'; };
const drafts = () => { try { return JSON.parse(localStorage.getItem('bl_drafts') || '{}'); } catch (e) { return {}; } };
function code(cb) {
  const c = sessionStorage.getItem('bl_code'); if (c) return cb(c);
  dialog('<h3>Creator code</h3><p style="font-size:13px;color:#9fb0c3">Publishing and texture uploads need the creator code (the CREATOR_CODE secret set on the Worker).</p><div class="row"><input id="dCode" type="password" style="flex:1" placeholder="code"><button id="dOk">OK</button></div>', c2 => {
    $('dOk').onclick = () => { const v = $('dCode').value.trim(); if (!v) return; sessionStorage.setItem('bl_code', v); closeDlg(); cb(v); }; $('dCode').focus(); });
}
$('bNew').onclick = () => dialog('<h3>New map</h3><div class="row"><button id="dBlank">Blank map</button><button id="dSample">Start from the sample house</button></div>', () => {
  $('dBlank').onclick = () => { closeDlg(); load(blank()); save(); }; $('dSample').onclick = () => { closeDlg(); fetch('maps/sample.json').then(r => r.json()).then(m => { m.name = 'My map'; m.creator = localStorage.getItem('bl_name') || 'Anon'; load(m); save(); }); };
});
$('bSave').onclick = () => { const all = drafts(); all[M.name] = { map: M, pubId }; try { localStorage.setItem('bl_drafts', JSON.stringify(all)); msg('Saved "' + M.name + '" on this device.', 'ok'); dirty = false; } catch (e) { msg('Could not save: this device is out of storage.', 'err'); } };
$('bOpen').onclick = () => {
  const all = drafts(), names = Object.keys(all);
  dialog(`<h3>Open</h3><div style="font-size:12px;color:#9fb0c3">On this device</div>${names.length ? names.map(n => `<div class="row"><span>${esc(n)}</span><span><button data-open="${esc(n)}">Open</button> <button data-del="${esc(n)}" class="warn">×</button></span></div>`).join('') : '<div class="row">No saved drafts yet.</div>'}
    <div style="font-size:12px;color:#9fb0c3;margin-top:10px">Published (edit a copy; publishing it again updates it if it was yours)</div><div id="dPub">Loading...</div>
    <div class="row" style="margin-top:10px"><button id="dExp">Export file</button><label style="display:inline"><button id="dImpB">Import file</button><input id="dImp" type="file" accept=".json,application/json" style="display:none"></label></div>`, c => {
    for (const b of c.querySelectorAll('[data-open]')) b.onclick = () => { const e = all[b.dataset.open]; closeDlg(); load(e.map, e.pubId || null); save(); };
    for (const b of c.querySelectorAll('[data-del]')) b.onclick = () => { delete all[b.dataset.del]; localStorage.setItem('bl_drafts', JSON.stringify(all)); closeDlg(); $('bOpen').onclick(); };
    $('dExp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(M)], { type: 'application/json' })); a.download = (M.name || 'map').replace(/\W+/g, '_') + '.json'; a.click(); };
    $('dImpB').onclick = () => $('dImp').click(); $('dImp').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { load(clean(JSON.parse(t))); save(); closeDlg(); } catch (err) { msg('That file is not a BREACHLINE map.', 'err'); } }); };
    fetch('api/maps', { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject()).then(j => { const el = $('dPub'); if (!el) return; el.innerHTML = (j.maps || []).length ? j.maps.map(m => `<div class="row"><span>${esc(m.name)} <span style="color:#9fb0c3">by ${esc(m.creator)}</span></span><button data-pub="${m.id}">Edit</button></div>`).join('') : '<div class="row">Nothing published yet.</div>';
      for (const b of el.querySelectorAll('[data-pub]')) b.onclick = () => fetch('api/maps/' + b.dataset.pub).then(r => r.json()).then(m => { closeDlg(); load(m, b.dataset.pub); save(); }); }).catch(() => { const el = $('dPub'); if (el) el.textContent = 'The map library is not reachable from here.'; });
  });
};
$('bUndo').onclick = undo;
const runCheck = () => check(M, { buildLevel, findPath, registerMap });
$('bCheck').onclick = () => { const r = runCheck(); msg(r.ok ? 'Ready to play.' + (r.warnings.length ? '\nNotes:\n• ' + r.warnings.join('\n• ') : '') : 'Problems:\n• ' + r.errors.join('\n• ') + (r.warnings.length ? '\nNotes:\n• ' + r.warnings.join('\n• ') : ''), r.ok ? 'ok' : 'err'); };
$('bTest').onclick = () => { const r = runCheck(); if (!r.ok) return msg('Fix these first:\n• ' + r.errors.join('\n• '), 'err'); localStorage.setItem('bl_draft', JSON.stringify(r.map)); save(); location.href = './?draft=1'; };
$('bPub').onclick = () => {
  const r = runCheck(); if (!r.ok) return msg('Fix these before publishing:\n• ' + r.errors.join('\n• '), 'err');
  dialog(`<h3>Publish "${esc(M.name)}"</h3><p style="font-size:13px;color:#9fb0c3">It goes on the mission board for everyone who plays.${pubId ? ' This map was published before: you can update it or publish a new copy.' : ''}</p><div class="row">${pubId ? '<button id="dUpd">Update the published map</button>' : ''}<button id="dNew">Publish${pubId ? ' as new' : ''}</button></div>${pubId ? '<div class="row"><button id="dUnpub" class="warn">Remove it from the board</button></div>' : ''}`, () => {
    const go = id => code(c => fetch('api/maps', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: c, id, map: r.map }) }).then(x => x.json().then(j => ({ ok: x.ok, j }))).then(({ ok, j }) => {
      if (!ok) { if (/creator code/i.test(j.error || '')) sessionStorage.removeItem('bl_code'); return msg((j.error || 'Publishing failed') + (j.errors ? ':\n• ' + j.errors.join('\n• ') : ''), 'err'); }
      pubId = j.id; save(); const all = drafts(); all[M.name] = { map: M, pubId }; localStorage.setItem('bl_drafts', JSON.stringify(all)); closeDlg(); msg('Published. It is on the mission board in the training room (pick it with MISSION).', 'ok');
    }).catch(() => msg('The map library is not reachable.', 'err')));
    if ($('dUpd')) $('dUpd').onclick = () => go(pubId); $('dNew').onclick = () => go(null);
    if ($('dUnpub')) $('dUnpub').onclick = () => code(c => fetch('api/maps/' + pubId, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: c }) }).then(x => x.json()).then(j => { if (j.ok) { pubId = null; save(); closeDlg(); msg('Removed from the board.', 'ok'); } else msg(j.error || 'Could not remove it', 'err'); }));
  });
};
$('sideBtn').onclick = () => $('side').classList.toggle('open');
// texture upload: crop square, shrink to 512 px, JPEG, send with the creator code
function upload(slot) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => { const f = inp.files[0]; if (!f) return; const img = new Image(); img.onload = () => {
    const n = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 512; c.getContext('2d').drawImage(img, (img.width - n) / 2, (img.height - n) / 2, n, n, 0, 0, 512, 512);
    let q = 0.82, jpeg = c.toDataURL('image/jpeg', q); while (jpeg.length > 500000 && q > 0.4) { q -= 0.1; jpeg = c.toDataURL('image/jpeg', q); }
    code(cd => fetch('api/tex', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: cd, jpeg }) }).then(x => x.json().then(j => ({ ok: x.ok, j }))).then(({ ok, j }) => {
      if (!ok) { if (/creator code/i.test(j.error || '')) sessionStorage.removeItem('bl_code'); return msg(j.error || 'Upload failed', 'err'); }
      const t = TEX(); t.push({ id: j.id, name: f.name.replace(/\.[^.]+$/, '').slice(0, 20) }); localStorage.setItem('bl_tex', JSON.stringify(t)); change(() => { M.style[slot] = 'utex:' + j.id; }); msg('Texture uploaded.', 'ok');
    }).catch(() => msg('The map library is not reachable.', 'err')));
    URL.revokeObjectURL(img.src); }; img.src = URL.createObjectURL(f); };
  inp.click();
}
addEventListener('beforeunload', save);

// ---- start: the map you were editing, or a blank one ----
toolsUI();
let start = null; try { start = JSON.parse(localStorage.getItem('bl_edit') || 'null'); } catch (e) { }
requestAnimationFrame(() => { resize(); load(start && start.map ? start.map : blank(), start && start.pubId || null); $('hint').textContent = HINT[tool]; });
window.__ed = { get M() { return M; }, load, tap, finishRect, placeGlass, setTool: t => { tool = t; toolsUI(); }, setFloor: f => { F = f; ui(); draw(); }, check: runCheck, view };
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
