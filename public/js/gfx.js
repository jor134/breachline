// World rendering: procedural placeholder textures, merged static geometry, doors, lights.
import * as THREE from '../vendor/three.module.min.js';
import { buildLevel, ROOMS, H, STAIR, FOOT, YARD, DOOR_H } from './core/level.js';

function tex(base, speck, lines, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < speck; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'; g.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1 + Math.random() * 3); }
  if (lines) lines(g, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const grid = (nx, ny, col, off) => (g, s) => { g.strokeStyle = col; g.lineWidth = 2; for (let j = 0; j <= ny; j++) { g.beginPath(); g.moveTo(0, j * s / ny); g.lineTo(s, j * s / ny); g.stroke(); for (let i = 0; i <= nx; i++) { const x = (i + (off && j % 2 ? 0.5 : 0)) * s / nx; g.beginPath(); g.moveTo(x, j * s / ny); g.lineTo(x, (j + 1) * s / ny); g.stroke(); } } };
const lam = (map, color = 0xffffff) => new THREE.MeshLambertMaterial({ map, color });
export const MATS = {};
function initMats() {
  if (MATS.plaster) return;
  Object.assign(MATS, {
    plaster: lam(tex('#cfc8ba', 1500)), ceiling: lam(tex('#e4e0d8', 600)), brick: lam(tex('#7a4a3a', 2500, grid(4, 8, 'rgba(30,20,15,0.6)', true))),
    wood: lam(tex('#8a6240', 2500, grid(2, 8, 'rgba(40,25,10,0.5)', true))), tile: lam(tex('#b9bcc0', 800, grid(4, 4, 'rgba(60,60,60,0.5)'))),
    carpet: lam(tex('#5a5f70', 6000)), marble: lam(tex('#d8d4cc', 1200, grid(2, 2, 'rgba(90,90,90,0.35)'))), grass: lam(tex('#2f4a2a', 7000)),
    asphalt: lam(tex('#3a3a3d', 5000)), dark: lam(tex('#3d2b1e', 1500)), fabric: lam(tex('#6b3a3a', 5000)), stone: lam(tex('#8d8f93', 2500)),
    metal: lam(tex('#22262c', 800)), concrete: lam(tex('#77756f', 4000)), roof: lam(tex('#2a2a2e', 2000)), door: lam(tex('#5b3d26', 1200, grid(1, 2, 'rgba(20,10,5,0.5)'))),
    window: new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
  });
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
  // faces: string of any of 'x X y Y z Z' (lowercase = negative side)
  box(x0, x1, y0, y1, z0, z1, faces = 'xXYzZ', s = 0.5) {
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

export function buildWorld(scene) {
  initMats();
  const level = buildLevel(), B = {}; const b = k => B[k] || (B[k] = new Builder());
  // grounds
  b('grass').quad([YARD.x0 - 30, 0, YARD.z0 - 30], [YARD.x1 + 30, 0, YARD.z0 - 30], [YARD.x1 + 30, 0, YARD.z1 + 30], [YARD.x0 - 30, 0, YARD.z1 + 30], [0, 1, 0], 0.25);
  b('asphalt').quad([4, 0.01, 16.2], [20, 0.01, 16.2], [20, 0.01, YARD.z1], [4, 0.01, YARD.z1], [0, 1, 0], 0.4);
  b('concrete').box(YARD.x0 - 0.2, YARD.x0, 0, 2, YARD.z0, YARD.z1); b('concrete').box(YARD.x1, YARD.x1 + 0.2, 0, 2, YARD.z0, YARD.z1);
  b('concrete').box(YARD.x0, YARD.x1, 0, 2, YARD.z0 - 0.2, YARD.z0); b('concrete').box(YARD.x0, 9, 0, 2, YARD.z1, YARD.z1 + 0.2); b('concrete').box(15, YARD.x1, 0, 2, YARD.z1, YARD.z1 + 0.2);
  // floors + ceilings
  for (const [f, , x0, z0, x1, z1, mat] of ROOMS) {
    const y = f * H + 0.004; b(mat).quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], 0.5);
    const cy = f * H + H - 0.012; b('ceiling').quad([x0, cy, z0], [x1, cy, z0], [x1, cy, z1], [x0, cy, z1], [0, -1, 0], 0.5);
  }
  b('ceiling').quad([STAIR.x0, 2 * H - 0.012, STAIR.z0], [STAIR.x1, 2 * H - 0.012, STAIR.z0], [STAIR.x1, 2 * H - 0.012, STAIR.z1], [STAIR.x0, 2 * H - 0.012, STAIR.z1], [0, -1, 0]);
  b('roof').box(FOOT.x0 - 0.4, FOOT.x1 + 0.4, 2 * H, 2 * H + 0.35, FOOT.z0 - 0.4, FOOT.z1 + 0.4, 'xXYyzZ');
  // walls
  for (const w of level.boxes) {
    if (w.kind === 'wall' || w.kind === 'lintel') {
      let out = '';
      if (w.ext) { if (w.z1 - w.z0 < 0.3 && w.x1 - w.x0 > 0.3) out = w.z0 < 1 ? 'z' : 'Z'; else out = w.x0 < 1 ? 'x' : 'X'; }
      else if (w.kind === 'lintel') { if (Math.abs(w.z0 + 0.1) < 0.01) out = 'z'; if (Math.abs(w.z1 - 16.1) < 0.01) out = 'Z'; }
      const inner = 'xXzZ'.replace(out, '') + (w.kind === 'lintel' ? 'y' : '');
      b('plaster').box(w.x0, w.x1, w.y0, w.y1, w.z0, w.z1, inner);
      if (out) b('brick').box(w.x0, w.x1, w.y0, w.y1, w.z0, w.z1, out);
    } else if (w.kind === 'furn') {
      const m = { sofa: 'fabric', bed: 'fabric', table: 'dark', shelf: 'dark', cabinet: 'dark', counter: 'stone', car: 'metal', planter: 'concrete' }[w.sub] || 'dark';
      b(m).box(w.x0, w.x1, w.y0, w.y1, w.z0, w.z1, 'xXYzZ', 1);
    }
  }
  // stairs
  const run = (STAIR.z1 - STAIR.z0) * 0.85, N = 16;
  for (let i = 0; i < N; i++) b('dark').box(STAIR.x0 + 0.1, STAIR.x1 - 0.1, 0, (i + 0.6) * H / N, STAIR.z1 - (i + 1) * run / N, STAIR.z1 - i * run / N, 'YZ', 1);
  b('dark').box(STAIR.x0 + 0.1, STAIR.x1 - 0.1, H - 0.2, H, STAIR.z0, STAIR.z1 - run, 'YZy', 1);
  // glowing window panes on the outside (visual only for now)
  for (const f of [0, 1]) for (const x of [3, 6.5, 17.5, 21]) for (const [z, n] of [[16.115, 1], [-0.115, -1]]) { if (f === 0 && n === -1 && x === 21) continue; const y = f * H + 1; b('window').quad([x - 0.6, y, z], [x + 0.6, y, z], [x + 0.6, y + 1.3, z], [x - 0.6, y + 1.3, z], [0, 0, n]); }
  for (const f of [0, 1]) for (const z of [3, 12]) for (const [x, n] of [[-0.115, -1], [24.115, 1]]) { const y = f * H + 1; b('window').quad([x, y, z - 0.6], [x, y, z + 0.6], [x, y + 1.3, z + 0.6], [x, y + 1.3, z - 0.6], [n, 0, 0]); }
  for (const k in B) scene.add(B[k].mesh(MATS[k]));

  // doors
  const doors = level.doors.map(d => {
    const len = d.horiz ? d.x1 - d.x0 : d.z1 - d.z0, g = new THREE.Group(); g.position.set(d.x0, d.y, d.z0);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(len - 0.04, DOOR_H - 0.03, 0.05), MATS.door); leaf.position.set(len / 2, DOOR_H / 2, 0); g.add(leaf);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.16), MATS.metal); handle.position.set(len - 0.12, 1.0, 0); g.add(handle);
    const base = d.horiz ? 0 : -Math.PI / 2; g.rotation.y = base; scene.add(g);
    return { g, base, handle, cur: 0 };
  });
  // lights
  scene.background = new THREE.Color(0x0a1020); scene.fog = new THREE.FogExp2(0x0a1020, 0.01);
  scene.add(new THREE.HemisphereLight(0xa9b6d6, 0x6a6258, 1.15));
  const moon = new THREE.DirectionalLight(0xb7c7ff, 0.9); moon.position.set(8, 30, 28); scene.add(moon);
  return { level, doors };
}

export function label(text, color = '#fff', w = 256, h = 64) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, w, h); g.fillStyle = color; g.fillText(text, w / 2, h / 2);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); s.scale.set(0.9, 0.9 * h / w, 1); s.renderOrder = 10; return s;
}
