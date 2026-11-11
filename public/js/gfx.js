// World rendering: a modern glass-and-stone house at dusk. Merged static geometry (one draw call per material), doors, lights.
import * as THREE from '../vendor/three.module.min.js';
import { sheen, tex, grid, rnd } from './mats.js';
import { buildLevel, ROOMS, H, STAIR, FOOT, YARD, DOOR_H } from './core/level.js';

export const MATS = {};
function initMats() {
  if (MATS.plaster) return;
  const S = (t, gloss, extra) => sheen(Object.assign({ map: t }, extra), gloss);
  Object.assign(MATS, {
    plaster: S(tex('#e9e6e0', 500), 'satin'), ceiling: S(tex('#f1efea', 300), 'matte'), soffit: S(tex('#cdbfa8', 300, grid(1, 6, 'rgba(60,45,30,0.35)')), 'satin'),
    stone: S(tex('#8b8882', 2500, grid(2, 20, 'rgba(30,28,25,0.5)', true, 0.2)), 'stone'), fascia: S(tex('#1d1f22', 500), 'metal'),
    wood: S(tex('#b99b76', 1500, grid(2, 10, 'rgba(70,50,30,0.35)', true, 0.07)), 'polished'), tile: S(tex('#3b3e43', 500, grid(2, 2, 'rgba(10,10,10,0.6)')), 'polished'),
    carpet: S(tex('#70747d', 7000), 'cloth'), marble: S(tex('#e3e0da', 900, grid(1, 1, 'rgba(120,120,120,0.3)')), 'polished'),
    gravel: S(tex('#5c5448', 9000), 'matte'), paver: S(tex('#b9b3a7', 1500, grid(2, 2, 'rgba(70,65,55,0.5)')), 'satin'),
    fabric: S(tex('#3c3e44', 6000), 'cloth'), linen: S(tex('#d8d3c8', 5000), 'cloth'), walnut: S(tex('#4b3627', 1200, grid(1, 6, 'rgba(20,10,5,0.3)', false, 0.06)), 'polished'),
    lacquer: S(tex('#ecebe8', 200), 'paint'), top: S(tex('#2a2b2e', 900), 'polished'), car: S(tex('#262b33', 200), 'paint'), hedge: S(tex('#2d4b2b', 9000), 'matte'),
    pooltile: S(tex('#22262a', 400, grid(8, 8, 'rgba(0,0,0,0.5)')), 'polished'), book: S(tex('#7a4a3a', 300, grid(10, 1, 'rgba(0,0,0,0.5)', false, 0.5)), 'satin'),
    water: sheen({ color: 0x16303a, transparent: true, opacity: 0.86 }, 'water'), glass: sheen({ color: 0x1c2a33, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }, 'glass'),
    glow: new THREE.MeshBasicMaterial({ color: 0xffe6bd, fog: false }), dark: new THREE.MeshBasicMaterial({ color: 0x0b0c0e }),
  });
  MATS.door = sheen({ map: MATS.walnut.map }, 'polished'); MATS.steel = sheen({ color: 0xb8bcc2 }, 'metal');
}

// Accumulates quads with world-space UVs into one mesh per material.
class Builder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.idx = []; }
  quad(a, b, c, d, nrm, s = 0.5) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const flip = ((uy * vz - uz * vy) * nrm[0] + (uz * vx - ux * vz) * nrm[1] + (ux * vy - uy * vx) * nrm[2]) < 0;
    const vs = flip ? [a, d, c, b] : [a, b, c, d], base = this.p.length / 3, ax = Math.abs(nrm[0]), ay = Math.abs(nrm[1]);
    for (const v of vs) { this.p.push(v[0], v[1], v[2]); this.n.push(nrm[0], nrm[1], nrm[2]); if (ay > 0.5) this.uv.push(v[0] * s, v[2] * s); else if (ax > 0.5) this.uv.push(v[2] * s, v[1] * s); else this.uv.push(v[0] * s, v[1] * s); }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  box(x0, x1, y0, y1, z0, z1, faces = 'xXYzZ', s = 0.5) {   // faces: lowercase = negative side
    if (faces.includes('X')) this.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0], s);
    if (faces.includes('x')) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], s);
    if (faces.includes('Y')) this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], s);
    if (faces.includes('y')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], s);
    if (faces.includes('Z')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], s);
    if (faces.includes('z')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], s);
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setIndex(this.idx);
    const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; return m;
  }
}
const ALL = 'xXyYzZ';

// Furniture is built from parts that fit inside its collision box, so what you see matches what stops you.
function furnish(b, w) {
  const { x0, x1, z0, z1, y0, y1 } = w, lx = x1 - x0, lz = z1 - z0, long = lx >= lz, len = long ? lx : lz;
  // a(u0,u1,v0,v1): u runs along the long side (0..len), v across the short side (0..depth)
  const P = (m, u0, u1, v0, v1, a, c, faces = ALL, s = 1) => long ? b(m).box(x0 + u0, x0 + u1, y0 + a, y0 + c, z0 + v0, z0 + v1, faces, s) : b(m).box(x0 + v0, x0 + v1, y0 + a, y0 + c, z0 + u0, z0 + u1, faces, s);
  const dep = long ? lz : lx, h = y1 - y0;
  switch (w.sub) {
    case 'sofa': { const n = Math.max(1, Math.round((len - 0.4) / 0.8)), cw = (len - 0.4) / n;
      P('fabric', 0, len, 0, dep, 0.08, 0.4); P('fabric', 0, len, 0, 0.2, 0.4, h); P('fabric', 0, 0.2, 0.2, dep, 0.4, 0.62); P('fabric', len - 0.2, len, 0.2, dep, 0.4, 0.62);
      for (let i = 0; i < n; i++) { P('linen', 0.2 + i * cw + 0.015, 0.2 + (i + 1) * cw - 0.015, 0.22, dep - 0.02, 0.4, 0.52); P('linen', 0.2 + i * cw + 0.03, 0.2 + (i + 1) * cw - 0.03, 0.2, 0.34, 0.52, h - 0.04); }
      P('fascia', 0.05, 0.11, 0.05, 0.11, 0, 0.08); P('fascia', len - 0.11, len - 0.05, 0.05, 0.11, 0, 0.08); P('fascia', 0.05, 0.11, dep - 0.11, dep - 0.05, 0, 0.08); P('fascia', len - 0.11, len - 0.05, dep - 0.11, dep - 0.05, 0, 0.08); break; }
    case 'bed': P('walnut', 0, len, 0, dep, 0.06, 0.28); P('walnut', 0, 0.08, 0, dep, 0, h + 0.5); P('linen', 0.1, len - 0.03, 0.04, dep - 0.04, 0.28, h - 0.05);
      P('fabric', len * 0.42, len - 0.02, 0.02, dep - 0.02, 0.3, h); P('lacquer', 0.14, 0.5, 0.12, dep / 2 - 0.06, h - 0.05, h + 0.07); P('lacquer', 0.14, 0.5, dep / 2 + 0.06, dep - 0.12, h - 0.05, h + 0.07); break;
    case 'table': if (h < 0.55) { P('walnut', 0, len, 0, dep, h - 0.05, h); P('top', 0.12, len - 0.12, 0.12, dep - 0.12, 0, h - 0.05); }
      else { P('walnut', 0, len, 0, dep, h - 0.05, h); for (const [u, v] of [[0.06, 0.06], [len - 0.12, 0.06], [0.06, dep - 0.12], [len - 0.12, dep - 0.12]]) P('fascia', u, u + 0.06, v, v + 0.06, 0, h - 0.05); } break;
    case 'shelf': { P('walnut', 0, len, 0, 0.03, 0, h); P('walnut', 0, 0.03, 0, dep, 0, h); P('walnut', len - 0.03, len, 0, dep, 0, h);
      for (let y = 0.02; y < h; y += 0.38) { P('walnut', 0.03, len - 0.03, 0.03, dep, y, y + 0.03); if (y + 0.38 > h) break; let u = 0.06; while (u < len - 0.4) { const bw = 0.25 + rnd() * 0.5, bh = 0.2 + rnd() * 0.1; if (rnd() < 0.75) P(rnd() < 0.6 ? 'book' : rnd() < 0.5 ? 'lacquer' : 'top', u, Math.min(len - 0.06, u + bw), 0.08, dep - 0.06, y + 0.03, y + 0.03 + bh, ALL, 3); u += bw + 0.05 + rnd() * 0.3; } }
      P('walnut', 0, len, 0, dep, h - 0.03, h); break; }
    case 'cabinet': P('lacquer', 0, len, 0, dep, 0.1, h - 0.03); P('walnut', -0.0, len, 0, dep, h - 0.03, h); for (const u of [0.05, len - 0.11]) { P('fascia', u, u + 0.06, 0.05, 0.11, 0, 0.1); P('fascia', u, u + 0.06, dep - 0.11, dep - 0.05, 0, 0.1); } break;
    case 'counter': P('fascia', 0.03, len - 0.03, 0.03, dep - 0.03, 0, 0.1); P('lacquer', 0, len, 0, dep, 0.1, h - 0.04); P('top', 0, len, 0, dep, h - 0.04, h); break;
    case 'car': P('car', 0, len, 0, dep, 0.28, 0.9); P('dark', len * 0.2, len * 0.82, 0.12, dep - 0.12, 0.9, h - 0.04); P('car', len * 0.2, len * 0.82, 0.1, dep - 0.1, h - 0.04, h);
      for (const u of [len * 0.12, len * 0.74]) { P('dark', u, u + 0.68, 0, 0.24, 0, 0.66); P('dark', u, u + 0.68, dep - 0.24, dep, 0, 0.66); } P('glow', len - 0.02, len, 0.2, 0.5, 0.6, 0.72); P('glow', len - 0.02, len, dep - 0.5, dep - 0.2, 0.6, 0.72); break;
    case 'pool': P('pooltile', 0, len, 0, dep, 0, h, 'xXzZ'); P('pooltile', 0, len, 0, 0.18, h - 0.001, h, 'Y'); P('pooltile', 0, len, dep - 0.18, dep, h - 0.001, h, 'Y'); P('pooltile', 0, 0.18, 0.18, dep - 0.18, h - 0.001, h, 'Y'); P('pooltile', len - 0.18, len, 0.18, dep - 0.18, h - 0.001, h, 'Y');
      P('water', 0.18, len - 0.18, 0.18, dep - 0.18, h - 0.05, h - 0.03, 'Y', 0.2); break;
    case 'hedge': P('hedge', 0, len, 0, dep, 0, h); break;
    default: P('stone', 0, len, 0, dep, 0, h);
  }
}

export function buildWorld(scene) {
  initMats();
  const level = buildLevel(), B = {}; const b = k => B[k] || (B[k] = new Builder());
  // sky, far hills, ground
  const sc = document.createElement('canvas'); sc.width = 4; sc.height = 256; const sg = sc.getContext('2d'), gr = sg.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#1c2638'); gr.addColorStop(0.3, '#3b4a63'); gr.addColorStop(0.47, '#8b8d9c'); gr.addColorStop(0.52, '#d6b08e'); gr.addColorStop(0.56, '#4a4038'); gr.addColorStop(1, '#2a2622'); sg.fillStyle = gr; sg.fillRect(0, 0, 4, 256);
  const skyT = new THREE.CanvasTexture(sc); skyT.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(190, 20, 12), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false })); sky.position.set(12, 0, 8); sky.renderOrder = -1; scene.add(sky);
  const hillM = new THREE.MeshBasicMaterial({ color: 0x1b1d22, fog: false });
  for (const [x, z, r, h] of [[-90, -60, 80, 46], [20, -130, 110, 38], [130, -70, 90, 52], [-150, 40, 90, 30], [160, 60, 80, 26]]) { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7, 1), hillM); m.position.set(x, h / 2 - 2, z); m.rotation.y = x; scene.add(m); }
  b('gravel').quad([YARD.x0 - 60, 0, YARD.z0 - 60], [YARD.x1 + 60, 0, YARD.z0 - 60], [YARD.x1 + 60, 0, YARD.z1 + 60], [YARD.x0 - 60, 0, YARD.z1 + 60], [0, 1, 0], 0.3);
  b('paver').quad([-3, 0.008, 16], [27, 0.008, 16], [27, 0.008, 25], [-3, 0.008, 25], [0, 1, 0], 0.5);
  b('paver').quad([-1.4, 0.006, -1.4], [25.4, 0.006, -1.4], [25.4, 0.006, 16], [-1.4, 0.006, 16], [0, 1, 0], 0.5);
  b('paver').quad([9, 0.007, 25], [15, 0.007, 25], [15, 0.007, YARD.z1], [9, 0.007, YARD.z1], [0, 1, 0], 0.5);
  for (const [x0, x1, z0, z1] of [[YARD.x0 - 0.3, YARD.x0, YARD.z0, YARD.z1], [YARD.x1, YARD.x1 + 0.3, YARD.z0, YARD.z1], [YARD.x0, YARD.x1, YARD.z0 - 0.3, YARD.z0], [YARD.x0, 9, YARD.z1, YARD.z1 + 0.3], [15, YARD.x1, YARD.z1, YARD.z1 + 0.3]]) b('stone').box(x0, x1, 0, 1.6, z0, z1, 'xXYzZ', 1);
  // floors, ceilings with recessed downlights
  for (const [f, , x0, z0, x1, z1, mat] of ROOMS) {
    const y = f * H + 0.004; b(mat).quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], 0.5);
    const cy = f * H + H - 0.012; b('ceiling').quad([x0, cy, z0], [x1, cy, z0], [x1, cy, z1], [x0, cy, z1], [0, -1, 0], 0.5);
    for (let x = x0 + 1.5; x < x1 - 0.7; x += 3) for (let z = z0 + 1.5; z < z1 - 0.7; z += 3) b('glow').quad([x - 0.08, cy - 0.004, z - 0.08], [x + 0.08, cy - 0.004, z - 0.08], [x + 0.08, cy - 0.004, z + 0.08], [x - 0.08, cy - 0.004, z + 0.08], [0, -1, 0]);
  }
  b('ceiling').quad([STAIR.x0, 2 * H - 0.012, STAIR.z0], [STAIR.x1, 2 * H - 0.012, STAIR.z0], [STAIR.x1, 2 * H - 0.012, STAIR.z1], [STAIR.x0, 2 * H - 0.012, STAIR.z1], [0, -1, 0]);
  // walls: plaster inside, stacked stone outside, glass with dark mullions
  for (const w of level.boxes) {
    if (w.kind === 'wall' || w.kind === 'lintel') {
      let out = '';
      if (w.ext) out = w.horiz ? (w.z0 < 1 ? 'z' : 'Z') : (w.x0 < 1 ? 'x' : 'X');
      else if (w.kind === 'lintel') { if (Math.abs(w.z0 + 0.1) < 0.01) out = 'z'; if (Math.abs(w.z1 - 16.1) < 0.01) out = 'Z'; }
      b('plaster').box(w.x0, w.x1, w.y0, w.y1, w.z0, w.z1, 'xXzZ'.replace(out, '') + (w.kind === 'lintel' ? 'y' : ''));
      if (out) b('stone').box(w.x0, w.x1, w.y0, w.y1, w.z0, w.z1, out, 1);
    } else if (w.kind === 'glass') {
      const hz = w.horiz, a = hz ? w.x0 : w.z0, e = hz ? w.x1 : w.z1, c = hz ? (w.z0 + w.z1) / 2 : (w.x0 + w.x1) / 2, n = Math.max(1, Math.round((e - a) / 1.5));
      const bx = (m, u0, u1, y0, y1, t) => hz ? b(m).box(u0, u1, y0, y1, c - t, c + t, ALL, 1) : b(m).box(c - t, c + t, y0, y1, u0, u1, ALL, 1);
      if (hz) b('glass').quad([a, w.y0 + 0.1, c], [e, w.y0 + 0.1, c], [e, w.y1 - 0.12, c], [a, w.y1 - 0.12, c], [0, 0, 1]); else b('glass').quad([c, w.y0 + 0.1, a], [c, w.y0 + 0.1, e], [c, w.y1 - 0.12, e], [c, w.y1 - 0.12, a], [1, 0, 0]);
      bx('fascia', a, e, w.y0, w.y0 + 0.1, 0.05); bx('fascia', a, e, w.y1 - 0.12, w.y1, 0.05);
      for (let i = 0; i <= n; i++) { const u = a + (e - a) * i / n; bx('fascia', u - 0.035, u + 0.035, w.y0 + 0.1, w.y1 - 0.12, 0.05); }
    } else if (w.kind === 'furn') furnish(b, w);
  }
  // stairs: floating treads
  const run = (STAIR.z1 - STAIR.z0) * 0.85, N = 16;
  for (let i = 0; i < N; i++) { const top = (i + 0.6) * H / N; b('walnut').box(STAIR.x0 + 0.1, STAIR.x1 - 0.1, top - 0.06, top, STAIR.z1 - (i + 1) * run / N, STAIR.z1 - i * run / N, ALL, 1); b('fascia').box(STAIR.x0 + 0.7, STAIR.x0 + 0.8, 0, top - 0.06, STAIR.z1 - (i + 0.9) * run / N, STAIR.z1 - (i + 0.1) * run / N, 'xXzZ', 1); }
  b('walnut').box(STAIR.x0 + 0.1, STAIR.x1 - 0.1, H - 0.2, H, STAIR.z0, STAIR.z1 - run, 'YZy', 1);
  // roofs: deep flat overhangs, mid-level canopy, raised roof with a dark clerestory band, chimney
  const slab = (x0, x1, y0, y1, z0, z1) => { b('fascia').box(x0, x1, y0, y1, z0, z1, 'xXYzZ', 1); b('soffit').quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], 0.5); };
  slab(-1.6, 25.6, H - 0.05, H + 0.2, 16.1, 18.7); slab(-1.4, -0.1, H - 0.05, H + 0.2, 6, 16.1);
  slab(-1.8, 25.8, 2 * H, 2 * H + 0.28, -0.9, 19); b('dark').box(11, 24.2, 2 * H + 0.28, 2 * H + 0.8, 0.2, 15.8, 'xXzZ'); slab(9.5, 26.6, 2 * H + 0.8, 2 * H + 1.05, -1.4, 19.6);
  b('stone').box(4.8, 6.2, 2 * H + 0.28, 2 * H + 2.1, 5.8, 7.2, 'xXYzZ', 1);
  for (const [x0, x1, y0, y1, z0, z1] of [[-0.14, 24.14, H - 0.14, H + 0.2, -0.16, -0.1], [24.1, 24.16, H - 0.14, H + 0.2, -0.1, 16.1], [-0.16, -0.1, H - 0.14, H + 0.2, -0.1, 6]]) b('fascia').box(x0, x1, y0, y1, z0, z1, ALL, 1);
  const spot = (x, y, z) => b('glow').quad([x - 0.07, y, z - 0.07], [x + 0.07, y, z - 0.07], [x + 0.07, y, z + 0.07], [x - 0.07, y, z + 0.07], [0, -1, 0]);
  for (let x = -0.5; x <= 25; x += 1.7) { spot(x, H - 0.056, 17.4); spot(x, 2 * H - 0.006, 17.6); }
  for (let z = 1; z < 16; z += 2.5) { spot(-1, 2 * H - 0.006, z); spot(25, 2 * H - 0.006, z); }
  // interior dressing (no collision): rugs, pendants, chandelier, screen, art
  const rug = (m, x0, x1, z0, z1, y) => b(m).quad([x0, y + 0.008, z0], [x1, y + 0.008, z0], [x1, y + 0.008, z1], [x0, y + 0.008, z1], [0, 1, 0], 1);
  rug('linen', 1.4, 6.2, 10.6, 15.8, 0); rug('carpet', 17, 22.5, 10.2, 13.3, 0); rug('linen', 2, 6.4, 10.4, 14, H); rug('fabric', 9.8, 14.2, 10.4, 14.6, H);
  for (const [x, z, y0] of [[18.8, 11.75, 0], [19.75, 11.75, 0], [20.7, 11.75, 0], [18.8, 3.6, 0], [20.2, 3.6, 0]]) { b('fascia').box(x - 0.006, x + 0.006, y0 + 2.0, y0 + H, z - 0.006, z + 0.006, 'xXzZ'); b('glow').box(x - 0.09, x + 0.09, y0 + 1.82, y0 + 2.0, z - 0.09, z + 0.09, ALL); }
  for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.25 + (i % 3) * 0.22, x = 12 + Math.cos(a) * r, z = 12.4 + Math.sin(a) * r, y = 2.0 + (i % 4) * 0.2; b('fascia').box(x - 0.005, x + 0.005, y + 0.1, H, z - 0.005, z + 0.005, 'xXzZ'); b('glow').box(x - 0.05, x + 0.05, y, y + 0.1, z - 0.05, z + 0.05, ALL); }
  b('dark').box(2, 4.2, 1.0, 2.1, 8.1, 8.14, 'Z'); b('fascia').box(1.96, 4.24, 0.96, 2.14, 8.1, 8.13, 'xXYyZ', 1);
  b('walnut').box(9.11, 9.14, 1.1, 2.3, 14, 15.4, 'X', 1); b('top').box(14.86, 14.89, 1.2, 2.2, 14.2, 15.2, 'x', 1);
  for (const k in B) { const m = B[k].mesh(MATS[k]); if (k === 'glass' || k === 'water') m.renderOrder = 5; scene.add(m); }

  // doors: flush walnut slabs with steel levers; the concealed service door is clad like the wall around it
  const doors = level.doors.map(d => {
    const len = d.horiz ? d.x1 - d.x0 : d.z1 - d.z0, g = new THREE.Group(); g.position.set(d.x0, d.y, d.z0);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(len - 0.03, DOOR_H - 0.02, d.hidden ? 0.2 : 0.05), d.hidden ? MATS.stone : MATS.door); leaf.position.set(len / 2, DOOR_H / 2, 0); g.add(leaf);
    const hm = MATS.steel.clone(), handle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.17), hm); handle.position.set(len - 0.12, 1.0, 0); handle.visible = !d.hidden; g.add(handle);
    const base = d.horiz ? 0 : -Math.PI / 2; g.rotation.y = base; scene.add(g);
    return { g, base, handle, hm, cur: 0, hot: false };
  });
  // light: dusk sky, low warm sun for highlights, two warm interior lamps
  scene.background = new THREE.Color(0x2a3040); scene.fog = new THREE.FogExp2(0x3a4152, 0.006);
  scene.add(new THREE.HemisphereLight(0xb9c4dc, 0x7a6a58, 1.25));
  const sun = new THREE.DirectionalLight(0xffc9a0, 0.75); sun.position.set(-30, 14, 34); scene.add(sun);
  for (const [x, y, z] of [[12, 2.5, 12.4], [4.5, 2.7, 12]]) { const l = new THREE.PointLight(0xffd9a8, 10, 11, 1.8); l.position.set(x, y, z); scene.add(l); }
  return { level, doors };
}

export function label(text, color = '#fff', w = 256, h = 64) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, w, h); g.fillStyle = color; g.fillText(text, w / 2, h / 2);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); s.scale.set(0.9, 0.9 * h / w, 1); s.renderOrder = 10; return s;
}
