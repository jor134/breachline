// The city round a map at night: dark towers with a scatter of lit windows, the casino's skyline texture. Shared by the stadium and
// the club. Each tower's texture coordinates follow its size, so every building has windows of the same size (2.2 m bays, 3.75 m floors).
import * as THREE from '../../vendor/three.module.min.js';

let tex = null;
const mkTex = () => {
  let s = 77; const rr = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#0d0e14'; g.fillRect(0, 0, 128, 256);
  for (let y = 4; y < 256; y += 8) for (let x = 3; x < 128; x += 7) if (rr() < 0.38) { g.fillStyle = rr() < 0.75 ? '#c9a46a' : '#8fa6d0'; g.fillRect(x, y, 4, 4); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
};
export function skylineMat() { tex = tex || mkTex(); return new THREE.MeshBasicMaterial({ map: tex, fog: false }); }
// a tower w wide, h tall, d deep, standing on y = 0
export function tower(w, h, d, mat) {
  const geo = new THREE.BoxGeometry(w, h, d); geo.translate(0, h / 2, 0);
  const uv = geo.attributes.uv;   // faces: +x, -x, +y, -y, +z, -z (4 corners each)
  const off = (w * 3.7 + d * 1.3 + h) % 1;               // so neighbours do not show the same pattern
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k; if (f === 2 || f === 3) { uv.setXY(i, 0.01, 0.01); continue; }
    const across = f < 2 ? d : w; uv.setXY(i, off + uv.getX(i) * across / 40, off * 0.5 + uv.getY(i) * h / 120);
  }
  uv.needsUpdate = true; return new THREE.Mesh(geo, mat);
}
