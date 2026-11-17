// The semi truck ("semi truck" by zairiqzairiq, CC BY 4.0; models/truck/truck.glb, built by tools/truck_glb.py): tractor and trailer
// chassis, no trailer box (the maps put their own load on the deck). In its own frame it is TRUCK.L long along +x with the cab at the
// +x end, TRUCK.W wide from z = 0, wheels on y = 0. Each cab is painted its own colour (the model's paint is white).
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { envMap, pbrMats } from './mats.js';
export const TRUCK = { L: 16.5, W: 2.5, deck: 1.2, trailer: [0, 11.9], cab: 12.26 };   // the trailer's chassis runs x 0 to 11.9, its deck 1.2 up; the cab starts at 12.26
let proto = null;
const loadProto = () => proto || (proto = new Promise((res, rej) => new GLTFLoader().load('models/truck/truck.glb', gl => {
  const sc = gl.scene; sc.rotation.y = Math.PI / 2; sc.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(sc), k = TRUCK.L / (bb.max.x - bb.min.x), kz = TRUCK.W / ((bb.max.z - bb.min.z) * k);
  const g = new THREE.Group(); sc.traverse(o => { if (!o.isMesh) return; const m = o.material; m.envMap = envMap; m.userData.env = m.envMapIntensity = 0.5; if (!pbrMats.includes(m)) pbrMats.push(m);
    const geo = o.geometry.clone().applyMatrix4(o.matrixWorld).translate(-bb.min.x, -bb.min.y, -bb.min.z).scale(k, k, k * kz); const ms = new THREE.Mesh(geo, m); ms.castShadow = ms.receiveShadow = true; g.add(ms); });
  res(g);
}, undefined, rej)));
// a truck at a spot: x0, z0 = its corner, along 'x' | 'z', cabEnd: the cab at the far end (+1) or the near one (-1); color: the cab's paint
export async function makeTruck({ x0, z0, along = 'x', cabEnd = 1 }, color) {
  const p = await loadProto(), g = p.clone(), paint = new Map();
  g.traverse(o => { if (o.isMesh && o.material.name === 'paint') { if (!paint.has(o.material)) { const m = o.material.clone(); m.color.set(color); paint.set(o.material, m); } o.material = paint.get(o.material); } });
  const { L, W } = TRUCK;
  if (along === 'x') { if (cabEnd > 0) g.position.set(x0, 0, z0); else { g.position.set(x0 + L, 0, z0 + W); g.rotation.y = Math.PI; } }
  else if (cabEnd > 0) { g.position.set(x0 + W, 0, z0); g.rotation.y = -Math.PI / 2; } else { g.position.set(x0, 0, z0 + L); g.rotation.y = Math.PI / 2; }
  return g;
}
// where a point of the truck's own frame (u along it from the trailer's back, v across) lands in the world
export function truckAt({ x0, z0, along = 'x', cabEnd = 1 }, u, v) {
  const { L, W } = TRUCK, a = cabEnd > 0 ? u : L - u, b = cabEnd > 0 ? v : W - v;
  return along === 'x' ? [x0 + a, z0 + b] : [x0 + W - b, z0 + a];
}
