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

// Sidearm: FN 509 with red-dot and weapon light ("FN509 Pistol" by Lokeig, CC BY-NC 4.0, see models/m4/LICENSE.md).
// Model units are about 0.13 mm with the muzzle toward +x; it is turned to the gun frame (muzzle -z) with the top of the grip near the origin.
// The slide is cut out so it can lock back, and the magazine floor plate so an empty gun shows the open well.
export const FN = { s: 0.215 / 1684, oy: 0.046, oz: -0.0566, cz: 59 };
let fnPromise = null;
export function loadFN509() {
  return fnPromise || (fnPromise = new Promise((res, rej) => new GLTFLoader().load('models/m4/fn509.glb', g => {
    g.scene.updateMatrixWorld(true); const meshes = []; g.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
    const top = meshes.find(o => o.material.name === 'Material_4'), inv = new THREE.Matrix4().copy(top.matrixWorld).invert();
    const T = new THREE.Matrix4().makeTranslation(0, FN.oy, FN.oz).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)).multiply(new THREE.Matrix4().makeScale(FN.s, FN.s, FN.s)).multiply(new THREE.Matrix4().makeTranslation(0, 0, -FN.cz));
    const frame = new THREE.Group(), slide = new THREE.Group(); let plate = null;
    for (const o of meshes) {
      const m = o.material; m.envMap = envMap; m.userData.env = m.envMapIntensity = 0.5; if (!pbrMats.includes(m)) pbrMats.push(m);
      if (m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = 0.3; m.depthWrite = false; }   // the optic's glass: plain transparency, not a second render pass
      const geo = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));   // in the slide's own frame (model units)
      if (o === top) {
        const P = geo.attributes.position, I = geo.index.array, sl = [], pl = [], fr = [];
        for (let t = 0; t < I.length; t += 3) { let y = 0; for (let k = 0; k < 3; k++) y += P.getY(I[t + k]); y /= 3; (y > -105 ? sl : y < -975 ? pl : fr).push(I[t], I[t + 1], I[t + 2]); }
        const part = idx => { const c = geo.clone(); c.setIndex(idx); c.applyMatrix4(T); return c; };
        frame.add(new THREE.Mesh(part(fr), m)); slide.add(new THREE.Mesh(part(sl), m)); plate = { geo: part(pl), mat: m };
      } else (o.material.name === 'Material_26' || o.material.name === 'Material_37' ? slide : frame).add(new THREE.Mesh(geo.applyMatrix4(T), m));   // the optic rides on the slide, the light on the frame
    }
    res({ frame, slide, plate });
  }, undefined, rej)));
}
