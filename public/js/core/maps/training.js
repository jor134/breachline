// Map: the training facility, where everyone arrives. A 34 m shooting range with static, pop-up and moving targets,
// a four-room shoot / no-shoot kill house, skill stations (a locked door to pick, one to kick, a rigged door, a dummy bomb)
// and the mission board in the lobby that sends the squad out to a real map. Nothing here can hurt you.
export const H = 3.2, DOOR_H = 2.1;
export const YARD = { x0: -2, z0: -18, x1: 36, z1: 30 };
export const ROOMS = [   // [floor, name, x0, z0, x1, z1, floor finish]
  [0, 'range', 0, -16, 20, 18, 'tconc'], [0, 'lobby', 0, 18, 20, 28, 'tile'], [0, 'skills', 20, 16, 34, 28, 'tconc'],
  [0, 'house', 20, 9, 27, 16, 'wood'], [0, 'house', 27, 9, 34, 16, 'wood'], [0, 'house', 20, 2, 27, 9, 'wood'], [0, 'house', 27, 2, 34, 9, 'wood'],
  [0, 'closet', 21, 25.5, 23.5, 28, 'tile'], [0, 'closet', 24.5, 25.5, 27, 28, 'tile'], [0, 'closet', 28, 25.5, 30.5, 28, 'tile'],
];
export const OPENINGS = [
  [0, 0.5, 18, 19.5, 18, 'gap'], [0, 20, 19, 20, 25.5, 'gap'],
  [0, 22, 16, 23, 16, 'door'], [0, 23, 9, 24, 9, 'door'], [0, 27, 5, 27, 6, 'door'], [0, 31, 9, 32, 9, 'door'], [0, 31, 16, 32, 16, 'door'],   // kill house: in at h1, round through h3, h4, h2, out
  [0, 21.7, 25.5, 22.7, 25.5, 'door'], [0, 25.2, 25.5, 26.2, 25.5, 'door'], [0, 28.7, 25.5, 29.7, 25.5, 'door'],   // practice doors: pick, rigged, kick
];
export const GLASS = [[0, 2, 28, 8, 28], [0, 12, 28, 18, 28]];
// the doors above are numbered in this order by the level engine
export const DOOR = { house: [0, 1, 2, 3, 4], pick: 5, trap: 6, kick: 7 };
export const FURNITURE = [   // [floor, x0, z0, x1, z1, height, kind, face]
  [0, 0.6, 14, 19.4, 14.6, 1.05, 'counter', '+z'],   // firing line
  ...[4, 8, 12, 16].map(x => [0, x - 0.06, 11, x + 0.06, 14, 1.8, 'baffle']),   // lane dividers
  [0, 0, -16, 20, -15.2, 3.2, 'berm'],   // backstop
  [0, 31, 21.6, 33.2, 22.6, 0.78, 'table'],   // bomb bench
  [0, 21, 17.2, 26, 17.8, 1.0, 'cabinet', '+z'], [0, 33.4, 17, 34, 20.5, 1.9, 'shelf', '-x'],
  [0, 0.6, 19, 1.2, 25, 0.45, 'sofa', '+x'], [0, 18.8, 19, 19.4, 25, 0.45, 'sofa', '-x'],
];
export const LANES = [2, 6, 10, 14, 18];
// Targets: kind static | pop | move | house. y is the bottom edge; w x h the face. move slides along x between x0 and x1.
export const TARGETS = [
  ...LANES.map(x => ({ kind: 'static', x, z: 7, y: 0.6, w: 0.5, h: 0.75 })),
  ...LANES.map(x => ({ kind: 'pop', x, z: 2, y: 0.2, w: 0.5, h: 1.2 })),
  { kind: 'move', x: 4, z: -4, y: 0.2, w: 0.5, h: 1.2, x0: 1.5, x1: 18.5, v: 1.6 }, { kind: 'move', x: 15, z: -6.5, y: 0.2, w: 0.5, h: 1.2, x0: 1.5, x1: 18.5, v: -2.2 },
  ...[6, 14].map(x => ({ kind: 'pop', x, z: -11, y: 0.2, w: 0.5, h: 1.2 })),
  // kill house: two cut-outs a room, facing the way you come in; each run decides which one is armed
  { kind: 'house', room: 0, x: 26, z: 10.6, y: 0, w: 0.55, h: 1.75, face: Math.PI }, { kind: 'house', room: 0, x: 21.3, z: 10.2, y: 0, w: 0.55, h: 1.75, face: Math.PI * 0.75 },
  { kind: 'house', room: 1, x: 21.2, z: 3.2, y: 0, w: 0.55, h: 1.75, face: Math.PI * 0.25 }, { kind: 'house', room: 1, x: 25.8, z: 3.4, y: 0, w: 0.55, h: 1.75, face: -Math.PI * 0.25 },
  { kind: 'house', room: 2, x: 33.2, z: 3.2, y: 0, w: 0.55, h: 1.75, face: -Math.PI * 0.5 }, { kind: 'house', room: 2, x: 30.5, z: 2.6, y: 0, w: 0.55, h: 1.75, face: 0 },
  { kind: 'house', room: 3, x: 33.2, z: 13, y: 0, w: 0.55, h: 1.75, face: -Math.PI * 0.5 }, { kind: 'house', room: 3, x: 28, z: 15.2, y: 0, w: 0.55, h: 1.75, face: Math.PI },
];
export const HOUSE_ROOMS = [[20, 9, 27, 16], [20, 2, 27, 9], [27, 2, 34, 9], [27, 9, 34, 16]];   // in the order you clear them
export const BOMB = [0, 32.1, 22.1, 0.78];
export const SPAWN = [[8, 23], [10, 23], [12, 23], [14, 23]];
export const BREAKER = { x: 33.5, y: 1.4, z: 27.87 };

const inside = (x, z) => ROOMS.some(r => x >= r[2] && x <= r[4] && z >= r[3] && z <= r[5]);
function surfaces(x, z) { return inside(x, z) ? [[0, 0]] : []; }
function floorRay(ox, oy, oz, dx, dy, dz, best) {
  if (Math.abs(dy) > 1e-9) for (const py of [0, H]) { const t = (py - oy) / dy; if (t > 1e-6 && t < best) best = t; }
  return best;
}
const solidFloor = (x, y, z) => y < 0 || y > H;
export default {
  id: 'training', name: 'TRAINING', op: 'Training facility', training: true, H, DOOR_H, YARD, layers: 1, layerFloor: [0],
  spawn: SPAWN, exit: { x0: 0, x1: 0, z0: 0, z1: 0 }, breaker: BREAKER, cars: [], rooms: ROOMS, openings: OPENINGS, glass: GLASS, furniture: FURNITURE,
  spots: { s: [], c: [], b: [BOMB] }, veg: null, counts: { s: 0, c: 0, b: 1 }, time: 0, stairs: [],
  targets: TARGETS, houseRooms: HOUSE_ROOMS, doorsOf: DOOR,
  lobby: { x: 10, y: 1.65, z: 27.75, tx: 10, tz: 22 },
  brief: ['Range, kill house and skill stations.', 'Pick a map and weather on this board,', 'then START MISSION. Everyone goes in together.'],
  surfaces, floorRay, solidFloor, terrainY: () => 0, floorAt: (x, z) => x < 20 && z < 18 ? 'concrete' : z < 16 && x > 20 ? 'wood' : 'concrete',
  indoor: (f, x, z) => inside(x, z), onStairs: () => false, inside: () => true, objective: () => false, roofY: () => H,
};
