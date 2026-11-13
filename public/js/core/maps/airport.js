// AIRPORT: Operation TAILWIND. An armed crew holds a regional terminal and a grounded jet in the maintenance hangar.
// Curbside under a timber canopy on branching columns -> double-height departures hall with check-in islands and a glass
// gallery above -> security lanes -> airside concourse with a bar, duty free and gate seating behind a glass wall to the
// apron -> across the apron into a glass-banded hangar where the jet stands on its airstairs. Bomb always in the jet's
// cargo hold. The high-value target waits in the VIP lounge upstairs and runs for the jet when he hears the squad.
// Generic engine: ../level.js.
export const H = 4.6, DOOR_H = 2.1;
export const FOOT = { x0: 0, z0: 0, x1: 64, z1: 56 };
export const UP_Z = 22;                         // the upper floor covers the building from here to the front
export const HALL = { x0: 12, x1: 52, z0: 30, z1: 56 };   // double height: no upper floor over it
export const YARD = { x0: -30, z0: -72, x1: 96, z1: 90 };
export const STAIR = { x0: 1, x1: 2.5, z0: 23, z1: 28.6 };
export const HANGAR = { x0: 6, x1: 58, z0: -66, z1: -24, h: 16, door: [12, 52], doorH: 10 };
// the jet: fuselage along z, nose to the hangar door. Cabin floor at H/2 (floor 0.5), cargo hold floor at HOLD.
export const CAB = H / 2, HOLD = 0.3, HF = HOLD / H;
export const JET = { x0: 30, x1: 34, cx: 32, nose: -26, tail: -60, c0: -52, c1: -31, door: [-32.6, -31.4], hatch: [-47, -45], roof: CAB + 2.1 };
export const AIRSTAIR = { x0: 34.15, x1: 38.15, z0: -32.6, z1: -31.4 };   // down the jet's right side
export const HRAMP = { x0: 28.6, x1: 30.05, z0: -47, z1: -45 };            // short ramp up to the hold door on the left
export const BREAKER = { x: 58, y: 1.4, z: 47.87 };
export const SPAWN = [[28, 73], [29.5, 73], [31, 73], [32.5, 73]];
export const EXIT = { x0: 22, x1: 38, z0: 68, z1: 82 };
export const CANOPY = { x0: -8, x1: 72, z0: 56, z1: 67, y: 9 };
export const TREES = [-2, 10, 22, 34, 46, 58, 70].map(x => [x, 63]);    // branching columns along the kerb

// [floor, name, x0, z0, x1, z1, floor finish]; finish 'void' = no floor (the hall's double height)
export const ROOMS = [
  [0, 'Gate concourse', 0, 0, 64, 12, 'tile'], [0, 'Bar & grill', 0, 12, 18, 22, 'wood'], [0, 'Airside hall', 18, 12, 46, 22, 'tile'], [0, 'Duty free', 46, 12, 64, 22, 'tile'],
  [0, 'Staff stairs', 0, 22, 12, 30, 'tile'], [0, 'Security', 12, 22, 52, 30, 'tile'], [0, 'Staff room', 52, 22, 64, 30, 'carpet'],
  [0, 'Departures hall', 12, 30, 52, 56, 'hallstone'],
  [0, 'Baggage office', 0, 30, 12, 42, 'tile'], [0, 'Restrooms', 0, 42, 12, 56, 'tile'],
  [0, 'Airport police', 52, 30, 64, 42, 'tile'], [0, 'Electrical', 52, 42, 64, 48, 'tile'], [0, 'Airline office', 52, 48, 64, 56, 'carpet'],
  [1, 'Stair landing', 0, 22, 12, 30, 'tile'], [1, 'Upper gallery', 12, 26, 52, 30, 'carpet'], [1, 'Admin offices', 12, 22, 32, 26, 'carpet'], [1, 'Security control', 32, 22, 52, 26, 'carpet'],
  [1, 'Ops room', 52, 22, 64, 30, 'carpet'], [1, 'VIP lounge', 0, 30, 12, 56, 'carpet'], [1, 'Airline ops', 52, 30, 64, 56, 'carpet'], [1, 'hall void', 12, 30, 52, 56, 'void'],
];
// [floor, x0, z0, x1, z1, kind, 'ext' | 'hidden']
export const OPENINGS = [
  [0, 2, 12, 16, 12, 'gap'], [0, 19, 12, 45, 12, 'gap'], [0, 48, 12, 62, 12, 'gap'],                 // bar, airside hall, duty free open onto the concourse
  [0, 14, 0, 16, 0, 'door', 'ext'], [0, 48, 0, 50, 0, 'door', 'ext'],                                // gate doors to the apron
  [0, 20, 22, 44, 22, 'gap'],                                                                         // security exits airside
  [0, 16, 30, 19, 30, 'gap'], [0, 24, 30, 27, 30, 'gap'], [0, 33, 30, 36, 30, 'gap'], [0, 41, 30, 44, 30, 'gap'],   // four screening lanes
  [0, 20, 56, 22, 56, 'door', 'ext'], [0, 31, 56, 33, 56, 'door', 'ext'], [0, 42, 56, 44, 56, 'door', 'ext'],      // hall entrances from the kerb
  [0, 12, 35, 12, 36, 'door'], [0, 12, 48, 12, 49, 'door'], [0, 52, 36, 52, 37, 'door'], [0, 52, 51, 52, 52, 'door'], [0, 54, 42, 55, 42, 'door'],
  [0, 60, 56, 61, 56, 'door', 'ext'], [0, 0, 25, 0, 26, 'door', 'ext'],
  [0, 12, 27, 12, 28, 'door'], [0, 5, 22, 6, 22, 'door'], [0, 52, 24, 52, 25, 'door'], [0, 58, 22, 59, 22, 'door'],
  [1, 8, 30, 9, 30, 'door'], [1, 12, 27, 12, 28, 'door'], [1, 22, 26, 23, 26, 'door'], [1, 41, 26, 42, 26, 'door'], [1, 32, 23.5, 32, 24.5, 'door'],
  [1, 52, 27, 52, 28, 'door'], [1, 56, 30, 57, 30, 'door'],
];
export const GLASS = [
  [0, 12, 56, 20, 56], [0, 22, 56, 31, 56], [0, 33, 56, 42, 56], [0, 44, 56, 52, 56],               // hall front
  [0, 0, 0, 14, 0], [0, 16, 0, 48, 0], [0, 50, 0, 64, 0],                                            // concourse window wall
  [1, 12, 56, 52, 56], [1, 12, 30, 52, 30], [1, 12, 31, 12, 55], [1, 52, 31, 52, 55],                 // the hall's upper glass: front, gallery, VIP lounge and airline ops look down
];

// [floor, x0, z0, x1, z1, height, kind, face]
const F = [];
for (const x of [2, 21, 35, 53]) F.push([0, x, 4, x + 8, 4.6, 0.85, 'seats', '-z'], [0, x, 4.6, x + 8, 5.2, 0.85, 'seats', '+z'], [0, x, 7.6, x + 8, 8.2, 0.85, 'seats', '-z']);
F.push([0, 13, 1.2, 17, 2, 1.05, 'counter', '+z'], [0, 47, 1.2, 51, 2, 1.05, 'counter', '+z']);                       // gate podiums
F.push([0, 3, 19, 15, 20, 1.1, 'counter', '-z'], [0, 3, 21.4, 15, 21.9, 1.9, 'shelf', '-z'],                           // bar
  ...[[3.4, 13.6], [8.4, 13.6], [13.4, 13.6], [5.9, 16.2], [10.9, 16.2]].map(([x, z]) => [0, x, z, x + 1.2, z + 1.2, 0.76, 'table']));
F.push([0, 24, 15, 28, 17, 1.1, 'counter', '+z'], [0, 36, 15, 40, 17, 1.1, 'counter', '+z'], [0, 30, 19.6, 34, 20.2, 0.85, 'seats', '-z']);   // kiosks
F.push([0, 48, 14, 62, 14.6, 1.6, 'shelf', '+z'], [0, 48, 17, 54, 17.6, 1.6, 'shelf', '+z'], [0, 56, 20.5, 62, 21.4, 1.0, 'counter', '-z']);  // duty free
for (const x of [16, 24, 33, 41]) F.push([0, x + 0.2, 23.4, x + 1.0, 28.6, 1.2, 'xray', '+x']);                         // x-ray belts beside each lane
F.push([0, 46, 23, 50, 24.2, 0.76, 'table'], [0, 13, 23, 15, 24.2, 0.76, 'table']);
for (const [x0, x1] of [[18, 30], [34, 46]]) for (const z of [38, 46]) F.push([0, x0, z, x1, z + 1.2, 1.05, 'counter', '+z']);   // check-in islands
for (const [x, z] of [[22, 42.6], [42, 42.6], [22, 51], [42, 51], [32, 34.4]]) F.push([0, x - 0.45, z - 0.45, x + 0.45, z + 0.45, 2 * H, 'column']);
F.push([0, 14, 53, 18, 53.6, 0.85, 'seats', '+z'], [0, 46, 53, 50, 53.6, 0.85, 'seats', '+z']);
F.push([0, 0.3, 23, 0.8, 29.5, 1.9, 'shelf', '+x'], [0, 8, 27, 11, 28.2, 0.76, 'table']);                                // staff stairs: lockers
F.push([0, 0.3, 31, 0.9, 41, 1.9, 'shelf', '+x'], [0, 4, 35, 7, 36.2, 0.76, 'table'], [0, 9, 31, 11.6, 32.4, 0.9, 'crate'], [0, 2, 39.6, 4.4, 41.4, 0.9, 'crate']);   // baggage office: lost bags
F.push([0, 0.3, 44, 1, 54, 0.9, 'counter', '+x']);                                                                        // restrooms: basins
F.push([0, 56, 32, 60, 33.4, 0.76, 'table'], [0, 63, 31, 63.7, 35, 1.9, 'cabinet', '-x'], [0, 58, 40.6, 62, 41.6, 1.2, 'console', '-z']);   // police
F.push([0, 56, 47.4, 62, 47.9, 1.9, 'cabinet', '-z'], [0, 63.2, 43, 63.8, 46, 1.9, 'cabinet', '-x']);                  // electrical
F.push([0, 55, 50, 59, 51.2, 0.76, 'table'], [0, 61, 53, 63.7, 55.6, 1.2, 'console', '-x']);                           // airline office
F.push([0, 56, 24, 60, 25.2, 0.76, 'table'], [0, 61, 28.6, 63.8, 29.6, 0.8, 'sofa', '-z']);                            // staff room
F.push([1, 7, 23, 11, 24.2, 0.9, 'cabinet', '+z'],
  [1, 14, 22.4, 18, 23.4, 0.76, 'table'], [1, 25, 22.4, 29, 23.4, 0.76, 'table'], [1, 34, 22.3, 50, 23, 1.2, 'console', '+z'], [1, 38, 24.2, 42, 25.2, 0.76, 'table'],
  [1, 55, 22.3, 63.7, 23, 1.2, 'console', '+z'], [1, 57, 25.6, 60, 26.8, 0.76, 'table'],
  [1, 2, 34, 4.8, 34.9, 0.8, 'sofa', '+z'], [1, 2.2, 36, 4.6, 37.2, 0.45, 'table'], [1, 7, 38, 9.8, 38.9, 0.8, 'sofa', '+z'], [1, 7.2, 40, 9.6, 41.2, 0.45, 'table'],
  [1, 0.3, 44, 1, 51, 1.1, 'counter', '+x'], [1, 3, 53, 7, 54.2, 0.76, 'table'], [1, 9, 46, 11.4, 47, 0.8, 'sofa', '-x'],
  [1, 56, 33, 60, 34.2, 0.76, 'table'], [1, 63.2, 38, 63.8, 46, 1.4, 'console', '-x'], [1, 56, 48, 60, 49.2, 0.76, 'table']);
// apron: baggage carts and a tug for cover on the way to the hangar
for (const [x, z] of [[10, -10], [20, -16], [46, -9], [52, -17], [30, -14]]) F.push([0, x, z, x + 2.4, z + 1.4, 1.2, 'crate']);
// hangar: workbenches, tool chests, spare parts on pallets
F.push([0, 6.4, -62, 7.4, -50, 0.95, 'counter', '+x'], [0, 56.6, -62, 57.6, -50, 0.95, 'counter', '-x'], [0, 6.4, -44, 7.4, -42, 1.1, 'cabinet', '+x'], [0, 56.6, -40, 57.6, -38, 1.1, 'cabinet', '-x'],
  [0, 20, -64, 26, -62.6, 1.9, 'shelf', '+z'], [0, 38, -64, 44, -62.6, 1.9, 'shelf', '+z'], [0, 18, -36, 20.4, -34.6, 1.0, 'crate'], [0, 44, -30, 46.4, -28.6, 1.0, 'crate']);
export const FURNITURE = F;

export const GAPLANES = [[14, -50, 0.3], [50, -50, -0.3]];   // two light aircraft parked in the hangar: [x, z, yaw]; a box under each for collision

export const SUSPECT_SPOTS = [
  [0, 6, 9.5], [0, 26, 9.5], [0, 40, 2.6], [0, 60, 9.5], [0, 30, 2.6], [0, 10, 15], [0, 16.5, 19], [0, 22, 18], [0, 43, 19], [0, 50, 16], [0, 60, 19],
  [0, 14, 26], [0, 30, 28], [0, 48, 26.5], [0, 6, 24], [0, 58, 27], [0, 16, 34], [0, 30, 43], [0, 48, 52], [0, 26, 52], [0, 37, 34],
  [0, 6, 38], [0, 6, 52], [0, 58, 36], [0, 60, 45], [0, 58, 53],
  [0, 20, -8], [0, 44, -14], [0, 32, -20], [0, 10, -40], [0, 54, -44], [0, 22, -58], [0, 44, -58], [0, 26, -30], [0, 40, -34],
  [1, 8, 25], [1, 20, 28], [1, 44, 28], [1, 16, 24.6], [1, 28, 24.6], [1, 36, 24.6], [1, 48, 24.6], [1, 58, 28], [1, 4, 40], [1, 6, 50], [1, 58, 40], [1, 60, 52],
  [0.5, 32, -37], [0.5, 32, -49], [HF, 31, -44],
];
export const CIV_SPOTS = [[0, 3, 6], [0, 60, 6], [0, 5, 17.6], [0, 52, 19], [0, 28, 26.5], [0, 20, 42.6], [0, 44, 50], [0, 4, 33.6], [0, 60, 38], [0, 56, 53.6],
  [1, 22, 24.6], [1, 4, 52], [1, 60, 44]];
export const CIV_MUST = [[0.5, 32, -42]];         // a passenger kept in the jet's cabin
export const SUS_MUST = [[0.5, 32, -33.6]];       // and a gunman at the cabin door
export const BOMB_SPOTS = [[0, 9, 19.5, 1.1], [0, 59, 20.95, 1.0], [0, 24, 38.6, 1.05], [0, 40, 46.6, 1.05], [0, 5.5, 35.6, 0.76], [0, 58, 32.7, 0.76],
  [0, 15, 1.6, 1.05], [0, 6.9, -56, 0.95], [1, 40, 24.7, 0.76], [1, 5, 53.6, 0.76], [0, 57, 50.6, 0.76]];
export const BOMB_MUST = [HF, 32.1, -40, 0.9];      // always one in the cargo hold, on a crate
export const HVT = { at: [1, 4, 47], guards: [[1, 7, 43], [1, 8, 52]], flee: [0.5, 32, -46] };

// ---- shape helpers ----
export const inFoot = (x, z) => x >= FOOT.x0 && x <= FOOT.x1 && z >= FOOT.z0 && z <= FOOT.z1;
export const inStair = (x, z) => x > STAIR.x0 && x < STAIR.x1 && z > STAIR.z0 && z < STAIR.z1;
const inHall = (x, z) => x > HALL.x0 && x < HALL.x1 && z > HALL.z0 && z < HALL.z1;
const upHere = (x, z) => inFoot(x, z) && z >= UP_Z && !inHall(x, z);
export const inHangar = (x, z) => x > HANGAR.x0 && x < HANGAR.x1 && z > HANGAR.z0 && z < HANGAR.z1;
const doorZ = z => z > JET.door[0] && z < JET.door[1], hatchZ = z => z > JET.hatch[0] && z < JET.hatch[1];
export const inJet = (x, z) => z > JET.c0 && z < JET.c1 && x > JET.x0 + 0.05 && (x < JET.x1 - 0.05 || (doorZ(z) && x < AIRSTAIR.x0) );
const inAir = (x, z) => x >= AIRSTAIR.x0 && x < AIRSTAIR.x1 && z > AIRSTAIR.z0 && z < AIRSTAIR.z1;
const inHRamp = (x, z) => x > HRAMP.x0 && x <= HRAMP.x1 && z > HRAMP.z0 && z < HRAMP.z1;
const stairT = z => (STAIR.z1 - z) / (STAIR.z1 - STAIR.z0), stairUp = z => Math.min(1, stairT(z) / 0.85) * H;
export const airY = x => CAB * (AIRSTAIR.x1 - x) / (AIRSTAIR.x1 - AIRSTAIR.x0), hrampY = x => HOLD * Math.min(1, (x - HRAMP.x0) / (JET.x0 - HRAMP.x0));
// Every walkable surface over (x, z) as [height, nav layer]. Layers: 0 ground (and the jet's hold), 1 upper floor (and the jet's cabin).
function surfaces(x, z) {
  if (inFoot(x, z)) { if (inStair(x, z)) return stairT(z) > 0.85 ? [[H, 1]] : [[stairUp(z), 0]]; return upHere(x, z) ? [[0, 0], [H, 1]] : [[0, 0]]; }
  if (inJet(x, z)) return x > JET.x1 - 0.05 ? [[CAB, 1]] : [[HOLD, 0], [CAB, 1]];
  if (inAir(x, z)) return [[airY(x), 0]];
  if (inHRamp(x, z)) return [[hrampY(x), 0]];
  return [[0, 0]];
}
function floorRay(ox, oy, oz, dx, dy, dz, best) {
  if (Math.abs(dy) > 1e-9) for (const py of [0, H, 2 * H]) {
    const t = (py - oy) / dy; if (t <= 1e-6 || t >= best) continue; const x = ox + dx * t, z = oz + dz * t;
    if (py === 0 || (py === H && ((upHere(x, z) && !inStair(x, z)) || (inFoot(x, z) && z < UP_Z))) || (py === 2 * H && inFoot(x, z) && z >= UP_Z)) best = t;
  }
  return best;
}
function solidFloor(x, y, z) {
  if (y < 0) return true;
  if (inFoot(x, z)) { if (z < UP_Z) return y > H - 0.2 && y < H + 0.3; if (inHall(x, z)) return y > 2 * H - 0.2 && y < 2 * H + 0.3; return !inStair(x, z) && ((y < H && y > H - 0.2) || (y < 2 * H + 0.3 && y > 2 * H - 0.2)); }
  if (inAir(x, z)) return y < airY(x);
  return false;
}
function floorAt(x, z, y) {
  if (inFoot(x, z)) { if (inStair(x, z)) return 'metal'; const f = y > H / 2 ? 1 : 0; for (const r of ROOMS) if (r[0] === f && x >= r[2] && x <= r[4] && z >= r[3] && z <= r[5]) return r[6] === 'carpet' ? 'carpet' : r[6] === 'wood' ? 'wood' : 'concrete'; }
  if (inJet(x, z)) return y > 1.5 ? 'carpet' : 'metal';
  if (inAir(x, z)) return 'metal';
  return 'concrete';
}
const CAR_COL = [0xb8bcc2, 0x1d1f24, 0xe8e8e6, 0x2c4f8a, 0x8a1f1f, 0x4a4d52, 0xd8c24a, 0xc9b98f];
export const PARKED = [[4, 70.5, Math.PI / 2], [10, 70.5, Math.PI / 2], [46, 70.5, -Math.PI / 2], [56, 70.5, Math.PI / 2], [62, 77.5, -Math.PI / 2], [16, 77.5, Math.PI / 2], [-4, 77.5, -Math.PI / 2], [40, 77.5, Math.PI / 2]]
  .map(([x, z, turn], i) => ({ x, z, turn, color: CAR_COL[(i * 3) % CAR_COL.length] }));
// Solids that are not room walls: the hangar shell, the jet (fuselage, floor, wings), the light aircraft, the canopy columns and the parked cars.
function extra({ boxes }) {
  const box = (kind, x0, x1, y0, y1, z0, z1, o = {}) => boxes.push(Object.assign({ f: 0, kind, x0, x1, y0, y1, z0, z1 }, o));
  const furn = (sub, x0, x1, y0, y1, z0, z1, face) => box('furn', x0, x1, y0, y1, z0, z1, { sub, face });
  const Hg = HANGAR, t = 0.3;
  box('hangar', Hg.x0 - t, Hg.x0, 0, Hg.h, Hg.z0, Hg.z1); box('hangar', Hg.x1, Hg.x1 + t, 0, Hg.h, Hg.z0, Hg.z1); box('hangar', Hg.x0 - t, Hg.x1 + t, 0, Hg.h, Hg.z0 - t, Hg.z0);
  box('hangar', Hg.x0 - t, Hg.door[0], 0, Hg.h, Hg.z1, Hg.z1 + t); box('hangar', Hg.door[1], Hg.x1 + t, 0, Hg.h, Hg.z1, Hg.z1 + t); box('hangar', Hg.door[0], Hg.door[1], Hg.doorH, Hg.h, Hg.z1, Hg.z1 + t);
  // the jet
  const J = JET, w = 0.2, y0 = HOLD;
  box('jet', J.x0 - w, J.x0 + 0.05, y0, J.roof + 0.3, J.c0, J.hatch[0]); box('jet', J.x0 - w, J.x0 + 0.05, y0, J.roof + 0.3, J.hatch[1], J.c1);   // left side, split at the hold hatch
  box('jet', J.x0 - w, J.x0 + 0.05, CAB - 0.15, J.roof + 0.3, J.hatch[0], J.hatch[1]);
  box('jet', J.x1 - 0.05, J.x1 + w, y0, J.roof + 0.3, J.c0, J.door[0]); box('jet', J.x1 - 0.05, J.x1 + w, y0, J.roof + 0.3, J.door[1], J.c1);           // right side, split at the cabin door
  box('jet', J.x1 - 0.05, J.x1 + w, y0, CAB - 0.15, J.door[0], J.door[1]); box('jet', J.x1 - 0.05, J.x1 + w, CAB + DOOR_H - 0.1, J.roof + 0.3, J.door[0], J.door[1]);
  box('jet', J.x0 - w, J.x1 + w, 0.6, J.roof + 0.4, J.c1, J.nose);          // nose and cockpit: sealed bulkhead
  box('jet', J.x0 - w, J.x1 + w, 0.6, J.roof + 0.4, J.tail, J.c0);          // tail cone
  box('jet', J.x0, J.x1, CAB - 0.15, CAB, J.c0, J.c1); box('jet', J.x0, J.x1, J.roof, J.roof + 0.3, J.c0, J.c1);   // cabin floor (the hold's ceiling) and roof
  box('jet', J.x0, J.x1, 0, y0, J.c0, J.c1);                                // belly under the hold
  box('wing', 14, J.x0 - w, 1.3, 1.6, -43, -37); box('wing', J.x1 + w, 50, 1.3, 1.6, -43, -37);   // wings: you duck under them, bullets don't
  box('wing', 26.5, J.x0 - w, CAB + 0.4, CAB + 1.9, -56, -51); box('wing', J.x1 + w, 37.5, CAB + 0.4, CAB + 1.9, -56, -51);   // tail engines
  box('wing', J.cx - 0.15, J.cx + 0.15, J.roof, 10.5, -60, -53);           // fin
  // cabin: two seats each side of a wide aisle, galley clear at the door; the hold: cargo on pallets
  for (let z = J.c0 + 1.2; z < J.c1 - 3.2; z += 0.86) { furn('aseat', J.x0 + 0.1, J.x0 + 1.4, CAB, CAB + 1.1, z, z + 0.6, '-z'); furn('aseat', J.x1 - 1.4, J.x1 - 0.1, CAB, CAB + 1.1, z, z + 0.6, '-z'); }
  furn('crate', 31.6, 32.6, HOLD, HOLD + 0.9, -40.5, -39.5); furn('crate', 30.2, 31.4, HOLD, HOLD + 1.1, -50.5, -48.5); furn('crate', 32.6, 33.8, HOLD, HOLD + 1.1, -36, -34); furn('crate', 30.2, 31.2, HOLD, HOLD + 0.8, -38, -36.6);
  for (const [x, z, yaw] of GAPLANES) box('gaplane', x - 0.6, x + 0.6, 0.4, 1.9, z - 3.6, z + 3.6, { yaw });
  for (const [x, z] of TREES) box('trunk', x - 0.3, x + 0.3, 0, CANOPY.y, z - 0.3, z + 0.3);
  for (const c of PARKED) box('pcar', c.x - 2.2, c.x + 2.2, 0, 1.3, c.z - 0.95, c.z + 0.95);
}
export default {
  id: 'airport', name: 'AIRPORT', op: 'Operation TAILWIND', H, DOOR_H, YARD, layers: 2, layerFloor: [0, 1], tods: ['day', 'night'],
  spawn: SPAWN, exit: EXIT, breaker: BREAKER, cars: [], parked: PARKED, rooms: ROOMS, openings: OPENINGS, glass: GLASS, furniture: FURNITURE,
  spots: { s: SUSPECT_SPOTS, c: CIV_SPOTS, b: BOMB_SPOTS }, hvt: HVT, veg: null, counts: { s: 17, c: 8, b: 3 }, time: 1080, patrolMax: 26,
  stairs: [{ ...STAIR, yb: 0, n: 1 }], foot: FOOT, bombMust: BOMB_MUST, civMust: CIV_MUST, susMust: SUS_MUST,
  lobby: { x: 34.5, y: 1.5, z: 76.5, tx: 30, tz: 73 },
  brief: ['Armed crew hold the terminal and a grounded jet: 8 hostages, 3 bombs.', 'One bomb is in the jet\'s cargo hold, out in the maintenance hangar.', 'The target is in the VIP lounge upstairs. He will run for the jet', 'the moment he hears you: cut him off or follow him across the apron.'],
  surfaces, floorRay, solidFloor, terrainY: () => 0, floorAt, extra,
  indoor: (f, x, z) => inFoot(x, z) && (f === 0 || z >= UP_Z), onStairs: (x, z) => inStair(x, z) || inAir(x, z) || inHRamp(x, z),
  inside: (x, z, y) => (inFoot(x, z) && y < (z < UP_Z ? H : 2 * H)) || inHangar(x, z) || inJet(x, z), objective: (x, z) => inFoot(x, z) || inHangar(x, z) || z < 0,
  roofY: (x, z) => inFoot(x, z) ? (z < UP_Z ? H + 0.3 : 2 * H + 0.3) : inHangar(x, z) ? HANGAR.h : (x > CANOPY.x0 && x < CANOPY.x1 && z > CANOPY.z0 && z < CANOPY.z1) ? CANOPY.y : 0,
};
