// Airport scenery: the terminal's deep dark roof running on over the forecourt on white Y-shaped columns, its glass faces and
// the floor band between them, the escalator bank with its glass balustrades, signs; around it the airport from the model
// ("Airport_and Interior" by Pravin_9271, CC BY 4.0, laid out by tools/airport_kit.py: apron, airliners, jet bridges, the pier,
// control and radar towers, runway) re-dressed in the game's materials; the apron behind with the glass-banded maintenance hangar,
// the grounded regional jet (model, airstairs, cabin and hold interiors) and two light aircraft. Two looks: day and night.
import * as THREE from '../../vendor/three.module.min.js';
import { sheen, tex, grid, vertexSheen } from '../mats.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { ObfLoader } from '../store/obf.js';   // quest-store: the jet ships obfuscated (Sketchfab Standard licence)
import { envMap, pbrMats } from '../mats.js';
import { H, FOOT, STAIR, HANGAR, JET, CAB, HOLD, AIRSTAIR, CANOPY, TREES, GAPLANES, JX, JZ } from '../core/maps/airport.js';

let tod = 'day', floodMat = null, signs = [];
const LAMPS = [[13.5, 6.6, 36, 14, 24], [13.5, 6.4, 22, 9, 16], [13.5, 6.2, 7, 7, 12], [32, 13.5, -42, 18, 34], [32, CAB + 1.9, -40, 4, 9], [13.5, 2 * H - 1.5, 66, 10, 22], [13.5, H + 5.5, 30, 10, 20], [13.5, H + 5.5, 50, 9, 18], [4.5, H + 5, 5, 6, 10]];
const DAY = {
  sky: [[0, '#3f78c4'], [0.3, '#85b2e4'], [0.45, '#bcd3ea'], [0.5, '#c6d6e6'], [1, '#c6d6e6']], skyR: 470, moon: [160, 140, -40],
  fog: [0xc6d6e6], fogD: [0.0032, 0.006], sunAt: [32, -8], sunFrom: [60, 95, 40], shadow: 72, sunCol: 0xfff3dc, sunK: 1.6, hemi: 1.35, hemiSky: 0xd8e6f6, hemiGround: 0x8c867a,
  hillColor: 0x6d7a6a, lamps: LAMPS,
};
const NIGHT = {
  sky: [[0, '#06081a'], [0.3, '#14183a'], [0.45, '#2a2a52'], [0.5, '#1d1f3a'], [1, '#1d1f3a']], skyR: 470, moon: [-150, 120, 80],
  fog: [0x1d1f3a], fogD: [0.0042, 0.009], sunAt: [32, -8], sunFrom: [-40, 70, 60], shadow: 72, sunCol: 0xe0e8ff, sunK: 1.4, hemi: 1.0, hemiSky: 0x8a94c0, hemiGround: 0x3a3a46,
  hillColor: 0x0b0c18, lamps: LAMPS,
};
function sign(text, bg = '#16181c', fg = '#f2f2ee', w = 512, h = 96, bar = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h); if (bar) { g.fillStyle = bar; g.fillRect(0, h - 10, w, 10); }
  g.fillStyle = fg; g.font = 'bold ' + Math.round(h * 0.56) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let s = h * 0.56; while (g.measureText(text).width > w * 0.9 && s > 10) { s -= 2; g.font = 'bold ' + Math.round(s) + 'px sans-serif'; }
  g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.MeshBasicMaterial({ map: t }); signs.push(m); return m;
}
const plane = (root, text, w, h, x, y, z, ry, opt = {}) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), sign(text, opt.bg, opt.fg, opt.pw, opt.ph, opt.bar)); m.position.set(x, y, z); m.rotation.y = ry; root.add(m); return m; };

export default {
  get env() { return tod === 'night' ? NIGHT : DAY; },
  envs: { day: DAY, night: NIGHT },
  setTod(t) { tod = t === 'night' ? 'night' : 'day'; },
  // The BAe 146 (models/jet/bae146.glb): already scaled and cleaned by tools/jet_glb.py; placed with its own origin at (JX, 0, JZ).
  load() {
    const jet = new Promise((res, rej) => new ObfLoader().load('models/jet/bae146.glb', g => {
      const m = g.scene; m.position.set(JX, 0, JZ);
      m.traverse(o => { if (!o.isMesh) return; const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mt of mats) { mt.envMap = envMap; mt.userData.env = mt.envMapIntensity = 0.3; if (!pbrMats.includes(mt)) pbrMats.push(mt); if (mt.transparent) { mt.depthWrite = false; } }
        o.castShadow = true; o.receiveShadow = true; });
      res(m);
    }, undefined, rej));
    // the airport around the terminal: each part's flat colour kept, in the game's own surfaces (tarmac and concrete textured)
    const scene = new Promise(res => new ObfLoader().load('models/airport/scene.glb', g => {
      const tarmac = sheen({ map: tex('#3a3c3f', 9000, grid(1, 1, 'rgba(255,255,255,0.05)')) }, 'matte'), cache = new Map();
      g.scene.traverse(o => { if (!o.isMesh) return; const k = o.material.name, c = o.material.color.clone();
        const key = k + c.getHexString(); let m = cache.get(key);
        if (!m) { m = k === 'tarmac' ? tarmac : k === 'glass' ? sheen({ color: c.lerp(new THREE.Color(0x6f8fa8), 0.5), transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }, 'glass')
          : k === 'white' ? sheen({ color: c }, 'paint') : k === 'paint' ? sheen({ color: c, side: THREE.DoubleSide }, 'paint') : sheen({ map: tex('#ffffff', 600), color: c.multiplyScalar(1.15), side: o.material.side }, 'metal'); cache.set(key, m); }
        o.material = m; o.receiveShadow = true; o.castShadow = k !== 'tarmac'; o.matrixAutoUpdate = false; o.updateMatrix(); });
      res(g.scene);
    }, undefined, () => res(null)));
    return Promise.all([jet, scene]).then(([j, sc]) => { const g = new THREE.Group(); g.add(j); if (sc) g.add(sc); return g; });
  },
  noshade: { apline: 1, flood: 1, star: 1, apyellow: 1 }, noCast: ['apron', 'road', 'apline', 'apyellow', 'kerbstone', 'grassA', 'epoxyW', 'runway', 'soffitG', 'glassRail'],
  tread: 'steel',
  outer: w => w.f >= 1 ? 'apfacade' : 'apfacadeLow',
  inner: w => w.f === 1 && w.z0 >= 15.9 && w.z1 <= 44.1 ? 'lacquer' : 'plaster',
  door: d => d.exterior ? 'steel' : 'door',
  mats(M) {
    if (M.apron) return;
    const S = (t, gl) => sheen({ map: t }, gl);
    Object.assign(M, {
      apron: S(tex('#a9aba9', 9000, grid(1, 1, 'rgba(60,60,60,0.35)')), 'matte'), road: S(tex('#35373a', 9000), 'matte'), runway: S(tex('#2a2c2f', 6000), 'matte'),
      apline: sheen({ color: 0xeeeeea }, 'matte'), apyellow: sheen({ color: 0xf0c020 }, 'matte'), kerbstone: S(tex('#c9c5bc', 1500, grid(2, 2, 'rgba(80,75,65,0.4)')), 'satin'),
      grassA: S(tex('#55744a', 6000), 'matte'), epoxyW: S(tex('#dfe3e6', 1500, grid(1, 1, 'rgba(0,0,0,0.05)')), 'satin'), hallstone: S(tex('#d9d6cf', 1200, grid(1, 1, 'rgba(90,88,80,0.25)')), 'satin'),
      apfacade: S(tex('#2c3a4a', 600, grid(2, 1, 'rgba(10,16,24,0.5)')), 'metal'), apfacadeLow: S(tex('#c9ccd0', 600, grid(2, 1, 'rgba(40,44,50,0.3)')), 'metal'),
      hangwall: S(tex('#eef0f1', 600, grid(1, 4, 'rgba(0,0,0,0.08)')), 'satin'), hangout: S(tex('#56606a', 600, grid(4, 1, 'rgba(0,0,0,0.3)')), 'metal'), truss: S(tex('#f4f6f8', 200), 'paint'),
      soffit: S(tex('#c78d52', 900, grid(1, 16, 'rgba(70,40,15,0.45)')), 'satin'), canopyTop: S(tex('#8d949b', 600), 'metal'), orange: S(tex('#c4521c', 300), 'paint'),
      seatM: S(tex('#203a5c', 800), 'satin'), jetwin: new THREE.MeshBasicMaterial({ color: 0x14181e }), tyreA: S(tex('#141414', 300), 'matte'), gear: S(tex('#c8ccd0', 200), 'metal'),
      cabinWall: S(tex('#e9e8e3', 600), 'satin'), bin: S(tex('#dcdbd6', 300, grid(1, 1, 'rgba(0,0,0,0.12)')), 'satin'), holdFloor: S(tex('#5a5f63', 900, grid(4, 4, 'rgba(0,0,0,0.4)')), 'metal'),
      soffitG: S(tex('#3a3e44', 600, grid(1, 12, 'rgba(0,0,0,0.35)')), 'satin'), glassRail: sheen({ color: 0x9fb8c8, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }, 'glass'), handrail: S(tex('#15171a', 100), 'satin'),
      cessna: S(tex('#f1f1ee', 300), 'paint'), cstripe: S(tex('#b3392a', 300), 'paint'), tower: S(tex('#9aa0a6', 600, grid(1, 8, 'rgba(0,0,0,0.25)')), 'satin'),
    });
    floodMat = M.flood = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }); M.star = new THREE.MeshBasicMaterial({ color: 0xfff1d0, fog: false });
  },
  look(night, nvg) {
    if (floodMat) floodMat.color.set(night ? 0x202020 : nvg ? 0x9cff9c : 0xffffff);
    for (const m of signs) m.color.set(night ? 0x303030 : nvg ? 0x8cff9c : 0xffffff);
  },
  scenery({ b, root, hills, hillM }) {
    signs = [];
    const flat = (m, x0, x1, z0, z1, y = 0, s = 0.2) => b(m).quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], s);
    // ---- ground: grass to the horizon; the model's tarmac covers the airport, ours the apron behind it and the strip to the road ----
    flat('grassA', -600, 660, -600, 640, -0.03, 0.05);
    flat('apron', -30, 80, -72, -4.4, 0.001, 0.08); flat('apron', -30, -16.8, -4.4, 90, 0.001, 0.08);
    flat('apron', -3, 0, -0.5, 55, 0.002, 0.08); flat('apron', 27, 30, -0.5, 55, 0.002, 0.08); flat('apron', 0, 27, -0.5, 0, 0.002, 0.08);
    flat('kerbstone', -3, 30, 55, 77, 0.003, 0.25); flat('road', -30, -16.8, 56, 82, 0.004, 0.08);
    for (let z = 57; z < 82; z += 6) flat('apline', -23.5, -23.3, z, z + 3, 0.006);
    // apron markings: a yellow lead-in line from the taxiway into the hangar, stand boxes, a service road
    flat('apyellow', 31.85, 32.15, -64, -5, 0.004); flat('apyellow', -30, 80, -70.1, -69.8, 0.004);
    for (const x of [8, 56]) flat('apyellow', x - 0.1, x + 0.1, -22, -5, 0.004);
    flat('apline', -30, 80, -6.2, -6.0, 0.004);
    flat('epoxyW', HANGAR.x0, HANGAR.x1, HANGAR.z0, HANGAR.z1, 0.006, 0.08);
    // ---- terminal: the deep roof over the building and the forecourt, the floor band, the escalator bank ----
    const RY = 2 * H + 0.3, C = CANOPY;
    b('canopyTop').box(C.x0, C.x1, RY, RY + 0.9, FOOT.z0 - 1, C.z1, 'xXYzZ', 0.2);
    b('soffitG').box(C.x0, C.x1, RY - 0.01, RY, FOOT.z1, C.z1, 'y', 0.25); b('soffitG').box(C.x0, FOOT.x0, RY - 0.01, RY, FOOT.z0 - 1, FOOT.z1, 'y', 0.25); b('soffitG').box(FOOT.x1, C.x1, RY - 0.01, RY, FOOT.z0 - 1, FOOT.z1, 'y', 0.25);
    for (let i = 0; i < 60; i++) { const x = C.x0 + 1.5 + (i % 10) * (C.x1 - C.x0 - 3) / 9, z = C.z0 + 2 + Math.floor(i / 10) * (C.z1 - C.z0 - 4) / 5; b('star').box(x - 0.15, x + 0.15, RY - 0.02, RY - 0.01, z - 0.15, z + 0.15, 'y'); }
    // the band where the upper floor meets the glass, all round
    b('apfacade').box(FOOT.x0 - 0.12, FOOT.x1 + 0.12, H - 0.35, H + 0.25, FOOT.z1 + 0.02, FOOT.z1 + 0.12, 'xXyYZ', 0.5);
    b('apfacade').box(FOOT.x0 - 0.12, FOOT.x0 - 0.02, H - 0.35, H + 0.25, FOOT.z0, FOOT.z1 + 0.12, 'xyYzZ', 0.5); b('apfacade').box(FOOT.x1 + 0.02, FOOT.x1 + 0.12, H - 0.35, H + 0.25, FOOT.z0, FOOT.z1 + 0.12, 'XyYzZ', 0.5);
    // escalators: two moving stairs and a fixed one between, glass balustrades with black handrails, the well's railing upstairs
    { const S = STAIR, run = (x, y0, y1) => { b('glassRail').quad([x, y0, S.z1], [x, y1, S.z0 + 2.1], [x, y1 + 1.0, S.z0 + 2.1], [x, y0 + 1.0, S.z1], [1, 0, 0], 1);
        b('handrail').box(x - 0.05, x + 0.05, y0 + 1.0, y0 + 1.08, S.z1 - 0.3, S.z1, 'xXyYzZ', 1);
        const L = Math.hypot(S.z1 - S.z0 - 2.1, y1 - y0), m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, L), sheen({ color: 0x15171a }, 'satin')); m.position.set(x, (y0 + y1) / 2 + 1.04, (S.z1 + S.z0 + 2.1) / 2); m.rotation.x = Math.atan2(y1 - y0, S.z1 - S.z0 - 2.1); root.add(m); };
      for (const x of [S.x0 + 0.05, S.x0 + 1.6, S.x1 - 1.6, S.x1 - 0.05]) run(x, 0, H);
      for (const x of [S.x0 - 0.04, S.x1 + 0.04]) { b('glassRail').quad([x, H, S.z0 + 2.1], [x, H, S.z1], [x, H + 1.1, S.z1], [x, H + 1.1, S.z0 + 2.1], [1, 0, 0], 1); b('handrail').box(x - 0.04, x + 0.04, H + 1.05, H + 1.12, S.z0 + 2.1, S.z1, 'xXyYzZ', 1); }
      b('steel').box(S.x0 - 0.1, S.x1 + 0.1, H - 0.6, H, S.z0 + 2.0, S.z0 + 2.1, 'zZy', 0.5); }
    plane(root, 'DEPARTURES', 16, 1.6, 13.5, RY + 0.45, C.z1 + 0.02, 0, { bg: '#1b2430', pw: 1024, ph: 104, bar: '#f0c020' });
    plane(root, 'CHECK-IN 1-6', 5, 0.6, 4.5, 3.4, 16.13, 0, { bg: '#1b2430' }); plane(root, 'CHECK-IN 7-12', 5, 0.6, 22.5, 3.4, 16.13, 0, { bg: '#1b2430' });
    plane(root, 'GATES 1-2  \u2191', 6, 0.7, 13.5, 5.2, 16.13, 0, { bg: '#f0c020', fg: '#111' });
    plane(root, 'GATE 1', 3, 0.6, 0.12, H + 3.2, 29.8, Math.PI / 2, { bg: '#f0c020', fg: '#111' }); plane(root, 'GATE 2', 3, 0.6, 26.88, H + 3.2, 29.8, -Math.PI / 2, { bg: '#f0c020', fg: '#111' });
    plane(root, 'SKYLINE CAFE', 7, 0.8, 7, H + 3.4, 54.85, Math.PI, { bg: '#5a3b22', pw: 1024, ph: 104 }); plane(root, 'VIP', 2, 0.6, 9.02, H + 2.6, 3.5, Math.PI / 2, { bg: '#1e2a38' });
    // ---- the forecourt's Y-shaped columns ----
    { const trunk = new THREE.CylinderGeometry(0.32, 0.4, 7.5, 12), branch = new THREE.CylinderGeometry(0.18, 0.28, 1, 10), wm = sheen({ color: 0xeceeef }, 'paint');
      const tm = new THREE.InstancedMesh(trunk, wm, TREES.length), bm = new THREE.InstancedMesh(branch, wm, TREES.length * 2); const o = new THREE.Object3D(); let k = 0;
      TREES.forEach(([x, z], i) => { o.position.set(x, 3.75, z); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); tm.setMatrixAt(i, o.matrix);
        for (const s2 of [-1, 1]) { const tx = x + s2 * 3.2, tz = z - 0.5, dx = tx - x, dz = tz - z, dy = CANOPY.y - 7.4, L = Math.hypot(dx, dy, dz);
          o.position.set((x + tx) / 2, 7.4 + dy / 2, (z + tz) / 2); o.scale.set(1, L, 1); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / L, dy / L, dz / L)); o.updateMatrix(); bm.setMatrixAt(k++, o.matrix); } });
      tm.castShadow = bm.castShadow = true; root.add(tm, bm); }
    // ---- hangar: clad shell, a glass band over the door, white trusses inside, light strips ----
    const Hg = HANGAR, t = 0.3;
    b('hangout').box(Hg.x0 - t, Hg.x0, 0, Hg.h, Hg.z0, Hg.z1, 'xYzZ', 0.2); b('hangwall').box(Hg.x0 - t, Hg.x0, 0, Hg.h, Hg.z0, Hg.z1, 'X', 0.2);
    b('hangout').box(Hg.x1, Hg.x1 + t, 0, Hg.h, Hg.z0, Hg.z1, 'XYzZ', 0.2); b('hangwall').box(Hg.x1, Hg.x1 + t, 0, Hg.h, Hg.z0, Hg.z1, 'x', 0.2);
    b('hangout').box(Hg.x0 - t, Hg.x1 + t, 0, Hg.h, Hg.z0 - t, Hg.z0, 'zY', 0.2); b('hangwall').box(Hg.x0, Hg.x1, 0, Hg.h, Hg.z0 - t, Hg.z0, 'Z', 0.2);
    for (const [x0, x1] of [[Hg.x0 - t, Hg.door[0]], [Hg.door[1], Hg.x1 + t]]) { b('hangout').box(x0, x1, 0, Hg.doorH, Hg.z1, Hg.z1 + t, 'ZY', 0.2); b('hangwall').box(x0, x1, 0, Hg.doorH, Hg.z1, Hg.z1 + t, 'zxX', 0.2); }
    b('hangout').box(Hg.x0 - t, Hg.x1 + t, Hg.doorH, Hg.doorH + 0.5, Hg.z1, Hg.z1 + t + 0.1, 'ZyY', 0.2);
    b('glass').quad([Hg.x0, Hg.doorH + 0.5, Hg.z1 + 0.15], [Hg.x1, Hg.doorH + 0.5, Hg.z1 + 0.15], [Hg.x1, Hg.h, Hg.z1 + 0.15], [Hg.x0, Hg.h, Hg.z1 + 0.15], [0, 0, 1]);
    for (let x = Hg.x0; x <= Hg.x1 + 0.01; x += 2.6) b('fascia').box(x - 0.05, x + 0.05, Hg.doorH + 0.5, Hg.h, Hg.z1 + 0.1, Hg.z1 + 0.2, 'xXzZ', 1);
    for (const y of [Hg.doorH + 3.4]) b('fascia').box(Hg.x0, Hg.x1, y - 0.05, y + 0.05, Hg.z1 + 0.1, Hg.z1 + 0.2, 'yYzZ', 1);
    b('hangout').box(Hg.x0 - t, Hg.x1 + t, Hg.h, Hg.h + 0.4, Hg.z0 - t, Hg.z1 + t + 0.1, 'xXYzZ', 0.2); b('ceiling').box(Hg.x0, Hg.x1, Hg.h - 0.01, Hg.h, Hg.z0, Hg.z1, 'y', 0.2);
    for (const [dx0, dx1] of [[Hg.x0 - 7, Hg.x0 - 0.2], [Hg.x1 + 0.2, Hg.x1 + 7]]) b('hangout').box(dx0, dx1, 0, Hg.doorH, Hg.z1 + 0.35, Hg.z1 + 0.6, 'xXYzZ', 0.2);   // door leaves slid aside
    for (let z = Hg.z0 + 6; z < Hg.z1; z += 7) {   // roof trusses: top and bottom chords with X bracing between, and a light strip under each
      b('truss').box(Hg.x0, Hg.x1, Hg.h - 0.35, Hg.h - 0.15, z - 0.12, z + 0.12, 'yzZ', 1); b('truss').box(Hg.x0, Hg.x1, Hg.h - 2.6, Hg.h - 2.4, z - 0.12, z + 0.12, 'yYzZ', 1);
      for (let x = Hg.x0; x < Hg.x1 - 1; x += 4) { const q = (x0, x1, ya, yb) => b('truss').quad([x0, ya, z], [x1, yb, z], [x1, yb + 0.14, z], [x0, ya + 0.14, z], [0, 0, 1], 1); q(x, x + 4, Hg.h - 2.4, Hg.h - 0.5); q(x, x + 4, Hg.h - 0.5, Hg.h - 2.4); }
      b('glow').box(Hg.x0 + 2, Hg.x1 - 2, Hg.h - 2.65, Hg.h - 2.6, z - 0.06, z + 0.06, 'y');
    }
    plane(root, 'MAINTENANCE', 10, 1.1, 32, Hg.h + 0.95, Hg.z1 + 0.41, 0, { bg: '#1b2430', bar: '#f0c020' });
    // ---- the jet (the model itself arrives later, see load()): the stair truck at the door and the inside of the open cargo bay ----
    const J = JET, A = AIRSTAIR, N = 10;
    for (let i = 0; i < N; i++) { const x1 = A.x1 - i * (A.x1 - A.x0) / N, x0 = x1 - (A.x1 - A.x0) / N, y = CAB * (i + 1) / N; b('steel').box(x0, x1, y - 0.06, y, A.z0 + 0.03, A.z1 - 0.03, 'xXYzZ', 1); }
    for (const z of [A.z0 - 0.04, A.z1 + 0.04]) { b('gear').quad([A.x1, 0, z], [A.x0, CAB - 0.2, z], [A.x0, CAB, z], [A.x1, 0.2, z], [0, 0, z < A.z1 ? -1 : 1], 1); b('gear').box(A.x1 + 0.1, A.x1 + 0.2, 0, 1.0, z - 0.04, z + 0.04, 'xXzZ', 1);
      b('steel').quad([A.x1 + 0.15, 1.0, z], [A.x0 + 0.2, CAB + 1.0, z], [A.x0 + 0.2, CAB + 1.05, z], [A.x1 + 0.15, 1.05, z], [0, 0, 1], 1); b('gear').box(A.x0 + 0.15, A.x0 + 0.25, CAB, CAB + 1.05, z - 0.04, z + 0.04, 'xXzZ', 1); }
    b('apyellow').box(A.x0 + 0.6, A.x1 + 1.4, 0, 0.55, A.z0 - 0.5, A.z1 + 0.5, 'xXYzZ', 1);   // the stair truck's chassis
    const [h0, h1] = J.hatch, bx0 = JX - J.skin + 0.05, bx1 = JX - 1.0, cy = CAB - 0.12;
    b('holdFloor').box(bx0, bx1, HOLD - 0.02, HOLD, h0, h1, 'Y', 0.5); b('cabinWall').box(bx0, bx1, cy, cy + 0.02, h0, h1, 'y', 0.5);
    b('holdFloor').box(bx1, bx1 + 0.02, HOLD, cy, h0, h1, 'x', 0.5); b('holdFloor').box(bx0, bx1, HOLD, cy, h0, h0 + 0.02, 'Z', 0.5); b('holdFloor').box(bx0, bx1, HOLD, cy, h1 - 0.02, h1, 'z', 0.5);
    b('glow').box(bx1 - 0.6, bx1 - 0.3, cy - 0.01, cy, (h0 + h1) / 2 - 0.15, (h0 + h1) / 2 + 0.15, 'y');
    b('cessna').box(JX - J.skin - 1.0, JX - J.skin - 0.05, 2.0, 2.06, h0, h1, 'xXyYzZ', 1);   // the hatch door, swung up and out
    // ---- light aircraft in the hangar ----
    for (const [x, z, yaw] of GAPLANES) {
      const g = new THREE.Group(), ms = sheen({ color: 0xf1f1ee }, 'paint'), mr = sheen({ color: 0xb3392a }, 'paint'), md = new THREE.MeshLambertMaterial({ color: 0x1b2028 });
      const bx = (w, h, d, px, py, pz, m) => { const m3 = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); m3.position.set(px, py, pz); m3.castShadow = true; g.add(m3); };
      bx(1.1, 1.3, 5.2, 0, 1.15, 0.4, ms); bx(1.12, 0.12, 5.2, 0, 0.95, 0.4, mr); bx(0.6, 0.7, 2.8, 0, 1.05, -3.3, ms); bx(10.6, 0.12, 1.5, 0, 2.0, 0.6, ms); bx(3.4, 0.08, 0.9, 0, 1.2, -4.4, ms); bx(0.08, 1.3, 1.1, 0, 1.85, -4.4, mr);
      bx(1.0, 0.5, 1.1, 0, 1.45, 1.4, md); bx(0.08, 1.4, 0.14, 0, 1.2, 3.05, md);
      for (const [wx, wz] of [[-1.1, 0.2], [1.1, 0.2], [0, 2.4]]) bx(0.16, 0.5, 0.5, wx, 0.25, wz, md);
      g.position.set(x, 0, z); g.rotation.y = yaw; root.add(g);
    }
    // ---- apron floodlights (the control tower is the model's) ----
    for (const [x, z] of [[-10, -20], [74, -20], [-10, -60], [74, -60]]) { b('gear').box(x - 0.2, x + 0.2, 0, 18, z - 0.2, z + 0.2, 'xXzZ', 1); b('fascia').box(x - 1.5, x + 1.5, 18, 19, z - 0.4, z + 0.4, 'xXyYzZ', 1); b('flood').box(x - 1.4, x + 1.4, 17.98, 18, z - 0.35, z + 0.35, 'y', 1); }
    for (const [x, z, r, h] of [[-220, -320, 140, 30], [260, -300, 160, 36], [80, 320, 170, 32], [-260, 160, 130, 26]]) { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7, 1), hillM); m.position.set(x, h / 2 - 3, z); hills.add(m); }
  },
};
const ALLF = 'xXyYzZ';
