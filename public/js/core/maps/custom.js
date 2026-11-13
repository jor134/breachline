// Player-made maps (the level editor). A map is plain JSON (the format below); compile() turns it into the same kind of map
// definition the built-in maps export, so the engine (../level.js), the AI and the renderer treat it like any other.
// check() validates a map before it is tested or published: limits, required markers, and that everything can be reached.
//
// Format v1 (all lengths in metres, the grid is 0.5 m, x to the east, z to the south, floor 0 = ground):
// { v: 1, name, creator, size: [W, D], floors: 1..3, H, time, counts: { s, c, b }, style: { preset, wall, outer, ground, lights },
//   rooms: [[f, x0, z0, x1, z1, finish]], openings: [[f, x0, z0, x1, z1, 'door' | 'arch' | 'gap', 'ext'?]], glass: [[f, x0, z0, x1, z1]],
//   furniture: [[f, x0, z0, x1, z1, height, kind, face]], stairs: [[f, x0, z0, x1, z1]]  (climbs toward -z, from floor f to f + 1),
//   spawn: [x, z], exit: [x0, z0, x1, z1], breaker: [f, x, z] | null, hvt: [f, x, z] | null,
//   s: [[f, x, z]] suspect posts, c: [[f, x, z]] hostage spots, b: [[f, x, z]] bomb spots (on furniture if there is some under them) }
import { U } from '../level.js';

export const LIMITS = { size: [20, 120], floors: 3, rooms: 150, openings: 400, glass: 300, furniture: 500, stairs: 12, spots: 100, name: 24, creator: 20, bytes: 400000 };
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
  };
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
  // slabs: a floor at f * H exists where a room on f stands, a roof where a room below it ends; stair holes cut floors
  const slab = (f, x, z) => { if (f === 0) return true; if (!(covers(f, x, z) || covers(f - 1, x, z))) return false; const s = stair(x, z); return !(s && s[0] === f - 1 && stT(s, z) <= 0.85); };
  function surfaces(x, z) {
    const out = [], s = stair(x, z);
    for (let f = 0; f < NF; f++) {
      if (f > 0 && !covers(f, x, z)) continue;
      if (s && s[0] === f && stT(s, z) <= 0.85) { out.push([f * H + Math.min(1, stT(s, z) / 0.85) * H, f]); continue; }   // the flight
      if (s && s[0] === f - 1 && stT(s, z) <= 0.85) continue;   // the hole above the flight
      out.push([f * H, f]);
    }
    return out.length ? out : [[0, 0]];
  }
  function floorRay(ox, oy, oz, dx, dy, dz, best) {
    if (Math.abs(dy) > 1e-9) for (let f = 0; f <= NF; f++) { const py = f * H, t = (py - oy) / dy; if (t <= 1e-6 || t >= best) continue; if (slab(f, ox + dx * t, oz + dz * t)) best = t; }
    return best;
  }
  function solidFloor(x, y, z) { if (y < 0) return true; for (let f = 1; f <= NF; f++) { const py = f * H; if (y < py + 0.02 && y > py - 0.2 && slab(f, x, z)) return true; } return false; }
  const topAt = (x, z) => { for (let f = NF; f >= 1; f--) if (covers(f - 1, x, z)) return f * H; return 0; };
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
  const ex = d.exit || [sx - 3, sz - 2, sx + 3, sz + 2];
  // the HVT gets up to two bodyguards: the nearest suspect spots on his floor, within 10 m (taken out of the random pool)
  let guards = [], sSpots = d.s;
  if (d.hvt) { const [hf, hx, hz] = d.hvt; guards = d.s.filter(p => p[0] === hf && Math.hypot(p[1] - hx, p[2] - hz) < 10 && Math.hypot(p[1] - hx, p[2] - hz) > 0.6).sort((a, b) => Math.hypot(a[1] - hx, a[2] - hz) - Math.hypot(b[1] - hx, b[2] - hz)).slice(0, 2); sSpots = d.s.filter(p => !guards.includes(p)); }
  const name = d.name.toUpperCase();
  return {
    id, custom: true, src: d, name, op: d.name + '  (by ' + d.creator + ')', H, DOOR_H: 2.1, YARD: { x0: 0, z0: 0, x1: W, z1: D }, layers: NF, layerFloor: Array.from({ length: NF }, (_, i) => i),
    spawn, exit: { x0: ex[0], z0: ex[1], x1: ex[2], z1: ex[3] }, breaker, cars: [], rooms, openings: d.openings, glass: d.glass, furniture: d.furniture,
    spots: { s: sSpots, c: d.c, b: d.b.map(([f, x, z]) => [f, x, z, furnTop(f, x, z) || 0.05]) }, hvt: d.hvt ? { at: d.hvt, guards } : null, veg: null,
    counts: { ...d.counts }, time: d.time, patrolMax: 20, tods: ['day', 'night'], style: d.style,
    stairs: d.stairs.map(([f, x0, z0, x1, z1]) => ({ x0, z0, x1, z1, yb: f * H, n: 1 })), foot: { x0: 0, z0: 0, x1: W, z1: D },
    lobby: { x: Math.min(W - 1, sx + 2.5), y: 1.5, z: Math.min(D - 1, sz + 1.5), tx: sx, tz: sz },
    brief: [d.name + ', a map by ' + d.creator + '.', d.counts.c + ' hostages, ' + d.counts.b + ' bomb' + (d.counts.b === 1 ? '' : 's') + ', ' + d.counts.s + ' suspects. ' + Math.floor(d.time / 60) + ':' + String(d.time % 60).padStart(2, '0') + '.'],
    surfaces, floorRay, solidFloor, terrainY: () => 0, floorAt,
    indoor: (f, x, z) => covers(f, x, z, true), onStairs: (x, z) => !!stair(x, z), inside: (x, z, y) => { const f = Math.floor(y / H); return f >= 0 && f < NF && covers(f, x, z); },
    objective: anyRoom, roofY: (x, z) => topAt(x, z) ? topAt(x, z) + 0.3 : 0,
  };
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
  const reach = (f, x, z) => { const p = findPath(L, sx, sz, 0, x, z, f * M.H, true); const e = p && p[p.length - 1]; return !!p && Math.hypot(e[0] - x, e[1] - z) < 1.3 && Math.abs((e[2] ?? f) - f) < 1; };
  const bad = (list, what) => { const n = list.filter(([f, x, z]) => !reach(f, x, z)).length; if (n) errors.push(n + ' ' + what + (n > 1 ? ' spots cannot' : ' spot cannot') + ' be reached from the spawn'); };
  bad(d.s, 'suspect'); bad(d.c, 'hostage'); bad(d.b.map(([f, x, z]) => [f, x, z]), 'bomb');
  if (d.hvt && !reach(...d.hvt)) errors.push('The HVT cannot be reached from the spawn');
  if (M.breaker && !reach(Math.floor(M.breaker.y / M.H), M.breaker.x, M.breaker.z)) warnings.push('The breaker may be hard to reach');
  if (d.counts.s > 14) warnings.push('More than 14 suspects can slow phones down');
  return { ok: !errors.length, errors, warnings, map: d };
}
