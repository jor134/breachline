// The circuit's buildings, rebuilt in the game's own style from the footprints tools/spa_kit.py took out of the circuit model
// (BUILDINGS in ../core/maps/spa-path.js: centre, size, turn, lowest and highest point, kind). None can be entered.
//   pits    the pit garages east of ours: a closed row of roller shutters toward the pit lane, a band of glass above, a canopy
//   block   offices, garages and houses round the circuit: concrete walls with rows of windows, a flat roof with a parapet
//   stand   grandstands: stepped blue seats facing the track, a back wall, a roof on thin columns
//   tent    hospitality marquees: white walls and a gabled roof
//   canopy  roofs over the pit apron west of the paddock, on columns
// Each material's pieces are gathered into one mesh, so the whole lot is a handful of draw calls.
import * as THREE from '../../vendor/three.module.min.js';
import { sheen, tex, grid } from '../mats.js';
import { BUILDINGS, LINE } from '../core/maps/spa-path.js';

function canvasTex(draw, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
let MATS = null;
function mats() {
  if (MATS) return MATS;
  const windows = (g, s) => {   // one tile: 4 m wide, 3.2 m tall: a storey of concrete with a window and its frame
    g.fillStyle = '#cfd1cf'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 400; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
    g.fillStyle = '#9aa3a8'; g.fillRect(s * 0.1, s * 0.3, s * 0.8, s * 0.42);
    const gr = g.createLinearGradient(0, s * 0.32, 0, s * 0.7); gr.addColorStop(0, '#5d7383'); gr.addColorStop(1, '#2c3a45'); g.fillStyle = gr; g.fillRect(s * 0.13, s * 0.32, s * 0.74, s * 0.38);
    g.fillStyle = '#9aa3a8'; g.fillRect(s * 0.49, s * 0.32, s * 0.02, s * 0.38);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, s * 0.97, s, s * 0.03);
  };
  const shutters = (g, s) => {   // one tile: a 4.5 m garage bay, ground to 4.4 m: roller shutter, posts, glass band above
    g.fillStyle = '#d9dbdc'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#2a3036'; g.fillRect(0, 0, s, s * 0.22);
    g.fillStyle = 'rgba(160,190,210,0.35)'; for (let i = 0; i < 4; i++) g.fillRect(i * s / 4 + 3, 4, s / 4 - 6, s * 0.22 - 8);
    g.fillStyle = '#b9bec2'; g.fillRect(s * 0.06, s * 0.3, s * 0.88, s * 0.7);
    for (let y = s * 0.3; y < s; y += 6) { g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(s * 0.06, y, s * 0.88, 1.5); }
    g.fillStyle = '#7d858c'; g.fillRect(0, s * 0.22, s * 0.06, s * 0.78); g.fillRect(s * 0.94, s * 0.22, s * 0.06, s * 0.78);
  };
  const S = (t, gl) => sheen({ map: t }, gl);
  MATS = {
    wall: S(canvasTex(windows), 'satin'), plain: S(tex('#c9cbc8', 600, grid(2, 1, 'rgba(0,0,0,0.12)')), 'satin'),
    roof: S(tex('#55595d', 900), 'matte'), rim: S(tex('#e8e9e6', 200), 'paint'), shutter: S(canvasTex(shutters), 'satin'),
    seat: S(tex('#2a4d9a', 400, grid(1, 1, 'rgba(0,0,0,0.35)')), 'satin'), step: S(tex('#9da2a6', 600), 'matte'),
    steel: S(tex('#8e949a', 200), 'metal'), tent: S(tex('#f2f1ec', 300, grid(1, 1, 'rgba(0,0,0,0.06)')), 'satin'), tentRoof: S(tex('#f4f4f0', 0, (g, s) => { for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#f4f4f0' : '#c8d2da'; g.fillRect(i * s / 4, 0, s / 4, s); } }), 'satin'),
  };
  MATS.tent.side = MATS.tentRoof.side = THREE.DoubleSide;
  return MATS;
}

// nearest point of the race line: grandstands and garage fronts turn to face it
function towardTrack(x, z) {
  let best = 1e18, bx = 0, bz = 0;
  for (let i = 0; i < LINE.length; i += 4) { const d = (LINE[i] - x) ** 2 + (LINE[i + 1] - z) ** 2; if (d < best) { best = d; bx = LINE[i]; bz = LINE[i + 1]; } }
  return [bx - x, bz - z];
}

export function makeBuildings() {
  const M = mats(), buf = new Map();
  const B = m => buf.get(m) || buf.set(m, { p: [], n: [], u: [] }).get(m);
  // a box in a building's own frame: u along its width, v along its depth (toward its back), y up; uv in tiles of tw x th metres
  function piece(o, mat, u0, u1, v0, v1, y0, y1, faces = 'xXzZy', tw = 4, th = 3.2, faceMat) {
    const P = (u, v, y) => [o.x + u * o.cu - v * o.su, y, o.z + u * o.su + v * o.cu];
    const quad = (m, a, b, c, d, n, w, h) => {
      const t = B(m); for (const q of [a, b, c, a, c, d]) t.p.push(...q);
      for (let i = 0; i < 6; i++) t.n.push(...n);
      const U = [[0, 0], [w / tw, 0], [w / tw, h / th], [0, 0], [w / tw, h / th], [0, h / th]]; for (const q of U) t.u.push(...q);
    };
    const nu = [o.cu, 0, o.su], nv = [-o.su, 0, o.cu], neg = a => a.map(v => -v), W = u1 - u0, D = v1 - v0, Hh = y1 - y0;
    const fm = f => (faceMat && faceMat[f]) || mat;
    if (faces.includes('z')) quad(fm('z'), P(u1, v0, y0), P(u0, v0, y0), P(u0, v0, y1), P(u1, v0, y1), neg(nv), W, Hh);   // front (v0)
    if (faces.includes('Z')) quad(fm('Z'), P(u0, v1, y0), P(u1, v1, y0), P(u1, v1, y1), P(u0, v1, y1), nv, W, Hh);         // back
    if (faces.includes('x')) quad(fm('x'), P(u0, v0, y0), P(u0, v1, y0), P(u0, v1, y1), P(u0, v0, y1), neg(nu), D, Hh);
    if (faces.includes('X')) quad(fm('X'), P(u1, v1, y0), P(u1, v0, y0), P(u1, v0, y1), P(u1, v1, y1), nu, D, Hh);
    if (faces.includes('y')) quad(fm('y'), P(u0, v1, y1), P(u1, v1, y1), P(u1, v0, y1), P(u0, v0, y1), [0, 1, 0], W, D);
  }
  for (const [x, z, w, d, ry, ylo, yhi, kind] of BUILDINGS) {
    // the building's frame, turned so its front (v = -d/2) faces the track
    let r = -ry; const [tx, tz] = towardTrack(x, z), cu0 = Math.cos(r), su0 = Math.sin(r);
    if (tx * -su0 + tz * cu0 > 0) r += Math.PI;   // the depth axis must point away from the track
    const o = { x, z, cu: Math.cos(r), su: Math.sin(r) }, hw = w / 2, hd = d / 2, y0 = ylo - 0.6, h = Math.max(3, yhi - ylo);
    if (kind === 'pits') {
      const top = ylo + 4.4;
      piece(o, M.plain, -hw, hw, -hd, hd, y0, top, 'xXzZ', 4.5, 4.4, { z: M.shutter });
      piece(o, M.roof, -hw, hw, -hd, hd, top - 0.2, top, 'y');
      piece(o, M.rim, -hw, hw, -hd - 1.6, -hd, top - 0.25, top, 'xXzZy', 4, 0.25);   // canopy over the garage fronts
      piece(o, M.rim, -hw, hw, -hd, hd, top, top + 0.9, 'z', 4, 0.9);                // roof terrace balustrade
    } else if (kind === 'stand') {
      const rows = Math.max(4, Math.floor((d - 1.5) / 0.85)), rise = Math.min(0.55, (h - 3.2) / rows);
      piece(o, M.plain, -hw, hw, hd - 0.4, hd, y0, ylo + h, 'xXZzy', 4, 3.2);                         // back wall
      piece(o, M.step, -hw, hw, -hd, hd - 0.4, y0, ylo + 0.9, 'xXzy', 4, 1);                           // front wall to the first row
      for (let i = 0; i < rows; i++) { const v = -hd + 0.6 + i * 0.85, y = ylo + 0.9 + (i + 1) * rise;
        piece(o, M.step, -hw, hw, v, hd - 0.4, y - rise, y, 'zxX', 4, 1); piece(o, M.seat, -hw, hw, v, hd - 0.4, y, y, 'y', 1, 1); }
      const ry1 = ylo + h; piece(o, M.roof, -hw - 0.5, hw + 0.5, -hd - 1, hd, ry1, ry1 + 0.35, 'xXzZy', 4, 0.35);
      for (let u = -hw; u <= hw + 0.01; u += Math.max(6, w / Math.ceil(w / 8))) piece(o, M.steel, u - 0.12, u + 0.12, -hd + 0.2, -hd + 0.44, y0, ry1, 'xXzZ', 1, 3);
    } else if (kind === 'tent') {
      const wall = ylo + 2.6, peak = Math.max(wall + 1.5, Math.min(yhi, wall + d * 0.35)), t = B(M.tentRoof);
      piece(o, M.tent, -hw, hw, -hd, hd, y0, wall, 'xXzZ', 3, 2.6);
      const P = (u, v, y) => [o.x + u * o.cu - v * o.su, y, o.z + u * o.su + v * o.cu];
      for (const s of [-1, 1]) {   // two roof slopes and their gable ends
        const a = P(-hw, s * hd, wall), b = P(hw, s * hd, wall), c = P(hw, 0, peak), e = P(-hw, 0, peak), ny = hd / Math.hypot(hd, peak - wall), nh = (peak - wall) / Math.hypot(hd, peak - wall);
        const n = [-o.su * s * nh, ny, o.cu * s * nh]; for (const q of s > 0 ? [a, c, b, a, e, c] : [a, b, c, a, c, e]) t.p.push(...q); for (let i = 0; i < 6; i++) t.n.push(...n);
        t.u.push(0, 0, 3, 1, 3, 0, 0, 0, 0, 1, 3, 1);
        const g0 = P(s * hw, -hd, wall), g1 = P(s * hw, hd, wall), g2 = P(s * hw, 0, peak), gn = [o.cu * s, 0, o.su * s]; for (const q of s > 0 ? [g0, g2, g1] : [g0, g1, g2]) t.p.push(...q); for (let i = 0; i < 3; i++) t.n.push(...gn); t.u.push(0, 0, 1, 0, 0.5, 0.6);
      }
    } else if (kind === 'canopy') {
      piece(o, M.rim, -hw, hw, -hd, hd, yhi - 0.45, yhi, 'xXzZy', 4, 0.45);
      for (let u = -hw + 0.5; u <= hw; u += 6) piece(o, M.steel, u - 0.1, u + 0.1, -hd + 0.3, -hd + 0.5, 0, yhi - 0.45, 'xXzZ', 1, 3);
    } else {
      const top = ylo + h;
      piece(o, M.wall, -hw, hw, -hd, hd, y0, top, 'xXzZ', 4, 3.2);
      piece(o, M.roof, -hw, hw, -hd, hd, top, top, 'y');
      piece(o, M.rim, -hw, hw, -hd, -hd + 0.25, top, top + 0.5, 'zy', 4, 0.5); piece(o, M.rim, -hw, hw, hd - 0.25, hd, top, top + 0.5, 'Zy', 4, 0.5);
      piece(o, M.rim, -hw, -hw + 0.25, -hd, hd, top, top + 0.5, 'xy', 4, 0.5); piece(o, M.rim, hw - 0.25, hw, -hd, hd, top, top + 0.5, 'Xy', 4, 0.5);
    }
  }
  const g = new THREE.Group(); g.name = 'circuitBuildings';
  for (const [m, t] of buf) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(t.p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(t.n, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(t.u, 2));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, m); mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; g.add(mesh);
  }
  return g;
}
