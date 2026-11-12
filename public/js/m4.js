// Officers' rifle: the downloaded M4A1 (bobeer, CC BY 4.0, see models/m4/LICENSE.md), loaded once and shared.
// The model is in centimetres with the muzzle toward +z; it is turned to the game's gun frame (muzzle -z, origin at the top of the pistol grip).
// The magazine is cut out of the receiver mesh so it can drop out and go back in. The sight's printed reticle is switched off:
// the game draws its own reticle that sits on the point of aim (actors.js).
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { envMap, pbrMats } from './mats.js';

export const M4 = { s: 0.01, oy: 0, oz: -0.143 };   // gun = (-x, y, -z) * s + (0, oy, oz)
let promise = null;
const inMag = (x, y, z) => y < 0.6 && z > -7.2 && z < 6.5;   // model units (cm): the magazine below the mag well

export function loadM4() {
  return promise || (promise = new Promise((res, rej) => new GLTFLoader().load('models/m4/m4.glb', g => {
    const root = new THREE.Group(), body = new THREE.Group(), magParts = [];
    root.rotation.y = Math.PI; root.scale.setScalar(M4.s); root.position.set(0, M4.oy, M4.oz); body.add(root);
    g.scene.updateMatrixWorld(true);
    const meshes = []; g.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
    for (const o of meshes) {
      const m = o.material; m.envMap = envMap; m.userData.env = m.envMapIntensity = 0.55; pbrMats.push(m);
      if (m.emissiveMap) { m.emissiveMap = null; m.emissive.set(0); m.opacity = Math.min(m.opacity, 1); }   // sight: drop the baked reticle
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld), mesh = new THREE.Mesh(geo, m);
      if (m.name === 'lambert1') {   // split the magazine triangles out of the receiver
        const P = geo.attributes.position, I = geo.index.array, keep = [], mag = [];
        for (let t = 0; t < I.length; t += 3) { let x = 0, y = 0, z = 0; for (let k = 0; k < 3; k++) { x += P.getX(I[t + k]); y += P.getY(I[t + k]); z += P.getZ(I[t + k]); } (inMag(x / 3, y / 3, z / 3) ? mag : keep).push(I[t], I[t + 1], I[t + 2]); }
        if (mag.length) { const mg = geo.clone(); mg.setIndex(mag); magParts.push(mg); geo.setIndex(keep); }
      }
      mesh.castShadow = true; root.add(mesh);
    }
    let magGeo = null, magMat = meshes.find(o => o.material.name === 'lambert1').material;
    if (magParts.length) { magGeo = magParts.length === 1 ? magParts[0] : mergeIdx(magParts); magGeo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(0, M4.oy, M4.oz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI), new THREE.Vector3(M4.s, M4.s, M4.s))); }
    let magLoose = null; if (magGeo) { magLoose = magGeo.clone(); magLoose.computeBoundingBox(); const b = magLoose.boundingBox; magLoose.translate(-(b.min.x + b.max.x) / 2, 0.065 - b.max.y, -(b.min.z + b.max.z) / 2); }
    res({ body, magGeo, magMat, magLoose });
  }, undefined, rej)));
}
function mergeIdx(list) {   // same vertex layout (each is a clone of one part): stitch index + attributes
  const out = new THREE.BufferGeometry(), names = Object.keys(list[0].attributes); let base = 0; const idx = [];
  for (const n of names) { const a = list[0].attributes[n], arr = new a.array.constructor(list.reduce((s, g) => s + g.attributes[n].array.length, 0)); let o = 0; for (const g of list) { arr.set(g.attributes[n].array, o); o += g.attributes[n].array.length; } out.setAttribute(n, new THREE.BufferAttribute(arr, a.itemSize, a.normalized)); }
  for (const g of list) { for (const i of g.index.array) idx.push(i + base); base += g.attributes.position.count; }
  out.setIndex(idx); return out;
}
