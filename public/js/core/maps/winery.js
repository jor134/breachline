// WINERY: Operation VENDIMIA at Bodega Novena, an invented winery in the vineyards of Luján de Cuyo, Mendoza, during its sunset
// party on the roof terrace. The building follows the Mendoza wineries of dry-stone (pirca) walls: a long low block running
// east-west across the vines, two tall stone wings (production) either side of a lower ochre-concrete centre (the visitor centre
// below, the roof terrace and the glass restaurant with its corten band above). Two open stairs climb the north front either side
// of the entrance to the terrace. A crew has taken the building; up on the terrace the party goes on (the music is too loud).
// The squad's van comes up the long dirt drive through the vines from the north.
// Generic engine: ../level.js. Frame: x east along the front, z south (away from the drive; the Andes on the far side).
//
// Heights (H = 4.5): ground 0, upstairs 1 (4.5). The fermentation hall (west wing) is two storeys tall, with a steel gallery across
// its front upstairs. The centre is one storey: its roof is the terrace. Nav layers: 0 ground (and every flight), 1 upstairs.
import { park, carBox } from './cars.js';
export const H = 4.5, DOOR_H = 2.2;
export const FOOT = { x0: 0, x1: 84, z0: 0, z1: 34 };
export const WEST = { x0: 0, x1: 26 }, EAST = { x0: 58, x1: 84 };   // the stone wings (two storeys); the centre between them
export const TERR = { x0: 26, x1: 58, z0: 0, z1: 34 };              // the roof terrace, at H
export const PAV = { x0: 31, x1: 55, z0: 3, z1: 13 };               // the restaurant pavilion on it (restaurant + kitchen)
export const VOID = { x0: 0, x1: 26, z0: 13, z1: 34 };              // the fermentation hall's upper half (open)
export const STAIRS = [{ x0: 21.5, x1: 24.5, z0: 0.8, z1: 8.2 }, { x0: 59.5, x1: 62.5, z0: 0.8, z1: 9.2 }];   // inside the wings; climb toward -z (the west one a metre shorter and a touch steeper, ~36°: 1.5 m clear at its foot before the wall)
// the open stairs up the front: each flight runs along the facade, rising away from the entrance (up: the way it climbs), to a
// landing beside the wing that steps onto the terrace
export const FLIGHTS = [{ x0: 29, x1: 38, z0: -2.8, z1: -0.1, up: -1 }, { x0: 46, x1: 55, z0: -2.8, z1: -0.1, up: 1 }];
export const LANDINGS = [{ x0: 26.2, x1: 29, z0: -2.8, z1: 0 }, { x0: 55, x1: 57.8, z0: -2.8, z1: 0 }];
export const YARD = { x0: -36, z0: -70, x1: 120, z1: 72 };
export const DRIVE = { x0: 39, x1: 45 };                             // the dirt drive through the vines, north to the plaza
export const PLAZA = { x0: -14, x1: 98, z0: -18, z1: 50 };           // the dry plaza and yard round the building (no vines)
export const VAN = { x: 42, z: -32, turn: 0 };                       // nose to the winery
export const SPAWN = [[40.2, -36.2], [41.4, -36.6], [42.6, -36.6], [43.8, -36.2]];
export const EXIT = { x0: 38, x1: 46, z0: -40, z1: -27 };             // back at the van
export const BREAKER = { x: 83.87, y: 1.4, z: 12 };                  // in the case store, on the east wall
export const DJ = { x: 42, z: 33.05, face: Math.PI };                // the DJ behind her decks at the terrace's south rail, facing the party (-z)
// the guests' cars, nose in on the plaza either side of the drive
const BAYS = []; for (let k = 0; k < 34; k++) { const x = 1.5 + 2.7 * k; if (x > 34 && x < 50) continue; if (x < 82) BAYS.push([x, -10.2, 0]); }
export const PARKED = park(BAYS.filter((b, i) => (i * 5 + 2) % 7 > 1), 2);

// [floor, name, x0, z0, x1, z1, floor finish]
export const ROOMS = [
  // the west wing: grape reception, the lab, the stairs; the fermentation hall (two storeys) behind
  [0, 'Crush hall', 0, 0, 12, 10, 'concrete'], [0, 'Laboratory', 12, 0, 20, 10, 'labtile'], [0, 'West stairs', 20, 0, 26, 10, 'concrete'],
  [0, 'Fermentation hall', 0, 10, 26, 34, 'concrete'],
  // the centre: the visitor centre along the front, the gallery (the line between visitors and production), the barrel cellar
  [0, 'Wine shop', 26, 0, 36, 10, 'stoneF'], [0, 'Reception', 36, 0, 48, 10, 'stoneF'], [0, 'Tasting room', 48, 0, 58, 10, 'oak'],
  [0, 'Gallery', 26, 10, 58, 13, 'stoneF'], [0, 'Barrel cellar', 26, 13, 58, 34, 'cellar'],
  // the east wing: stairs, the case store (loading dock), the bottling hall
  [0, 'East stairs', 58, 0, 64, 14, 'concrete'], [0, 'Case store', 64, 0, 84, 14, 'concrete'], [0, 'Bottling hall', 58, 14, 84, 34, 'epoxy'],
  // upstairs, west: the winemaker's office, the sample room, the landing; the tank gallery over the fermentation hall
  [1, "Winemaker's office", 0, 0, 10, 10, 'oak'], [1, 'Sample room', 10, 0, 20, 10, 'labtile'], [1, 'West landing', 20, 0, 26, 10, 'concrete'],
  [1, 'Tank gallery', 0, 10, 26, 13, 'steelfloor'], [1, 'hall', 0, 13, 26, 34, 'void'],
  // upstairs, centre: the restaurant pavilion on the terrace
  [1, 'Restaurant', 31, 3, 49, 13, 'oak'], [1, 'Kitchen', 49, 3, 55, 13, 'tileK'],
  // upstairs, east: the landing, the offices, the corridor, the boardroom and the private cellar
  [1, 'East landing', 58, 0, 64, 14, 'concrete'], [1, 'Admin office', 64, 0, 74, 14, 'carpetG'], [1, "Director's office", 74, 0, 84, 14, 'oak'],
  [1, 'Upper corridor', 58, 14, 84, 17, 'carpetG'], [1, 'Boardroom', 58, 17, 72, 34, 'carpetG'], [1, 'Private cellar', 72, 17, 84, 34, 'oak'],
];
// [floor, x0, z0, x1, z1, kind, 'ext' | 'hidden']
export const OPENINGS = [
  // front: the entrance's two doors; the crush pad's open shutter (west); the fermentation hall's side and back doors
  [0, 40.4, 0, 41.6, 0, 'door', 'ext'], [0, 42.4, 0, 43.6, 0, 'door', 'ext'], [0, 0, 3, 0, 7, 'gap', 'ext'], [0, 0, 26, 0, 27.2, 'door', 'ext'], [0, 12, 34, 13.2, 34, 'door', 'ext'],
  // the west wing inside
  [0, 12, 4, 12, 5.2, 'door'], [0, 20, 4, 20, 5.2, 'door'], [0, 4, 10, 8, 10, 'gap'], [0, 15, 10, 16.2, 10, 'door'], [0, 20.6, 10, 21.8, 10, 'door'],
  // the visitor centre: shop and tasting room open off reception; reception to the gallery; the shop's and tasting room's doors to it
  [0, 36, 3, 36, 7, 'gap'], [0, 48, 3, 48, 7, 'gap'], [0, 39, 10, 45, 10, 'gap'], [0, 30, 10, 31.2, 10, 'door'], [0, 53, 10, 54.2, 10, 'door'],
  // the gallery: to the fermentation hall, to the east stairs, through its glass wall into the cellar; the production line runs
  // west to east through the cellar (fermentation, ageing, bottling); the cellar's back door
  [0, 26, 11, 26, 12.2, 'door'], [0, 58, 11, 58, 12.2, 'door'], [0, 41.4, 13, 42.6, 13, 'door'], [0, 26, 22, 26, 25, 'gap'], [0, 58, 22, 58, 25, 'gap'], [0, 40, 34, 41.2, 34, 'door', 'ext'],
  // the east wing: the stairs to the case store and the bottling hall; the forklift way between them; the loading dock; the bottling hall's doors out
  [0, 64, 4, 64, 5.2, 'door'], [0, 60, 14, 61.2, 14, 'door'], [0, 70, 14, 74, 14, 'gap'], [0, 84, 4, 84, 9, 'gap', 'ext'], [0, 84, 26, 84, 27.2, 'door', 'ext'], [0, 70, 34, 71.2, 34, 'door', 'ext'],
  // upstairs, west: office, sample room, landing; the office and the landing onto the tank gallery; the landing out onto the terrace
  [1, 10, 4, 10, 5.2, 'door'], [1, 20, 4, 20, 5.2, 'door'], [1, 4, 10, 5.2, 10, 'door'], [1, 24.6, 10, 25.8, 10, 'door'], [1, 0, 13, 26, 13, 'gap'], [1, 26, 4, 26, 5.2, 'door', 'ext'],
  // the pavilion: the restaurant's doors front and back (in its glass), to the kitchen; the kitchen's to the terrace and its service door
  [1, 39.4, 3, 40.6, 3, 'door', 'ext'], [1, 39.4, 13, 40.6, 13, 'door', 'ext'], [1, 49, 9, 49, 10.2, 'door'], [1, 52, 13, 53.2, 13, 'door', 'ext'], [1, 55, 5, 55, 6.2, 'door', 'ext'],
  // upstairs, east: the landing from the terrace, to the offices and the corridor; the corridor to the boardroom and the private cellar
  [1, 58, 11, 58, 12.2, 'door', 'ext'], [1, 64, 4, 64, 5.2, 'door'], [1, 74, 4, 74, 5.2, 'door'], [1, 62.6, 14, 63.8, 14, 'door'], [1, 64, 17, 65.2, 17, 'door'], [1, 77, 17, 78.2, 17, 'door'],
];
export const GLASS = [
  [0, 38.5, 0, 40.4, 0], [0, 43.6, 0, 45.5, 0],                         // the entrance's glass either side of the doors
  [0, 26, 13, 41.4, 13], [0, 42.6, 13, 58, 13],                         // the gallery's glass wall onto the cellar
  [0, 58, 18, 58, 21], [0, 58, 26, 58, 30],                             // into the bottling hall from the cellar
  [1, 31, 3, 39.4, 3], [1, 40.6, 3, 49, 3], [1, 31, 13, 39.4, 13], [1, 40.6, 13, 49, 13], [1, 31, 3, 31, 13],   // the restaurant, glass all round
  [0, 84, 18, 84, 23], [0, 84, 29, 84, 33],                             // the south face's big windows (the bottling hall's east end)
];

// [floor, x0, z0, x1, z1, height, kind, face]
const F = [];
// the west wing: the destemmer, sorting table and grape bins; lab benches; the steel tanks in rows; a pump
F.push([0, 5, 1, 9, 3, 1.8, 'destemmer', '+z'], [0, 6, 5, 10.5, 6, 0.9, 'sorttable', '+z'], [0, 1, 8, 2.4, 9.4, 0.8, 'bin'], [0, 2.8, 8, 4.2, 9.4, 0.8, 'bin'], [0, 9.6, 8, 11, 9.4, 0.8, 'bin']);
F.push([0, 12.3, 0.3, 19.7, 1.1, 0.92, 'labbench', '+z'], [0, 14, 4.5, 18, 5.7, 0.92, 'labbench', '+z'], [0, 19.2, 6.5, 19.8, 9.5, 1.9, 'cabinet', '-x']);
for (const x of [3, 8, 13, 18]) for (const z of [16, 22, 28]) F.push([0, x - 1.3, z - 1.3, x + 1.3, z + 1.3, 6.2, 'tank']);
F.push([0, 21, 30, 22.4, 31.4, 1.0, 'pump']);
// the visitor centre: the shop's racks and table and till; reception's desk and sofas; the tasting room's table, back counter and racks
F.push([0, 26.2, 0.5, 26.8, 9.5, 2.2, 'wineshelf', '+x'], [0, 27, 0.2, 35.5, 0.8, 2.2, 'wineshelf', '+z'], [0, 29.5, 4, 32.5, 5.5, 0.9, 'display'], [0, 32, 8, 35.5, 9, 1.05, 'counter', '-z']);
F.push([0, 40, 6, 44, 7, 1.1, 'counter', '-z'], [0, 37, 1, 37.8, 4, 0.8, 'sofa', '+x'], [0, 46.2, 1, 47, 4, 0.8, 'sofa', '-x']);
F.push([0, 50, 3.5, 56, 5.5, 0.76, 'ttable'], [0, 57.2, 1, 57.8, 9, 1.05, 'counter', '-x'], [0, 49, 0.2, 57, 0.7, 2.2, 'wineshelf', '+z']);
// the barrel cellar: racks of barrels two high either side of the middle aisle, an aisle across for the production line; barrel tables
for (const z of [14.6, 17.6, 26.6, 29.6, 32.4]) for (const [x0, x1] of [[27.5, 39.6], [44.4, 56.5]]) F.push([0, x0, z, x1, z + 1.2, 1.9, 'barrels', '+z']);
F.push([0, 41.5, 19, 42.5, 20, 1.0, 'barreltable'], [0, 41.5, 28, 42.5, 29, 1.0, 'barreltable']);
// the east wing: pallets of cases in the store; the bottling line (conveyor, filler, labeller), finished pallets
for (const x of [66, 68.6, 76, 78.6]) for (const z of [1, 2.6, 10.6, 12.2]) F.push([0, x, z, x + 1.2, z + 1.2, 1.6, 'pallet']);
F.push([0, 61, 21.5, 81, 22.5, 1.0, 'conveyor', '+z'], [0, 64, 20.6, 67, 23.4, 2.0, 'filler', '+z'], [0, 72, 20.8, 74, 23.2, 1.6, 'filler', '+z']);
for (const x of [61, 63, 77, 79]) F.push([0, x, 28, x + 1.2, 29.2, 1.4, 'pallet']);
F.push([0, 81.5, 15, 83.7, 17, 1.9, 'cabinet', '-x']);
// upstairs west: the winemaker's desk and books; the sample room's bench, racks and table
F.push([1, 3, 6, 6, 7, 0.76, 'desk', '-z'], [1, 0.2, 1, 0.8, 8, 2.0, 'shelf', '+x'], [1, 10.3, 0.3, 19.7, 1.0, 0.92, 'labbench', '+z'], [1, 19.3, 6, 19.8, 9.6, 2.0, 'wineshelf', '-x'], [1, 13, 5, 17, 6.2, 0.76, 'ttable']);
// the restaurant (tables laid for dinner, a lane down the middle between its doors), the kitchen
for (const x of [33.5, 36.7, 43.3, 46.5]) for (const z of [5.4, 10.6]) F.push([1, x - 0.9, z - 0.9, x + 0.9, z + 0.9, 0.76, 'dtable']);
F.push([1, 49.2, 3.2, 54.8, 3.9, 0.92, 'counter', '+z'], [1, 51, 6.5, 53, 9.5, 0.92, 'stove'], [1, 54.3, 8, 54.9, 12.5, 1.9, 'shelf', '-x']);
// upstairs east: the admin office's desks, the director's desk, safe, sofa, books; the boardroom; the private cellar's racks and table
for (const [x, z] of [[66, 2], [70, 2], [66, 8], [70, 8]]) F.push([1, x, z, x + 2.5, z + 1, 0.76, 'desk', '+z']);
F.push([1, 64.2, 10, 64.8, 13.6, 1.9, 'cabinet', '+x'], [1, 78, 6, 81.5, 7.2, 0.76, 'desk', '-z'], [1, 83, 1, 83.8, 2, 1.2, 'safe', '-x'], [1, 76, 11.8, 80, 12.8, 0.8, 'sofa', '-z'], [1, 83.2, 4, 83.8, 10, 2.0, 'shelf', '-x']);
F.push([1, 61, 23, 69, 27, 0.76, 'boardtable'], [1, 58.2, 30, 58.8, 33, 1.0, 'cabinet', '+x']);
F.push([1, 72.2, 19, 72.8, 33, 2.2, 'wineshelf', '+x'], [1, 83.2, 19, 83.8, 33, 2.2, 'wineshelf', '-x'], [1, 75, 33.2, 81, 33.8, 2.2, 'wineshelf', '-z'], [1, 76, 24, 80, 26, 0.76, 'ttable']);
// the terrace: the DJ's decks and speakers at the south rail, the bar along the west wing, lounge sofas along the east, high tables
// along the restaurant's front, planters along the north parapet
F.push([1, 40.4, 31.6, 43.6, 32.6, 1.1, 'djbooth', '-z'], [1, 38.2, 31.8, 39.4, 32.8, 1.6, 'tspeaker', '-z'], [1, 44.6, 31.8, 45.8, 32.8, 1.6, 'tspeaker', '-z']);
F.push([1, 26.6, 15, 27.8, 25, 1.1, 'tbar', '+x']);
for (let z = 15.6; z < 25; z += 1.2) F.push([1, 28.0, z - 0.22, 28.44, z + 0.22, 0.78, 'stool']);
for (const z of [16, 21, 26]) F.push([1, 56.6, z, 57.6, z + 3, 0.75, 'lounge', '-x'], [1, 55, z + 1, 56, z + 2, 0.4, 'ltable']);
for (const x of [30, 36, 47, 54]) F.push([1, x - 0.4, 14.1, x + 0.4, 14.9, 1.1, 'hightable']);
for (const x of [31.5, 37, 47, 52.5]) F.push([1, x - 0.5, 0.35, x + 0.5, 1.35, 0.9, 'planter']);
export const FURNITURE = F;

export const SUSPECT_SPOTS = [
  // ground: the west wing, the visitor centre, the cellar, the east wing
  [0, 10.5, 3.5], [0, 16, 7.5], [0, 25, 5], [0, 10.5, 19], [0, 15.5, 25], [0, 22, 31], [0, 5.5, 32], [0, 30, 7], [0, 46, 8.5], [0, 53, 7], [0, 50, 11.5],
  [0, 34, 23.5], [0, 50, 23.5], [0, 42, 31], [0, 30, 31.6], [0, 53, 16.4], [0, 63, 12], [0, 72, 6], [0, 82, 12], [0, 64, 17], [0, 78, 18], [0, 70, 30], [0, 82, 31],
  // upstairs
  [1, 7, 3], [1, 15, 8.5], [1, 12, 11.5], [1, 22, 11.5], [1, 63, 12.5], [1, 69, 6], [1, 70, 15.5], [1, 62, 20], [1, 70, 31], [1, 78, 21], [1, 52, 11.5], [1, 41, 8],
  // on the terrace, at its edges, watching the party
  [1, 28.5, 28], [1, 29, 9], [1, 56.5, 7], [1, 30, 33], [1, 54, 33],
];
export const CIV_SPOTS = [[0, 3, 5], [0, 13.5, 8], [0, 10.5, 25], [0, 34, 20.5], [0, 50, 20.5], [0, 55, 8], [0, 74, 10], [0, 62, 31], [1, 2, 8], [1, 12, 8], [1, 72, 12], [1, 66, 31], [1, 80, 30], [1, 50.5, 11.5], [1, 35, 8]];
export const CIV_MUST = [[0, 42, 23.5]];                             // the winemaker, held in the middle of the cellar
export const BOMB_SPOTS = [[0, 7, 2, 1.8], [0, 15, 0.7, 0.92], [0, 75, 22, 1.0], [0, 66.6, 1.6, 1.6], [0, 34, 8.5, 1.05], [0, 42, 19.5, 1.0], [0, 42, 28.5, 1.0], [1, 78, 25, 0.76], [1, 52, 8, 0.92], [1, 65, 25, 0.76], [1, 15, 5.6, 0.76]];
export const BOMB_MUST = [1, 42, 31.2, 0];                           // one always on the floor at the foot of the DJ's decks (on top, the club's DJ stand hid it)
export const HVTS = [{ at: [1, 80, 9], guards: [[1, 76, 4], [1, 82, 12.6]], flee: [0, 71, 31], name: 'ESTATE MANAGER' }];

// the party on the terrace: [x, z, facing (0 = +z, toward the DJ and the Andes), floor], clear of the furniture, the doors and the
// spots where suspects and hostages start, with a lane from the restaurant's back door to the DJ and one across
let seed = 7; const rr = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
export const DANCERS = [];
{ const busy = (x, z) => F.some(q => q[0] === 1 && x > q[1] - 0.55 && x < q[3] + 0.55 && z > q[2] - 0.55 && z < q[4] + 0.55) || Math.hypot(BOMB_MUST[1] - x, BOMB_MUST[2] - z) < 1.1 || [...SUSPECT_SPOTS, ...CIV_SPOTS, ...HVTS.map(h => h.at)].some(p => p[0] === 1 && Math.hypot(p[1] - x, p[2] - z) < 1.3);
  for (let z = 15.8; z < 31; z += 1.25) for (let x = 29.4; x < 55; x += 1.25) {
    if ((x > 39 && x < 41.4) || (z > 22.4 && z < 23.8) || busy(x, z) || rr() < 0.5) continue;
    const px = +(x + (rr() - 0.5) * 0.5).toFixed(2), pz = +(z + (rr() - 0.5) * 0.5).toFixed(2), face = Math.atan2(DJ.x - px, DJ.z - pz) * 0.6 + (rr() - 0.5) * 1.4;
    DANCERS.push([px, pz, +face.toFixed(2), 1]); F.push([1, px - 0.22, pz - 0.22, px + 0.22, pz + 0.22, 1.7, 'dancer']);
  }
}

// ---- shape helpers ----
export const inFoot = (x, z) => x >= FOOT.x0 && x <= FOOT.x1 && z >= FOOT.z0 && z <= FOOT.z1;
export const inWing = (x, z) => inFoot(x, z) && (x <= WEST.x1 || x >= EAST.x0);
export const inPav = (x, z) => x >= PAV.x0 && x <= PAV.x1 && z >= PAV.z0 && z <= PAV.z1;
export const inVoid = (x, z) => x > VOID.x0 && x < VOID.x1 && z > VOID.z0 && z < VOID.z1;
export const onTerrace = (x, z) => x > TERR.x0 && x < TERR.x1 && z > TERR.z0 && z < TERR.z1 && !inPav(x, z);   // open to the sky
export const stairOf = (x, z) => STAIRS.find(s => x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1);
export const flightOf = (x, z) => FLIGHTS.find(s => x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1);
export const onLanding = (x, z) => LANDINGS.some(s => x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1);
export const flightY = (s, x) => H * (s.up < 0 ? (s.x1 - x) : (x - s.x0)) / (s.x1 - s.x0);
const stairT = (s, z) => (s.z1 - z) / (s.z1 - s.z0);
const stairUp = (s, z) => Math.min(1, stairT(s, z) / 0.85) * H;   // the flight; its top 15% is the landing upstairs
// Every walkable surface over (x, z) as [height, nav layer].
function surfaces(x, z) {
  const fl = flightOf(x, z); if (fl) return [[flightY(fl, x), 0]];
  if (onLanding(x, z)) return [[H, 1]];
  const s = stairOf(x, z); if (s) return stairT(s, z) > 0.85 ? [[0, 0], [H, 1]] : [[stairUp(s, z), 0]];
  if (inFoot(x, z)) return inVoid(x, z) ? [[0, 0]] : [[0, 0], [H, 1]];
  return [[0, 0]];
}
// slabs: the upstairs floor and the terrace (not over the fermentation hall or the stairs' flights), the landings; the roofs of the
// wings and the pavilion at 2H
const slabAt = (y, x, z) => {
  if (y === H) { if (onLanding(x, z)) return true; if (!inFoot(x, z) || inVoid(x, z)) return false; const s = stairOf(x, z); return !(s && stairT(s, z) <= 0.85); }
  if (y === 2 * H) return inWing(x, z) || inPav(x, z);
  return false;
};
const SLABS = [0, H, 2 * H];
function floorRay(ox, oy, oz, dx, dy, dz, best) {
  if (Math.abs(dy) > 1e-9) for (const py of SLABS) { const t = (py - oy) / dy; if (t <= 1e-6 || t >= best) continue; const x = ox + dx * t, z = oz + dz * t; if (py === 0 || slabAt(py, x, z)) best = t; }
  return best;
}
function solidFloor(x, y, z) { if (y < 0) return true; for (const py of SLABS) if (py > 0 && y < py + 0.02 && y > py - 0.25 && slabAt(py, x, z)) return true; const fl = flightOf(x, z); return !!fl && y < flightY(fl, x) + 0.02; }
function floorAt(x, z, y) {
  if (stairOf(x, z) || flightOf(x, z) || onLanding(x, z)) return 'concrete';
  if (!inFoot(x, z)) return x > DRIVE.x0 - 0.5 && x < DRIVE.x1 + 0.5 && z < PLAZA.z0 ? 'gravel' : 'gravel';
  const f = y > H - 1 ? 1 : 0; for (const r of ROOMS) if (r[0] === f && x >= r[2] && x <= r[4] && z >= r[3] && z <= r[5]) return r[6] === 'oak' ? 'wood' : /carpet/.test(r[6]) ? 'carpet' : 'concrete';
  return 'concrete';
}
// the vine rows: north-south, 2.5 m apart, broken by lanes across; none on the plaza or the drive
export const ROW_DX = 2.5;
export function vineRows() {
  const out = [], add = (x, z0, z1) => out.push([x, z0, z1]);
  for (let x = YARD.x0 + 1; x < YARD.x1 - 0.5; x += ROW_DX) {
    const plazaX = x > PLAZA.x0 && x < PLAZA.x1;
    if (!(x > DRIVE.x0 - 2 && x < DRIVE.x1 + 2)) for (const [a, b] of [[-69.5, -56], [-53, -39], [-36, PLAZA.z0 - 0.5]]) add(x, a, b);   // north of the plaza
    for (const [a, b] of [[PLAZA.z1 + 0.5, 60], [63, 71.5]]) add(x, a, b);                                                             // south of it
    if (!plazaX) for (const [a, b] of [[PLAZA.z0 + 0.5, 5], [8, 28], [31, PLAZA.z1 - 0.5]]) add(x, a, b);                             // west and east of it
  }
  return out;
}
// Solids that are not room walls: the terrace's parapet and rail, the open stairs' side walls, the gallery rail over the tanks, the
// stair wells' rails, the vines, the parked cars, the van
function extra({ boxes }) {
  const box = (kind, x0, x1, y0, y1, z0, z1, o = {}) => boxes.push(Object.assign({ f: 0, kind, x0, x1, y0, y1, z0, z1 }, o));
  box('fence', LANDINGS[0].x1, LANDINGS[1].x0, H, H + 1.1, -0.15, 0.15, { sub: 'stonepar', f: 1 });     // the terrace's north edge, over the flights
  box('fence', TERR.x0, TERR.x1, H, H + 1.1, 33.92, 34.08, { sub: 'glassrail', f: 1 });                 // its south edge: glass, for the view
  // the open stairs: a wall along each flight's outer side and round its landing, from the ground (nothing gets under them)
  // (stepped like the flight under it, a metre above it: blocky, as the real ones are)
  for (const [fl, ld] of [[FLIGHTS[0], LANDINGS[0]], [FLIGHTS[1], LANDINGS[1]]]) {
    const n = Math.round((fl.x1 - fl.x0) / 1.5), w = (fl.x1 - fl.x0) / n;
    for (let i = 0; i < n; i++) { const a = fl.x0 + i * w, c = a + w, top = Math.max(flightY(fl, a + 0.01), flightY(fl, c - 0.01)) + 1.0; box('fence', a, c, 0, top, -2.95, -2.8, { sub: 'stairwall' }); }
    box('fence', ld.x0 - (fl.up < 0 ? 0.1 : 0), ld.x1 + (fl.up > 0 ? 0.1 : 0), 0, H + 1.1, -2.95, -2.8, { sub: 'stairwall' });
    const ex = fl.up < 0 ? ld.x0 - 0.1 : ld.x1; box('fence', ex, ex + 0.1, 0, H + 1.1, -2.8, -0.1, { sub: 'stairwall' });
  }
  box('fence', VOID.x0 + 0.1, VOID.x1 - 0.1, H, H + 1.05, VOID.z0 - 0.05, VOID.z0 + 0.05, { sub: 'glassrail', f: 1 });   // the tank gallery's rail
  for (const st of STAIRS) {   // round the stairs' wells upstairs: every open side but the top (left open to walk off), in the same room
    const top = st.z0 + (st.z1 - st.z0) * 0.15, rail = (x0, x1, z0, z1) => box('fence', x0, x1, H, H + 1.05, z0, z1, { sub: 'glassrail', f: 1 });
    const roomUp = (x, z) => ROOMS.find(r => r[0] === 1 && x > r[2] && x < r[4] && z > r[3] && z < r[5]), here = roomUp((st.x0 + st.x1) / 2, (top + st.z1) / 2);
    const open = (x, z) => inFoot(x, z) && roomUp(x, z) === here;
    if (open(st.x0 - 0.3, (top + st.z1) / 2)) rail(st.x0 - 0.08, st.x0, top, st.z1 + 0.08);
    if (open(st.x1 + 0.3, (top + st.z1) / 2)) rail(st.x1, st.x1 + 0.08, top, st.z1 + 0.08);
    if (open((st.x0 + st.x1) / 2, st.z1 + 0.3)) rail(st.x0 - 0.08, st.x1 + 0.08, st.z1, st.z1 + 0.08);
  }
  for (const [x, z0, z1] of vineRows()) box('vine', x - 0.2, x + 0.2, 0, 1.7, z0, z1);
  for (const c of PARKED) { const b = carBox(c); box('pcar', b.x0, b.x1, 0, b.h, b.z0, b.z1); }
  const v = VAN; box('van', v.x - 1.05, v.x + 1.05, 0, 2.6, v.z - 2.9, v.z + 2.9);
}
const yAt = (f) => f * H;
export default {
  id: 'winery', name: 'WINERY', op: 'Operation VENDIMIA', test: true, H, DOOR_H, YARD, layers: 2, layerFloor: [0, 1], maxDrop: 1.2, tods: ['dusk', 'night'],
  spawn: SPAWN, exit: EXIT, breaker: BREAKER, cars: [], parked: PARKED, rooms: ROOMS, openings: OPENINGS, glass: GLASS, furniture: FURNITURE,
  spots: { s: SUSPECT_SPOTS, c: CIV_SPOTS, b: BOMB_SPOTS }, hvts: HVTS, veg: null, counts: { s: 18, c: 8, b: 3 }, time: 1200, patrolMax: 16,
  stairs: STAIRS.map(s => ({ ...s, yb: 0, n: 1 })), foot: FOOT, bombMust: BOMB_MUST, civMust: CIV_MUST, yAt,
  lobby: { x: 42, y: 1.5, z: -39, tx: 42, tz: -30 },
  brief: ['A crew holds Bodega Novena during its sunset party: 8 hostages, 3 bombs, the estate manager who let them in.', 'The roof terrace is packed and still dancing: nobody up there knows. Do not start a panic you cannot stop.',
    'Up the drive to the front: the entrance, or the open stairs either side of it to the terrace. Round the sides: the crush pad, the loading dock, the back doors.', 'The estate manager is in his office upstairs in the east wing. One bomb is at the foot of the DJ\'s decks.'],
  surfaces, floorRay, solidFloor, terrainY: () => 0, floorAt, extra,
  onStairs: (x, z) => { if (flightOf(x, z)) return true; const s = stairOf(x, z); return !!s && stairT(s, z) <= 0.85; },
  inside: (x, z, y) => inFoot(x, z) && (y < H - 0.3 || ((inWing(x, z) || inPav(x, z)) && y < 2 * H)), objective: (x, z) => inFoot(x, z) || !!flightOf(x, z) || onLanding(x, z),
  roofY: (x, z) => { const fl = flightOf(x, z); if (fl) return flightY(fl, x); if (onLanding(x, z)) return H; return !inFoot(x, z) ? 0 : (inWing(x, z) || inPav(x, z)) ? 2 * H + 0.3 : H; },
  hint: 'Lights out: MAIN BREAKER in the case store (east wing). The party\'s sound runs off its own generator.',
};
