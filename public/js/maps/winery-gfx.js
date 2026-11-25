// Winery scenery: Bodega Novena, an invented winery in the style of the Mendoza bodegas of dry-stone walls, at its sunset party.
// Two tall wings of pirca (stacked stone, no mortar) either side of a lower centre of board-formed ochre concrete; on the centre's
// roof the terrace, the glass restaurant under its corten band, the party, the DJ at the south rail facing the Andes. Open stairs
// climb the front either side of the entrance, stepped walls beside them. All round: vines in rows, a dirt drive up through them,
// poplar windbreaks, the precordillera and the snow of the Andes to the south and west. Dusk (the sun gone behind the range, the
// snow pink) or night (moon, the building's lights). Everything here is drawn from code; the DJ's decks, speakers, laptops and bar
// stools are the club's kits, the people the club's dancers (club-crowd.js), the music the club's set.
import * as THREE from '../../vendor/three.module.min.js';
import { sheen, tex, grid, envMap, pbrMats } from '../mats.js';
import { ObfLoader } from '../store/obf.js';
import { setVenueMusic, setVenueMix, venueLevel } from '../audio.js';
import { H, FOOT, WEST, EAST, TERR, PAV, VOID, FLIGHTS, LANDINGS, YARD, DRIVE, PLAZA, ROOMS, FURNITURE, VAN, DJ, DANCERS, ROW_DX, vineRows, flightY, inPav, onTerrace, inFoot } from '../core/maps/winery.js';
import { makeDancers } from './club-crowd.js';

const VAN_TURN = Math.PI;   // the van model's nose is at its -z end: turned to face the winery
let tod = 'dusk', glows = [], matGlows = [], dancers = null, beams = [], ledMats = [], root0 = null, andes = [], bulbs = null, sunGlow = null, mix = { g: -1, c: -1 };
const LAMPS = [
  // ground: west wing, visitor centre, cellar, east wing
  [6, 3.9, 5, 6, 9], [16, 3.9, 5, 6, 9], [23, 3.9, 5, 5, 8], [8, 8.2, 18, 9, 14], [18, 8.2, 18, 9, 14], [8, 8.2, 28, 9, 14], [18, 8.2, 28, 9, 14],
  [31, 3.9, 5, 6, 9], [42, 3.9, 5, 7, 10], [53, 3.9, 5, 6, 9], [34, 3.9, 11.5, 5, 8], [50, 3.9, 11.5, 5, 8],
  [33, 3.6, 20, 5, 9], [51, 3.6, 20, 5, 9], [33, 3.6, 29, 5, 9], [51, 3.6, 29, 5, 9], [42, 3.6, 24, 6, 10],
  [61, 3.9, 11, 5, 8], [70, 3.9, 7, 7, 10], [80, 3.9, 7, 7, 10], [64, 3.9, 24, 8, 12], [78, 3.9, 24, 8, 12], [71, 3.9, 30, 7, 10],
  // upstairs
  [5, 8.3, 5, 6, 9], [15, 8.3, 5, 6, 9], [23, 8.3, 5, 5, 8], [13, 8.3, 11.5, 6, 10], [36, 8.2, 8, 7, 10], [45, 8.2, 8, 7, 10], [52, 8.3, 8, 6, 9],
  [61, 8.3, 11, 5, 8], [69, 8.3, 7, 7, 10], [79, 8.3, 7, 7, 10], [71, 8.3, 15.5, 5, 8], [65, 8.3, 25, 7, 11], [78, 8.3, 25, 7, 11],
  // the terrace: the string lights' glow
  [34, 7.6, 22, 9, 15], [50, 7.6, 22, 9, 15], [42, 6.6, 29, 8, 12], [29, 6.6, 8, 6, 10], [56, 6.6, 8, 6, 10],
  // outside: the entrance, lamps along the front, the drive
  [42, 3.2, -2.5, 8, 12], [12, 4, -6, 8, 14], [72, 4, -6, 8, 14], [42, 4, -24, 8, 14], [84.5, 4, 6.5, 7, 12], [12.5, 4, 35, 7, 12], [70.5, 4, 35, 7, 12],
];
const DUSK = {
  sky: [[0, '#24305c'], [0.24, '#4b4f86'], [0.38, '#9a7ea4'], [0.45, '#e9a28a'], [0.49, '#ffc98a'], [0.5, '#ffe0a6'], [0.53, '#7a6a5a'], [1, '#3a3430']], skyR: 600, moon: [150, 140, -200],
  fog: [0xb48f86], fogD: [0.0016, 0.004], sunAt: [42, 17], sunFrom: [-160, 30, 55], shadow: 75, sunCol: 0xffa064, sunK: 1.15, hemi: 1.0, hemiSky: 0xb7a8d0, hemiGround: 0x6e6660,
  hillColor: 0x3a3040, lamps: LAMPS, lampCap: 8,
};
const NIGHT = {
  sky: [[0, '#03050c'], [0.3, '#08102a'], [0.45, '#18234a'], [0.5, '#2b3358'], [0.53, '#0b0c12'], [1, '#08090c']], skyR: 600, moon: [130, 150, -170],
  fog: [0x0d1322], fogD: [0.0028, 0.007], sunAt: [42, 17], sunFrom: [70, 95, -60], shadow: 75, sunCol: 0xb6c6ff, sunK: 0.6, hemi: 0.62, hemiSky: 0x7c8cc0, hemiGround: 0x2a2a30,
  hillColor: 0x07080d, lamps: LAMPS, lampCap: 8,
};
const cvs = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
let seed = 13; const rr = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const pick = a => a[Math.floor(rr() * a.length)];
// ---------- painted textures ----------
// pirca: dry-stacked fieldstone, 1 m square (walls are drawn at 1 m a repeat): rounded stones in grey, brown and rust, laid in rough
// courses, dark gaps between (no mortar)
const pircaTex = () => cvs(512, 512, (g, w, h) => {
  g.fillStyle = '#3e362e'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 3000; i++) { g.fillStyle = rr() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(120,105,90,0.2)'; g.fillRect(rr() * w, rr() * h, 3, 3); }   // the gaps: small stones and shadow
  const COLS = ['#9a8f82', '#aa9d8b', '#878075', '#b3a38f', '#7a736b', '#b8987a', '#9e8a78', '#958779', '#a8927c', '#8b8379', '#bdae9a', '#8e7462', '#a4785a', '#6f6a64'];
  const stone = (x, y, sw, sh) => { const col = pick(COLS), sk = (rr() - 0.5) * 0.5, n = 11, rs = Array.from({ length: n }, () => 0.8 + rr() * 0.22);
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
      const cx = x + ox, cy = y + oy; if (cx + sw < 0 || cx - sw > w || cy + sh < 0 || cy - sh > h) continue;
      g.beginPath(); for (let k = 0; k < n; k++) { const a = k / n * 6.283, r = rs[k]; g.lineTo(cx + Math.cos(a) * sw * r + Math.sin(a) * sh * sk * r, cy + Math.sin(a) * sh * r); } g.closePath();
      g.fillStyle = col; g.fill(); const gr = g.createLinearGradient(cx, cy - sh, cx, cy + sh); gr.addColorStop(0, 'rgba(255,245,230,0.22)'); gr.addColorStop(0.45, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = gr; g.fill();
      for (let i = 0; i < 30; i++) { g.fillStyle = rr() < 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)'; g.fillRect(cx + (rr() - 0.5) * sw * 1.4, cy + (rr() - 0.5) * sh * 1.4, 2 + rr() * 7, 2 + rr() * 5); } } };
  // rough courses of stones of every size: each course a different height, stones offset up or down in it, now and then a big one
  for (let y = 0; y < h;) { const rh = 70 + rr() * 70; for (let x = rr() * 40; x < w;) { const big = rr() < 0.15, sw = (big ? 170 : 70) + rr() * 120, sh = (big ? rh * 1.3 : rh * (0.55 + rr() * 0.45));
    stone(x + sw / 2, y + rh / 2 + (rr() - 0.5) * (rh - sh) * 0.9, sw / 2 - 3, sh / 2 - 3); x += sw + 1 + rr() * 6; } y += rh; if (y > h - 40) break; }
});
// board-formed concrete, ochre: horizontal board marks, tie holes, a little staining (1 m square)
const ochreTex = (base = '#c6a46a') => cvs(512, 512, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { g.fillStyle = rr() < 0.5 ? 'rgba(80,50,10,0.07)' : 'rgba(255,240,200,0.07)'; g.fillRect(rr() * w, rr() * h, 1 + rr() * 4, 1 + rr() * 3); }
  for (let y = 0; y < h; y += 64) { g.fillStyle = 'rgba(90,60,20,0.16)'; g.fillRect(0, y, w, 2); g.fillStyle = `rgba(${rr() < 0.5 ? '255,240,200' : '80,50,10'},0.05)`; g.fillRect(0, y + 2, w, 62); }
  for (const x of [128, 384]) for (const y of [96, 352]) { g.fillStyle = 'rgba(60,40,10,0.45)'; g.beginPath(); g.arc(x, y, 5, 0, 6.283); g.fill(); }
  for (let i = 0; i < 6; i++) { const x = rr() * w, gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(90,60,30,0.10)'); gr.addColorStop(1, 'rgba(90,60,30,0)'); g.fillStyle = gr; g.fillRect(x, 0, 6 + rr() * 20, h); }
});
const cortenTex = () => cvs(256, 256, (g, w, h) => {
  g.fillStyle = '#7a3519'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1800; i++) { g.fillStyle = pick(['rgba(160,80,30,0.22)', 'rgba(60,20,8,0.22)', 'rgba(190,110,50,0.15)', 'rgba(40,18,10,0.2)']); const r = 1 + rr() * 6; g.beginPath(); g.arc(rr() * w, rr() * h, r, 0, 6.283); g.fill(); }
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(50,18,6,0.12)'; g.fillRect(rr() * w, 0, 2 + rr() * 6, h); }
});
const paverTex = () => cvs(512, 512, (g, w, h) => { for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const n = rr() * 22; g.fillStyle = `rgb(${178 + n},${168 + n},${150 + n})`; g.fillRect(i * 128, j * 128, 128, 128); for (let k = 0; k < 160; k++) { g.fillStyle = rr() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'; g.fillRect(i * 128 + rr() * 128, j * 128 + rr() * 128, 2, 2); } }
  g.fillStyle = 'rgba(70,62,50,0.55)'; for (let i = 0; i <= 4; i++) { g.fillRect(i * 128 - 1, 0, 3, h); g.fillRect(0, i * 128 - 1, w, 3); } });
// vine foliage (1.2 m a repeat along the row): leaves in clumps, see-through at the edges (alpha-tested)
const leafTex = () => cvs(256, 256, (g, w, h) => {
  for (let i = 0; i < 900; i++) { const x = rr() * w, y = 30 + rr() * (h - 50), r = 5 + rr() * 9; for (const ox of [-w, 0, w]) { g.fillStyle = pick(['#3d5a22', '#4f6e2a', '#628236', '#2f4a1c', '#6d8a3a', '#57742e', '#7a8f3e']); g.beginPath(); g.ellipse(x + ox, y, r, r * 0.8, rr() * 3, 0, 6.283); g.fill(); } }
  for (let i = 0; i < 40; i++) { const x = rr() * w, y = 60 + rr() * (h - 90); g.fillStyle = pick(['#2a1430', '#3b1a3c', '#4a2042']); for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(x + (rr() - 0.5) * 8, y + k * 3, 3, 0, 6.283); g.fill(); } }   // bunches
});
// the trunks under the canopy (one per 1.2 m) and the trellis wires (alpha-tested; the quad covers the bottom 0.8 m of it)
const trunkTex = () => cvs(128, 256, (g, w, h) => {
  g.strokeStyle = '#3e2f22'; g.lineCap = 'round'; g.lineWidth = 7; g.beginPath(); g.moveTo(w / 2, h); let x = w / 2; for (let y = h; y > h * 0.25; y -= 16) { x += (rr() - 0.5) * 8; g.lineTo(x, y); } g.stroke();
  g.lineWidth = 3; g.beginPath(); g.moveTo(x, h * 0.3); g.lineTo(x - 30, h * 0.2); g.moveTo(x, h * 0.3); g.lineTo(x + 34, h * 0.22); g.stroke();
  g.fillStyle = 'rgba(150,150,150,0.9)'; for (const y of [0.24, 0.5]) g.fillRect(0, h * y, w, 2);
});
// the vineyard floor: rows of dry weeds under the vines (at whole multiples of the row spacing) and bare, tracked earth between
const rowsTex = () => cvs(256, 64, (g, w, h) => {
  g.fillStyle = '#8a7258'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1500; i++) { g.fillStyle = rr() < 0.5 ? 'rgba(60,40,20,0.12)' : 'rgba(230,210,170,0.1)'; g.fillRect(rr() * w, rr() * h, 2, 2); }
  for (const c of [0, w]) { const gr = g.createLinearGradient(c - 60, 0, c + 60, 0); gr.addColorStop(0, 'rgba(110,105,60,0)'); gr.addColorStop(0.5, 'rgba(110,105,60,0.85)'); gr.addColorStop(1, 'rgba(110,105,60,0)'); g.fillStyle = gr; g.fillRect(c - 60, 0, 120, h); }
  for (const x of [w * 0.35, w * 0.65]) { g.fillStyle = 'rgba(70,50,30,0.25)'; g.fillRect(x, 0, 10, h); }
});
const poplarTex = () => cvs(128, 512, (g, w, h) => {
  for (let i = 0; i < 1400; i++) { const t = rr(), y = 30 + t * (h - 60), half = (Math.sin(Math.min(1, t * 1.2) * Math.PI * 0.95) * 0.42 + 0.04) * w, x = w / 2 + (rr() - 0.5) * 2 * half;
    g.fillStyle = pick(['#26361e', '#2f4224', '#3a5029', '#1f2d19', '#45592e']); g.beginPath(); g.arc(x, y, 3 + rr() * 4, 0, 6.283); g.fill(); }
  g.fillStyle = '#2b2219'; g.fillRect(w / 2 - 3, h - 34, 6, 34);
});
const pampasTex = () => cvs(256, 256, (g, w, h) => {
  g.lineCap = 'round'; for (let i = 0; i < 90; i++) { const a = (rr() - 0.5) * 1.6, l = 90 + rr() * 110; g.strokeStyle = pick(['#8a8a52', '#a39a62', '#6f7444', '#b5a874']); g.lineWidth = 1.5; g.beginPath(); g.moveTo(w / 2, h); g.quadraticCurveTo(w / 2 + Math.sin(a) * l * 0.4, h - l * 0.6, w / 2 + Math.sin(a) * l, h - Math.cos(a) * l); g.stroke(); }
  for (let i = 0; i < 9; i++) { const a = (rr() - 0.5) * 0.9, l = 160 + rr() * 80, x = w / 2 + Math.sin(a) * l, y = h - Math.cos(a) * l; g.strokeStyle = '#6f6a48'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(w / 2, h); g.lineTo(x, y); g.stroke();
    for (let k = 0; k < 60; k++) { g.fillStyle = pick(['rgba(240,228,200,0.8)', 'rgba(220,205,170,0.8)', 'rgba(255,245,225,0.7)']); g.beginPath(); g.arc(x + (rr() - 0.5) * 14, y + rr() * 46, 2 + rr() * 2.5, 0, 6.283); g.fill(); } }
});
// an oak barrel's side (u round, v along it): staves, four dark hoops, the wine-stained band across the middle
const barrelTex = () => cvs(256, 256, (g, w, h) => {
  for (let i = 0; i < 16; i++) { const n = rr() * 24; g.fillStyle = `rgb(${132 + n},${88 + n * 0.7},${54 + n * 0.5})`; g.fillRect(i * w / 16, 0, w / 16, h); g.fillStyle = 'rgba(40,20,10,0.35)'; g.fillRect(i * w / 16, 0, 1.5, h); }
  for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(60,30,10,0.1)'; g.fillRect(rr() * w, rr() * h, 1, 6 + rr() * 14); }
  g.fillStyle = 'rgba(96,20,32,0.7)'; g.fillRect(0, h * 0.4, w, h * 0.2);
  g.fillStyle = '#2a2622'; for (const [a, b] of [[0.07, 0.13], [0.22, 0.27], [0.73, 0.78], [0.87, 0.93]]) g.fillRect(0, h * a, w, h * (b - a));
});
const barrelHeadTex = () => cvs(128, 128, (g, w, h) => { for (let i = 0; i < 8; i++) { const n = rr() * 26; g.fillStyle = `rgb(${158 + n},${110 + n * 0.7},${70 + n * 0.5})`; g.fillRect(0, i * h / 8, w, h / 8); g.fillStyle = 'rgba(40,20,10,0.3)'; g.fillRect(0, i * h / 8, w, 1); } g.strokeStyle = '#2a2622'; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 3, 0, 6.283); g.stroke(); g.fillStyle = '#3a2a1c'; g.beginPath(); g.arc(w * 0.5, h * 0.3, 5, 0, 6.283); g.fill(); });
// a wine rack's face (1 m square): oak lattice, bottle ends in each cell (a few cells empty)
const rackTex = () => cvs(256, 256, (g, w, h) => {
  g.fillStyle = '#4a3020'; g.fillRect(0, 0, w, h); const n = 8, c = w / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = i * c + c / 2, y = j * c + c / 2; g.fillStyle = '#1a120c'; g.fillRect(i * c + 3, j * c + 3, c - 6, c - 6);
    if (rr() < 0.12) continue; g.fillStyle = pick(['#14241a', '#1c2b18', '#20160f', '#26301c']); g.beginPath(); g.arc(x, y, c * 0.36, 0, 6.283); g.fill(); g.fillStyle = 'rgba(160,200,150,0.35)'; g.beginPath(); g.arc(x - 3, y - 4, c * 0.12, 0, 6.283); g.fill(); g.fillStyle = 'rgba(0,0,0,0.6)'; g.beginPath(); g.arc(x, y, c * 0.12, 0, 6.283); g.fill(); }
});
const caseTex = () => cvs(256, 256, (g, w, h) => { g.fillStyle = '#b99a6e'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(80,60,30,0.6)'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); } g.fillStyle = 'rgba(110,30,40,0.6)'; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) g.fillRect(i * w / 4 + 10, j * h / 4 + 22, w / 4 - 20, 8); });
const brushedTex = () => cvs(256, 256, (g, w, h) => { g.fillStyle = '#c9ced3'; g.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { g.fillStyle = rr() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.12)'; g.fillRect(rr() * w, 0, 1 + rr() * 2, h); } g.fillStyle = 'rgba(40,44,50,0.5)'; g.fillRect(0, h * 0.62, w, 3); g.fillRect(0, h * 0.2, w, 3); });
// signs: lettered panels (bg null: raised letters on the wall)
function sign(text, bg, fg, w = 512, h = 96, font = 'bold') {
  return cvs(w, h, (g) => { if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; let f = Math.round(h * 0.66); g.font = `${font} ${f}px serif`; while (g.measureText(text).width > w * 0.94 && f > 10) { f -= 2; g.font = `${font} ${f}px serif`; } g.fillText(text, w / 2, h / 2 + 2); });
}
const plane = (root, text, w, h, x, y, z, ry, o = {}) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: sign(text, o.bg === undefined ? '#16181c' : o.bg, o.fg || '#f2f2ee', o.pw, o.ph), transparent: o.bg === null, depthWrite: o.bg !== null })); m.position.set(x, y, z); m.rotation.y = ry; root.add(m); if (!o.lit) { glows.push(m.material); m.material.userData.c = 0xffffff; } return m; };

// ---------- furniture the map draws ----------
const ff = fn => fn[0] > 0 ? 'X' : fn[0] < 0 ? 'x' : fn[2] > 0 ? 'Z' : 'z';   // the world face letter of a piece's front
const furn = {
  tank() { }, dancer() { }, stool() { }, tspeaker() { },   // instanced or kit (scenery / load)
  barrels({ P, len, dep }) { for (const v of [0.12, dep - 0.2]) P('steelD', 0, len, v, v + 0.08, 0, 0.12); for (let u = 0.3; u < len; u += 1.5) P('steelD', u, u + 0.06, 0.12, dep - 0.12, 0.08, 0.13); },
  barreltable({ P, len, dep, h }) { P('oakL', -0.05, len + 0.05, -0.05, dep + 0.05, h - 0.04, h); },   // its barrel is instanced
  destemmer({ P, len, dep, h }) { for (const [u, v] of [[0.1, 0.1], [len - 0.2, 0.1], [0.1, dep - 0.2], [len - 0.2, dep - 0.2]]) P('steelD', u, u + 0.1, v, v + 0.1, 0, 0.5); P('steelG', 0, len, 0.2, dep - 0.2, 0.5, h - 0.5); P('steelG', 0.3, len - 0.3, 0, dep, h - 0.5, h); P('grapes', 0.4, len - 0.4, 0.1, dep - 0.1, h - 0.06, h + 0.005, 'Y'); },
  sorttable({ P, len, dep, h }) { P('steelG', 0, len, 0, dep, h - 0.12, h - 0.04); P('beltM', 0.05, len - 0.05, 0.1, dep - 0.1, h - 0.04, h); P('grapes', 0.8, len - 1.2, 0.25, dep - 0.25, h, h + 0.04); for (const u of [0.1, len - 0.2]) for (const v of [0.05, dep - 0.15]) P('steelD', u, u + 0.1, v, v + 0.1, 0, h - 0.12); },
  bin({ P, len, dep, h }) { P('binM', 0, len, 0, dep, 0, h - 0.02, 'xXzZY'); P('grapes', 0.06, len - 0.06, 0.06, dep - 0.06, h - 0.02, h, 'Y'); },
  labbench({ P, len, dep, h }) { P('lacquer', 0.02, len - 0.02, 0, dep - 0.04, 0, h - 0.04); P('labtop', 0, len, 0, dep, h - 0.04, h); for (let u = 0.4; u < len - 0.3; u += 0.9 + rr()) P('glassware', u, u + 0.08, dep * 0.3, dep * 0.3 + 0.08, h, h + 0.18 + rr() * 0.1); },
  pump({ P, len, dep, h }) { P('steelD', 0, len, 0, dep, 0, 0.15); P('steelG', 0.15, len - 0.15, 0.2, dep - 0.2, 0.15, h); P('redM', 0.3, len - 0.3, 0.3, dep - 0.3, h - 0.25, h + 0.02); },
  wineshelf({ P, len, dep, h, fn }) { P('oakD', 0, len, 0, dep - 0.02, 0, h); P('rack', 0.04, len - 0.04, dep - 0.02, dep, 0.06, h - 0.06, ff(fn), 1); },
  display({ P, len, dep, h }) { P('oakD', 0, len, 0, dep, 0, h); for (let u = 0.15; u < len - 0.1; u += 0.22) P(u % 0.66 < 0.22 ? 'bottleR' : 'bottleW', u, u + 0.08, dep / 2 - 0.04, dep / 2 + 0.04, h, h + 0.32); },
  ttable({ P, len, dep, h }) { P('oakL', 0, len, 0, dep, h - 0.05, h); for (const u of [0.15, len - 0.25]) P('steelD', u, u + 0.1, 0.15, dep - 0.15, 0, h - 0.05); for (let u = 0.4; u < len - 0.3; u += 0.6) { P('glassware', u, u + 0.07, 0.25, 0.32, h, h + 0.17); P('glassware', u + 0.2, u + 0.27, dep - 0.32, dep - 0.25, h, h + 0.17); } P('bottleR', len / 2 - 0.04, len / 2 + 0.04, dep / 2 - 0.04, dep / 2 + 0.04, h, h + 0.32); },
  pallet({ P, len, dep, h }) { P('palletW', 0, len, 0, dep, 0, 0.14); P('cases', 0.03, len - 0.03, 0.03, dep - 0.03, 0.14, h, 'xXzZY', 1); P('wrap', -0.005, len + 0.005, -0.005, dep + 0.005, 0.3, h - 0.1, 'xXzZ', 1); },
  conveyor({ P, len, dep, h }) { for (let u = 0.2; u < len; u += 2) P('steelD', u, u + 0.08, 0.1, dep - 0.1, 0, h - 0.1); P('steelG', 0, len, 0, dep, h - 0.1, h - 0.03); P('beltM', 0.05, len - 0.05, 0.1, dep - 0.1, h - 0.03, h); for (let u = 0.3; u < len - 0.2; u += 0.3) P('bottleR', u, u + 0.08, dep / 2 - 0.04, dep / 2 + 0.04, h, h + 0.3); },
  filler({ P, len, dep, h }) { P('steelG', 0, len, 0, dep, 0, h * 0.55); P('glassM', 0.05, len - 0.05, 0.05, dep - 0.05, h * 0.55, h - 0.12, 'xXzZ'); P('steelD', 0, len, 0, dep, h - 0.12, h); },
  desk({ P, len, dep, h }) { P('oakD', 0, len, 0, dep, h - 0.04, h); P('oakD', 0, 0.05, 0, dep, 0, h - 0.04); P('oakD', len - 0.05, len, 0, dep, 0, h - 0.04); P('oakD', 0.05, len - 0.05, 0, 0.04, 0.3, h - 0.04); },   // its laptop is a kit
  safe({ P, len, dep, h, fn }) { P('steelD', 0, len, 0, dep, 0, h); P('chrome', len / 2 - 0.1, len / 2 + 0.1, dep, dep + 0.03, h / 2 - 0.1, h / 2 + 0.1, ff(fn)); },
  dtable({ P, len, dep, h }) {   // a table for four, laid: cloth, a candle, glasses; a chair each side
    P('linen', 0.1, len - 0.1, 0.45, dep - 0.45, h - 0.04, h); P('linen', 0.12, len - 0.12, 0.47, dep - 0.47, h - 0.3, h - 0.04, 'xXzZ'); P('steelD', len / 2 - 0.05, len / 2 + 0.05, dep / 2 - 0.05, dep / 2 + 0.05, 0, h - 0.3);
    P('glowW', len / 2 - 0.025, len / 2 + 0.025, dep / 2 - 0.025, dep / 2 + 0.025, h, h + 0.08); for (const u of [0.45, len - 0.55]) for (const v of [0.6, dep - 0.7]) P('glassware', u, u + 0.07, v, v + 0.07, h, h + 0.17);
    for (const u of [0.25, len - 0.7]) { P('chairM', u, u + 0.45, 0.05, 0.45, 0.42, 0.47); P('chairM', u, u + 0.45, 0.05, 0.1, 0.47, 0.95); P('chairM', u, u + 0.45, dep - 0.45, dep - 0.05, 0.42, 0.47); P('chairM', u, u + 0.45, dep - 0.1, dep - 0.05, 0.47, 0.95);
      for (const v of [0.07, 0.38, dep - 0.43, dep - 0.12]) for (const du of [0.02, 0.39]) P('steelD', u + du, u + du + 0.04, v, v + 0.04, 0, 0.42); } },
  stove({ P, len, dep, h }) { P('steelG', 0, len, 0, dep, 0, h - 0.04); P('steelD', 0, len, 0, dep, h - 0.04, h); for (const u of [0.3, len - 0.7]) for (const v of [0.4, dep - 0.8]) P('redM', u, u + 0.4, v, v + 0.4, h, h + 0.01, 'Y'); },
  boardtable({ P, len, dep, h }) { P('walnut', 0.5, len - 0.5, 0.6, dep - 0.6, h - 0.05, h); P('steelD', len / 2 - 0.6, len / 2 + 0.6, dep / 2 - 0.3, dep / 2 + 0.3, 0, h - 0.05);
    for (let u = 0.9; u < len - 0.8; u += 1.2) for (const v of [0.05, dep - 0.5]) { P('chairM', u, u + 0.5, v, v + 0.45, 0.45, 0.52); P('chairM', u, u + 0.5, v < 1 ? v : v + 0.38, v < 1 ? v + 0.07 : v + 0.45, 0.52, 1.0); P('steelD', u + 0.22, u + 0.28, v + 0.2, v + 0.26, 0, 0.45); } },
  djbooth({ P, len, dep, h, fn }) { P('stageblk', 0, len, 0, dep, 0, h - 0.06); P('led', 0.05, len - 0.05, dep, dep + 0.01, 0.12, 0.16, ff(fn)); P('led', 0.05, len - 0.05, dep, dep + 0.01, h - 0.24, h - 0.2, ff(fn)); },
  tbar({ P, len, dep, h, fn }) { P('corten', 0, len, 0, dep, 0, h - 0.05); P('stoneD', -0.03, len + 0.03, -0.03, dep + 0.06, h - 0.05, h); P('ledW', 0.05, len - 0.05, dep, dep + 0.008, h - 0.14, h - 0.1, ff(fn));
    for (let u = 0.3; u < len - 0.2; u += 0.55) P(rr() < 0.5 ? 'bottleR' : 'bottleW', u, u + 0.08, 0.15, 0.23, h, h + 0.32); },
  lounge({ P, len, dep, h }) { P('loungeB', 0, len, 0, dep, 0, 0.32); P('linen', 0.04, len - 0.04, 0.04, dep - 0.04, 0.32, 0.44); P('loungeB', 0, len, 0, 0.22, 0.32, h); P('loungeB', 0, 0.2, 0.22, dep, 0.32, 0.58); P('loungeB', len - 0.2, len, 0.22, dep, 0.32, 0.58); },
  ltable({ P, len, dep, h }) { P('oakL', 0, len, 0, dep, 0, h); P('glassware', 0.3, 0.37, 0.3, 0.37, h, h + 0.17); P('bottleR', 0.6, 0.68, 0.55, 0.63, h, h + 0.32); },
  hightable({ P, len, dep, h }) { P('chrome', len / 2 - 0.04, len / 2 + 0.04, dep / 2 - 0.04, dep / 2 + 0.04, 0, h - 0.04); P('oakL', 0, len, 0, dep, h - 0.04, h); P('chrome', 0.1, len - 0.1, 0.1, dep - 0.1, 0, 0.03); P('glassware', 0.2, 0.27, 0.3, 0.37, h, h + 0.17); },
  planter({ P, len, dep, h }) { P('corten', 0, len, 0, dep, 0, h); P('soil', 0.05, len - 0.05, 0.05, dep - 0.05, h - 0.06, h - 0.05, 'Y'); P('shrub', 0.12, len - 0.12, 0.12, dep - 0.12, h - 0.05, h + 0.45); P('shrub', 0.25, len - 0.25, 0.25, dep - 0.25, h + 0.45, h + 0.7); },
};
// ---------- the club's kits ----------
const KIT_NAMES = new Set(['bar', 'barcorner', 'barend', 'barstool', 'table', 'shelf', 'bench', 'djstand', 'speaker', 'screen', 'swivel', 'spot', 'ceilspeaker', 'lightbar', 'pole', 'steps', 'dancefloor', 'laptop']);
function kitPlacements() {
  const out = {}, put = (k, x, y, z, ry, sx = 1, sy = 1, sz = 1) => (out[k] = out[k] || []).push({ x, y, z, ry, sx, sy, sz });
  for (const f of FURNITURE) {
    const [fl, x0, z0, x1, z1, h, kind] = f, y = fl * H, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (kind === 'stool') put('barstool', cx, y, cz, rr() * 6.28, 1, h / 0.71, 1);
    else if (kind === 'tspeaker') put('speaker', cx, y, cz, Math.PI, (x1 - x0) / 1.3, h / 1.99, (z1 - z0) / 0.86);
    else if (kind === 'desk') { const face = f[7] || '+z', d = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] }[face], len = face[1] === 'z' ? x1 - x0 : z1 - z0, dep = face[1] === 'z' ? z1 - z0 : x1 - x0, ax = face[1] === 'z' ? [1, 0] : [0, 1];
      put('laptop', cx + ax[0] * (len * 0.5 - len / 2) + d[0] * (dep * 0.55 - dep / 2), y + h, cz + ax[1] * (len * 0.5 - len / 2) + d[1] * (dep * 0.55 - dep / 2), Math.atan2(-d[0], -d[1])); }
  }
  put('djstand', DJ.x, H, DJ.z - 0.35, Math.PI, 1.2, 1, 1);
  return out;
}
function placeKits(kitScene, root) {
  const by = {}; kitScene.traverse(o => { if (o.isMesh) { let n = o; while (n.parent && !KIT_NAMES.has(n.name)) n = n.parent; (by[n.name] = by[n.name] || []).push(o); } });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), g = new THREE.Group(); g.name = 'winerykit';
  for (const [k, list] of Object.entries(kitPlacements())) for (const src of by[k] || []) {
    const mt = src.material; mt.envMap = envMap; mt.userData.env = mt.envMapIntensity = 0.35; if (!pbrMats.includes(mt)) pbrMats.push(mt); if (mt.emissiveMap) { ledMats.push(mt); mt.userData.em = mt.emissive.clone(); }
    const im = new THREE.InstancedMesh(src.geometry, mt, list.length); im.castShadow = true; im.receiveShadow = true;
    list.forEach((t, i) => { e.set(0, t.ry, 0); q.setFromEuler(e); m4.compose(p.set(t.x, t.y, t.z), q, s.set(t.sx, t.sy, t.sz)); im.setMatrixAt(i, m4); });
    im.computeBoundingSphere(); g.add(im);
  }
  root.add(g); return g;
}
// ---------- the Andes: a range of snow peaks round the south and west, the bare precordillera in front of it ----------
function range(r0, a0, a1, hgt, snow, rock, base, n = 420) {
  const P = [], C = [], I = [], rows = 9, cx = (FOOT.x0 + FOOT.x1) / 2, cz = (FOOT.z0 + FOOT.z1) / 2, cr = new THREE.Color(rock), cs = new THREE.Color(snow), cb = new THREE.Color(base), c = new THREE.Color(), dk = new THREE.Color(0x000000);
  const ss = (e0, e1, v) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, h = hgt(a), sl = 0.38 + 0.12 * Math.sin(a * 23) * Math.sin(a * 7);
    for (let j = 0; j <= rows; j++) { const t = j / rows, y = -12 + (h + 12) * Math.pow(t, 0.8), r = r0 + 45 * t; P.push(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
      c.copy(cb).lerp(cr, Math.min(1, t * 1.8)).lerp(dk, 0.18 * (0.5 + 0.5 * Math.sin(a * 90 + j)));   // rock, with gullies
      if (snow) { const k = y / Math.max(1, h) + 0.1 * Math.sin(a * 61 + j * 1.7) + 0.07 * Math.sin(a * 133 + j); c.lerp(cs, ss(sl - 0.04, sl + 0.06, k) * (0.82 + 0.18 * Math.sin(a * 47 + j * 2.3))); }
      C.push(c.r, c.g, c.b); }
    if (i) for (let j = 0; j < rows; j++) { const p = (i - 1) * (rows + 1) + j, q = i * (rows + 1) + j; I.push(p, q, p + 1, p + 1, q, q + 1); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })); m.matrixAutoUpdate = false; return m;
}
const peaks = a => { let h = 105 + 34 * Math.sin(a * 3 + 1) + 22 * Math.sin(a * 7.3) + 14 * Math.sin(a * 17 + 2) + 7 * Math.sin(a * 41) + 4 * Math.sin(a * 97) + 3 * Math.sin(a * 173 + 1) + 1.5 * Math.sin(a * 290);
  for (const [c, w, ht] of [[3.3, 0.06, 110], [2.55, 0.05, 70], [2.05, 0.07, 60], [3.75, 0.05, 55], [1.6, 0.05, 45], [2.9, 0.04, 40]]) h += ht * Math.exp(-(((a - c) / w) ** 2)); return Math.max(40, h); };
const hills = a => Math.max(4, 10 + 5 * Math.sin(a * 9 + 0.5) + 3 * Math.sin(a * 23) + 2 * Math.sin(a * 51));
// tint of each range (multiplies its vertex colours) by time of day, power and night vision
const TINT = { dusk: [0xffd0c0, 0xe0b8a8], night: [0x55637e, 0x2c3242] };

export default {
  get env() { return tod === 'night' ? NIGHT : DUSK; },
  envs: { dusk: DUSK, night: NIGHT },
  setTod(t) { tod = t === 'night' ? 'night' : 'dusk'; },
  load() {
    setVenueMusic('sfx/club_music.blx', true);
    const kit = new Promise(res => new ObfLoader().load('models/club/kit.glb', gl => res(placeKits(gl.scene, root0)), undefined, () => res(null)));
    // "Swat Van" by maregajavier (CC BY 4.0), as at the club: nose to the winery at the head of the drive, its light bar on its roof
    const van = new Promise(res => new ObfLoader().load('models/club/van.glb', gl => {
      const m = gl.scene; m.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(m), sz = bb.getSize(new THREE.Vector3()), long = sz.x > sz.z ? 'x' : 'z';
      const g = new THREE.Group(), k = 5.8 / Math.max(sz.x, sz.z); m.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); g.add(m);
      const o = new THREE.Group(); o.add(g); g.scale.setScalar(k); g.rotation.y = (long === 'x' ? Math.PI / 2 : 0) + VAN_TURN; o.position.set(VAN.x, 0, VAN.z);
      m.traverse(q => { if (q.isMesh) { q.castShadow = q.receiveShadow = true; const mt = q.material; mt.envMap = envMap; mt.userData.env = mt.envMapIntensity = 0.8; if (!pbrMats.includes(mt)) pbrMats.push(mt); } });
      root0.add(o); o.updateMatrixWorld(true);
      const v = new THREE.Vector3(), bins = new Map();
      o.traverse(q => { if (!q.isMesh) return; const P = q.geometry.attributes.position; for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(q.matrixWorld);
        if (Math.abs(v.x - VAN.x) > 0.45) continue; const kk = Math.round(v.z * 10); if (!(bins.get(kk) > v.y)) bins.set(kk, v.y); } });
      const hits = [...bins].sort((p, q) => q[0] - p[0]).map(([kk, y]) => [kk / 10, y]);
      const roofY = hits.length ? Math.max(...hits.map(q => q[1])) : 2.6, front = hits.find(q => q[1] > roofY - 0.35) || [VAN.z + 1.2, roofY];
      for (const b of beams) if (b.siren) { b.siren.position.set(VAN.x, roofY + 0.05, front[0] - 0.2); b.siren.visible = true; }
      res(null);
    }, undefined, () => res(null)));
    return Promise.all([kit, van, dancers ? dancers.load() : null]).then(() => new THREE.Group());
  },
  dispose() { setVenueMusic(null, false); dancers = null; bulbs = null; andes = []; sunGlow = null; },
  noshade: { glowW: 1, led: 1, ledW: 1, bulb: 1 },
  noCast: ['concrete', 'stoneF', 'oak', 'labtile', 'epoxy', 'tileK', 'carpetG', 'cellar', 'steelfloor', 'rows', 'gravel', 'dirt', 'plain', 'paverT', 'paverP', 'trunks', 'stairTop'],
  tread: 'stairTop',
  outer: w => { const cx = (w.x0 + w.x1) / 2; return cx <= WEST.x1 + 0.15 || cx >= EAST.x0 - 0.15 ? 'pirca' : w.f === 1 ? 'corten' : 'ochre'; },
  inner: () => 'concW',
  innerAt: (f, x, z) => {
    let r = ''; for (const q of ROOMS) if (q[0] === f && x >= q[2] && x <= q[4] && z >= q[3] && z <= q[5]) { r = q[1]; break; }
    if (/Laboratory|Sample|Kitchen/.test(r)) return 'tileW';
    if (/Barrel/.test(r)) return 'pirca';
    if (/shop|Reception|Tasting|Gallery|Restaurant/.test(r)) return 'ochreIn';
    if (/office|Boardroom|Private|corridor/.test(r)) return 'officeW';
    return 'concW';
  },
  door: d => d.exterior ? 'steelDoor' : 'door',
  furn,
  mats(M) {
    if (M.pirca) return;
    const S = (t, gl) => sheen({ map: t }, gl);
    Object.assign(M, {
      pirca: S(pircaTex(), 'stone'), ochre: S(ochreTex(), 'stone'), ochreIn: S(ochreTex('#d9c39a'), 'matte'), corten: S(cortenTex(), 'stone'),
      concrete: M.concrete || S(tex('#8d8a84', 4000, grid(2, 2, 'rgba(40,38,34,0.35)')), 'stone'), concW: S(tex('#a8a49c', 1500, grid(1, 4, 'rgba(0,0,0,0.08)')), 'matte'),
      stoneF: S(tex('#a89c88', 3000, grid(2, 2, 'rgba(60,50,40,0.4)')), 'satin'), oak: M.oak || S(tex('#7a5638', 6000, grid(8, 1, 'rgba(40,25,12,0.3)')), 'satin'),
      labtile: S(tex('#dfe2e2', 1500, grid(6, 6, 'rgba(80,90,95,0.35)')), 'polished'), epoxy: S(tex('#6f7a74', 3000), 'polished'), tileK: M.tileK || S(tex('#c9cdd0', 2000, grid(4, 4, 'rgba(60,64,68,0.4)')), 'polished'),
      carpetG: M.carpetG || S(tex('#56544f', 6000, grid(6, 6, 'rgba(255,255,255,0.05)')), 'cloth'), cellar: S(tex('#5e5246', 6000, grid(2, 2, 'rgba(30,24,18,0.45)')), 'stone'),
      steelfloor: M.steelfloor || S(tex('#6c7076', 2000, grid(8, 8, 'rgba(20,20,20,0.35)', true, 0.1)), 'metal'), tileW: S(tex('#e8ebec', 600, grid(6, 6, 'rgba(90,96,100,0.35)')), 'polished'),
      officeW: S(tex('#d8d0c2', 300), 'satin'), stairTop: S(tex('#b9ab90', 2500, grid(1, 1, 'rgba(80,70,55,0.3)')), 'stone'),
      paverT: S(paverTex(), 'stone'), paverP: S(paverTex(), 'stone'), gravel: S(tex('#a7957a', 9000), 'matte'), dirt: S(tex('#9a8060', 7000, grid(1, 8, 'rgba(70,50,30,0.15)')), 'matte'),
      rows: S(rowsTex(), 'matte'), plain: S(tex('#8c7a5e', 5000), 'matte'),
      oakD: S(tex('#4a3322', 3000, grid(8, 1, 'rgba(0,0,0,0.25)')), 'satin'), oakL: S(tex('#9a7048', 3000, grid(8, 1, 'rgba(60,30,10,0.25)')), 'satin'),
      chrome: M.chrome || sheen({ color: 0xc0c5cc }, 'metal'), steelG: sheen({ map: brushedTex() }, 'metal'), steelD: sheen({ color: 0x3a3f45 }, 'metal'), steelDoor: sheen({ color: 0x4a4f55 }, 'metal'),
      stageblk: S(tex('#151517', 300), 'matte'), stoneD: S(tex('#2a2c30', 200), 'polished'), labtop: S(tex('#2b2f33', 300), 'polished'),
      rack: S(rackTex(), 'satin'), cases: S(caseTex(), 'matte'), palletW: S(tex('#b8956a', 600, grid(6, 1, 'rgba(60,40,20,0.5)')), 'matte'),
      wrap: sheen({ color: 0xdfe6ea, transparent: true, opacity: 0.25, depthWrite: false }, 'glass'), glassM: sheen({ color: 0x8aa0a8, transparent: true, opacity: 0.3, depthWrite: false }, 'glass'),
      glassware: sheen({ color: 0xd8e4ea, transparent: true, opacity: 0.45, depthWrite: false }, 'glass'), bottleR: sheen({ color: 0x2a0d12 }, 'glass'), bottleW: sheen({ color: 0x2c3a1c }, 'glass'),
      grapes: S(tex('#3a1a3a', 3000, null), 'satin'), binM: sheen({ color: 0x2e5a8a }, 'paint'), beltM: S(tex('#1e1f21', 800), 'matte'), redM: sheen({ color: 0x9a2a22 }, 'paint'),
      chairM: S(tex('#3a3530', 400), 'satin'), loungeB: S(tex('#222326', 800), 'cloth'), soil: S(tex('#3a2c20', 2000), 'matte'), shrub: S(tex('#5d6e46', 4000), 'matte'),
      glassrail: sheen({ color: 0x3a4a58, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }, 'glass'),
    });
    const alpha = (t, extra = {}) => { const m = new THREE.MeshLambertMaterial(Object.assign({ map: t, alphaTest: 0.45, side: THREE.DoubleSide }, extra)); return m; };
    M.leaf = alpha(leafTex()); M.trunks = alpha(trunkTex()); M.poplar = alpha(poplarTex()); M.pampas = alpha(pampasTex(), { alphaTest: 0.3 });
    const glow = (k, c) => { M[k] = new THREE.MeshBasicMaterial({ color: c }); M[k].userData.c = c; matGlows.push(M[k]); };
    glow('glowW', 0xffe0a8); glow('ledW', 0xffd9a0);
    M.led = new THREE.MeshBasicMaterial({ color: 0xff7a30 });
    M.bulb = new THREE.MeshBasicMaterial({ color: 0xffd890 }); M.bulb.userData.c = 0xffd890; matGlows.push(M.bulb);
  },
  look(night, nvg) {
    const T = TINT[tod]; andes.forEach((m, i) => m.material.color.set(nvg ? (tod === 'night' ? 0x0a2a10 : 0x3a8a44) : T[i]));   // (the power cut is the building's: the range keeps its light)
    if (sunGlow) sunGlow.visible = tod !== 'night' && !nvg;
    for (const m of [...glows, ...matGlows]) m.color.set(nvg ? (night ? 0x0c3a12 : 0x9cff9c) : night ? 0x14110c : m.userData.c);
  },
  scenery({ b, root, hills: far, level, MATS }) {
    glows = []; seed = 13; beams = []; ledMats = []; root0 = root; andes = []; mix = { g: -1, c: -1 };
    const B = (m, x0, x1, y0, y1, z0, z1, f = 'xXyYzZ', s = 1) => b(m).box(x0, x1, y0, y1, z0, z1, f, s);
    const flat = (m, x0, x1, z0, z1, y = 0, s = 0.25) => b(m).quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], s);
    const UVQ = [[0, 0], [1, 0], [1, 1], [0, 1]];
    // ---- the ground: the plain all round, the vineyards' floor, the plaza and the yard behind, the drive, a paved path to the door ----
    flat('plain', -700, 700, -700, 700, -0.02, 0.05);
    flat('rows', -150, 230, -200, 230, 0.002, 1 / ROW_DX);
    flat('gravel', PLAZA.x0, PLAZA.x1, PLAZA.z0, PLAZA.z1, 0.006, 0.3);
    flat('dirt', DRIVE.x0, DRIVE.x1, -200, PLAZA.z0, 0.008, 0.25);
    flat('paverP', DRIVE.x0, DRIVE.x1, PLAZA.z0, -3, 0.01, 0.25);
    // ---- the vines: each row a strip of foliage on a line of trunks; those in the yard are also the map's solid rows, the rest run
    // out to the poplars and the hills (merged: a few draw calls for the whole estate) ----
    const vine = (x, z0, z1) => { const cw = 0.3, y0 = 0.75, y1 = 1.7, s = 1 / 1.2;
      b('leaf').quad([x - cw, y1, z0], [x + cw, y1, z0], [x + cw, y1, z1], [x - cw, y1, z1], [0, 1, 0], s);
      b('leaf').quad([x - cw, y0, z0], [x - cw, y0, z1], [x - cw, y1, z1], [x - cw, y1, z0], [-1, 0, 0], s); b('leaf').quad([x + cw, y0, z0], [x + cw, y0, z1], [x + cw, y1, z1], [x + cw, y1, z0], [1, 0, 0], s);
      b('leaf').quad([x - cw, y0, z0], [x + cw, y0, z0], [x + cw, y1, z0], [x - cw, y1, z0], [0, 0, -1], s); b('leaf').quad([x - cw, y0, z1], [x + cw, y0, z1], [x + cw, y1, z1], [x - cw, y1, z1], [0, 0, 1], s);
      b('trunks').quad([x, 0, z0], [x, 0, z1], [x, 0.85, z1], [x, 0.85, z0], [1, 0, 0], 1 / 1.2); };
    for (const [x, z0, z1] of vineRows()) vine(x, z0, z1);
    for (let x = -148.5; x < 229; x += ROW_DX) for (let z = -76; z < 228; z += 64) { const z1 = z + 60, inY = x > YARD.x0 - 1 && x < YARD.x1 + 1; if (x > DRIVE.x0 - 2 && x < DRIVE.x1 + 2) continue;
      if (!inY) vine(x, z, z1); else { if (z < YARD.z0) vine(x, z, Math.min(z1, YARD.z0 - 1.5)); if (z1 > YARD.z1) vine(x, Math.max(z, YARD.z1 + 1.5), z1); } }
    // poplar windbreaks: north, beyond the drive's end, and along the east and west of the estate (none south: the view)
    const poplar = (x, z, ht) => { const w = ht * 0.2; b('poplar').quad([x - w, 0, z], [x + w, 0, z], [x + w, ht, z], [x - w, ht, z], [0, 0, 1], 1, UVQ); b('poplar').quad([x, 0, z - w], [x, 0, z + w], [x, ht, z + w], [x, ht, z - w], [1, 0, 0], 1, UVQ); };
    for (let x = -150; x < 230; x += 3.2 + rr() * 1.5) poplar(x, -80 - rr() * 2, 16 + rr() * 6);
    for (let z = -76; z < 120; z += 3.2 + rr() * 1.5) { poplar(-152 - rr() * 2, z, 16 + rr() * 6); poplar(232 + rr() * 2, z, 16 + rr() * 6); }
    // pampas grass along the front of the wings and round the plaza's edges, as at the real bodegas
    const tuft = (x, z, ht) => { const w = ht * 0.55; b('pampas').quad([x - w, 0, z], [x + w, 0, z], [x + w, ht, z], [x - w, ht, z], [0, 0, 1], 1, UVQ); b('pampas').quad([x, 0, z - w], [x, 0, z + w], [x, ht, z + w], [x, ht, z - w], [1, 0, 0], 1, UVQ); };
    for (let x = 0.8; x < 25; x += 1.6 + rr()) tuft(x, -1.2 - rr() * 0.8, 1.4 + rr() * 0.7);
    for (let x = 59; x < 83.5; x += 1.6 + rr()) { if (x > 81.5) break; tuft(x, -1.2 - rr() * 0.8, 1.4 + rr() * 0.7); }
    for (let x = PLAZA.x0 + 1; x < PLAZA.x1 - 1; x += 2.2 + rr() * 2) { if (x > DRIVE.x0 - 2 && x < DRIVE.x1 + 2) continue; tuft(x, PLAZA.z0 + 0.6 + rr() * 0.5, 1.3 + rr() * 0.8); }
    // ---- the building: the wings' stone carried up past their roofs (parapets: the wings read as solid stone masses) ----
    for (const [x0, x1] of [[WEST.x0, WEST.x1], [EAST.x0, EAST.x1]]) B('pirca', x0 - 0.1, x1 + 0.1, 2 * H, 2 * H + 1.6, FOOT.z0 - 0.1, FOOT.z1 + 0.1, 'xXYzZ');
    // concrete courses through the stone (as the real walls have): one at 3 m on the wings' outer three sides, one at 6.5 m and a
    // coping on all four
    for (const [x0, x1, outX] of [[WEST.x0, WEST.x1, 'x'], [EAST.x0, EAST.x1, 'X']]) { const o = 0.16, band = (y0, y1, sides) => { const a = x0 - o, c = x1 + o, z0 = FOOT.z0 - o, z1 = FOOT.z1 + o;
        if (sides.includes('z')) B('ochre', a, c, y0, y1, z0, z0 + 0.06, 'yYzxX'); if (sides.includes('Z')) B('ochre', a, c, y0, y1, z1 - 0.06, z1, 'yYZxX');
        if (sides.includes('x')) B('ochre', a, a + 0.06, y0, y1, z0, z1, 'yYx'); if (sides.includes('X')) B('ochre', c - 0.06, c, y0, y1, z0, z1, 'yYX'); };
      band(2.9, 3.08, 'zZ' + outX); band(6.4, 6.58, 'zZxX'); band(2 * H + 1.6, 2 * H + 1.75, 'zZxX'); B('ochre', x0 - 0.16, x1 + 0.16, 2 * H + 1.6, 2 * H + 1.75, FOOT.z0 - 0.16, FOOT.z1 + 0.16, 'Y'); }
    B('ochre', TERR.x0, TERR.x1, H - 0.4, H, FOOT.z1 + 0.1, FOOT.z1 + 0.25, 'yZ'); B('ochre', TERR.x0, TERR.x1, H - 0.4, H, FOOT.z0 - 0.25, FOOT.z0 - 0.1, 'yz');   // slab edges
    // the terrace floor: pavers, round the pavilion
    { const y = H + 0.004, t = TERR, p = PAV; for (const [a, c, e, g] of [[t.x0, t.z0, t.x1, p.z0], [t.x0, p.z1, t.x1, t.z1], [t.x0, p.z0, p.x0, p.z1], [p.x1, p.z0, t.x1, p.z1]]) b('paverT').quad([a, y, c], [e, y, c], [e, y, g], [a, y, g], [0, 1, 0], 0.25); }
    // the pavilion: its corten band over the glass, outside and in, and the roof's edge
    { const p = PAV, y0 = 2 * H - 1.1, y1 = 2 * H + 0.5; B('corten', p.x0 - 0.12, p.x1 + 0.12, y0, y1, p.z0 - 0.12, p.z1 + 0.12, 'xXyYzZ');
      const e = 0.02, iq = (a, c, d, f2, n) => b('ochreIn').quad(a, c, d, f2, n, 0.5);
      iq([p.x0 + e, y0, p.z0], [p.x0 + e, y0, p.z1], [p.x0 + e, 2 * H, p.z1], [p.x0 + e, 2 * H, p.z0], [1, 0, 0]); iq([p.x0, y0, p.z0 + e], [p.x1, y0, p.z0 + e], [p.x1, 2 * H, p.z0 + e], [p.x0, 2 * H, p.z0 + e], [0, 0, 1]);
      iq([p.x0, y0, p.z1 - e], [p.x1, y0, p.z1 - e], [p.x1, 2 * H, p.z1 - e], [p.x0, 2 * H, p.z1 - e], [0, 0, -1]); }
    // the open stairs: each tread a block down to the ground, the stepped walls beside them, the landings
    for (const fl of FLIGHTS) { const n = 22, w = (fl.x1 - fl.x0) / n;
      for (let i = 0; i < n; i++) { const xa = fl.x0 + i * w, xc = xa + w, top = Math.max(flightY(fl, xa + 0.001), flightY(fl, xc - 0.001)) - (fl.up < 0 ? (i === 0 ? 0 : 0) : 0), y = H * (fl.up < 0 ? n - i : i + 1) / n;
        B('stairTop', xa, xc, y - 0.04, y, fl.z0, fl.z1, 'Y'); B('ochre', xa, xc, 0, y - 0.04, fl.z0, fl.z1, fl.up < 0 ? 'X' : 'x'); void top; } }
    for (const ld of LANDINGS) B('stairTop', ld.x0, ld.x1, H - 0.04, H, ld.z0, ld.z1 - 0.1, 'Y');
    for (const w of level.boxes) {
      if (w.kind === 'fence' && w.sub === 'stairwall') B('ochre', w.x0, w.x1, w.y0, w.y1, w.z0, w.z1, 'xXYzZ');
      else if (w.kind === 'fence' && w.sub === 'stonepar') B('ochre', w.x0, w.x1, w.y0, w.y1, w.z0, w.z1, 'xXYzZ');
      else if (w.kind === 'fence' && w.sub === 'glassrail') { B('glassrail', w.x0, w.x1, w.y0 + 0.05, w.y1 - 0.06, w.z0, w.z1, 'xXzZ'); B('chrome', w.x0 - 0.01, w.x1 + 0.01, w.y1 - 0.06, w.y1, w.z0 - 0.02, w.z1 + 0.02, 'xXYzZ'); }
      else if (w.kind === 'van') { const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.22), new THREE.MeshBasicMaterial({ color: 0x3060ff })); bar.position.set((w.x0 + w.x1) / 2, w.y1 + 0.05, w.z1 - 1.2); bar.visible = false; root.add(bar); beams.push({ siren: bar }); }
    }
    // ---- the name: raised letters on the corten band and on the ochre wall by the door; signs inside ----
    plane(root, 'BODEGA  NOVENA', 8, 0.8, (PAV.x0 + PAV.x1) / 2, 2 * H - 0.3, PAV.z0 - 0.135, Math.PI, { bg: null, fg: '#e8d8b4', pw: 1024, ph: 104 });
    plane(root, 'BODEGA NOVENA', 2.8, 0.36, 42, 3.4, -0.115, Math.PI, { bg: null, fg: '#4a3a24', pw: 768, ph: 98 });
    plane(root, 'LUJÁN DE CUYO · MENDOZA', 2.8, 0.18, 42, 3.05, -0.115, Math.PI, { bg: null, fg: '#4a3a24', pw: 768, ph: 52 });
    plane(root, 'CAVA', 1.2, 0.3, 42, 3.0, 12.88, Math.PI, { bg: '#2a2018', fg: '#d8c08a' }); plane(root, 'TIENDA', 1.2, 0.3, 31, 2.6, 9.88, Math.PI, { bg: '#2a2018', fg: '#d8c08a' });
    plane(root, 'DEGUSTACIÓN', 1.6, 0.3, 53.6, 2.6, 9.88, Math.PI, { bg: '#2a2018', fg: '#d8c08a' }); plane(root, 'FRACCIONAMIENTO', 2.2, 0.32, 63, 3.2, 13.88, Math.PI, { bg: '#16181c', fg: '#ffd23a' });
    plane(root, 'SALIDA', 0.9, 0.26, 12.6, 2.6, 33.88, Math.PI, { bg: '#0f6b2c' }); plane(root, 'SALIDA', 0.9, 0.26, 70.6, 2.6, 33.88, Math.PI, { bg: '#0f6b2c' }); plane(root, 'GERENCIA', 1.2, 0.26, 73.88, H + 2.5, 4.6, -Math.PI / 2, { bg: '#16181c', fg: '#d8c08a' });
    // ---- the steel tanks and the barrels (instanced) ----
    { const tanks = FURNITURE.filter(f => f[6] === 'tank'), mt = MATS.steelG, legM = MATS.steelD, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
      const body = new THREE.CylinderGeometry(1.22, 1.22, 4.8, 28), top = new THREE.ConeGeometry(1.22, 0.7, 28), bot = new THREE.ConeGeometry(1.22, 0.3, 28), leg = new THREE.BoxGeometry(0.1, 0.6, 0.1), hatch = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16);
      bot.rotateX(Math.PI); hatch.rotateX(Math.PI / 2);
      const im = (geo, m, n) => { const x = new THREE.InstancedMesh(geo, m, n); x.castShadow = x.receiveShadow = true; root.add(x); return x; };
      const B1 = im(body, mt, tanks.length), T1 = im(top, mt, tanks.length), Bo = im(bot, mt, tanks.length), L1 = im(leg, legM, tanks.length * 4), Ha = im(hatch, legM, tanks.length);
      tanks.forEach((f, i) => { const cx = (f[1] + f[3]) / 2, cz = (f[2] + f[4]) / 2; B1.setMatrixAt(i, m4.compose(p.set(cx, 3.4, cz), q, s1)); T1.setMatrixAt(i, m4.compose(p.set(cx, 6.15, cz), q, s1)); Bo.setMatrixAt(i, m4.compose(p.set(cx, 0.85, cz), q, s1));
        Ha.setMatrixAt(i, m4.compose(p.set(cx, 1.4, cz - 1.24), q, s1)); [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].forEach(([dx, dz], k) => L1.setMatrixAt(i * 4 + k, m4.compose(p.set(cx + dx, 0.35, cz + dz), q, s1))); });
      // barrels: on their sides two high in the racks (their heads to the aisle), upright under the barrel tables
      const geo = new THREE.CylinderGeometry(0.33, 0.33, 0.95, 12, 4), P = geo.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i), k = 1 + 0.13 * (1 - (2 * y / 0.95) ** 2); P.setX(i, P.getX(i) * k); P.setZ(i, P.getZ(i) * k); } geo.computeVertexNormals();
      const side = sheen({ map: barrelTex() }, 'satin'), head = sheen({ map: barrelHeadTex() }, 'satin'), list = [];
      for (const f of FURNITURE) { if (f[6] === 'barrels') { const len = f[3] - f[1], n = Math.floor(len / 0.76), cz = (f[2] + f[4]) / 2; for (let i = 0; i < n; i++) for (const y of [0.5, 1.2]) list.push([f[1] + (i + 0.5) * len / n, y, cz, Math.PI / 2]); }
        else if (f[6] === 'barreltable') list.push([(f[1] + f[3]) / 2, 0.475, (f[2] + f[4]) / 2, 0]); }
      const BR = new THREE.InstancedMesh(geo, [side, head, head], list.length); BR.castShadow = BR.receiveShadow = true; const e = new THREE.Euler();
      list.forEach(([x, y, z, rx], i) => { e.set(rx, 0, 0); q.setFromEuler(e); BR.setMatrixAt(i, m4.compose(p.set(x, y, z), q, s1)); }); root.add(BR); }
    // ---- the party's string lights: from the pavilion's band out to poles at the south rail ----
    { const poles = [32, 36, 40, 44.6, 48, 52], pts = [], wire = [];
      for (const x of poles) { B('steelD', x - 0.05, x + 0.05, H, H + 4.0, 33.6, 33.7, 'xXzZY'); const a = new THREE.Vector3(x, 2 * H - 0.9, PAV.z1 + 0.15), c = new THREE.Vector3(x, H + 3.95, 33.6);
        for (let i = 0; i <= 24; i++) { const t = i / 24, v = a.clone().lerp(c, t); v.y -= Math.sin(t * Math.PI) * 1.1; wire.push(v); if (i % 2 === 0) pts.push(v.clone().setY(v.y - 0.06)); } }
      for (const z of [17, 22, 27]) { const a = new THREE.Vector3(26.15, H + 3.6, z), c = new THREE.Vector3(57.85, H + 3.6, z); for (let i = 0; i <= 40; i++) { const t = i / 40, v = a.clone().lerp(c, t); v.y -= Math.sin(t * Math.PI) * 0.9; if (i % 2 === 0) pts.push(v.clone().setY(v.y - 0.06)); } }
      bulbs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.055, 0), MATS.bulb, pts.length); const m4 = new THREE.Matrix4(); pts.forEach((v, i) => bulbs.setMatrixAt(i, m4.makeTranslation(v.x, v.y, v.z))); bulbs.castShadow = false; root.add(bulbs);
      const lg = new THREE.BufferGeometry(), arr = []; for (let k = 0; k < poles.length; k++) for (let i = 0; i < 24; i++) { const a = wire[k * 25 + i], c = wire[k * 25 + i + 1]; arr.push(a.x, a.y, a.z, c.x, c.y, c.z); }
      lg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); root.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x1a1a1a }))); }
    // the DJ's decks: a lettered plate on the booth's front
    plane(root, 'NOVENA SUNSET SESSIONS', 3.0, 0.32, DJ.x, H + 0.62, 31.6 - 0.015, Math.PI, { bg: '#111114', fg: '#ffb46a', pw: 768, ph: 82, lit: true });
    // ---- the Andes and the precordillera round the south and west; the low sun's glow over the range at dusk ----
    { const A = range(400, 0.3 * Math.PI, 1.3 * Math.PI, peaks, 0xffffff, 0x6e6472, 0x8e8690), F = range(250, 0.28 * Math.PI, 1.32 * Math.PI, hills, null, 0x5a4a3e, 0x766450);
      far.add(A, F); andes = [A, F];
      const gc = cvs(256, 256, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.12, 'rgba(255,200,130,0.85)'); gr.addColorStop(0.4, 'rgba(255,150,90,0.3)'); gr.addColorStop(1, 'rgba(255,120,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
      const d = new THREE.Vector3(DUSK.sunFrom[0], 0, DUSK.sunFrom[2]).normalize(), cx = (FOOT.x0 + FOOT.x1) / 2, cz = (FOOT.z0 + FOOT.z1) / 2;
      sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: gc, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true })); sunGlow.position.set(cx + d.x * 580, 40, cz + d.z * 580); sunGlow.scale.set(260, 260, 1); far.add(sunGlow); }
    dancers = makeDancers(root, { dancers: DANCERS, dj: DJ, djY: H + 0.47, H });
  },
  tick(dt, { head }) {
    const p = head.pos, t = performance.now() / 1000;
    // the music: loud on the terrace (louder near the decks), muffled in the pavilion and through the building, carried on the air outside
    const up = p.y > H - 0.6, dj = Math.hypot(p.x - DJ.x, p.z - DJ.z);
    let g, c; if (up && onTerrace(p.x, p.z)) { g = Math.max(0.55, 0.95 - dj * 0.012); c = 16000; } else if (up && inPav(p.x, p.z)) { g = 0.45; c = 1600; } else if (inFoot(p.x, p.z)) { g = up ? 0.28 : 0.2; c = up ? 500 : 280; }
    else { g = Math.max(0.1, 0.5 - dj * 0.006); c = 2200; }
    if (Math.abs(g - mix.g) > 0.01 || Math.abs(c - mix.c) > 5) { mix = { g, c }; setVenueMix(g, c); }
    for (const bm of beams) if (bm.siren) bm.siren.material.color.set(Math.floor(t * 3) % 2 ? 0x3060ff : 0xff2020);
    const lv = venueLevel(); for (const m of ledMats) m.emissive.copy(m.userData.em).multiplyScalar(0.6 + lv * 0.8);
    if (dancers) dancers.tick(dt, p);
  },
};
