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

// The sight's printed reticle is a small cut-out patch in the colour texture (pixels 456-494 x 461-495 of 512): clear it to
// fully transparent so only the game's own reticle shows. Everything else in the texture (housing, glass tint) is kept.
function eraseReticle(tex) {
  const img = tex.image; if (!img || !img.width) return tex;
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const sx = img.width / 512, sy = img.height / 512; g.clearRect(456 * sx, 461 * sy, 38 * sx, 34 * sy);
  const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.channel = tex.channel; t.anisotropy = tex.anisotropy; return t;
}
export function loadM4() {
  return promise || (promise = new Promise((res, rej) => new GLTFLoader().load('models/m4/m4.glb', g => {
    const root = new THREE.Group(), body = new THREE.Group(), magParts = [];
    root.rotation.y = Math.PI; root.scale.setScalar(M4.s); root.position.set(0, M4.oy, M4.oz); body.add(root);
    g.scene.updateMatrixWorld(true);
    const meshes = []; g.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
    for (const o of meshes) {
      const m = o.material; m.envMap = envMap; m.userData.env = m.envMapIntensity = 0.55; pbrMats.push(m);
      if (m.emissiveMap) { m.emissiveMap = null; m.emissive.set(0); m.opacity = Math.min(m.opacity, 1); if (m.map) m.map = eraseReticle(m.map); }   // sight: drop the baked reticle (its glow, and the printed ring in the colour texture); housing and glass stay
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

// Sidearm: "tactical pistol with red dot" by N3ON_fx (Sketchfab Standard licence, see models/pistol/LICENSE.md): a .22 target pistol
// with an integral suppressor, a red dot on the receiver and a light under the barrel. It is measured from its own parts when it
// loads and turned to the gun frame: muzzle toward -z, the bore 4 cm over the hand, the grip panels' middle where the hand holds.
// The bolt knob at the back of the receiver is the part that locks back on an empty gun; the magazine shows in the grip.
const SIDE = { h: 0.166, bore: 0.040, gripZ: 0.022 };   // overall height (grip foot to the top of the sight), bore over the hand, the grip's middle
let fnPromise = null;
export function loadSidearm() {
  return fnPromise || (fnPromise = new Promise((res, rej) => new GLTFLoader().load('models/pistol/pistol.glb', g => {
    const sc = g.scene; sc.updateMatrixWorld(true); const part = n => { let m = null; sc.traverse(o => { if (o.isMesh && o.parent && o.parent.name === n) m = o; }); return m; };
    const box = o => new THREE.Box3().setFromObject(o), all = box(sc), k = SIDE.h / (all.max.y - all.min.y);
    const rec = box(part('pCylinder6')), grip = box(part('pCube14')).union(box(part('pCube16'))), barrel = box(part('pCylinder8')), dot = box(part('pCube10')), lightB = box(part('pCube13'));
    const boreY = (rec.min.y + rec.max.y) / 2, gz = (grip.min.z + grip.max.z) / 2, cx = (all.min.x + all.max.x) / 2;
    // model -> gun frame: centre it, turn it round (its muzzle is toward +z), scale it, put the bore and the grip where the hand expects them
    const T = new THREE.Matrix4().makeTranslation(0, SIDE.bore, SIDE.gripZ).multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(new THREE.Matrix4().makeRotationY(Math.PI)).multiply(new THREE.Matrix4().makeTranslation(-cx, -boreY, -gz));
    const at = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(T);
    const frame = new THREE.Group(), slide = new THREE.Group(); let plate = null;
    sc.traverse(o => { if (!o.isMesh) return; const m = o.material; m.envMap = envMap; m.userData.env = m.envMapIntensity = 0.5; if (!pbrMats.includes(m)) pbrMats.push(m);
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld).applyMatrix4(T), n = o.parent.name;
      if (n === 'pCube15') plate = { geo, mat: m }; else (n === 'pCylinder7' ? slide : frame).add(new THREE.Mesh(geo, m)); });
    const pts = { muzzle: at(cx, boreY, barrel.max.z), light: at(cx, (lightB.min.y + lightB.max.y) / 2, lightB.max.z), magwell: at(cx, all.min.y, gz), rack: at(cx, boreY, rec.min.z),
      sightY: at(cx, (dot.min.y + dot.max.y) / 2, 0).y, sightZ: at(cx, 0, (dot.min.z + dot.max.z) / 2).z, sightW: (dot.max.x - dot.min.x) * k * 0.36, sightH: (dot.max.y - dot.min.y) * k * 0.3 };
    res({ frame, slide, plate, pts });
  }, undefined, rej)));
}

