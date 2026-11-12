// Terminal scenery: asphalt yard, container stacks, ship-to-shore and yard cranes, trucks, floodlight masts, the moored ship and a city skyline across the harbour.
// Everything is merged into one mesh per material by the shared Builder, so a yard of a few hundred containers is still a handful of draw calls.
import * as THREE from '../../vendor/three.module.min.js';
import { sheen, tex, grid } from '../mats.js';
import { STACKS, PADS, CL, CH, CW, HULL, TOWER, GANGWAYS, STS, RTG, TRUCKS, FLOODS, OPS, EXIT } from '../core/maps/terminal.js';

const CONT = ['#9c2b23', '#1f4e8c', '#2f6b3a', '#c27a1c', '#6b6f73', '#d8d4c8', '#7a3b2a', '#14385c', '#b8a23a', '#5b2a4e'];
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
const colourOf = (si, tier) => 'c' + (hash(si, tier) % CONT.length);
const corrugate = (n, dark = 0.2) => (g, s) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${dark})`; g.fillRect(i * s / n, 0, s / (2 * n), s); g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(i * s / n + s / (2 * n), 0, s / (4 * n), s); } g.fillStyle = 'rgba(70,40,20,0.10)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 10, 1 + Math.random() * 18); };
const S4 = 1 / 4.8;   // corrugation pitch: 16 ribs per 4.8 m tile = 0.3 m
let skyline = null;

export default {
  env: {
    sky: [[0, '#151d33'], [0.25, '#2c3656'], [0.42, '#6f5a6e'], [0.48, '#d98a52'], [0.505, '#f2b26a'], [0.53, '#3d3533'], [1, '#1d1b1a']], skyR: 440, moon: [120, 110, 150],
    fog: [0x4a4250], fogD: [0.0042, 0.009], sunAt: [55, 25], sunFrom: [-55, 26, -95], shadow: 78, sunCol: 0xffb27a, sunK: 1.15, hillColor: 0x221d26,
    hemiSky: 0xb4b2cc, hemiGround: 0x6e6052, lamps: [[8, 2.7, 67, 8, 12], [90, 2 * 3.2 + 2.6, -10, 7, 12], [90, 4 * 3.2 + 2.6, -17, 7, 12], [43, 18, 42, 34, 60]],
  },
  noshade: { stripe: 1, skyl: 1, fence: 1, red: 1 }, noCast: ['asphalt', 'concrete', 'gravel', 'ocean', 'stripe', 'deck'],
  tread: 'steel',
  outer: w => w.f >= 2 ? 'shipwhite' : 'cladding',
  door: d => d.f >= 2 ? 'steel' : 'door',
  contDoor: d => colourOf(STACKS.indexOf(PADS[d.pad].s), 0),
  mats(M) {
    if (M.c0) return;
    const S = (t, gl) => sheen({ map: t }, gl);
    CONT.forEach((c, i) => { M['c' + i] = S(tex(c, 1200, corrugate(16)), 'satin'); });
    Object.assign(M, {
      asphalt: S(tex('#3b3c3e', 9000), 'matte'), concrete: S(tex('#8d8a84', 4000, grid(2, 2, 'rgba(40,38,34,0.35)')), 'stone'), deck: S(tex('#5a5f63', 3000, grid(1, 6, 'rgba(0,0,0,0.25)')), 'satin'),
      hull: S(tex('#1d2836', 900), 'paint'), boot: S(tex('#6e1f1c', 500), 'paint'), shipwhite: S(tex('#e3e1db', 600, grid(1, 3, 'rgba(0,0,0,0.12)')), 'paint'),
      craneR: S(tex('#b3302a', 400), 'paint'), craneW: S(tex('#e4e2dc', 400), 'paint'), rtgY: S(tex('#d6a52b', 400), 'paint'), gang: S(tex('#4f5357', 600, grid(8, 8, 'rgba(15,15,15,0.55)')), 'metal'),
      cladding: S(tex('#9aa1a8', 900, corrugate(24, 0.12)), 'satin'), tyre: S(tex('#161616', 300), 'matte'), cab: S(tex('#d6d2c8', 300), 'paint'), cabB: S(tex('#2a5d8f', 300), 'paint'),
      stripe: sheen({ color: 0xd8b13a }, 'matte'), white: sheen({ color: 0xdcdcd6 }, 'matte'), red: sheen({ color: 0xc02a24 }, 'paint'),
    });
    const fc = document.createElement('canvas'); fc.width = fc.height = 64; const fg = fc.getContext('2d'); fg.strokeStyle = 'rgba(190,195,200,1)'; fg.lineWidth = 2;
    for (let i = -64; i < 128; i += 16) { fg.beginPath(); fg.moveTo(i, 0); fg.lineTo(i + 64, 64); fg.stroke(); fg.beginPath(); fg.moveTo(i + 64, 0); fg.lineTo(i, 64); fg.stroke(); }
    const ft = new THREE.CanvasTexture(fc); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; M.fence = sheen({ map: ft, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }, 'metal');
  },
  look(night, nvg, wx) { if (skyline) skyline.color.set(nvg ? 0x6dff7a : wx === 'clear' ? 0xffffff : 0x9a9aa2); },
  scenery({ b, hills, hillM, THREE, H, YARD, ALL, root }) {
    const box = (m, x0, x1, y0, y1, z0, z1, faces = ALL, s = 0.5) => b(m).box(x0, x1, y0, y1, z0, z1, faces, s);
    const flat = (m, x0, x1, z0, z1, y, s = 0.25) => b(m).quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], s);
    const DECK = 2 * H;
    // ---- land, quay wall, water ----
    flat('asphalt', YARD.x0, YARD.x1, 0, 76, 0, 0.18); flat('concrete', -90, 210, 76, 96, 0, 0.25); flat('gravel', -90, YARD.x0, 0, 76, 0, 0.2); flat('gravel', YARD.x1, 210, 0, 76, 0, 0.2); flat('gravel', -90, 210, 96, 220, 0, 0.1);
    flat('concrete', YARD.x0, YARD.x1, 0, 1.6, 0.006, 0.5);
    box('concrete', -90, 210, -5, 0, -0.35, 0, 'zY', 0.5);
    b('ocean').quad([-600, -2.5, -0.35], [800, -2.5, -0.35], [800, -2.5, -700], [-600, -2.5, -700], [0, 1, 0], 0.03);
    // painted lanes, crane rails, the quay safety rail
    for (const z of [3.6, 27.4]) { box('steel', YARD.x0, YARD.x1, 0, 0.05, z - 0.08, z + 0.08, 'Yzz'); }
    for (const z of [7, 13.5, 20, 31, 50.8, 61, 74]) for (let x = YARD.x0 + 1; x < YARD.x1 - 2; x += 6) flat('stripe', x, x + 3, z - 0.07, z + 0.07, 0.012);
    for (const x of [43.3, 85.3]) for (let z = 30; z < 74; z += 6) flat('white', x - 0.07, x + 0.07, z, z + 3, 0.012);
    for (let x = YARD.x0; x < YARD.x1; x += 2.5) box('stripe', x, x + 0.06, 0, 1.05, 0.1, 0.16);
    box('stripe', YARD.x0, YARD.x1, 0.98, 1.05, 0.08, 0.18); box('stripe', YARD.x0, YARD.x1, 0.5, 0.55, 0.1, 0.16);
    for (let x = 0; x < YARD.x1; x += 9) box('fascia', x, x + 0.5, 0, 0.5, 0.35, 0.85);   // bollards
    // ---- containers ----
    STACKS.forEach((s, si) => {
      const [x0, z0, x1, z1, y, t, pi] = s;
      for (let k = 0; k < t; k++) {
        const m = colourOf(si, k), y0 = y + k * CH, y1 = y0 + CH - 0.02, top = k === t - 1;
        if (k === 0 && pi >= 0) {   // hollow: walls with an inside, a plank floor, the open end framed by corner posts
          const p = PADS[pi], w = 0.1, bx0 = p.dir < 0 ? x1 - w : x0, bx1 = bx0 + w;
          box(m, x0, x1, y0, y1, z0, z0 + w, ALL, S4); box(m, x0, x1, y0, y1, z1 - w, z1, ALL, S4); box(m, bx0, bx1, y0, y1, z0, z1, ALL, S4); box(m, x0, x1, y1 - 0.1, y1, z0, z1, ALL, S4);
          flat('wood', x0 + 0.05, x1 - 0.05, z0 + w, z1 - w, y0 + 0.01, 1.5);
          const ex = p.door; box('fascia', ex - 0.1, ex + 0.1, y0, y1, z0, z0 + 0.14); box('fascia', ex - 0.1, ex + 0.1, y0, y1, z1 - 0.14, z1); box('fascia', ex - 0.1, ex + 0.1, y1 - 0.18, y1, z0, z1);
          continue;
        }
        box(m, x0, x1, y0, y1, z0, z1, top ? 'xXzZY' : 'xXzZ', S4);
        for (const ex of [x0, x1]) {   // door end: locking bars and corner castings, so every box reads as a container
          const o = ex === x0 ? -0.02 : 0.02;
          for (const f of [0.22, 0.4, 0.6, 0.78]) { const zz = z0 + (z1 - z0) * f; box('steel', ex + o - 0.015, ex + o + 0.015, y0 + 0.1, y1 - 0.1, zz - 0.015, zz + 0.015, 'xXzZ'); }
          box('fascia', ex - 0.03, ex + 0.03, y0, y0 + 0.14, z0, z1, 'xXY'); box('fascia', ex - 0.03, ex + 0.03, y1 - 0.14, y1, z0, z1, 'xXy');
        }
      }
    });
    // ---- ship: hull, bow, deck, bulwark, tower dressing ----
    const { x0: hx0, x1: hx1, z0: hz0, z1: hz1 } = HULL, BW = DECK + 1.1;
    box('hull', hx0, hx1, -0.6, BW, hz0, hz1, 'zZX', 0.3); box('boot', hx0, hx1, -3.2, -0.6, hz0, hz1, 'zZX', 0.3);
    const bowTip = [hx0 - 9, (hz0 + hz1) / 2], bowSide = (za, s) => { const n = [za - bowTip[1], 0, bowTip[0] - hx0], l = Math.hypot(n[0], n[2]); n[0] *= s / l; n[2] *= s / l; b('hull').quad([hx0, -0.6, za], [bowTip[0], -0.6, bowTip[1]], [bowTip[0], BW + 1.2, bowTip[1]], [hx0, BW, za], n, 0.3); b('boot').quad([hx0, -3.2, za], [bowTip[0], -3.2, bowTip[1]], [bowTip[0], -0.6, bowTip[1]], [hx0, -0.6, za], n, 0.3); };
    bowSide(hz1, 1); bowSide(hz0, -1); b('deck').quad([hx0, DECK + 1.1, hz1], [bowTip[0], BW + 1.2, bowTip[1]], [bowTip[0], BW + 1.2, bowTip[1]], [hx0, DECK + 1.1, hz0], [0, 1, 0], 0.3);
    flat('deck', hx0, TOWER.x0, hz0, hz1, DECK + 0.002, 0.3); flat('deck', TOWER.x1, hx1, hz0, hz1, DECK + 0.002, 0.3); flat('deck', TOWER.x0, TOWER.x1, hz0, TOWER.z0, DECK + 0.002, 0.3); flat('deck', TOWER.x0, TOWER.x1, TOWER.z1, hz1, DECK + 0.002, 0.3);
    let x = hx0; for (const g of GANGWAYS) { box('hull', x, g.b, DECK, BW, hz1 - 0.3, hz1, 'xXYz'); x = g.c; } box('hull', x, hx1, DECK, BW, hz1 - 0.3, hz1, 'xXYz');
    box('hull', hx0, hx1, DECK, BW, hz0, hz0 + 0.3, 'YZ'); box('hull', hx0, hx0 + 0.3, DECK, BW, hz0, hz1, 'XY'); box('hull', hx1 - 0.3, hx1, DECK, BW, hz0, hz1, 'xY');
    for (let xx = hx0 + 2; xx < hx1; xx += 4) { box('white', xx, xx + 0.04, -0.4, BW - 0.3, hz1 - 0.004, hz1 + 0.01, 'Z'); }   // draught-mark ticks along the side
    const T = TOWER, R5 = 5 * H;
    box('shipwhite', T.x0 - 0.4, T.x1 + 0.4, R5, R5 + 0.3, T.z0 - 0.4, T.z1 + 0.4, ALL, 0.5); box('dark', T.x0 - 0.02, T.x1 + 0.02, 4 * H + 2.55, 4 * H + 3.0, T.z0 - 0.02, T.z0 + 0.02, 'z');
    for (const [za, zb] of [[hz0 + 0.5, T.z0], [T.z1, hz1 - 0.5]]) { box('shipwhite', T.x0, T.x0 + 6, 4 * H - 0.25, 4 * H, za, zb, ALL, 0.5); box('steel', T.x0, T.x0 + 6, 4 * H + 1.0, 4 * H + 1.06, za === hz0 + 0.5 ? za : zb - 0.06, za === hz0 + 0.5 ? za + 0.06 : zb, ALL); }
    box('craneR', 92, 95.5, R5 + 0.3, R5 + 4.6, -17, -11, 'xXzZ', 0.5); box('fascia', 92, 95.5, R5 + 4.6, R5 + 5.4, -17, -11, 'xXzZY', 0.5);
    box('steel', 87.8, 88.2, R5 + 0.3, R5 + 6.5, -14.2, -13.8); box('steel', 86, 90, R5 + 5.4, R5 + 5.6, -14.1, -13.9); box('glow', 87.9, 88.1, R5 + 6.5, R5 + 6.7, -14.1, -13.9);
    // ---- gangways: sloped treads, steel side panels with a top rail ----
    for (const g of GANGWAYS) {
      const za = 1, zb = 2.5, k = DECK / 16;
      b('gang').quad([g.a, 0.01, za], [g.b, DECK + 0.01, za], [g.b, DECK + 0.01, zb], [g.a, 0.01, zb], [-k, 1, 0], 0.5);
      for (let xx = g.a + 0.4; xx < g.b; xx += 0.4) { const y = (xx - g.a) * k + 0.01; box('steel', xx - 0.02, xx + 0.02, y, y + 0.04, za, zb, 'xXY'); }
      for (const [zc, xa, xb] of [[za - 0.03, g.a, g.b], [zb + 0.03, g.a, g.c]]) {   // side panels follow the slope: a skirt below the treads, mesh panel and a yellow handrail above
        const yA = x => Math.min(DECK, Math.max(0, (x - g.a) * k)), pts = [xa, g.b, xb].filter((v, i, a) => v <= xb && a.indexOf(v) === i);
        for (let i = 0; i < pts.length - 1; i++) { const x0 = pts[i], x1 = pts[i + 1], y0 = yA(x0), y1 = yA(x1);
          for (const [n, o] of [[1, 0.03], [-1, -0.03]]) { b('gang').quad([x0, Math.max(0, y0 - 0.3), zc + o], [x1, Math.max(0, y1 - 0.3), zc + o], [x1, y1 + 1.05, zc + o], [x0, y0 + 1.05, zc + o], [0, 0, n], 0.5); b('stripe').quad([x0, y0 + 1.05, zc + o * 1.6], [x1, y1 + 1.05, zc + o * 1.6], [x1, y1 + 1.13, zc + o * 1.6], [x0, y0 + 1.13, zc + o * 1.6], [0, 0, n]); }
          b('stripe').quad([x0, y0 + 1.13, zc - 0.05], [x1, y1 + 1.13, zc - 0.05], [x1, y1 + 1.13, zc + 0.05], [x0, y0 + 1.13, zc + 0.05], [0, 1, 0]); }
        for (let xx = xa; xx <= xb; xx += 2) { const y = yA(xx); box('steel', xx - 0.04, xx + 0.04, Math.max(0, y - 0.3), y + 1.13, zc - 0.05, zc + 0.05, 'xXzZ'); }
      }
      box('gang', g.b, g.c, DECK - 0.2, DECK, hz1, zb, ALL, 0.5); box('gang', g.c, g.c + 0.06, DECK - 0.2, DECK + 1.1, hz1, zb + 0.06, ALL, 0.5); box('gang', g.b - 0.06, g.b, DECK - 0.2, DECK + 1.1, hz1, za, ALL, 0.5);
      for (const xx of [g.a + 5, g.a + 10.5, g.b - 0.4]) { const y = (xx - g.a) * k; box('steel', xx, xx + 0.25, 0, y - 0.2, 1.6, 1.9); }
    }
    // ---- ship-to-shore cranes: portal legs, boom over the ship, A-frame, trolley and spreader ----
    const cables = [];
    for (const c of STS) {
      const m = 'craneR', w = 'craneW';
      for (const lx of [c - 8, c + 8]) { for (const z of [3, 26.8]) { box(m, lx - 0.6, lx + 0.6, 0, 44, z, z + 1.2, 'xXzZ', 0.5); box('fascia', lx - 0.9, lx + 0.9, 0, 1.2, z - 0.4, z + 1.6, 'xXzZY'); } box(w, lx - 0.4, lx + 0.4, 28, 29, 4.2, 26.8, ALL); }
      for (const z of [3, 26.8]) { box(m, c - 8.6, c + 8.6, 13, 14.6, z, z + 1.2, ALL, 0.5); box(w, c - 8.6, c + 8.6, 42, 44, z, z + 1.2, ALL, 0.5); }
      for (const sx of [-3.6, 3.6]) box(w, c + sx - 0.6, c + sx + 0.6, 44, 46.4, -46, 36, ALL, 0.5);
      for (let z = -44; z < 34; z += 6) box(w, c - 3.6, c + 3.6, 44.2, 44.6, z, z + 0.4);
      box('craneW', c - 4.5, c + 4.5, 46.4, 50.5, 28, 35, ALL, 0.5); box('dark', c - 4.52, c + 4.52, 48, 49.4, 28.4, 34.6, 'xX');
      for (const sx of [-6, 6]) for (const z of [8, 22]) cables.push([c + sx, 44, z, c + sx * 0.2, 62, 15]);
      box(m, c - 1.4, c + 1.4, 60, 63, 13.6, 16.4, ALL, 0.5);
      for (const sx of [-1, 1]) { cables.push([c + sx, 62, 15, c + sx * 3.6, 46, -44]); cables.push([c + sx, 62, 15, c + sx * 3.6, 46, 34]); }
      const tz = -14 + (c % 7); box('craneW', c - 3, c + 3, 46.4, 48.4, tz - 2, tz + 2, ALL, 0.5); box('dark', c - 1.2, c + 1.2, 42.8, 44, tz - 1.4, tz + 1.4, 'xXzZy');
      const sy = DECK + 3 * CH + 3; for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cables.push([c + sx, 44, tz + sz, c + sx * 1.1, sy + 0.5, tz + sz * 0.9]);
      box('rtgY', c - 6.1, c + 6.1, sy, sy + 0.5, tz - 1.2, tz + 1.2, ALL, 0.5);
      box('glow', c - 0.15, c + 0.15, 63, 63.3, 14.85, 15.15); for (const z of [-46, 36]) box('glow', c - 0.15, c + 0.15, 46.4, 46.7, z, z + 0.3);
    }
    // ---- rubber-tyred gantries over the yard blocks ----
    for (const [cx, za, zb] of RTG) {
      for (const lx of [cx - 4.5, cx + 4.5]) { for (const z of [za, zb]) { box('rtgY', lx - 0.5, lx + 0.5, 1.2, 16, z, z + 1, 'xXzZ', 0.5); box('tyre', lx - 0.7, lx + 0.7, 0, 1.2, z - 0.6, z + 1.6, 'xXzZY'); } box('rtgY', lx - 0.5, lx + 0.5, 16, 17.8, za, zb + 1, ALL, 0.5); }
      for (const z of [za, zb]) box('rtgY', cx - 5, cx + 5, 16, 17.8, z, z + 1, ALL, 0.5);
      box('cab', cx - 2, cx + 2, 17.8, 19.6, (za + zb) / 2 - 1.5, (za + zb) / 2 + 1.5, ALL, 0.5); box('dark', cx - 1, cx + 1, 15, 16, za + 2, za + 3.4, ALL);
    }
    // ---- trucks: tractor, chassis, trailer, often a box on it ----
    for (const t of TRUCKS) {
      const cabX0 = t.d > 0 ? t.x + 12.9 : t.x, cabX1 = cabX0 + 3.6, tx0 = t.d > 0 ? t.x : t.x + 3.6, tx1 = tx0 + 12.9, z0 = t.z, z1 = t.z + 2.5, cm = t.c % 2 ? 'cab' : 'cabB';
      box(cm, cabX0, cabX1, 0.6, 3.1, z0 + 0.05, z1 - 0.05, ALL, 0.5); const fx = t.d > 0 ? cabX1 : cabX0; box('dark', fx - 0.02, fx + 0.02, 1.9, 2.8, z0 + 0.25, z1 - 0.25, 'xX'); box('dark', cabX0 + 0.5, cabX1 - 0.5, 1.9, 2.7, z0 + 0.03, z1 - 0.03, 'zZ');
      box('glow', fx - 0.03, fx + 0.03, 0.9, 1.1, z0 + 0.2, z0 + 0.5, 'xX'); box('glow', fx - 0.03, fx + 0.03, 0.9, 1.1, z1 - 0.5, z1 - 0.2, 'xX');
      box('fascia', tx0, tx1, 1.0, 1.45, z0 + 0.1, z1 - 0.1, ALL); box('fascia', tx0 + 1, tx1 - 1, 0.55, 1.0, z0 + 0.8, z1 - 0.8, ALL);
      for (const wx of t.d > 0 ? [cabX0 + 0.6, cabX1 - 0.8, tx0 + 0.6, tx0 + 2] : [cabX1 - 0.6 - 0.9, cabX0 + 0.5, tx1 - 1.5, tx1 - 2.9]) for (const [za, zb] of [[z0, z0 + 0.5], [z1 - 0.5, z1]]) box('tyre', wx, wx + 0.95, 0, 0.95, za, zb, ALL);
      if (t.load) box('c' + (t.c * 3 % CONT.length), tx0 + 0.35, tx0 + 0.35 + CL, 1.45, 1.45 + CH - 0.05, z0 + (2.5 - CW) / 2, z1 - (2.5 - CW) / 2, 'xXzZY', S4);
    }
    // ---- floodlight masts: head of lamps, and a pool of light on the ground under each ----
    const UVQ = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (const [fx, fz] of FLOODS) {
      box('steel', fx - 0.35, fx + 0.35, 0, 24, fz - 0.35, fz + 0.35, 'xXzZ', 0.5); box('fascia', fx - 1.6, fx + 1.6, 24, 25.4, fz - 0.6, fz + 0.6, ALL);
      for (let i = 0; i < 4; i++) box('glow', fx - 1.4 + i * 0.75, fx - 0.85 + i * 0.75, 23.96, 24, fz - 0.45, fz + 0.45, 'y');
      b('lightpool').quad([fx - 15, 0.03, fz - 15], [fx + 15, 0.03, fz - 15], [fx + 15, 0.03, fz + 15], [fx - 15, 0.03, fz + 15], [0, 1, 0], 1, UVQ);
      box('red', fx - 0.12, fx + 0.12, 25.4, 25.7, fz - 0.12, fz + 0.12);
    }
    // ---- fence and gate ----
    const fence = (x0, z0, x1, z1) => { const n = [z1 - z0 ? 1 : 0, 0, z1 - z0 ? 0 : 1]; b('fence').quad([x0, 0, z0], [x1, 0, z1], [x1, 2.6, z1], [x0, 2.6, z0], n, 0.5); const L = Math.hypot(x1 - x0, z1 - z0); for (let d = 0; d <= L; d += 3) { const px = x0 + (x1 - x0) * d / L, pz = z0 + (z1 - z0) * d / L; box('steel', px - 0.04, px + 0.04, 0, 2.8, pz - 0.04, pz + 0.04, 'xXzZY'); } };
    fence(YARD.x0, 76.04, EXIT.x0, 76.04); fence(EXIT.x1, 76.04, YARD.x1, 76.04); fence(-5.56, 0.3, -5.56, 76); fence(115.56, 0.3, 115.56, 76);
    box('red', 48.1, 48.3, 1, 7.4, 76.2, 76.4); for (let y = 1.6; y < 7.4; y += 1.2) box('white', 48.08, 48.32, y, y + 0.6, 76.18, 76.42);
    // ---- operations building: roof, sign ----
    box('fascia', OPS.x0 - 0.4, OPS.x1 + 0.4, H, H + 0.35, OPS.z0 - 0.4, OPS.z1 + 0.4, ALL, 0.5); box('shipwhite', OPS.x0 - 0.4, OPS.x1 + 0.4, H + 0.35, H + 0.7, OPS.z0 - 0.4, OPS.z0 - 0.3);
    { const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#123a5e'; g.fillRect(0, 0, 512, 64); g.fillStyle = '#fff'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PORT OPERATIONS', 256, 34);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.75), new THREE.MeshBasicMaterial({ map: t })); m.position.set(13, H + 0.95, OPS.z1 + 0.45); root.add(m); }
    const cl = new THREE.BufferGeometry(); cl.setAttribute('position', new THREE.Float32BufferAttribute(cables.flat(), 3));
    root.add(new THREE.LineSegments(cl, new THREE.LineBasicMaterial({ color: 0x2a2a2c })));
    // ---- across the harbour: city skyline with lit windows, hills behind ----
    const wc = document.createElement('canvas'); wc.width = 128; wc.height = 256; const wg = wc.getContext('2d'); wg.fillStyle = '#15161c'; wg.fillRect(0, 0, 128, 256);
    for (let y = 8; y < 256; y += 16) { const lit = Math.random() < 0.5 ? 0.55 : 0.2; for (let xx = 6; xx < 128; xx += 12) { if (Math.random() < lit) { wg.fillStyle = Math.random() < 0.7 ? '#e9b56e' : '#c3d4f0'; wg.globalAlpha = 0.35 + Math.random() * 0.4; wg.fillRect(xx, y, 7, 8); } } } wg.globalAlpha = 1;
    const wt = new THREE.CanvasTexture(wc); wt.colorSpace = THREE.SRGBColorSpace; wt.wrapS = wt.wrapT = THREE.RepeatWrapping;
    skyline = new THREE.MeshBasicMaterial({ map: wt, fog: false });
    const pos = [], uv = [], idx = []; let n = 0;
    const tower = (x0, x1, z0, z1, h) => { for (const [a, c, nz] of [[[x0, z1], [x1, z1], 1], [[x1, z0], [x1, z1], 0], [[x0, z0], [x0, z1], 0]]) { const w = Math.hypot(c[0] - a[0], c[1] - a[1]); pos.push(a[0], -3, a[1], c[0], -3, c[1], c[0], h, c[1], a[0], h, a[1]); uv.push(0, 0, w / 30, 0, w / 30, h / 48, 0, h / 48); idx.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4; } };
    let r = 3; const rr = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    for (let xx = -260; xx < 380; xx += 9 + rr() * 14) { const d = 230 + rr() * 90, w = 8 + rr() * 16, h = (xx > -40 && xx < 160 ? 35 : 14) + rr() * (xx > 0 && xx < 120 ? 110 : 45); tower(xx, xx + w, -d - w, -d, h); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); sg.setIndex(idx); sg.computeVertexNormals();
    hills.add(new THREE.Mesh(sg, skyline));
    for (const [hx, hz, hr, hh] of [[-260, -380, 160, 70], [-60, -400, 190, 95], [160, -390, 170, 80], [330, -360, 150, 60], [-330, -120, 110, 40], [420, -150, 120, 45]]) { const m = new THREE.Mesh(new THREE.ConeGeometry(hr, hh, 8, 1), hillM); m.position.set(hx, hh / 2 - 4, hz); m.rotation.y = hx; hills.add(m); }
  },
};
