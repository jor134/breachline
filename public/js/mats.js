// Surfaces: every lit material is made here so each gets a highlight and a little reflection of its surroundings
// (same approach as Kerbside: Phong shine + one tiny built-in reflection picture, cheap in the headset).
import * as THREE from '../vendor/three.module.min.js';
export const GLOSS = { // shininess, highlight brightness, reflection strength
  paint: [110, 0.75, 0.3], glass: [140, 1.0, 0.55], water: [160, 1.0, 0.38], metal: [70, 0.7, 0.26], polished: [48, 0.45, 0.16], plastic: [40, 0.35, 0.1],
  satin: [22, 0.18, 0.05], stone: [16, 0.14, 0.03], cloth: [8, 0.07, 0], matte: [4, 0.03, 0],
};
export const envMap = (() => {
  const face = k => { // 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z : a dusk sky with warm interior light strips
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
    if (k === 2) { c.fillStyle = '#3d4a60'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#ffe9c8'; c.fillRect(8, 14, 48, 7); c.fillRect(8, 42, 48, 7); }
    else if (k === 3) { c.fillStyle = '#15171a'; c.fillRect(0, 0, 64, 64); }
    else { const g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#3d4a60'); g.addColorStop(0.44, '#a8978c'); g.addColorStop(0.52, '#3a3f45'); g.addColorStop(1, '#15171a'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); if (k === 0 || k === 5) { c.fillStyle = '#fff2dc'; c.fillRect(20, 8, 24, 10); } }
    return cv;
  };
  const t = new THREE.CubeTexture([0, 1, 2, 3, 4, 5].map(face)); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
})();
export function sheen(params, gloss = 'satin') {
  const m = new THREE.MeshPhongMaterial(Object.assign({ combine: THREE.AddOperation }, params)), [shin, spec, refl] = GLOSS[gloss] || GLOSS.satin;
  m.shininess = shin; m.specular.setScalar(spec); if (refl > 0) { m.envMap = envMap; m.reflectivity = refl; } return m;
}
const vc = new Map();
export const vertexSheen = gloss => vc.get(gloss) || vc.set(gloss, sheen({ vertexColors: true }, gloss)).get(gloss);
let seed = 7; export const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
export function tex(base, speck, lines, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < speck; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.045)'; g.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 3, 1 + rnd() * 3); }
  if (lines) lines(g, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
export const grid = (nx, ny, col, off, shade) => (g, s) => {
  if (shade) for (let j = 0; j < ny; j++) for (let i = -1; i <= nx; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rnd() * shade})`; g.fillRect((i + (off && j % 2 ? 0.5 : 0)) * s / nx, j * s / ny, s / nx, s / ny); }
  g.strokeStyle = col; g.lineWidth = 2;
  for (let j = 0; j <= ny; j++) { g.beginPath(); g.moveTo(0, j * s / ny); g.lineTo(s, j * s / ny); g.stroke(); for (let i = 0; i <= nx; i++) { const x = (i + (off && j % 2 ? 0.5 : 0)) * s / nx; g.beginPath(); g.moveTo(x, j * s / ny); g.lineTo(x, (j + 1) * s / ny); g.stroke(); } }
};
