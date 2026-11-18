// Casino scenery: THE ASTERION, an invented Strip resort. A curved blue-glass hotel tower behind, the sky-suite wing over a white
// podium, a white ribbed porte-cochere at the front, palms, the boulevard and a skyline. Inside: navy patterned carpet with white
// marble paths, a white ceiling of swirling lit coves on fluted ring-lit columns, the round lounge bar under a crystal chandelier,
// slots and table games, a gold high-limit room, the barred cashier cage and a live CCTV wall in the security office.
// The helicopter hovers over the wing roof until the squad is off it, then flies away. Looks: dusk and night.
import * as THREE from '../../vendor/three.module.min.js';
import { sheen, tex, grid, envMap, pbrMats } from '../mats.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { setRotor } from '../audio.js';
import { H, FOOT, WING, MAIN, F3, ROOF, POD, HELI, SHAFT, CAR, CANOPY, WINX, COLUMNS, ROPES, inHeli, FLY, LIFT, ARC, arcPt } from '../core/maps/casino.js';

let MATS_SLOT = null, tod = 'dusk', signs = [], glows = [], heli = null, cctv = null, towerM = null, skyM = null, lifts = null, liftGlow = [], dark = false, inner = null;
const LAMPS = [[37, 5.6, 27, 16, 22], [22, 5.4, 32, 10, 16], [52, 5.4, 32, 10, 16], [37, 5.4, 43, 10, 15], [37, 5.4, 13, 9, 14], [7, 3.0, 20, 7, 13], [34, F3 + 3.0, 15, 6, 12], [36, 8.0, 66, 12, 22], [29, POD + 3.0, 13, 5, 9]];
const DUSK = {
  sky: [[0, '#151a3d'], [0.28, '#33336e'], [0.42, '#8c5585'], [0.475, '#ec8558'], [0.5, '#ffbf78'], [0.53, '#2a2330'], [1, '#18161d']], skyR: 430, moon: [130, 120, -150],
  fog: [0x3b3049], fogD: [0.0026, 0.006], sunAt: [36, 28], sunFrom: [-95, 30, 25], shadow: 70, sunCol: 0xff9e6c, sunK: 1.1, hemi: 1.05, hemiSky: 0xb6b0d6, hemiGround: 0x8a8079,
  hillColor: 0x1c1726, lamps: LAMPS,
};
const NIGHT = {
  sky: [[0, '#04050d'], [0.3, '#0c0e22'], [0.44, '#1d1a36'], [0.5, '#3a2a3e'], [0.53, '#161420'], [1, '#121018']], skyR: 430, moon: [-140, 130, -90],
  fog: [0x151425], fogD: [0.0032, 0.008], sunAt: [36, 28], sunFrom: [-40, 85, -60], shadow: 70, sunCol: 0xbac6ff, sunK: 0.85, hemi: 0.75, hemiSky: 0x7c86b8, hemiGround: 0x2e2a34,
  hillColor: 0x07070d, lamps: LAMPS,
};

// ---------- painted textures ----------
const cvs = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
let seed = 11; const rr = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const navyCarpet = (g, s) => {   // interlocking circles in pale blue, gold pips where they meet
  g.lineWidth = 3; g.strokeStyle = 'rgba(92,124,196,0.55)';
  for (const [x, y] of [[0, 0], [s, 0], [0, s], [s, s], [s / 2, s / 2]]) for (const r of [s * 0.5, s * 0.42]) { g.beginPath(); g.arc(x, y, r, 0, 6.283); g.stroke(); }
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(200,164,96,0.55)'; for (const [x, y] of [[s / 2, 0], [0, s / 2], [s, s / 2], [s / 2, s]]) { g.beginPath(); g.arc(x, y, s * 0.12, 0, 6.283); g.stroke(); }
  g.fillStyle = 'rgba(214,176,104,0.8)'; for (const [x, y] of [[s / 2, 0], [0, s / 2], [s, s / 2], [s / 2, s], [s / 2, s / 2]]) g.fillRect(x - 3, y - 3, 6, 6);
};
const goldCarpet = (g, s) => { g.strokeStyle = 'rgba(232,196,120,0.45)'; g.lineWidth = 3; for (let i = -1; i <= 2; i++) { g.beginPath(); g.moveTo(i * s / 2, 0); g.lineTo(i * s / 2 + s, s); g.stroke(); g.beginPath(); g.moveTo(i * s / 2 + s, 0); g.lineTo(i * s / 2, s); g.stroke(); } g.fillStyle = 'rgba(30,18,6,0.35)'; g.fillRect(s / 2 - 8, s / 2 - 8, 16, 16); };
const quilt = (g, s) => { for (let i = -2; i <= 6; i++) { g.strokeStyle = 'rgba(80,52,18,0.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(i * s / 4, 0); g.lineTo(i * s / 4 + s, s); g.stroke(); g.beginPath(); g.moveTo(i * s / 4 + s, 0); g.lineTo(i * s / 4, s); g.stroke(); g.strokeStyle = 'rgba(255,230,170,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(i * s / 4 + 3, 0); g.lineTo(i * s / 4 + s + 3, s); g.stroke(); } };
const veins = (g, s) => { for (let k = 0; k < 7; k++) { g.strokeStyle = `rgba(110,110,118,${0.12 + rr() * 0.2})`; g.lineWidth = 0.6 + rr() * 1.4; g.beginPath(); let x = rr() * s, y = 0; g.moveTo(x, y); while (y < s) { x += (rr() - 0.5) * 40; y += 12 + rr() * 30; g.lineTo(x, y); } g.stroke(); } g.strokeStyle = 'rgba(120,120,120,0.25)'; g.lineWidth = 2; g.strokeRect(0, 0, s, s); };
const waves = (g, s) => { for (let j = 0; j < 8; j++) { g.fillStyle = j % 2 ? '#f2efe6' : '#1d2b55'; g.beginPath(); g.moveTo(0, s); for (let x = 0; x <= s; x += 4) g.lineTo(x, j * s / 8 + Math.sin(x / s * 6.283 * 2) * 6); g.lineTo(s, s); g.closePath(); g.fill(); } };
const GAMES = [['COMET CASH', '#1b3d8f', '#ffd35a'], ['LUCKY LANTERN', '#8f1b25', '#ffd35a'], ['TIDE OF GOLD', '#0d5a6b', '#ffe38a'], ['MOON TEMPLE', '#3c1b6b', '#c9b8ff'],
  ['TRIPLE ORBIT', '#123b6b', '#7fe7ff'], ['JADE RIVER', '#155c38', '#b7ffcf'], ['SUNSET STACKS', '#9a4313', '#ffe0a0'], ['MIDNIGHT ACES', '#15151f', '#ff5a7a']];
const slotAtlas = () => cvs(1024, 512, (g) => {
  GAMES.forEach(([name, bg, fg], i) => { const x = (i % 4) * 256, y = (i >> 2) * 256, gr = g.createLinearGradient(0, y, 0, y + 256); gr.addColorStop(0, bg); gr.addColorStop(1, '#05060a'); g.fillStyle = gr; g.fillRect(x, y, 256, 256);
    g.fillStyle = fg; g.font = 'bold 28px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; let f = 28; while (g.measureText(name).width > 236 && f > 12) { f -= 2; g.font = `bold ${f}px sans-serif`; } g.fillText(name, x + 128, y + 34);
    for (let k = 0; k < 3; k++) { const rx = x + 22 + k * 74; g.fillStyle = '#f4f1ea'; g.fillRect(rx, y + 70, 64, 110); g.fillStyle = ['#c0202a', '#1a1a1a', '#d4a020'][(i + k) % 3]; g.font = 'bold 50px sans-serif'; g.fillText(['7', 'BAR', '◆'][(i * 2 + k) % 3], rx + 32, y + 125); }
    g.fillStyle = '#ffde6a'; g.font = 'bold 20px monospace'; g.fillText('CREDIT ' + (1000 + i * 731) % 9000, x + 128, y + 214); g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(x + 6, y + 6, 244, 244); });
});
// the reel symbols, one column of 8 (the screens' shader scrolls them while a machine spins)
const SYMS = [['7', '#c8202a'], ['BAR', '#1a1a1a'], ['\u25C6', '#1f5fd0'], ['\u2605', '#d4a020'], ['$', '#1d8a3a'], ['\u2663', '#1a1a1a'], ['\u2665', '#c8202a'], ['\u25CF', '#7a2ac0']];
const symStrip = () => cvs(128, 1024, (g) => { SYMS.forEach(([t, c], i) => { const y = i * 128; g.fillStyle = '#f6f2e8'; g.fillRect(0, y, 128, 128); g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, y + 122, 128, 6);
  g.fillStyle = c; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${t.length > 1 ? 46 : 84}px sans-serif`; g.fillText(t, 64, y + 68); }); });
// Slot screens come alive: the reels spin, slow down one after another and stop on new symbols; now and then a win flashes the
// screen and the marquee pulses. All of it in the shader (one material, no texture uploads), each machine on its own timing.
function slotScreenMat(atlas) {
  const sym = symStrip(); sym.wrapT = THREE.RepeatWrapping; sym.generateMipmaps = false; sym.minFilter = THREE.LinearFilter;   // no mip seams where the strip wraps
  const m = new THREE.ShaderMaterial({ uniforms: { map: { value: atlas }, sym: { value: sym }, time: { value: 0 }, tint: { value: new THREE.Color(0xffffff) } },
    vertexShader: `varying vec2 vUv; varying float vPh; void main() { vUv = uv; vPh = normal.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D map, sym; uniform float time; uniform vec3 tint; varying vec2 vUv; varying float vPh;
      float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
      void main() {
        float id = floor(vPh * 997.0 + 0.5), ph = id / 997.0;   // the machine's number (interpolation wobbles vPh by a hair; hashing that made speckles)
        vec2 lt = fract(vUv * vec2(4.0, 2.0)); float tile = floor(vUv.x * 4.0) + 4.0 * floor(vUv.y * 2.0);
        float px = lt.x * 256.0, py = (1.0 - lt.y) * 256.0;
        vec4 c = texture2D(map, vUv);
        float T = 7.0, t = time + ph * 61.0 + tile * 0.9, cyc = mod(t, T), n = floor(t / T);
        bool win = h1(n * 3.7 + id * 0.917) < 0.22; float doneT = 2.9;
        if (py > 70.0 && py < 180.0) { float k = floor((px - 22.0) / 74.0), rx = px - 22.0 - k * 74.0;
          if (k >= 0.0 && k < 3.0 && rx < 64.0) {
            float stopT = 1.6 + 0.55 * k, rem = max(0.0, stopT - cyc), sy = floor(h1(n * 7.1 + k * 1.3 + id * 0.173) * 8.0);
            if (win) sy = floor(h1(n * 5.3 + id * 0.291) * 8.0);
            float pos = sy - 0.5 + (py - 70.0) / 110.0 * 1.7 - 0.35 + rem * rem * 4.0 + rem * 9.0;
            vec4 s = texture2D(sym, vec2(rx / 64.0, 1.0 - fract(pos / 8.0)));
            float blur = clamp(rem * 2.0, 0.0, 1.0); c = mix(s, s * 0.7 + 0.25, blur * 0.6);
            if (abs((py - 70.0) / 110.0 - 0.5) < 0.012 && win && cyc > doneT) c = vec4(1.0, 0.85, 0.2, 1.0);
          } }
        if (py < 60.0) c.rgb *= 0.85 + 0.25 * (0.5 + 0.5 * sin(time * 2.6 + ph * 40.0));
        if (win && cyc > doneT && cyc < doneT + 2.5) { float f = 0.5 + 0.5 * sin((cyc - doneT) * 18.0); c.rgb = mix(c.rgb, c.rgb * 1.35 + vec3(0.12, 0.09, 0.0), f * 0.6);
          if (py > 196.0 && py < 232.0) c.rgb = mix(c.rgb, vec3(1.0, 0.86, 0.3), f); }
        gl_FragColor = vec4(c.rgb * tint, 1.0);
        #include <colorspace_fragment>
      }` });
  m.color = m.uniforms.tint.value;   // the power and night-vision look sets .color on every glowing material
  return m;
}
const rlayout = () => cvs(512, 160, (g, w, h) => { g.fillStyle = '#1e4a68'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f2efe6'; g.lineWidth = 2; const cw = (w - 40) / 12, ch = (h - 40) / 3;
  for (let i = 0; i < 12; i++) for (let j = 0; j < 3; j++) { const n = i * 3 + 3 - j; g.fillStyle = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n) ? '#a8202a' : '#141414'; g.fillRect(36 + i * cw + 3, 6 + j * ch + 3, cw - 6, ch - 6); g.strokeRect(36 + i * cw, 6 + j * ch, cw, ch); }
  g.fillStyle = '#1d7a3a'; g.fillRect(4, 6, 30, h - 40); g.strokeRect(4, 6, 30, h - 40); g.strokeRect(36, h - 32, w - 40, 26); });
const rwheel = () => cvs(256, 256, (g) => { for (let k = 0; k < 37; k++) { g.fillStyle = k === 0 ? '#1d7a3a' : k % 2 ? '#a8202a' : '#141414'; g.beginPath(); g.moveTo(128, 128); g.arc(128, 128, 126, k * 6.283 / 37, (k + 1) * 6.283 / 37); g.closePath(); g.fill(); } g.fillStyle = '#6b4a2a'; g.beginPath(); g.arc(128, 128, 70, 0, 6.283); g.fill(); g.fillStyle = '#d7b46a'; g.beginPath(); g.arc(128, 128, 18, 0, 6.283); g.fill(); });
const towerTex = (lit) => cvs(256, 256, (g, s) => {   // 8 x 8 windows; the lit version is the emissive map: a scatter of warm rooms
  if (!lit) { const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, '#3a6aa8'); gr.addColorStop(0.5, '#173c74'); gr.addColorStop(1, '#2a5590'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
  else { g.fillStyle = '#000'; g.fillRect(0, 0, s, s); }
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const x = i * 32, y = j * 32;
    if (!lit) { g.fillStyle = 'rgba(10,24,48,0.55)'; g.fillRect(x, y + 27, 32, 5); g.fillStyle = 'rgba(10,24,48,0.4)'; g.fillRect(x, y, 2, 32); g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + 3, y + 2, 12, 22); }
    else if (rr() < 0.2) { g.fillStyle = rr() < 0.8 ? 'rgba(255,214,150,0.9)' : 'rgba(190,210,255,0.8)'; g.fillRect(x + 3, y + 3, 27, 22); } }
});
const wingTex = () => cvs(128, 128, (g, s) => { const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#3f6da6'); gr.addColorStop(0.8, '#1f4478'); g.fillStyle = gr; g.fillRect(0, 0, s, s); g.fillStyle = '#16233a'; g.fillRect(0, s * 0.8, s, s * 0.2); g.fillStyle = 'rgba(10,20,40,0.6)'; g.fillRect(0, 0, 3, s); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(8, 6, 30, s * 0.7); });
const skyTex = () => cvs(128, 256, (g, w, h) => { g.fillStyle = '#0d0e14'; g.fillRect(0, 0, w, h); for (let y = 4; y < h; y += 8) for (let x = 3; x < w; x += 7) if (rr() < 0.38) { g.fillStyle = rr() < 0.75 ? '#c9a46a' : '#8fa6d0'; g.fillRect(x, y, 4, 4); } });

function sign(text, bg = '#16181c', fg = '#f2f2ee', w = 512, h = 96) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  let s = h * 0.6; g.font = 'bold ' + Math.round(s) + 'px serif'; while (g.measureText(text).width > w * 0.92 && s > 10) { s -= 2; g.font = 'bold ' + Math.round(s) + 'px serif'; }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.MeshBasicMaterial({ map: t, transparent: !bg }); m.userData.c = 0xffffff; signs.push(m); return m;
}
const plane = (root, text, w, h, x, y, z, ry, o = {}) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), sign(text, o.bg === undefined ? '#16181c' : o.bg, o.fg, o.pw, o.ph)); m.position.set(x, y, z); m.rotation.y = ry; root.add(m); return m; };

// ---------- curved pieces, for furniture (W = the piece's own frame) and scenery (identity) ----------
const ID = (u, v, y) => [u, y, v];
function curves(b, W = ID) {
  const P = (u, v, y) => W(u, v, y), nrm = (a, c) => { const x = a[0] - c[0], z = a[2] - c[2], l = Math.hypot(x, z) || 1; return [x / l, 0, z / l]; };
  return {
    fan(m, cu, cv, ru, rv, a0, a1, y, n = 16, down = false, uv = false) { const c = P(cu, cv, y);
      for (let i = 0; i < n; i++) { const t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n, p0 = P(cu + ru * Math.cos(t0), cv + rv * Math.sin(t0), y), p1 = P(cu + ru * Math.cos(t1), cv + rv * Math.sin(t1), y);
        b(m).quad(c, p0, p1, p1, [0, down ? -1 : 1, 0], 0.5, uv ? [[0.5, 0.5], [0.5 + 0.5 * Math.cos(t0), 0.5 + 0.5 * Math.sin(t0)], [0.5 + 0.5 * Math.cos(t1), 0.5 + 0.5 * Math.sin(t1)], [0.5 + 0.5 * Math.cos(t1), 0.5 + 0.5 * Math.sin(t1)]] : null); } },
    wall(m, cu, cv, ru, rv, a0, a1, y0, y1, n = 16, inward = false, s = 0.5) { const c = P(cu, cv, y0);
      for (let i = 0; i < n; i++) { const t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n, u0 = cu + ru * Math.cos(t0), v0 = cv + rv * Math.sin(t0), u1 = cu + ru * Math.cos(t1), v1 = cv + rv * Math.sin(t1);
        const a = P(u0, v0, y0), e = P(u1, v1, y0), nn = nrm(P((u0 + u1) / 2, (v0 + v1) / 2, y0), c); b(m).quad(a, e, P(u1, v1, y1), P(u0, v0, y1), inward ? nn.map(q => -q) : nn, s); } },
    ring(m, cu, cv, r0, r1, a0, a1, y, n = 16, down = false, k = 1) {   // flat annulus; k stretches it along v (an ellipse)
      for (let i = 0; i < n; i++) { const t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n, q = (r, t) => P(cu + r * Math.cos(t), cv + r * k * Math.sin(t), y);
        b(m).quad(q(r0, t0), q(r1, t0), q(r1, t1), q(r0, t1), [0, down ? -1 : 1, 0], 0.5); } },
    poly(m, pts, cu, cv, y0, y1, s = 0.5) { const c = P(cu, cv, y0);   // a closed prism side from local (u, v) points
      for (let i = 0; i < pts.length; i++) { const [u0, v0] = pts[i], [u1, v1] = pts[(i + 1) % pts.length]; b(m).quad(P(u0, v0, y0), P(u1, v1, y0), P(u1, v1, y1), P(u0, v0, y1), nrm(P((u0 + u1) / 2, (v0 + v1) / 2, y0), c), s); } },
  };
}
const hash = (a, b) => { let h = (Math.round(a * 10) * 374761393 + Math.round(b * 10) * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; };

// ---------- the casino's own furniture ----------
const furn = {
  slot({ P, b, W, len, dep, h, w, face }) {
    P('slotbody', 0.04, len - 0.04, 0.02, dep - 0.02, 0, 0.86); P('chrome', 0.02, len - 0.02, dep - 0.32, dep, 0.86, 0.95); P('slotbtn', 0.2, len - 0.2, dep - 0.24, dep - 0.08, 0.95, 0.955, 'Y');
    P('slotbody', 0.06, len - 0.06, 0.05, 0.42, 0.95, 1.8); P('slotgold', 0.06, len - 0.06, 0.05, 0.42, 1.8, h - 0.03, 'xXzZ'); P('slotbody', 0.05, len - 0.05, 0.04, 0.43, h - 0.03, h); P('chrome', 0.05, len - 0.05, 0.42, 0.46, 0.95, 1.8, 'xX');   /* bezel sides (its front face used to cover the screen) */
    const c = hash(w.x0, w.z0) % 8, u0 = (c % 4) / 4, u1 = u0 + 0.25, v0 = 1 - ((c >> 2) + 1) / 2, v1 = v0 + 0.5, mir = face === '-z' || face === '+x', L = mir ? u1 : u0, R = mir ? u0 : u1, vS = 0.425;
    b('slotscreen').quad(W(0.1, vS, 0.99), W(len - 0.1, vS, 0.99), W(len - 0.1, vS, 1.76), W(0.1, vS, 1.76), [W(0, 1, 0)[0] - W(0, 0, 0)[0], (hash(w.z0 * 7 + 3, w.x0 * 3 + 1) % 997) / 997, W(0, 1, 0)[2] - W(0, 0, 0)[2]], 1, [[L, v0], [R, v0], [R, v1], [L, v1]]);   // normal.y: this machine's phase for the reels
  },
  bj({ P, b, W, len, dep, h }) { const C = curves(b, W), cu = len / 2, ru = len / 2 - 0.04, rv = dep - 0.22;
    P('fascia', len * 0.38, len * 0.62, 0.3, 0.7, 0, h - 0.12); P('walnut', 0.05, len - 0.05, 0.04, 0.22, h - 0.12, h);
    C.fan('felt', cu, 0.2, ru - 0.14, rv - 0.14, 0, Math.PI, h - 0.03, 18); C.ring('leather', cu, 0.2, ru - 0.14, ru, 0, Math.PI, h, 18, false, rv / ru); C.wall('leather', cu, 0.2, ru, rv, 0, Math.PI, h - 0.12, h, 18);
    C.fan('walnut', cu, 0.2, ru, rv, 0, Math.PI, h - 0.12, 18, true); P('chrome', cu - 0.4, cu + 0.4, 0.2, 0.36, h - 0.03, h + 0.012);
    for (let k = 0; k < 5; k++) { const a = 0.35 + k * 0.6, u = cu + (ru - 0.42) * Math.cos(a), v = 0.2 + (rv - 0.42) * Math.sin(a); P('cardW', u - 0.03, u + 0.03, v - 0.045, v + 0.045, h - 0.029, h - 0.026, 'Y'); P(k % 2 ? 'chipR' : 'chipB', u + 0.08, u + 0.12, v - 0.02, v + 0.02, h - 0.03, h + 0.02); }
  },
  poker({ P, b, W, len, dep, h }) { const C = curves(b, W), cu = len / 2, cv = dep / 2, ru = len / 2 - 0.04, rv = dep / 2 - 0.04, k = rv / ru;
    P('fascia', cu - 0.35, cu + 0.35, cv - 0.25, cv + 0.25, 0, h - 0.12);
    C.fan('felt', cu, cv, ru - 0.16, (ru - 0.16) * k, 0, 6.283, h - 0.03, 28); C.ring('leather', cu, cv, ru - 0.16, ru, 0, 6.283, h, 28, false, k); C.wall('leather', cu, cv, ru, rv, 0, 6.283, h - 0.12, h, 28); C.fan('walnut', cu, cv, ru, rv, 0, 6.283, h - 0.12, 28, true);
    for (let i = 0; i < 6; i++) { const a = i * 1.047 + 0.5, u = cu + (ru - 0.45) * Math.cos(a), v = cv + (rv - 0.45) * Math.sin(a); P(i % 2 ? 'chipR' : 'chipB', u - 0.03, u + 0.03, v - 0.03, v + 0.03, h - 0.03, h + 0.03); }
    P('cardW', cu - 0.2, cu + 0.2, cv - 0.05, cv + 0.05, h - 0.029, h - 0.026, 'Y');
  },
  roulette({ P, b, W, len, dep, h }) { const C = curves(b, W);
    P('walnut', 0.05, len - 0.05, 0.05, dep - 0.05, 0.12, h - 0.05); for (const [u, v] of [[0.1, 0.1], [len - 0.2, 0.1], [0.1, dep - 0.2], [len - 0.2, dep - 0.2]]) P('cgoldM', u, u + 0.1, v, v + 0.1, 0, 0.12);
    b('rlayout').quad(W(1.15, 0.2, h - 0.04), W(len - 0.08, 0.2, h - 0.04), W(len - 0.08, dep - 0.2, h - 0.04), W(1.15, dep - 0.2, h - 0.04), [0, 1, 0], 1, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    P('leather', 0, len, 0, 0.1, h - 0.05, h); P('leather', 0, len, dep - 0.1, dep, h - 0.05, h); P('leather', len - 0.08, len, 0.1, dep - 0.1, h - 0.05, h);
    const cu = 0.6, cv = dep / 2; C.wall('walnut', cu, cv, 0.55, 0.55, 0, 6.283, h - 0.05, h + 0.06, 20); C.ring('walnut', cu, cv, 0.42, 0.55, 0, 6.283, h + 0.06, 20); C.fan('rwheel', cu, cv, 0.42, 0.42, 0, 6.283, h + 0.02, 37, false, true);
    P('cgoldM', cu - 0.03, cu + 0.03, cv - 0.03, cv + 0.03, h + 0.02, h + 0.14);
  },
  craps({ P, len, dep, h }) { P('walnut', 0, len, 0, dep, 0, h - 0.32); P('crapsfelt', 0.16, len - 0.16, 0.16, dep - 0.16, h - 0.32, h - 0.31, 'Y', 0.6);
    for (const r of [[0, len, 0, 0.16], [0, len, dep - 0.16, dep], [0, 0.16, 0.16, dep - 0.16], [len - 0.16, len, 0.16, dep - 0.16]]) { P('walnut', r[0], r[1], r[2], r[3], h - 0.32, h - 0.06); P('leather', r[0], r[1], r[2], r[3], h - 0.06, h); }
    P('chipW', len * 0.48, len * 0.5, dep * 0.5, dep * 0.52, h - 0.31, h - 0.29); P('chipR', len * 0.53, len * 0.55, dep * 0.46, dep * 0.48, h - 0.31, h - 0.29);
  },
  barseg() { },   // the round bar is drawn whole by the scenery
  ltable({ b, W, len, dep, h }) { const C = curves(b, W), cu = len / 2, cv = dep / 2; C.fan('cmarble', cu, cv, len / 2, dep / 2, 0, 6.283, h, 16); C.wall('cgoldM', cu, cv, len / 2, dep / 2, 0, 6.283, h - 0.04, h, 16);
    C.poly('cgoldM', [[cu - 0.06, cv - 0.06], [cu + 0.06, cv - 0.06], [cu + 0.06, cv + 0.06], [cu - 0.06, cv + 0.06]], cu, cv, 0.02, h - 0.04); C.fan('cgoldM', cu, cv, len * 0.3, dep * 0.3, 0, 6.283, 0.03, 12); },
  lchair({ P, len, dep, h }) { P('velvet', 0.05, len - 0.05, 0.08, dep - 0.03, 0.1, 0.42); P('velvetL', 0.12, len - 0.12, 0.2, dep - 0.05, 0.42, 0.5); P('velvet', 0.05, len - 0.05, 0, 0.18, 0.42, h);
    P('velvet', 0, 0.12, 0.05, dep - 0.05, 0.1, 0.62); P('velvet', len - 0.12, len, 0.05, dep - 0.05, 0.1, 0.62); for (const u of [0.08, len - 0.12]) for (const v of [0.08, dep - 0.12]) P('cgoldM', u, u + 0.04, v, v + 0.04, 0, 0.1); },
  lsofa({ P, len, dep, h }) { const n = Math.max(1, Math.round((len - 0.3) / 0.9)), cw = (len - 0.3) / n;
    P('velvet', 0, len, 0.04, dep, 0.1, 0.42); P('velvet', 0, len, 0, 0.24, 0.42, h); P('velvet', 0, 0.15, 0.2, dep, 0.42, 0.6); P('velvet', len - 0.15, len, 0.2, dep, 0.42, 0.6);
    for (let i = 0; i < n; i++) P('velvetL', 0.15 + i * cw + 0.02, 0.15 + (i + 1) * cw - 0.02, 0.26, dep - 0.03, 0.42, 0.52); P('cgoldM', 0.04, len - 0.04, 0.02, dep - 0.02, 0, 0.1); },
  rcolumn({ b, W, len, dep, h }) { const C = curves(b, W), cu = len / 2, cv = dep / 2, pts = [];
    for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, r = i % 2 ? 0.44 : 0.5; pts.push([cu + r * Math.cos(a), cv + r * Math.sin(a)]); }
    C.poly('colW', pts, cu, cv, 0.18, h, 1); C.wall('cgoldM', cu, cv, 0.55, 0.55, 0, 6.283, 0, 0.18, 16); C.ring('cgoldM', cu, cv, 0.44, 0.55, 0, 6.283, 0.18, 16);
    for (const y of [2.25, h - 0.82]) { C.wall('cglow', cu, cv, 0.56, 0.56, 0, 6.283, y, y + 0.09, 16); C.ring('cglow', cu, cv, 0.44, 0.56, 0, 6.283, y + 0.09, 16); C.ring('cglow', cu, cv, 0.44, 0.56, 0, 6.283, y, 16, true); }
  },
  pooltable({ P, len, dep, h }) { for (const [u, v] of [[0.1, 0.1], [len - 0.22, 0.1], [0.1, dep - 0.22], [len - 0.22, dep - 0.22]]) P('walnut', u, u + 0.12, v, v + 0.12, 0, 0.6);
    P('walnut', 0, len, 0, dep, 0.6, h - 0.06); P('felt', 0.12, len - 0.12, 0.12, dep - 0.12, h - 0.06, h - 0.05, 'Y');
    for (const r of [[0, len, 0, 0.12], [0, len, dep - 0.12, dep], [0, 0.12, 0.12, dep - 0.12], [len - 0.12, len, 0.12, dep - 0.12]]) P('walnut', r[0], r[1], r[2], r[3], h - 0.06, h);
    P('chipW', len * 0.3, len * 0.3 + 0.06, dep / 2 - 0.03, dep / 2 + 0.03, h - 0.05, h + 0.01); P('chipR', len * 0.7, len * 0.7 + 0.06, dep / 2 - 0.1, dep / 2 - 0.04, h - 0.05, h + 0.01); },
  nstand({ P, len, dep, h }) { P('walnut', 0, len, 0, dep, 0.06, h); P('cgoldM', 0.05, len - 0.05, 0.05, dep - 0.05, 0, 0.06); P('cgoldM', len / 2 - 0.03, len / 2 + 0.03, dep / 2 - 0.03, dep / 2 + 0.03, h, h + 0.3); P('lampshade', len / 2 - 0.13, len / 2 + 0.13, dep / 2 - 0.13, dep / 2 + 0.13, h + 0.3, h + 0.5, 'xXzZ'); },
  hvac({ P, b, W, len, dep, h }) { const C = curves(b, W); P('roofunit', 0, len, 0, dep, 0.1, h - 0.05); P('fascia', 0.1, len - 0.1, 0.1, dep - 0.1, 0, 0.1); P('grille', 0.05, len - 0.05, 0.05, dep - 0.05, h - 0.05, h - 0.04, 'Y', 1);
    const r = Math.min(len, dep) * 0.3; for (const u of len > 3.5 ? [len * 0.28, len * 0.72] : [len / 2]) { C.fan('dark', u, dep / 2, r, r, 0, 6.283, h - 0.03, 16); C.wall('roofunit', u, dep / 2, r + 0.04, r + 0.04, 0, 6.283, h - 0.05, h + 0.15, 16); } },
};

// ---------- the casino ceiling: a dropped white soffit with swirling coves cut into it ----------
const SOFFIT = 6.5, COVE_TOP = 6.9;   // well under the roof slab, so nothing shows through it from the tower
const COVES = [[37, 27, 6.2, 6.2, 0], [24, 13.5, 3.6, 2.4, 0.5], [50, 13.5, 3.6, 2.4, -0.5], [24, 38.5, 3.8, 2.5, -0.45], [50, 38.5, 3.8, 2.5, 0.45], [37, 44.2, 4.2, 2.0, 0], [18.5, 25.5, 2.2, 3.4, 0], [55.5, 25.5, 2.2, 3.4, 0]];
const inCove = (x, z, m = 0.25) => COVES.some(([cx, cz, rx, rz, a]) => { const dx = x - cx, dz = z - cz, u = dx * Math.cos(a) + dz * Math.sin(a), v = -dx * Math.sin(a) + dz * Math.cos(a); return (u / (rx + m)) ** 2 + (v / (rz + m)) ** 2 < 1; });
const coveAt = ([cx, cz, rx, rz, a], t, d = 0) => { const u = (rx + d) * Math.cos(t), v = (rz + d) * Math.sin(t); return [cx + u * Math.cos(a) - v * Math.sin(a), cz + u * Math.sin(a) + v * Math.cos(a)]; };

function buildHeli(MATS) {
  const g = new THREE.Group(), box = new THREE.Group(), body = sheen({ color: 0x1b2330 }, 'paint'), stripe = sheen({ color: 0x3a7ad8 }, 'paint'), dark = new THREE.MeshLambertMaterial({ color: 0x0e1014 }), metal = sheen({ color: 0x8a9098 }, 'metal');
  g.add(box);   // the stand-in built from boxes, until the Huey model arrives (and in ?lite=1 tests)
  const bx = (w, h, d, x, y, z, m = body, to = box) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; to.add(o); return o; };
  const L = HELI.x1 - HELI.x0, D = HELI.z1 - HELI.z0, dl = HELI.door[0] - (HELI.x0 + HELI.x1) / 2, dr = HELI.door[1] - (HELI.x0 + HELI.x1) / 2;
  bx(L + 0.2, 0.3, D + 0.2, 0, -0.15, 0, dark); bx(L + 0.2, 0.3, D + 0.2, 0, 2.15, 0);                              // floor, roof (the collision boxes)
  bx(0.1, 2, D, -L / 2 - 0.05, 1, 0); bx(0.1, 2, D, L / 2 + 0.05, 1, 0); bx(L, 2, 0.1, 0, 1, -D / 2 - 0.05);          // bulkheads, far side
  bx(dl + L / 2, 2, 0.1, (-L / 2 + dl) / 2, 1, D / 2 + 0.05); bx(L / 2 - dr, 2, 0.1, (L / 2 + dr) / 2, 1, D / 2 + 0.05);   // door posts
  bx(L + 0.22, 0.14, 0.04, 0, 0.55, D / 2 + 0.12, stripe); bx(L + 0.22, 0.14, 0.04, 0, 0.55, -D / 2 - 0.12, stripe);
  for (const x of [-1.6, 0, 1.6]) bx(0.9, 0.6, 0.03, x, 1.35, -D / 2 - 0.11, MATS.glass);                           // far-side windows
  bx(3.4, 0.42, 0.5, 0, 0.21, -D / 2 + 0.3, sheen({ color: 0x2a2e36 }, 'cloth')); bx(3.4, 0.6, 0.12, 0, 0.75, -D / 2 + 0.08, sheen({ color: 0x2a2e36 }, 'cloth'));   // bench
  bx(L - 0.6, 0.03, 0.08, 0, 1.86, 0, new THREE.MeshBasicMaterial({ color: 0xff3a2a }), g);                          // red cabin light
  bx(2.0, 1.9, D, -L / 2 - 1.05, 0.95, 0); bx(1.1, 1.25, D - 0.2, -L / 2 - 2.4, 1.25, 0, MATS.glass);                    // cockpit, windscreen
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), body); nose.scale.set(1.1, 0.85, D / 2 - 0.05); nose.position.set(-L / 2 - 2.5, 0.55, 0); box.add(nose);
  bx(L + 2.2, 0.5, D - 0.2, -1.0, -0.55, 0);                                                                         // belly
  bx(3.2, 0.7, 1.6, 0.3, 2.65, 0); bx(0.5, 0.3, 0.4, 1.9, 2.7, 0.5, dark); bx(0.5, 0.3, 0.4, 1.9, 2.7, -0.5, dark);       // engines, exhausts
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.55, 8, 10), body); boom.rotation.z = -Math.PI / 2; boom.position.set(L / 2 + 4, 1.4, 0); box.add(boom);
  bx(1.0, 1.7, 0.12, L / 2 + 7.8, 2.2, 0); bx(0.7, 0.08, 2.0, L / 2 + 7.2, 1.45, 0);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 })); beacon.position.set(L / 2 + 8.2, 3.1, 0); g.add(beacon);
  for (const z of [-1.25, 1.25]) { const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5.6, 8), metal); sk.rotation.z = Math.PI / 2; sk.position.set(-0.4, -1.1, z); box.add(sk); for (const x of [-1.6, 1.4]) bx(0.08, 0.85, 0.08, x, -0.68, z * 0.9, metal); }
  bx(0.08, 0.08, 1.05, 0, 2.06, D / 2 + 0.5, metal, g);                                                               // the fast-rope arm over the door
  const rope = ROPES.find(r => r.heli), drop = rope.top + 2.06 - rope.bot - 0.05, rg = new THREE.CylinderGeometry(0.028, 0.028, drop, 6); rg.translate(0, -drop / 2, 0);
  const rp = new THREE.Mesh(rg, sheen({ color: 0x8c7a56 }, 'cloth')); rp.position.set(rope.x - (HELI.x0 + HELI.x1) / 2, 2.06, rope.z - (HELI.z0 + HELI.z1) / 2); g.add(rp);   // hangs from the arm; scaled to lower it
  const rotor = new THREE.Group(); rotor.position.set(0.3, 3.2, 0); box.add(rotor); bx(0.18, 0.4, 0.18, 0.3, 3.0, 0, metal);
  for (let k = 0; k < 4; k++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.05, 0.36), dark); bl.geometry.translate(3.1, 0, 0); bl.rotation.y = k * Math.PI / 2; rotor.add(bl); }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(6.3, 40), new THREE.MeshBasicMaterial({ color: 0x101216, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide })); disc.rotation.x = -Math.PI / 2; rotor.add(disc);
  const tail = new THREE.Group(); tail.position.set(L / 2 + 8.1, 2.4, 0.16); box.add(tail); for (let k = 0; k < 2; k++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.7, 0.03), dark); bl.rotation.z = k * Math.PI / 2; tail.add(bl); }
  g.position.set((HELI.x0 + HELI.x1) / 2, HELI.y, (HELI.z0 + HELI.z1) / 2);
  return { g, box, rotor, tail, beacon, rope: rp, idle: 0, gone: 0, home: g.position.clone() };
}

// ---------- CCTV: six cameras round the building, shown on the security office's wall ----------
const CAMS = [['CAM 01 CASINO', [58.5, 6.0, 9.5], [32, 0, 36]], ['CAM 02 CAGE', [71.2, 3.2, 19.4], [62, 0.6, 11]], ['CAM 03 LOBBY', [15, 3.3, 55.4], [44, 0, 50]],
  ['CAM 04 HIGH LIMIT', [13.4, 3.2, 8.6], [3, 0, 26]], ['CAM 05 SUITES', [16.6, F3 + 3.2, 9.5], [55, F3, 9.5]], ['CAM 06 ROOF', [55, ROOF + 3.5, 1], [30, ROOF, 15]]];
function buildCCTV(root) {
  const rts = [], cams = [], mats = [];
  CAMS.forEach(([name, p, t], i) => {
    const rt = new THREE.WebGLRenderTarget(256, 144), cam = new THREE.PerspectiveCamera(78, 16 / 9, 0.1, 120); cam.position.set(...p); cam.lookAt(...t); rts.push(rt); cams.push(cam);
    const m = new THREE.MeshBasicMaterial({ map: rt.texture, color: 0xb8c8e0, toneMapped: false }); mats.push(m);
    const col = i % 3, row = i / 3 | 0, z = 22.6 + col * 2.75, y = 3.1 - row * 0.8, s = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.7), m); s.position.set(71.83, y, z); s.rotation.y = -Math.PI / 2; root.add(s);
    plane(root, name, 1.0, 0.09, 71.82, y + 0.28, z + 0.62, -Math.PI / 2, { bg: '#0a0c10', fg: '#9fd8ff', pw: 384, ph: 32 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.28), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 })); box.position.set(...p); box.lookAt(...t); root.add(box);   // the camera itself
  });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.9, 8.5), new THREE.MeshLambertMaterial({ color: 0x0a0b0d })); frame.position.set(71.9, 2.57, 25.35); root.add(frame);
  return { rts, cams, mats, n: 0, k: 0, on: true };
}

export default {
  get env() { return tod === 'night' ? NIGHT : DUSK; },
  envs: { dusk: DUSK, night: NIGHT },
  setTod(t) { tod = t === 'night' ? 'night' : 'dusk'; },
  // The lift (models/lift/elevator.glb, "Elevator" by ART_LOLL): one copy at each stop, the cage inside the car's walls and the frame and
  // call button on the landing side. Its door panels slide with the game's lift doors (tick); the game's own door slab is hidden (liftDoors).
  liftDoors() { return !!lifts; },
  loadLift() {
    return new Promise((res, rej) => new GLTFLoader().load('models/lift/elevator.glb', gl => {
      const out = new THREE.Group(), L = [];
      gl.scene.traverse(o => { if (!o.isMesh) return; const mt = o.material; if (mt.userData.done) return; mt.userData.done = true; mt.envMap = envMap; mt.userData.env = mt.envMapIntensity = 0.9; if (!pbrMats.includes(mt)) pbrMats.push(mt);
        if (mt.name === 'Metal') mt.color.set(0x9aa0a8); if (mt.name === 'Emission') { mt.userData.e = mt.emissiveIntensity = 1.6; liftGlow.push(mt); } });
      LIFT.stops.forEach((y, k) => { const m = gl.scene.clone(true), kill = [], doors = [];
        m.traverse(o => { if (/^(Wall_|Plane_)/.test(o.name)) kill.push(o); const d = /^(Left|Right)(Outside|Interior)Door/.exec(o.name); if (d) doors.push({ o, s: d[1] === 'Left' ? 1 : -1, inner: d[2] === 'Interior' }); if (o.isMesh) o.receiveShadow = true; });
        for (const o of kill) o.parent.remove(o);
        m.position.set((LIFT.door[0] + LIFT.door[2]) / 2, y, CAR.z1); m.rotation.y = -Math.PI / 2; m.scale.set(1, 0.9, 0.942); out.add(m); L.push({ k, doors, cur: -1 }); });
      for (const mt of liftGlow) mt.emissiveIntensity = dark ? 0.03 : mt.userData.e;
      lifts = L; res(out);
    }, undefined, rej));
  },
  load() { return Promise.all([this.loadHeli(), this.loadLift().catch(() => null)]).then(([a, b]) => { const g = new THREE.Group(); if (a) g.add(a); if (b) g.add(b); return g; }); },
  // The Huey (models/heli/huey.glb): turned and scaled when it loads into the game frame (cabin floor at y = 0, the cabin's middle at x = 0,
  // nose toward -x, the cargo door on +z), with that door cut open. It goes into the helicopter group in place of the box stand-in,
  // so it hovers and flies away with it; its main and tail rotors spin.
  loadHeli() {
    const h = heli; if (!h) return Promise.resolve(null);
    return new Promise((res, rej) => new GLTFLoader().load('models/heli/huey.glb', gl => {
      const src = gl.scene; src.updateMatrixWorld(true); const s0 = new THREE.Vector3().setFromMatrixScale(src.getObjectByName('Bell_Huey').matrixWorld).x / 0.01;   // undo the file's display scale: model metres
      src.scale.setScalar(1 / s0); src.updateMatrixWorld(true);
      const K = 1.05, FL = 0.46, CZ = -0.76, DOOR = { x: 0.9, y0: 0.52, y1: 2.3, z0: -2.0, z1: 1.2 };   // model metres: the cabin floor, the cabin's middle, the cargo door's hole
      const M = new THREE.Matrix4().makeScale(K, K, K).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2)).multiply(new THREE.Matrix4().makeTranslation(0, -FL, -CZ));
      const m = new THREE.Group(), v = new THREE.Vector3(), c = new THREE.Vector3();
      const keep = (o, geo) => {   // drop the triangles in the door hole (by their middle, in model metres)
        const P = geo.attributes.position, I = geo.index, out = [];
        for (let t = 0; t < I.count; t += 3) { c.set(0, 0, 0); for (let k = 0; k < 3; k++) c.add(v.fromBufferAttribute(P, I.getX(t + k)).applyMatrix4(o.matrixWorld)); c.multiplyScalar(1 / 3);
          if (!(c.x > DOOR.x && c.y > DOOR.y0 && c.y < DOOR.y1 && c.z > DOOR.z0 && c.z < DOOR.z1)) out.push(I.getX(t), I.getX(t + 1), I.getX(t + 2)); }
        geo.setIndex(out); return geo; };
      const part = (o, piv) => { const geo = keep(o, o.geometry.clone()); geo.applyMatrix4(o.matrixWorld); geo.applyMatrix4(M); if (piv) geo.translate(-piv.x, -piv.y, -piv.z);
        const mt = o.material; mt.envMap = envMap; mt.userData.env = mt.envMapIntensity = 0.6; if (!pbrMats.includes(mt)) pbrMats.push(mt); if (mt.transparent) mt.depthWrite = false;
        mt.side = THREE.DoubleSide; const ms = new THREE.Mesh(geo, mt); ms.castShadow = ms.receiveShadow = !mt.transparent; return ms; };
      const pivot = n => new THREE.Vector3().setFromMatrixPosition(src.getObjectByName(n).matrixWorld).applyMatrix4(M);
      const top = pivot('Top_Rotor'), back = pivot('Back_Rotor'), rotor = new THREE.Group(), tail = new THREE.Group(); rotor.position.copy(top); tail.position.copy(back);
      src.traverse(o => { if (!o.isMesh) return; const n = o.parent.name; if (n === 'Top_Rotor') rotor.add(part(o, top)); else if (n === 'Back_Rotor') tail.add(part(o, back)); else m.add(part(o)); });
      m.add(rotor, tail);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(7.0, 48), new THREE.MeshBasicMaterial({ color: 0x101216, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide })); disc.rotation.x = -Math.PI / 2; disc.position.y = 1.45; rotor.add(disc);
      h.rotor = rotor; h.tail = tail; h.tailAx = 'z'; h.box.visible = false; h.beacon.position.set(8.7, 2.9, 0); h.g.add(m);
      res(new THREE.Group());   // the caller adds what it gets to the scene; the model itself stays in the helicopter group
    }, undefined, rej));
  },
  noshade: { cglow: 1, crystal: 1, slotscreen: 1, slotgold: 1, lane: 1, padY: 1, slotbtn: 1, lampshade: 1 },
  noCast: ['cground', 'asph', 'pave', 'roofM', 'tglassT', 'cmarble', 'rugW', 'csoffit', 'quilt', 'lane', 'padY', 'gravel'],
  tread: 'concrete',
  outer: w => w.f >= 3 ? 'tglassW1' : 'podclad',
  inner: w => {
    if (w.x0 >= CAR.x0 - 0.3 && w.x1 <= CAR.x1 + 0.3 && w.z1 <= CAR.z1 + 0.2) return 'steelwall';
    if (w.f >= 3) return 'plaster'; if (w.f === 2) return 'bohwall';
    if (w.z1 < 7.95 || (w.x0 > 60.05 && w.z0 >= 7.95 && w.z1 <= 20.3)) return 'bohwall';   // back of house and the cage
    if (w.f === 0 && w.x0 < 13.9 && w.x1 <= 14.3 && w.z0 >= 7.7 && w.z1 <= 32.3) return 'goldwall';
    return 'cwall';
  },
  door: d => d.win ? 'winpane' : d.lift !== undefined ? 'steel' : d.exterior ? 'glassdoor' : 'door',
  furn,
  // Two zones that are drawn only when they can be seen (gfx.js puts every piece lying wholly inside one into its own meshes):
  // 'casino', everything inside the podium under its roof, hidden while you are up the tower (helicopter, roof, suites, ropes
  // above the casino roof); 'suites', the sky-suite floor, hidden while you are down in the casino. In the service lift both show.
  zone(x, y, z, bb) {
    const a = bb ? bb.min : { x, y, z }, c = bb ? bb.max : { x, y, z };
    if (a.x >= FOOT.x0 + 0.15 && c.x <= FOOT.x1 - 0.15 && a.z >= FOOT.z0 + 0.15 && c.z <= FOOT.z1 - 0.15 && a.y >= -0.05 && c.y <= POD - 0.05) return 'casino';
    if (a.x >= WING.x0 + 0.15 && c.x <= WING.x1 - 0.15 && a.z >= WING.z0 + 0.15 && c.z <= WING.z1 - 0.15 && a.y >= F3 - 0.3 && c.y <= ROOF - 0.05) return 'suites';
    return null;
  },
  mats(M) {
    if (M.cnavy) return;
    const S = (t, gl) => sheen({ map: t }, gl);
    Object.assign(M, {
      cnavy: S(tex('#141c37', 5000, navyCarpet), 'cloth'), cgold: S(tex('#5a4120', 5000, goldCarpet), 'cloth'), carpetS: S(tex('#8c877f', 7000), 'cloth'),
      concrete: M.concrete || S(tex('#8d8a84', 4000, grid(2, 2, 'rgba(40,38,34,0.35)')), 'stone'), steelfloor: S(tex('#6c7076', 2000, grid(8, 8, 'rgba(20,20,20,0.35)', true, 0.1)), 'metal'),
      cmarble: S(tex('#eeece7', 300, veins), 'polished'), rugW: S(tex('#1d2b55', 0, waves), 'cloth'), quilt: S(tex('#b8914a', 300, quilt), 'metal'),
      cwall: S(tex('#e9e5dd', 400, grid(10, 1, 'rgba(120,110,95,0.18)')), 'satin'), goldwall: S(tex('#7d5f2e', 400, grid(2, 2, 'rgba(255,220,150,0.25)')), 'metal'), bohwall: S(tex('#a6a7a5', 2500), 'matte'),
      steelwall: S(tex('#a9aeb4', 300, grid(1, 4, 'rgba(0,0,0,0.15)')), 'metal'),
      podclad: S(tex('#ecebe5', 500, grid(6, 1, 'rgba(0,0,0,0.1)')), 'satin'), tglassW: S(wingTex(), 'glass'), tglassW1: S((() => { const t = wingTex(); t.repeat.set(1 / H, 1 / H); return t; })(), 'glass'), roofM: S(tex('#6a6b6d', 8000, grid(1, 1, 'rgba(0,0,0,0.2)')), 'matte'),
      csoffit: sheen({ map: tex('#f3f1ec', 200), emissive: 0x2e2a26 }, 'satin'), coveW: sheen({ map: tex('#f6f3ec', 100), emissive: 0x3a3630 }, 'satin'), colW: S(tex('#f1eee7', 200, grid(1, 1, 'rgba(0,0,0,0.04)')), 'polished'),
      cgoldM: sheen({ color: 0xc9a457 }, 'metal'), chrome: sheen({ color: 0xc0c5cc }, 'metal'), slotbody: S(tex('#1b1d24', 300), 'polished'),
      felt: S(tex('#1d4b6a', 4000), 'cloth'), crapsfelt: S(tex('#1d4b6a', 3000, grid(4, 2, 'rgba(240,236,224,0.7)')), 'cloth'), leather: S(tex('#2b1c14', 300), 'polished'),
      velvet: S(tex('#1f2f5c', 5000), 'cloth'), velvetL: S(tex('#dcd5c6', 4000), 'cloth'), roofunit: S(tex('#b5b8bb', 600, grid(1, 3, 'rgba(0,0,0,0.15)')), 'metal'), grille: S(tex('#55595e', 300, grid(16, 16, 'rgba(0,0,0,0.6)')), 'metal'),
      cardW: sheen({ color: 0xf4f2ea }, 'satin'), chipR: sheen({ color: 0xb02030 }, 'plastic'), chipB: sheen({ color: 0x1e3a8a }, 'plastic'), chipW: sheen({ color: 0xf0eee6 }, 'plastic'),
      rlayout: sheen({ map: rlayout() }, 'cloth'), rwheel: sheen({ map: rwheel() }, 'polished'),
      winpane: sheen({ color: 0x24425e, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }, 'glass'), glassdoor: sheen({ color: 0x3a2f1e, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }, 'glass'),
      cground: S(tex('#2b2b2e', 6000), 'matte'), asph: S(tex('#2c2d30', 9000), 'matte'), pave: S(tex('#bcb5a7', 1500, grid(2, 2, 'rgba(70,65,55,0.45)')), 'satin'),
      ropeM: sheen({ color: 0x8c7a56 }, 'cloth'), padY: new THREE.MeshBasicMaterial({ color: 0xe8c02a }), lane: new THREE.MeshBasicMaterial({ color: 0xd8d8d2 }),
      palmT: S(tex('#6b5a44', 2000, grid(1, 12, 'rgba(40,30,20,0.4)')), 'matte'),
    });
    towerM = M.tglassT = sheen({ map: towerTex(false), emissiveMap: towerTex(true), emissive: 0xffffff }, 'glass');
    const glow = (k, c) => { M[k] = new THREE.MeshBasicMaterial({ color: c }); M[k].userData.c = c; glows.push(M[k]); };
    glow('cglow', 0xfff0d6); glow('crystal', 0xfff4e0); glow('slotgold', 0xffc65a); glow('slotbtn', 0xff7a3a); glow('lampshade', 0xffe7c0);
    M.slotscreen = MATS_SLOT = slotScreenMat(slotAtlas()); M.slotscreen.userData.c = 0xffffff; glows.push(M.slotscreen);
    M.palmF = new THREE.MeshLambertMaterial({ color: 0x2c4628, side: THREE.DoubleSide });
  },
  look(night, nvg) {
    for (const m of glows) m.color.set(nvg ? (night ? 0x0c3a12 : 0x9cff9c) : night ? 0x0d0c0a : m.userData.c);
    for (const m of signs) m.color.set(nvg ? 0x8cff9c : night ? 0x2a2a2a : 0xffffff);
    if (towerM) { towerM.emissive.set(nvg ? 0x4cff5a : 0xffffff); towerM.emissiveIntensity = night ? 0.18 : 1; }
    if (skyM) skyM.color.set(nvg ? 0x6dff7a : 0xffffff);
    dark = night; for (const m of liftGlow) m.emissiveIntensity = night ? 0.03 : m.userData.e;
    if (cctv) { cctv.on = !night; for (const m of cctv.mats) m.color.set(night ? 0x000000 : nvg ? 0x8cff9c : 0xb8c8e0); }
  },
  scenery({ b, ao, root, hills, hillM, level, MATS }) {
    signs = []; seed = 11; lifts = null; liftGlow = []; inner = { root, mat: MATS.cglow, list: null, on: true };
    const C = curves(b), flat = (m, x0, x1, z0, z1, y = 0, s = 0.2) => b(m).quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], s);
    const down = (m, x0, x1, z0, z1, y, s = 0.5) => b(m).quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, -1, 0], s);
    // ---- ground: paving round the podium, the driveway under the canopy, the boulevard ----
    flat('cground', -600, 700, -600, 700, -0.02, 0.05);
    flat('pave', -6, 78, 56, 58.5, 0.006, 0.4); flat('pave', -6, 0, -6, 56, 0.006, 0.4); flat('pave', 72, 78, -6, 56, 0.006, 0.4); flat('pave', 0, 72, -6, 0, 0.006, 0.4);
    flat('asph', 0, 72, 58.5, 82, 0.004, 0.1); flat('pave', -30, 102, 82, 85, 0.008, 0.4); flat('asph', -420, 480, 85, 109, 0.003, 0.08);
    for (let x = -410; x < 480; x += 7) { flat('lane', x, x + 3.5, 92.9, 93.05, 0.006); flat('lane', x, x + 3.5, 100.9, 101.05, 0.006); } flat('padY', -420, 480, 96.9, 97.0, 0.006); flat('padY', -420, 480, 97.1, 97.2, 0.006);
    for (let x = 30; x < 43; x += 1.2) flat('lane', x, x + 0.6, 77, 80, 0.006);   // crossing at the drive's mouth
    // ---- the podium: white ribbed band above the ground floor, the roof, the parapets ----
    const B = (m, x0, x1, y0, y1, z0, z1, f, s) => b(m).box(x0, x1, y0, y1, z0, z1, f, s);
    B('podclad', -0.12, 0.1, H, POD + 0.4, 0, FOOT.z1, 'xY', 0.5); B('podclad', FOOT.x1 - 0.1, FOOT.x1 + 0.12, H, POD + 0.4, 0, FOOT.z1, 'XY', 0.5);
    B('podclad', 0, FOOT.x1, H, POD + 0.4, -0.12, 0.1, 'zY', 0.5); B('podclad', 0, FOOT.x1, H, CANOPY.y + 0.9, FOOT.z1 - 0.1, FOOT.z1 + 0.12, 'ZY', 0.5);
    for (let x = 0.75; x < FOOT.x1; x += 1.5) B('podclad', x - 0.06, x + 0.06, H, POD + 0.4, FOOT.z1 + 0.12, FOOT.z1 + 0.55, 'xXZy', 1);   // fins on the front band
    for (const [x0, x1, z0, z1] of [[0, 72, 20, 56], [0, 16, 0, 20], [56, 72, 0, 20]]) flat('roofM', x0, x1, z0, z1, POD + 0.004, 0.1);
    // ---- the sky-suite wing: plant floor, the suites behind glass, two dark-glass floors, the roof ----
    for (const w of level.boxes) {
      if (w.kind === 'mass') { if (w.f === 4) B('tglassT', w.x0, w.x1, w.y0, w.y1, w.z0, w.z1, 'zZ', 1 / TILE); else B('podclad', w.x0, w.x1, w.y0, w.y1, w.z0, w.z1, 'xXzZ', 0.5); }
      else if (w.kind === 'parapet') { B('podclad', w.x0, w.x1, w.y0, w.y1, w.z0, w.z1, 'xXzZ', 0.5); B('cmarble', w.x0 - 0.02, w.x1 + 0.02, w.y1, w.y1 + 0.06, w.z0 - 0.02, w.z1 + 0.02, ALLF, 0.5); }
      else if (w.kind === 'core') B('concrete', w.x0, w.x1, w.y0, w.y1, w.z0, w.z1, ALLF, 0.5);
      else if (w.kind === 'fence' && w.sub === 'bars') { for (let z = w.z0; z <= w.z1 + 0.001; z += 0.13) B('cgoldM', w.x0 + 0.03, w.x1 - 0.03, w.y0, w.y1, z - 0.012, z + 0.012, 'xXzZ', 1); B('cgoldM', w.x0, w.x1, w.y1 - 0.08, w.y1, w.z0, w.z1, ALLF, 1); B('cgoldM', w.x0, w.x1, w.y0, w.y0 + 0.05, w.z0, w.z1, 'xXYzZ', 1); }
      else if (w.kind === 'trunk') { const cx = (w.x0 + w.x1) / 2, cz = (w.z0 + w.z1) / 2; C.wall('podclad', cx, cz, 0.34, 0.34, 0, 6.283, 0, w.y1 - 0.6, 14); C.wall('podclad', cx, cz, 0.6, 0.6, 0, 6.283, w.y1 - 0.6, w.y1, 14); C.ring('podclad', cx, cz, 0.34, 0.6, 0, 6.283, w.y1 - 0.6, 14, true); }
    }
    flat('roofM', WING.x0, WING.x1, WING.z0, WING.z1, ROOF + 0.004, 0.1);
    { const cx = 36, cz = 8.3; C.ring('padY', cx, cz, 4.2, 4.5, 0, 6.283, ROOF + 0.012, 40); flat('padY', cx - 1.3, cx - 0.9, cz - 1.6, cz + 1.6, ROOF + 0.012); flat('padY', cx + 0.9, cx + 1.3, cz - 1.6, cz + 1.6, ROOF + 0.012); flat('padY', cx - 0.9, cx + 0.9, cz - 0.2, cz + 0.2, ROOF + 0.012); }
    B('podclad', WING.x0 - 0.3, WING.x1 + 0.3, ROOF + 1.1, ROOF + 1.25, WING.z0 - 0.3, WING.z0 + 0.3, ALLF, 0.5);   // crown band
    // rope anchors: a davit on the south parapet for each breach window, its rope down the glass
    for (const r of ROPES) { if (r.heli) continue; const pz = WING.z1;
      B('steel', r.x - 0.1, r.x + 0.1, ROOF, ROOF + 1.7, pz - 0.6, pz - 0.4, ALLF, 1); B('steel', r.x - 0.06, r.x + 0.06, ROOF + 1.6, ROOF + 1.72, pz - 0.6, r.z + 0.05, ALLF, 1); B('steel', r.x - 0.25, r.x + 0.25, ROOF, ROOF + 0.06, pz - 0.85, pz - 0.15, ALLF, 1);
      B('ropeM', r.x - 0.025, r.x + 0.025, r.bot + 0.05, ROOF + 1.6, r.z - 0.025, r.z + 0.025, 'xXzZ', 1); }
    // ---- the fire stairs: three flights of a scissor stair and the landings between them ----
    { const N = 16, RUN = SHAFT.s - SHAFT.n;
      for (let k = 0; k < 2; k++) { const west = k % 2 === 0, x0 = west ? SHAFT.x0 + 0.08 : SHAFT.mid + 0.1, x1 = west ? SHAFT.mid - 0.1 : SHAFT.x1 - 0.08;
        for (let i = 0; i < N; i++) { const top = k * H + (i + 1) * H / N, za = west ? SHAFT.s - (i + 1) * RUN / N : SHAFT.n + i * RUN / N, zb = za + RUN / N; B('concrete', x0, x1, top - 0.04, top, za, zb, 'xXYzZ', 1); B('padY', x0, x1, top - 0.002, top + 0.001, west ? zb - 0.05 : za, west ? zb : za + 0.05, 'Y', 1); }
        const zl = west ? SHAFT.s : SHAFT.n, zh = west ? SHAFT.n : SHAFT.s, y0 = k * H - 0.2, y1 = k * H + H - 0.2; b('concrete').quad([x0, y0, zl], [x1, y0, zl], [x1, y1, zh], [x0, y1, zh], [0, -0.857, west ? -0.514 : 0.514], 0.5); }
      for (const [y, z0, z1] of [[H, SHAFT.z0, SHAFT.n], [2 * H, SHAFT.s, SHAFT.z1]]) B('concrete', SHAFT.x0, SHAFT.x1, y - 0.2, y, z0, z1, 'Yy' + (z0 > 0 ? 'z' : 'Z'), 0.5);
      plane(root, 'ROOF ACCESS', 1.6, 0.3, 29, POD + 2.55, WING.z1 + 0.13, 0, { bg: '#c22a24' }); plane(root, 'CASINO \u25BC', 1.4, 0.3, 26.13, POD + 2.3, 10, Math.PI / 2, { bg: '#c22a24' }); plane(root, 'CASINO 1', 1.2, 0.3, SHAFT.x0 + 0.06, 2.2, 7.3, Math.PI / 2, { bg: '#c22a24' }); }
    // ---- the service lift: call panels and a hatch light in each car ----
    for (const y of [0, F3]) { B('steelwall', CAR.x1 - 0.06, CAR.x1 - 0.04, y + 1.0, y + 1.5, CAR.z1 - 0.7, CAR.z1 - 0.4, 'x', 1); b('cglow').box(CAR.x1 - 0.07, CAR.x1 - 0.06, y + 1.2, y + 1.3, CAR.z1 - 0.6, CAR.z1 - 0.5, 'x', 1); b('cglow').box(CAR.x0 + 0.5, CAR.x1 - 0.5, y + H - 0.03, y + H - 0.02, CAR.z0 + 0.6, CAR.z1 - 0.6, 'y', 1);
      plane(root, y ? 'SERVICE  1  ▼' : 'SERVICE  3  ▲', 1.6, 0.22, (CAR.x0 + CAR.x1) / 2, y + 3.3, CAR.z1 + 0.12, 0, { bg: '#0d0f12', fg: '#ff9a3a' }); }
    // ---- the casino ceiling: soffit with coves, light ribbons swirling between them, the chandelier ----
    { const sh = new THREE.Shape(); sh.moveTo(MAIN.x0, MAIN.z0); sh.lineTo(MAIN.x1, MAIN.z0); sh.lineTo(MAIN.x1, MAIN.z1); sh.lineTo(MAIN.x0, MAIN.z1); sh.lineTo(MAIN.x0, MAIN.z0);
      for (const cv of COVES) { const p = new THREE.Path(); for (let i = 0; i <= 48; i++) { const [x, z] = coveAt(cv, -i * 6.283 / 48); i ? p.lineTo(x, z) : p.moveTo(x, z); } sh.holes.push(p); }
      const geo = new THREE.ShapeGeometry(sh, 6), uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.25, uv.getY(i) * 0.25);
      const soffit = new THREE.Mesh(geo, MATS.csoffit); soffit.rotation.x = Math.PI / 2; soffit.position.y = SOFFIT; soffit.receiveShadow = true; root.add(soffit);
      for (const cv of COVES) { const n = 40;
        for (let i = 0; i < n; i++) { const t0 = i * 6.283 / n, t1 = (i + 1) * 6.283 / n, [ax, az] = coveAt(cv, t0), [ex, ez] = coveAt(cv, t1), mx = (ax + ex) / 2 - cv[0], mz = (az + ez) / 2 - cv[1], l = Math.hypot(mx, mz), nn = [-mx / l, 0, -mz / l];
          b('coveW').quad([ax, SOFFIT, az], [ex, SOFFIT, ez], [ex, COVE_TOP, ez], [ax, COVE_TOP, az], nn, 0.5);
          b('cglow').quad([ax - mx / l * 0.02, COVE_TOP - 0.16, az - mz / l * 0.02], [ex - mx / l * 0.02, COVE_TOP - 0.16, ez - mz / l * 0.02], [ex - mx / l * 0.02, COVE_TOP - 0.04, ez - mz / l * 0.02], [ax - mx / l * 0.02, COVE_TOP - 0.04, az - mz / l * 0.02], nn);
          const [bx0, bz0] = coveAt(cv, t0, 0.18), [bx1, bz1] = coveAt(cv, t1, 0.18); b('cglow').quad([ax, SOFFIT - 0.006, az], [ex, SOFFIT - 0.006, ez], [bx1, SOFFIT - 0.006, bz1], [bx0, SOFFIT - 0.006, bz0], [0, -1, 0]); }
        const pool = Math.max(cv[2], cv[3]) + 1.5; ao('lightpool', [cv[0] - pool, 0.03, cv[1] - pool], [cv[0] + pool, 0.03, cv[1] - pool], [cv[0] + pool, 0.03, cv[1] + pool], [cv[0] - pool, 0.03, cv[1] + pool], [0, 1, 0]); }
      // ribbons: thin lit lines spiralling out from each cove across the soffit
      COVES.forEach((cv, ci) => { for (const sgn of [1, -1]) { let prev = null;
        for (let i = 0; i <= 60; i++) { const t = ci * 0.9 + sgn * i * 0.07, d = 0.6 + i * 0.09, [x, z] = coveAt(cv, t, d), ok = x > MAIN.x0 + 0.3 && x < MAIN.x1 - 0.3 && z > MAIN.z0 + 0.3 && z < MAIN.z1 - 0.3 && !inCove(x, z, 0.15);
          if (!ok) { if (prev) break; continue; }
          if (prev) { const dx = x - prev[0], dz = z - prev[1], l = Math.hypot(dx, dz) || 1, ox = -dz / l * 0.05, oz = dx / l * 0.05; b('cglow').quad([prev[0] - ox, SOFFIT - 0.008, prev[1] - oz], [x - ox, SOFFIT - 0.008, z - oz], [x + ox, SOFFIT - 0.008, z + oz], [prev[0] + ox, SOFFIT - 0.008, prev[1] + oz], [0, -1, 0]); }
          prev = [x, z]; } } });
      // the crystal chandelier: rings of strands hanging into the lounge cove, longest in the middle
      const strands = []; for (let r = 0.25; r <= 4.4; r += 0.3) { const n = Math.max(6, Math.round(6.283 * r / 0.26)); for (let i = 0; i < n; i++) { const a = i * 6.283 / n + r, L = 0.35 + 2.7 * Math.sqrt(Math.max(0, 1 - (r / 4.6) ** 2)) * (0.85 + rr() * 0.3); strands.push([37 + r * Math.cos(a), 27 + r * Math.sin(a), L]); } }
      const sg = new THREE.BoxGeometry(0.022, 1, 0.022); sg.translate(0, -0.5, 0); const im = new THREE.InstancedMesh(sg, MATS.crystal, strands.length), o = new THREE.Object3D();
      strands.forEach(([x, z, L], i) => { o.position.set(x, COVE_TOP - 0.02, z); o.scale.set(1, L, 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); root.add(im); inner.im = [im];
      const bg = new THREE.OctahedronGeometry(0.05); const beads = new THREE.InstancedMesh(bg, MATS.crystal, strands.length); strands.forEach(([x, z, L], i) => { o.position.set(x, COVE_TOP - 0.02 - L, z); o.scale.set(1, 1.6, 1); o.updateMatrix(); beads.setMatrixAt(i, o.matrix); }); root.add(beads); inner.im.push(beads);
      C.ring('cgoldM', 37, 27, 4.4, 4.7, 0, 6.283, COVE_TOP - 0.03, 40, true);
      // high-limit room: gold quilted ceiling with a lit edge and two gold chandeliers
      down('quilt', 0.12, 13.9, 8.12, 31.9, H - 0.03, 0.5);
      for (const [x0, x1, z0, z1] of [[0.3, 13.7, 8.3, 8.42], [0.3, 13.7, 31.58, 31.7], [0.3, 0.42, 8.3, 31.7], [13.58, 13.7, 8.3, 31.7]]) down('cglow', x0, x1, z0, z1, H - 0.035);
      const hs = []; for (const [cx, cz] of [[7, 15.6], [7, 23]]) { C.ring('cgoldM', cx, cz, 0.85, 1.0, 0, 6.283, H - 0.55, 24); C.wall('cgoldM', cx, cz, 1.0, 1.0, 0, 6.283, H - 0.62, H - 0.55, 24); B('cgoldM', cx - 0.02, cx + 0.02, H - 0.55, H - 0.03, cz - 0.02, cz + 0.02, 'xXzZ', 1);
        for (let r = 0.2; r <= 0.95; r += 0.25) { const n = Math.round(6.283 * r / 0.2); for (let i = 0; i < n; i++) { const a = i * 6.283 / n; hs.push([cx + r * Math.cos(a), cz + r * Math.sin(a), 0.3 + 0.5 * (1 - r)]); } } }
      const him = new THREE.InstancedMesh(sg, MATS.crystal, hs.length); hs.forEach(([x, z, L], i) => { o.position.set(x, H - 0.55, z); o.scale.set(1, L, 1); o.updateMatrix(); him.setMatrixAt(i, o.matrix); }); root.add(him);
    }
    // ---- the lounge bar: a ring of counter round the chandelier, open on the north for the bartenders ----
    { const cx = 37, cz = 27, gap = [Math.PI * 1.5 - 0.42, Math.PI * 1.5 + 0.42], segs = [[gap[1], gap[0] + 6.283]];
      for (const [a0, a1] of segs) { C.wall('cgoldM', cx, cz, 4.95, 4.95, a0, a1, 0, 1.02, 40); C.wall('cgoldM', cx, cz, 3.45, 3.45, a0, a1, 0, 1.02, 40, true);
        C.ring('cmarble', cx, cz, 3.35, 5.08, a0, a1, 1.1, 40); C.wall('cmarble', cx, cz, 5.08, 5.08, a0, a1, 1.02, 1.1, 40); C.wall('cmarble', cx, cz, 3.35, 3.35, a0, a1, 1.02, 1.1, 40, true);
        C.wall('cglow', cx, cz, 5.0, 5.0, a0, a1, 0.12, 0.17, 40); }
      for (const a of segs[0]) { const p = (r, y) => [cx + r * Math.cos(a), y, cz + r * Math.sin(a)], n = [-Math.sin(a), 0, Math.cos(a)].map(q => q * (a === segs[0][0] ? -1 : 1)); b('cmarble').quad(p(3.35, 0), p(5.08, 0), p(5.08, 1.1), p(3.35, 1.1), n, 0.5); }
      B('walnut', cx - 1.4, cx + 1.4, 0, 1.6, cz - 0.4, cz + 0.4, ALLF, 1);   // back bar island
      for (let i = 0; i < 18; i++) { const x = cx - 1.3 + (i % 9) * 0.32, z = cz + (i < 9 ? -0.25 : 0.25); B(i % 3 ? 'glass' : 'cgoldM', x - 0.04, x + 0.04, 1.6, 1.9 + (i % 4) * 0.04, z - 0.04, z + 0.04, ALLF, 1); }
      for (let k = 0; k < 18; k++) { if (k === 13 || k === 14) continue; const a = k * 6.283 / 18, x = cx + 5.6 * Math.cos(a), z = cz + 5.6 * Math.sin(a); C.wall('chrome', x, z, 0.04, 0.04, 0, 6.283, 0, 0.72, 6); C.fan('velvet', x, z, 0.2, 0.2, 0, 6.283, 0.74, 10); C.wall('velvet', x, z, 0.2, 0.2, 0, 6.283, 0.66, 0.74, 10); }
    }
    // ---- floor finishes: white marble paths through the navy carpet, striped rugs in the lounge ----
    flat('cmarble', 14.05, 59.95, 19.6, 21.0, 0.008, 0.3); flat('cmarble', 36.9, 39.7, 33.8, 47.95, 0.008, 0.3); flat('cmarble', 20.2, 53.8, 46.2, 47.95, 0.009, 0.3);
    C.ring('cmarble', 37, 27, 5.25, 6.9, 0, 6.283, 0.011, 48);
    for (const [x, z] of [[30, 22], [44, 22], [30, 32], [44, 32]]) b('rugW').quad([x - 1.9, 0.012, z - 0.9], [x + 1.9, 0.012, z - 0.9], [x + 1.9, 0.012, z + 0.9], [x - 1.9, 0.012, z + 0.9], [0, 1, 0], 1, [[0, 0], [2, 0], [2, 1], [0, 1]]);
    // ---- the porte-cochere: a curved white slab on four columns, ribbed underneath with light between the ribs ----
    { const Cn = CANOPY, zf = x => Cn.z1 - 3 * ((x - 36) / 18) ** 2, y0 = Cn.y, y1 = Cn.y + 0.6, step = 1.0;
      for (let x = Cn.x0; x < Cn.x1 - 1e-6; x += step) { const xa = x, xb = x + step, za = zf(xa), zb = zf(xb);
        b('podclad').quad([xa, y1, FOOT.z1], [xb, y1, FOOT.z1], [xb, y1, zb], [xa, y1, za], [0, 1, 0], 0.3); b('podclad').quad([xa, y0, FOOT.z1], [xb, y0, FOOT.z1], [xb, y0, zb], [xa, y0, za], [0, -1, 0], 0.3);
        const nz = [-(zb - za), 0, step], l = Math.hypot(nz[0], nz[2]); b('podclad').quad([xa, y0 - 0.5, za], [xb, y0 - 0.5, zb], [xb, y1 + 0.15, zb], [xa, y1 + 0.15, za], [nz[0] / l, 0, nz[2] / l], 0.5);
        b('podclad').quad([xa, y0 - 0.5, za - 0.12], [xb, y0 - 0.5, zb - 0.12], [xb, y0 - 0.5, zb], [xa, y0 - 0.5, za], [0, -1, 0], 0.5);
        B('podclad', xa + 0.44, xa + 0.56, y0 - 0.45, y0, FOOT.z1 + 0.6, za - 0.15, 'xXz', 1); b('cglow').quad([xa + 0.97, y0 - 0.01, FOOT.z1 + 0.8], [xa + 1.03, y0 - 0.01, FOOT.z1 + 0.8], [xa + 1.03, y0 - 0.01, Math.min(za, zb) - 0.3], [xa + 0.97, y0 - 0.01, Math.min(za, zb) - 0.3], [0, -1, 0]); }
      for (const x of [Cn.x0, Cn.x1]) b('podclad').box(x - 0.05, x + 0.05, y0 - 0.5, y1 + 0.15, FOOT.z1, zf(x), x < 36 ? 'x' : 'X', 0.5);
      plane(root, 'THE ASTERION', 10, 0.9, 36, y0 + 0.2, zf(36) + 0.03, 0, { bg: null, fg: '#c9a457', pw: 1024, ph: 96 });
      plane(root, 'THE ASTERION', 16, 1.6, 36, 5.4, FOOT.z1 + 0.57, 0, { bg: null, fg: '#d8b468', pw: 1024, ph: 104 });
      ao('lightpool', [24, 0.02, 58], [48, 0.02, 58], [48, 0.02, 74], [24, 0.02, 74], [0, 1, 0]); }
    // ---- signs inside ----
    plane(root, 'CASHIER', 4, 0.6, 59.88, 3.0, 13.5, -Math.PI / 2, { bg: '#0f1830', fg: '#d8b468' }); plane(root, 'HIGH LIMIT', 4, 0.6, 14.12, 3.1, 20, Math.PI / 2, { bg: '#0f1830', fg: '#d8b468' });
    plane(root, 'SECURITY', 1.4, 0.24, 59.88, 2.5, 25.6, -Math.PI / 2, { bg: '#20242c' }); plane(root, 'EMBER & OAK', 3.6, 0.5, 59.88, 3.0, 37, -Math.PI / 2, { bg: '#2a1a12', fg: '#e8c48a' });
    for (const x of [20.75, 36.75, 50.75]) plane(root, 'STAFF ONLY', 1.3, 0.22, x, 2.45, 8.12, 0, { bg: '#20242c' });
    for (const x of [27, 36, 45]) plane(root, 'EXIT', 0.6, 0.22, x, 2.5, 55.88, Math.PI, { bg: '#0f6b2c' });
    plane(root, 'SKY SUITES', 3, 0.45, 36, F3 + 2.7, 0.12, 0, { bg: '#0f1830', fg: '#d8b468' }); plane(root, 'PRESIDENTIAL', 1.6, 0.24, 34, F3 + 2.5, 10.88, Math.PI, { bg: '#0f1830', fg: '#d8b468' });
    plane(root, 'VAULT', 1.2, 0.24, 68.75, 2.6, 8.12, 0, { bg: '#3a3d42' }); plane(root, 'COUNT ROOM', 1.6, 0.24, 16.12, 2.6, 5.6, Math.PI / 2, { bg: '#3a3d42' });
    // ---- the tower's curved wings: the crescent carries on past each end of the playable middle, lit rooms behind blue glass ----
    { const D = WING.z1 - WING.z0, n = ARC.n * 2, band = 3 * H;
      const oq = (m, q, N, sc, uv) => { const u = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]], v = [q[3][0] - q[0][0], q[3][1] - q[0][1], q[3][2] - q[0][2]];   // a quad wound to face N
        const ok = (u[1] * v[2] - u[2] * v[1]) * N[0] + (u[2] * v[0] - u[0] * v[2]) * N[1] + (u[0] * v[1] - u[1] * v[0]) * N[2] > 0, f = a => ok ? a : [a[1], a[0], a[3], a[2]]; b(m).quad(...f(q), N, sc, uv ? f(uv) : null); };
      for (const side of [-1, 1]) { const P = (t, d, y) => { const [x, z] = arcPt(side, t, d); return [x, y, z]; };
        for (let i = 0; i < n; i++) { const t0 = ARC.a * i / n, t1 = ARC.a * (i + 1) / n, tm = (t0 + t1) / 2, inN = [-side * Math.sin(tm), 0, Math.cos(tm)];
          for (const [d, N] of [[0, inN], [D, inN.map(q => -q)]]) { const s0 = (ARC.r + d) * t0 / TILE, s1 = (ARC.r + d) * t1 / TILE, gx = (P(t0, d, 0)[0] + P(t1, d, 0)[0]) / 2, y0 = d === 0 && gx > FOOT.x0 && gx < FOOT.x1 ? POD : 0;
            const strip = (m, ya, yb, uv) => oq(m, [P(t0, d, ya), P(t1, d, ya), P(t1, d, yb), P(t0, d, yb)], N, 0.5, uv);
            strip('podclad', y0, band); strip('tglassT', band, ROOF, [[s0, band / TILE], [s1, band / TILE], [s1, ROOF / TILE], [s0, ROOF / TILE]]); strip('podclad', ROOF, ROOF + 1.1); }
          oq('roofM', [P(t0, 0, ROOF + 0.02), P(t0, D, ROOF + 0.02), P(t1, D, ROOF + 0.02), P(t1, 0, ROOF + 0.02)], [0, 1, 0], 0.1); }
        const e0 = P(ARC.a, 0, 0), e1 = P(ARC.a, D, 0); oq('podclad', [e0, e1, [e1[0], ROOF + 1.1, e1[2]], [e0[0], ROOF + 1.1, e0[2]]], [side * Math.cos(ARC.a), 0, Math.sin(ARC.a)], 0.2); }   // the end wall
      plane(root, 'THE ASTERION', 30, 2.8, 36, ROOF - 3.4, WING.z1 + 0.06, 0, { bg: null, fg: '#e8d29a', pw: 1024, ph: 96 }); }
    // ---- palms along the drive and the boulevard ----
    { const P = []; for (let x = 6; x <= 66; x += 7.5) P.push([x, 83.5]); for (const x of [3, 69]) for (const z of [61, 67, 73, 79]) P.push([x, z]); for (const z of [38, 46]) P.push([-3, z], [75, z]);
      const tg = new THREE.CylinderGeometry(0.16, 0.26, 9, 8); tg.translate(0, 4.5, 0); const fg = new THREE.PlaneGeometry(0.7, 3.4); fg.translate(0, 1.7, 0); fg.rotateX(-Math.PI / 2); fg.rotateX(-0.45);
      const tm = new THREE.InstancedMesh(tg, MATS.palmT, P.length), fm = new THREE.InstancedMesh(fg, MATS.palmF, P.length * 8), o = new THREE.Object3D(); let k = 0;
      P.forEach(([x, z], i) => { const hgt = 0.85 + rr() * 0.35; o.position.set(x, 0, z); o.rotation.set(0, 0, 0); o.scale.set(1, hgt, 1); o.updateMatrix(); tm.setMatrixAt(i, o.matrix);
        for (let j = 0; j < 8; j++) { o.position.set(x, 9 * hgt, z); o.scale.set(1, 1, 1); o.rotation.set(0, j * 0.785 + rr() * 0.3, 0); o.updateMatrix(); fm.setMatrixAt(k++, o.matrix); } });
      tm.castShadow = fm.castShadow = true; root.add(tm, fm); }
    // ---- the skyline: other towers along the boulevard, windows lit ----
    { skyM = new THREE.MeshBasicMaterial({ map: skyTex(), fog: false }); const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
      const T = [[-160, 60, 34, 120], [-230, 120, 40, 150], [-120, 170, 30, 95], [-300, 40, 50, 180], [220, 70, 36, 140], [290, 140, 44, 110], [180, 190, 30, 160], [340, -20, 48, 190], [-40, 230, 40, 130], [90, 250, 36, 175], [-260, -150, 50, 100], [260, -170, 44, 125], [120, -260, 60, 90], [-90, -280, 70, 110]];
      for (const [x, z, w, h] of T) { const m = new THREE.Mesh(geo, skyM); m.position.set(x, 0, z); m.scale.set(w, h, w * 0.7); hills.add(m); }
      for (const [x, z, r, h] of [[-380, -340, 240, 60], [380, -360, 260, 70], [0, -420, 300, 80], [-420, 300, 200, 40], [420, 320, 220, 45]]) { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7, 1), hillM); m.position.set(x, h / 2 - 3, z); hills.add(m); } }
    // ---- the helicopter and the CCTV wall ----
    heli = buildHeli(MATS); root.add(heli.g);
    cctv = buildCCTV(root);
  },
  // the helicopter's rotors turn; once nobody is aboard for a few seconds in a live mission it climbs away (and comes back for anyone who spawns in it).
  // The CCTV wall refreshes one camera at a time, only while someone stands in the security office with the power on.
  tick(dt, { S, head, officers, renderer, scene, level }) {
    if (MATS_SLOT) MATS_SLOT.uniforms.time.value = performance.now() / 1000;
    if (inner && inner.root.userData.zones) {   // show the casino floor and the suites only from where they can be seen
      const Z = inner.root.userData.zones, p = head.pos, live = !!S.mode, inCar = p.x > CAR.x0 && p.x < CAR.x1 && p.z > CAR.z0 && p.z < CAR.z1;
      const inPod = p.x > FOOT.x0 && p.x < FOOT.x1 && p.z > FOOT.z0 && p.z < FOOT.z1, showC = !live || inCar || p.y < POD + 2.6, showS = !live || inCar || !(inPod && p.y < POD - 0.3);
      if (showC !== inner.showC) { inner.showC = showC; for (const m of Z.casino || []) m.visible = showC; }
      if (showS !== inner.showS) { inner.showS = showS; for (const m of Z.suites || []) m.visible = showS; }
    }
    // from up the tower the casino's ceiling lights sit a hair under its roof, too close for a coarse depth buffer to separate: hide them from up there
    if (inner) { if (!inner.list) { const zz = inner.root.userData.zones || {}, zc = [...(zz.casino || []), ...(zz.suites || [])]; inner.list = [...inner.im, ...inner.root.children.filter(m => m.material === inner.mat)].filter(m => !zc.includes(m)); } /* the casino zone handles its own pieces */ const on = head.pos.y < 25; if (on !== inner.on) { inner.on = on; for (const m of inner.list) m.visible = on; } }
    if (lifts) for (const L of lifts) { const di = level.doors.findIndex(d => d.lift === L.k), to = S.doorOpen && S.doorOpen[di] ? 1 : 0; if (L.cur === to) continue; L.cur = L.cur < 0 ? to : L.cur + Math.sign(to - L.cur) * Math.min(Math.abs(to - L.cur), dt * 1.1);
      const e = L.cur * L.cur * (3 - 2 * L.cur); for (const d of L.doors) { d.o.position.z = d.s * 0.8 * e; d.o.scale.z = 1 - (d.inner ? 0.45 : 0.3) * e; /* the panels telescope as they open, so they stay inside the wall */ } }
    if (heli) { const h = heli; h.rotor.rotation.y += dt * 7; h.tail.rotation[h.tailAx || 'z'] += dt * 30; h.beacon.visible = (performance.now() % 1200) < 150;
      let aboard = head.pos.y > HELI.y + 0.6 && inHeli(head.pos.x, head.pos.z); if (!aboard) for (const o of officers.values()) { const p = o.head.position; if (p.y > HELI.y + 0.4 && inHeli(p.x, p.z)) { aboard = true; break; } }
      if (S.fly) { const o = FLY.at(S.fly.t), u = Math.min(1, S.fly.t / FLY.T); h.idle = 0; h.gone = 0; h.g.visible = true; h.g.position.set(h.home.x + o[0], h.home.y + o[1], h.home.z + o[2]);
        h.g.rotation.set(Math.sin(S.now * 0.9) * 0.012 * (1 - u), 0, 0.07 * Math.sin(Math.PI * Math.min(1, u * 1.15)));   // nose down coming in, flaring level at the hover
        h.rope.scale.y = Math.max(0.001, Math.min(1, (S.fly.t - FLY.T) / FLY.drop)); }
      else if (aboard || S.phase !== 'active') { h.idle = 0; h.gone = 0; h.g.visible = true; h.g.position.copy(h.home); h.g.rotation.set(0, 0, 0); h.rope.scale.y = 1; }
      else if ((h.idle += dt) > 6) { h.gone += dt; const t = h.gone; h.g.position.set(h.home.x - t * t * 0.9, h.home.y + t * 2.2 + t * t * 0.25, h.home.z - t * t * 0.4); h.g.rotation.set(0, Math.min(0.5, t * 0.08), Math.min(0.18, t * 0.05)); h.g.visible = t < 16; }
      if (h.g.visible) setRotor(h.g.localToWorld(v0.set(-0.8, 3.4, 0)), 1); }
    if (cctv && cctv.on && S.mode) { const p = head.pos; if (p.x > 60 && p.x < 72 && p.z > 20 && p.z < 32 && p.y < H) {
      if (cctv.n++ % 3 === 0) { const i = cctv.k++ % cctv.cams.length, xe = renderer.xr.enabled, rt = renderer.getRenderTarget(); renderer.xr.enabled = false;
        renderer.setRenderTarget(cctv.rts[i]); renderer.render(scene, cctv.cams[i]); renderer.setRenderTarget(rt); renderer.xr.enabled = xe; } } }
  },
};
const TILE = 8 * H, ALLF = 'xXyYzZ', v0 = new THREE.Vector3();
