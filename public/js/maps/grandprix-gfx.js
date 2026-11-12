// Grand Prix scenery: the main straight with kerbs and grid boxes, the pit lane and its markings, the pit wall with its
// debris fence, empty grandstands across the track, floodlight towers, the pit building's facade and team colours, parked
// cars in the garages and the motorhomes in the paddock. Two looks: an afternoon race and a floodlit night race.
import * as THREE from '../../vendor/three.module.min.js';
import { sheen, tex, grid } from '../mats.js';
import { TEAMS, FURNITURE, MOTORHOMES, PITWALL, FOOT, H } from '../core/maps/grandprix.js';
import { TRACK, VIS } from '../core/maps/circuit.js';
import { raceCar } from '../racecar.js';

const NAMES = ['VORTEX', 'HALCYON', 'KESTREL', 'ORBITA', 'NOVARA', 'SOLSTICE'];   // invented teams
let tod = 'day', floodMat = null, beams = [];
const LAMPS = [[4.5, 3.3, 2, 9, 12], [22.5, 3.3, 2, 9, 12], [40.5, 3.3, 2, 9, 12], [27, 3.3, 9.2, 8, 22], [9, H + 3.1, 2, 8, 14], [27, H + 3.1, 2, 8, 14], [45, H + 3.1, 2, 8, 14], [27, H + 3.1, 13, 8, 24]];
const DAY = {
  sky: [[0, '#3f6fb3'], [0.3, '#7ea6d8'], [0.47, '#cfe0ee'], [0.5, '#e9eef0'], [0.53, '#6c6a62'], [1, '#3a3834']], skyR: 460, moon: [160, 140, -40],
  fog: [0xbfd0de], fogD: [0.0022, 0.006], sunAt: [27, 4], sunFrom: [50, 90, -60], shadow: 52, sunCol: 0xfff1d8, sunK: 1.7, hemi: 1.35, hemiSky: 0xd6e4f4, hemiGround: 0x8a8274,
  hillColor: 0x5d6f5a, lamps: LAMPS,
};
const NIGHT = {
  sky: [[0, '#05070f'], [0.35, '#0d1428'], [0.47, '#2a2f4a'], [0.5, '#4a4458'], [0.53, '#14141a'], [1, '#0a0a0c']], skyR: 460, moon: [-150, 120, 80],
  fog: [0x151a2a], fogD: [0.0035, 0.009], sunAt: [27, -10], sunFrom: [-20, 60, -70], shadow: 60, sunCol: 0xe8f0ff, sunK: 1.7, hemi: 1.0, hemiSky: 0x8a9ac0, hemiGround: 0x3a3a44,
  hillColor: 0x0b0d14, lamps: LAMPS,
};
const stripes = (a, b, n) => (g, s) => { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * s / n, 0, s / n, s); } };
function sign(text, col) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
  g.fillStyle = '#16181c'; g.fillRect(0, 0, 512, 96); g.fillStyle = col; g.fillRect(0, 0, 18, 96); g.fillRect(494, 0, 18, 96);
  g.fillStyle = '#f2f2ee'; g.font = 'bold 62px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshLambertMaterial({ map: t });
}
export default {
  get env() { return tod === 'night' ? NIGHT : DAY; },
  envs: { day: DAY, night: NIGHT },
  setTod(t) { tod = t === 'night' ? 'night' : 'day'; },
  noshade: { gpline: 1, kerb: 1, flood: 1, gpfence: 1 }, noCast: ['tarmac', 'pitlane', 'gpline', 'kerb', 'grass'],
  outer: w => w.f >= 1 ? 'facade' : 'facadeLow',
  inner: w => { if (w.f === 0 && w.z1 <= 8.1 && w.z0 >= -4.1) { const i = Math.max(0, Math.min(5, Math.floor(((w.x0 + w.x1) / 2) / 9))); return 'team' + i; } return w.f === 1 ? 'clubwall' : 'plaster'; },
  door: () => 'door',
  mats(M) {
    if (M.tarmac) return;
    const S = (t, gl) => sheen({ map: t }, gl);
    Object.assign(M, {
      tarmac: S(tex('#2f3134', 12000), 'matte'), pitlane: S(tex('#45474a', 9000), 'matte'), grass: S(tex('#3d6b34', 6000), 'matte'), gpline: sheen({ color: 0xeeeeea }, 'matte'),
      kerb: S(tex('#ffffff', 0, stripes('#d42a22', '#f2f2ee', 2)), 'matte'), epoxy: S(tex('#c9ccd0', 1200, grid(1, 1, 'rgba(0,0,0,0.08)')), 'gloss'),
      facade: S(tex('#c8ccd2', 600, grid(2, 1, 'rgba(40,44,50,0.35)')), 'metal'), facadeLow: S(tex('#2b2f35', 600, grid(2, 1, 'rgba(0,0,0,0.4)')), 'metal'),
      clubwall: S(tex('#e6e1d8', 800), 'satin'), barrier: S(tex('#d8d8d2', 400, stripes('#d8d8d2', '#c43028', 8)), 'paint'), pitwallM: S(tex('#e4e4de', 300, grid(4, 1, 'rgba(0,0,0,0.2)')), 'paint'),
      stand: S(tex('#7d848c', 800, grid(1, 4, 'rgba(0,0,0,0.3)')), 'satin'), seatR: S(tex('#2a4d9a', 400, grid(8, 1, 'rgba(0,0,0,0.35)')), 'satin'), tyreM: S(tex('#151515', 300, grid(1, 3, 'rgba(80,80,80,0.6)')), 'matte'),
      mast: S(tex('#8e949a', 300), 'metal'), gantry: S(tex('#1d2024', 300), 'metal'),
    });
    TEAMS.forEach((c, i) => { M['team' + i] = S(tex(c, 900, grid(1, 2, 'rgba(0,0,0,0.12)')), 'paint'); M['mh' + i] = S(tex('#1b1d21', 300, (g, s) => { g.fillStyle = c; g.fillRect(0, s * 0.55, s, s * 0.12); g.fillStyle = 'rgba(150,190,220,0.6)'; for (let k = 0; k < 4; k++) g.fillRect(k * s / 4 + 8, s * 0.2, s / 4 - 16, s * 0.25); }), 'paint'); });
    floodMat = M.flood = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    const fc = document.createElement('canvas'); fc.width = fc.height = 128; const fg = fc.getContext('2d'); fg.strokeStyle = 'rgba(175,180,186,0.9)'; fg.lineWidth = 1;
    for (let i = 0; i <= 128; i += 8) { fg.beginPath(); fg.moveTo(i, 0); fg.lineTo(i, 128); fg.stroke(); fg.beginPath(); fg.moveTo(0, i); fg.lineTo(128, i); fg.stroke(); }
    const ft = new THREE.CanvasTexture(fc); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; M.gpfence = sheen({ map: ft, transparent: true, opacity: 0.75, alphaTest: 0.2, depthWrite: false, side: THREE.DoubleSide }, 'metal');
  },
  look(night, nvg) {   // night here = the power is cut: the floodlights and their beams go dark with it
    if (floodMat) floodMat.color.set(night ? 0x202020 : nvg ? 0x9cff9c : tod === 'night' ? 0xffffff : 0xdedede);
    for (const b of beams) b.visible = tod === 'night' && !night;
  },
  scenery({ b, root, hills, hillM }) {
    beams = [];
    const flat = (m, x0, x1, z0, z1, y = 0, s = 0.2) => b(m).quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], s);
    // ground: track, kerbs, run-off, pit lane, paddock
    flat('tarmac', VIS.x0 - 60, VIS.x1 + 60, TRACK.z0, TRACK.z1, 0.002, 0.08);
    flat('pitlane', -60, 116, TRACK.z1, 42, 0.001, 0.1);
    flat('grass', VIS.x0 - 60, VIS.x1 + 60, -90, TRACK.z0 - 1.2, 0, 0.05);
    for (const z of [TRACK.z0, TRACK.z1 - 0.9]) b('kerb').quad([VIS.x0 - 60, 0.006, z], [VIS.x1 + 60, 0.006, z], [VIS.x1 + 60, 0.006, z + 0.9], [VIS.x0 - 60, 0.006, z + 0.9], [0, 1, 0], 0.5);
    for (const z of [TRACK.z0 + 1.0, TRACK.z1 - 1.0]) flat('gpline', VIS.x0 - 60, VIS.x1 + 60, z - 0.06, z + 0.06, 0.007);
    for (let k = 0; k < 10; k++) { const x = 70 - k * 8, z = TRACK.zc + (k % 2 ? 2.4 : -2.4); flat('gpline', x - 0.06, x + 0.06, z - 1.2, z + 1.2, 0.008); flat('gpline', x - 1.2, x, z - 1.2, z - 1.08, 0.008); flat('gpline', x - 1.2, x, z + 1.08, z + 1.2, 0.008); }   // grid boxes
    for (let z = TRACK.z0 + 1; z < TRACK.z1 - 1; z += 1.2) { flat('gpline', 79.2, 79.8, z, z + 0.6, 0.009); flat('kerb', 79.8, 80.4, z, z + 0.6, 0.009); }   // start/finish line
    flat('gpline', -60, 116, -9.06, -8.94, 0.006);                 // fast lane / working lane
    for (let i = 0; i < 6; i++) { const x = i * 9; for (const [a, c, d, e] of [[x + 1, x + 1.12, -8.9, -4.2], [x + 7.88, x + 8, -8.9, -4.2], [x + 1, x + 8, -8.9, -8.78]]) b('team' + i).quad([a, 0.007, d], [c, 0.007, d], [c, 0.007, e], [a, 0.007, e], [0, 1, 0], 1); }
    // pit wall with its debris fence and timing gantry; far-side barrier and tyre wall
    b('pitwallM').box(PITWALL.x0, PITWALL.x1, 0, PITWALL.h, PITWALL.z0, PITWALL.z1, 'xXYzZ', 0.5);
    b('gpfence').box(PITWALL.x0, PITWALL.x1, PITWALL.h, 4.2, PITWALL.z0 + 0.15, PITWALL.z0 + 0.17, 'zZ', 0.5);
    for (let x = PITWALL.x0; x <= PITWALL.x1; x += 6) b('mast').box(x - 0.05, x + 0.05, PITWALL.h, 4.3, PITWALL.z0 + 0.1, PITWALL.z0 + 0.2, 'xXzZ', 1);
    for (const x of [8, 26, 44]) { b('gantry').box(x - 2.5, x + 2.5, 1.1, 2.4, PITWALL.z1, PITWALL.z1 + 1.2, 'xXyYzZ', 1); b('gantry').box(x - 2.4, x + 2.4, 2.4, 2.5, PITWALL.z1 - 0.2, PITWALL.z1 + 1.6, 'xXyYzZ', 1); }
    b('barrier').box(VIS.x0 - 60, VIS.x1 + 60, 0, 1.2, TRACK.z0 - 1.2, TRACK.z0 - 0.4, 'xXYzZ', 0.5);
    b('gpfence').box(VIS.x0 - 60, VIS.x1 + 60, 1.2, 4.5, TRACK.z0 - 0.82, TRACK.z0 - 0.8, 'zZ', 0.5);
    // grandstands across the track: stepped concrete with blue seats, a roof on columns
    for (const [x0, x1] of [[-140, -20], [-10, 110], [120, 240]]) {
      for (let r = 0; r < 12; r++) { const z0 = TRACK.z0 - 8 - r * 0.9, y = 1 + r * 0.5; b('stand').box(x0, x1, 0, y, z0 - 0.9, z0, 'Yz', 0.3); b('seatR').box(x0 + 0.3, x1 - 0.3, y, y + 0.35, z0 - 0.75, z0 - 0.35, 'Yz', 0.5); }
      b('stand').box(x0, x1, 0, 7, TRACK.z0 - 20, TRACK.z0 - 18.9, 'Zz', 0.3);
      b('gantry').box(x0, x1, 11, 11.3, TRACK.z0 - 20, TRACK.z0 - 6, 'yY', 0.3);
      for (let x = x0; x <= x1; x += 20) b('mast').box(x - 0.2, x + 0.2, 0, 11, TRACK.z0 - 19.6, TRACK.z0 - 19.2, 'xXzZ', 1);
    }
    // floodlight towers along both sides of the straight; at night they light the track with soft beams
    for (let x = VIS.x0 + 20; x < VIS.x1; x += 45) for (const z of [TRACK.z0 - 5, x > PITWALL.x0 - 5 && x < PITWALL.x1 + 5 ? null : TRACK.z1 + 3]) {
      if (z === null) continue;
      b('mast').box(x - 0.25, x + 0.25, 0, 22, z - 0.25, z + 0.25, 'xXzZ', 1); b('gantry').box(x - 2, x + 2, 22, 23.2, z - 0.3, z + 0.3, 'xXyYzZ', 1);
      b('flood').box(x - 1.9, x + 1.9, 22.05, 23.15, z + (z < TRACK.z0 ? 0.31 : -0.32), z + (z < TRACK.z0 ? 0.32 : -0.31), z < TRACK.z0 ? 'Z' : 'z', 1);
      if (tod === 'night') { const cone = new THREE.Mesh(new THREE.ConeGeometry(9, 22, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide, fog: false }));
        cone.position.set(x, 11, z < TRACK.z0 ? TRACK.zc - 2 : TRACK.zc + 4); cone.rotation.x = z < TRACK.z0 ? -0.25 : 0.25; root.add(cone); beams.push(cone); }
    }
    // pit building: team boards over the garage fronts, a header over each opening, the hospitality balcony rail
    for (let i = 0; i < 6; i++) {
      const x = i * 9, s = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.2), sign(NAMES[i], TEAMS[i])); s.position.set(x + 4.5, 3.0, -4.12); s.rotation.y = Math.PI; root.add(s);
      b('facadeLow').box(x + 1, x + 8, 2.45, 2.4 + 0.03, -4.1, -3.9, 'yY', 1);
    }
    b('facade').box(FOOT.x0, FOOT.x1, 2 * H, 2 * H + 0.6, FOOT.z0 - 0.05, FOOT.z1 + 0.05, 'xXYzZ', 0.5);     // roof parapet
    b('facade').box(FOOT.x0, FOOT.x1, H - 0.1, H + 0.12, FOOT.z0 - 1.2, FOOT.z0, 'xXyYz', 0.5);              // overhang over the garage fronts
    // parked cars in the garages (their collision is the furniture box), tyre stacks drawn as rings
    for (const [f, x0, z0, x1, z1, hh, kind, face] of FURNITURE) {
      if (kind === 'racecar') { const i = Math.floor(x0 / 9), g = raceCar(TEAMS[i]); g.position.set((x0 + x1) / 2, f * H, (z0 + z1) / 2); g.rotation.y = face === '-z' ? Math.PI : 0; root.add(g); }
    }
    // motorhomes in the paddock
    for (const m of MOTORHOMES) b('mh' + m.c).box(m.x0, m.x1, 0, 3.8, m.z0, m.z1, 'xXYzZ', 0.08);
    for (const [x, z, r, h] of [[-160, -200, 110, 26], [200, -230, 140, 32], [60, 260, 150, 30], [-200, 120, 120, 24]]) { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7, 1), hillM); m.position.set(x, h / 2 - 3, z); hills.add(m); }
  },
};
