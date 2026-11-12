// Training facility scenery: block-walled range with lane numbers and a firing line, rubber backstop, steel lane baffles,
// a plywood kill house, the skill-station bay, and a car park outside the lobby glass.
import { sheen, tex, grid } from '../mats.js';
import { LANES } from '../core/maps/training.js';
const num = n => (g, s) => { g.fillStyle = 'rgba(230,200,60,0.95)'; g.font = `bold ${s * 0.7}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), s / 2, s / 2); };
export default {
  env: {
    sky: [[0, '#26344d'], [0.4, '#5d7290'], [0.5, '#b9a68c'], [0.54, '#4a4440'], [1, '#2a2826']], skyR: 190, moon: [-95, 80, -130],
    fog: [0x3a4152], fogD: [0.004, 0.01], sunAt: [17, 6], sunFrom: [-40, 30, 60], shadow: 30, hemi: 1.2, hemiSky: 0xd0d4dc, hemiGround: 0xa9a7a2,
    lamps: [[10, 2.9, 22, 9, 14], [27, 2.9, 22, 9, 14], [10, 2.9, 4, 8, 16], [10, 2.9, -9, 8, 16]],
  },
  noshade: { stripe: 1, lanenum: 1 }, noCast: ['tconc', 'gravel', 'asphalt', 'stripe'],
  outer: () => 'block', inner: w => (w.x0 >= 19.9 && w.z1 <= 16.1 ? 'ply' : 'blockin'),
  door: () => 'steeldoor',
  mats(M) {
    if (M.block) return;
    const S = (t, gl) => sheen({ map: t }, gl);
    Object.assign(M, {
      block: S(tex('#8e8a82', 2500, grid(4, 8, 'rgba(40,38,34,0.45)', true)), 'stone'), blockin: S(tex('#c9c6bf', 1500, grid(4, 8, 'rgba(60,58,54,0.35)', true)), 'satin'),
      ply: S(tex('#b8955e', 2500, grid(2, 1, 'rgba(60,40,20,0.45)')), 'satin'), tconc: S(tex('#8a8780', 4000, grid(1, 1, 'rgba(40,38,34,0.25)')), 'stone'),
      steelplate: S(tex('#8c939b', 900), 'metal'), rubber: S(tex('#1c1b1a', 6000, grid(1, 6, 'rgba(0,0,0,0.5)')), 'matte'), steeldoor: S(tex('#5c6670', 300), 'paint'),
      asphalt: S(tex('#3b3c3e', 9000), 'matte'), stripe: sheen({ color: 0xd8b13a }, 'matte'),
    });
    LANES.forEach((x, i) => { M['n' + i] = sheen({ map: tex('rgba(0,0,0,0)', 0, num(i + 1)), transparent: true }, 'matte'); });
  },
  scenery({ b, hills, hillM, THREE, H, YARD }) {
    const flat = (m, x0, x1, z0, z1, y, s = 0.25) => b(m).quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], s);
    flat('asphalt', -80, 110, 28, 90, 0, 0.15); flat('gravel', -80, 110, -80, 28, -0.02, 0.15);
    for (let x = 1; x < 19; x += 2.6) flat('stripe', x, x + 0.1, 32, 37, 0.01);   // parking bays
    // range: firing line, lane stripes downrange, distance marks, lane numbers on the floor behind the counter
    flat('stripe', 0.2, 19.8, 14.75, 14.85, 0.012); for (const x of [4, 8, 12, 16]) flat('stripe', x - 0.03, x + 0.03, -15, 10, 0.012);
    for (const z of [7, 2, -4, -11]) flat('stripe', 0.2, 19.8, z - 0.02, z + 0.02, 0.012);
    LANES.forEach((x, i) => b('n' + i).quad([x - 0.4, 0.014, 15.4], [x + 0.4, 0.014, 15.4], [x + 0.4, 0.014, 16.2], [x - 0.4, 0.014, 16.2], [0, 1, 0], 1, [[0, 0], [1, 0], [1, 1], [0, 1]]));
    // ceiling baffles over the range and a target-carrier rail for each moving lane
    for (let z = -14; z < 14; z += 4) b('steelplate').box(0, 20, H - 0.6, H - 0.55, z, z + 0.6, 'yzZ', 1);
    for (const z of [-4, -6.5]) b('steelplate').box(0.5, 19.5, 1.5, 1.55, z - 0.04, z + 0.04, 'xXyYzZ', 1);
    for (const [x, z, r, h] of [[-120, 60, 90, 30], [140, 40, 100, 36], [20, 160, 120, 34]]) { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7, 1), hillM); m.position.set(x, h / 2 - 3, z); hills.add(m); }
  },
};
