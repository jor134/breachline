// The parked sports car: a baked, texture-free copy of the Khronos "Car Concept" sample (see models/car/LICENSE.md). One mesh, two materials.
import * as THREE from '../vendor/three.module.min.js';
import { sheen } from './mats.js';
export async function loadCar(scene, x, y, z, turn, length) {
  const buf = await (await fetch('models/car/car.bin')).arrayBuffer(), hl = new DataView(buf).getUint32(0, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))), n = head.verts, pad = v => (v + 3) & ~3;
  let off = 4 + hl; const q = new Int16Array(buf, off, n * 3); off += pad(n * 6); const nq = new Int8Array(buf, off, n * 3); off += pad(n * 3); const cq = new Uint8Array(buf, off, n * 3); off += pad(n * 3); const idx = new Uint32Array(buf, off);
  const k = head.scale * length / head.size[2], pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) { pos[i] = q[i] * k; nor[i] = nq[i] / 127; const c = cq[i] / 255; col[i] = c * c; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  head.groups.forEach(([s, c], i) => g.addGroup(s, c, i));
  const mesh = new THREE.Mesh(g, [sheen({ vertexColors: true }, 'paint'), sheen({ vertexColors: true }, 'plastic')]); mesh.position.set(x, y, z); mesh.rotation.y = turn; scene.add(mesh); return mesh;
}

// Many parked cars at once from the lighter copy (car_lite.bin): one draw per material for the whole car park, each car its own paint.
// list: [{ x, z, turn, color }]
export async function loadParkedCars(scene, list) {
  const buf = await (await fetch('models/car/car_lite.bin')).arrayBuffer(), hl = new DataView(buf).getUint32(0, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))), n = head.verts, pad = v => (v + 3) & ~3;
  let off = 4 + hl; const q = new Int16Array(buf, off, n * 3); off += pad(n * 6); const nq = new Int8Array(buf, off, n * 3); off += pad(n * 3); const cq = new Uint8Array(buf, off, n * 3); off += pad(n * 3); const idx = new Uint32Array(buf, off);
  const k = head.scale * 4.4 / head.size[2], pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) { pos[i] = q[i] * k; nor[i] = nq[i] / 127; const c = cq[i] / 255; col[i] = c * c; }
  let ymin = Infinity; for (let i = 1; i < n * 3; i += 3) ymin = Math.min(ymin, pos[i]); for (let i = 1; i < n * 3; i += 3) pos[i] -= ymin;   // wheels on the ground
  const group = new THREE.Group(), m = new THREE.Matrix4(), qt = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), white = new THREE.Color(1, 1, 1);
  head.groups.forEach(([s, c], gi) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(new THREE.BufferAttribute(idx.slice(s, s + c), 1));
    const im = new THREE.InstancedMesh(g, sheen({ vertexColors: true }, gi === 0 ? 'paint' : 'plastic'), list.length);
    list.forEach((c2, i) => { m.compose(new THREE.Vector3(c2.x, 0, c2.z), qt.setFromAxisAngle(Y, c2.turn), one); im.setMatrixAt(i, m); im.setColorAt(i, gi === 0 ? new THREE.Color(c2.color) : white); });
    im.castShadow = im.receiveShadow = true; group.add(im);
  });
  scene.add(group); return group;
}
