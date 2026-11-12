// The race outside during the Grand Prix mission: cars drawn and heard where the shared race clock says they are.
import { carsAt, carColor, VIS } from './core/maps/circuit.js';
import { raceCar } from './racecar.js';
import { engineVoice } from './audio.js';
export function createRace(scene) {
  const cars = new Map(), voices = [], buf = [];
  const get = i => { let g = cars.get(i); if (!g) { g = raceCar(carColor(i)); g.rotation.y = Math.PI / 2; scene.add(g); cars.set(i, g); } return g; };   // nose toward +x
  return {
    update(raceT, head, inside) {
      const list = carsAt(raceT, buf), seen = new Set();
      for (const [x, z, v, i] of list) { const g = get(i); g.visible = true; g.position.set(x, 0, z); seen.add(i); }
      for (const [i, g] of cars) if (!seen.has(i)) g.visible = false;
      // the four nearest cars get an engine; pitch follows the doppler shift, loudness falls off with distance
      const near = list.map(c => [Math.hypot(c[0] - head.x, c[1] - head.z), c]).sort((a, b) => a[0] - b[0]).slice(0, 4);
      while (voices.length < 4) { const e = engineVoice(); if (!e) break; voices.push(e); }
      voices.forEach((e, k) => {
        const n = near[k]; if (!n) return e.set(head.x, 0, head.z, 200, 0, inside);
        const [d, [x, z, v]] = n, toward = -(x - head.x) / Math.max(d, 1) * v, dop = 343 / Math.max(120, 343 - toward);
        e.set(x, 0.6, z, 520 * dop, Math.min(0.5, 9 / Math.max(d, 4)) * (inside ? 0.35 : 1), inside);
      });
    },
    dispose() { for (const g of cars.values()) scene.remove(g); cars.clear(); for (const e of voices) e.stop(); voices.length = 0; },
  };
}
export { VIS };
