// World rendering shared by every map: merged static geometry (one draw call per material), rooms, walls, glass, furniture, stairs, doors, lights.
// Each map adds its own scenery and sky from js/maps/<id>-gfx.js.
import * as THREE from '../vendor/three.module.min.js';
import { sheen, tex, grid, rnd, setGlossLevel } from './mats.js';
import { buildLevel } from './core/level.js';
import mansionGfx from './maps/mansion-gfx.js';
import terminalGfx from './maps/terminal-gfx.js';
const MAPGFX = { mansion: mansionGfx, terminal: terminalGfx };

export const MATS = {}, SOFT = {};   // SOFT.blob: the round shadow drawn under people
export function initMats() {
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
    water: sheen({ color: 0x16303a, transparent: true, opacity: 0.86 }, 'water'), ocean: sheen({ color: 0x0e2230 }, 'water'), glass: sheen({ color: 0x0b1216, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }, 'glass'),
    glow: new THREE.MeshBasicMaterial({ color: 0xffe6bd, fog: false }), dark: new THREE.MeshBasicMaterial({ color: 0x0b0c0e }),
  });
  // Painted-on shading. Real-time ambient occlusion is a full-screen effect a headset browser cannot afford, so the darkening where surfaces meet
  // (wall to floor, wall to ceiling, under furniture and people) is drawn once as soft gradients instead. Same look, almost no cost.
  const cv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); return t; };
  const grad = cv(4, 64, g => { const gr = g.createLinearGradient(0, 64, 0, 0); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(0,0,0,0.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 64); });
  const softRect = cv(64, 64, g => { for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(0,0,0,0.085)'; const m = i * 1.5; g.fillRect(m, m, 64 - 2 * m, 64 - 2 * m); } });
  SOFT.spot = cv(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const decal = (map, color, opacity, extra) => new THREE.MeshBasicMaterial(Object.assign({ map, color, opacity, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, extra));
  MATS.ao = decal(grad, 0x000000, 0.55); MATS.aoBlob = decal(softRect, 0x000000, 0.75); MATS.lightpool = decal(SOFT.spot, 0xffd9a0, 0.2, { blending: THREE.AdditiveBlending });
  SOFT.blob = decal(SOFT.spot, 0x000000, 0.5);
  MATS.door = sheen({ map: MATS.walnut.map }, 'polished'); MATS.steel = sheen({ color: 0xb8bcc2 }, 'metal');
}

// Accumulates quads with world-space UVs into one mesh per material.
export class Builder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.idx = []; }
  quad(a, b, c, d, nrm, s = 0.5, uv4 = null) {   // uv4: explicit corner UVs for a, b, c, d (used by the shading decals)
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const flip = ((uy * vz - uz * vy) * nrm[0] + (uz * vx - ux * vz) * nrm[1] + (ux * vy - uy * vx) * nrm[2]) < 0;
    const vs = flip ? [a, d, c, b] : [a, b, c, d], uo = flip ? [0, 3, 2, 1] : [0, 1, 2, 3], base = this.p.length / 3, ax = Math.abs(nrm[0]), ay = Math.abs(nrm[1]); let vi = 0;
    for (const v of vs) { this.p.push(v[0], v[1], v[2]); this.n.push(nrm[0], nrm[1], nrm[2]); if (uv4) { const u = uv4[uo[vi++]]; this.uv.push(u[0], u[1]); } else if (ay > 0.5) this.uv.push(v[0] * s, v[2] * s); else if (ax > 0.5) this.uv.push(v[2] * s, v[1] * s); else this.uv.push(v[0] * s, v[1] * s); }
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
export const ALL = 'xXyYzZ';

// Furniture is built from parts that fit inside its collision box, so what you see matches what stops you.
function furnish(b, w) {
  const { x0, x1, z0, z1, y0, y1 } = w, lx = x1 - x0, lz = z1 - z0;
  // Every piece has a front: w.face is the way it faces ('+x', '-x', '+z', '-z'). Without one it faces across its short side, toward +.
  const face = w.face || (lx >= lz ? '+z' : '+x'), acrossX = face[1] === 'z', neg = face[0] === '-', len = acrossX ? lx : lz, dep = acrossX ? lz : lx, h = y1 - y0;
  // P(u0, u1, v0, v1): u runs side to side across the front (0..len), v from the back (0) to the front (dep)
  const P = (m, u0, u1, v0, v1, a, c, faces = ALL, s = 1) => acrossX
    ? b(m).box(x0 + u0, x0 + u1, y0 + a, y0 + c, neg ? z1 - v1 : z0 + v0, neg ? z1 - v0 : z0 + v1, faces, s)
    : b(m).box(neg ? x1 - v1 : x0 + v0, neg ? x1 - v0 : x0 + v1, y0 + a, y0 + c, z0 + u0, z0 + u1, faces, s);
  switch (w.sub) {
    case 'sofa': { const n = Math.max(1, Math.round((len - 0.4) / 0.8)), cw = (len - 0.4) / n;
      P('fabric', 0, len, 0, dep, 0.08, 0.4); P('fabric', 0, len, 0, 0.2, 0.4, h); P('fabric', 0, 0.2, 0.2, dep, 0.4, 0.62); P('fabric', len - 0.2, len, 0.2, dep, 0.4, 0.62);
      for (let i = 0; i < n; i++) { P('linen', 0.2 + i * cw + 0.015, 0.2 + (i + 1) * cw - 0.015, 0.22, dep - 0.02, 0.4, 0.52); P('linen', 0.2 + i * cw + 0.03, 0.2 + (i + 1) * cw - 0.03, 0.2, 0.34, 0.52, h - 0.04); }
      P('fascia', 0.05, 0.11, 0.05, 0.11, 0, 0.08); P('fascia', len - 0.11, len - 0.05, 0.05, 0.11, 0, 0.08); P('fascia', 0.05, 0.11, dep - 0.11, dep - 0.05, 0, 0.08); P('fascia', len - 0.11, len - 0.05, dep - 0.11, dep - 0.05, 0, 0.08); break; }
    case 'bed':   // headboard against the back, foot toward the front
      P('walnut', 0, len, 0, dep, 0.06, 0.28); P('walnut', 0, len, 0, 0.08, 0, h + 0.5); P('linen', 0.04, len - 0.04, 0.1, dep - 0.03, 0.28, h - 0.05);
      P('fabric', 0.02, len - 0.02, dep * 0.42, dep - 0.02, 0.3, h); P('lacquer', 0.12, len / 2 - 0.06, 0.14, 0.5, h - 0.05, h + 0.07); P('lacquer', len / 2 + 0.06, len - 0.12, 0.14, 0.5, h - 0.05, h + 0.07); break;
    case 'table': if (h < 0.55) { P('walnut', 0, len, 0, dep, h - 0.05, h); P('top', 0.12, len - 0.12, 0.12, dep - 0.12, 0, h - 0.05); }
      else { P('walnut', 0, len, 0, dep, h - 0.05, h); for (const [u, v] of [[0.06, 0.06], [len - 0.12, 0.06], [0.06, dep - 0.12], [len - 0.12, dep - 0.12]]) P('fascia', u, u + 0.06, v, v + 0.06, 0, h - 0.05); } break;
    case 'shelf': { P('walnut', 0, len, 0, 0.03, 0, h); P('walnut', 0, 0.03, 0, dep, 0, h); P('walnut', len - 0.03, len, 0, dep, 0, h);
      for (let y = 0.02; y < h; y += 0.38) { P('walnut', 0.03, len - 0.03, 0.03, dep, y, y + 0.03); if (y + 0.38 > h) break; let u = 0.06; while (u < len - 0.4) { const bw = 0.25 + rnd() * 0.5, bh = 0.2 + rnd() * 0.1; if (rnd() < 0.75) P(rnd() < 0.6 ? 'book' : rnd() < 0.5 ? 'lacquer' : 'top', u, Math.min(len - 0.06, u + bw), 0.08, dep - 0.06, y + 0.03, y + 0.03 + bh, ALL, 3); u += bw + 0.05 + rnd() * 0.3; } }
      P('walnut', 0, len, 0, dep, h - 0.03, h); break; }
    case 'cabinet': P('lacquer', 0, len, 0, dep, 0.1, h - 0.03); P('walnut', -0.0, len, 0, dep, h - 0.03, h); for (const u of [0.05, len - 0.11]) { P('fascia', u, u + 0.06, 0.05, 0.11, 0, 0.1); P('fascia', u, u + 0.06, dep - 0.11, dep - 0.05, 0, 0.1); } break;
    case 'counter': P('fascia', 0.03, len - 0.03, 0.03, dep - 0.03, 0, 0.1); P('lacquer', 0, len, 0, dep, 0.1, h - 0.04); P('top', 0, len, 0, dep, h - 0.04, h); break;
    case 'car': break;   // drawn by the loaded car model (car.js)
    case 'car-box': P('car', 0, len, 0, dep, 0.28, 0.9); P('dark', len * 0.2, len * 0.82, 0.12, dep - 0.12, 0.9, h - 0.04); P('car', len * 0.2, len * 0.82, 0.1, dep - 0.1, h - 0.04, h);
      for (const u of [len * 0.12, len * 0.74]) { P('dark', u, u + 0.68, 0, 0.24, 0, 0.66); P('dark', u, u + 0.68, dep - 0.24, dep, 0, 0.66); } P('glow', len - 0.02, len, 0.2, 0.5, 0.6, 0.72); P('glow', len - 0.02, len, dep - 0.5, dep - 0.2, 0.6, 0.72); break;
    case 'pool': P('pooltile', 0, len, 0, dep, 0, h, 'xXzZ'); P('pooltile', 0, len, 0, 0.18, h - 0.001, h, 'Y'); P('pooltile', 0, len, dep - 0.18, dep, h - 0.001, h, 'Y'); P('pooltile', 0, 0.18, 0.18, dep - 0.18, h - 0.001, h, 'Y'); P('pooltile', len - 0.18, len, 0.18, dep - 0.18, h - 0.001, h, 'Y');
      P('water', 0.18, len - 0.18, 0.18, dep - 0.18, h - 0.05, h - 0.03, 'Y', 0.2); break;
    case 'hedge': P('hedge', 0, len, 0, dep, 0, h); break;
    case 'crate': P('wood', 0, len, 0, dep, 0, h, ALL, 1); P('fascia', -0.01, len + 0.01, dep * 0.3, dep * 0.34, 0, h + 0.005, 'xXYzZ'); P('fascia', -0.01, len + 0.01, dep * 0.66, dep * 0.7, 0, h + 0.005, 'xXYzZ'); break;
    case 'console': P('fascia', 0, len, 0, dep, 0, h - 0.25); P('top', 0, len, 0.05, dep, h - 0.25, h, ALL, 1); P('glow', len * 0.08, len * 0.92, dep - 0.02, dep, h - 0.6, h - 0.32, 'xXzZ'); break;
    case 'binnacle': P('fascia', len * 0.3, len * 0.7, dep * 0.3, dep * 0.7, 0, h - 0.2); P('steel', 0, len, 0, dep, h - 0.2, h); break;
    case 'booth': P('lacquer', 0, len, 0, dep, 0, h); break;
    case 'guard': P('lacquer', 0, len, 0, dep, 0, h - 0.1); P('fascia', -0.1, len + 0.1, -0.1, dep + 0.1, h - 0.1, h); P('glass', 0.05, len - 0.05, -0.002, dep + 0.002, 1.0, 2.1, 'xXzZ'); break;
    case 'pot': P('top', 0.02, len - 0.02, 0.02, dep - 0.02, 0, h - 0.04, 'xXzZ'); P('top', 0, len, 0, dep, h - 0.08, h, 'xXzZyY'); P('walnut', 0.03, len - 0.03, 0.03, dep - 0.03, h - 0.03, h - 0.02, 'Y'); break;
    default: P('stone', 0, len, 0, dep, 0, h);
  }
}

export function buildWorld(scene, id = 'mansion') {
  initMats();
  const level = buildLevel(id), map = level.map, H = map.H, YARD = map.YARD, G = MAPGFX[level.id], env = G.env, root = new THREE.Group(), B = {}; root.name = 'world'; scene.add(root);
  if (G.mats) G.mats(MATS);
  const b = k => B[k] || (B[k] = new Builder()), cx = (YARD.x0 + YARD.x1) / 2, cz = (YARD.z0 + YARD.z1) / 2;
  // sky dome (gradient), stars, moon, far silhouettes
  const sc = document.createElement('canvas'); sc.width = 4; sc.height = 256; const sg = sc.getContext('2d'), gr = sg.createLinearGradient(0, 0, 0, 256);
  for (const [t, c] of env.sky) gr.addColorStop(t, c); sg.fillStyle = gr; sg.fillRect(0, 0, 4, 256);
  const skyT = new THREE.CanvasTexture(sc); skyT.colorSpace = THREE.SRGBColorSpace; const R = env.skyR || 190;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(R, 20, 12), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false })); sky.position.set(cx, 0, cz); sky.renderOrder = -1; root.add(sky);
  const sp = []; for (let i = 0; i < 900; i++) { const u = rnd() * 6.283, v = 0.04 + rnd() * 0.96, r = Math.sqrt(1 - v * v) * (R - 8); sp.push(cx + Math.cos(u) * r, v * (R - 8), cz + Math.sin(u) * r); }
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(sgeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.7, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.45, depthWrite: false })); stars.frustumCulled = false; root.add(stars);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(6 * R / 190, 24), new THREE.MeshBasicMaterial({ color: 0xe9edff, fog: false, transparent: true, depthWrite: false })); moon.position.set(cx + env.moon[0] * R / 190, env.moon[1] * R / 190, cz + env.moon[2] * R / 190); moon.lookAt(cx, 0, cz); root.add(moon);
  const hillM = new THREE.MeshBasicMaterial({ color: env.hillColor || 0x1b1d22, fog: false }), hills = new THREE.Group(); root.add(hills);
  const UVQ = [[0, 0], [1, 0], [1, 1], [0, 1]], ao = (k, a, c, d, e, n) => b(k).quad(a, c, d, e, n, 1, UVQ);
  const ctx = { b, ao, root, hills, hillM, level, map, H, YARD, MATS, THREE, ALL, cx, cz, rnd, sky };
  G.scenery(ctx);
  // floors, ceilings with recessed downlights
  for (const [f, , x0, z0, x1, z1, mat] of map.rooms) {
    const y = f * H + 0.004; b(MATS[mat] ? mat : 'tile').quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], 0.5);
    const cy = f * H + H - 0.012; b('ceiling').quad([x0, cy, z0], [x1, cy, z0], [x1, cy, z1], [x0, cy, z1], [0, -1, 0], 0.5);
    for (let x = x0 + 1.5; x < x1 - 0.7; x += 3) for (let z = z0 + 1.5; z < z1 - 0.7; z += 3) { b('glow').quad([x - 0.08, cy - 0.004, z - 0.08], [x + 0.08, cy - 0.004, z - 0.08], [x + 0.08, cy - 0.004, z + 0.08], [x - 0.08, cy - 0.004, z + 0.08], [0, -1, 0]);
      ao('lightpool', [x - 1.5, y + 0.03, z - 1.5], [x + 1.5, y + 0.03, z - 1.5], [x + 1.5, y + 0.03, z + 1.5], [x - 1.5, y + 0.03, z + 1.5], [0, 1, 0]); }   // pool of light on the floor under each fitting
  }
  // walls: plaster inside, the map's cladding outside, glass with dark mullions
  for (const w of level.boxes) {
    if (w.kind === 'wall' || w.kind === 'lintel') {
      const wall = w.kind === 'wall', hz = wall ? w.horiz : (w.z1 - w.z0 < 0.3 && w.x1 - w.x0 > 0.3), out = w.out || '';
      // Only faces that can be seen are drawn: an end buried in a crossing wall has no end face, so no two surfaces share a plane (that was the flicker).
      const faces = hz ? 'zZ' + (wall && w.capA ? 'x' : '') + (wall && w.capB ? 'X' : '') : 'xX' + (wall && w.capA ? 'z' : '') + (wall && w.capB ? 'Z' : '');
      b(G.inner ? G.inner(w) : 'plaster').box(w.x0, w.x1, w.y0, w.y1, w.z0, w.z1, faces.replace(out, '') + (wall ? '' : 'y'));
      if (out) b(G.outer(w)).box(w.x0, w.x1, w.y0, w.y1, w.z0, w.z1, out, 1);
      if (wall) for (const f of (hz ? 'zZ' : 'xX')) {   // contact shading along the foot and head of every inside wall face, and on the floor beside it
        if (f === out) continue; const s = f === 'z' || f === 'x' ? -1 : 1, e = 0.006, y0 = w.y0, y1 = w.y1;
        if (hz) { const zf = (s < 0 ? w.z0 : w.z1) + s * e; ao('ao', [w.x0, y0, zf], [w.x1, y0, zf], [w.x1, y0 + 0.55, zf], [w.x0, y0 + 0.55, zf], [0, 0, s]); ao('ao', [w.x0, y1, zf], [w.x1, y1, zf], [w.x1, y1 - 0.4, zf], [w.x0, y1 - 0.4, zf], [0, 0, s]); ao('ao', [w.x0, y0 + 0.012, zf], [w.x1, y0 + 0.012, zf], [w.x1, y0 + 0.012, zf + s * 0.5], [w.x0, y0 + 0.012, zf + s * 0.5], [0, 1, 0]); }
        else { const xf = (s < 0 ? w.x0 : w.x1) + s * e; ao('ao', [xf, y0, w.z0], [xf, y0, w.z1], [xf, y0 + 0.55, w.z1], [xf, y0 + 0.55, w.z0], [s, 0, 0]); ao('ao', [xf, y1, w.z0], [xf, y1, w.z1], [xf, y1 - 0.4, w.z1], [xf, y1 - 0.4, w.z0], [s, 0, 0]); ao('ao', [xf, y0 + 0.012, w.z0], [xf, y0 + 0.012, w.z1], [xf + s * 0.5, y0 + 0.012, w.z1], [xf + s * 0.5, y0 + 0.012, w.z0], [0, 1, 0]); }
      }
    } else if (w.kind === 'glass') {
      const hz = w.horiz, a = hz ? w.x0 : w.z0, e = hz ? w.x1 : w.z1, c = hz ? (w.z0 + w.z1) / 2 : (w.x0 + w.x1) / 2, n = Math.max(1, Math.round((e - a) / 1.5));
      const bx = (m, u0, u1, y0, y1, t) => hz ? b(m).box(u0, u1, y0, y1, c - t, c + t, ALL, 1) : b(m).box(c - t, c + t, y0, y1, u0, u1, ALL, 1);
      if (hz) b('glass').quad([a, w.y0 + 0.1, c], [e, w.y0 + 0.1, c], [e, w.y1 - 0.12, c], [a, w.y1 - 0.12, c], [0, 0, 1]); else b('glass').quad([c, w.y0 + 0.1, a], [c, w.y0 + 0.1, e], [c, w.y1 - 0.12, e], [c, w.y1 - 0.12, a], [1, 0, 0]);
      bx('fascia', a, e, w.y0, w.y0 + 0.1, 0.05); bx('fascia', a, e, w.y1 - 0.12, w.y1, 0.05);
      for (let i = 0; i <= n; i++) { const u = a + (e - a) * i / n; bx('fascia', u - 0.035, u + 0.035, w.y0 + 0.1, w.y1 - 0.12, 0.05); }
    } else if (w.kind === 'furn') { furnish(b, w); if (!['pool', 'hedge', 'wall'].includes(w.sub)) { const e = 0.28, y = w.y0 + 0.016; ao('aoBlob', [w.x0 - e, y, w.z0 - e], [w.x1 + e, y, w.z0 - e], [w.x1 + e, y, w.z1 + e], [w.x0 - e, y, w.z1 + e], [0, 1, 0]); } }
  }
  // stairs: floating treads, one flight stacked over the next
  for (const st of map.stairs || []) {
    const run = (st.z1 - st.z0) * 0.85, N = 16, m = G.tread || 'walnut';
    for (let k = 0; k < st.n; k++) { const off = st.yb + k * H;
      for (let i = 0; i < N; i++) { const top = (i + 0.6) * H / N + off; b(m).box(st.x0 + 0.1, st.x1 - 0.1, top - 0.06, top, st.z1 - (i + 1) * run / N, st.z1 - i * run / N, ALL, 1); }
      b(m).box(st.x0 + 0.1, st.x1 - 0.1, H - 0.2 + off, H + off, st.z0, st.z1 - run, 'YZy', 1);
    }
    const top = st.yb + st.n * H - 0.012; b('ceiling').quad([st.x0, top, st.z0], [st.x1, top, st.z0], [st.x1, top, st.z1], [st.x0, top, st.z1], [0, -1, 0]);
  }
  const NOSHADE = { glass: 1, water: 1, glow: 1, ao: 1, aoBlob: 1, lightpool: 1, ocean: 1, ...(G.noshade || {}) };
  for (const k in B) { const m = B[k].mesh(MATS[k]); if (k === 'glass' || k === 'water') m.renderOrder = 5; if (k === 'ao' || k === 'aoBlob' || k === 'lightpool') m.renderOrder = 2; else if (!NOSHADE[k]) { m.castShadow = !(G.noCast || ['gravel']).includes(k); m.receiveShadow = true; } root.add(m); }

  // doors: flush slabs with steel levers; a concealed door is clad like the wall around it; a container has two steel leaves and a padlock
  const doors = level.doors.map(d => {
    const len = d.horiz ? d.x1 - d.x0 : d.z1 - d.z0, h = d.h || map.DOOR_H, g = new THREE.Group(), base = d.horiz ? 0 : -Math.PI / 2, swing = d.swing || 1; g.position.set(d.x0, d.y, d.z0);
    const hm = MATS.steel.clone(), handle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.17), hm);
    let g2 = null, lock = null;
    if (d.pad !== undefined) {   // container: two leaves hinged at the corners, locking bars, a padlock on the middle bar
      const leafM = MATS[G.contDoor ? G.contDoor(d) : 'steel'], half = len / 2;
      const mk = (grp, sgn) => { const leaf = new THREE.Mesh(new THREE.BoxGeometry(half - 0.01, h - 0.02, 0.05), leafM); leaf.position.set(half / 2, h / 2, 0); grp.add(leaf); for (const u of [0.25, half - 0.25]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, h - 0.1, 0.035), MATS.steel); bar.position.set(u, h / 2, -0.045 * swing * sgn); grp.add(bar); } leaf.castShadow = leaf.receiveShadow = true; };
      mk(g, 1); g2 = new THREE.Group(); g2.position.set(d.x1, d.y, d.z1); mk(g2, -1); g2.rotation.y = base + Math.PI; root.add(g2);
      lock = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.035), new THREE.MeshLambertMaterial({ color: 0xb08a3a })), shackle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 12, Math.PI), MATS.steel);
      shackle.position.y = 0.04; lock.add(body, shackle); lock.position.set((d.x0 + d.x1) / 2 + swing * (d.horiz ? 0 : 0.075), d.y + 1.15, (d.z0 + d.z1) / 2); root.add(lock);
      handle.visible = false; g.add(handle);
    } else {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(len - 0.03, h - 0.02, d.hidden ? 0.2 : 0.05), d.hidden ? MATS.stone : MATS[G.door ? G.door(d) : 'door']); leaf.position.set(len / 2, h / 2, 0); g.add(leaf);
      handle.position.set(len - 0.12, 1.0, 0); handle.visible = !d.hidden; g.add(handle); leaf.castShadow = leaf.receiveShadow = true;
    }
    g.rotation.y = base; root.add(g);
    // tripwire: a thin red line at shin height and a charge on the frame; shown on whichever side the server says it is rigged
    const trap = new THREE.Group(), wire = new THREE.Mesh(new THREE.BoxGeometry(len, 0.004, 0.004), new THREE.MeshBasicMaterial({ color: 0xff3030 })), charge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.06), new THREE.MeshLambertMaterial({ color: 0x4a4f3a })), led = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.01), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    wire.position.set(len / 2, 0.28, 0); charge.position.set(0.05, 0.3, 0); led.position.set(0.05, 0.35, 0.034); trap.add(wire, charge, led); trap.position.set(d.x0, d.y, d.z0); trap.rotation.y = base; trap.visible = false; root.add(trap);
    return { g, g2, lock, base, swing, handle, hm, cur: 0, hot: false, trap, horiz: d.horiz };
  });
  // light: dusk sky, low warm sun for highlights, a few warm lamps; night = power cut; NVG = green amplification
  scene.background = new THREE.Color(env.fog[0]); scene.fog = new THREE.FogExp2(env.fog[0], env.fogD[0]);
  const hemi = new THREE.HemisphereLight(0xb9c4dc, 0x7a6a58, 1.25), sun = new THREE.DirectionalLight(env.sunCol || 0xffc9a0, 0.75), amp = new THREE.HemisphereLight(0x46ff58, 0x0a3410, 0); root.add(hemi, sun, amp);
  // The low sun (moon at night) casts real shadows. The scene is static, so the shadow map is drawn once (and again when models arrive), not every frame.
  const [tx, tz] = env.sunAt, [dx, dy, dz] = env.sunFrom, S = env.shadow;
  sun.target.position.set(tx, 0, tz); sun.position.set(tx + dx, dy, tz + dz); root.add(sun.target); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 5, far: Math.hypot(dx, dy, dz) + S * 1.5 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.07;
  const lamps = env.lamps.map(([x, y, z, i = 10, r = 11]) => { const l = new THREE.PointLight(0xffd9a8, i, r, 1.8); l.position.set(x, y, z); l.userData.i = i; root.add(l); return l; });
  const FOGD = { clear: env.fogD, rain: [env.fogD[0] * 2, 0.016], storm: [env.fogD[0] * 2.6, 0.02], fog: [0.07, 0.075] };
  const look = (night, nvg, wx = 'clear') => {
    const k = nvg ? 0.16 : 1, cast = wx !== 'clear', wet = wx === 'rain' || wx === 'storm', dim = cast ? 0.8 : 1;
    hemi.intensity = (night ? 0.2 : 1.25 * (env.hemi || 1)) * k * dim; hemi.color.set(night ? 0x6f83a8 : cast ? 0xa9afba : env.hemiSky || 0xb9c4dc); hemi.groundColor.set(night ? 0x20242c : env.hemiGround || 0x7a6a58);
    sun.intensity = (night ? 0.18 : 0.75 * (env.sunK || 1)) * k * (cast ? 0.35 : 1); sun.color.set(night ? 0xa9bcff : env.sunCol || 0xffc9a0); for (const l of lamps) l.intensity = night ? 0 : l.userData.i * k;
    amp.intensity = nvg ? (night ? 0.8 : 0.5) : 0; setGlossLevel((nvg ? 0.2 : night ? 0.12 : 1) * (wet ? 1.35 : 1));   // wet surfaces shine more
    MATS.glow.color.set(nvg ? (night ? 0x0b3410 : 0x9cff9c) : night ? 0x14120e : 0xffe6bd); MATS.lightpool.opacity = night ? 0 : nvg ? 0.07 : 0.2; MATS.lightpool.color.set(nvg ? 0x60ff70 : 0xffd9a0);
    MATS.ao.opacity = night && !nvg ? 0.3 : 0.55; MATS.aoBlob.opacity = night && !nvg ? 0.4 : 0.75;
    sky.material.color.set(nvg ? (night ? 0x0d3011 : 0x2f8a3a) : night ? (cast ? 0x161a22 : 0x283040) : cast ? 0x7d828c : 0xffffff); sky.visible = hills.visible = wx !== 'fog';
    stars.visible = moon.visible = !cast; stars.material.opacity = night ? 1 : 0.45; stars.material.color.set(nvg ? 0x8cff9c : 0xffffff); moon.material.color.set(nvg ? 0xa8ffb4 : 0xe9edff); moon.material.opacity = night || nvg ? 1 : 0.7;
    hillM.color.set(nvg ? 0x05160a : night ? 0x040608 : env.hillColor || 0x1b1d22);
    scene.fog.color.set(nvg ? (night ? 0x082409 : 0x1c5a26) : night ? (wx === 'fog' ? 0x0d1016 : 0x05070b) : wx === 'fog' ? 0x767c85 : cast ? 0x3d434d : env.fog[0]); scene.fog.density = FOGD[wx][night ? 1 : 0]; scene.background.copy(scene.fog.color);
    if (G.look) G.look(night, nvg, wx);
  };
  const dispose = () => { scene.remove(root); root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); skyT.dispose(); };
  return { root, level, map, doors, look, dispose, sun };
}

export function label(text, color = '#fff', w = 256, h = 64) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, w, h); g.fillStyle = color; g.fillText(text, w / 2, h / 2);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true, toneMapped: false })); s.scale.set(0.9, 0.9 * h / w, 1); s.renderOrder = 10; return s;
}
