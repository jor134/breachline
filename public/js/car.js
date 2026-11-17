// The mansion's sports car: a baked, texture-free copy of the Khronos "Car Concept" sample (see models/car/LICENSE.md). One mesh, two materials.
import * as THREE from '../vendor/three.module.min.js';
import { sheen, envMap, pbrMats } from './mats.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
export async function loadCar(scene, x, y, z, turn, length) {
  const buf = await (await fetch('models/car/car.bin')).arrayBuffer(), hl = new DataView(buf).getUint32(0, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))), n = head.verts, pad = v => (v + 3) & ~3;
  let off = 4 + hl; const q = new Int16Array(buf, off, n * 3); off += pad(n * 6); const nq = new Int8Array(buf, off, n * 3); off += pad(n * 3); const cq = new Uint8Array(buf, off, n * 3); off += pad(n * 3); const idx = new Uint32Array(buf, off);
  const k = head.scale * length / head.size[2], pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) { pos[i] = q[i] * k; nor[i] = nq[i] / 127; const c = cq[i] / 255; col[i] = c * c; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  head.groups.forEach(([s, c], i) => g.addGroup(s, c, i));
  const mesh = new THREE.Mesh(g, [sheen({ vertexColors: true }, 'paint'), sheen({ vertexColors: true }, 'plastic')]); mesh.position.set(x, y, z); mesh.rotation.y = turn; scene.add(mesh); return mesh;
}

// Parked cars from the car pack (models/car/pack.glb, "Generic passenger car pack" by Comrade1280, built by tools/car_pack.py): each kind's
// parts are merged by material, then every kind on the map is drawn as one instanced mesh per material, however many of it are parked.
// list: [{ x, z, turn, kind }] (core/maps/cars.js gives each spot its kind)
let packP = null;
const loadPack = () => packP || (packP = new Promise((res, rej) => new GLTFLoader().load('models/car/pack.glb', gl => {
  const kinds = {}; gl.scene.updateMatrixWorld(true);
  for (const car of gl.scene.children) {
    const by = new Map(); car.traverse(o => { if (!o.isMesh) return; const g = o.geometry.clone().applyMatrix4(o.matrixWorld); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      const mt = o.material; if (!by.has(mt)) by.set(mt, []); by.get(mt).push(g); });
    kinds[car.name] = [...by].map(([mt, gs]) => { mt.envMap = envMap; mt.userData.env = mt.envMapIntensity = 0.5; if (!pbrMats.includes(mt)) pbrMats.push(mt); if (mt.transparent) mt.depthWrite = false; return [mergeGeometries(gs), mt]; });
  }
  res(kinds);
}, undefined, rej)));
export async function loadParkedCars(scene, list) {
  const kinds = await loadPack(), group = new THREE.Group(), m = new THREE.Matrix4(), qt = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const byKind = new Map(); for (const c of list) { const k = kinds[c.kind] ? c.kind : 'sedan'; if (!byKind.has(k)) byKind.set(k, []); byKind.get(k).push(c); }
  for (const [k, cars] of byKind) for (const [geo, mt] of kinds[k]) {
    const im = new THREE.InstancedMesh(geo, mt, cars.length);
    cars.forEach((c, i) => { m.compose(new THREE.Vector3(c.x, 0, c.z), qt.setFromAxisAngle(Y, c.turn), one); im.setMatrixAt(i, m); });
    im.castShadow = !mt.transparent; im.receiveShadow = true; group.add(im);
  }
  scene.add(group); return group;
}
