// The race that keeps running during the Grand Prix mission. Positions are a pure function of the race clock, so the server
// (who gets hit) and every client (what they see and hear) agree without sending car positions over the network.
// Cars run along the main straight toward +x; the rest of the lap is out of sight.
export const TRACK = { z0: -30, z1: -16, zc: -23 };       // tarmac edges and centre line of the main straight
export const VIS = { x0: -420, x1: 520 };                  // the straight you can see; cars appear and vanish behind the far grandstands
const LAP = 2000, N = 10, BASE = 78;                        // metres per lap (the hidden part included), cars, mean speed m/s (~280 km/h)
export const COLORS = ['#d2342b', '#1e5bc6', '#0f8a6c', '#f08a1c', '#e8e8e8', '#7a2db8', '#2b2b2b', '#e6c229', '#d94f9b', '#3aa7d9'];
const CARS = Array.from({ length: N }, (_, i) => ({ s0: i * 197 + (i % 3) * 31, dv: ((i * 37) % 11 - 5) * 0.35, lane: (i % 2 ? 1.6 : -1.6), color: COLORS[i] }));
// every car on the visible straight at race time t: [x, z, speed m/s, index]
export function carsAt(t, out = []) {
  out.length = 0;
  for (let i = 0; i < N; i++) {
    const c = CARS[i], v = BASE + c.dv, s = (((c.s0 + v * t) % LAP) + LAP) % LAP, x = VIS.x0 + s;
    if (x > VIS.x1) continue;
    out.push([x, TRACK.zc + c.lane + Math.sin(t * 0.3 + i) * 1.2, v, i]);
  }
  return out;
}
export const carColor = i => CARS[i].color;
export const onTrack = (x, z) => z > TRACK.z0 && z < TRACK.z1;
