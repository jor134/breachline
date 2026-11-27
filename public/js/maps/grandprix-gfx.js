// Grand Prix scenery: the circuit model around the playable area (track, pit lane, guard rails, the circuit's own garages
// east of ours, the hairpin, hills and forest; its buildings rebuilt in our style), and the game's own pieces: the paddock
// ground, team boxes, a slim pit wall with the marshals' gate, lamp heads and night beams on the circuit's light poles, the pit building's facade and team colours, parked cars in the garages and the
// motorhomes in the paddock. Two looks: an afternoon race and a floodlit night race.
import * as THREE from '../../vendor/three.module.min.js';
import { sheen, tex, grid, dedupeTris } from '../mats.js';
import { TEAMS, FURNITURE, TRUCKS, PITWALL, FOOT, H, YARD } from '../core/maps/grandprix.js';
import { TRACK } from '../core/maps/circuit.js';
import { POLES, LINE } from '../core/maps/spa-path.js';
import { ObfLoader } from '../store/obf.js';
import { makeBuildings } from './gp-buildings.js';
import { raceCar } from '../racecar.js';
import { TRUCK, makeTruck, truckAt } from '../truck.js';

const NAMES = ['VORTEX', 'HALCYON', 'KESTREL', 'ORBITA', 'NOVARA', 'SOLSTICE'];   // invented teams
let tod = 'day', floodMat = null, beams = [], gantryMat = null;
const M_gantry = () => gantryMat;
const LAMPS = [[4.5, 3.3, 2, 9, 12], [22.5, 3.3, 2, 9, 12], [40.5, 3.3, 2, 9, 12], [27, 3.3, 9.2, 8, 22], [9, H + 3.1, 2, 8, 14], [27, H + 3.1, 2, 8, 14], [45, H + 3.1, 2, 8, 14], [27, H + 3.1, 13, 8, 24]];
const DAY = {
  sky: [[0, '#3f6fb3'], [0.3, '#7ea6d8'], [0.45, '#b3cbe0'], [0.5, '#bfd0de'], [1, '#bfd0de']], skyR: 460, moon: [160, 140, -40],   // the horizon is the fog colour: distant ground melts into it
  fog: [0xbfd0de], fogD: [0.0034, 0.006], sunAt: [27, 4], sunFrom: [50, 90, -60], shadow: 52, sunCol: 0xfff1d8, sunK: 1.7, hemi: 1.35, hemiSky: 0xd6e4f4, hemiGround: 0x8a8274,
  hillColor: 0x5d6f5a, lamps: LAMPS,
};
const NIGHT = {
  sky: [[0, '#05070f'], [0.35, '#0d1428'], [0.46, '#1a2034'], [0.5, '#151a2a'], [1, '#151a2a']], skyR: 460, moon: [-150, 120, 80],
  fog: [0x151a2a], fogD: [0.0042, 0.009], sunAt: [27, -10], sunFrom: [-20, 60, -70], shadow: 60, sunCol: 0xe8f0ff, sunK: 1.7, hemi: 1.0, hemiSky: 0x8a9ac0, hemiGround: 0x3a3a44,
  hillColor: 0x0b0d14, lamps: LAMPS,
};
const stripes = (a, b, n) => (g, s) => { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * s / n, 0, s / n, s); } };
function sign(text, col) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
  g.fillStyle = '#16181c'; g.fillRect(0, 0, 512, 96); g.fillStyle = col; g.fillRect(0, 0, 18, 96); g.fillRect(494, 0, 18, 96);
  g.fillStyle = '#f2f2ee'; g.font = 'bold 62px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshLambertMaterial({ map: t });
}
const tspot = t => ({ x0: t.x0, z0: t.z0, along: t.along, cabEnd: t.cab });
export default {
  // the transporters' tractors and chassis (js/truck.js) in team colours, once the model has loaded
  // and the circuit around it all: "Circuit de Spa-Francorchamps 1992 layout" by Dave Love (CC BY 4.0), laid out by tools/spa_kit.py
  load() {
    // the circuit model stacks its ground layers (grass, verges, old and new tarmac, pit lane, kerbs) in the same plane in places,
    // which z-fought; each layer gets its own depth bias so the upper one always wins
    const layerRank = n => /rmbl|grdrl|bldg/.test(n) ? 8 : /roadpit|xroadpit/.test(n) ? 7 : /road3x|roadjx|roadgrdx/.test(n) ? 6 : /road1x|road2x/.test(n) ? 5 : /rold2/.test(n) ? 4 : /rold/.test(n) ? 3 : /grvl/.test(n) ? 2 : /rdgrass|gbrm/.test(n) ? 1 : 0;
    const trucks = Promise.all(TRUCKS.map(t => makeTruck(tspot(t), TEAMS[t.team])));
    const circuit = new Promise(res => new ObfLoader().load('models/grandprix/spa.glb', gl => {
      gl.scene.traverse(q => { if (!q.isMesh) return; q.castShadow = false; q.receiveShadow = true; q.matrixAutoUpdate = false; q.updateMatrix(); const m = q.material; if (m.map) m.map.anisotropy = 4; if (m.alphaTest) { m.transparent = false; dedupeTris(q.geometry, 0.08); }   /* the pines' cards came with back copies that z-fought */
        m.roughness = 0.95; const r = layerRank(m.name || ''); if (r) { m.polygonOffset = true; m.polygonOffsetFactor = -r; m.polygonOffsetUnits = -2 * r; } });
      res(gl.scene);
    }, undefined, () => res(null)));
    return Promise.all([trucks, circuit]).then(([ts, c]) => { const g = new THREE.Group(); for (const t of ts) g.add(t); if (c) g.add(c); g.add(makeBuildings()); return g; });
  },
  get env() { return tod === 'night' ? NIGHT : DAY; },
  envs: { day: DAY, night: NIGHT },
  setTod(t) { tod = t === 'night' ? 'night' : 'day'; },
  noshade: { gpline: 1, flood: 1 }, noCast: ['pitlane', 'gpline', 'grass'],
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
      clubwall: S(tex('#e6e1d8', 800), 'satin'), barrier: S(tex('#d8d8d2', 400, stripes('#d8d8d2', '#c43028', 8)), 'paint'), pitwallM: S(tex('#e4e4de', 300, grid(2, 1, 'rgba(0,0,0,0.12)')), 'paint'),
      stand: S(tex('#7d848c', 800, grid(1, 4, 'rgba(0,0,0,0.3)')), 'satin'), seatR: S(tex('#2a4d9a', 400, grid(8, 1, 'rgba(0,0,0,0.35)')), 'satin'), tyreM: S(tex('#151515', 300, grid(1, 3, 'rgba(80,80,80,0.6)')), 'matte'),
      mast: S(tex('#8e949a', 300), 'metal'), gantry: S(tex('#1d2024', 300), 'metal'),
    });
    TEAMS.forEach((c, i) => { M['team' + i] = S(tex(c, 900, grid(1, 2, 'rgba(0,0,0,0.12)')), 'paint'); M['mh' + i] = S(tex('#1b1d21', 300, (g, s) => { g.fillStyle = c; g.fillRect(0, s * 0.12, s, s * 0.6); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(0, s * 0.74, s, s * 0.04); }), 'paint'); });
    floodMat = M.flood = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }); gantryMat = M.gantry;
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
    // the circuit itself (track, kerbs, pit lane, guard rails, the circuit's garages east of ours, hills, trees) is the model, loaded
    // in load(); here: the paddock's own ground, our team boxes in the pit lane, the marshals' gate, timing stands, floodlights
    // the paddock's own ground, round the pit building (its garages keep their own floor)
    flat('pitlane', YARD.x0, FOOT.x0, -4.05, YARD.z1, 0.004, 0.1); flat('pitlane', FOOT.x1, YARD.x1, -4.05, YARD.z1, 0.004, 0.1); flat('pitlane', FOOT.x0, FOOT.x1, FOOT.z1, YARD.z1, 0.004, 0.1);
    // seal the slits in the circuit model: between its pit-lane apron (cut at z -4.05) and our garage floors, and either side of
    // the old pit wall's footprint (removed from the model), where the grass far below showed through
    flat('pitlane', FOOT.x0 - 0.5, FOOT.x1 + 0.5, -4.2, -3.85, 0.02, 0.1);
    flat('pitlane', YARD.x0 - 30, YARD.x1 + 30, -16.8, -13.8, -0.02, 0.1);
    flat('grass', -1400, 1400, -1400, 1400, -52, 0.01);   // far below the model's lowest valley: where the model has no ground, distance and fog
    for (let i = 0; i < 6; i++) { const x = i * 9; for (const [a, c, d, e] of [[x + 1, x + 1.12, -8.9, -4.2], [x + 7.88, x + 8, -8.9, -4.2], [x + 1, x + 8, -8.9, -8.78]]) b('team' + i).quad([a, 0.012, d], [c, 0.012, d], [c, 0.012, e], [a, 0.012, e], [0, 1, 0], 1); }
    // a slim pit wall: painted concrete with a steel cap, open at the marshals' gate (the circuit's rails stop either side of the paddock)
    for (const [x0, x1] of [[PITWALL.x0, PITWALL.gate[0]], [PITWALL.gate[1], PITWALL.x1]]) {
      b('pitwallM').box(x0, x1, 0, PITWALL.h - 0.05, PITWALL.z0, PITWALL.z1, 'xXzZ', 0.5);
      b('mast').box(x0, x1, PITWALL.h - 0.05, PITWALL.h, PITWALL.z0 - 0.03, PITWALL.z1 + 0.03, 'xXzZyY', 1);
    }
    // the circuit's own light poles (POLES, from the model): a lamp head on each, turned to the nearest tarmac; at night each throws
    // a soft beam down onto it
    for (const [x, y, z] of POLES) {
      if (Math.hypot(x - 27, z) > 260) continue;
      let bd = 1e9, tx = x, tz = z; for (let i = 0; i < LINE.length; i += 4) { const d = (LINE[i] - x) ** 2 + (LINE[i + 1] - z) ** 2; if (d < bd) { bd = d; tx = LINE[i]; tz = LINE[i + 1]; } }
      const dl = Math.hypot(tx - x, tz - z) || 1, ux = (tx - x) / dl, uz = (tz - z) / dl, hx = x + ux * 0.6, hz = z + uz * 0.6;
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 0.7), floodMat ? [M_gantry(), M_gantry(), M_gantry(), floodMat, M_gantry(), M_gantry()] : undefined);
      head.position.set(hx, y - 0.1, hz); head.rotation.set(0, Math.atan2(ux, uz), 0); head.rotation.x = 0; head.updateMatrix(); root.add(head);
      if (tod === 'night') {   // apex at the lamp, base on the tarmac a little short of the race line
        const gx = x + (tx - x) * 0.8, gz = z + (tz - z) * 0.8, L = Math.hypot(gx - hx, y - 0.3, gz - hz);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.min(9, L * 0.35), L, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide, fog: false }));
        cone.position.set((hx + gx) / 2, (y - 0.3) / 2, (hz + gz) / 2); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(hx - gx, y - 0.3, hz - gz).normalize()); root.add(cone); beams.push(cone);
      }
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
    // car park: bay lines, lamp posts, and the team transporters (cab + trailer in team colours, the team's name on both sides)
    for (const [z0, z1] of [[22.3, 27.1], [28.8, 33.6], [25.1, 29.9]]) for (let x = -7.4; x < 60; x += 2.8) { if (z0 === 25.1 ? (x > 9 && x < 44) || x < -2 || x > 53 : x < 13 || x > 39) continue; flat('gpline', x - 0.05, x + 0.05, z0, z1, 0.006); }
    for (const [x, z] of [[2, 34], [26, 22], [50, 34], [26, 38]]) { b('mast').box(x - 0.1, x + 0.1, 0, 7, z - 0.1, z + 0.1, 'xXzZ', 1); b('gantry').box(x - 0.5, x + 0.5, 7, 7.2, z - 0.25, z + 0.25, 'xXyYzZ', 1); b('flood').box(x - 0.45, x + 0.45, 6.98, 7, z - 0.2, z + 0.2, 'y', 1); }
    for (const t of TRUCKS) {   // the tractor and the trailer's chassis are the downloaded model (load()); the box on the deck is the team's
      const sp = tspot(t), [ax, az] = truckAt(sp, TRUCK.trailer[0], 0), [bx, bz] = truckAt(sp, TRUCK.trailer[1], TRUCK.W);
      const tx0 = Math.min(ax, bx), tx1 = Math.max(ax, bx), tz0 = Math.min(az, bz), tz1 = Math.max(az, bz), alongX = t.along === 'x', len = TRUCK.trailer[1] - TRUCK.trailer[0];
      b('mh' + t.team).box(tx0, tx1, TRUCK.deck, 4.1, tz0, tz1, 'xXYzZ', 0.12);
      for (const side of [0, 1]) {   // team name on the trailer sides
        const sg = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(8, len - 2), 1.1), sign(NAMES[t.team], TEAMS[t.team])), mid = alongX ? (tx0 + tx1) / 2 : (tz0 + tz1) / 2;
        if (alongX) { sg.position.set(mid, 2.9, side ? tz1 + 0.02 : tz0 - 0.02); sg.rotation.y = side ? 0 : Math.PI; } else { sg.position.set(side ? tx1 + 0.02 : tx0 - 0.02, 2.9, mid); sg.rotation.y = side ? Math.PI / 2 : -Math.PI / 2; }
        root.add(sg);
      }
    }
  },
};
