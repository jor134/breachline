// Player-made maps (the level editor). A map is plain JSON (the format below); compile() turns it into the same kind of map
// definition the built-in maps export, so the engine (../level.js), the AI and the renderer treat it like any other.
// check() validates a map before it is tested or published: limits, required markers, and that everything can be reached.
//
// Format v1 (all lengths in metres, the grid is 0.5 m, x to the east, z to the south, floor 0 = ground):
// { v: 1, name, creator, size: [W, D], floors: 1..3, H, time, counts: { s, c, b }, style: { preset, wall, outer, ground, lights },
//   rooms: [[f, x0, z0, x1, z1, finish]], openings: [[f, x0, z0, x1, z1, 'door' | 'arch' | 'gap', 'ext'?]], glass: [[f, x0, z0, x1, z1]],
//   furniture: [[f, x0, z0, x1, z1, height, kind, face]], stairs: [[f, x0, z0, x1, z1]]  (climbs toward -z, from floor f to f + 1),
//   spawn: [x, z], exit: [x0, z0, x1, z1], breaker: [f, x, z] | null, hvt: [f, x, z] | null,
//   s: [[f, x, z]] suspect posts, c: [[f, x, z]] hostage spots, b: [[f, x, z]] bomb spots (on furniture if there is some under them),
//   landscape (all optional): ter: ground heights in decimetres on a 1 m grid, (floor(W) + 1) x (floor(D) + 1), row by row (z), slopes kept walkable;
//   trees: [[x, z, kind]], shrubs: [[x, z, kind]], pwalls: [[x0, z0, x1, z1, kind]] property walls on grid lines, gates: [[x0, z0, x1, z1]] in them }
// Buildings stand on the ground: inside a room's footprint the ground is the room's floor (earth below it, so a storey whose
// floor is under the ground outside is a basement on that side: a walk-out like the mansion's).
import { U } from '../level.js';

export const LIMITS = { size: [20, 120], floors: 3, rooms: 150, openings: 400, glass: 300, furniture: 500, stairs: 12, spots: 100, name: 24, creator: 20, bytes: 400000, trees: 400, shrubs: 600, pwalls: 200, gates: 40 };
export const TREES = { oak: ['common_tree_1', 7.5], elm: ['common_tree_2', 7], maple: ['common_tree_3', 6.5], pine: ['pine_tree_1', 8], palm: ['palm_tree_1', 8.5], palm2: ['palm_tree_2', 8] };
export const SHRUBS = { bush: ['bush_1', 1.2], round: ['bush_2', 1.1], tall: ['bush_3', 1.6], wide: ['bush_4', 1.0], fern: ['plant_1', 0.9] };
export const PWALLS = { privacy: { h: 2.4, label: 'Privacy wall (blocks everything)' }, railing: { h: 1.2, label: 'Iron railing (see and shoot through)' }, fence: { h: 1.8, label: 'Wood fence (hides you, bullets go through)' }, low: { h: 1.1, label: 'Low stone wall (cover)' } };
export const SLOPE = 5;   // the steepest the ground gets: 0.5 m of rise per metre (about 27 degrees), so every slope can be walked
export const terDims = (W, D) => [Math.floor(W) + 1, Math.floor(D) + 1];
// Pull the ground in until no step between neighbouring points is steeper than SLOPE (both ends move half way each pass).
// pin (optional): points the brush is holding; the ground around them gives way instead.
export function relax(h, nx, nz, max = SLOPE, passes = 300, pin = null) {
  for (let k = 0; k < passes; k++) {
    let moved = false;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * nx + i;
      for (const [b, lim] of [[i + 1 < nx ? a + 1 : -1, max], [j + 1 < nz ? a + nx : -1, max], [i + 1 < nx && j + 1 < nz ? a + nx + 1 : -1, max * 1.41], [i > 0 && j + 1 < nz ? a + nx - 1 : -1, max * 1.41]]) { if (b < 0) continue; const d = h[b] - h[a]; if (d > lim || d < -lim) { const ex = Math.abs(d) - lim, sg = Math.sign(d), pa = pin && pin[a], pb = pin && pin[b];
        if (pa && !pb) h[b] -= sg * ex; else if (pb && !pa) h[a] += sg * ex; else { const e = Math.ceil(ex / 2); h[a] += sg * e; h[b] -= sg * e; } moved = true; } }
    }
    if (!moved) return true;
  }
  return false;
}
export const FINISHES = ['wood', 'carpet', 'tile', 'marble', 'stone', 'paver', 'gravel'];
export const FURN = ['table', 'counter', 'shelf', 'cabinet', 'sofa', 'bed', 'crate', 'console', 'seats', 'column', 'wall', 'hedge'];
export const FURN_H = { table: 0.76, counter: 0.95, shelf: 1.9, cabinet: 1.1, sofa: 0.8, bed: 0.6, crate: 1.0, console: 1.2, seats: 0.85, column: 3, wall: 1.1, hedge: 1.4 };
export const PRESETS = {   // what the rooms, walls and the ground look like unless a texture is uploaded
  house: { wall: 'plaster', outer: 'stone', ground: 'grass', floor: 'wood' },
  office: { wall: 'plaster', outer: 'fascia', ground: 'paver', floor: 'carpet' },
  warehouse: { wall: 'concrete', outer: 'metal', ground: 'asphalt', floor: 'concrete' },
  terminal: { wall: 'lacquer', outer: 'glassy', ground: 'paver', floor: 'marble' },
};
export const matKey = v => typeof v === 'string' && v.startsWith('utex:') ? 'utex_' + v.slice(5) : v;   // an uploaded texture's material name
const num = v => typeof v === 'number' && Number.isFinite(v);
const snap = v => Math.round(v / U) * U;
export const STAIR_W = 1.5, STAIR_L = 5;

// Make a stored map safe: numbers snapped and clamped, strings trimmed, unknown kinds dropped, lists capped.
export function clean(d) {
  if (!d || typeof d !== 'object') throw new Error('not a map');
  const W = Math.max(LIMITS.size[0], Math.min(LIMITS.size[1], snap(num(d.size && d.size[0]) ? d.size[0] : 60))), D = Math.max(LIMITS.size[0], Math.min(LIMITS.size[1], snap(num(d.size && d.size[1]) ? d.size[1] : 60)));
  const floors = Math.max(1, Math.min(LIMITS.floors, Math.round(num(d.floors) ? d.floors : 1))), H = num(d.H) ? Math.max(2.8, Math.min(4.5, d.H)) : 3.2;
  const X = v => Math.max(0, Math.min(W, snap(v))), Z = v => Math.max(0, Math.min(D, snap(v))), F = v => Math.max(0, Math.min(floors - 1, Math.round(v)));
  const txt = (s, n) => String(s == null ? '' : s).replace(/[^\w .,'!?&()-]/g, '').trim().slice(0, n);
  const mat = v => typeof v === 'string' && (/^utex:[a-z0-9]{6,24}$/.test(v) || /^[a-z]{2,16}$/.test(v)) ? v : null;
  const list = (a, n, fn) => (Array.isArray(a) ? a : []).slice(0, n).map(fn).filter(Boolean);
  const rect = (r, i) => { const x0 = X(Math.min(r[i], r[i + 2])), x1 = X(Math.max(r[i], r[i + 2])), z0 = Z(Math.min(r[i + 1], r[i + 3])), z1 = Z(Math.max(r[i + 1], r[i + 3])); return [x0, z0, x1, z1]; };
  const ok = r => Array.isArray(r) && r.slice(0, 5).every(num);
  const out = {
    v: 1, name: txt(d.name, LIMITS.name) || 'Untitled', creator: txt(d.creator, LIMITS.creator) || 'Anon', size: [W, D], floors, H,
    time: Math.max(180, Math.min(1800, Math.round(num(d.time) ? d.time : 600))),
    style: { preset: PRESETS[d.style && d.style.preset] ? d.style.preset : 'house', wall: mat(d.style && d.style.wall), outer: mat(d.style && d.style.outer), ground: mat(d.style && d.style.ground), floor: mat(d.style && d.style.floor), night: !!(d.style && d.style.night) },
    rooms: list(d.rooms, LIMITS.rooms, r => { if (!ok(r)) return null; const [x0, z0, x1, z1] = rect(r, 1); if (x1 - x0 < 1 || z1 - z0 < 1) return null; return [F(r[0]), x0, z0, x1, z1, mat(r[5]) || '']; }),
    openings: list(d.openings, LIMITS.openings, r => { if (!ok(r)) return null; const [x0, z0, x1, z1] = rect(r, 1); if ((x0 !== x1) === (z0 !== z1)) return null; const k = ['door', 'arch', 'gap'].includes(r[5]) ? r[5] : 'door'; return [F(r[0]), x0, z0, x1, z1, k, ...(r[6] === 'ext' ? ['ext'] : [])]; }),
    glass: list(d.glass, LIMITS.glass, r => { if (!ok(r)) return null; const [x0, z0, x1, z1] = rect(r, 1); if ((x0 !== x1) === (z0 !== z1)) return null; return [F(r[0]), x0, z0, x1, z1]; }),
    furniture: list(d.furniture, LIMITS.furniture, r => { if (!ok(r)) return null; const [x0, z0, x1, z1] = [Math.min(r[1], r[3]), Math.min(r[2], r[4]), Math.max(r[1], r[3]), Math.max(r[2], r[4])].map((v, i) => Math.max(0, Math.min(i % 2 ? D : W, Math.round(v * 20) / 20))); const kind = FURN.includes(r[6]) ? r[6] : 'crate'; if (x1 - x0 < 0.2 || z1 - z0 < 0.2) return null; const h = num(r[5]) ? Math.max(0.3, Math.min(kind === 'column' ? H : 2.4, r[5])) : FURN_H[kind]; return [F(r[0]), x0, z0, x1, z1, Math.round(h * 100) / 100, kind, ['+x', '-x', '+z', '-z'].includes(r[7]) ? r[7] : '+z']; }),
    stairs: list(d.stairs, LIMITS.stairs, r => { if (!ok(r)) return null; const f = Math.max(0, Math.min(floors - 2, Math.round(r[0]))); if (floors < 2) return null; const x0 = X(Math.min(r[1], r[3])), z0 = Z(Math.min(r[2], r[4])); return [f, x0, z0, Math.min(W, x0 + STAIR_W), Math.min(D, z0 + STAIR_L)]; }),
    spawn: Array.isArray(d.spawn) && d.spawn.every(num) ? [X(d.spawn[0]), Z(d.spawn[1])] : null,
    exit: Array.isArray(d.exit) && d.exit.length === 4 && d.exit.every(num) ? rect(d.exit, 0) : null,
    breaker: Array.isArray(d.breaker) && d.breaker.every(num) ? [F(d.breaker[0]), X(d.breaker[1]), Z(d.breaker[2])] : null,
    hvt: Array.isArray(d.hvt) && d.hvt.every(num) ? [F(d.hvt[0]), X(d.hvt[1]), Z(d.hvt[2])] : null,
    s: list(d.s, LIMITS.spots, p => Array.isArray(p) && p.every(num) ? [F(p[0]), X(p[1]), Z(p[2])] : null),
    c: list(d.c, LIMITS.spots, p => Array.isArray(p) && p.every(num) ? [F(p[0]), X(p[1]), Z(p[2])] : null),
    b: list(d.b, LIMITS.spots, p => Array.isArray(p) && p.every(num) ? [F(p[0]), X(p[1]), Z(p[2])] : null),
    trees: list(d.trees, LIMITS.trees, p => Array.isArray(p) && num(p[0]) && num(p[1]) ? [Math.round(Math.max(0, Math.min(W, p[0])) * 10) / 10, Math.round(Math.max(0, Math.min(D, p[1])) * 10) / 10, TREES[p[2]] ? p[2] : 'oak'] : null),
    shrubs: list(d.shrubs, LIMITS.shrubs, p => Array.isArray(p) && num(p[0]) && num(p[1]) ? [Math.round(Math.max(0, Math.min(W, p[0])) * 10) / 10, Math.round(Math.max(0, Math.min(D, p[1])) * 10) / 10, SHRUBS[p[2]] ? p[2] : 'bush'] : null),
    pwalls: list(d.pwalls, LIMITS.pwalls, r => { if (!Array.isArray(r) || !r.slice(0, 4).every(num)) return null; const [x0, z0, x1, z1] = rect(r, 0); if ((x0 !== x1) === (z0 !== z1)) return null; return [x0, z0, x1, z1, PWALLS[r[4]] ? r[4] : 'privacy']; }),
    gates: list(d.gates, LIMITS.gates, r => { if (!Array.isArray(r) || !r.slice(0, 4).every(num)) return null; const [x0, z0, x1, z1] = rect(r, 0); if ((x0 !== x1) === (z0 !== z1)) return null; const L = x1 - x0 + z1 - z0; return L >= 1 && L <= 4 ? [x0, z0, x1, z1] : null; }),
  };
  // the ground: decimetres, clamped to two storeys either way and relaxed to walkable slopes; all-flat ground is not stored
  const [tnx, tnz] = terDims(W, D), TMAX = Math.round(2 * H * 10);
  if (Array.isArray(d.ter) && d.ter.length === tnx * tnz) { const t = d.ter.map(v => num(v) ? Math.max(-TMAX, Math.min(TMAX, Math.round(v))) : 0); if (t.some(v => v !== 0)) { relax(t, tnx, tnz); out.ter = t.map(v => Math.max(-TMAX, Math.min(TMAX, v))); } }
  out.counts = { s: Math.max(1, Math.min(out.s.length || 1, Math.round(num(d.counts && d.counts.s) ? d.counts.s : 8))), c: Math.max(0, Math.min(out.c.length, Math.round(num(d.counts && d.counts.c) ? d.counts.c : 4))), b: Math.max(0, Math.min(out.b.length, Math.round(num(d.counts && d.counts.b) ? d.counts.b : 1))) };
  return out;
}

// JSON map -> engine map definition. id: the published id (or 'draft').
export function compile(src, id = 'draft') {
  const d = clean(src), H = d.H, [W, D] = d.size, NF = d.floors;
  const rooms = d.rooms.map(([f, x0, z0, x1, z1, fin], i) => [f, 'Room ' + (i + 1), x0, z0, x1, z1, matKey(fin || PRESETS[d.style.preset].floor)]);
  const covers = (f, x, z, strict) => rooms.some(r => r[0] === f && (strict ? x > r[2] && x < r[4] && z > r[3] && z < r[5] : x >= r[2] && x <= r[4] && z >= r[3] && z <= r[5]));
  const stair = (x, z) => d.stairs.find(s => x > s[1] && x < s[3] && z > s[2] && z < s[4]);
  const stT = (s, z) => (s[4] - z) / (s[4] - s[2]);
  const anyRoom = (x, z) => rooms.some(r => x >= r[2] && x <= r[4] && z >= r[3] && z <= r[5]);
  // the ground: T is the sculpted terrain (bilinear on the 1 m grid); G is what you stand on, the terrain or, inside a footprint, the building's lowest floor
  const [tnx, tnz] = terDims(W, D), TER = d.ter ? Float32Array.from(d.ter, v => v / 10) : null, flat = !TER;
  const T = flat ? () => 0 : (x, z) => { const fx = Math.max(0, Math.min(tnx - 1.0001, x)), fz = Math.max(0, Math.min(tnz - 1.0001, z)), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, a = j * tnx + i;
    return (TER[a] * (1 - u) + TER[a + 1] * u) * (1 - v) + (TER[a + tnx] * (1 - u) + TER[a + tnx + 1] * u) * v; };
  const lowest = (x, z) => { let lo = Infinity; for (const r of rooms) if (r[0] * H < lo && x >= r[2] && x <= r[4] && z >= r[3] && z <= r[5]) lo = r[0] * H; return lo; };
  const grounded = (lo, t) => lo < Infinity && (lo <= 0 || lo <= t + 2.0);   // the ground floor always stands on the ground; an upper room high above it (more than head height) leaves open ground under it
  const G = (x, z) => { const t = T(x, z), lo = lowest(x, z); return grounded(lo, t) ? lo : t; };
  // slabs: a floor at f * H exists where a room on f stands, a roof where a room below it ends; stair holes cut floors
  const slab = (f, x, z) => { if (!(covers(f, x, z) || (f > 0 && covers(f - 1, x, z)))) return false; const s = stair(x, z); return !(s && s[0] === f - 1 && stT(s, z) <= 0.85); };
  function surfaces(x, z) {
    const out = [], s = stair(x, z);
    for (let f = 0; f < NF; f++) {
      if (!covers(f, x, z)) continue;
      if (s && s[0] === f && stT(s, z) <= 0.85) { out.push([f * H + Math.min(1, stT(s, z) / 0.85) * H, f]); continue; }   // the flight
      if (s && s[0] === f - 1 && stT(s, z) <= 0.85) continue;   // the hole above the flight
      out.push([f * H, f]);
    }
    const t = T(x, z), lo = lowest(x, z);
    if (!grounded(lo, t)) {   // open ground: its own nav layer, the storey it is nearest to unless a floor already uses that one
      const want = Math.max(0, Math.min(NF - 1, Math.round(t / H))); let li = want;
      for (const k of [0, -1, 1, -2, 2]) { const l = want + k; if (l >= 0 && l < NF && !out.some(o => o[1] === l)) { li = l; break; } }
      out.push([t, li]);
    }
    return out.length ? out : [[0, 0]];
  }
  // the ground for rays, sampled once on a 0.5 m grid (rays are cast thousands of times a second)
  let GG = null, GMIN = 0, GMAX = 0; const GN = [Math.round(W * 2) + 1, Math.round(D * 2) + 1];
  const gridG = () => { if (GG) return GG; GG = new Float32Array(GN[0] * GN[1]); GMIN = Infinity; GMAX = -Infinity; for (let j = 0; j < GN[1]; j++) for (let i = 0; i < GN[0]; i++) { const v = G(i / 2, j / 2); GG[j * GN[0] + i] = v; if (v < GMIN) GMIN = v; if (v > GMAX) GMAX = v; } return GG; };
  const sampleG = (x, z) => { const g = gridG(), fx = Math.max(0, Math.min(GN[0] - 1.0001, x * 2)), fz = Math.max(0, Math.min(GN[1] - 1.0001, z * 2)), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, a = j * GN[0] + i;
    return (g[a] * (1 - u) + g[a + 1] * u) * (1 - v) + (g[a + GN[0]] * (1 - u) + g[a + GN[0] + 1] * u) * v; };
  function groundRay(ox, oy, oz, dx, dy, dz, best) {
    if (flat) { if (Math.abs(dy) > 1e-9) { const t = -oy / dy; if (t > 1e-6 && t < best) return t; } return best; }
    gridG(); let t0 = 0, t1 = best;
    if (dy >= 0 && oy > GMAX) return best;
    if (oy > GMAX) t0 = (oy - GMAX) / -dy;   // nothing to hit until the ray is down among the hills
    if (dy > 0) t1 = Math.min(t1, (GMAX - oy) / dy + 0.01);
    if (t0 >= t1) return best;
    const step = 0.3; let pt = t0, above = oy + dy * t0 >= sampleG(ox + dx * t0, oz + dz * t0);
    if (!above) return t0 > 1e-6 ? t0 : best;   // starting underground (feet on the ground): ignore
    for (let t = t0 + step; pt < t1; t += step) {
      const tt = Math.min(t, t1), y = oy + dy * tt;
      if (y < sampleG(ox + dx * tt, oz + dz * tt)) { let a = pt, b = tt; for (let k = 0; k < 7; k++) { const m = (a + b) / 2; if (oy + dy * m < sampleG(ox + dx * m, oz + dz * m)) b = m; else a = m; } return b > 1e-6 && b < best ? b : best; }
      pt = tt;
    }
    return best;
  }
  function floorRay(ox, oy, oz, dx, dy, dz, best) {
    if (Math.abs(dy) > 1e-9) for (let f = 1; f <= NF; f++) { const py = f * H, t = (py - oy) / dy; if (t <= 1e-6 || t >= best) continue; if (slab(f, ox + dx * t, oz + dz * t)) best = t; }
    return groundRay(ox, oy, oz, dx, dy, dz, best);
  }
  function solidFloor(x, y, z) { if (y < G(x, z)) return true; for (let f = 1; f <= NF; f++) { const py = f * H; if (y < py + 0.02 && y > py - 0.2 && slab(f, x, z)) return true; } return false; }
  const topAt = (x, z) => { for (let f = NF; f >= 1; f--) if (covers(f - 1, x, z)) return f * H; return 0; };
  const yAt = (f, x, z) => covers(f, x, z) ? f * H : G(x, z);
  const STEP = { wood: 'wood', carpet: 'carpet' };
  function floorAt(x, z, y) { if (stair(x, z)) return 'wood'; const f = Math.max(0, Math.min(NF - 1, Math.round(y / H))); const r = rooms.find(r => r[0] === f && x >= r[2] && x <= r[4] && z >= r[3] && z <= r[5]); if (r) return STEP[r[6]] || 'concrete'; const g = d.style.ground || PRESETS[d.style.preset].ground; return g === 'grass' || g === 'gravel' ? 'snow' : 'concrete'; }
  // the breaker sits on the nearest wall of its room, 1.4 m up
  let breaker = null;
  if (d.breaker) {
    const [f, bx, bz] = d.breaker; let best = 2.5;
    for (const r of rooms) { if (r[0] !== f) continue; const [, , x0, z0, x1, z1] = r; if (bx < x0 - 0.5 || bx > x1 + 0.5 || bz < z0 - 0.5 || bz > z1 + 0.5) continue;
      for (const [dd, x, z] of [[bx - x0, x0 + 0.13, bz], [x1 - bx, x1 - 0.13, bz], [bz - z0, bx, z0 + 0.13], [z1 - bz, bx, z1 - 0.13]]) if (dd >= -0.1 && dd < best) { best = dd; breaker = { x: Math.max(x0 + 0.13, Math.min(x1 - 0.13, x)), y: f * H + 1.4, z: Math.max(z0 + 0.13, Math.min(z1 - 0.13, z)) }; } }
  }
  const furnTop = (f, x, z) => { let top = 0; for (const q of d.furniture) if (q[0] === f && x >= q[1] - 0.05 && x <= q[3] + 0.05 && z >= q[2] - 0.05 && z <= q[4] + 0.05 && q[6] !== 'column' && q[5] <= 1.6) top = Math.max(top, q[5]); return top; };
  const [sx, sz] = d.spawn || [W / 2, D - 4];
  const spawn = [[sx - 1.5, sz], [sx - 0.5, sz], [sx + 0.5, sz], [sx + 1.5, sz]].map(([x, z]) => [Math.max(0.5, Math.min(W - 0.5, x)), z]);
  const ex = d.exit || [sx - 3, sz - 2, sx + 3, sz + 2], exY = G((ex[0] + ex[2]) / 2, (ex[1] + ex[3]) / 2);
  // the HVT gets up to two bodyguards: the nearest suspect spots on his floor, within 10 m (taken out of the random pool)
  let guards = [], sSpots = d.s;
  if (d.hvt) { const [hf, hx, hz] = d.hvt; guards = d.s.filter(p => p[0] === hf && Math.hypot(p[1] - hx, p[2] - hz) < 10 && Math.hypot(p[1] - hx, p[2] - hz) > 0.6).sort((a, b) => Math.hypot(a[1] - hx, a[2] - hz) - Math.hypot(b[1] - hx, b[2] - hz)).slice(0, 2); sSpots = d.s.filter(p => !guards.includes(p)); }
  const name = d.name.toUpperCase();
  return {
    id, custom: true, src: d, name, op: d.name + '  (by ' + d.creator + ')', H, DOOR_H: 2.1, YARD: { x0: 0, z0: 0, x1: W, z1: D }, layers: NF, layerFloor: Array.from({ length: NF }, (_, i) => i),
    spawn, exit: { x0: ex[0], z0: ex[1], x1: ex[2], z1: ex[3], y: exY }, breaker, cars: [], rooms, openings: d.openings, glass: d.glass, furniture: d.furniture,
    spots: { s: sSpots, c: d.c, b: d.b.map(([f, x, z]) => [f, x, z, furnTop(f, x, z) || 0.05]) }, hvt: d.hvt ? { at: d.hvt, guards } : null, veg: veg(d), yAt, extra: flat && !d.pwalls.length && !d.shrubs.length ? null : extra,
    counts: { ...d.counts }, time: d.time, patrolMax: 20, tods: ['day', 'night'], style: d.style,
    stairs: d.stairs.map(([f, x0, z0, x1, z1]) => ({ x0, z0, x1, z1, yb: f * H, n: 1 })), foot: { x0: 0, z0: 0, x1: W, z1: D },
    lobby: { x: Math.min(W - 1, sx + 2.5), y: G(sx, sz) + 1.5, z: Math.min(D - 1, sz + 1.5), tx: sx, tz: sz },
    brief: [d.name + ', a map by ' + d.creator + '.', d.counts.c + ' hostages, ' + d.counts.b + ' bomb' + (d.counts.b === 1 ? '' : 's') + ', ' + d.counts.s + ' suspects. ' + Math.floor(d.time / 60) + ':' + String(d.time % 60).padStart(2, '0') + '.'],
    surfaces, floorRay, solidFloor, terrainY: (z, x) => G(x, z), groundT: T, flat, terDims: [tnx, tnz], floorAt,
    indoor: (f, x, z) => covers(f, x, z, true), onStairs: (x, z) => !!stair(x, z), inside: (x, z, y) => { const f = Math.floor(y / H); return f >= 0 && f < NF && covers(f, x, z); },
    objective: anyRoom, roofY: (x, z) => topAt(x, z) ? topAt(x, z) + 0.3 : G(x, z),
  };
  // landscape solids: foundations where a building stands above the ground, property walls and gates, shrubs
  function extra({ boxes, addDoor }) {
    if (!flat) for (const [f, , x0, z0, x1, z1] of rooms) {
      const cxm = (x0 + x1) / 2, czm = (z0 + z1) / 2;
      for (const [a, c, e, g, mx, mz] of [[x0, z0, x1, z0, cxm, z0 + 0.3], [x0, z1, x1, z1, cxm, z1 - 0.3], [x0, z0, x0, z1, x0 + 0.3, czm], [x1, z0, x1, z1, x1 - 0.3, czm]]) {
        if (lowest(mx, mz) !== f * H || !grounded(f * H, T(mx, mz))) continue;   // only the storey that stands on the ground
        let lo = f * H; for (let k = 0; k <= 8; k++) { const u = k / 8, px = a + (e - a) * u, pz = c + (g - c) * u; lo = Math.min(lo, T(px + (a === e ? 0.4 : 0), pz + (c === g ? 0.4 : 0)), T(px - (a === e ? 0.4 : 0), pz - (c === g ? 0.4 : 0))); }
        if (lo > f * H - 0.05) continue;
        boxes.push(a === e ? { f, kind: 'found', x0: a - 0.11, x1: a + 0.11, z0: c - 0.11, z1: g + 0.11, y0: lo - 0.3, y1: f * H - 0.01 } : { f, kind: 'found', x0: a - 0.11, x1: e + 0.11, z0: c - 0.11, z1: c + 0.11, y0: lo - 0.3, y1: f * H - 0.01 });
      }
    }
    for (const [x0, z0, x1, z1, kind] of d.pwalls) {
      const hz = z0 === z1, a = hz ? x0 : z0, b = hz ? x1 : z1, h = PWALLS[kind].h, th = kind === 'railing' ? 0.06 : kind === 'fence' ? 0.08 : 0.3;
      const cuts = d.gates.filter(q => (q[1] === q[3]) === hz && (hz ? q[1] === z0 : q[0] === x0) && (hz ? q[2] > a && q[0] < b : q[3] > a && q[1] < b)).map(q => hz ? [q[0], q[2]] : [q[1], q[3]]);
      for (let u = a; u < b - 1e-6; u = Math.min(b, u + 1)) {
        const v = Math.min(b, u + 1);
        const parts = [[u, v]]; for (const [c0, c1] of cuts) for (let i = parts.length - 1; i >= 0; i--) { const [p0, p1] = parts[i]; if (c1 <= p0 || c0 >= p1) continue; parts.splice(i, 1); if (p0 < c0) parts.push([p0, c0]); if (c1 < p1) parts.push([c1, p1]); }
        for (const [p0, p1] of parts) { if (p1 - p0 < 0.05) continue;
          const pt = w => hz ? T(w, z0) : T(x0, w), ya = pt(p0), yb = pt(p1), ym = pt((p0 + p1) / 2), lo = Math.min(ya, yb, ym), top = (ya + yb) / 2 + h;
          boxes.push(hz ? { f: 0, kind: kind === 'railing' ? 'fence' : kind === 'fence' ? 'screen' : 'pwall', sub: kind, horiz: true, x0: p0, x1: p1, z0: z0 - th / 2, z1: z0 + th / 2, y0: lo - 0.35, y1: top, base: (ya + yb) / 2 }
            : { f: 0, kind: kind === 'railing' ? 'fence' : kind === 'fence' ? 'screen' : 'pwall', sub: kind, horiz: false, x0: x0 - th / 2, x1: x0 + th / 2, z0: p0, z1: p1, y0: lo - 0.35, y1: top, base: (ya + yb) / 2 });
        }
      }
    }
    for (const [x0, z0, x1, z1] of d.gates) {
      const hz = z0 === z1, wall = d.pwalls.find(q => (q[1] === q[3]) === hz && (hz ? q[1] === z0 && q[0] <= x0 && q[2] >= x1 : q[0] === x0 && q[1] <= z0 && q[3] >= z1));
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, y = T(cx, cz), kind = wall ? wall[4] : 'privacy', gh = Math.min(2.1, PWALLS[kind].h), dd = 0.04;
      addDoor({ f: Math.max(0, Math.min(NF - 1, Math.round(y / H))), x0, z0, x1, z1, horiz: hz, h: gh, cx, cz, y, exterior: true, gate: kind,
        box: { kind: 'door', x0: hz ? x0 : x0 - dd, x1: hz ? x1 : x0 + dd, z0: hz ? z0 - dd : z0, z1: hz ? z0 + dd : z1, y0: y - 0.3, y1: y + gh } });
    }
    for (const [x, z, kind] of d.shrubs) { const r = kind === 'wide' ? 0.6 : 0.45, y = G(x, z); boxes.push({ f: 0, kind: 'screen', sub: 'shrub', x0: x - r, x1: x + r, z0: z - r, z1: z + r, y0: y - 0.1, y1: y + SHRUBS[kind][1] }); }
  }
}
// the map's plants for veg.js: [x, z, model, height, turn], sizes varied a little per plant (the same every time)
function veg(d) {
  if (!d.trees.length && !d.shrubs.length) return null;
  const j = (x, z, k) => { const v = Math.sin(x * 12.9898 + z * 78.233 + k) * 43758.5453; return v - Math.floor(v); };
  return { trees: d.trees.map(([x, z, k]) => [x, z, TREES[k][0], TREES[k][1] * (0.85 + j(x, z, 1) * 0.3), j(x, z, 2) * 6.28]), shrubs: d.shrubs.map(([x, z, k]) => [x, z, SHRUBS[k][0], SHRUBS[k][1] * (0.85 + j(x, z, 3) * 0.3)]), pots: [] };
}

// Is it playable? Returns { ok, errors, warnings }. Needs the level engine (passed in to keep this file free of cycles).
export function check(src, { buildLevel, findPath, registerMap }) {
  const errors = [], warnings = []; let d;
  try { d = clean(src); } catch (e) { return { ok: false, errors: ['Not a map file'], warnings }; }
  if (JSON.stringify(d).length > LIMITS.bytes) errors.push('The map is too big to publish');
  if (!d.rooms.length) errors.push('Draw at least one room');
  if (!d.spawn) errors.push('Place the squad SPAWN (outside the building)');
  if (!d.exit) warnings.push('No EXIT placed: one is made around the spawn');
  if (!d.s.length) errors.push('Place at least one SUSPECT spot');
  if (!d.c.length && !d.b.length) errors.push('Place at least one HOSTAGE or BOMB spot');
  if (!d.breaker) warnings.push('No BREAKER: the power cannot be cut on this map');
  if (d.floors > 1 && !d.stairs.length) errors.push('More than one floor needs at least one STAIRS piece');
  if (errors.length) return { ok: false, errors, warnings };
  const def = compile(d, 'u_check'); registerMap(def);
  const L = buildLevel('u_check'), M = L.map, [sx, sz] = M.spawn[1];
  if (M.rooms.some(r => sx > r[2] && sx < r[4] && sz > r[3] && sz < r[5])) warnings.push('The spawn is inside a room: squads usually start outside');
  if (d.breaker && !M.breaker) warnings.push('The BREAKER must be inside a room, next to a wall');
  const reach = (f, x, z) => { const p = findPath(L, sx, sz, M.yAt(0, sx, sz), x, z, M.yAt(f, x, z), true); const e = p && p[p.length - 1]; return !!p && Math.hypot(e[0] - x, e[1] - z) < 1.3 && e[2] === M.layerFloor[L.layerOf(x, z, M.yAt(f, x, z))]; };
  const bad = (list, what) => { const n = list.filter(([f, x, z]) => !reach(f, x, z)).length; if (n) errors.push(n + ' ' + what + (n > 1 ? ' spots cannot' : ' spot cannot') + ' be reached from the spawn'); };
  bad(d.s, 'suspect'); bad(d.c, 'hostage'); bad(d.b.map(([f, x, z]) => [f, x, z]), 'bomb');
  if (d.hvt && !reach(...d.hvt)) errors.push('The HVT cannot be reached from the spawn');
  if (M.breaker && !reach(Math.floor(M.breaker.y / M.H), M.breaker.x, M.breaker.z)) warnings.push('The breaker may be hard to reach');
  if (d.counts.s > 14) warnings.push('More than 14 suspects can slow phones down');
  return { ok: !errors.length, errors, warnings, map: d };
}
