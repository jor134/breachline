// Club scenery: the Halcyon, an invented concert club, on a live DJ night. The hall is a black box two storeys tall: the stage and
// the DJ's booth at the back under a lighting truss and a big screen, the bar down the west wall, booths along the east, the VIP
// balcony across the front; the floor is packed (club-crowd.js). Its furniture is the "Night Club" model cut into kits
// (models/club/kit, tools/club_kit.py) and placed here; the rest of the building (lobby, back of house, offices) is drawn from
// the map like every other map. The music is the venue's own (audio.js setVenueMusic): full in the hall, a muffled thump behind
// the walls; the hall's lamps change colour with it and pulse on its bass. Power cut (MAIN BREAKER) darkens the building's lamps;
// the sound system and the stage lights have their own supply.
import * as THREE from '../../vendor/three.module.min.js';
import { skylineMat, tower } from './skyline.js';
import { sheen, tex, grid, envMap, pbrMats } from '../mats.js';
import { ObfLoader } from '../store/obf.js';
import { setVenueMusic, setVenueMix, venueLevel } from '../audio.js';
import { H, FOOT, HALL, BALC, STAGE, STEPS, FLOOR, DJ, ROOMS, FURNITURE, VAN, inHall, inFoot } from '../core/maps/club.js';
import { makeDancers } from './club-crowd.js';

const VAN_TURN = Math.PI;   // the model's nose is at its -z end: turned to face the club
let skyM = null, glows = [], matGlows = [], dancers = null, beams = [], hallLamps = null, ledMats = [], root0 = null, kitReady = false;
const LAMPS = [
  // none: the hall is lit only by the show (beams, screen, LED strips), as with the power cut
  // front of house
  [24, 3.2, 4, 7, 10], [34, 3.2, 4, 7, 10], [14, 3.2, 4, 6, 9], [44, 3.1, 2, 5, 7], [44, 3.1, 6, 5, 7], [53, 3.1, 4, 6, 9], [5, 3.2, 4, 6, 9],
  // back of house
  [10, 3.2, 35, 6, 10], [30, 3.2, 35, 6, 10], [3.5, 3.1, 39, 6, 8], [10.5, 3.1, 39, 6, 8], [22, 3.1, 39, 7, 10], [35, 3.1, 39, 6, 9], [42.5, 3.2, 14, 5, 9], [42.5, 3.2, 28, 5, 9],
  [51, 3.2, 13, 7, 10], [48.5, 3.1, 22, 6, 8], [51, 3.3, 34, 8, 12], [42, 3.1, 39, 5, 7],
  // upstairs
  [5, 6.8, 4, 6, 9], [18, 6.8, 4, 6, 10], [32, 6.8, 4, 6, 10], [42.5, 6.8, 6, 5, 8], [42.5, 6.8, 16, 5, 8], [51, 6.8, 5, 7, 10], [51, 6.8, 15, 7, 10],
  // the lot and the alleys: street lights
  [10, 6, -12, 14, 18], [29, 6, -26, 14, 18], [33, 5.5, -14, 10, 14], [48, 6, -12, 14, 18], [61, 5, 10, 9, 14], [61, 5, 30, 9, 14], [50, 5, 45, 9, 14], [20, 5, 45, 9, 14],
];
const NIGHT = {
  sky: [[0, '#04050c'], [0.3, '#0a0d1c'], [0.45, '#161a30'], [0.5, '#2b2740'], [0.53, '#111018'], [1, '#0c0c12']], skyR: 400, moon: [-120, 130, -150],
  fog: [0x0e1018], fogD: [0.006, 0.01], sunAt: [29, 18], sunFrom: [-40, 90, -70], shadow: 45, sunCol: 0xb8c8ff, sunK: 0.55, hemi: 0.6, hemiSky: 0x8a90c0, hemiGround: 0x3a3440,
  hillColor: 0x06070b, lamps: LAMPS, lampCap: 8,   // 45 lamps: quality mode lends 8 lights round them, not one each
};
const cvs = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
let seed = 9; const rr = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
function sign(text, bg, fg, w = 512, h = 96, font = 'bold') {
  return cvs(w, h, (g) => { if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; let f = Math.round(h * 0.66); g.font = `${font} ${f}px sans-serif`; while (g.measureText(text).width > w * 0.92 && f > 10) { f -= 2; g.font = `${font} ${f}px sans-serif`; } if (!bg) { g.shadowColor = fg; g.shadowBlur = h * 0.18; } g.fillText(text, w / 2, h / 2 + 2); });
}
// a sign: a lettered panel in a dark metal frame (neon lettering, bg null, has none). (x, y, z) is the panel's face; the frame sits just behind it,
// so the panel goes 0.045 m off a wall's face (walls are 0.2 thick: 0.145 off the wall's line)
let frameMat = null;
const plane = (root, text, w, h, x, y, z, ry, o = {}) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: sign(text, o.bg === undefined ? '#16181c' : o.bg, o.fg || '#f2f2ee', o.pw, o.ph), transparent: o.bg === null, depthWrite: o.bg !== null })); m.position.set(x, y, z); m.rotation.y = ry; root.add(m); if (!o.own) { glows.push(m.material); m.material.userData.c = 0xffffff; }
  if (o.bg !== null) { frameMat = frameMat || sheen({ color: 0x2c2f34 }, 'metal'); const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.04), frameMat); fr.position.set(x - Math.sin(ry) * 0.026, y, z - Math.cos(ry) * 0.026); fr.rotation.y = ry; fr.castShadow = false; fr.receiveShadow = true; root.add(fr); }
  return m; };
const panelTex = (base, line, step = 64) => cvs(256, 256, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); g.fillStyle = line; for (let x = 0; x < w; x += step) g.fillRect(x, 0, 3, h); });
const brickTex = () => cvs(256, 256, (g, w, h) => { for (let y = 0; y < h; y += 16) for (let x = -((y / 16) % 2) * 24; x < w; x += 48) { const n = rr() * 26; g.fillStyle = `rgb(${52 + n},${40 + n * 0.6},${40 + n * 0.5})`; g.fillRect(x + 1, y + 1, 46, 14); } g.fillStyle = 'rgba(0,0,0,0.0)'; });
const lotTex = () => cvs(512, 512, (g, w, h) => { g.fillStyle = '#2a2b2f'; g.fillRect(0, 0, w, h); for (let i = 0; i < 4000; i++) { const n = rr() * 40; g.fillStyle = `rgba(${90 + n},${90 + n},${95 + n},0.25)`; g.fillRect(rr() * w, rr() * h, 2, 2); } });
// ---------- furniture the map draws itself (the bar, booths, stools, DJ desk and speakers are the model's kits, placed in load()) ----------
const furn = {
  stage({ P, len, dep, h }) { P('stageblk', 0, len, 0, dep, 0, h - 0.04); P('stagetop', 0, len, 0, dep, h - 0.04, h); P('led', 0, len, dep, dep + 0.012, h - 0.14, h - 0.08, 'Z'); },
  djbooth() { },   // the kit's DJ stand (load)
  speaker() { },
  // the bar is the kit's (placed in load()); its two ends are closed with panels, and an LED strip runs under the top on the staff side
  clubbar({ P, len, dep, h }) { for (const [u0, u1] of [[-0.02, 0.03], [len - 0.03, len + 0.02]]) P('oakD', u0, u1, 0.02, dep - 0.02, 0, h - 0.035);
    P('led', 0.05, len - 0.05, -0.012, 0, h - 0.16, h - 0.13, 'x'); },
  // the back bar: LED strips along its shelves' front edges
  backbar({ P, len, dep, h }) { P('glowB', 0, len, dep - 0.03, dep, 0.95, 0.99, 'Y'); for (const y of [0.98, 1.5, 2.02]) P('led', 0.05, len - 0.05, dep + 0.02, dep + 0.035, y, y + 0.025, 'X'); }, stool() { }, booth() { }, dancer() { },
  hightable({ P, len, dep, h }) { P('chrome', len / 2 - 0.04, len / 2 + 0.04, dep / 2 - 0.04, dep / 2 + 0.04, 0, h - 0.04); P('stoneD', 0, len, 0, dep, h - 0.04, h); P('chrome', 0.1, len - 0.1, 0.1, dep - 0.1, 0, 0.03); },
  rack({ P, len, dep, h }) { P('chrome', 0, len, dep / 2 - 0.02, dep / 2 + 0.02, h - 0.05, h); for (let u = 0.15; u < len - 0.1; u += 0.22) P(u % 0.66 < 0.22 ? 'coatA' : 'coatB', u, u + 0.12, 0.05, dep - 0.05, h - 1.05, h - 0.1); },
  desk({ P, len, dep, h }) { P('oakD', 0, len, 0, dep, h - 0.04, h); P('oakD', 0, 0.05, 0, dep, 0, h - 0.04); P('oakD', len - 0.05, len, 0, dep, 0, h - 0.04); P('oakD', 0.05, len - 0.05, 0, 0.04, 0.3, h - 0.04); },   // its laptop is a kit (kitPlacements)
  mirrordesk({ P, len, dep, h }) { P('oakD', 0, len, 0, dep, h - 0.05, h); P('oakD', 0, len, 0, 0.05, 0, h - 0.05); P('mirror', 0.1, len - 0.1, 0, 0.02, h + 0.1, h + 1.1, 'Z'); for (let u = 0.2; u < len; u += 0.5) P('glowW', u, u + 0.08, 0.02, 0.06, h + 1.12, h + 1.18); },
  locker({ P, len, dep, h }) { P('steelG', 0, len, 0, dep, 0, h); for (let u = 0; u < len - 0.1; u += 0.45) P('steelD', u + 0.02, u + 0.43, dep, dep + 0.01, 0.1, h - 0.1, 'Z'); },
  case({ P, len, dep, h }) { P('flight', 0, len, 0, dep, 0, h); P('chrome', -0.012, len + 0.012, -0.012, dep + 0.012, h * 0.5 - 0.02, h * 0.5 + 0.02); },   // the band stands proud of the case's sides
  keg({ P, len, dep, h }) { const n = 2; for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) P('steelG', i * len / n + 0.05, (i + 1) * len / n - 0.05, k * dep / 2 + 0.05, (k + 1) * dep / 2 - 0.05, 0, h); },
  safe({ P, len, dep, h }) { P('steelD', 0, len, 0, dep, 0, h); P('chrome', len / 2 - 0.1, len / 2 + 0.1, dep, dep + 0.03, h / 2 - 0.1, h / 2 + 0.1, 'Z'); },
  cctv({ P, len, dep, h }) { P('oakD', 0, len, 0, dep, h - 0.04, h); P('steelD', 0, 0.05, 0, dep, 0, h); P('steelD', len - 0.05, len, 0, dep, 0, h);
    for (let r = 0; r < 2; r++) for (let u = 0.1; u < len - 0.6; u += 0.62) P('cctvS', u, u + 0.58, 0.05, 0.1, h + 0.1 + r * 0.4, h + 0.45 + r * 0.4, 'Z'); },
};
// ---------- the model's kits: each kind's pieces, where they go (from the map's furniture), how they turn and stretch ----------
// a kit stands centred on its own origin, facing +z as the model has it, except: bar, shelf face +x; bench faces -x
function kitPlacements() {
  const out = {}, put = (k, x, y, z, ry, sx = 1, sy = 1, sz = 1, mirror = false) => (out[k] = out[k] || []).push({ x, y, z, ry, sx, sy, sz, mirror });
  for (const f of FURNITURE) {
    const [fl, x0, z0, x1, z1, h, kind] = f, y = fl * H, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (kind === 'clubbar') { const L = z1 - z0, n = Math.max(1, Math.round(L / 1.83)), s = L / (n * 1.83); for (let i = 0; i < n; i++) put('bar', cx, y, z0 + (i + 0.5) * L / n, 0, (x1 - x0) / 0.91, h / 0.91, s); }
    else if (kind === 'backbar') { const L = z1 - z0, n = Math.max(1, Math.round(L / 0.92)); for (let i = 0; i < n; i++) put('shelf', cx, y, z0 + (i + 0.5) * L / n, 0, 1, h / 2.2, L / (n * 0.92)); }
    else if (kind === 'booth') { const L = z1 - z0, n = Math.max(1, Math.round(L / 1.83)); for (let i = 0; i < n; i++) put('bench', cx, y, z0 + (i + 0.5) * L / n, 0, (x1 - x0) / 2.01, h / 1.08, L / (n * 1.83), i % 2 === 0); }   // the first mirrored: the pair's curved backs meet in the middle, the arms at the ends   
    else if (kind === 'stool') put('barstool', cx, y, cz, rr() * 6.28, 1, h / 0.71, 1);
    else if (kind === 'desk' || kind === 'cctv') {   // a laptop, open toward the side the desk faces (the kit's laptop opens toward -z)
      const face = f[7] || '+z', d = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] }[face], len = face[1] === 'z' ? x1 - x0 : z1 - z0, dep = face[1] === 'z' ? z1 - z0 : x1 - x0;
      const u = kind === 'cctv' ? len * 0.8 : len * 0.5, v = dep * 0.55, ax = face[1] === 'z' ? [1, 0] : [0, 1];
      put('laptop', cx + ax[0] * (u - len / 2) + d[0] * (v - dep / 2), y + h, cz + ax[1] * (u - len / 2) + d[1] * (v - dep / 2), Math.atan2(-d[0], -d[1]));
    }
    else if (kind === 'speaker') { const w = x1 - x0; for (const u of [-0.25, 0.25]) put('speaker', cx + u * w, y, cz, Math.PI, w / 2 / 0.78, h / 1.99, (z1 - z0) / 0.86); }
  }
  put('djstand', DJ.x, STAGE.h, DJ.z - 0.35, Math.PI, 1.2, 1, 1);
  put('screen', 20, 4.0, HALL.z1 - 0.12, Math.PI, 2.1, 1.6, 1);
  for (let i = 0; i < 8; i++) put('swivel', STAGE.x0 + 1.5 + i * (STAGE.x1 - STAGE.x0 - 3) / 7, 6.2, STAGE.z0 + 0.6, Math.PI, 1, -1, 1);
  for (const [x, z] of [[10, 14], [30, 14], [10, 25], [30, 25], [20, 12], [20, 26]]) put('spot', x, 6.9, z, rr() * 6.28, 1.4, -1.4, 1.4);
  for (const [x, z] of [[1.2, 9.5], [38.8, 9.5], [1.2, 32.5], [38.8, 32.5]]) put('ceilspeaker', x, 5.6, z, x < 20 ? Math.PI / 2 : -Math.PI / 2, 1.3, 1.3, 1.3);
  for (const x of [STAGE.x0 + 0.3, STAGE.x1 - 0.3]) put('pole', x, STAGE.h, STAGE.z0 + 0.4, 0, 1.5, (6.3 - STAGE.h) / 2.83, 1.5);
  { const nx = 7, nz = 2, w = (FLOOR.x1 - FLOOR.x0) / nx, d = (FLOOR.z1 - FLOOR.z0) / nz; for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) put('dancefloor', FLOOR.x0 + (i + 0.5) * w, 0.012, FLOOR.z0 + (k + 0.5) * d, 0, w / 4.05, 1, d / 6.77); }
  return out;
}
function placeKits(kitScene, root) {
  const by = {}; kitScene.traverse(o => { if (o.isMesh) { let n = o; while (n.parent && !KIT_NAMES.has(n.name)) n = n.parent; (by[n.name] = by[n.name] || []).push(o); } });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), g = new THREE.Group(); g.name = 'clubkit';
  for (const [k, list] of Object.entries(kitPlacements())) {
    for (const src of by[k] || []) {
      const mt = src.material; mt.envMap = envMap; mt.userData.env = mt.envMapIntensity = 0.35; if (!pbrMats.includes(mt)) pbrMats.push(mt); if (mt.emissiveMap) { ledMats.push(mt); mt.userData.em = mt.emissive.clone(); }
      // mirrored pieces get their own mesh, built from a mirrored copy of the geometry (a negative scale on an instance turns its faces inside out)
      for (const mir of [false, true]) { const sel = list.filter(t => !!t.mirror === mir); if (!sel.length) continue;
        let geo = src.geometry; if (mir) { geo = geo.clone(); geo.scale(1, 1, -1); const ix = geo.index; if (ix) for (let i = 0; i < ix.count; i += 3) { const a = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, a); } }
        const im = new THREE.InstancedMesh(geo, mt, sel.length); im.castShadow = !['dancefloor', 'spot', 'swivel', 'screen'].includes(k); im.receiveShadow = true;
        sel.forEach((t, i) => { e.set(0, t.ry, 0); q.setFromEuler(e); m4.compose(p.set(t.x, t.y, t.z), q, s.set(t.sx, t.sy, t.sz)); im.setMatrixAt(i, m4); });
        im.computeBoundingSphere(); g.add(im); }
    }
  }
  root.add(g); kitReady = true; return g;
}
const KIT_NAMES = new Set(['bar', 'barcorner', 'barend', 'barstool', 'table', 'shelf', 'bench', 'djstand', 'speaker', 'screen', 'swivel', 'spot', 'ceilspeaker', 'lightbar', 'pole', 'steps', 'dancefloor', 'laptop']);
const roomAt = (f, x, z) => { for (const r of ROOMS) if (r[0] === f && x >= r[2] && x <= r[4] && z >= r[3] && z <= r[5]) return r[1]; return null; };
let mix = { g: -1, c: -1 }, mood = { base: null, nvg: false, k: 0, hemi: null };   // the hall's haze and darkness (tick)
const HAZE = new THREE.Color(0x140a20), HAZE_D = 0.045, HALL_HEMI = 0.25, HALL_SUN = 0.4;   // in the hall: about what the breaker leaves (power cut)
// ---------- CCTV: six cameras round the club, live on the security room's desk screens (the first six of its ten) ----------
// Each camera's picture is drawn a third of the frames, one camera at a time, and only while you are in the security room; the
// screens go dark with the power cut, as in the casino.
const CAMS = [['CAM 1 DANCE FLOOR', [38.6, 6.6, 13.6], [18, 0, 26]], ['CAM 2 STAGE', [1.4, 6.4, 14], [22, 1, 30]], ['CAM 3 BAR', [6, 3.2, 27.4], [2, 0.4, 14]],
  ['CAM 4 LOBBY', [39.4, 3.2, 0.6], [24, 0, 6]], ['CAM 5 FRONT LOT', [57.4, 6.4, -0.6], [30, 0, -18]], ['CAM 6 LOADING DOCK', [57.4, 3.2, 41.4], [46, 0, 28]]];
let cctv = null;
function buildCCTV(root) {
  const rts = [], cams = [], mats = [], desk = { x0: 54, z0: 10.3, y: H + 0.76 };
  CAMS.forEach(([name, p, t], i) => {
    const rt = new THREE.WebGLRenderTarget(256, 144), cam = new THREE.PerspectiveCamera(80, 16 / 9, 0.1, 90); cam.layers.enable(5); cam.position.set(...p); cam.lookAt(...t); rts.push(rt); cams.push(cam);
    const m = new THREE.MeshBasicMaterial({ map: rt.texture, color: 0xb8c8e0, toneMapped: false }); mats.push(m);
    const row = i < 5 ? 1 : 0, u = 0.1 + (i < 5 ? i : i - 5) * 0.62, sc = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.31), m);
    sc.position.set(desk.x0 + u + 0.29, desk.y + 0.1 + row * 0.4 + 0.175, desk.z0 + 0.105); root.add(sc);
    plane(root, name, 0.5, 0.05, desk.x0 + u + 0.29, desk.y + 0.1 + row * 0.4 - 0.015, desk.z0 + 0.107, 0, { bg: '#0a0c10', fg: '#9fd8ff', pw: 384, ph: 38, own: true });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.28), new THREE.MeshLambertMaterial({ color: 0xd8d8d8 })); box.position.set(...p); box.lookAt(...t); root.add(box);   // the camera itself
  });
  return { rts, cams, mats, n: 0, k: 0, on: true };
}

export default {
  get env() { return NIGHT; },
  envs: { night: NIGHT },
  setTod() { },
  load() {
    setVenueMusic('sfx/club_music.blx', true);
    const kit = new Promise(res => new ObfLoader().load('models/club/kit.glb', gl => res(placeKits(gl.scene, root0)), undefined, () => res(null)));
    // "Swat Van" by maregajavier (CC BY 4.0): long axis along z, nose to the club, 5.8 m long, on the ground at the map's van
    const van = new Promise(res => new ObfLoader().load('models/club/van.glb', gl => {
      const m = gl.scene; m.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(m), sz = bb.getSize(new THREE.Vector3()), long = sz.x > sz.z ? 'x' : 'z';
      const g = new THREE.Group(), k = 5.8 / Math.max(sz.x, sz.z); m.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); g.add(m);
      const o = new THREE.Group(); o.add(g); g.scale.setScalar(k); g.rotation.y = (long === 'x' ? Math.PI / 2 : 0) + VAN_TURN; o.position.set(VAN.x, 0, VAN.z);
      m.traverse(q => { if (q.isMesh) { q.castShadow = q.receiveShadow = true; const mt = q.material; mt.envMap = envMap; mt.userData.env = mt.envMapIntensity = 0.8; if (!pbrMats.includes(mt)) pbrMats.push(mt); } });
      root0.add(o); o.updateMatrixWorld(true);
      // the light bar sits on the roof. The model's own vertices along the van's middle give the roof's height and its front edge (the
      // bounding box's top is the racks and lamps and its +z end the bumper, which left the bar floating in front of the cab; rays
      // missed the roof, whose faces point inward)
      const v = new THREE.Vector3(), bins = new Map();
      o.traverse(q => { if (!q.isMesh) return; const P = q.geometry.attributes.position; for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(q.matrixWorld);
        if (Math.abs(v.x - VAN.x) > 0.45) continue; const k = Math.round(v.z * 10); if (!(bins.get(k) > v.y)) bins.set(k, v.y); } });
      const hits = [...bins].sort((p, q) => q[0] - p[0]).map(([k, y]) => [k / 10, y]);
      const roofY = hits.length ? Math.max(...hits.map(q => q[1])) : 2.6, front = hits.find(q => q[1] > roofY - 0.35) || [VAN.z + 1.2, roofY];
      for (const b of beams) if (b.siren) { b.siren.position.set(VAN.x, roofY + 0.05, front[0] - 0.2); b.siren.visible = true; }
      res(null);
    }, undefined, () => res(null)));
    return Promise.all([kit, van, dancers ? dancers.load() : null]).then(() => new THREE.Group());
  },
  dispose() { setVenueMusic(null, false); dancers = null; hallLamps = null; if (cctv) for (const rt of cctv.rts) rt.dispose(); cctv = null; },
  noshade: { glowW: 1, glowB: 1, led: 1, neon: 1, beam: 1, cctvS: 1 },
  noCast: ['clubfloor', 'terrazzo', 'carpetR', 'carpetG', 'tileK', 'tileW', 'concrete', 'steelfloor', 'oak', 'lot', 'lotLine', 'stagetop'],
  tread: 'concrete',
  outer: w => w.y0 > H - 0.1 ? 'brickD' : (w.z0 < 0.5 && w.z1 < 0.5 && w.x0 >= 18 && w.x1 <= 40) ? 'lobbyFront' : 'brickD',
  inner: w => 'bohW',
  innerAt: (f, x, z) => {
    if (inHall(x, z) && (f === 0 || z > BALC.z1)) return 'hallW';
    const r = roomAt(f, x, z) || '';
    if (/room$|Dressing/.test(r) && f === 0 && !/Green|Security/.test(r)) return 'tileWall';
    if (/Lobby|Coat|Stair hall|VIP|balcony|landing/.test(r)) return 'lobbyW';
    if (/office|Security|Box/.test(r)) return 'officeW';
    if (/Green/.test(r)) return 'greenW';
    return 'bohW';
  },
  door: d => d.exterior ? 'steelDoor' : 'door',
  furn,
  mats(M) {
    if (M.clubfloor) return;
    const S = (t, gl) => sheen({ map: t }, gl);
    Object.assign(M, {
      clubfloor: S(tex('#15151a', 4000, grid(4, 4, 'rgba(255,255,255,0.05)')), 'polished'), terrazzo: M.terrazzo || S(tex('#cfcac0', 3000, grid(2, 2, 'rgba(90,85,75,0.25)')), 'polished'),
      carpetR: S(tex('#4a1420', 6000, grid(6, 6, 'rgba(255,200,120,0.08)')), 'cloth'), carpetG: M.carpetG || S(tex('#56544f', 6000, grid(6, 6, 'rgba(255,255,255,0.05)')), 'cloth'),
      tileK: M.tileK || S(tex('#c9cdd0', 2000, grid(4, 4, 'rgba(60,64,68,0.4)')), 'polished'), tileW: S(tex('#d8d6d0', 2000, grid(5, 5, 'rgba(60,64,68,0.35)')), 'polished'),
      concrete: M.concrete || S(tex('#8d8a84', 4000, grid(2, 2, 'rgba(40,38,34,0.35)')), 'stone'), steelfloor: M.steelfloor || S(tex('#6c7076', 2000, grid(8, 8, 'rgba(20,20,20,0.35)', true, 0.1)), 'metal'),
      oak: M.oak || S(tex('#7a5638', 6000, grid(8, 1, 'rgba(40,25,12,0.3)')), 'satin'),
      hallW: S(panelTex('#0b0b0f', 'rgba(60,60,80,0.35)', 48), 'matte'), lobbyW: S(panelTex('#2a1c22', 'rgba(220,170,90,0.25)', 128), 'satin'), bohW: S(tex('#9a9a94', 1200, grid(2, 4, 'rgba(0,0,0,0.12)')), 'matte'),
      tileWall: S(tex('#e8ebec', 600, grid(6, 6, 'rgba(90,96,100,0.35)')), 'polished'), officeW: S(tex('#c9c2b4', 300), 'satin'), greenW: S(tex('#2f4a3a', 300), 'satin'),
      brickD: S(brickTex(), 'stone'), lobbyFront: S(panelTex('#101014', 'rgba(255,255,255,0.08)', 128), 'polished'),
      stageblk: S(tex('#101012', 300), 'matte'), stagetop: S(tex('#1c1c20', 2000, grid(8, 8, 'rgba(255,255,255,0.04)')), 'satin'), stoneD: M.stoneD || S(tex('#22252b', 200), 'polished'),
      chrome: M.chrome || sheen({ color: 0xc0c5cc }, 'metal'), steelG: sheen({ color: 0x9aa0a6 }, 'metal'), steelD: sheen({ color: 0x3a3f45 }, 'metal'), oakD: S(tex('#4a3322', 3000, grid(8, 1, 'rgba(0,0,0,0.25)')), 'satin'),
      flight: S(tex('#18181a', 300, grid(2, 2, 'rgba(160,160,170,0.5)')), 'satin'), coatA: S(tex('#2b2f3a', 300), 'cloth'), coatB: S(tex('#5a3a2a', 300), 'cloth'),
      mirror: sheen({ color: 0xcfd6dc }, 'glass'), screenK: new THREE.MeshBasicMaterial({ color: 0x1a2a40 }), steelDoor: sheen({ color: 0x4a4f55 }, 'metal'),
      lot: S(lotTex(), 'stone'), lotLine: new THREE.MeshLambertMaterial({ color: 0xe8e2c8 }), kerb: S(tex('#8a8a86', 2000), 'stone'), vanB: sheen({ color: 0x1b2433 }, 'paint'), vanW: sheen({ color: 0x0c1014, transparent: true, opacity: 0.85 }, 'glass'),
      dumpster: sheen({ color: 0x24503a }, 'paint'), fenceW: S(tex('#5c5a56', 2000, grid(1, 3, 'rgba(0,0,0,0.25)')), 'stone'),
      glassrail: sheen({ color: 0x3a4a58, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }, 'glass'),
    });
    const glow = (k, c) => { M[k] = new THREE.MeshBasicMaterial({ color: c }); M[k].userData.c = c; matGlows.push(M[k]); };
    glow('glowW', 0xfff1d8); glow('glowB', 0x3a7aff); glow('cctvS', 0x4a7a9a);
    M.led = new THREE.MeshBasicMaterial({ color: 0xff2fa0 }); M.neon = new THREE.MeshBasicMaterial({ color: 0xff3fb0 });
    M.beam = new THREE.MeshBasicMaterial({ color: 0x6aa0ff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  },
  noFit: (f, x, z) => f === 1 && inHall(x, z) && z > BALC.z1,   // no white downlights over the dance floor: the hall is lit only by the show
  look(night, nvg) {
    if (cctv) { cctv.on = !night; for (const m of cctv.mats) m.color.set(night ? 0x000000 : nvg ? 0x8cff9c : 0xb8c8e0); }
    if (skyM) skyM.color.set(nvg ? 0x6dff7a : 0xffffff);
    mood.base = null; mood.nvg = nvg;   // the light was just set: tick takes it as the outside's and works the hall's from it
    for (const m of [...glows, ...matGlows]) m.color.set(nvg ? (night ? 0x0c3a12 : 0x9cff9c) : night ? 0x0d0c0a : m.userData.c);
  },
  scenery({ b, root, hills, level, MATS }) {
    cctv = buildCCTV(root);
    glows = []; seed = 9; beams = []; ledMats = []; root0 = root; kitReady = false;
    const B = (m, x0, x1, y0, y1, z0, z1, f = 'xXyYzZ', s = 0.5) => b(m).box(x0, x1, y0, y1, z0, z1, f, s);
    const flat = (m, x0, x1, z0, z1, y = 0, s = 0.2) => b(m).quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], s);
    // ---- outside: the lot (bays, kerb, a planter strip), the alleys, the street; the fences; dumpsters; the van ----
    flat('lot', -1, 64, -34, 0, 0.004, 0.08); flat('lot', 58, 64, 0, 48, 0.004, 0.08); flat('lot', -1, 58, 42, 48, 0.004, 0.08);
    for (let x = 2; x <= 56; x += 2.7) { if (x > 22 && x < 36) continue; for (const [z0, z1] of [[-9, -4], [-30, -25]]) flat('lotLine', x - 0.06, x + 0.06, z0, z1, 0.01, 1); }
    B('kerb', -1, 64, 0, 0.15, -34.3, -34, 'yYzZ', 0.5);
    for (const w of level.boxes) {
      if (w.kind === 'fence' && w.sub === 'wall') B('fenceW', w.x0, w.x1, w.y0, w.y1, w.z0, w.z1, 'xXYzZ', 0.5);
      else if (w.kind === 'fence' && w.sub === 'glassrail') { B('glassrail', w.x0, w.x1, w.y0 + 0.05, w.y1 - 0.06, w.z0, w.z1, 'xXzZ', 1); B('chrome', w.x0 - 0.01, w.x1 + 0.01, w.y1 - 0.06, w.y1, w.z0 - 0.02, w.z1 + 0.02, 'xXYzZ', 1); }
      else if (w.kind === 'fence' && w.sub === 'steprail') { B('chrome', w.x0, w.x1, w.y1 - 0.05, w.y1, w.z0, w.z1, 'xXyYzZ', 1); for (const z of [w.z0 + 0.05, w.z1 - 0.05]) B('chrome', w.x0 + 0.01, w.x1 - 0.01, z < STEPS.z1 - 0.1 ? 0.2 : STAGE.h, w.y1 - 0.05, z - 0.03, z + 0.03, 'xXzZ', 1); }
      else if (w.kind === 'dumpster') { B('dumpster', w.x0, w.x1, w.y0, w.y1, w.z0, w.z1, 'xXYzZ', 1); B('steelD', w.x0 - 0.03, w.x1 + 0.03, w.y1, w.y1 + 0.06, w.z0 - 0.03, w.z1 + 0.03, 'xXYzZ', 1); }
      else if (w.kind === 'van') {   // the squad's van is the model (load); a light bar on its roof flashes red and blue
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.22), new THREE.MeshBasicMaterial({ color: 0x3060ff })); bar.position.set((w.x0 + w.x1) / 2, w.y1 + 0.05, w.z1 - 1.2); bar.visible = false; root.add(bar); beams.push({ siren: bar });
      }
    }
    // ---- the front: a canopy over the doors, the club's name in neon, posters; the box office's window ----
    B('steelD', 22, 36, 3.4, 3.6, -2.2, 0, 'xXyYz', 0.5);
    plane(root, 'HALCYON', 9, 1.8, 29, 5.2, -0.3, Math.PI, { bg: null, fg: '#ff4fc0', pw: 1024, ph: 200, own: true }).material.userData.neon = true;
    plane(root, 'TONIGHT  ·  LIVE  ·  DJ SET', 7, 0.5, 29, 3.0, -2.25, Math.PI, { bg: '#0a0a0e', fg: '#ffd23a', pw: 1024, ph: 72 });
    for (const x of [19.5, 38.5]) plane(root, 'HALCYON NIGHTS', 1.1, 1.6, x, 1.6, -0.25, Math.PI, { bg: '#2a1240', fg: '#ff7ad0', pw: 256, ph: 372 });
    plane(root, 'BOX OFFICE', 2.4, 0.4, 53, 2.6, -0.25, Math.PI, { bg: '#16181c', fg: '#d8c08a' });
    plane(root, 'DELIVERIES', 2.4, 0.4, 51, 3.0, 42.25, 0, { bg: '#16181c', fg: '#ffd23a' }); plane(root, 'FIRE EXIT', 1.2, 0.3, 3.6, 2.5, 42.25, 0, { bg: '#0f6b2c' });
    // ---- the hall: the lighting truss over the stage, a balcony fascia, LED strips along the walls, the stage's lip, the DJ's name ----
    B('steelD', STAGE.x0, STAGE.x1, 6.2, 6.4, STAGE.z0 + 0.4, STAGE.z0 + 0.8, 'xXyYzZ', 1); B('steelD', STAGE.x0, STAGE.x1, 6.2, 6.4, STAGE.z1 - 1.2, STAGE.z1 - 0.8, 'xXyYzZ', 1);
    B('stageblk', BALC.x0, BALC.x1, H - 0.45, H, BALC.z1 - 0.05, BALC.z1 + 0.05, 'yZ', 0.5); B('led', BALC.x0, BALC.x1, H - 0.42, H - 0.38, BALC.z1 + 0.05, BALC.z1 + 0.06, 'Z', 1);
    for (const [x0, x1, z0, z1] of [[0.1, 0.13, 8.1, 33.9], [39.87, 39.9, 8.1, 33.9]]) B('led', x0, x1, 2.6, 2.66, z0, z1, x0 < 1 ? 'X' : 'x', 1);
    B('led', 0.1, 39.9, 2.6, 2.66, 33.87, 33.9, 'z', 1);
    // the balcony's underside: the hall is two storeys, so it has no ceiling of its own, and the balcony floor had no face from below
    b('stageblk').quad([BALC.x0, H - 0.012, BALC.z0], [BALC.x1, H - 0.012, BALC.z0], [BALC.x1, H - 0.012, BALC.z1], [BALC.x0, H - 0.012, BALC.z1], [0, -1, 0], 0.5);
    // the stage steps: five risers up its front at the east end, a handrail each side
    for (let i = 0; i < 5; i++) { const d = (STEPS.z1 - STEPS.z0) / 5, z0 = STEPS.z0 + i * d; B('stagetop', STEPS.x0, STEPS.x1, 0, (i + 1) * STAGE.h / 5, z0, z0 + d, 'xXYz', 1); B('led', STEPS.x0 + 0.05, STEPS.x1 - 0.05, (i + 1) * STAGE.h / 5 - 0.03, (i + 1) * STAGE.h / 5 - 0.01, z0 - 0.012, z0, 'z', 1); }
    plane(root, 'DJ  NOVA', 3.4, 0.6, DJ.x, STAGE.h + 1.0, DJ.z - 1.23, Math.PI, { bg: null, fg: '#7ad8ff', pw: 512, ph: 96, own: true });
    // beams from the moving heads on the truss: cones of faint light that swing over the floor
    const cone = new THREE.ConeGeometry(1.3, 9, 16, 1, true); cone.translate(0, -4.5, 0);
    for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(cone, MATS.beam.clone()); const x = STAGE.x0 + 1.5 + i * (STAGE.x1 - STAGE.x0 - 3) / 7; m.position.set(x, 6.0, STAGE.z0 + 0.6); m.renderOrder = 6; root.add(m); beams.push({ m, x, ph: i * 0.8, c: new THREE.Color() }); }
    // ---- signs inside ----
    plane(root, 'BACKSTAGE  ·  STAFF ONLY', 2.6, 0.32, 3.6, 2.5, 33.855, Math.PI, { bg: '#16181c', fg: '#ff5050' }); plane(root, 'STAFF ONLY', 1.4, 0.3, 39.855, 2.5, 28.2, -Math.PI / 2, { bg: '#16181c', fg: '#ff5050' });
    plane(root, 'VIP  ▲', 1.2, 0.3, 4.5, 2.6, 7.855, Math.PI, { bg: '#2a1240', fg: '#ffd23a' }); plane(root, 'GREEN ROOM', 1.6, 0.3, 22, 2.5, 36.145, Math.PI, { bg: '#16181c', fg: '#d8c08a' });
    plane(root, 'COAT CHECK', 2, 0.36, 14, 2.6, 6.45, 0, { bg: '#2a1240', fg: '#ffd23a' }); plane(root, 'MANAGER', 1.2, 0.26, 44.855, H + 2.4, 4.6, -Math.PI / 2, { bg: '#16181c', fg: '#d8c08a' });
    // ---- the city round the block: towers with lit windows (the casino's skyline) ----
    { skyM = skylineMat();
      for (let k = 0; k < 36; k++) { const a = k * 6.283 / 36 + rr() * 0.1, r = 110 + rr() * 90, o = tower(14 + rr() * 22, 10 + rr() * 50, 14 + rr() * 22, skyM); o.position.set(29 + Math.cos(a) * r, 0, 10 + Math.sin(a) * r); o.rotation.y = -a; hills.add(o); } }
    dancers = makeDancers(root);
  },
  tick(dt, { S, head, scene, renderer }) {
    if (cctv && cctv.on && S.mode && renderer) { const p = head.pos; if (p.x > 45 && p.x < 58 && p.z > 10 && p.z < 20 && p.y > H) {
      if (cctv.n++ % 3 === 0) { const i = cctv.k++ % cctv.cams.length, xe = renderer.xr.enabled, rt = renderer.getRenderTarget(); renderer.xr.enabled = false;
        renderer.setRenderTarget(cctv.rts[i]); renderer.render(scene, cctv.cams[i]); renderer.setRenderTarget(rt); renderer.xr.enabled = xe; } } }
    const p = head.pos, t = performance.now() / 1000, lv = venueLevel();
    // the music: where you stand decides how loud and how muffled
    const f = p.y > H - 0.6 ? 1 : 0, room = inFoot(p.x, p.z) ? roomAt(f, p.x, p.z) : null;
    let g, c; if (inHall(p.x, p.z) && (f === 0 || p.z > BALC.z0)) { g = 0.95; c = 16000; } else if (room === 'Lobby' || room === 'VIP lounge' || room === 'Stair hall' || room === 'Upper landing') { g = 0.6; c = 2200; }
    else if (room) { g = 0.32; c = 330; } else { g = 0.2; c = 240; }
    if (Math.abs(g - mix.g) > 0.01 || Math.abs(c - mix.c) > 5) { mix = { g, c }; setVenueMix(g, c); }
    // the hall's lamps: a slow wash round the colour wheel, pulsing on the bass (the building's own lamps keep their warm white)
    if (!hallLamps && root0) { hallLamps = []; root0.traverse(o => { if (o.isPointLight && o.userData.d) hallLamps.push(o); }); }
    for (const l of hallLamps || []) { const q = l.userData.d.p; if (inHall(q.x, q.z) && q.y > 3) { const hue = (t * 0.05 + q.x * 0.02 + q.z * 0.015) % 1; l.color.setHSL(hue, 0.95, 0.035 + lv * 0.09); } else l.color.set(0xffd9a8); }   // the hall's: only a coloured glow pulsing on the bass, near black
    for (const bm of beams) {
      if (bm.siren) { bm.siren.material.color.set(Math.floor(t * 3) % 2 ? 0x3060ff : 0xff2020); continue; }
      const a = Math.sin(t * 0.6 + bm.ph) * 0.55, k = Math.cos(t * 0.45 + bm.ph * 1.3) * 0.35; bm.m.rotation.set(-0.35 + k, 0, a);
      bm.c.setHSL((t * 0.08 + bm.ph * 0.1) % 1, 0.9, 0.6); bm.m.material.color.copy(bm.c); bm.m.material.opacity = 0.07 + lv * 0.16;   // the haze shows the beams
    }
    for (const m of ledMats) m.emissive.copy(m.userData.em).multiplyScalar(0.6 + lv * 0.8);
    // the hall is darker than the rest of the building and hazy (smoke machines): fog thickens and turns purple, the sky light dims,
    // as you walk in; out again, back to what the rest of the map has (night vision keeps its own green)
    if (scene && scene.fog) {
      if (!mood.base) { mood.base = { d: scene.fog.density, c: scene.fog.color.clone() }; mood.hemi = null; mood.sun = null; scene.traverse(o => { if (!mood.hemi && o.isHemisphereLight) mood.hemi = { l: o, i: o.intensity }; if (!mood.sun && o.isDirectionalLight) mood.sun = { l: o, i: o.intensity }; }); mood.k = -1; }
      const want = inHall(p.x, p.z) && p.y < 2 * H ? 1 : 0, k = Math.max(0, Math.min(1, (mood.k < 0 ? want : mood.k + Math.sign(want - mood.k) * dt * 1.5)));
      if (k !== mood.k) { mood.k = k; scene.fog.density = mood.base.d + (HAZE_D - mood.base.d) * k; if (!mood.nvg) scene.fog.color.copy(mood.base.c).lerp(HAZE, k);
        if (mood.hemi) mood.hemi.l.intensity = mood.hemi.i * (1 - (1 - HALL_HEMI) * k); if (mood.sun) mood.sun.l.intensity = mood.sun.i * (1 - (1 - HALL_SUN) * k); }
    }
    if (dancers) dancers.tick(dt, p);
  },
};
