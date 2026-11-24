// Stadium scenery: the Harbour Arena, an invented football ground, at a live evening match under the floodlights. The bowl, roof and
// facades are the stadium model (models/stadium, tools/stadium_glb.py); this builds what the game plays in and around: the pitch and
// its markings, goals, LED boards and the big screens, the VIP block's two floors (club bar and eatery, glass-fronted suites), the club
// terrace, the roof catwalk with its davits and ropes, the helicopter, floodlight banks on the roof edge. The crowd and the players are
// stadium-crowd.js. Power cut (MAIN BREAKER) darkens the VIP level only: the floodlights are on the stadium's own supply.
import * as THREE from '../../vendor/three.module.min.js';
import { sheen, tex, grid, envMap, pbrMats } from '../mats.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { ObfLoader } from '../store/obf.js';
import { setRotor } from '../audio.js';
import { H, XC, ZC, PITCH, BLOCK, TERR, DECK, HELI, SHAFT, SUITES, WINX, ROPES, YC, YS, ROOF, FLY, inHeli } from '../core/maps/stadium.js';
import { makeCrowd } from './stadium-crowd.js';

let outside = [], outsideOn = true, tod = 'night', glows = [], heli = null, screens = null, crowd = null, inner = null, flood = [];
// lamps: [x, y, z, intensity, range] — the club, the suites, the terrace and the concourse
const LAMPS = [[24, YC + 3.2, 16.5, 12, 16], [12, YC + 3.2, 23, 8, 12], [36, YC + 3.2, 23, 8, 12], [30, YC + 3.2, 8, 7, 12], [49, YC + 3.0, 15, 7, 11],
  [11, YS + 3.0, 19, 6, 10], [21, YS + 3.0, 19, 6, 10], [31, YS + 3.0, 19, 7, 10], [41, YS + 3.0, 19, 6, 10], [51, YS + 3.0, 19, 6, 10], [30, YS + 3.0, 8, 5, 12], [3, YS + 3.0, 22, 5, 10]];
// the moon's (or low sun's) shadows cover the VIP block and the roof catwalk only (sunAt, shadow: 80 m across): over the whole
// bowl a shadow-map pixel was 9 cm, and thin things (the catwalk's rail posts) drew as stepped copies; here it is 4 cm
const NIGHT = {
  sky: [[0, '#05070f'], [0.3, '#0b1022'], [0.45, '#18203d'], [0.5, '#2b2f4a'], [0.53, '#121420'], [1, '#0e0f16']], skyR: 520, moon: [-150, 140, -100],
  fog: [0x10131d], fogD: [0.0016, 0.004], sunAt: [28, 18], sunFrom: [-30, 90, 60], shadow: 40, sunCol: 0xdfe8ff, sunK: 1.25, hemi: 1.15, hemiSky: 0xc6d2ec, hemiGround: 0x5a544c,
  hillColor: 0x07080d, lamps: LAMPS,
};
const DUSK = {
  sky: [[0, '#1b2350'], [0.28, '#3a3f7a'], [0.42, '#a0628a'], [0.475, '#f09a62'], [0.5, '#ffc98a'], [0.53, '#2a2330'], [1, '#18161d']], skyR: 520, moon: [140, 120, -160],
  fog: [0x40364e], fogD: [0.0018, 0.0045], sunAt: [28, 18], sunFrom: [-110, 40, 60], shadow: 40, sunCol: 0xffb37a, sunK: 1.1, hemi: 1.1, hemiSky: 0xbab4da, hemiGround: 0x625a52,
  hillColor: 0x1c1726, lamps: LAMPS,
};
// ---------- painted textures ----------
const cvs = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
let seed = 7; const rr = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
// the pitch: mown stripes across it, a little noise; one texture repeat = two stripes (11 m)
const grassTex = () => cvs(256, 256, (g, w, h) => { for (let x = 0; x < w; x++) { const s = x < w / 2 ? 0 : 1; for (let y = 0; y < h; y += 2) { const n = rr() * 14; g.fillStyle = s ? `rgb(${46 + n},${118 + n},${44 + n})` : `rgb(${56 + n},${136 + n},${50 + n})`; g.fillRect(x, y, 1, 2); } } });
const ledTex = () => cvs(1024, 64, (g, w, h) => { const cols = [['#0b2f6b', '#7fd0ff', 'HARBOUR ARENA'], ['#1a1a1a', '#ffd23a', 'MATCHDAY'], ['#6b0b1a', '#ffffff', 'WELCOME'], ['#0b4d2a', '#b9ffb0', 'HARBOUR ARENA']];
  cols.forEach(([bg, fg, t], i) => { const x = i * w / 4; const gr = g.createLinearGradient(x, 0, x + w / 4, 0); gr.addColorStop(0, bg); gr.addColorStop(1, '#05070c'); g.fillStyle = gr; g.fillRect(x, 0, w / 4, h); g.fillStyle = fg; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x + w / 8, h / 2 + 2); }); });
const panelTex = (base, line) => cvs(256, 256, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); g.fillStyle = line; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 2, h); for (let y = 0; y < h; y += 128) g.fillRect(0, y, w, 2); });
const woodSlats = () => cvs(256, 256, (g, w, h) => { for (let x = 0; x < w; x += 16) { const n = rr() * 30; g.fillStyle = `rgb(${120 + n},${84 + n * 0.7},${52 + n * 0.5})`; g.fillRect(x, 0, 14, h); g.fillStyle = '#2a1d12'; g.fillRect(x + 14, 0, 2, h); } });
const quiltTex = () => cvs(256, 256, (g, w, h) => { g.fillStyle = '#e9e3d6'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(120,108,90,0.45)'; g.lineWidth = 3; for (let i = -4; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + h, h); g.stroke(); g.beginPath(); g.moveTo(i * 32 + h, 0); g.lineTo(i * 32, h); g.stroke(); } });
function sign(text, bg = '#16181c', fg = '#f2f2ee', w = 512, h = 96) {
  return cvs(w, h, (g) => { if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; let f = Math.round(h * 0.62); g.font = `bold ${f}px sans-serif`; while (g.measureText(text).width > w * 0.92 && f > 10) { f -= 2; g.font = `bold ${f}px sans-serif`; } g.fillText(text, w / 2, h / 2 + 2); });
}
const plane = (root, text, w, h, x, y, z, ry, o = {}) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: sign(text, o.bg === undefined ? '#16181c' : o.bg, o.fg, o.pw, o.ph), transparent: o.bg === null })); m.position.set(x, y, z); m.rotation.y = ry; root.add(m); glows.push(m.material); m.material.userData.c = 0xffffff; return m; };
// the big screens: the score and the match clock (repainted once a match second)
function buildScreens(root) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 192; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({ map: t }); glows.push(m); m.userData.c = 0xffffff;
  const out = { c, t, m, last: -1, min: 63 };
  for (const [x, ry] of [[PITCH.x0 - 11, Math.PI / 2], [PITCH.x1 + 11, -Math.PI / 2]]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), m); s.position.set(x, 21, ZC); s.rotation.y = ry; root.add(s);
    const back = new THREE.Mesh(new THREE.BoxGeometry(16.6, 6.6, 0.4), new THREE.MeshLambertMaterial({ color: 0x15171c })); back.position.set(x - Math.sign(ry) * 0.25, 21, ZC); back.rotation.y = ry; root.add(back); }
  out.paint = (sec) => { const g = c.getContext('2d'); g.fillStyle = '#04060b'; g.fillRect(0, 0, 512, 192); g.fillStyle = '#0e2a5c'; g.fillRect(0, 0, 512, 52); g.fillStyle = '#e8eef8'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('HARBOUR  1  -  0  NORTHPORT', 256, 38);
    const mm = Math.floor(sec / 60), ss = sec % 60; g.fillStyle = '#ffd23a'; g.font = 'bold 92px monospace'; g.fillText(String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0'), 256, 150); t.needsUpdate = true; };
  out.paint(out.min * 60); return out;
}
// ---------- the helicopter (as in casino-gfx, in this map's frame) ----------
function buildHeli(MATS) {
  const g = new THREE.Group(), box = new THREE.Group(), body = sheen({ color: 0x1b2330 }, 'paint'), stripe = sheen({ color: 0x3a7ad8 }, 'paint'), dark = new THREE.MeshLambertMaterial({ color: 0x0e1014 }), metal = sheen({ color: 0x8a9098 }, 'metal');
  g.add(box);
  const bx = (w, h, d, x, y, z, m = body, to = box) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; to.add(o); return o; };
  const L = HELI.x1 - HELI.x0, D = HELI.z1 - HELI.z0, dl = HELI.door[0] - (HELI.x0 + HELI.x1) / 2, dr = HELI.door[1] - (HELI.x0 + HELI.x1) / 2;
  bx(L + 0.2, 0.3, D + 0.2, 0, -0.15, 0, dark); bx(L + 0.2, 0.3, D + 0.2, 0, 2.15, 0); bx(0.1, 2, D, -L / 2 - 0.05, 1, 0); bx(0.1, 2, D, L / 2 + 0.05, 1, 0); bx(L, 2, 0.1, 0, 1, -D / 2 - 0.05);
  bx(dl + L / 2, 2, 0.1, (-L / 2 + dl) / 2, 1, D / 2 + 0.05); bx(L / 2 - dr, 2, 0.1, (L / 2 + dr) / 2, 1, D / 2 + 0.05); bx(L + 0.22, 0.14, 0.04, 0, 0.55, D / 2 + 0.12, stripe);
  bx(2.0, 1.9, D, -L / 2 - 1.05, 0.95, 0); bx(1.1, 1.25, D - 0.2, -L / 2 - 2.4, 1.25, 0, MATS.glass); bx(L + 2.2, 0.5, D - 0.2, -1.0, -0.55, 0); bx(3.2, 0.7, 1.6, 0.3, 2.65, 0);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.55, 8, 10), body); boom.rotation.z = -Math.PI / 2; boom.position.set(L / 2 + 4, 1.4, 0); box.add(boom); bx(1.0, 1.7, 0.12, L / 2 + 7.8, 2.2, 0);
  bx(L - 0.6, 0.03, 0.08, 0, 1.86, 0, new THREE.MeshBasicMaterial({ color: 0xff3a2a }), g);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 })); beacon.position.set(L / 2 + 8.2, 3.1, 0); g.add(beacon);
  for (const z of [-1.25, 1.25]) { const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5.6, 8), metal); sk.rotation.z = Math.PI / 2; sk.position.set(-0.4, -1.1, z); box.add(sk); }
  bx(0.08, 0.08, 1.05, 0, 2.06, D / 2 + 0.5, metal, g);
  const rope = ROPES.find(r => r.heli), drop = rope.top + 2.06 - rope.bot - 0.05, rg = new THREE.CylinderGeometry(0.028, 0.028, drop, 6); rg.translate(0, -drop / 2, 0);
  const rp = new THREE.Mesh(rg, sheen({ color: 0x8c7a56 }, 'cloth')); rp.position.set(rope.x - (HELI.x0 + HELI.x1) / 2, 2.06, rope.z - (HELI.z0 + HELI.z1) / 2); g.add(rp);
  const rotor = new THREE.Group(); rotor.position.set(0.3, 3.2, 0); box.add(rotor); for (let k = 0; k < 4; k++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.05, 0.36), dark); bl.geometry.translate(3.1, 0, 0); bl.rotation.y = k * Math.PI / 2; rotor.add(bl); }
  const tail = new THREE.Group(); tail.position.set(L / 2 + 8.1, 2.4, 0.16); box.add(tail); for (let k = 0; k < 2; k++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.7, 0.03), dark); bl.rotation.z = k * Math.PI / 2; tail.add(bl); }
  g.position.set((HELI.x0 + HELI.x1) / 2, HELI.y, (HELI.z0 + HELI.z1) / 2);
  return { g, box, rotor, tail, beacon, rope: rp, idle: 0, gone: 0, home: g.position.clone() };
}
const furn = {
  clubbar({ P, len, dep, h }) {   // the long island bar: dark stone top, wood slat front, a lit strip under the top
    P('slats', 0.1, len - 0.1, 0.1, dep - 0.1, 0.1, h - 0.06); P('stoneD', 0, len, 0, dep, h - 0.06, h); P('glowW', 0.12, len - 0.12, dep - 0.12, dep - 0.08, h - 0.14, h - 0.08, 'Z'); P('fascia', 0.12, len - 0.12, 0.12, dep - 0.12, 0, 0.1);
  },
  backbar({ P, len, dep, h }) {   // shelves of bottles under a lit soffit
    P('slats', 0, len, 0, dep, 0, 0.95); P('stoneD', 0, len, 0, dep, 0.95, 1.0); P('glowW', 0, len, dep - 0.04, dep, 1.0, 1.02, 'Y');
    for (const y of [1.35, 1.75]) P('glass', 0.1, len - 0.1, 0.05, dep - 0.05, y, y + 0.02, 'Y'); for (let u = 0.2; u < len - 0.2; u += 0.22) { P(u % 0.66 < 0.22 ? 'bottleG' : 'bottleA', u, u + 0.08, 0.2, 0.28, 1.02, 1.3); P('bottleA', u + 0.05, u + 0.13, 0.25, 0.33, 1.37, 1.62); }
    P('slats', 0, len, 0, dep, h - 0.2, h);
  },
  stool({ P, len, dep, h }) { P('chrome', len / 2 - 0.03, len / 2 + 0.03, dep / 2 - 0.03, dep / 2 + 0.03, 0, h - 0.06); P('leatherW', 0, len, 0, dep, h - 0.07, h); P('chrome', 0.04, len - 0.04, 0.04, dep - 0.04, 0, 0.03); },
  vipseats({ P, len, dep, h }) {   // a row of padded seats (each 0.6 wide): pan and back
    const n = Math.max(1, Math.round(len / 0.62)), cw = len / n;
    for (let i = 0; i < n; i++) { const a = i * cw + 0.04, c = (i + 1) * cw - 0.04; P('seatB', a, c, 0.05, dep, 0.38, 0.48); P('seatB', a, c, 0, 0.12, 0.48, h); P('chrome', a + cw / 2 - 0.05, a + cw / 2 + 0.03, 0.2, 0.3, 0, 0.38); }
  },
  hvac({ P, len, dep, h }) { P('roofunit', 0, len, 0, dep, 0, h); P('grille', 0.1, len - 0.1, dep, dep + 0.02, 0.3, h - 0.2, 'Z'); },   // proud of the casing (flush, the two faces flickered)
};
export default {
  get env() { return tod === 'dusk' ? DUSK : NIGHT; },
  envs: { night: NIGHT, dusk: DUSK },
  setTod(t) { tod = t === 'dusk' ? 'dusk' : 'night'; },
  // the stadium model, the helicopter model and the crowd load after the scene is up
  load() {
    const shell = new Promise((res) => new ObfLoader().load('models/stadium/stadium.glb', gl => {
      outside = []; gl.scene.traverse(o => { if (!o.isMesh) return; if (/_ext$/.test(o.name)) outside.push(o); const m = o.material; m.side = THREE.DoubleSide; if (m.transparent) { m.depthWrite = false; o.renderOrder = 4; } else { o.receiveShadow = true; }
        m.envMap = envMap; m.userData.env = m.envMapIntensity = 0.25; if (!pbrMats.includes(m)) pbrMats.push(m); o.matrixAutoUpdate = false; o.updateMatrix(); });
      res(gl.scene);
    }, undefined, () => res(null)));
    return Promise.all([shell, this.loadHeli().catch(() => null), crowd ? crowd.load().catch(() => null) : null]).then(list => { const g = new THREE.Group(); for (const o of list) if (o) g.add(o); return g; });
  },
  loadHeli() {
    const h = heli; if (!h) return Promise.resolve(null);
    return new Promise((res, rej) => new GLTFLoader().load('models/heli/huey.glb', gl => {
      const src = gl.scene; src.updateMatrixWorld(true); const s0 = new THREE.Vector3().setFromMatrixScale(src.getObjectByName('Bell_Huey').matrixWorld).x / 0.01;
      src.scale.setScalar(1 / s0); src.updateMatrixWorld(true);
      const K = 1.05, FL = 0.46, CZ = -0.76, DOOR = { x: 0.9, y0: 0.52, y1: 2.3, z0: -2.0, z1: 1.2 };
      const M = new THREE.Matrix4().makeScale(K, K, K).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2)).multiply(new THREE.Matrix4().makeTranslation(0, -FL, -CZ));
      const m = new THREE.Group(), v = new THREE.Vector3(), c = new THREE.Vector3();
      const keep = (o, geo) => { const P = geo.attributes.position, I = geo.index, out = [];
        for (let t = 0; t < I.count; t += 3) { c.set(0, 0, 0); for (let k = 0; k < 3; k++) c.add(v.fromBufferAttribute(P, I.getX(t + k)).applyMatrix4(o.matrixWorld)); c.multiplyScalar(1 / 3);
          if (!(c.x > DOOR.x && c.y > DOOR.y0 && c.y < DOOR.y1 && c.z > DOOR.z0 && c.z < DOOR.z1)) out.push(I.getX(t), I.getX(t + 1), I.getX(t + 2)); }
        geo.setIndex(out); return geo; };
      const part = (o, piv) => { const geo = keep(o, o.geometry.clone()); geo.applyMatrix4(o.matrixWorld); geo.applyMatrix4(M); if (piv) geo.translate(-piv.x, -piv.y, -piv.z);
        const mt = o.material; mt.envMap = envMap; mt.userData.env = mt.envMapIntensity = 0.6; if (!pbrMats.includes(mt)) pbrMats.push(mt); if (mt.transparent) mt.depthWrite = false;
        mt.side = THREE.DoubleSide; const ms = new THREE.Mesh(geo, mt); ms.castShadow = ms.receiveShadow = !mt.transparent; return ms; };
      const pivot = n => new THREE.Vector3().setFromMatrixPosition(src.getObjectByName(n).matrixWorld).applyMatrix4(M);
      const top = pivot('Top_Rotor'), back = pivot('Back_Rotor'), rotor = new THREE.Group(), tail = new THREE.Group(); rotor.position.copy(top); tail.position.copy(back);
      src.traverse(o => { if (!o.isMesh) return; const n = o.parent.name; if (n === 'Top_Rotor') rotor.add(part(o, top)); else if (n === 'Back_Rotor') tail.add(part(o, back)); else m.add(part(o)); });
      m.add(rotor, tail);
      h.rotor = rotor; h.tail = tail; h.tailAx = 'z'; h.box.visible = false; h.beacon.position.set(8.7, 2.9, 0); h.g.add(m);
      res(new THREE.Group());
    }, undefined, rej));
  },
  noshade: { glowW: 1, flood: 1, pitchLine: 1, led: 1 },
  noCast: ['grass', 'pitchLine', 'terrazzo', 'oak', 'carpetB', 'carpetG', 'carpetO', 'tileK', 'deck', 'standC', 'chrome'],   // chrome: rails and davits, too thin for clean shadows
  tread: 'concrete',
  outer: () => 'standC',
  inner: w => w.f === 3 ? 'suiteW' : 'clubW',
  innerAt: (f, x, z) => {
    if (x < SHAFT.x1 && z < SHAFT.z1) return 'concW';
    if (f === 2) { if (x > 42 && z > 10) return 'tileW'; if (z < 10 || x < 6) return 'concW'; return 'clubW'; }
    if (z < 10) return 'corrW'; if (x < 6) return 'tileW'; return x > 26 && x < 36 ? 'quilt' : 'suiteW';
  },
  door: d => d.win ? 'winpane' : d.exterior ? 'glassdoor' : 'door',
  furn,
  // 'club', everything inside the club floor; 'suites', the suites floor: each hidden while you can't see it (gfx.js puts every piece
  // lying wholly inside one into its own meshes)
  zone(x, y, z, bb) {
    const a = bb ? bb.min : { x, y, z }, c = bb ? bb.max : { x, y, z }, inB = a.x >= BLOCK.x0 + 0.15 && c.x <= BLOCK.x1 - 0.15 && a.z >= BLOCK.z0 + 0.15 && c.z <= BLOCK.z1 - 0.15;
    if (inB && a.y >= YC - 0.05 && c.y <= YS - 0.05) return 'club';
    if (inB && a.y >= YS - 0.05 && c.y <= YS + H - 0.02) return 'suites';
    return null;
  },
  mats(M) {
    if (M.grass) return;
    const S = (t, gl) => sheen({ map: t }, gl);
    const g = grassTex(); g.repeat.set(1 / 11, 1 / 11);
    Object.assign(M, {
      grass: new THREE.MeshLambertMaterial({ map: g }), pitchLine: new THREE.MeshBasicMaterial({ color: 0xe8f0e4 }), turf: new THREE.MeshLambertMaterial({ color: 0x2f6a30 }),
      terrazzo: S(tex('#cfcac0', 3000, grid(2, 2, 'rgba(90,85,75,0.25)')), 'polished'), oak: S(tex('#7a5638', 6000, grid(8, 1, 'rgba(40,25,12,0.3)')), 'satin'),
      tileK: S(tex('#c9cdd0', 2000, grid(4, 4, 'rgba(60,64,68,0.4)')), 'polished'), steelfloor: S(tex('#6c7076', 2000, grid(8, 8, 'rgba(20,20,20,0.35)', true, 0.1)), 'metal'),
      carpetB: S(tex('#22304f', 6000), 'cloth'), carpetG: S(tex('#56544f', 6000, grid(6, 6, 'rgba(255,255,255,0.05)')), 'cloth'), carpetO: S(tex('#2c3a63', 6000, grid(3, 3, 'rgba(210,180,110,0.25)')), 'cloth'),
      concrete: M.concrete || S(tex('#8d8a84', 4000, grid(2, 2, 'rgba(40,38,34,0.35)')), 'stone'),
      clubW: S(panelTex('#1b2f6e', 'rgba(140,170,255,0.25)'), 'satin'), suiteW: S(tex('#e7e1d5', 300, grid(1, 1, 'rgba(0,0,0,0.05)')), 'satin'), corrW: S(woodSlats(), 'satin'),
      concW: S(tex('#a7a8a6', 2500), 'matte'), tileW: S(tex('#e8ebec', 600, grid(6, 6, 'rgba(90,96,100,0.35)')), 'polished'), quilt: S(quiltTex(), 'cloth'),
      standC: S(tex('#9c9c98', 3000, grid(1, 2, 'rgba(0,0,0,0.12)')), 'stone'), deck: S(tex('#55595e', 300, grid(16, 16, 'rgba(0,0,0,0.6)')), 'metal'),
      slats: S(woodSlats(), 'satin'), stoneD: S(tex('#22252b', 200), 'polished'), leatherW: S(tex('#e9e5dc', 300), 'polished'), seatB: S(tex('#1f3a7a', 4000), 'cloth'),
      chrome: sheen({ color: 0xc0c5cc }, 'metal'), bottleG: sheen({ color: 0x2f6a3a, transparent: true, opacity: 0.85 }, 'glass'), bottleA: sheen({ color: 0x9a5a1e, transparent: true, opacity: 0.85 }, 'glass'),
      roofunit: S(tex('#b5b8bb', 600, grid(1, 3, 'rgba(0,0,0,0.15)')), 'metal'), grille: S(tex('#55595e', 300, grid(16, 16, 'rgba(0,0,0,0.6)')), 'metal'),
      winpane: sheen({ color: 0x24425e, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }, 'glass'), glassdoor: sheen({ color: 0x2f3e52, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }, 'glass'),
      ropeM: sheen({ color: 0x8c7a56 }, 'cloth'), goalW: sheen({ color: 0xf4f4f0 }, 'paint'), net: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
      track: S(tex('#3a4a3a', 4000), 'matte'),
    });
    const glow = (k, c) => { M[k] = new THREE.MeshBasicMaterial({ color: c }); M[k].userData.c = c; glows.push(M[k]); };
    glow('glowW', 0xfff1d8);
    M.flood = new THREE.MeshBasicMaterial({ color: 0xf4f8ff }); M.led = new THREE.MeshBasicMaterial({ map: ledTex() }); M.led.map.repeat.set(3, 1);
  },
  look(night, nvg) {
    for (const m of glows) m.color.set(nvg ? (night ? 0x0c3a12 : 0x9cff9c) : night ? 0x0d0c0a : m.userData.c);
    if (screens) screens.m.color.set(nvg ? 0x8cff9c : 0xffffff);   // the stadium's screens and boards stay on (own supply)
  },
  scenery({ b, ao, root, hills, hillM, level, MATS }) {
    glows = []; seed = 7; inner = { root }; flood = [];
    const B = (m, x0, x1, y0, y1, z0, z1, f = 'xXyYzZ', s = 0.5) => b(m).box(x0, x1, y0, y1, z0, z1, f, s);
    const flat = (m, x0, x1, z0, z1, y = 0, s = 0.2, uv) => b(m).quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], s, uv);
    // ---- the pitch: turf round it, the mown grass, the markings, goals ----
    flat('turf', PITCH.x0 - 14, PITCH.x1 + 14, PITCH.z0 - 10, PITCH.z1 + 10, -0.02, 0.05);
    flat('grass', PITCH.x0 - 4, PITCH.x1 + 4, PITCH.z0 - 3, PITCH.z1 + 3, 0, 1, [[0, 0], [(PITCH.x1 - PITCH.x0 + 8) / 11, 0], [(PITCH.x1 - PITCH.x0 + 8) / 11, 1], [0, 1]]);
    const LW = 0.12, line = (x0, z0, x1, z1) => { const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz), ox = -dz / l * LW / 2, oz = dx / l * LW / 2; b('pitchLine').quad([x0 - ox, 0.012, z0 - oz], [x1 - ox, 0.012, z1 - oz], [x1 + ox, 0.012, z1 + oz], [x0 + ox, 0.012, z0 + oz], [0, 1, 0]); };
    const arc = (cx, cz, r, a0, a1, n = 40) => { for (let i = 0; i < n; i++) { const t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n; line(cx + r * Math.cos(t0), cz + r * Math.sin(t0), cx + r * Math.cos(t1), cz + r * Math.sin(t1)); } };
    const P = PITCH; line(P.x0, P.z0, P.x1, P.z0); line(P.x0, P.z1, P.x1, P.z1); line(P.x0, P.z0, P.x0, P.z1); line(P.x1, P.z0, P.x1, P.z1); line(XC, P.z0, XC, P.z1); arc(XC, ZC, 9.15, 0, 6.283, 64);
    for (const s of [-1, 1]) { const gx = s < 0 ? P.x0 : P.x1, ix = gx - s * 16.5, gx2 = gx - s * 5.5;
      line(gx, ZC - 20.16, ix, ZC - 20.16); line(gx, ZC + 20.16, ix, ZC + 20.16); line(ix, ZC - 20.16, ix, ZC + 20.16);
      line(gx, ZC - 9.16, gx2, ZC - 9.16); line(gx, ZC + 9.16, gx2, ZC + 9.16); line(gx2, ZC - 9.16, gx2, ZC + 9.16);
      const a = Math.acos(5.5 / 9.15); arc(gx - s * 11, ZC, 9.15, s < 0 ? -a : Math.PI - a, s < 0 ? a : Math.PI + a, 20);
      for (const cz of [P.z0, P.z1]) arc(gx, cz, 1, 0, 6.283, 12);
      // the goal: posts and bar, the net behind
      const gw = 3.66, gh = 2.44, d = 1.8; for (const z of [ZC - gw, ZC + gw]) B('goalW', gx - 0.06, gx + 0.06, 0, gh, z - 0.06, z + 0.06); B('goalW', gx - 0.06, gx + 0.06, gh - 0.12, gh, ZC - gw, ZC + gw);
      const back = gx + s * d; b('net').quad([back, 0, ZC - gw], [back, 0, ZC + gw], [back, gh * 0.8, ZC + gw], [back, gh * 0.8, ZC - gw], [s, 0, 0]); b('net').quad([gx, gh, ZC - gw], [gx, gh, ZC + gw], [back, gh * 0.8, ZC + gw], [back, gh * 0.8, ZC - gw], [0, 1, 0]);
      for (const z of [ZC - gw, ZC + gw]) b('net').quad([gx, 0, z], [back, 0, z], [back, gh * 0.8, z], [gx, gh, z], [0, 0, 1]); }
    // (the advertising boards round the pitch are the stadium model's own)
    // ---- the VIP block from outside: the stand's concrete either side and behind, the club terrace, the suites' canopy, the catwalk ----
    for (const w of level.boxes) {
      // the stand either side of and behind the block is the stadium model's own (these boxes only stop you walking out: drawn, their
      // faces hid the side stands' seats and flickered against the model); under the terrace, only the strip the cut opened up
      if (w.kind === 'mass') { if (w.x1 - w.x0 > 40 && w.z1 > BLOCK.z1) B('standC', w.x0, w.x1, 4, w.y1, w.z0, w.z1, 'Z'); }
      else if (w.kind === 'parapet') { B('standC', w.x0, w.x1, w.y0, w.y1, w.z0, w.z1, 'xXYzZ', 0.5); if (w.y0 > YS) B('glowW', w.x0, w.x1, w.y0 - 0.02, w.y0, w.z1 - 0.3, w.z1 - 0.1, 'y', 1); }
      else if (w.kind === 'fence' && w.sub === 'rail') { const hz = w.x1 - w.x0 > w.z1 - w.z0; B('chrome', w.x0, w.x1, w.y1 - 0.05, w.y1, w.z0, w.z1, 'xXYzZ', 1); B('chrome', w.x0, w.x1, w.y0 + 0.5, w.y0 + 0.54, w.z0, w.z1, 'xXYzZ', 1);
        for (let u = hz ? w.x0 : w.z0; u <= (hz ? w.x1 : w.z1); u += 1.5) hz ? B('chrome', u - 0.03, u + 0.03, w.y0, w.y1, w.z0, w.z1, 'xXzZ', 1) : B('chrome', w.x0, w.x1, w.y0, w.y1, u - 0.03, u + 0.03, 'xXzZ', 1); }
    }
    flat('terrazzo', TERR.x0, TERR.x1, TERR.z0, TERR.z1, YC + 0.004, 0.4);                       // the terrace floor
    B('standC', BLOCK.x0, BLOCK.x1, YS + H, YS + H + 0.35, BLOCK.z0, BLOCK.z1, 'YZ', 0.5);           // the suites' roof slab (seen from the ropes)
    for (const [x0, x1] of [[TERR.x0 - 0.3, TERR.x0], [TERR.x1, TERR.x1 + 0.3]]) B('standC', x0, x1, 4, YS + H, TERR.z0 - 0.2, TERR.z1, 'xXYZ', 0.5);   // the terrace's end walls (screen off the cut stand beside it)
    B('standC', TERR.x0, TERR.x1, YC - 0.4, YC, TERR.z0, TERR.z1, 'yZ', 0.5);
    B('suiteW', BLOCK.x0, BLOCK.x1, YS - 0.05, YS + 0.02, BLOCK.z1 - 0.02, BLOCK.z1 + 0.25, 'yYZ', 0.5);   // the slab edge between the floors
    // the catwalk on the roof: a grating deck on trusses, davits over its front, a rope from each down through the roof's slot
    flat('deck', DECK.x0, DECK.x1, DECK.z0, DECK.z1, ROOF + 0.004, 0.3); B('deck', DECK.x0, DECK.x1, ROOF - 0.35, ROOF, DECK.z0, DECK.z1, 'yxXzZ', 0.3);
    for (let x = DECK.x0 + 2; x < DECK.x1; x += 6) for (const z of [DECK.z0 + 0.5, DECK.z1 - 0.5]) B('standC', x - 0.15, x + 0.15, ROOF - 3.5, ROOF - 0.35, z - 0.15, z + 0.15, 'xXzZ', 0.5);
    { const cx = (HELI.x0 + HELI.x1) / 2, cz = 22; for (let i = 0; i < 40; i++) { const a0 = i * 6.283 / 40, a1 = (i + 1) * 6.283 / 40; b('pitchLine').quad([cx + 3.4 * Math.cos(a0), ROOF + 0.012, cz + 3.4 * Math.sin(a0)], [cx + 3.4 * Math.cos(a1), ROOF + 0.012, cz + 3.4 * Math.sin(a1)], [cx + 3.7 * Math.cos(a1), ROOF + 0.012, cz + 3.7 * Math.sin(a1)], [cx + 3.7 * Math.cos(a0), ROOF + 0.012, cz + 3.7 * Math.sin(a0)], [0, 1, 0]); } }
    for (const r of ROPES) { if (r.heli) continue; const pz = DECK.z1;
      B('chrome', r.x - 0.1, r.x + 0.1, ROOF, ROOF + 1.7, pz - 0.6, pz - 0.4, 'xXzZ', 1); B('chrome', r.x - 0.06, r.x + 0.06, ROOF + 1.6, ROOF + 1.72, pz - 0.6, r.z + 0.05, 'xXyYzZ', 1);
      B('ropeM', r.x - 0.025, r.x + 0.025, r.bot + 0.05, ROOF + 1.6, r.z - 0.025, r.z + 0.025, 'xXzZ', 1); }
    // floodlight banks along the roof's front edges (the model's roof ring), all four sides; they light the pitch (the 'sun')
    { const yL = 24.6, rect = [P.x0 - 12, P.z0 - 33.5, P.x1 + 12, P.z1 + 30];
      const bank = (x, z, rx, rz) => { B('standC', x - 2.2, x + 2.2, yL, yL + 1.4, z - 0.3, z + 0.3, 'xXyYzZ', 1); b('flood').quad([x - 2.0, yL + 0.1, z + rz * 0.31], [x + 2.0, yL + 0.1, z + rz * 0.31], [x + 2.0, yL + 1.3, z + rz * 0.31], [x - 2.0, yL + 1.3, z + rz * 0.31], [0, 0, rz], 1); };
      const bankX = (x, z, rx) => { B('standC', x - 0.3, x + 0.3, yL, yL + 1.4, z - 2.2, z + 2.2, 'xXyYzZ', 1); b('flood').quad([x + rx * 0.31, yL + 0.1, z - 2.0], [x + rx * 0.31, yL + 0.1, z + 2.0], [x + rx * 0.31, yL + 1.3, z + 2.0], [x + rx * 0.31, yL + 1.3, z - 2.0], [rx, 0, 0], 1); };
      for (let x = rect[0] + 8; x < rect[2] - 4; x += 9) { if (x < DECK.x0 - 3 || x > DECK.x1 + 3) bank(x, rect[1] + 2, 0, 1); bank(x, rect[3] - 2, 0, -1); }
      for (let z = rect[1] + 10; z < rect[3] - 6; z += 9) { bankX(rect[0] + 2, z, 1); bankX(rect[2] - 2, z, -1); } }
    // ---- the stair: one straight flight from the club (z 14) up to the suites (z 8), concrete treads with a nosing strip, the
    // soffit under it, a handrail each side ----
    { const N = 18, run = (SHAFT.bot - SHAFT.top) / N, rise = H / N, x0 = SHAFT.x0 + 0.1, x1 = SHAFT.x1 - 0.1;
      for (let i = 0; i < N; i++) { const top = YC + (i + 1) * rise, zb = SHAFT.bot - i * run, za = zb - run;
        B('concrete', x0, x1, Math.max(YC, top - rise - 0.3), top, za, zb, 'xXYZy', 0.5); B('chrome', x0 + 0.05, x1 - 0.05, top, top + 0.008, zb - 0.05, zb, 'YZ', 1); }   // solid steps: tread, riser, a stepped underside
      B('concrete', SHAFT.x0, SHAFT.x1, YS - 0.3, YS, SHAFT.z0, SHAFT.top, 'YyZ', 0.5);   // the top landing (the suites floor has no slab over the stair)
      for (const x of [x0 + 0.06, x1 - 0.06]) { const dz = SHAFT.bot - SHAFT.top, L = Math.hypot(dz, H), rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, L, 8), MATS.chrome);
        rail.position.set(x, (YC + YS) / 2 + 0.95, (SHAFT.bot + SHAFT.top) / 2); rail.rotation.x = -Math.atan2(dz, H); root.add(rail); } }
    // ---- signs ----
    plane(root, 'SUITES ▲', 1.4, 0.3, SHAFT.x1 + 0.12, YC + 2.4, 14.6, Math.PI / 2, { bg: '#0e2a5c' }); plane(root, 'CLUB ▼', 1.4, 0.3, SHAFT.x1 + 0.12, YS + 2.4, 7.2, Math.PI / 2, { bg: '#0e2a5c' });
    plane(root, 'THE HARBOUR CLUB', 5, 0.6, 24, YC + 2.95, 11.15, 0, { bg: null, fg: '#d8c08a', pw: 1024, ph: 96 });
    plane(root, 'GATE 4  ▶', 1.6, 0.3, 53.5, YC + 2.4, 6.12, 0, { bg: '#0f6b2c' }); plane(root, 'EXIT', 0.6, 0.22, 55.88, YC + 2.45, 8, -Math.PI / 2, { bg: '#0f6b2c' });
    SUITES.forEach((x, i) => plane(root, i === 2 ? "OWNERS' SUITE" : 'SUITE ' + (i < 2 ? i + 1 : i + 1), 1.4, 0.26, x + 1.6, YS + 2.5, 9.88, Math.PI, { bg: '#1c1f26', fg: '#d8c08a' }));
    // ---- the city round the ground: dark blocks with a few lit windows ----
    { const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0); const m = new THREE.MeshBasicMaterial({ color: 0x14161d });
      for (let k = 0; k < 40; k++) { const a = k * 6.283 / 40 + rr() * 0.1, r = 230 + rr() * 140, o = new THREE.Mesh(geo, m); o.position.set(XC + Math.cos(a) * r, 0, ZC + Math.sin(a) * r); o.scale.set(20 + rr() * 30, 20 + rr() * 80, 20 + rr() * 30); hills.add(o); } }
    // ---- the helicopter, the big screens, the crowd and the players ----
    heli = buildHeli(MATS); root.add(heli.g);
    screens = buildScreens(root);
    crowd = makeCrowd(root);
  },
  tick(dt, { S, head, officers }) {
    if (inner && inner.root.userData.zones) {   // the club and the suites only from where they can be seen
      const Z = inner.root.userData.zones, p = head.pos, live = !!S.mode, inB = p.x > BLOCK.x0 && p.x < BLOCK.x1 && p.z > BLOCK.z0 && p.z < BLOCK.z1;
      const showC = !live || p.y < YS + 2.6 || !inB && p.y < ROOF - 2, showS = !live || !(inB && p.y < YS - 0.3);
      if (showC !== inner.showC) { inner.showC = showC; for (const m of Z.club || []) m.visible = showC; }
      if (showS !== inner.showS) { inner.showS = showS; for (const m of Z.suites || []) m.visible = showS; }
    }
    // the stadium's outside (facades, ramps, the backs of the stands: about a third of the model) is drawn only until the squad is
    // off the helicopter: from the VIP block and the roof none of it can be seen
    const showOut = !(S.mode && S.phase === 'active' && !S.fly) && !window.__hideOutside;
    if (showOut !== outsideOn) { outsideOn = showOut; for (const o of outside) o.visible = showOut; }
    if (screens) { screens.min += dt / 60; const sec = Math.floor(screens.min * 60) % (90 * 60); if (sec !== screens.last) { screens.last = sec; screens.paint(sec); } }
    if (crowd) crowd.tick(dt, head.pos);
    if (heli) { const h = heli; h.rotor.rotation.y += dt * 7; h.tail.rotation[h.tailAx || 'z'] += dt * 30; h.beacon.visible = (performance.now() % 1200) < 150;
      let aboard = head.pos.y > HELI.y + 0.6 && inHeli(head.pos.x, head.pos.z); if (!aboard) for (const o of officers.values()) { const p = o.head.position; if (p.y > HELI.y + 0.4 && inHeli(p.x, p.z)) { aboard = true; break; } }
      if (S.fly) { const o = FLY.at(S.fly.t), u = Math.min(1, S.fly.t / FLY.T); h.idle = 0; h.gone = 0; h.g.visible = true; h.g.position.set(h.home.x + o[0], h.home.y + o[1], h.home.z + o[2]);
        h.g.rotation.set(0, 0, 0.07 * Math.sin(Math.PI * Math.min(1, u * 1.15))); h.rope.scale.y = Math.max(0.001, Math.min(1, (S.fly.t - FLY.T) / FLY.drop)); }
      else if (aboard || S.phase !== 'active') { h.idle = 0; h.gone = 0; h.g.visible = true; h.g.position.copy(h.home); h.g.rotation.set(0, 0, 0); h.rope.scale.y = 1; }
      else if ((h.idle += dt) > 6) { h.gone += dt; const t = h.gone; h.g.position.set(h.home.x - t * t * 0.9, h.home.y + t * 2.2 + t * t * 0.25, h.home.z - t * t * 0.4); h.g.rotation.set(0, Math.min(0.5, t * 0.08), Math.min(0.18, t * 0.05)); h.g.visible = t < 30; }
      if (h.g.visible) setRotor(h.g.localToWorld(v0.set(-0.8, 3.4, 0)), 1); }
  },
};
const v0 = new THREE.Vector3();
