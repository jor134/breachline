// CASINO: Operation HIGH ROLLER at THE ASTERION, an invented Strip resort (blue glass tower, white ribbed porte-cochere,
// a casino of swirling ceiling coves). A crew holds the hotel's sky-suite wing and the casino below it.
// The squad arrives by helicopter over the suite wing's roof: fast-rope down to the roof, rappel three floors down the glass,
// break in through the suite windows, take the first high-value target. Then the fire stairs or the service lift down to the
// casino (slots, tables, the chandelier lounge, the high-limit room, the cashier cage, the vault, the security office), the
// second high-value target, and out under the canopy at the front entrance. Generic engine: ../level.js.
//
// Heights (H = 3.6): 0 casino floor (double height to the podium roof at 7.2), 10.8 the suites (floor 3), 21.6 the wing's roof
// (floor 6), 26.1 the hovering helicopter's cabin. The fire stairs are a scissor stair, three flights from the casino's back
// of house to the suites; the landings at 3.6 and 7.2 have no doors. Nav layers: 0 ground, 1 and 2 the stair landings,
// 3 suites, 4 roof, 5 helicopter.
export const H = 3.6, DOOR_H = 2.2;
export const FOOT = { x0: 0, z0: 0, x1: 72, z1: 56 };              // the casino podium
export const WING = { x0: 16, z0: 0, x1: 56, z1: 20 };             // the sky-suite wing above it
export const MAIN = { x0: 14, z0: 8, x1: 60, z1: 48 };             // the double-height casino floor
export const F3 = 3 * H, ROOF = 6 * H, POD = 2 * H;               // suites floor, wing roof, podium roof
export const HELI = { x0: 33.8, x1: 38.2, z0: 7.0, z1: 9.6, y: ROOF + 4.5, door: [34.6, 37.4] };   // cabin floor; the door is the south side (fits the Black Hawk's cabin)
export const SHAFT = { x0: 26, x1: 32, z0: 0, z1: 8, n: 2.4, s: 6.6, mid: 29 };                    // scissor stair: north and south landing strips
export const CAR = { x0: 40, x1: 43, z0: 0, z1: 3 };            // service lift car (at the casino and at the suites)
export const YARD = { x0: -30, z0: -50, x1: 102, z1: 100 };
export const CANOPY = { x0: 18, x1: 54, z0: 56, z1: 74, y: 8.5 };  // the white ribbed porte-cochere
export const SPAWN = [[34.7, 8.3], [35.6, 8.3], [36.5, 8.3], [37.4, 8.3]];
export const EXIT = { x0: 28, x1: 44, z0: 60, z1: 70 };
export const BREAKER = { x: 65.87, y: 1.4, z: 4 };
export const WINX = [22, 32, 37, 51];                              // the four breach windows (2 m wide) in the suites' south glass
const ROPE_Z = WING.z1 + 0.55;

// [floor, name, x0, z0, x1, z1, floor finish]
export const ROOMS = [
  // casino level: the floor, the high-limit room, the cage and vault, security, restrooms, the entrance lobby, back of house
  [0, 'Casino floor', 14, 8, 60, 48, 'cnavy'], [1, 'casino void', 14, 8, 60, 48, 'void'],
  [0, 'High-limit room', 0, 8, 14, 32, 'cgold'], [0, 'Restrooms', 0, 32, 14, 48, 'marble'],
  [0, 'Cashier cage', 60, 8, 72, 20, 'marble'], [0, 'Security office', 60, 20, 72, 32, 'carpetS'], [0, 'Steakhouse', 60, 32, 72, 48, 'wood'],
  [0, 'Gift shop', 0, 48, 14, 56, 'marble'], [0, 'Entrance lobby', 14, 48, 60, 56, 'marble'], [0, 'Valet office', 60, 48, 72, 56, 'marble'],
  [0, 'Count room', 0, 0, 16, 8, 'concrete'], [0, 'Service hall', 16, 0, 26, 8, 'concrete'], [0, 'Fire stairs', 26, 0, 32, 8, 'concrete'],
  [0, 'Service hall', 32, 0, 40, 8, 'concrete'], [0, 'Service lift', 40, 0, 43, 3, 'steelfloor'], [0, 'Lift landing', 40, 3, 43, 8, 'concrete'], [0, 'Service hall', 43, 0, 60, 8, 'concrete'],
  [0, 'Staff room', 60, 0, 66, 8, 'concrete'], [0, 'Vault', 66, 0, 72, 8, 'steelfloor'],
  [1, 'stair void', 26, 0, 32, 8, 'void'], [2, 'stair void', 26, 0, 32, 8, 'void'],
  // the suites
  [3, 'Housekeeping', 16, 0, 26, 8, 'carpetS'], [3, 'Fire stairs', 26, 0, 32, 8, 'void'], [3, 'Lift lobby', 32, 0, 40, 8, 'marble'],
  [3, 'Service lift', 40, 0, 43, 3, 'steelfloor'], [3, 'Lift landing', 40, 3, 43, 8, 'marble'], [3, 'Suite D', 43, 0, 56, 8, 'carpetS'],
  [3, 'Corridor', 16, 8, 56, 11, 'carpetS'],
  [3, 'Suite A', 16, 11, 28, 20, 'carpetS'], [3, 'Presidential suite', 28, 11, 40, 20, 'carpetS'], [3, 'Presidential bedroom', 40, 11, 46, 20, 'carpetS'], [3, 'Suite C', 46, 11, 56, 20, 'carpetS'],
];
// [floor, x0, z0, x1, z1, kind, 'ext' | 'hidden']
export const OPENINGS = [
  [0, 20, 48, 54, 48, 'gap'],                                                                  // lobby opens onto the casino floor
  [0, 26, 56, 28, 56, 'door', 'ext'], [0, 35, 56, 37, 56, 'door', 'ext'], [0, 44, 56, 46, 56, 'door', 'ext'],   // entrance doors under the canopy
  [0, 14, 17, 14, 23, 'gap'],                                                                  // high-limit room: a wide arch
  [0, 14, 40, 14, 41.5, 'door'], [0, 9, 48, 10.5, 48, 'door'], [0, 60, 51, 60, 52.5, 'door'], [0, 60, 36, 60, 38, 'gap'],   // restrooms, gift shop, valet, steakhouse
  [0, 60, 18.4, 60, 19.6, 'door'], [0, 60, 25, 60, 26.2, 'door'],                             // cage door, security office
  [0, 60, 9, 60, 18, 'gap'],                                                                   // the cage window: counter below, bars above
  [0, 68, 8, 69.5, 8, 'door'],                                                                 // vault (from the cage)
  [0, 20, 8, 21.5, 8, 'door'], [0, 36, 8, 37.5, 8, 'door'], [0, 50, 8, 51.5, 8, 'door'],       // STAFF ONLY doors into back of house
  [0, 16, 5, 16, 6.2, 'door'], [0, 26, 6.8, 26, 7.9, 'door'], [0, 60, 5, 60, 6.2, 'door'],      // count room, fire stairs, staff room
  [0, 40, 3, 40, 8, 'gap'], [0, 43, 3, 43, 8, 'gap'], [0, 40.5, 3, 42.5, 3, 'gap'],         // lift landing; the lift's own door is added in extra()
  [3, 32, 1.2, 32, 2.3, 'door'],                                                               // fire stairs at the suites
  [3, 33, 8, 43, 8, 'gap'], [3, 40, 3, 40, 8, 'gap'], [3, 40.5, 3, 42.5, 3, 'gap'],   // lift lobby and landing: one wide opening onto the corridor
  [3, 20, 8, 21.2, 8, 'door'], [3, 48, 8, 49.2, 8, 'door'],                                    // housekeeping, suite D
  [3, 25, 11, 26.2, 11, 'door'], [3, 33, 11, 35, 11, 'door'], [3, 49, 11, 50.2, 11, 'door'], [3, 40, 16, 40, 17.2, 'door'],   // suites
  ...WINX.map(x => [3, x - 1, 20, x + 1, 20, 'gap']),                                         // breach windows (panes added in extra())
];
const gl = []; { let a = 16; for (const x of [...WINX, 57]) { if (x - 1 > a) gl.push([3, a, 20, Math.min(56, x - 1), 20]); a = x + 1; } }
export const GLASS = [
  ...gl, [3, 16, 11, 16, 20], [3, 56, 11, 56, 20], [3, 56, 0, 56, 8],                           // the suites' window walls
  [0, 14, 56, 26, 56], [0, 28, 56, 35, 56], [0, 37, 56, 44, 56], [0, 46, 56, 60, 56],          // the entrance front
  [0, 60, 32, 60, 36], [0, 60, 38, 60, 48], [0, 72, 32, 72, 48],                              // steakhouse glass
];

// [floor, x0, z0, x1, z1, height, kind, face]
const F = [];
// slots: banks of machines back to back, a stool at each
const slotRow = (f, x0, x1, z, face) => { for (let x = x0; x + 1.0 <= x1 + 0.01; x += 1.05) F.push([f, x, z, x + 1.0, z + 0.75, 1.95, 'slot', face]); };
for (const [x0, x1] of [[16, 26], [48, 58]]) for (const z of [10.5, 15.5, 30.5, 35.5, 40.5]) { slotRow(0, x0, x1, z, '-z'); slotRow(0, x0, x1, z + 0.75, '+z'); }
for (const z of [22, 24.5]) slotRow(0, 48, 58, z, z === 22 ? '-z' : '+z');
// table games in the middle: poker, blackjack, roulette, craps
for (const [x, z] of [[29, 12], [35, 12], [41, 12]]) F.push([0, x, z, x + 3.2, z + 1.8, 0.78, 'bj', '+z']);
for (const [x, z] of [[28, 38], [33, 38]]) F.push([0, x, z, x + 3.6, z + 1.9, 0.78, 'poker', '+z']);
F.push([0, 40, 37.6, 43.4, 40.2, 0.8, 'roulette', '+z'], [0, 45, 37.4, 48.6, 40.4, 0.9, 'craps', '+z'], [0, 21, 21, 24.4, 23.6, 0.8, 'roulette', '+x']);
// the chandelier lounge: a round bar under the chandelier (eight counter segments), low tables round it
for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, cx = 37 + Math.cos(a) * 4.2, cz = 27 + Math.sin(a) * 4.2; if (k === 6) continue; F.push([0, cx - 0.9, cz - 0.9, cx + 0.9, cz + 0.9, 1.1, 'barseg']); }
for (const [x, z] of [[30, 22], [44, 22], [30, 32], [44, 32]]) F.push([0, x - 0.5, z - 0.5, x + 0.5, z + 0.5, 0.5, 'ltable'], [0, x - 1.6, z - 0.4, x - 0.8, z + 0.4, 0.8, 'lchair', '+x'], [0, x + 0.8, z - 0.4, x + 1.6, z + 0.4, 0.8, 'lchair', '-x']);
// ring-lit columns through the casino floor
export const COLUMNS = [[20, 19], [54, 19], [20, 28], [54, 28], [27, 45], [47, 45], [37, 17]];
for (const [x, z] of COLUMNS) F.push([0, x - 0.55, z - 0.55, x + 0.55, z + 0.55, 2 * H, 'rcolumn']);
// high-limit room: a few machines along the walls, two private tables
slotRow(0, 1, 8, 8.2, '+z'); for (let z = 10; z + 1 < 30; z += 1.05) F.push([0, 0.2, z, 0.95, z + 1.0, 1.95, 'slot', '+x']);
F.push([0, 5, 14, 8.6, 15.9, 0.78, 'bj', '+z'], [0, 5, 22, 8.6, 23.9, 0.78, 'poker', '+z'], [0, 9.5, 28, 13.5, 31.6, 0.8, 'lsofa', '-z'], [0, 4, 30.4, 8, 31.8, 1.1, 'counter', '-z']);
// cashier cage: the counter with bars over it, safes and a cash sorter behind; the vault's shelves
F.push([0, 60.1, 9, 61.1, 18, 1.1, 'counter', '-x'], [0, 70.8, 9, 71.8, 19, 1.9, 'cabinet', '-x'], [0, 63, 12, 66, 13.2, 0.9, 'table']);
F.push([0, 66.3, 0.3, 71.7, 1.0, 2.1, 'shelf', '+z'], [0, 71.0, 1.4, 71.7, 7.0, 2.1, 'shelf', '-x'], [0, 67, 4, 70, 5.2, 0.9, 'crate']);
// security office: a desk of consoles facing the CCTV wall
F.push([0, 62, 22.5, 70, 23.5, 1.0, 'console', '-z'], [0, 63, 26, 69, 27, 1.0, 'console', '-z'], [0, 71.2, 24, 71.8, 30, 1.9, 'cabinet', '-x']);
// steakhouse, restrooms, gift shop, valet, lobby, back of house
for (const [x, z] of [[62, 34], [66, 34], [62, 40], [66, 40], [62, 45], [66, 45]]) F.push([0, x, z, x + 1.4, z + 1.4, 0.76, 'table']);
F.push([0, 0.3, 34, 1, 46, 0.9, 'counter', '+x'], [0, 2, 50, 7, 50.8, 1.6, 'shelf', '+z'], [0, 6, 53, 10, 54, 1.0, 'counter', '+z'], [0, 62, 50, 68, 51, 1.05, 'counter', '+z']);
F.push([0, 31, 50.5, 41, 51.5, 1.1, 'counter', '-z'], [0, 18, 52, 22, 53, 0.8, 'lsofa', '+z'], [0, 50, 52, 54, 53, 0.8, 'lsofa', '+z']);   // front desk, lobby sofas
F.push([0, 1, 1, 7, 2, 0.9, 'table'], [0, 10, 0.3, 15.7, 1, 1.9, 'cabinet', '+z'], [0, 17, 0.3, 25.7, 0.9, 1.9, 'shelf', '+z'], [0, 45, 0.3, 59.7, 0.9, 1.9, 'shelf', '+z'], [0, 52, 4, 54.4, 5.4, 1.0, 'crate'], [0, 61, 1, 65, 2.2, 0.76, 'table'], [0, 34, 0.3, 39, 1.2, 1.4, 'cabinet', '+z']);
// suites: the presidential living room (curved sofa, pool table, bar), bedrooms (beds, nightstands), suite A and C lounges
F.push([3, 30, 15, 35, 16.2, 0.8, 'lsofa', '+z'], [3, 31.5, 17, 33.5, 18.2, 0.42, 'ltable'], [3, 35.8, 16.4, 37, 17.6, 0.8, 'lchair', '-x'], [3, 36.4, 12.2, 38.8, 13.5, 0.86, 'pooltable'], [3, 28.3, 11.4, 31, 12.2, 1.05, 'counter', '+z']);
F.push([3, 41.5, 12, 44.5, 14.4, 0.6, 'bed', '+z'], [3, 40.4, 12.2, 41.2, 12.9, 0.55, 'nstand'], [3, 44.8, 12.2, 45.6, 12.9, 0.55, 'nstand']);
F.push([3, 17, 12, 20, 14.4, 0.6, 'bed', '+z'], [3, 21, 16.5, 25, 17.5, 0.8, 'lsofa', '+z'], [3, 22.4, 18.2, 23.6, 19.2, 0.42, 'ltable'], [3, 26.8, 12, 27.6, 15, 1.9, 'cabinet', '-x']);
F.push([3, 52, 12, 55, 14.4, 0.6, 'bed', '+z'], [3, 47, 16.5, 51, 17.5, 0.8, 'lsofa', '+z'], [3, 48.4, 18.2, 49.6, 19.2, 0.42, 'ltable']);
F.push([3, 50, 1, 53, 3.4, 0.6, 'bed', '+z'], [3, 44, 6.6, 47, 7.6, 0.8, 'lsofa', '-z'], [3, 17, 0.4, 25.6, 1.1, 1.9, 'shelf', '+z'], [3, 22, 4, 24.4, 5.2, 1.0, 'crate'], [3, 33, 6, 36, 7.2, 0.8, 'lsofa', '-z']);
// roof: plant, ducts and the lift overrun for cover
F.push([6, 18, 2, 23, 6, 1.6, 'hvac'], [6, 46, 2, 52, 6, 1.6, 'hvac'], [6, 39.5, 0.5, 43.5, 4, 2.6, 'hvac'], [6, 25, 13, 28, 15, 1.2, 'hvac'], [6, 44, 13, 47, 15, 1.2, 'hvac']);
export const FURNITURE = F;

export const SUSPECT_SPOTS = [
  // suites
  [3, 22, 15], [3, 26, 18.5], [3, 34, 18.5], [3, 30, 13], [3, 38, 14.8], [3, 43, 16], [3, 52, 16], [3, 48, 13], [3, 20, 9.5], [3, 36, 9.5], [3, 52, 9.5], [3, 36, 4], [3, 46, 4], [3, 20, 4],
  // casino
  [0, 27, 14.5], [0, 33, 16], [0, 45, 16], [0, 37, 21], [0, 27, 27], [0, 47, 27], [0, 37, 33], [0, 27, 34], [0, 46, 34], [0, 37, 44], [0, 20, 44], [0, 56, 44],
  [0, 4, 12], [0, 10, 18], [0, 4, 26], [0, 64, 14], [0, 69, 28], [0, 66, 36], [0, 30, 52], [0, 46, 53], [0, 20, 4], [0, 36, 4], [0, 52, 4], [0, 8, 4], [0, 63, 4],
];
export const CIV_SPOTS = [[3, 24, 13], [3, 32, 16.5], [3, 43, 18], [3, 54, 18], [3, 48, 3],
  [0, 21.5, 13], [0, 51, 12.5], [0, 30, 15], [0, 40, 33], [0, 22, 38], [0, 53, 37.5], [0, 7, 19], [0, 2.5, 36], [0, 63, 43], [0, 36, 53.5], [0, 66, 26], [0, 4, 52]];
export const CIV_MUST = [[0, 68.5, 15]];                    // a cashier kept in the cage
export const BOMB_SPOTS = [[3, 29.5, 11.8, 1.05], [3, 38, 12.85, 0.86], [3, 26.8, 13.5, 1.9], [3, 23, 4.6, 1.0], [0, 33, 50.6, 1.1], [0, 64.5, 12.6, 0.9], [0, 6, 30.7, 1.1], [0, 53, 4.7, 1.0], [0, 65, 22.6, 1.0]];
export const BOMB_MUST = [0, 68.5, 4.6, 0.9];               // one always in the vault
// two high-value targets: the crew's leader in the presidential suite, and the money man in the high-limit room (who runs for the vault)
export const HVTS = [
  { at: [3, 33, 13], guards: [[3, 30, 18], [3, 37, 18]], flee: null, name: 'LEADER' },
  { at: [0, 7, 25], guards: [[0, 10, 21], [0, 4, 14]], flee: [0, 69, 2.6], name: 'MONEY MAN', run: 'THE MONEY MAN IS RUNNING FOR THE VAULT', runT: 'THE MONEY MAN IS HEADING FOR THE VAULT' },
];
// ropes: the fast rope from the helicopter's door to the roof, and four from anchors on the roof's south parapet down the glass to the
// breach windows. x, z = where the rope hangs; top / bot = the heights it runs between (feet); out = the way off the building;
// step = where you step off at the bottom (onto the roof, or into the suite once its window is broken); top0 = where you stand to clip in
export const ROPES = [
  { x: 36, z: HELI.z1 + 0.45, top: HELI.y, bot: ROOF, out: [0, 1], step: [36, 10.9, ROOF], top0: [36, 9.1, HELI.y], win: null, heli: true },
  ...WINX.map(x => ({ x, z: ROPE_Z, top: ROOF, bot: F3, out: [0, 1], step: [x, 18.9, F3], top0: [x, 19.2, ROOF], winAt: [x, 20], arm: [WING.z1 - 0.6, ROOF + 1.66] })),   // arm: the davit over the parapet (from z, at height): gripping it clips you in too
];
export const LIFT = { car: CAR, stops: [0, F3], door: [40.67, 3, 42.33, 3], doorH: 2.52 };   // the doorway fits the lift model's (models/lift)

// ---- shape helpers ----
export const inFoot = (x, z) => x >= FOOT.x0 && x <= FOOT.x1 && z >= FOOT.z0 && z <= FOOT.z1;
export const inWing = (x, z) => x >= WING.x0 && x <= WING.x1 && z >= WING.z0 && z <= WING.z1;
export const inMain = (x, z) => x > MAIN.x0 && x < MAIN.x1 && z > MAIN.z0 && z < MAIN.z1;
export const inShaft = (x, z) => x > SHAFT.x0 && x < SHAFT.x1 && z > SHAFT.z0 && z < SHAFT.z1;
export const inCar = (x, z) => x > CAR.x0 && x < CAR.x1 && z > CAR.z0 && z < CAR.z1;
export const inHeli = (x, z) => x > HELI.x0 && x < HELI.x1 && z > HELI.z0 && z < HELI.z1;
// The fly-in: the helicopter (with everyone aboard) comes in over the boulevard from the east, nose first, slowing to the hover in T
// seconds, then lowers the fast rope over `drop` seconds. at(t) is its offset from the hover point; zero from T on.
const FLY0 = [320, 50, 40], FLY1 = [120, 14, 8];
export const FLY = { T: 16, drop: 1.6,
  at(t) { const u = Math.min(1, Math.max(0, t / FLY.T)), e = 1 - (1 - u) ** 3, a = (1 - e) * (1 - e), b = 2 * (1 - e) * e; return [a * FLY0[0] + b * FLY1[0], a * FLY0[1] + b * FLY1[1], a * FLY0[2] + b * FLY1[2]]; },
  aboard: (x, z, y) => inHeli(x, z) && y > HELI.y - 1 };
const RUN = SHAFT.s - SHAFT.n, flightY = (k, z) => k * H + H * (k % 2 ? (z - SHAFT.n) / RUN : (SHAFT.s - z) / RUN);   // flight k climbs from floor k to k + 1
// Every walkable surface over (x, z) as [height, nav layer].
function surfaces(x, z) {
  if (inHeli(x, z)) return [[0, 0], [F3, 3], [ROOF, 4], [HELI.y, 5]];   // (it hovers over the wing)
  if (inShaft(x, z)) {
    const out = [[ROOF, 4]];
    if (z >= SHAFT.s) out.push([0, 0], [2 * H, 2]);                 // south landings: casino level and the 7.2 landing
    else if (z <= SHAFT.n) out.push([H, 1], [F3, 3]);               // north landings: 3.6 and the suites
    else if (x < SHAFT.mid) out.push([flightY(0, z), 0], [flightY(2, z), 2]);   // west half: flights 1 and 3
    else out.push([flightY(1, z), 1]);                              // east half: flight 2
    return out;
  }
  if (inWing(x, z)) return [[0, 0], [F3, 3], [ROOF, 4]];
  return [[0, 0]];
}
const slabAt = (y, x, z) => {   // the horizontal slabs bullets and sight stop at
  if (inShaft(x, z)) return (y === H && z <= SHAFT.n) || (y === 2 * H && z >= SHAFT.s) || (y === F3 && z <= SHAFT.n) || y === ROOF;
  if (y === H) return inFoot(x, z) && !inMain(x, z);                // side rooms' ceilings
  if (y === POD) return inFoot(x, z);                               // the podium roof (the casino ceiling)
  if (y === F3 || y === 4 * H || y === 5 * H || y === ROOF) return inWing(x, z);
  if (y === HELI.y || y === HELI.y + 2) return inHeli(x, z);
  return false;
};
const SLABS = [0, H, POD, F3, 4 * H, 5 * H, ROOF, HELI.y, HELI.y + 2];
function floorRay(ox, oy, oz, dx, dy, dz, best) {
  if (Math.abs(dy) > 1e-9) for (const py of SLABS) { const t = (py - oy) / dy; if (t <= 1e-6 || t >= best) continue; const x = ox + dx * t, z = oz + dz * t; if (py === 0 || slabAt(py, x, z)) best = t; }
  return best;
}
function solidFloor(x, y, z) { if (y < 0) return true; for (const py of SLABS) if (py > 0 && y < py + 0.02 && y > py - 0.25 && slabAt(py, x, z)) return true; return false; }
function floorAt(x, z, y) {
  if (inShaft(x, z) || inCar(x, z)) return 'metal'; if (inHeli(x, z) && y > ROOF + 2) return 'metal';
  if (y > ROOF - 1) return 'concrete';
  const f = y > F3 - 1 ? 3 : 0; for (const r of ROOMS) if (r[0] === f && x >= r[2] && x <= r[4] && z >= r[3] && z <= r[5]) return r[6] === 'wood' ? 'wood' : /carpet|cnavy|cgold/.test(r[6]) ? 'carpet' : 'concrete';
  return 'concrete';
}
const CAR_COL = [0x14161a, 0x1d1f24, 0x0e1a2e, 0x2a2c30, 0xe8e8e6, 0x1a2436];
export const PARKED = [[22, 62.5, Math.PI / 2], [28.5, 62.5, Math.PI / 2], [43.5, 66.5, -Math.PI / 2], [50, 62.5, -Math.PI / 2], [10, 82, Math.PI / 2], [62, 82, -Math.PI / 2], [-6, 70, 0], [80, 70, 0]]
  .map(([x, z, turn], i) => ({ x, z, turn, color: CAR_COL[i % CAR_COL.length] }));
// Solids that are not room walls: the wing's opaque floors behind the glass, the roof parapet, the helicopter's cabin, the cage bars,
// the breach-window panes and the lift's door (both as doors), the canopy's columns, parked cars.
function extra({ boxes, addDoor }) {
  const box = (kind, x0, x1, y0, y1, z0, z1, o = {}) => boxes.push(Object.assign({ f: 0, kind, x0, x1, y0, y1, z0, z1 }, o));
  const W = WING;
  box('mass', W.x0, W.x1, F3 + H, ROOF, W.z0, W.z1, { f: 4 });                    // floors 4 and 5: not playable, behind dark glass
  // floor 2 (plant): solid but for the stair and lift shafts
  for (const [a, c, e, g] of [[W.x0, SHAFT.x0, W.z0, W.z1], [SHAFT.x1, CAR.x0, W.z0, W.z1], [CAR.x1, W.x1, W.z0, W.z1], [SHAFT.x0, SHAFT.x1, SHAFT.z1, W.z1], [CAR.x0, CAR.x1, CAR.z1, W.z1]]) box('mass', a, e, POD, F3 - 0.01, c, g, { f: 2 });
  const t = 0.25, py = 1.1;                                                     // roof parapet all round (the ropes hang over its south edge)
  box('parapet', W.x0, W.x1, ROOF, ROOF + py, W.z1 - t, W.z1); box('parapet', W.x0, W.x1, ROOF, ROOF + py, W.z0, W.z0 + t); box('parapet', W.x0, W.x0 + t, ROOF, ROOF + py, W.z0, W.z1); box('parapet', W.x1 - t, W.x1, ROOF, ROOF + py, W.z0, W.z1);
  box('parapet', W.x0, W.x1, POD, POD + py, FOOT.z1 - t, FOOT.z1);              // podium edge over the entrance
  // the helicopter: floor, roof, nose and tail bulkheads, the far (north) side; the south side is open between the door posts
  const Hh = HELI, hy = Hh.y;
  box('heli', Hh.x0 - 0.1, Hh.x1 + 0.1, hy - 0.3, hy, Hh.z0 - 0.1, Hh.z1 + 0.1); box('heli', Hh.x0 - 0.1, Hh.x1 + 0.1, hy + 2, hy + 2.3, Hh.z0 - 0.1, Hh.z1 + 0.1);
  box('heli', Hh.x0 - 0.1, Hh.x0, hy, hy + 2, Hh.z0, Hh.z1); box('heli', Hh.x1, Hh.x1 + 0.1, hy, hy + 2, Hh.z0, Hh.z1); box('heli', Hh.x0, Hh.x1, hy, hy + 2, Hh.z0 - 0.1, Hh.z0);
  box('heli', Hh.x0, Hh.door[0], hy, hy + 2, Hh.z1, Hh.z1 + 0.1); box('heli', Hh.door[1], Hh.x1, hy, hy + 2, Hh.z1, Hh.z1 + 0.1);
  // cage bars above the cashier counter: you can see and shoot through them, not climb over
  box('fence', 60, 60.12, 1.1, H, 9, 18, { f: 0, sub: 'bars' });
  // the four breach windows: panes that stay shut until they are shot or kicked in (doors that only ever open, by breaking)
  for (const x of WINX) addDoor({ f: 3, x0: x - 1, z0: WING.z1, x1: x + 1, z1: WING.z1, horiz: true, h: H - 0.25, cx: x, cz: WING.z1, y: F3, exterior: true, win: true,
    box: { kind: 'door', x0: x - 1, x1: x + 1, z0: WING.z1 - 0.03, z1: WING.z1 + 0.03, y0: F3 + 0.02, y1: F3 + H - 0.25 } });
  // the service lift's doors, one at each stop: they slide, and open only where the car is
  const [dx0, , dx1] = LIFT.door, dh = LIFT.doorH;
  LIFT.stops.forEach((y, k) => addDoor({ f: k ? 3 : 0, x0: dx0, z0: CAR.z1, x1: dx1, z1: CAR.z1, horiz: true, h: dh, cx: (dx0 + dx1) / 2, cz: CAR.z1, y, lift: k,
    box: { kind: 'door', x0: dx0, x1: dx1, z0: CAR.z1 - 0.04, z1: CAR.z1 + 0.04, y0: y, y1: y + dh } }));
  for (const y of LIFT.stops) for (const [a, c] of [[CAR.x0 + 0.5, dx0], [dx1, CAR.x1 - 0.5]]) box('liftpost', a, c, y, y + dh, CAR.z1 - 0.1, CAR.z1 + 0.1, { f: y ? 3 : 0 });   // the door frame's posts
  for (const y of LIFT.stops) boxes.push({ f: y ? 3 : 0, kind: 'lintel', out: '', x0: CAR.x0 + 0.5, x1: CAR.x1 - 0.5, z0: CAR.z1 - 0.1, z1: CAR.z1 + 0.1, y0: y + LIFT.doorH, y1: y + H });   // the wall over the lift's door
  // the stair core's walls between the two halves under each flight (a solid stringer wall, so nobody drops off a flight)
  box('core', SHAFT.mid - 0.08, SHAFT.mid + 0.08, 0, F3 + 1.0, SHAFT.n, SHAFT.s);
  // and where a landing meets the far end of the other flight, a rail so nobody steps onto it from the wrong height
  box('core', SHAFT.mid, SHAFT.x1, 0, 2 * H - 0.3, SHAFT.s - 0.08, SHAFT.s);            // casino landing: the east flight's top is 7.2 up
  box('core', SHAFT.mid, SHAFT.x1, F3 - 0.8, F3 + 1.2, SHAFT.n, SHAFT.n + 0.08);         // suites landing: the east flight's foot is 7.2 down
  box('core', SHAFT.x0, SHAFT.x1, F3 + H - 0.2, F3 + H, SHAFT.z0, SHAFT.z1);   // the shaft's top
  // canopy columns and cars at the kerb
  for (const x of [CANOPY.x0 + 1, CANOPY.x1 - 1]) for (const z of [64, 72]) box('trunk', x - 0.35, x + 0.35, 0, CANOPY.y, z - 0.35, z + 0.35);
  for (const c of PARKED) box('pcar', c.x - 2.3, c.x + 2.3, 0, 1.4, c.z - 1.0, c.z + 1.0);
}
const yAt = (f, x, z) => f >= 7 ? HELI.y : f * H;
export default {
  id: 'casino', name: 'CASINO TOWER', op: 'Operation HIGH ROLLER', H, DOOR_H, YARD, layers: 6, layerFloor: [0, 1, 2, 3, 6, 7], tods: ['dusk', 'night'],
  spawn: SPAWN, spawnY: HELI.y, fly: FLY, exit: EXIT, breaker: BREAKER, cars: [], parked: PARKED, rooms: ROOMS, openings: OPENINGS, glass: GLASS, furniture: FURNITURE,
  spots: { s: SUSPECT_SPOTS, c: CIV_SPOTS, b: BOMB_SPOTS }, hvts: HVTS, veg: null, counts: { s: 22, c: 10, b: 2 }, time: 1320, patrolMax: 18,
  stairs: [], holes: [[1, [SHAFT.x0, SHAFT.z0, SHAFT.x1, SHAFT.z1]], [2, [SHAFT.x0, SHAFT.z0, SHAFT.x1, SHAFT.z1]], [3, [SHAFT.x0, SHAFT.z0, SHAFT.x1, SHAFT.z1]]],
  foot: FOOT, bombMust: BOMB_MUST, civMust: CIV_MUST, ropes: ROPES, lift: LIFT, yAt,
  lobby: { x: 36, y: HELI.y + 1.4, z: 8.3, tx: 36, tz: 8.3 },
  brief: ['A crew holds the Asterion\'s sky suites and casino: 10 hostages, 2 bombs, 2 high-value targets.', 'Fast-rope to the roof, rappel down the glass and break in through the suite windows.',
    'The leader is in the presidential suite. The money man is in the high-limit room: he runs for the vault.', 'Fire stairs or service lift down to the casino. Out through the front entrance.'],
  surfaces, floorRay, solidFloor, terrainY: () => 0, floorAt, extra,
  indoor: (f, x, z) => (f <= 2 && inFoot(x, z)) || (f === 3 && inWing(x, z)), onStairs: (x, z) => inShaft(x, z) && z > SHAFT.n && z < SHAFT.s,
  inside: (x, z, y) => (inFoot(x, z) && y < POD) || (inWing(x, z) && y > F3 - 0.5 && y < F3 + H) || (inShaft(x, z) && y < F3 + H) || (inHeli(x, z) && y > HELI.y - 0.5),
  objective: (x, z) => inFoot(x, z),
  roofY: (x, z) => inHeli(x, z) ? HELI.y + 2.3 : inWing(x, z) ? ROOF + 0.3 : inFoot(x, z) ? POD + 0.3 : (x > CANOPY.x0 && x < CANOPY.x1 && z > CANOPY.z0 && z < CANOPY.z1) ? CANOPY.y : 0,
  hint: 'Lights out: MAIN BREAKER in the staff room behind the cashier cage.',
};
