// The club's dancers and its DJ (models/club/dancers, tools/dancers_glb.py): every dancer is one instance of one of five people,
// each person one instanced mesh whose baked dance poses are morph targets: two poses blended at a time per dancer, played
// forwards then back, each dancer at their own point in the dance and a little faster or slower. The DJ is the sixth, alone at
// her booth. They are unaware of the raid and keep dancing all mission (the map makes each one a column you go round).
import * as THREE from '../../vendor/three.module.min.js';
import { ObfLoader } from '../store/obf.js';
import { envMap, pbrMats } from '../mats.js';
import { DANCERS, DJ, STAGE } from '../core/maps/club.js';

const POSES = 32, POSE_T = 0.2;
// four people in two dances each (three for the older woman: one), and the three dancers in their own
const TYPES = ['man1_belly', 'man1_samba', 'man2_girl', 'man2_tifa', 'woman1_gina', 'woman1_samba', 'woman2_tifa', 'belly', 'samba', 'gina'], SHARE = [0.12, 0.12, 0.12, 0.12, 0.1, 0.1, 0.06, 0.09, 0.09, 0.08];
let seed = 5; const rr = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

export function makeDancers(root) {
  seed = 5; const C = { group: new THREE.Group(), list: [], types: [], t: 0, acc: 0, ready: false };
  C.group.name = 'dancers'; root.add(C.group);
  for (const [x, z, face] of DANCERS) { let u = rr(), k = 0; while (k < SHARE.length - 1 && u > SHARE[k]) { u -= SHARE[k]; k++; } C.list.push({ x, z, face, type: k, ph: rr() * POSES * 2, rate: 0.85 + rr() * 0.3, k: 0.94 + rr() * 0.1 }); }
  C.list.push({ x: DJ.x, z: DJ.z, face: DJ.face, type: TYPES.length, ph: 0, rate: 1, k: 1, y: STAGE.h + 0.47 });   // the DJ, on her booth's riser
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), dummy = { morphTargetInfluences: new Float32Array(POSES - 1) };
  C.load = () => new Promise(res => new ObfLoader().load('models/club/dancers.glb', gl => {
    const byName = {}; gl.scene.traverse(o => { if (o.isMesh) byName[o.name] = o; });
    [...TYPES, 'dj'].forEach((n, t) => {
      const src = byName[n], list = C.list.filter(d => d.type === t); if (!src || !list.length) return;
      const mt = src.material; mt.side = THREE.DoubleSide; mt.envMap = envMap; mt.userData.env = mt.envMapIntensity = 0.25; if (!pbrMats.includes(mt)) pbrMats.push(mt);
      const im = new THREE.InstancedMesh(src.geometry, mt, list.length); im.castShadow = false; im.receiveShadow = false;
      list.forEach((d, i) => { d.i = i; e.set(0, d.face, 0); q.setFromEuler(e); m4.compose(p3.set(d.x, d.y || 0, d.z), q, s3.setScalar(d.k)); im.setMatrixAt(i, m4); im.setMorphAt(i, dummy); });
      im.computeBoundingSphere(); C.group.add(im); C.types[t] = { im, list };
    });
    C.ready = true; res(null);
  }, undefined, () => res(null)));
  // poses at 30 Hz (the dancers far from you at 15)
  C.tick = (dt, head) => {
    C.t += dt; if (!C.ready || (C.acc += dt) < 1 / 30) return; const step = C.acc; C.acc = 0; C.odd = !C.odd;
    for (const T of C.types) { if (!T) continue; let any = false;
      for (const d of T.list) {
        if (C.odd && head && Math.hypot(d.x - head.x, d.z - head.z) > 14) continue; any = true;
        const raw = (C.t * d.rate / POSE_T + d.ph) % (2 * (POSES - 1)), u = raw < POSES - 1 ? raw : 2 * (POSES - 1) - raw, a = Math.floor(u), w = u - a;
        dummy.morphTargetInfluences.fill(0); if (a > 0) dummy.morphTargetInfluences[a - 1] = 1 - w; if (a + 1 < POSES) dummy.morphTargetInfluences[a] = w; T.im.setMorphAt(d.i, dummy); }
      if (any && T.im.morphTexture) T.im.morphTexture.needsUpdate = true; }
  };
  return C;
}
