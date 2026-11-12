// GRAND PRIX: Operation CHEQUERED FLAG. Armed crew hold the pit building during a race that is still running.
// Ground floor: six team garages open onto the pit lane, a back corridor, team rooms. Upper floor: the VIP hospitality
// club with glass over the pit lane, suites and the race office. In front: pit lane, pit wall, then the live track.
// Behind: the paddock with team motorhomes, where the squad arrives. Generic engine: ../level.js; the race: ./circuit.js.
import { TRACK } from './circuit.js';
export const H = 3.6, DOOR_H = 2.1;
export const FOOT = { x0: 0, z0: -4, x1: 54, z1: 16 };
export const YARD = { x0: -60, z0: -40, x1: 116, z1: 42 };
export const STAIR = { x0: 12.4, x1: 13.9, z0: 10.8, z1: 15.8 };   // climbs toward -z: bottom at the back wall, top beside the upper corridor
export const PITWALL = { x0: -34, x1: 88, z0: -15.4, z1: -15, h: 1.1 };
export const BREAKER = { x: 33, y: 1.4, z: 15.87 };
export const SPAWN = [[24, 33], [25.5, 33], [27, 33], [28.5, 33]];
export const EXIT = { x0: 20, x1: 32, z0: 31.5, z1: 42 };
const G = [0, 1, 2, 3, 4, 5];
export const TEAMS = ['#d2342b', '#1e5bc6', '#0f8a6c', '#f08a1c', '#7a2db8', '#e6c229'];   // garage colours (generic, invented teams)

// [floor, name, x0, z0, x1, z1, floor finish]
export const ROOMS = [
  ...G.map(i => [0, 'Garage ' + (i + 1), i * 9, -4, i * 9 + 9, 8, 'epoxy']),
  [0, 'Back corridor', 0, 8, 54, 10.5, 'tile'],
  [0, 'Team office', 0, 10.5, 12, 16, 'carpet'], [0, 'Stair hall', 12, 10.5, 18, 16, 'tile'], [0, 'Tyre store', 18, 10.5, 30, 16, 'epoxy'],
  [0, 'Electrical', 30, 10.5, 36, 16, 'tile'], [0, 'Briefing room', 36, 10.5, 48, 16, 'carpet'], [0, 'Paddock entrance', 48, 10.5, 54, 16, 'tile'],
  [1, 'Club lounge west', 0, -4, 18, 8, 'carpet'], [1, 'Champagne bar', 18, -4, 36, 8, 'wood'], [1, 'Club lounge east', 36, -4, 54, 8, 'carpet'],
  [1, 'VIP corridor', 0, 8, 54, 10.5, 'carpet'],
  [1, 'Kitchen', 0, 10.5, 12, 16, 'tile'], [1, 'Upper landing', 12, 10.5, 18, 16, 'wood'], [1, 'VIP suite', 18, 10.5, 30, 16, 'carpet'],
  [1, 'Media room', 30, 10.5, 42, 16, 'carpet'], [1, 'Race office', 42, 10.5, 54, 16, 'carpet'],
];
// [floor, x0, z0, x1, z1, kind, 'ext' | 'hidden']
export const OPENINGS = [
  ...G.map(i => [0, i * 9 + 1, -4, i * 9 + 8, -4, 'gap']),                 // garage fronts, open to the pit lane
  ...G.map(i => [0, i * 9 + 4, 8, i * 9 + 5, 8, 'door']),                   // garage back doors to the corridor
  ...[1, 2, 3, 4, 5].map(i => [0, i * 9, 5.5, i * 9, 6.5, 'door']),         // between neighbouring garages
  [0, 0, 9, 0, 10, 'door', 'ext'], [0, 54, 9, 54, 10, 'door', 'ext'],
  [0, 5, 10.5, 6, 10.5, 'door'], [0, 15.5, 10.5, 16.5, 10.5, 'door'], [0, 16, 16, 17, 16, 'door', 'ext'], [0, 23.5, 10.5, 24.5, 10.5, 'door'],
  [0, 32.5, 10.5, 33.5, 10.5, 'door'], [0, 41.5, 10.5, 42.5, 10.5, 'door'], [0, 50, 10.5, 52, 10.5, 'gap'], [0, 50, 16, 52, 16, 'door', 'ext'],
  [0, 30, 12, 30, 13, 'door'],
  [1, 8, 8, 10, 8, 'arch'], [1, 26, 8, 28, 8, 'arch'], [1, 44, 8, 46, 8, 'arch'], [1, 18, 0.5, 18, 2.5, 'arch'], [1, 36, 0.5, 36, 2.5, 'arch'],
  [1, 5, 10.5, 6, 10.5, 'door'], [1, 12, 10.5, 18, 10.5, 'gap'], [1, 23.5, 10.5, 24.5, 10.5, 'door'], [1, 35.5, 10.5, 36.5, 10.5, 'door'],
  [1, 47.5, 10.5, 48.5, 10.5, 'door'], [1, 42, 13, 42, 14, 'door'],
];
export const GLASS = [[1, 0.5, -4, 17.5, -4], [1, 18.5, -4, 35.5, -4], [1, 36.5, -4, 53.5, -4], [1, 0, -2, 0, 6], [1, 54, -2, 54, 6]];

// [floor, x0, z0, x1, z1, height, kind, face]
const F = [];
for (const i of G) {
  const x = i * 9;
  F.push([0, x + 3.6, -1.6, x + 5.4, 4.0, 1.0, 'racecar', '-z']);           // the team's spare car on its stands, nose to the pit lane
  F.push([0, x + 0.3, 1.0, x + 1.0, 6.6, 0.95, 'counter', '+x']);          // workbench along the left wall
  F.push([0, x + 8.0, 0.5, x + 8.7, 2.5, 1.1, 'cabinet', '-x']);           // tool chest
  F.push([0, x + 7.9, 3.4, x + 8.7, 4.2, 1.6, 'tyres']);                    // tyre stacks
  F.push([0, x + 7.9, -3.6, x + 8.7, -2.8, 1.2, 'tyres']);
  F.push([0, x + 1.4, 6.9, x + 3.6, 7.6, 1.3, 'console', '+z']);           // timing screens on the back wall
}
F.push([0, 0.3, 13, 2.4, 15.7, 0.76, 'table'], [0, 4, 15.2, 11.6, 15.8, 1.9, 'shelf', '-z'], [0, 8, 11, 11.6, 12.2, 0.76, 'table'],
  ...[19, 21.5, 24, 26.5].map(x => [0, x, 14.6, x + 1.6, 15.8, 1.6, 'tyres']), ...[19, 21.5, 26.5].map(x => [0, x, 11, x + 1.6, 12, 1.2, 'tyres']),
  [0, 30.3, 15.2, 32.2, 15.8, 1.9, 'cabinet', '-z'], [0, 33.8, 15.2, 35.7, 15.8, 1.9, 'cabinet', '-z'],
  [0, 38, 12.2, 46, 14.2, 0.76, 'table'], [0, 47.3, 11, 47.8, 15.5, 1.9, 'console', '-x'], [0, 52.6, 11.2, 53.7, 13.4, 0.8, 'sofa', '-x']);
F.push([1, 2, 1.5, 4.8, 2.4, 0.8, 'sofa', '-z'], [1, 2.2, -0.4, 4.6, 0.8, 0.45, 'table'], [1, 7, 4.5, 9.8, 5.4, 0.8, 'sofa', '+z'], [1, 7.2, 2.4, 9.6, 3.6, 0.76, 'table'],
  [1, 12, -2.5, 15, -1.3, 0.76, 'table'], [1, 13, 3.5, 16, 4.7, 0.76, 'table'], [1, 0.3, 6.4, 3, 7.7, 0.9, 'cabinet', '+z'],
  [1, 22, 3.5, 32, 4.6, 1.1, 'counter', '-z'], [1, 22, 6.9, 32, 7.6, 1.9, 'shelf', '-z'], [1, 20, -2.4, 22, -1.2, 1.05, 'table'], [1, 25, -2.4, 27, -1.2, 1.05, 'table'], [1, 30, -2.4, 32, -1.2, 1.05, 'table'],
  [1, 39, 1.5, 41.8, 2.4, 0.8, 'sofa', '-z'], [1, 39.2, -0.4, 41.6, 0.8, 0.45, 'table'], [1, 45, -2.5, 48, -1.3, 0.76, 'table'], [1, 46, 3.5, 49, 4.7, 0.76, 'table'], [1, 51, 6.4, 53.7, 7.7, 0.9, 'cabinet', '+z'],
  [1, 0.3, 11, 5, 11.6, 0.92, 'counter', '+z'], [1, 0.3, 15.2, 11.6, 15.8, 0.92, 'counter', '-z'], [1, 6, 12.6, 9, 13.6, 0.92, 'counter'],
  [1, 18.4, 14, 20.6, 15.8, 0.55, 'bed', '+x'], [1, 24, 12, 27, 13.2, 0.45, 'table'], [1, 23.5, 15, 28, 15.8, 0.8, 'sofa', '-z'],
  [1, 31, 15.2, 41, 15.8, 1.4, 'console', '-z'], [1, 33, 12, 38, 13.2, 0.76, 'table'],
  [1, 44, 11, 50, 12.2, 0.76, 'table'], [1, 53.2, 11, 53.8, 15.6, 1.9, 'shelf', '-x'], [1, 44, 15.2, 50, 15.8, 1.2, 'console', '-z']);
// pit lane: tool trolleys and the pit-wall gantry stands
for (const i of G) F.push([0, i * 9 + 1.2, -6.6, i * 9 + 2.2, -5.9, 1.0, 'cabinet', '+z']);
export const FURNITURE = F;

export const SUSPECT_SPOTS = [
  ...G.map(i => [0, i * 9 + 6.5, 5.5]), ...G.map(i => [0, i * 9 + 2, -2.5]), [0, 6, 9.2], [0, 27, 9.3], [0, 45, 9.2],
  [0, 4, 12], [0, 16.5, 13], [0, 22, 13], [0, 33, 12.5], [0, 42, 11.5], [0, 51, 14],
  [0, 10, -8], [0, 30, -12], [0, 48, -8], [0, 66, -10], [0, -10, -10],
  [1, 6, 1], [1, 15, 6], [1, 24, 0], [1, 33, 6], [1, 42, 0], [1, 50, 5], [1, 20, 9.2], [1, 40, 9.2],
  [1, 3, 13.5], [1, 22, 12], [1, 28, 14], [1, 34, 12.6], [1, 39, 14.2], [1, 16, 12],
];
export const CIV_SPOTS = [[0, 2, 4], [0, 15, 6.6], [0, 25, 1], [0, 46, 6.8], [0, 10, 14.6], [0, 44, 14.8], [1, 10, -2.5], [1, 28, 0.5], [1, 52, 2.5], [1, 2.5, 13.8], [1, 26, 14], [1, 40, 13]];
export const BOMB_SPOTS = [   // [floor, x, z, surface height]: on benches, counters and tables
  [0, 9.65, 3.5, 0.95], [0, 27.65, 5, 0.95], [0, 45.65, 2.5, 0.95], [0, 42, 13.2, 0.76], [0, 1.4, 14.4, 0.76],
  [1, 27, 4.05, 1.1], [1, 3.4, 0.2, 0.45], [1, 7.5, 13.1, 0.92], [1, 35.5, 12.6, 0.76], [1, 40.4, 0.2, 0.45],
];
export const HVT = { at: [1, 47, 13.6], guards: [[1, 44.5, 14.4], [1, 51, 12.6]] };

// ---- shape helpers ----
export const inFoot = (x, z) => x >= FOOT.x0 && x <= FOOT.x1 && z >= FOOT.z0 && z <= FOOT.z1;
export const inStair = (x, z) => x > STAIR.x0 && x < STAIR.x1 && z > STAIR.z0 && z < STAIR.z1;
const stairT = z => (STAIR.z1 - z) / (STAIR.z1 - STAIR.z0), stairUp = z => Math.min(1, stairT(z) / 0.85) * H;
// Every walkable surface over (x, z) as [height, nav layer]. Layers: 0 ground, 1 upper floor.
function surfaces(x, z) {
  if (inFoot(x, z)) { if (inStair(x, z)) return stairT(z) > 0.85 ? [[H, 1]] : [[stairUp(z), 0]]; return [[0, 0], [H, 1]]; }
  return [[0, 0]];
}
function floorRay(ox, oy, oz, dx, dy, dz, best) {
  if (Math.abs(dy) > 1e-9) for (const py of [0, H, 2 * H]) {
    const t = (py - oy) / dy; if (t <= 1e-6 || t >= best) continue; const x = ox + dx * t, z = oz + dz * t;
    if (py === 0 || (inFoot(x, z) && !(py === H && inStair(x, z)))) best = t;
  }
  return best;
}
function solidFloor(x, y, z) {
  if (y < 0) return true;
  if (!inFoot(x, z) || inStair(x, z)) return false;
  return (y < H && y > H - 0.2) || (y < 2 * H + 0.3 && y > 2 * H - 0.2);
}
function floorAt(x, z, y) {
  if (inFoot(x, z)) { if (inStair(x, z)) return 'metal'; const f = y > H / 2 ? 1 : 0; for (const r of ROOMS) if (r[0] === f && x >= r[2] && x <= r[4] && z >= r[3] && z <= r[5]) return r[6] === 'carpet' ? 'carpet' : r[6] === 'wood' ? 'wood' : 'concrete'; }
  return 'concrete';
}
// Solids that are not room walls: the pit wall, the barrier on the far side of the track, motorhomes, paddock fence.
export const MOTORHOMES = [[2, 22, 0], [-14, 22, 1], [58, 22, 2], [74, 22, 3], [40, 28, 4], [-2, 30, 5]].map(([x, z, c]) => ({ x0: x, x1: x + 13, z0: z, z1: z + 2.6, c }));
function extra({ boxes }) {
  const box = (kind, x0, x1, y0, y1, z0, z1, o = {}) => boxes.push(Object.assign({ f: 0, kind, x0, x1, y0, y1, z0, z1 }, o));
  box('pitwall', PITWALL.x0, PITWALL.x1, 0, PITWALL.h, PITWALL.z0, PITWALL.z1);
  box('barrier', YARD.x0, YARD.x1, 0, 1.2, TRACK.z0 - 1.2, TRACK.z0 - 0.4);
  for (const m of MOTORHOMES) box('motorhome', m.x0, m.x1, 0, 3.8, m.z0, m.z1, { mh: m.c });
  box('fence', YARD.x0, EXIT.x0, 0, 2.4, 40, 40.08); box('fence', EXIT.x1, YARD.x1, 0, 2.4, 40, 40.08);
  box('fence', YARD.x0, YARD.x0 + 0.08, 0, 2.4, TRACK.z0, 40); box('fence', YARD.x1 - 0.08, YARD.x1, 0, 2.4, TRACK.z0, 40);
}
export default {
  id: 'grandprix', name: 'GRAND PRIX', op: 'Operation CHEQUERED FLAG', H, DOOR_H, YARD, layers: 2, layerFloor: [0, 1], tods: ['day', 'night'],
  spawn: SPAWN, exit: EXIT, breaker: BREAKER, cars: [], rooms: ROOMS, openings: OPENINGS, glass: GLASS, furniture: FURNITURE,
  spots: { s: SUSPECT_SPOTS, c: CIV_SPOTS, b: BOMB_SPOTS }, hvt: HVT, veg: null, counts: { s: 14, c: 7, b: 3 }, time: 900, patrolMax: 26,
  stairs: [{ ...STAIR, yb: 0, n: 1 }], foot: FOOT, race: true,
  lobby: { x: 31.5, y: 1.5, z: 35.5, tx: 26, tz: 33 },
  brief: ['Armed crew hold the pit building mid-race: 7 hostages, 3 bombs', 'in the garages and the VIP club upstairs. The race is still on:', 'stay off the track. The boss is in the race office with two guards.'],
  surfaces, floorRay, solidFloor, terrainY: () => 0, floorAt, extra,
  indoor: (f, x, z) => inFoot(x, z), onStairs: inStair, inside: (x, z, y) => inFoot(x, z) && y < 2 * H, objective: (x, z) => inFoot(x, z) || (z < -4 && z > -15),
  roofY: (x, z) => inFoot(x, z) ? 2 * H + 0.3 : 0,
};
