// CLUB: Operation LAST DANCE at the Halcyon, an invented concert club, during a live DJ set. A crew has taken the back of house
// and the upstairs offices; the hall is still full and dancing (the music is too loud: nobody out there knows yet).
// The squad pulls up in the van in the front parking lot: in through the front doors and the lobby, or round the side alley to the
// rear (the loading dock's open shutter, its side door, or the dressing rooms' fire exit) for a quieter way in.
// Generic engine: ../level.js. Frame: x east along the street, z away from it (the lot at -z, the stage at the back).
//
// Heights (H = 3.6): ground floor 0, upstairs 1 (3.6). The hall is two storeys tall (ceiling 7.2), with the VIP balcony across its
// front upstairs; the back of house and the dock are one storey. Nav layers: 0 ground (and the stairs' flights), 1 upstairs.
export const H = 3.6, DOOR_H = 2.2;
export const FOOT = { x0: 0, x1: 58, z0: 0, z1: 42 };               // the building
export const HALL = { x0: 0, x1: 40, z0: 8, z1: 34 };               // the main hall (two storeys)
export const BALC = { x0: 0, x1: 40, z0: 8, z1: 13 };               // the VIP balcony over its front
export const STAGE = { x0: 8, x1: 32, z0: 27.5, z1: 34, h: 1.0 };   // the stage: walk up its steps (or climb its lip), or round it through the wings
export const STEPS = { x0: 28.6, x1: 30.6, z0: 25.3, z1: 27.5 };     // the steps up its front, at the east end, climbing toward +z
export const FLOOR = { x0: 6, x1: 34, z0: 13.5, z1: 26 };           // the dance floor
export const UPPER = [{ x0: 0, x1: 40, z0: 0, z1: 13 }, { x0: 40, x1: 58, z0: 0, z1: 20 }];   // where there is an upstairs
export const STAIRS = [{ x0: 1, x1: 4, z0: 1, z1: 7.6 }, { x0: 42.2, x1: 45, z0: 12.4, z1: 20 }];   // west (lobby side) and staff (east); both climb toward -z
export const YARD = { x0: -1, z0: -34, x1: 64, z1: 48 };
export const VAN = { x: 29, z: -17, turn: 0 };                       // nose to the club
export const SPAWN = [[26.6, -19.5], [27.8, -19.5], [30.2, -19.5], [31.4, -19.5]];
export const EXIT = { x0: 22, x1: 36, z0: -24, z1: -12 };             // back at the van
export const BREAKER = { x: 57.87, y: 1.4, z: 13 };                  // in the storage room, on the outside wall
export const DJ = { x: 20, z: 31.2, face: Math.PI };                  // the DJ behind her booth, facing the hall (-z)

// [floor, name, x0, z0, x1, z1, floor finish]
export const ROOMS = [
  // front of house
  [0, 'Lobby', 18, 0, 40, 8, 'terrazzo'], [0, 'Coat check', 10, 0, 18, 8, 'carpetR'], [0, 'Stair hall', 0, 0, 10, 8, 'terrazzo'],
  [0, "Men's room", 40, 0, 48, 4, 'tileK'], [0, "Women's room", 40, 4, 48, 8, 'tileK'], [0, 'Box office', 48, 0, 58, 8, 'carpetR'],
  [0, 'Main hall', 0, 8, 40, 34, 'clubfloor'],
  // back of house: the corridor behind the stage, dressing rooms, the green room, production; the staff corridor, storage, keg cooler, dock
  [0, 'Backstage', 0, 34, 44, 36, 'concrete'], [0, 'Dressing room 1', 0, 36, 7, 42, 'tileW'], [0, 'Dressing room 2', 7, 36, 14, 42, 'tileW'],
  [0, 'Green room', 14, 36, 30, 42, 'carpetG'], [0, 'Production', 30, 36, 40, 42, 'concrete'],
  [0, 'Staff corridor', 40, 8, 45, 26, 'concrete'], [0, 'Dock passage', 40, 26, 44, 34, 'concrete'], [0, 'Storage', 45, 8, 58, 18, 'concrete'], [0, 'Keg cooler', 45, 18, 52, 26, 'steelfloor'],
  [0, 'Loading dock', 44, 26, 58, 42, 'concrete'], [0, 'Dock office', 40, 36, 44, 42, 'concrete'],
  // upstairs: the VIP lounge over the lobby, its balcony over the hall, the landing; the offices
  [1, 'Upper landing', 0, 0, 10, 8, 'carpetR'], [1, 'VIP lounge', 10, 0, 40, 8, 'carpetR'], [1, 'VIP balcony', 0, 8, 40, 13, 'carpetR'], [1, 'hall', 0, 13, 40, 34, 'void'],
  [1, 'Office corridor', 40, 0, 45, 20, 'carpetG'], [1, "Manager's office", 45, 0, 58, 10, 'oak'], [1, 'Security room', 45, 10, 58, 20, 'carpetG'],
];
// [floor, x0, z0, x1, z1, kind, 'ext' | 'hidden']
export const OPENINGS = [
  [0, 26.4, 0, 27.6, 0, 'door', 'ext'], [0, 30.4, 0, 31.6, 0, 'door', 'ext'],                            // front doors
  [0, 18, 3, 18, 6, 'gap'], [0, 10, 4, 10, 6, 'gap'],                                                     // coat check counter; stair hall
  [0, 40, 1.4, 40, 2.6, 'door'], [0, 40, 5.4, 40, 6.6, 'door'],                                          // men's, women's
  [0, 48.6, 8, 49.8, 8, 'door'], [0, 58, 3, 58, 4.2, 'door', 'ext'],                                         // the box office: from storage, and its street door
  [0, 24, 8, 34, 8, 'gap'], [0, 3, 8, 6, 8, 'gap'],                                                       // into the hall from the lobby and from the stair hall
  [0, 40, 27.6, 40, 28.8, 'door'],                                                                         // hall to the dock passage (past the east booths, clear of them)
  [0, 3, 34, 4.2, 34, 'door'], [0, 35, 34, 36.2, 34, 'door'],                                             // stage wings: hall to backstage
  [0, 4, 36, 5.2, 36, 'door'], [0, 10, 36, 11.2, 36, 'door'], [0, 21, 36, 23, 36, 'door'], [0, 34, 36, 35.2, 36, 'door'],   // dressing rooms, green room, production
  [0, 40, 34, 44, 34, 'gap'], [0, 40, 26, 44, 26, 'gap'],                                                  // backstage, the passage, the staff corridor
  [0, 45, 12, 45, 13.2, 'door'], [0, 45, 21, 45, 22.2, 'door'], [0, 44, 28, 44, 33, 'gap'], [0, 42, 36, 43.2, 36, 'door'],   // storage, keg cooler, dock, dock office
  [0, 49, 42, 53, 42, 'gap', 'ext'], [0, 58, 30, 58, 31.2, 'door', 'ext'], [0, 3, 42, 4.2, 42, 'door', 'ext'],   // the dock's open shutter, its side door, the fire exit
  [1, 4.2, 0.6, 4.2, 7.4, 'gap'], [1, 10, 2, 10, 6, 'gap'], [1, 10, 8, 40, 8, 'gap'], [1, 0, 8, 10, 8, 'gap'], [1, 0, 13, 40, 13, 'gap'],   // landing, lounge, balcony open over the hall
  [1, 40, 2, 40, 3.2, 'door'], [1, 45, 4, 45, 5.2, 'door'], [1, 45, 10.6, 45, 11.8, 'door'],                // lounge to the offices; manager's office; security
];
export const GLASS = [[0, 18, 0, 26.4, 0], [0, 31.6, 0, 40, 0]];   // the lobby's glass front either side of the doors

// [floor, x0, z0, x1, z1, height, kind, face]
const F = [];
// the hall: the stage and the DJ's booth on it, speaker stacks, the long bar down the west wall with its back bar, booths and
// tables along the east, high tables round the floor
F.push([0, STAGE.x0, STAGE.z0, STAGE.x1, STAGE.z1, STAGE.h, 'stage', '-z'], [0, DJ.x - 1.6, DJ.z - 1.2, DJ.x + 1.6, DJ.z - 0.4, STAGE.h + 1.1, 'djbooth', '-z']);
for (const x of [6, 32]) F.push([0, x, 27.6, x + 2, 29.4, 3.2, 'speaker', '-z']);
F.push([0, 1.2, 12, 3.2, 26, 1.1, 'clubbar', '+x'], [0, 0.1, 11.5, 0.7, 26.5, 2.4, 'backbar', '+x']);
for (let z = 13; z <= 25; z += 1.4) F.push([0, 3.6, z - 0.22, 4.04, z + 0.22, 0.78, 'stool']);
for (const z of [10, 14.5, 19, 23.5]) F.push([0, 37.6, z, 39.9, z + 3.6, 1.0, 'booth', '-x'], [0, 35.4, z + 1, 36.8, z + 2.6, 0.72, 'table']);
for (const [x, z] of [[8, 11], [16, 11], [24, 11.2], [32, 11]]) F.push([0, x - 0.4, z - 0.4, x + 0.4, z + 0.4, 1.1, 'hightable']);
// the dancers: each a column you go round (the scenery draws them dancing; see stadium-crowd's sister, club-crowd.js)
let seed = 3; const rr = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
export const DANCERS = [];
for (let z = FLOOR.z0 + 0.8; z < FLOOR.z1 - 0.4; z += 1.25) for (let x = FLOOR.x0 + 0.7; x < FLOOR.x1 - 0.4; x += 1.25) {
  if (Math.abs(x - 20) < 1.3 || Math.abs(z - 19.5) < 0.7) continue;                     // two lanes kept clear: up the middle and across
  if (x > STEPS.x0 - 0.9 && x < STEPS.x1 + 0.9 && z > STEPS.z0 - 1.2) continue;        // and the foot of the stage steps
  if (rr() < 0.42) continue;
  DANCERS.push([+(x + (rr() - 0.5) * 0.6).toFixed(2), +(z + (rr() - 0.5) * 0.6).toFixed(2), +((rr() - 0.5) * 1.8).toFixed(2)]);   // [x, z, facing (0 = +z, the stage)]
}
for (const [x, z] of DANCERS) F.push([0, x - 0.22, z - 0.22, x + 0.22, z + 0.22, 1.7, 'dancer']);
// lobby, coat check, box office, restrooms
F.push([0, 10.3, 5.6, 17.7, 6.4, 1.05, 'counter', '-z'], [0, 10.2, 0.3, 17.8, 0.9, 1.9, 'rack', '+z'], [0, 49, 0.3, 57, 1.1, 1.05, 'counter', '+z'], [0, 54, 6.8, 57.7, 7.7, 0.76, 'desk', '-z']);
F.push([0, 47.2, 0.3, 47.9, 3.6, 0.9, 'counter', '-x'], [0, 47.2, 4.4, 47.9, 7.7, 0.9, 'counter', '-x']);   // the restrooms' basins
for (const x of [22, 36]) F.push([0, x - 1.2, 2, x + 1.2, 3, 0.8, 'sofa', '+z']);
// backstage: dressing tables and mirrors, the green room's sofas and drinks, production's flight cases
for (const [x, x1] of [[0.3, 2.8], [7.3, 13.7]]) F.push([0, x, 40.6, x1, 41.6, 0.8, 'mirrordesk', '-z'], [0, x + 0.3, 36.3, x + 1.0, 39, 1.9, 'locker', '+x']);   // the first stops short of the fire exit
F.push([0, 16, 40.7, 22, 41.7, 0.8, 'sofa', '-z'], [0, 23, 40.7, 29, 41.7, 0.8, 'sofa', '-z'], [0, 18, 38.4, 21, 39.4, 0.42, 'table'], [0, 24, 38.4, 27, 39.4, 0.42, 'table'], [0, 14.3, 37, 15.1, 40, 1.05, 'counter', '+x']);
F.push([0, 31, 37, 33, 38.4, 1.1, 'case'], [0, 34, 37, 36, 38.4, 1.1, 'case'], [0, 31, 40, 34, 41.6, 1.4, 'case'], [0, 37, 38, 39.6, 41.6, 1.9, 'shelf', '-x']);
// storage, keg cooler, dock, dock office
F.push([0, 50.6, 8.3, 57.7, 9.0, 2.2, 'shelf', '+z'], [0, 46, 12, 52, 13.2, 1.8, 'shelf', '+z'], [0, 46, 15.5, 52, 16.7, 1.8, 'shelf', '+z'], [0, 54, 11, 56, 13, 1.1, 'crate'], [0, 54.5, 15, 57, 17, 0.9, 'crate']);
for (const z of [19, 21.5, 24]) F.push([0, 46, z, 47.6, z + 1.6, 1.0, 'keg'], [0, 49.4, z, 51, z + 1.6, 1.0, 'keg']);
F.push([0, 46, 31, 49, 33, 1.4, 'crate'], [0, 53, 34, 57, 36.5, 1.8, 'case'], [0, 54, 27, 57.6, 28.6, 1.2, 'crate'], [0, 40.3, 39.4, 41.2, 41.7, 1.9, 'cabinet', '+x'], [0, 42, 40.8, 43.8, 41.7, 0.76, 'desk', '-z']);
// upstairs: the VIP lounge (sofas, a small bar), the balcony's tables at its rail; the manager's office (desk, safe), the security room (CCTV desk)
for (const x of [14, 22, 30]) F.push([1, x - 1.5, 1, x + 1.5, 2, 0.8, 'sofa', '+z'], [1, x - 0.7, 3, x + 0.7, 3.8, 0.42, 'table']);
F.push([1, 36, 0.3, 39.7, 1.1, 1.05, 'counter', '+z']);
for (const x of [5, 12, 19, 26, 33]) F.push([1, x - 0.45, 11.6, x + 0.45, 12.4, 1.1, 'hightable']);
F.push([1, 49, 6, 53, 7.2, 0.76, 'desk', '-z'], [1, 56.6, 1, 57.7, 2.2, 1.2, 'safe', '-x'], [1, 45.3, 0.3, 46.1, 4, 1.9, 'cabinet', '+x'], [1, 50, 1.5, 54, 2.5, 0.8, 'sofa', '+z']);
F.push([1, 54, 10.3, 57.7, 11.3, 0.76, 'cctv', '+z'], [1, 47, 18.6, 52, 19.6, 1.9, 'rack', '-z']);
export const FURNITURE = F;

export const SUSPECT_SPOTS = [
  // upstairs
  [1, 48, 4], [1, 55, 7], [1, 49, 14], [1, 55, 17], [1, 42.5, 5], [1, 42.5, 10], [1, 16, 5], [1, 30, 6], [1, 8, 10.5], [1, 28, 10.5], [1, 6, 4],
  // back of house
  [0, 3, 38.5], [0, 10, 38.5], [0, 18, 37.5], [0, 27, 37.5], [0, 36, 39.5], [0, 20, 35], [0, 42.5, 28], [0, 42.5, 14], [0, 50, 10.5], [0, 55, 14],
  [0, 48, 22.5], [0, 50, 29], [0, 55, 32], [0, 47, 38], [0, 42, 39],
  // front of house and the hall's edges (where a gunman would stand to watch the room)
  [0, 14, 3], [0, 52, 6], [0, 38, 6], [0, 5, 30], [0, 36, 30], [0, 34, 9.5],
];
export const CIV_SPOTS = [[0, 2.5, 39], [0, 9.5, 39.5], [0, 17, 38], [0, 25, 38], [0, 28, 40], [0, 33, 39], [0, 49, 25], [0, 55, 30], [0, 52, 15], [1, 52, 3], [1, 48, 17], [1, 25, 3]];
export const CIV_MUST = [[0, 21, 39.6]];                            // the headliner's crew, held in the green room
export const BOMB_SPOTS = [[0, 4, 41.1, 0.8], [0, 11, 41.1, 0.8], [0, 32, 37.7, 1.1], [0, 47, 32, 1.4], [0, 55, 12, 1.1], [0, 53, 0.7, 1.05], [1, 51, 6.6, 0.76], [1, 37.8, 0.7, 1.05], [0, 14.7, 38.5, 1.05]];
export const BOMB_MUST = [0, 20, 30.6, STAGE.h + 1.1];             // one always in the DJ booth, under the decks
export const HVTS = [{ at: [1, 51, 4.5], guards: [[1, 47, 8], [1, 56, 4]], flee: [0, 51, 39], name: 'PROMOTER' }];

// ---- shape helpers ----
export const inFoot = (x, z) => x >= FOOT.x0 && x <= FOOT.x1 && z >= FOOT.z0 && z <= FOOT.z1;
export const inUpper = (x, z) => UPPER.some(u => x >= u.x0 && x <= u.x1 && z >= u.z0 && z <= u.z1);
export const inHall = (x, z) => x > HALL.x0 && x < HALL.x1 && z > HALL.z0 && z < HALL.z1;
export const stairOf = (x, z) => STAIRS.find(s => x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1);
const stairT = (s, z) => (s.z1 - z) / (s.z1 - s.z0);
const stairUp = (s, z) => Math.min(1, stairT(s, z) / 0.85) * H;   // the flight; its top 15% is the landing upstairs
export const onStage = (x, z) => x > STAGE.x0 && x < STAGE.x1 && z > STAGE.z0 && z < STAGE.z1;
export const onSteps = (x, z) => x > STEPS.x0 && x < STEPS.x1 && z > STEPS.z0 && z < STEPS.z1;
const stepsY = z => Math.min(STAGE.h, Math.max(0, Math.ceil((z - STEPS.z0) / (STEPS.z1 - STEPS.z0) * 5 - 0.001) * STAGE.h / 5));   // five risers of 0.2
// Every walkable surface over (x, z) as [height, nav layer].
function surfaces(x, z) {
  if (onStage(x, z)) return [[STAGE.h, 0]];
  if (onSteps(x, z)) return [[stepsY(z), 0]];
  const s = stairOf(x, z); if (s) return stairT(s, z) > 0.85 ? [[0, 0], [H, 1]] : [[stairUp(s, z), 0]];
  if (inUpper(x, z) && !(inHall(x, z) && z > BALC.z1)) return [[0, 0], [H, 1]];
  return [[0, 0]];
}
// slabs: the upstairs floor (not over the stairs' flights), the one-storey roofs at H, the hall's and the upstairs' roof at 2H
const slabAt = (y, x, z) => {
  if (!inFoot(x, z)) return false;
  const s = stairOf(x, z);
  if (y === H) return (inUpper(x, z) && !(inHall(x, z) && z > BALC.z1) && !(s && stairT(s, z) <= 0.85)) || (!inHall(x, z) && !inUpper(x, z));
  if (y === 2 * H) return inHall(x, z) || inUpper(x, z);
  return false;
};
const SLABS = [0, H, 2 * H];
function floorRay(ox, oy, oz, dx, dy, dz, best) {
  if (Math.abs(dy) > 1e-9) for (const py of SLABS) { const t = (py - oy) / dy; if (t <= 1e-6 || t >= best) continue; const x = ox + dx * t, z = oz + dz * t; if (py === 0 || slabAt(py, x, z)) best = t; }
  return best;
}
function solidFloor(x, y, z) { if (y < 0) return true; for (const py of SLABS) if (py > 0 && y < py + 0.02 && y > py - 0.25 && slabAt(py, x, z)) return true; return false; }
function floorAt(x, z, y) {
  if (stairOf(x, z)) return 'concrete'; if (!inFoot(x, z)) return 'concrete';
  const f = y > H - 1 ? 1 : 0; for (const r of ROOMS) if (r[0] === f && x >= r[2] && x <= r[4] && z >= r[3] && z <= r[5]) return r[6] === 'oak' ? 'wood' : /carpet/.test(r[6]) ? 'carpet' : 'concrete';
  return 'concrete';
}
// Solids that are not room walls: the balcony's rail over the hall, the stairs' side walls, the van, the lot's kerbs and the
// fences that close the site off (the west side and the far end of the rear alley), the dumpsters
function extra({ boxes }) {
  const box = (kind, x0, x1, y0, y1, z0, z1, o = {}) => boxes.push(Object.assign({ f: 0, kind, x0, x1, y0, y1, z0, z1 }, o));
  box('fence', BALC.x0, BALC.x1, H, H + 1.05, BALC.z1 - 0.05, BALC.z1 + 0.05, { sub: 'glassrail', f: 1 });
  // round the stairs' wells upstairs: every open side but the top, where the flight's landing meets the floor (left open to walk off)
  for (const st of STAIRS) {
    const top = st.z0 + (st.z1 - st.z0) * 0.15, rail = (x0, x1, z0, z1) => box('fence', x0, x1, H, H + 1.05, z0, z1, { sub: 'glassrail', f: 1 });
    const roomUp = (x, z) => ROOMS.find(r => r[0] === 1 && x > r[2] && x < r[4] && z > r[3] && z < r[5]), here = roomUp((st.x0 + st.x1) / 2, (top + st.z1) / 2);
    const open = (x, z) => inUpper(x, z) && roomUp(x, z) === here;   // floor upstairs beside the well, in the same room (not through a wall)
    if (open(st.x0 - 0.3, (top + st.z1) / 2)) rail(st.x0 - 0.08, st.x0, top, st.z1 + 0.08);
    if (open(st.x1 + 0.3, (top + st.z1) / 2)) rail(st.x1, st.x1 + 0.08, top, st.z1 + 0.08);
    if (open((st.x0 + st.x1) / 2, st.z1 + 0.3)) rail(st.x0 - 0.08, st.x1 + 0.08, st.z1, st.z1 + 0.08);
  }
  for (const x of [STEPS.x0 - 0.08, STEPS.x1]) box('fence', x, x + 0.08, 0, STAGE.h + 0.9, STEPS.z0 + 0.3, STEPS.z1, { sub: 'steprail' });   // the steps' handrails
  const v = VAN; box('van', v.x - 1.05, v.x + 1.05, 0, 2.6, v.z - 2.9, v.z + 2.9);
  box('fence', -1, -0.9, 0, 2.4, -34, 48, { sub: 'wall' }); box('fence', 58, 64, 0, 2.4, 47.9, 48, { sub: 'wall' }); box('fence', -1, 58, 0, 2.4, 47.9, 48, { sub: 'wall' });
  box('fence', 63.9, 64, 0, 2.4, -34, 48, { sub: 'wall' });
  for (const x of [36, 39]) box('dumpster', x, x + 2, 0, 1.4, 43, 44.4);
  box('dumpster', 60, 62, 0, 1.4, 20, 22);
}
const yAt = (f) => f * H;
export default {
  id: 'club', name: 'CLUB', op: 'Operation LAST DANCE', test: true, H, DOOR_H, YARD, layers: 2, layerFloor: [0, 1], maxDrop: 1.2, tods: ['night'],
  spawn: SPAWN, exit: EXIT, breaker: BREAKER, cars: [], parked: [], rooms: ROOMS, openings: OPENINGS, glass: GLASS, furniture: FURNITURE,
  spots: { s: SUSPECT_SPOTS, c: CIV_SPOTS, b: BOMB_SPOTS }, hvts: HVTS, veg: null, counts: { s: 16, c: 8, b: 3 }, time: 1080, patrolMax: 14,
  stairs: STAIRS.map(s => ({ ...s, yb: 0, n: 1 })), foot: FOOT, bombMust: BOMB_MUST, civMust: CIV_MUST, yAt,
  lobby: { x: 29, y: 1.5, z: -21.5, tx: 29, tz: -17 },
  brief: ['A crew holds the back of the Halcyon club during a live set: 8 hostages, 3 bombs, the promoter who let them in.', 'The hall is packed and still dancing: nobody out there knows. Do not start a panic you cannot stop.',
    'Front doors from the lot, or round the side alley to the loading dock and the fire exit for a quiet way in.', 'The promoter is in his office upstairs. One bomb is in the DJ booth.'],
  surfaces, floorRay, solidFloor, terrainY: () => 0, floorAt, extra,
  indoor: (f, x, z) => inFoot(x, z), onStairs: (x, z) => { const s = stairOf(x, z); return !!s && stairT(s, z) <= 0.85; },
  inside: (x, z, y) => inFoot(x, z) && y < 2 * H, objective: (x, z) => inFoot(x, z),
  roofY: (x, z) => !inFoot(x, z) ? 0 : (inHall(x, z) || inUpper(x, z)) ? 2 * H + 0.3 : H + 0.3,
  hint: 'Lights out: MAIN BREAKER in the storage room. The music stays on: the sound system has its own supply.',
};
