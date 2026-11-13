// Race car built from smooth shapes (ported from the Kerbside app): nose towards +z, wheels on y = 0, 5.6 m long.
// Two parts: the bodywork in team colour and the dark parts (tyres, floor, suspension, halo).
// A downloaded model can replace it later: loadRaceCar() is the one place that decides.
import * as THREE from '../vendor/three.module.min.js';
function mergeGeos(list) {
  let n = 0; const parts = list.map(g => { const ng = g.index ? g.toNonIndexed() : g; n += ng.attributes.position.count; return ng; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.BufferAttribute(pos, 3)); r.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  r.computeBoundingSphere(); return r;
}
export const CAR_LEN = 5.6;
// Race car built from smooth shapes, nose towards +z, wheels on y = 0. Two parts: the bodywork
// (team colour: nose, sidepods, engine cover, wings, helmet) and the dark parts (tyres, floor, suspension, halo).
export const CarGeo = (() => {
  const body = [], dark = [];
  const V2 = (x, y) => new THREE.Vector2(x, y);
  const each = (g, f) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const r = f(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, r[0], r[1], r[2]); } g.computeVertexNormals(); return g; };
  const B = (w, h, l, x, y, z, arr, rx) => { const g = new THREE.BoxGeometry(w, h, l); if (rx) g.rotateX(rx); g.translate(x, y, z); arr.push(g); return g; };
  // a rounded slab, seen from the side as a rounded rectangle and extruded across the car
  const slab = (w, h, l, r, x, y, z, arr, tilt) => {
    const sh = new THREE.Shape(), L = l / 2, H = h / 2;
    sh.moveTo(-L + r, -H); sh.lineTo(L - r, -H); sh.quadraticCurveTo(L, -H, L, -H + r); sh.lineTo(L, H - r); sh.quadraticCurveTo(L, H, L - r, H);
    sh.lineTo(-L + r, H); sh.quadraticCurveTo(-L, H, -L, H - r); sh.lineTo(-L, -H + r); sh.quadraticCurveTo(-L, -H, -L + r, -H);
    const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false, curveSegments: 4 });
    g.translate(0, 0, -w / 2); g.rotateY(Math.PI / 2); // length now runs along z, width along x
    if (tilt) g.rotateX(tilt);
    g.translate(x, y, z); arr.push(g); return g;
  };

  // nose and monocoque: one smooth body of revolution, squashed and drooping towards the tip
  const prof = [V2(0.001, 3.08), V2(0.07, 3.0), V2(0.12, 2.75), V2(0.16, 2.35), V2(0.21, 1.85), V2(0.27, 1.25), V2(0.31, 0.75),
    V2(0.33, 0.2), V2(0.32, -0.4), V2(0.27, -1.0), V2(0.2, -1.55), V2(0.12, -2.0), V2(0.05, -2.3), V2(0.001, -2.36)];
  // Two versions: the closed one every car uses, and an open one for the car you sit in, with a real
  // cockpit well (0.9 m long, 0.4 m wide at the floor, floor 0.45 m up) so the wheel and the driver's body fit inside it.
  const makeTub = open => {
    const pts = open ? [...prof.slice(0, 6), V2(0.288, 1.03), V2(0.29, 1.0), V2(0.31, 0.75), V2(0.33, 0.2), V2(0.328, 0.1), V2(0.328, 0.07), ...prof.slice(8)] : prof;
    const tub = new THREE.LatheGeometry(pts.slice().reverse(), 22); // tail-to-nose order keeps the faces pointing outwards
    tub.rotateX(Math.PI / 2); // lathe axis (y) becomes the car's length (z)
    return each(tub, (x, y, z) => {
      const droop = z > 1.2 ? (z - 1.2) * 0.13 : 0, rise = z < 1.0 && z > -1.6 ? Math.max(0, y) * 0.35 : 0;
      const well = open && y > 0 && z < 1.005 && z > 0.095 && Math.abs(x * 1.25) < 0.23; // the five rows of points along the top
      return [x * 1.25, well ? 0.45 : y * 0.82 + 0.43 - droop + rise, z];
    });
  };
  const tub = makeTub(false), tubOpen = makeTub(true);

  // sidepods: rounded, undercut at the front, tapering into the "coke bottle" at the back
  for (const sx of [-1, 1]) {
    const pod = slab(0.44, 0.42, 1.95, 0.17, sx * 0.62, 0.38, -0.2, body);
    each(pod, (x, y, z) => {
      const t = Math.max(0, Math.min(1, (-z - 0.1) / 1.1)); // 0 at the front, 1 at the back
      const inward = sx * (Math.abs(x) - 0.62) * (1 - 0.65 * t), drop = (y - 0.38) * (1 - 0.55 * t);
      return [sx * 0.62 * (1 - 0.35 * t) + inward, 0.38 + drop - 0.05 * t, z];
    });
    // side-impact inlet ring
    const inlet = new THREE.TorusGeometry(0.14, 0.035, 8, 16); inlet.translate(sx * 0.63, 0.47, 0.78); dark.push(inlet);
  }
  // engine cover and airbox hump behind the driver
  const hump = new THREE.SphereGeometry(0.24, 16, 12);
  each(hump, (x, y, z) => [x * 0.9, y * 1.05 + 0.86, z * 2.6 - 0.55]); body.push(hump);
  slab(0.03, 0.26, 1.2, 0.08, 0, 0.88, -1.35, body); // shark fin
  // helmet in the cockpit
  const helmet = new THREE.SphereGeometry(0.17, 14, 10); helmet.translate(0, 0.84, 0.42); // left out of the car you sit in: your eyes are where it is
  // halo over the cockpit
  const halo = new THREE.TorusGeometry(0.3, 0.035, 6, 20, Math.PI); halo.rotateX(-Math.PI / 2); halo.rotateY(Math.PI); halo.translate(0, 1.06, 0.52); dark.push(halo); // just above the cockpit camera's eye line
  const post = []; B(0.05, 0.36, 0.05, 0, 0.88, 0.82, post); // halo centre post: its own part, so cockpit view can see through it
  // floor and diffuser
  B(1.45, 0.04, 2.9, 0, 0.1, -0.35, dark);
  B(1.05, 0.2, 0.5, 0, 0.17, -2.0, dark, -0.35);
  // front wing: two curved planes with endplates, in team colour
  slab(1.95, 0.05, 0.42, 0.02, 0, 0.13, 2.82, body);
  slab(1.7, 0.04, 0.26, 0.02, 0, 0.23, 2.62, body, 0.35);
  for (const sx of [-1, 1]) { slab(0.04, 0.24, 0.55, 0.06, sx * 0.97, 0.2, 2.75, body); B(0.035, 0.18, 0.06, sx * 0.25, 0.25, 2.75, dark); }
  // rear wing: main plane and flap between tall endplates, on a central pylon
  slab(1.0, 0.07, 0.34, 0.03, 0, 0.9, -2.42, body);
  slab(1.0, 0.05, 0.22, 0.02, 0, 1.03, -2.33, body, -0.45);
  for (const sx of [-1, 1]) slab(0.05, 0.62, 0.7, 0.08, sx * 0.52, 0.8, -2.38, body);
  B(0.06, 0.55, 0.08, 0, 0.62, -2.3, dark);
  // wheels: tyre, recessed rim and hub, with suspension arms back to the body
  const wheels = [[0.83, 1.78, 0.35, 0.36], [-0.83, 1.78, 0.35, 0.36], [0.8, -1.55, 0.36, 0.44], [-0.8, -1.55, 0.36, 0.44]];
  for (const [x, z, r, w] of wheels) {
    const t = new THREE.CylinderGeometry(r, r, w, 24); t.rotateZ(Math.PI / 2); t.translate(x, r, z); dark.push(t);
    const sw = new THREE.TorusGeometry(r - 0.02, 0.03, 4, 18); sw.rotateY(Math.PI / 2); // rounded tyre shoulders
    const s1 = sw.clone(); s1.translate(x + Math.sign(x) * w / 2, r, z); dark.push(s1);
    const s2 = sw.clone(); s2.translate(x - Math.sign(x) * w / 2, r, z); dark.push(s2);
    const rim = new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.04, 16); rim.rotateZ(Math.PI / 2); rim.translate(x + Math.sign(x) * (w / 2 + 0.01), r, z); dark.push(rim); // black wheels, like the reference
    const hub = new THREE.CylinderGeometry(0.07, 0.07, 0.08, 10); hub.rotateZ(Math.PI / 2); hub.translate(x + Math.sign(x) * (w / 2 + 0.04), r, z); dark.push(hub);
    for (let k = 0; k < 6; k++) { // spokes stand proud of the rim, so the shading picks them out
      const sp = new THREE.BoxGeometry(0.02, r * 1.1, 0.035); sp.rotateX(k * Math.PI / 6); sp.translate(x + Math.sign(x) * (w / 2 + 0.035), r, z); dark.push(sp);
    }
    const inner = Math.sign(x) * 0.3, len = Math.abs(x) - 0.3 - w / 2;
    for (const dy of [0.12, -0.08]) B(len, 0.035, 0.06, (inner + x - Math.sign(x) * w / 2) / 2, r + dy, z, dark);
  }
  // mirrors
  for (const sx of [-1, 1]) { B(0.16, 0.07, 0.04, sx * 0.48, 0.76, 0.95, body); B(0.03, 0.12, 0.03, sx * 0.4, 0.7, 0.95, dark); }
  return { body: mergeGeos([tub, helmet, ...body]), bodyOpen: mergeGeos([tubOpen, ...body]), dark: mergeGeos(dark), post: mergeGeos(post) };
})();

// The downloaded car ("Ferrari F1 2019" by valvetin, CC BY 4.0), stripped to solid colours and simplified by
// tools/solid_car.py: one mesh per colour group, smooth-shaded with hard edges kept. Until it has loaded, cars use the built-in shape above.
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { toCreasedNormals } from '../vendor/BufferGeometryUtils.js';
const M = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide }, o));
const darkM = M(0x1c1f22), SOLID = { carbon: M(0x17181a, { roughness: 0.45 }), metal: M(0x8e949a, { metalness: 0.6, roughness: 0.35 }), tyre: M(0x101010, { roughness: 0.9 }), rim: M(0x2a2c30, { metalness: 0.5, roughness: 0.4 }) };
const paint = new Map(), all = new Set();
const paintOf = color => { let m = paint.get(color); if (!m) { m = M(color, { roughness: 0.32, metalness: 0.25 }); paint.set(color, m); } return m; };
const model = { hi: null, lo: null };
const Q = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
function fill(g) {
  g.clear(); const color = g.userData.color, mdl = model[g.userData.lo ? 'lo' : 'hi'] || model.hi || model.lo;
  if (mdl) for (const [name, geo] of mdl) g.add(new THREE.Mesh(geo, name === 'paint' ? paintOf(color) : SOLID[name] || darkM));
  else g.add(new THREE.Mesh(CarGeo.body, paintOf(color)), new THREE.Mesh(CarGeo.dark, darkM), new THREE.Mesh(CarGeo.post, darkM));
  return g;
}
export function raceCar(color, lo = false) { const g = new THREE.Group(); g.userData.color = color; g.userData.lo = lo; all.add(g); return fill(g); }
export function dropCar(g) { all.delete(g); }
// two levels of detail: the parked cars you walk past get the finer one, the cars racing past at 280 km/h the lighter one
if (!Q.get('lite') && typeof document !== 'undefined') for (const [k, f] of [['lo', 'car_lo.glb'], ['hi', 'car.glb']]) new GLTFLoader().load('models/f1/' + f, gl => {
  // smooth shading across gentle curves, hard edges kept where the surface turns by more than 50 degrees
  const m = model[k] = []; gl.scene.traverse(o => { if (o.isMesh) m.push([o.name, toCreasedNormals(o.geometry, 50 * Math.PI / 180)]); });
  for (const g of [...all]) { if (!g.parent) { all.delete(g); continue; } fill(g); }
}, undefined, e => console.warn('race car model not loaded', e));
