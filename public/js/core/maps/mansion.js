// MANSION: Operation GILDED CAGE. A three-storey glass-and-stone house on a slope above the ocean.
// Pure data plus the few rules unique to this site (stairs, sloping garden, floor slabs). The generic engine is ../level.js.
export const H = 3.2, DOOR_H = 2.1;
export const FOOT = { x0: 0, z0: 0, x1: 24, z1: 16 };
export const YARD = { x0: -8, z0: -16, x1: 32, z1: 30 };   // front yard at street level, back yard one storey lower, cliff edge at z0
export const STAIR = { x0: 13.5, x1: 15, z0: 4, z1: 9 };
// Main electrical breaker: on the plant room's rear wall, just inside the concealed service door.
export const BREAKER = { x: 22.6, y: -H + 1.4, z: 0.13 };
export const CAR = { x: 22, z: 24.2, length: 4.4 };
export const SPAWN = [[10.5, 27], [11.5, 27], [12.5, 27], [13.5, 27]];
const STEP = { wood: 'wood', carpet: 'carpet', tile: 'concrete', marble: 'concrete' };

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
export const OPENINGS = [   // optional 7th item: 'ext' (outside door, starts closed) or 'hidden' (concealed outside door, never locked)
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
export const GLASS = [
  [0, 1, 16, 8.5, 16], [0, 15.5, 16, 23, 16], [1, 1, 16, 8.5, 16], [1, 9.5, 16, 14.5, 16], [1, 15.5, 16, 23, 16],
  [0, 0, 9, 0, 15], [1, 0, 9, 0, 15], [1, 24, 9, 24, 15],
  [-1, 1, 0, 8.5, 0], [-1, 9.5, 0, 11.5, 0], [-1, 12.5, 0, 14.5, 0], [0, 2, 0, 7, 0], [1, 2, 0, 7, 0], [1, 16, 0, 23, 0],
];
// [floor, x0, z0, x1, z1, height, kind]
export const FURNITURE = [   // [floor, x0, z0, x1, z1, height, kind, face]  face = the way the front points (seat, shelf opening, foot of bed)
  // ground: living room seating faces the TV on the study wall
  [0, 5, 12.6, 8.4, 13.5, 0.8, 'sofa', '-z'], [0, 2.4, 9.6, 3.3, 12.2, 0.8, 'sofa', '+x'], [0, 5.2, 10.2, 8, 11.2, 0.45, 'table'], [0, 5.6, 8.1, 8.4, 8.5, 0.45, 'cabinet'], [0, 0.3, 8.1, 3.6, 8.6, 2, 'shelf', '+z'],
  [0, 18, 11, 21.5, 12.5, 0.78, 'table'], [0, 23.2, 9, 23.8, 12, 0.9, 'cabinet'],
  [0, 18, 3, 21, 4.2, 0.92, 'counter'], [0, 23.2, 0.3, 23.8, 6, 0.92, 'counter'], [0, 15.3, 5, 15.9, 7.5, 0.92, 'counter'], [0, 16, 0.3, 19.5, 0.9, 0.92, 'counter'],
  [0, 3, 3, 5, 4, 0.76, 'table'], [0, 0.2, 0.3, 0.7, 6, 2, 'shelf', '+x'], [0, 2, 0.2, 7, 0.7, 2, 'shelf', '+z'], [0, 6.5, 5, 7.5, 6, 0.8, 'sofa', '-x'],
  [0, 9.3, 10, 9.8, 11.5, 0.85, 'cabinet'], [0, 9.3, 0.3, 9.8, 3, 1.8, 'shelf', '+x'], [0, 13.5, 0.3, 14.7, 1, 0.9, 'counter'],
  [0, 2.5, 19.5, 10, 23.5, 0.55, 'pool'], [0, 14.5, 19.6, 20, 20, 0.9, 'wall'], [0, 20.75, 22, 23.25, 26.4, 1.2, 'car'], [0, -4, 18, -3.4, 24, 0.9, 'wall'],
  // basement and pool terrace: loungers and the outdoor sofa face the ocean, cinema seats face the screen on the west wall
  [-1, 5, -13.5, 19, -7.5, 0.35, 'pool'], [-1, 15.5, -4.6, 18.5, -3.7, 0.8, 'sofa', '-z'], [-1, 21, -11, 22.4, -9.6, 0.5, 'wall'], [-1, 1, -6, 1.8, -4, 0.4, 'bed', '-z'], [-1, 2.6, -6, 3.4, -4, 0.4, 'bed', '-z'],
  [-1, 18.6, -1.6, 19.6, -0.5, 1.5, 'hedge'], [-1, 21.4, -1.6, 22.4, -0.5, 1.5, 'hedge'], [-1, 18.8, -3.3, 22.2, -2.8, 1.7, 'hedge'],
  [-1, 3.2, 3, 5.6, 4.3, 0.8, 'table'], [-1, 0.3, 6.6, 4, 7.2, 1.05, 'counter'], [-1, 6.4, 1.6, 7.3, 4, 0.8, 'sofa', '-x'],
  [-1, 3, 9.8, 4, 14.2, 0.8, 'sofa', '-x'], [-1, 5.4, 9.8, 6.4, 14.2, 0.8, 'sofa', '-x'], [-1, 8.2, 9, 8.7, 15, 0.5, 'cabinet'],
  [-1, 17, 10, 18, 12, 0.5, 'cabinet'], [-1, 20, 10, 21, 12.5, 0.9, 'cabinet'], [-1, 23.2, 9, 23.8, 14, 1.8, 'shelf', '-x'],
  [-1, 9.3, 4.3, 9.8, 8.5, 2, 'shelf', '+x'], [-1, 12.9, 5, 13.3, 8.5, 2, 'shelf', '-x'], [-1, 12.6, 3, 14.85, 3.9, 0.8, 'sofa', '-z'],
  [-1, 17, 1, 19, 2.5, 1.9, 'cabinet'], [-1, 21.5, 4, 23.5, 6.5, 1.6, 'cabinet'], [-1, 15.3, 5, 15.9, 7.5, 0.9, 'counter'],
  // upper: every headboard against a solid wall
  [1, 3.4, 8.1, 5.6, 10.3, 0.6, 'bed', '+z'], [1, 0.3, 8.1, 3, 8.6, 2, 'shelf', '+z'], [1, 6, 15.2, 8, 15.8, 0.85, 'cabinet'],
  [1, 0.1, 1, 2.3, 3.2, 0.6, 'bed', '+x'], [1, 6.5, 0.2, 8, 0.8, 0.76, 'table'], [1, 3, 5.5, 5, 6.5, 0.76, 'table'], [1, 0.2, 4.3, 0.7, 7, 1.6, 'shelf', '+x'],
  [1, 10.5, 11, 13.5, 11.9, 0.8, 'sofa', '+z'], [1, 11, 12.8, 13, 13.8, 0.45, 'table'], [1, 19, 8.1, 21.2, 10.3, 0.6, 'bed', '+z'], [1, 15.2, 9, 15.7, 11.5, 2, 'shelf', '+x'],
  [1, 21.7, 3, 23.9, 5.2, 0.6, 'bed', '-x'], [1, 16, 0.2, 18, 0.8, 0.76, 'table'], [1, 10, 0.2, 11.5, 0.7, 0.9, 'cabinet'],
];
// candidate positions [floor, x, z]
export const SUSPECT_SPOTS = [
  [0, 5, 14.5], [0, 1.2, 13.4], [0, 12, 11], [0, 20, 14], [0, 17, 10], [0, 17, 2], [0, 22, 6.8], [0, 5, 6], [0, 7.5, 2], [0, 11, 6.5], [0, 12, 2],
  [-1, 5, 6], [-1, 7, 12.6], [-1, 12, 11], [-1, 19, 14], [-1, 11.5, 6.5], [-1, 12, 3], [-1, 19.5, 5.5], [-1, 22, 1.5],
  [1, 12, 2], [1, 11, 6.5], [1, 6, 10], [1, 2, 14.5], [1, 6, 2.5], [1, 7, 6], [1, 12, 15], [1, 10, 10.5], [1, 17, 14], [1, 22, 14], [1, 17, 6], [1, 22, 2],
];
export const CIV_SPOTS = [
  [-1, 1, 15], [-1, 22.5, 15], [-1, 8, 0.8], [-1, 23, 7.3],
  [0, 7.5, 15], [0, 22, 15], [0, 21.5, 7], [0, 8, 7], [0, 14, 3], [1, 7.5, 14.5], [1, 3.4, 2.4], [1, 8, 5], [1, 16.5, 9.5], [1, 23, 7], [1, 14, 10],
];
// [floor, x, z, surfaceHeight]
export const BOMB_SPOTS = [
  [-1, 4.4, 4.05, 0.8], [-1, 2, 6.9, 1.05], [-1, 15.6, 6.2, 0.9],
  [0, 19.5, 12.25, 0.78], [0, 19.5, 3.95, 0.92], [0, 4, 3.75, 0.76], [1, 7, 15.4, 0.85], [1, 17, 0.6, 0.76], [0, 14.1, 0.75, 0.9], [1, 4, 6.25, 0.76],
];

// What a footstep sounds like here: wood, carpet, concrete (tile, marble, paving) or gravel outside.
export function floorAt(x, z, y) {
  if (inFoot(x, z)) { if (inStair(x, z)) return 'wood'; const f = Math.max(-1, Math.min(1, Math.round(y / H))); for (const r of ROOMS) if (r[0] === f && x >= r[2] && x <= r[4] && z >= r[3] && z <= r[5]) return STEP[r[6]] || 'concrete'; return 'concrete'; }
  if ((z > 16 && z < 25 && x > -3 && x < 27) || (x > 9 && x < 15 && z >= 25) || (z < 0 && x > -3.6 && x < 27.6) || ((x < 0 && x > -3.6 || x > 24 && x < 27.6) && z > 4 && z < 12)) return 'concrete';
  return 'snow';   // gravel: the crunchy snow recording is the closest match
}
// Walking out through the front gate ends the mission (see Sim.tick).
export const EXIT = { x0: 8.6, x1: 15.4, z0: 25.6, z1: 30 };
// Planting. Trees: [x, z, model, height, turn]. Shrubs: [x, z, model, height]. Pots (indoors): [floor, x, z, model, height].
// Tree trunks and pots stop people and bullets; shrubs only hide things.
export const VEG = (() => {
  let seed = 11; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const trees = [[-5.5, 28, 'common_tree_1', 7.5], [3, 28.6, 'common_tree_3', 6.5], [20.2, 28.7, 'common_tree_2', 7], [28.5, 23.5, 'common_tree_1', 8], [-6, 19.5, 'palm_tree_1', 8.5], [30, 18, 'palm_tree_2', 8],
    [-5.6, 9, 'common_tree_2', 7], [29.8, 10, 'common_tree_3', 7.5], [30.2, 5.5, 'pine_tree_1', 8], [-6.2, 4.5, 'pine_tree_1', 7],
    [2.2, -12, 'palm_tree_3', 9], [23.6, -13.6, 'palm_tree_1', 8.5], [-4.2, -9, 'palm_tree_2', 9.5], [28.2, -8.6, 'palm_tree_3', 8], [-6, -3, 'common_tree_1', 7], [30, -4.5, 'common_tree_2', 6.5]].map(t => [...t, r() * 6.28]);
  const shrubs = [], B = ['bush_1', 'bush_2', 'bush_3', 'bush_4', 'bush_5'], G = ['grass_1', 'grass_2', 'grass_3', 'grass_4'], P = ['plant_1', 'plant_2', 'plant_3'];
  const row = (x0, z0, x1, z1, step, kinds, h) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / step)); for (let i = 0; i <= n; i++) shrubs.push([x0 + (x1 - x0) * i / n + (r() - 0.5) * 0.5, z0 + (z1 - z0) * i / n + (r() - 0.5) * 0.5, kinds[Math.floor(r() * kinds.length)], h * (0.75 + r() * 0.5)]); };
  row(1.3, 16.7, 8.2, 16.7, 1.2, G, 0.5); row(15.8, 16.7, 22.8, 16.7, 1.2, G, 0.5); row(-7.2, 29.2, 8, 29.2, 2.1, B, 1.3); row(16, 29.2, 31.2, 29.2, 2.1, B, 1.3);
  row(-7.2, 13, -7.2, 27, 2.4, B, 1.4); row(31.2, 13, 31.2, 27, 2.4, B, 1.4); row(-7.2, -15, -7.2, 3, 2.6, B, 1.4); row(31.2, -15, 31.2, 3, 2.6, B, 1.4);
  row(-6.4, 5.5, -6.4, 11, 1.6, [...B, ...P], 1.1); row(30.6, 6.5, 30.6, 11.5, 1.6, [...B, ...P], 1.1); row(-2.6, 5, -2.6, 11, 1.5, G, 0.55); row(26.8, 5, 26.8, 11, 1.5, G, 0.55);
  row(1.4, -0.7, 8.2, -0.7, 1.3, G, 0.5); row(13.2, -0.7, 16.5, -0.7, 1.2, G, 0.5); row(4.2, -14.4, 19.8, -14.4, 1.7, [...G, ...P], 0.7); row(1.2, 24.4, 9.6, 24.4, 1.5, [...G, ...P], 0.7);
  row(-3.2, 17.4, -3.2, 24.6, 1.4, P, 0.9); row(21, 20.6, 26, 20.6, 1.5, [...B, ...P], 1.0); row(0.2, -7.2, 4.2, -7.2, 1.2, P, 0.9); row(20.4, -6.6, 26, -6.6, 1.5, [...B, ...P], 1.0);
  for (const [x, z] of [[-4.5, 22.5], [27.5, 26], [-5, -12.5], [26.5, -11.5], [29.5, 14.5], [-5.5, 15]]) shrubs.push([x, z, r() < 0.5 ? 'stone_4' : 'stone_5', 0.6 + r() * 0.5]);
  const pots = [[0, 0.6, 15.4], [0, 14.4, 15.4], [0, 23.4, 15.4], [0, 23.4, 7.3], [0, 8.4, 1.0], [0, 9.6, 8.4], [1, 14.4, 0.6], [1, 8.4, 8.6], [1, 9.6, 15.4], [1, 14.4, 15.4], [1, 15.6, 15.4], [1, 23.4, 7.4], [1, 8.4, 4.6], [1, 8.5, 3.4],
    [-1, 9.6, 15.4], [-1, 14.4, 15.4], [-1, 14.4, 0.6], [-1, 8.4, 7.4], [-1, 15.6, 15.4], [-1, 0.6, 0.6]].map((p, i) => [...p, i % 3 === 2 ? B[1 + (i % 2) * 2] : P[i % 3], 0.8 + r() * 0.5]);
  return { trees, shrubs, pots };
})();


export const inStair = (x, z) => x > STAIR.x0 && x < STAIR.x1 && z > STAIR.z0 && z < STAIR.z1;
const stairT = z => (STAIR.z1 - z) / (STAIR.z1 - STAIR.z0);
export const inFoot = (x, z) => x >= FOOT.x0 && x <= FOOT.x1 && z >= FOOT.z0 && z <= FOOT.z1;
// Outside the house the land steps down from the street (y 0) to the back yard (y -H) along the sides.
export function terrainY(z) { return z >= 12 ? 0 : z <= 4 ? -H : -H * (12 - z) / 8; }
const stairUp = z => Math.min(1, stairT(z) / 0.85) * H;   // the flight to the upper floor; the basement flight runs exactly one storey beneath it
// Every walkable surface over (x, z) as [height, nav layer]. Layers 0, 1, 2 = basement, ground, upper.
function surfaces(x, z) {
  if (!inFoot(x, z)) { const y = terrainY(z); return [[y, y < -H / 2 ? 0 : 1]]; }
  if (inStair(x, z)) { const up = stairUp(z); return stairT(z) > 0.85 ? [[0, 1], [H, 2]] : [[up - H, 0], [up, 1]]; }
  return [[-H, 0], [0, 1], [H, 2]];
}
// Floor slabs and ground for bullets, sight and thrown objects: distance along the ray to the first one, or best.
function floorRay(ox, oy, oz, dx, dy, dz, best) {
  if (Math.abs(dy) > 1e-9) for (const py of [-H, 0, H, 2 * H]) {
    const t = (py - oy) / dy; if (t <= 1e-6 || t >= best) continue;
    const x = ox + dx * t, z = oz + dz * t;
    if (py === -H || (inFoot(x, z) ? !(py < 2 * H && inStair(x, z)) : (py === 0 && z >= 12))) best = t;
  }
  const den = dy - 0.4 * dz;   // the sloped ground beside the house: y = 0.4 z - 4.8 for z in 4..12
  if (Math.abs(den) > 1e-9) { const t = -(oy - 0.4 * oz + 4.8) / den; if (t > 1e-6 && t < best) { const x = ox + dx * t, z = oz + dz * t; if (z > 4 && z < 12 && !inFoot(x, z)) best = t; } }
  return best;
}
function solidFloor(x, y, z) {
  if (y < -H) return true;
  if (!inFoot(x, z)) return y < terrainY(z);
  if (inStair(x, z)) return false;
  return (y < 0 && y > -0.2) || (y < H && y > H - 0.2) || (y < 2 * H + 0.3 && y > 2 * H - 0.2);
}
export default {
  id: 'mansion', name: 'MANSION', op: 'Operation GILDED CAGE', H, DOOR_H, YARD, layers: 3, layerFloor: [-1, 0, 1],
  spawn: SPAWN, exit: EXIT, breaker: BREAKER, cars: [CAR], rooms: ROOMS, openings: OPENINGS, glass: GLASS, furniture: FURNITURE,
  spots: { s: SUSPECT_SPOTS, c: CIV_SPOTS, b: BOMB_SPOTS }, veg: VEG, counts: { s: 9, c: 5, b: 2 }, time: 720,
  stairs: [{ ...STAIR, yb: -H, n: 2 }], foot: FOOT,
  lobby: { x: 15.6, y: 1.5, z: 25.6, tx: 12, tz: 27.4 },
  brief: ['Suspects hold 5 residents on three floors. Two bombs. 12:00.', 'Rear: walk-out basement by the pool; concealed service door', 'behind the hedges. Shout first. Cuff everyone, downed included.'],
  surfaces, floorRay, solidFloor, terrainY, floorAt,
  indoor: (f, x, z) => inFoot(x, z), onStairs: inStair, inside: (x, z, y) => inFoot(x, z) && y < 2 * H, objective: (x, z) => inFoot(x, z),
  roofY: (x, z) => inFoot(x, z) ? 2 * H + 0.3 : terrainY(z),
};
