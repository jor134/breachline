// The race that keeps running during the Grand Prix mission. Positions are a pure function of the race clock, so the server
// (who gets hit) and every client (what they see and hear) agree without sending car positions over the network.
// Cars follow the circuit's race line (./spa-path.js, made from the circuit model by tools/spa_kit.py): out of the bus-stop
// chicane in the distance, flat out down the pit straight past the pit building (toward +x along z = -23), hard on the brakes
// into the hairpin, then down the hill behind the paddock until the garages there hide them. The rest of the "lap" is a
// short unseen gap, so cars keep coming as often as they did on the old endless straight.
import { LINE } from './spa-path.js';
export const TRACK = { z0: -30, z1: -16, zc: -23 };       // between the guard rails on the straight (the tarmac is ~10.5 m), and its centre line
const N = 10, LAPT = 26;                                   // cars; seconds between one car's passes (it is out of sight ~4 s of it): a car by every ~2.6 s, as busy as the old straight
export const COLORS = ['#b8234f', '#3846a8', '#16b3b0', '#8cc63f', '#e8e8e8', '#7a2db8', '#2b2b2b', '#e6c229', '#d94f9b', '#3aa7d9'];   // invented; kept clear of real F1 team colours (no Ferrari red, McLaren papaya, Alpine blue, Aston green)
const NP = LINE.length / 4, PT = i => LINE[i * 4 + 3], SEEN = PT(NP - 1);
// each car: where in its lap it starts, how much quicker or slower it laps (a touch, so they close up and drop back), its line
const CARS = Array.from({ length: N }, (_, i) => ({ t0: i * (LAPT / N) + ((i * 7) % 3) * 0.4, k: 1 + ((i * 37) % 11 - 5) * 0.002, lane: (i % 2 ? 1.5 : -1.5), color: COLORS[i] }));
// the point of the race line a car reaches tau seconds after it comes into sight: [x, z, y, heading (radians, from +x toward +z), speed m/s]
function at(tau, out) {
  let lo = 0, hi = NP - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (PT(m) <= tau) lo = m; else hi = m; }
  const a = lo * 4, b = hi * 4, dt = LINE[b + 3] - LINE[a + 3], f = dt > 0 ? Math.min(1, Math.max(0, (tau - LINE[a + 3]) / dt)) : 0;
  const dx = LINE[b] - LINE[a], dz = LINE[b + 1] - LINE[a + 1], d = Math.hypot(dx, dz);
  out[0] = LINE[a] + dx * f; out[1] = LINE[a + 1] + dz * f; out[2] = LINE[a + 2] + (LINE[b + 2] - LINE[a + 2]) * f; out[3] = Math.atan2(dz, dx); out[4] = dt > 0 ? d / dt : 0;
  return out;
}
const tmp = [0, 0, 0, 0, 0];
// every car in sight at race time t: [x, z, speed m/s, index, heading, y]
export function carsAt(t, out = []) {
  out.length = 0;
  for (let i = 0; i < N; i++) {
    const c = CARS[i], tau = ((((t * c.k + c.t0) % LAPT) + LAPT) % LAPT);
    if (tau > SEEN) continue;
    const [x, z, y, h, v] = at(tau, tmp), w = c.lane * Math.min(1, v / 60) + Math.sin(t * 0.3 + i) * 0.8 * Math.min(1, v / 70);   // spread across the tarmac at speed, single file through the hairpin
    out.push([x - Math.sin(h) * w, z + Math.cos(h) * w, v, i, h, y]);
  }
  return out;
}
export const carColor = i => CARS[i].color;
export const onTrack = (x, z) => z > TRACK.z0 && z < TRACK.z1;
