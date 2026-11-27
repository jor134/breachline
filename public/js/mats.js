// Surfaces: every lit material is made here so each gets a highlight and a little reflection of its surroundings
// (same approach as Kerbside: Phong shine + one tiny built-in reflection picture, cheap in the headset).
import * as THREE from '../vendor/three.module.min.js';
// Every 2D canvas the game paints its textures on is kept in ordinary memory (willReadFrequently). A GPU-backed canvas loses its
// picture when the headset's GPU process resets under memory pressure (busy multiplayer rounds on the big maps); three.js then
// re-sends textures from canvases that have gone blank and every surface comes up white. Patched here, before any canvas is made.
if (typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.__blCtx) {
  const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.__blCtx = true;
  HTMLCanvasElement.prototype.getContext = function (type, opts) { return get.call(this, type, type === '2d' ? Object.assign({ willReadFrequently: true }, opts) : opts); };
}
export const GLOSS = { // shininess, highlight brightness, reflection strength
  paint: [110, 0.75, 0.3], glass: [170, 1.0, 1.0], water: [160, 1.0, 0.38], metal: [70, 0.7, 0.26], polished: [48, 0.45, 0.16], plastic: [40, 0.35, 0.1],
  satin: [22, 0.18, 0.05], stone: [16, 0.14, 0.03], cloth: [8, 0.07, 0], matte: [4, 0.03, 0],
};
// The reflection picture follows where you are: indoors a ceiling of pot lights over dim walls; outdoors the sky with one light
// in it, the sun by day and at dusk, the moon at night (none under cloud). gfx.js sets the sky (setEnvSky), the game says
// whether you are inside (setEnvInside); the six 64 px faces are only redrawn when one of those changes.
const ENV = { inside: false, sun: [0.5, 0.45, 0.3], tod: 'dusk', cast: false, dark: false }, faces = [0, 1, 2, 3, 4, 5].map(() => { const c = document.createElement('canvas'); c.width = c.height = 64; return c; });
const SKY = { day: ['#6f9fd8', '#c9dcef', '#8a8f94', '#2a2c2f'], dusk: ['#3d4a60', '#a8978c', '#3a3f45', '#15171a'], night: ['#0b1020', '#1d2433', '#14171c', '#07080a'] };
// the direction a face pixel looks along (faces in GL order +x -x +y -y +z -z; three.js mirrors x when it samples a cube texture)
function pixelDir(f, u, v) {
  const sc = u / 32 - 1, tc = v / 32 - 1, g = [[1, -tc, -sc], [-1, -tc, sc], [sc, 1, tc], [sc, -1, -tc], [sc, -tc, 1], [-sc, -tc, -1]][f], l = Math.hypot(...g);
  return [-g[0] / l, g[1] / l, g[2] / l];
}
// the sun or moon, worked out per pixel from the angle to it, so it stays round across the cube's seams
function skyLight(dir, size, rgb) {
  for (let f = 0; f < 6; f++) {
    const c = faces[f].getContext('2d'), im = c.getImageData(0, 0, 64, 64), d = im.data;
    for (let v = 0; v < 64; v++) for (let u = 0; u < 64; u++) {
      const q = pixelDir(f, u + 0.5, v + 0.5), cos = q[0] * dir[0] + q[1] * dir[1] + q[2] * dir[2]; if (cos < 0.8) continue;
      const a = Math.acos(Math.min(1, cos)), k = Math.exp(-((a / size) ** 2)) + 0.35 * Math.exp(-((a / (size * 3)) ** 2)), i = (v * 64 + u) * 4;
      for (let ch = 0; ch < 3; ch++) d[i + ch] = Math.min(255, d[i + ch] + rgb[ch] * k);
    }
    c.putImageData(im, 0, 0);
  }
}
function glow(c, x, y, r, col, core = '#ffffff') { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, core); g.addColorStop(0.25, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill(); }
function drawEnv() {
  const { inside, tod, cast, dark } = ENV;
  faces.forEach((cv, k) => {
    const c = cv.getContext('2d'); c.globalCompositeOperation = 'source-over';
    if (inside) {   // a room: dim walls, a dark floor, a ceiling with a grid of pot lights (off in a power cut)
      if (k === 2) { c.fillStyle = '#2b2824'; c.fillRect(0, 0, 64, 64); if (!dark) for (const u of [10, 32, 54]) for (const v of [10, 32, 54]) glow(c, u, v, 6, 'rgba(255,236,205,0.9)'); }
      else if (k === 3) { c.fillStyle = '#121110'; c.fillRect(0, 0, 64, 64); }
      else { const g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#35312c'); g.addColorStop(0.48, '#4b4640'); g.addColorStop(0.52, '#262320'); g.addColorStop(1, '#121110'); c.fillStyle = g; c.fillRect(0, 0, 64, 64);
        if (!dark) for (const [u, v, r] of [[16, 3, 3.5], [48, 3, 3.5], [32, 9, 2.6], [8, 13, 1.8], [56, 13, 1.8]]) glow(c, u, v, r, 'rgba(255,236,205,0.85)'); }   // further pot lights, low in the view the further they are
    } else {   // outdoors: the sky, the horizon, the ground; one light in the sky
      const [top, hor, low, gnd] = SKY[tod] || SKY.dusk, sky = cast ? ['#5c616b', '#7f848c', '#3a3d42', '#17181b'] : [top, hor, low, gnd];
      if (k === 2) { c.fillStyle = sky[0]; c.fillRect(0, 0, 64, 64); } else if (k === 3) { c.fillStyle = sky[3]; c.fillRect(0, 0, 64, 64); }
      else { const g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, sky[0]); g.addColorStop(0.46, sky[1]); g.addColorStop(0.52, sky[2]); g.addColorStop(1, sky[3]); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }
    }
  });
  if (!inside && !cast) {   // the sun or the moon, where the scene's own light comes from
    if (tod === 'night') skyLight(ENV.sun, 0.05, [215, 225, 250]); else skyLight(ENV.sun, tod === 'day' ? 0.1 : 0.085, tod === 'day' ? [255, 248, 230] : [255, 205, 150]);
  }
  const t = ENV.inside ? envIn : envMap;   // copy into the cube for this side of the door
  t.image.forEach((cv, k) => { const c = cv.getContext('2d'); c.clearRect(0, 0, 64, 64); c.drawImage(faces[k], 0, 0); });
  t.needsUpdate = true; t.userData.key = envKey();
}
// Two reflection cubes, outdoors and indoors, each drawn once per sky: walking through a door swaps which one the materials use
// instead of redrawing, because a redraw makes three.js rebuild the blurred reflections of every shiny model (a GPU hitch).
const cube = () => { const t = new THREE.CubeTexture([0, 1, 2, 3, 4, 5].map(() => { const c = document.createElement('canvas'); c.width = c.height = 64; return c; })); t.colorSpace = THREE.SRGBColorSpace; return t; };
const envKey = () => [ENV.sun.join(), ENV.tod, ENV.cast, ENV.dark].join('|');
export const envMap = cube(), envIn = cube();
drawEnv();
function useEnv() {
  const t = ENV.inside ? envIn : envMap; if (t.userData.key !== envKey()) drawEnv();
  for (const m of all) if (m.envMap === envMap || m.envMap === envIn) m.envMap = t;
  for (const m of pbrMats) if (m.envMap === envMap || m.envMap === envIn) m.envMap = t;
  syncCheap();
}
// Redrawing the sky cube re-uploads six faces and makes three.js rebuild the blurred reflection maps of every shiny model, a
// heavy GPU job: only do it when the sky actually changed.
export function setEnvSky(sunDir, tod, cast, dark) { const l = Math.hypot(...sunDir) || 1, sun = sunDir.map(v => v / l);
  if (ENV.sun && sun.every((v, i) => v === ENV.sun[i]) && ENV.tod === tod && ENV.cast === !!cast && ENV.dark === !!dark) return;
  ENV.sun = sun; ENV.tod = tod; ENV.cast = !!cast; ENV.dark = !!dark; useEnv(); }
export function setEnvInside(inside) { if (!!inside === ENV.inside) return; ENV.inside = !!inside; useEnv(); }
export function sheen(params, gloss = 'satin') {
  const m = new THREE.MeshPhongMaterial(Object.assign({ combine: THREE.AddOperation }, params)), [shin, spec, refl] = GLOSS[gloss] || GLOSS.satin;
  m.shininess = shin; m.specular.setScalar(spec); if (refl > 0) { m.envMap = envMap; m.reflectivity = refl; } m.userData.spec = spec; m.userData.refl = refl; m.userData.gloss = gloss; all.push(m); return m;
}
// Performance-mode glass (store/gfxmode.js): the same tint, opacity and sky reflection, without the per-light shading. Glass walls
// fill whole views in the terminal and the casino, and each lit pane cost the full lighting sum per pixel.
const cheap = new Map();
export function cheapGlass(m) {
  let c = cheap.get(m); if (c) return c;
  c = new THREE.MeshBasicMaterial({ color: m.color, map: m.map, transparent: m.transparent, opacity: m.opacity, side: m.side, depthWrite: m.depthWrite, envMap: m.envMap, combine: THREE.AddOperation, reflectivity: m.reflectivity, fog: m.fog });
  c.color = m.color; c.userData.src = m; c.name = m.name; cheap.set(m, c); return c;
}
const syncCheap = () => { for (const [m, c] of cheap) { c.envMap = m.envMap; c.reflectivity = m.reflectivity; c.opacity = m.opacity; } };
const all = [];
// Reflections picture a lit dusk scene, so they are turned down when the lights go out.
export const pbrMats = [];   // downloaded models keep their PBR materials; their reflections dim with the lights too
export function setGlossLevel(k) { for (const m of pbrMats) m.envMapIntensity = m.userData.env * k; for (const m of all) { m.reflectivity = m.userData.refl * k; m.specular.setScalar(m.userData.spec * (0.35 + 0.65 * k)); } syncCheap(); }
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
