// Vegetation: CC0 low-poly models (see models/nature/LICENSE.md), every plant baked into one mesh so the whole garden is a single draw call.
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { sheen } from './mats.js';

export async function loadVegetation(scene, map) {
  const VEG = map.veg, terrainY = map.terrainY, H = map.H; if (!VEG) return null;
  const loader = new GLTFLoader(), names = [...new Set([...VEG.trees, ...VEG.shrubs].map(v => v[2]).concat(VEG.pots.map(p => p[3])))], models = {};
  await Promise.all(names.map(async n => {
    try {
      const g = await loader.loadAsync('models/nature/' + n + '.glb'); g.scene.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(g.scene), parts = [];
      g.scene.traverse(o => { if (o.isMesh) { const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry; parts.push({ pos: geo.attributes.position, nor: geo.attributes.normal, m: o.matrixWorld.clone(), color: o.material.color.clone() }); } });
      models[n] = { parts, minY: box.min.y, h: Math.max(0.01, box.max.y - box.min.y) };
    } catch (e) { console.warn('missing plant model', n); }
  }));
  const pos = [], nor = [], col = [], M = new THREE.Matrix4(), I = new THREE.Matrix4(), N = new THREE.Matrix3(), v = new THREE.Vector3(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
  let k = 0; const jit = () => { k = (k * 16807 + 7) % 2147483647; return k / 2147483647; };
  const add = (name, x, y, z, height, turn) => {
    const m = models[name]; if (!m) return; const s = height / m.h, shade = 0.8 + jit() * 0.5;
    I.compose(v.set(x, y - m.minY * s, z), q.setFromAxisAngle(UP, turn), new THREE.Vector3(s, s, s));
    for (const p of m.parts) {
      M.multiplyMatrices(I, p.m); N.getNormalMatrix(M); const green = p.color.g > p.color.r * 1.3, b = green ? 2.1 * shade : 1.6;   // the pack's greens are very dark; lift them for dusk
      for (let i = 0; i < p.pos.count; i++) { v.fromBufferAttribute(p.pos, i).applyMatrix4(M); pos.push(v.x, v.y, v.z); if (p.nor) v.fromBufferAttribute(p.nor, i).applyMatrix3(N).normalize(); else v.set(0, 1, 0); nor.push(v.x, v.y, v.z); col.push(p.color.r * b, p.color.g * b, p.color.b * b); }
    }
  };
  for (const [x, z, name, h, turn] of VEG.trees) add(name, x, terrainY(z) - 0.05, z, h, turn);
  for (const [x, z, name, h] of VEG.shrubs) add(name, x, terrainY(z) - 0.03, z, h, jit() * 6.28);
  for (const [f, x, z, name, h] of VEG.pots) add(name, x, f * H + 0.46, z, h, jit() * 6.28);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, sheen({ vertexColors: true, side: THREE.DoubleSide }, 'matte')); mesh.matrixAutoUpdate = false; scene.add(mesh);
  return { mesh, verts: pos.length / 3, models: Object.keys(models).length };
}
