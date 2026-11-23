// STADIUM: Operation FINAL WHISTLE at the Harbour Arena, an invented 40 000-seat football ground, during a live evening match.
// A crew has taken the VIP level of the main stand: the hospitality club and its eatery on the lower floor, the glass-fronted
// viewing suites above. The match and the crowd carry on (nobody in the bowl knows yet).
// The squad comes in by helicopter over the main stand's roof: fast-rope onto the roof catwalk, then rappel down through the slot in
// the roof, past the suites' glass (break in through a suite window), to the club terrace (in through the terrace doors). Inside, a
// stair joins the club and the suites. The leader holds the owners' suite; out through the club's concourse gate.
// Generic engine: ../level.js. The stadium itself (bowl, roof, facades) is a model (models/stadium, tools/stadium_glb.py) in the same
// frame: the pitch's middle at (XC, ZC), its long axis along x, the main stand behind the VIP block at -z.
//
// Heights (H = 3.6): FC = 2 the club (7.2), FS = 3 the suites (10.8, ceiling 14.4), RF = 8 the roof catwalk (28.8), the hovering
// helicopter's cabin 33.3. Below the club and above the suites is the stand itself (not playable). Nav layers: 0 ground, 1 club (and
// the stair's flight), 2 suites, 3 roof catwalk, 4 helicopter.
export const H = 3.6, DOOR_H = 2.2;
export const XC = 28, ZC = 88, PITCH = { x0: XC - 52.5, x1: XC + 52.5, z0: ZC - 34, z1: ZC + 34 };   // 105 x 68
export const BLOCK = { x0: 0, x1: 56, z0: 6, z1: 28 };             // the VIP block (both floors)
export const TERR = { x0: 0, x1: 56, z0: 28, z1: 33 };             // the club terrace (outdoor seats) in front of it
export const FC = 2, FS = 3, RF = 8;
export const YC = FC * H, YS = FS * H, ROOF = RF * H;
export const DECK = { x0: 6, x1: 56, z0: 18, z1: 26 };             // the roof catwalk over the stand's roof
export const HELI = { x0: 29, x1: 33.2, z0: 18.6, z1: 21.2, y: ROOF + 4.5, door: [29.05, 32.4] };
export const SHAFT = { x0: 0, x1: 6, z0: 6, z1: 16, top: 8, bot: 14 };   // the stair: top landing z 6..8 (suites), flight, bottom landing z 14..16 (club)
export const SUITES = [6, 16, 26, 36, 46];                          // their west walls; each 10 m wide, z 10..28
export const WINX = SUITES.map(x => x + 5);                         // a breach window (2 m) in the middle of each suite's glass
export const YARD = { x0: -12, z0: -4, x1: 68, z1: 44 };
export const SPAWN = [[29.7, 19.8], [30.6, 19.8], [31.5, 19.8], [32.4, 19.8]];
export const EXIT = { x0: 51.5, x1: 55.8, z0: 6.3, z1: 9.7, y: YC };   // the concourse gate, east end of the club concourse
export const BREAKER = { x: 55.87, y: YC + 1.4, z: 13 };          // in the kitchen
const ROPE_Z = BLOCK.z1 + 0.55;

// [floor, name, x0, z0, x1, z1, floor finish]
export const ROOMS = [
  // the club: concourse along the back, the club bar and eatery, kitchen and servery, restrooms, the club office
  [FC, 'Club concourse', 6, 6, 56, 10, 'terrazzo'], [FC, 'Club bar', 6, 10, 42, 28, 'oak'], [FC, 'Kitchen', 42, 10, 56, 20, 'tileK'], [FC, 'Servery', 42, 20, 50, 28, 'tileK'], [FC, 'Cold store', 50, 20, 56, 28, 'steelfloor'],
  [FC, 'Restrooms', 0, 16, 6, 22, 'tileK'], [FC, 'Club office', 0, 22, 6, 28, 'carpetB'], [FC, 'stair', 0, 6, 6, 16, 'concrete'],
  // the suites: a corridor behind, five suites facing the pitch, the suites' pantry
  [FS, 'Suite corridor', 6, 6, 56, 10, 'carpetB'], [FS, 'Pantry', 0, 16, 6, 28, 'tileK'], [FS, 'stair', 0, 6, 6, 16, 'void'],
  [FS, 'Suite 1', 6, 10, 16, 28, 'carpetG'], [FS, 'Suite 2', 16, 10, 26, 28, 'carpetG'], [FS, "Owners' suite", 26, 10, 36, 28, 'carpetO'], [FS, 'Suite 4', 36, 10, 46, 28, 'carpetG'], [FS, 'Suite 5', 46, 10, 56, 28, 'carpetG'],
];
// [floor, x0, z0, x1, z1, kind, 'ext' | 'hidden']
export const OPENINGS = [
  [FC, 6, 14, 6, 16, 'gap'],                                                          // stair foot onto the club bar
  [FC, 10, 10, 30, 10, 'gap'],                                                        // the club opens onto the concourse
  [FC, 42, 21, 42, 27, 'gap'], [FC, 44, 10, 45.2, 10, 'door'], [FC, 42, 12, 42, 13.2, 'door'], [FC, 52, 20, 53.2, 20, 'door'], [FC, 46, 20, 47.2, 20, 'door'],   // servery counter, kitchen doors, cold store, kitchen to servery
  [FC, 3, 16, 4.2, 16, 'door'], [FC, 6, 18, 6, 19.2, 'door'], [FC, 6, 24, 6, 25.2, 'door'],   // restrooms, office
  [FC, 56, 7.4, 56, 8.6, 'door', 'ext'],                                              // the concourse gate
  [FC, 11, 28, 13, 28, 'door', 'ext'], [FC, 23, 28, 25, 28, 'door', 'ext'], [FC, 35, 28, 37, 28, 'door', 'ext'],   // terrace doors
  [FS, 6, 6, 6, 8, 'gap'],                                                            // stair top onto the corridor
  ...SUITES.map(x => [FS, x + 1, 10, x + 2.2, 10, 'door']),                            // each suite's door off the corridor
  [FS, 16, 24, 16, 25.2, 'door'], [FS, 46, 24, 46, 25.2, 'door'],                       // connecting doors suite 1-2, 4-5
  [FS, 6, 18, 6, 19.2, 'door'],                                                        // pantry service door into suite 1
  ...WINX.map(x => [FS, x - 1, 28, x + 1, 28, 'gap']),                                  // breach windows (panes added in extra())
];
const gl = []; { let a = BLOCK.x0 + 6; for (const x of [...WINX, 62]) { if (x - 1 > a) gl.push([FS, a, 28, Math.min(BLOCK.x1, x - 1), 28]); a = x + 1; } }
const glc = []; { let a = 6; for (const [d0, d1] of [[11, 13], [23, 25], [35, 37], [42, 99]]) { if (d0 > a) glc.push([FC, a, 28, d0, 28]); a = d1; } }
export const GLASS = [
  ...gl,                                                                              // the suites' glass front (the pantry's end is solid)
  ...glc,                                                                             // the club's glass front (servery and cold store solid)
  ...SUITES.slice(1).map(x => [FS, x, 26.6, x, 28]),                                   // glass screens between the suites' front seats
];

// [floor, x0, z0, x1, z1, height, kind, face]
const F = [];
// the club bar: a long island bar in the middle (lit from below), the back bar behind it, dining tables, lounge booths along the glass
F.push([FC, 15, 15.5, 33, 17.5, 1.1, 'clubbar', '+z'], [FC, 17, 11.2, 31, 11.9, 2.2, 'backbar', '+z']);
for (let x = 16; x <= 32; x += 1.6) F.push([FC, x - 0.22, 18.1, x + 0.22, 18.55, 0.78, 'stool']);
for (const [x, z] of [[9, 20], [9, 24.5], [36, 20], [36, 24.5], [15, 22.5], [20, 22.5], [25, 22.5], [30, 22.5]]) F.push([FC, x - 1.0, z - 0.6, x + 1.0, z + 0.6, 0.76, 'table']);
for (const x of [8, 18, 28, 38]) F.push([FC, x, 26.6, x + 3, 27.6, 0.85, 'booth', '+z']);
F.push([FC, 7, 11, 9.5, 12.2, 0.85, 'sofa', '+z'], [FC, 37, 11, 39.5, 12.2, 0.85, 'sofa', '+z']);
// concourse: food counters along the back wall, a few high tables
F.push([FC, 32, 6.1, 44, 7, 1.05, 'counter', '+z'], [FC, 12, 6.1, 20, 7, 1.05, 'counter', '+z']);
for (const x of [24, 28]) F.push([FC, x - 0.35, 7.6, x + 0.35, 8.3, 1.1, 'table']);
// kitchen, servery, cold store, office, restrooms
F.push([FC, 43, 10.2, 55.8, 11, 0.95, 'counter', '+z'], [FC, 46, 14, 52, 15.6, 0.95, 'counter', '+z'], [FC, 55, 12, 55.8, 19.6, 1.9, 'cabinet', '-x'], [FC, 42.3, 21, 43.3, 27, 1.05, 'counter', '-x']);
F.push([FC, 50.3, 20.4, 55.7, 21.1, 2.0, 'shelf', '+z'], [FC, 55, 21.5, 55.7, 27.5, 2.0, 'shelf', '-x'], [FC, 51, 25, 53, 26.2, 0.9, 'crate']);
F.push([FC, 1, 26.8, 4, 27.6, 0.76, 'table'], [FC, 0.3, 23, 1, 25, 1.9, 'cabinet', '+x'], [FC, 0.2, 17, 0.8, 21, 0.9, 'counter', '+x']);
// the suites: a bar counter at the back, a sofa and a coffee table, a dining table, two rows of seats at the glass
for (const [i, x] of SUITES.entries()) {
  F.push([FS, x + 1, 10.3, x + 6, 11.1, 1.05, 'counter', '+z'], [FS, x + 6.6, 10.3, x + 9.6, 11.0, 2.0, 'cabinet', '+z']);
  F.push([FS, x + 1, 15, x + 1.9, 18.5, 0.8, 'sofa', '+x'], [FS, x + 2.6, 15.8, x + 3.6, 17.6, 0.42, 'table']);
  F.push([FS, x + 5.5, 15, x + 8.5, 17, 0.76, 'table']);
  F.push([FS, x + 1.3, 24.2, x + 8.7, 24.8, 0.8, 'vipseats', '+z'], [FS, x + 1.3, 26.8, x + 3.8, 27.4, 0.8, 'vipseats', '+z'], [FS, x + 6.2, 26.8, x + 8.7, 27.4, 0.8, 'vipseats', '+z']);   // the front row leaves the breach window clear
}
// the pantry
F.push([FS, 0.3, 17, 1, 27, 0.95, 'counter', '+x'], [FS, 5, 22, 5.7, 27, 1.9, 'shelf', '-x']);
// the terrace: rows of seats facing the pitch, the parapet in front (extra())
for (const z of [29.4, 31.0]) for (const [a, c] of [[0.6, 10.4], [13.6, 22.4], [25.6, 34.4], [37.6, 55.4]]) F.push([FC, a, z, c, z + 0.6, 0.8, 'vipseats', '+z']);
// the roof catwalk: plant boxes for cover
F.push([RF, 9, 18.4, 12, 20.4, 1.6, 'hvac'], [RF, 50, 18.4, 53, 20.4, 1.6, 'hvac'], [RF, 20, 18.3, 23, 19.6, 1.1, 'hvac'], [RF, 40, 18.3, 43, 19.6, 1.1, 'hvac']);
export const FURNITURE = F;

export const SUSPECT_SPOTS = [
  // suites and pantry
  [FS, 9, 20], [FS, 13, 13], [FS, 19, 21], [FS, 23, 13], [FS, 29, 21], [FS, 33, 13], [FS, 39, 21], [FS, 43, 13], [FS, 49, 20], [FS, 53, 13], [FS, 12, 8], [FS, 28, 8], [FS, 44, 8], [FS, 3, 20],
  // club
  [FC, 10, 14], [FC, 20, 20], [FC, 30, 20], [FC, 38, 14], [FC, 12, 25], [FC, 33, 25], [FC, 24, 13], [FC, 18, 8], [FC, 40, 8], [FC, 47, 17], [FC, 45, 24], [FC, 53, 23], [FC, 3, 25], [FC, 22, 26.5],
];
export const CIV_SPOTS = [[FS, 11, 22], [FS, 21, 15], [FS, 31, 17], [FS, 41, 22], [FS, 51, 15], [FS, 2.5, 24],
  [FC, 12, 19], [FC, 26, 24.5], [FC, 34, 13], [FC, 9, 13], [FC, 48, 12.5], [FC, 2.5, 19], [FC, 46, 25]];
export const CIV_MUST = [[FS, 31, 25.5]];                       // a guest kept at the owners' suite's glass, in view of the pitch
export const BOMB_SPOTS = [[FS, 3.5, 11.05, 1.05], [FS, 13.5, 11.05, 1.05], [FS, 43.5, 11.05, 1.05], [FS, 2, 22, 0.95], [FC, 24, 16.5, 1.1], [FC, 49, 14.8, 0.95], [FC, 38, 6.6, 1.05], [FC, 52, 25.6, 0.9]];
export const BOMB_MUST = [FS, 31.5, 16, 0.76];                  // one always on the owners' suite's dining table
export const HVTS = [{ at: [FS, 30, 14], guards: [[FS, 27.5, 22], [FS, 34.5, 22]], flee: null, name: 'LEADER' }];
// ropes: the fast rope from the helicopter's door to the catwalk, and one from a davit at the catwalk's front for each suite window:
// down through the roof's slot, past the window (break in there), to the club terrace. Fields as in casino.js.
export const ROPES = [
  { x: 31, z: HELI.z1 + 0.45, top: HELI.y, bot: ROOF, out: [0, 1], step: [31, 22.4, ROOF], top0: [31, 20.4, HELI.y], win: null, heli: true },
  ...WINX.map(x => ({ x, z: ROPE_Z, top: ROOF, bot: YC, out: [0, 1], step: [x, 30.2, YC], top0: [x, DECK.z1 - 0.5, ROOF], winAt: [x, 28], mid: { y: YS, step: [x, 27.1, YS] },
    arm: [DECK.z1 - 0.3, ROOF + 1.66] })),
];

// ---- shape helpers ----
export const inBlock = (x, z) => x >= BLOCK.x0 && x <= BLOCK.x1 && z >= BLOCK.z0 && z <= BLOCK.z1;
export const inTerr = (x, z) => x > TERR.x0 && x < TERR.x1 && z > TERR.z0 && z < TERR.z1;
export const inDeck = (x, z) => x > DECK.x0 && x < DECK.x1 && z > DECK.z0 && z < DECK.z1;
export const inShaft = (x, z) => x > SHAFT.x0 && x < SHAFT.x1 && z > SHAFT.z0 && z < SHAFT.z1;
export const inHeli = (x, z) => x > HELI.x0 && x < HELI.x1 && z > HELI.z0 && z < HELI.z1;
const flightY = z => YC + H * (SHAFT.bot - z) / (SHAFT.bot - SHAFT.top);
// the fly-in: from far out over the city to the hover over the main stand's roof
const FLY0 = [-300, 60, -160], FLY1 = [-110, 18, -40];
export const FLY = { T: 16, drop: 1.6,
  at(t) { const u = Math.min(1, Math.max(0, t / FLY.T)), e = 1 - (1 - u) ** 3, a = (1 - e) * (1 - e), b = 2 * (1 - e) * e; return [a * FLY0[0] + b * FLY1[0], a * FLY0[1] + b * FLY1[1], a * FLY0[2] + b * FLY1[2]]; },
  aboard: (x, z, y) => inHeli(x, z) && y > HELI.y - 1 };
// Every walkable surface over (x, z) as [height, nav layer].
function surfaces(x, z) {
  if (inHeli(x, z)) return [[0, 0], [YC, 1], [YS, 2], [ROOF, 3], [HELI.y, 4]];
  if (inShaft(x, z)) {
    if (z >= SHAFT.bot) return [[YC, 1]];                          // bottom landing (club)
    if (z <= SHAFT.top) return [[YS, 2]];                          // top landing (suites)
    return [[flightY(z), 1]];                                      // the flight
  }
  if (inBlock(x, z)) return inDeck(x, z) ? [[0, 0], [YC, 1], [YS, 2], [ROOF, 3]] : [[0, 0], [YC, 1], [YS, 2]];
  if (inTerr(x, z)) return [[0, 0], [YC, 1]];
  if (inDeck(x, z)) return [[0, 0], [ROOF, 3]];
  return [[0, 0]];
}
const slabAt = (y, x, z) => {
  if (inShaft(x, z)) return (y === YS && z <= SHAFT.top) || y === YS + H;
  if (y === YC) return inBlock(x, z) || inTerr(x, z);
  if (y === YS || y === YS + H) return inBlock(x, z);
  if (y === ROOF) return inDeck(x, z);
  if (y === HELI.y || y === HELI.y + 2) return inHeli(x, z);
  return false;
};
const SLABS = [0, YC, YS, YS + H, ROOF, HELI.y, HELI.y + 2];
function floorRay(ox, oy, oz, dx, dy, dz, best) {
  if (Math.abs(dy) > 1e-9) for (const py of SLABS) { const t = (py - oy) / dy; if (t <= 1e-6 || t >= best) continue; const x = ox + dx * t, z = oz + dz * t; if (py === 0 || slabAt(py, x, z)) best = t; }
  return best;
}
function solidFloor(x, y, z) { if (y < 0) return true; for (const py of SLABS) if (py > 0 && y < py + 0.02 && y > py - 0.25 && slabAt(py, x, z)) return true; return false; }
function floorAt(x, z, y) {
  if (inShaft(x, z)) return 'concrete'; if (y > ROOF - 1) return 'metal'; if (inTerr(x, z)) return 'concrete';
  const f = y > YS - 1 ? FS : FC; for (const r of ROOMS) if (r[0] === f && x >= r[2] && x <= r[4] && z >= r[3] && z <= r[5]) return r[6] === 'oak' ? 'wood' : /carpet/.test(r[6]) ? 'carpet' : 'concrete';
  return 'concrete';
}
// Solids that are not room walls: the stand under the club and over the suites, the terrace parapet and the walls at its ends, the
// catwalk's railings, the helicopter, the breach-window panes (as doors).
function extra({ boxes, addDoor }) {
  const box = (kind, x0, x1, y0, y1, z0, z1, o = {}) => boxes.push(Object.assign({ f: 0, kind, x0, x1, y0, y1, z0, z1 }, o));
  const B = BLOCK, T = TERR;
  box('mass', B.x0, B.x1, 0, YC - 0.01, B.z0, T.z1, { f: 1 });                   // the stand under the VIP level
  box('mass', B.x0 - 30, B.x0, 0, YS + H + 0.6, B.z0, T.z1 + 2, { f: 1 });       // the stand either side of the block (its end walls)
  box('mass', B.x1, B.x1 + 30, 0, YS + H + 0.6, B.z0, T.z1 + 2, { f: 1 });
  box('mass', B.x0, B.x1, 0, YS + H + 4, B.z0 - 8, B.z0, { f: 1 });               // the stand behind it
  const py = 1.1;
  box('parapet', T.x0, T.x1, YC, YC + py, T.z1 - 0.25, T.z1);                     // the terrace's front parapet over the lower tier
  box('parapet', B.x0, B.x1, YS + H, YS + H + 0.4, B.z1 - 0.2, B.z1 + 0.6);        // the suites' canopy lip (keeps ropes off the glass)
  for (const z of [DECK.z0, DECK.z1]) box('fence', DECK.x0, DECK.x1, ROOF, ROOF + 1.1, z - 0.06, z + 0.06, { sub: 'rail' });   // catwalk rails
  for (const x of [DECK.x0, DECK.x1]) box('fence', x - 0.06, x + 0.06, ROOF, ROOF + 1.1, DECK.z0, DECK.z1, { sub: 'rail' });
  const Hh = HELI, hy = Hh.y;
  box('heli', Hh.x0 - 0.1, Hh.x1 + 0.1, hy - 0.3, hy, Hh.z0 - 0.1, Hh.z1 + 0.1); box('heli', Hh.x0 - 0.1, Hh.x1 + 0.1, hy + 2, hy + 2.3, Hh.z0 - 0.1, Hh.z1 + 0.1);
  box('heli', Hh.x0 - 0.1, Hh.x0, hy, hy + 2, Hh.z0, Hh.z1); box('heli', Hh.x1, Hh.x1 + 0.1, hy, hy + 2, Hh.z0, Hh.z1); box('heli', Hh.x0, Hh.x1, hy, hy + 2, Hh.z0 - 0.1, Hh.z0);
  box('heli', Hh.x0, Hh.door[0], hy, hy + 2, Hh.z1, Hh.z1 + 0.1); box('heli', Hh.door[1], Hh.x1, hy, hy + 2, Hh.z1, Hh.z1 + 0.1);
  for (const x of WINX) addDoor({ f: FS, x0: x - 1, z0: B.z1, x1: x + 1, z1: B.z1, horiz: true, h: H - 0.25, cx: x, cz: B.z1, y: YS, exterior: true, win: true,
    box: { kind: 'door', x0: x - 1, x1: x + 1, z0: B.z1 - 0.03, z1: B.z1 + 0.03, y0: YS + 0.02, y1: YS + H - 0.25 } });
}
const yAt = (f, x, z) => f > RF ? HELI.y : f * H;
export default {
  id: 'stadium', name: 'STADIUM', op: 'Operation FINAL WHISTLE', test: true, H, DOOR_H, YARD, layers: 5, layerFloor: [0, FC, FS, RF, RF + 1], maxDrop: 3, tods: ['night', 'dusk'],
  spawn: SPAWN, spawnY: HELI.y, fly: FLY, exit: EXIT, breaker: BREAKER, cars: [], parked: [], rooms: ROOMS, openings: OPENINGS, glass: GLASS, furniture: FURNITURE,
  spots: { s: SUSPECT_SPOTS, c: CIV_SPOTS, b: BOMB_SPOTS }, hvts: HVTS, veg: null, counts: { s: 18, c: 8, b: 2 }, time: 1200, patrolMax: 16,
  stairs: [], holes: [[FS, [SHAFT.x0, SHAFT.top, SHAFT.x1, SHAFT.z1]]],
  foot: BLOCK, bombMust: BOMB_MUST, civMust: CIV_MUST, ropes: ROPES, yAt,
  lobby: { x: 31, y: HELI.y + 1.4, z: 19.8, tx: 31, tz: 19.8 },
  brief: ['A crew holds the VIP level of the Harbour Arena during a live match: 8 hostages, 2 bombs, the leader.', 'Fast-rope to the roof catwalk, rappel down through the roof past the suites\' glass: break in at a suite window or carry on to the club terrace.',
    'The leader is in the owners\' suite. The crowd does not know: keep it that way.', 'A stair joins the suites and the club. Out through the club concourse gate.'],
  surfaces, floorRay, solidFloor, terrainY: () => 0, floorAt, extra,
  indoor: (f, x, z) => (f === FC || f === FS) && inBlock(x, z), onStairs: (x, z) => inShaft(x, z) && z > SHAFT.top && z < SHAFT.bot,
  inside: (x, z, y) => inBlock(x, z) && y > YC - 0.5 && y < YS + H,
  objective: (x, z) => inBlock(x, z),
  roofY: (x, z) => inHeli(x, z) ? HELI.y + 2.3 : inDeck(x, z) ? ROOF + 0.3 : (inBlock(x, z) || (x > -40 && x < 96 && z > -8 && z < 44)) ? 26 : 0,
  hint: 'Lights out: MAIN BREAKER in the club kitchen.',
};
