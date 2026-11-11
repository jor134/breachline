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
