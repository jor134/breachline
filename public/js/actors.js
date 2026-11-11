// Characters, the player's own body, weapons and bombs. Each rigid piece is one merged mesh with vertex colours (one draw call).
import * as THREE from '../vendor/three.module.min.js';
import { sheen, vertexSheen } from './mats.js';
import { WIRE_HEX } from './shared.js';

const geos = new Map();
const G = (key, make) => geos.get(key) || geos.set(key, make().toNonIndexed()).get(key);
const BOX = (w, h, d) => G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const CYL = (r, len, r2 = r, seg = 10, open = false) => G(`c${r},${len},${r2},${seg},${open}`, () => new THREE.CylinderGeometry(r2, r, len, seg, 1, open));
const CAP = (r, len) => G(`k${r},${len}`, () => new THREE.CapsuleGeometry(r, len, 3, 8));
const SPH = r => G(`s${r}`, () => new THREE.SphereGeometry(r, 12, 9));
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _c = new THREE.Color(), _v = new THREE.Vector3();
// part: [geometry, colour, x, y, z, rx, ry, rz]
export function merge(parts, gloss = 'satin') {
  const pos = [], nor = [], col = [];
  for (const [geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0] of parts) {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s); _n.getNormalMatrix(_m); _c.set(color);
    const pa = geo.attributes.position, na = geo.attributes.normal;
    for (let i = 0; i < pa.count; i++) { _v.fromBufferAttribute(pa, i).applyMatrix4(_m); pos.push(_v.x, _v.y, _v.z); _v.fromBufferAttribute(na, i).applyMatrix3(_n).normalize(); nor.push(_v.x, _v.y, _v.z); col.push(_c.r, _c.g, _c.b); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Mesh(g, vertexSheen(gloss));
}
const HP = Math.PI / 2;
const basic = c => new THREE.MeshBasicMaterial({ color: c });

// ---------- weapons ----------
let rifleGeo = null, rifleMagGeo = null;
export function makeRifle() {   // original M4-pattern carbine: flat-top, railed handguard, red-dot optic, light, suppressor
  const K = 0x17181a, TAN = 0x6f6352, GR = 0x2a2c2f, g = new THREE.Group();
  if (!rifleGeo) {
    rifleGeo = merge([
      [BOX(0.044, 0.05, 0.2), K, 0, 0.05, -0.04], [BOX(0.04, 0.045, 0.17), K, 0, 0.008, -0.035], [BOX(0.037, 0.06, 0.062), K, 0, -0.03, -0.1],
      [CYL(0.014, 0.19), K, 0, 0.05, 0.15, HP], [BOX(0.04, 0.085, 0.15), TAN, 0, 0.03, 0.2], [BOX(0.042, 0.11, 0.02), K, 0, 0.022, 0.283], [BOX(0.03, 0.02, 0.09), TAN, 0, -0.02, 0.17, -0.5],
      [BOX(0.032, 0.09, 0.04), K, 0, -0.052, 0.036, 0.32], [BOX(0.01, 0.006, 0.06), K, 0, -0.018, -0.03],
      [BOX(0.05, 0.052, 0.27), TAN, 0, 0.05, -0.275], [BOX(0.022, 0.008, 0.44), K, 0, 0.08, -0.17], [BOX(0.058, 0.02, 0.24), GR, 0, 0.05, -0.275], [BOX(0.02, 0.058, 0.24), GR, 0, 0.05, -0.275],
      [CYL(0.009, 0.1), K, 0, 0.05, -0.45, HP], [CYL(0.019, 0.17), 0x4f4b44, 0, 0.05, -0.565, HP], [CYL(0.016, 0.085, 0.013), K, 0, -0.018, -0.3],
      [BOX(0.03, 0.022, 0.05), K, 0, 0.094, -0.05], [CYL(0.021, 0.062, 0.021, 14, true), K, 0, 0.126, -0.05, HP], [CYL(0.008, 0.016), K, 0.024, 0.126, -0.05, 0, 0, HP], [BOX(0.03, 0.012, 0.03), K, 0, 0.106, -0.05],
      [BOX(0.04, 0.026, 0.075), TAN, 0, 0.097, -0.3], [CYL(0.013, 0.11), K, 0.04, 0.05, -0.36, HP], [CYL(0.016, 0.03), K, 0.04, 0.05, -0.425, HP], [CYL(0.011, 0.004), 0xfff4d0, 0.04, 0.05, -0.442, HP],
      [BOX(0.034, 0.014, 0.045), K, 0, 0.078, 0.075], [BOX(0.006, 0.026, 0.006), K, 0, 0.096, -0.39],
    ], 'metal').geometry;
    rifleMagGeo = merge([[BOX(0.027, 0.09, 0.056), GR, 0, -0.09, -0.1], [BOX(0.027, 0.08, 0.056), GR, 0, -0.165, -0.112, -0.28]], 'metal').geometry;
  }
  g.add(new THREE.Mesh(rifleGeo, vertexSheen('metal')));
  const mag = new THREE.Mesh(rifleMagGeo, vertexSheen('metal')); g.add(mag);
  const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.02, 0.06), basic(0xd0a040)); bolt.position.set(0.025, 0.055, -0.05); bolt.visible = false; g.add(bolt);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), basic(0xffd070)); flash.position.set(0, 0.05, -0.69); flash.visible = false; g.add(flash);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2020, depthTest: false, transparent: true, fog: false })); dot.position.set(0, 0.126, -40); dot.visible = false; dot.renderOrder = 20; g.add(dot);
  g.userData = { kind: 'rifle', mag, bolt, flash, dot, muzzle: new THREE.Vector3(0, 0.05, -0.65), light: new THREE.Vector3(0.04, 0.05, -0.45), magwell: new THREE.Vector3(0, -0.05, -0.1), rack: new THREE.Vector3(0, 0.078, 0.075), fore: new THREE.Vector3(0, -0.01, -0.3), sightY: 0.126 };
  return g;
}
let pistolGeo = null;
export function makePistol() {
  const K = 0x17181a, g = new THREE.Group();
  if (!pistolGeo) pistolGeo = merge([[BOX(0.03, 0.11, 0.046), K, 0, -0.02, 0.018, 0.2], [BOX(0.028, 0.02, 0.15), K, 0, 0.022, -0.045], [BOX(0.008, 0.03, 0.05), K, 0, -0.003, -0.02], [BOX(0.026, 0.02, 0.05), 0x24262a, 0, 0.005, -0.1]], 'plastic').geometry;
  g.add(new THREE.Mesh(pistolGeo, vertexSheen('plastic')));
  const slide = merge([[BOX(0.029, 0.03, 0.19), 0x2a2d31, 0, 0, 0], [BOX(0.005, 0.012, 0.005), 0xf0f0f0, 0, 0.02, -0.085], [BOX(0.016, 0.012, 0.006), K, 0, 0.02, 0.085]], 'metal'); slide.position.set(0, 0.047, -0.05); g.add(slide);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.012, 0.05), sheen({ color: 0x3a3f45 }, 'metal')); mag.position.set(0, -0.082, 0.03); g.add(mag);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), basic(0xffd070)); flash.position.set(0, 0.045, -0.18); flash.visible = false; g.add(flash);
  g.userData = { kind: 'pistol', mag, slide, slideZ: -0.05, flash, muzzle: new THREE.Vector3(0, 0.045, -0.15), light: new THREE.Vector3(0, 0.02, -0.15), magwell: new THREE.Vector3(0, -0.09, 0.03), rack: new THREE.Vector3(0, 0.05, 0.03), sightY: 0.074 };
  return g;
}
export const makeMag = kind => kind === 'pistol' ? new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.11, 0.04), sheen({ color: 0x3a3f45 }, 'metal')) : new THREE.Mesh(merge([[BOX(0.027, 0.09, 0.056), 0x2a2c2f, 0, 0.02, 0], [BOX(0.027, 0.08, 0.056), 0x2a2c2f, 0, -0.055, -0.012, -0.28]], 'metal').geometry, vertexSheen('metal'));

export function makeTool(kind) {
  const ST = 0xb8bcc2, K = 0x17181a, R = 0xb02a2a;
  return kind === 'pick' ? merge([[BOX(0.02, 0.022, 0.09), K, 0, 0, 0.03], [CYL(0.0025, 0.1), ST, 0, 0.004, -0.06, HP], [BOX(0.004, 0.012, 0.004), ST, 0, 0.01, -0.108], [BOX(0.006, 0.003, 0.1), ST, 0.012, -0.008, -0.04], [BOX(0.006, 0.02, 0.003), ST, 0.012, 0.0, -0.09]], 'metal')
    : merge([[BOX(0.016, 0.016, 0.11), R, -0.016, 0, 0.045, 0, 0.14], [BOX(0.016, 0.016, 0.11), R, 0.016, 0, 0.045, 0, -0.14], [CYL(0.01, 0.014), ST, 0, 0, -0.012], [BOX(0.01, 0.012, 0.05), ST, -0.006, 0, -0.04, 0, -0.08], [BOX(0.01, 0.012, 0.05), ST, 0.006, 0, -0.04, 0, 0.08]], 'plastic');
}

// ---------- people ----------
const SKIN = [0x8a5a3c, 0xc79a7b, 0x6b4630, 0xd8ad8c];
// suspects: v even = field jacket, face wrap, sunglasses, backpack; v odd = hooded sweatshirt and bandana. Colours vary per suspect.
const JACKET = [[0x5f6340, 0x33291f, 0x1f232b, 0x8b8b86], [0x4a4f5c, 0x2a2a2a, 0x2b2f38, 0x6e6a60]];
const HOODIE = [[0x2e2e30, 0x4a4b4e, 0x7a3fa0, 0x2aa0b0], [0x3b3f48, 0x2a2c30, 0xa03030, 0x1a1a1a]];
const CIVC = [[0xd9d2c2, 0x4a5568, 0x3a2a1c], [0x8fa8c8, 0x3b3b3b, 0x151515], [0xc88f8f, 0x565a70, 0x6a4a2a], [0xe0d8c8, 0x6b5a48, 0x9a9a9a]];
export class Human {
  constructor(kind, v) {
    const s = kind === 's', skin = SKIN[v % 4]; let up, sleeve, hand, leg, shoe, sole = 0xe8e8e8;
    if (s && v % 2 === 0) {
      const [jk, inner, jeans, wrap] = JACKET[(v >> 1) % 2]; sleeve = jk; hand = skin; leg = jeans; shoe = 0x3a2e26;
      up = [[BOX(0.45, 0.56, 0.27), jk, 0, 0.3, 0], [BOX(0.47, 0.1, 0.29), jk, 0, 0.03, 0], [BOX(0.11, 0.52, 0.02), inner, 0, 0.3, 0.136], [BOX(0.12, 0.09, 0.02), jk, -0.14, 0.4, 0.14], [BOX(0.12, 0.09, 0.02), jk, 0.14, 0.4, 0.14], [BOX(0.13, 0.11, 0.02), jk, -0.14, 0.13, 0.14], [BOX(0.13, 0.11, 0.02), jk, 0.14, 0.13, 0.14],
        [BOX(0.3, 0.4, 0.15), 0x4a3d2c, 0, 0.3, -0.2], [BOX(0.04, 0.5, 0.02), 0x4a3d2c, -0.15, 0.33, 0.137], [BOX(0.04, 0.5, 0.02), 0x4a3d2c, 0.15, 0.33, 0.137],
        [CYL(0.1, 0.14, 0.085), wrap, 0, 0.62, 0], [SPH(0.118), wrap, 0, 0.75, 0], [BOX(0.15, 0.05, 0.03), skin, 0, 0.77, 0.095], [BOX(0.17, 0.042, 0.03), 0x0c0c0c, 0, 0.775, 0.108], [BOX(0.17, 0.1, 0.05), wrap, 0, 0.7, 0.09]];
    } else if (s) {
      const [hd, jeans, band, glove] = HOODIE[(v >> 1) % 2]; sleeve = hd; hand = glove; leg = jeans; shoe = 0x8a7a66; sole = 0x8a7a66;
      up = [[BOX(0.47, 0.6, 0.28), hd, 0, 0.29, 0], [BOX(0.27, 0.13, 0.02), hd, 0, 0.1, 0.146], [BOX(0.47, 0.06, 0.29), hd, 0, 0.01, 0],
        [CYL(0.11, 0.12, 0.1), hd, 0, 0.62, 0], [SPH(0.138), hd, 0, 0.755, -0.012], [BOX(0.13, 0.05, 0.03), skin, 0, 0.785, 0.112], [BOX(0.16, 0.09, 0.04), band, 0, 0.715, 0.108], [CYL(0.075, 0.1, 0.005, 4), band, 0, 0.635, 0.105, Math.PI, 0.785]];
    } else {
      const [shirt, pants, hair] = CIVC[v % 4]; sleeve = shirt; hand = skin; leg = pants; shoe = 0x2a2a2a;
      up = [[BOX(0.42, 0.56, 0.24), shirt, 0, 0.3, 0], [CYL(0.05, 0.1), skin, 0, 0.62, 0], [SPH(0.112), skin, 0, 0.74, 0], [BOX(0.2, 0.09, 0.21), hair, 0, 0.82, -0.015], [BOX(0.2, 0.14, 0.05), hair, 0, 0.74, -0.095]];
    }
    // Skeleton: root > body > hips, two legs (hip > thigh, knee > shin + shoe), upper (torso + head) > two arms (shoulder > upper arm, elbow > forearm + hand).
    const g = this.g = new THREE.Group(); g.rotation.order = 'YXZ'; const body = this.body = new THREE.Group(); g.add(body);
    this.upper = new THREE.Group(); this.upper.position.y = 0.9; body.add(this.upper); this.upper.add(merge(up, 'cloth'));
    this.arms = [-1, 1].map(sx => { const sh = new THREE.Group(), el = new THREE.Group(); sh.position.set(sx * 0.275, 0.5, 0); el.position.y = -0.3; sh.add(merge([[CAP(0.056, 0.2), sleeve, 0, -0.15, 0]], 'cloth'), el); el.add(merge([[CAP(0.05, 0.18), sleeve, 0, -0.13, 0], [SPH(0.05), hand, 0, -0.29, 0]], 'cloth')); this.upper.add(sh); return { sh, el }; });
    this.legs = [-1, 1].map(sx => { const hip = new THREE.Group(), knee = new THREE.Group(); hip.position.set(sx * 0.1, 0.9, 0); knee.position.y = -0.43; hip.add(merge([[CAP(0.082, 0.28), leg, 0, -0.2, 0]], 'cloth'), knee); knee.add(merge([[CAP(0.07, 0.28), leg, 0, -0.2, 0], [BOX(0.11, 0.07, 0.26), shoe, 0, -0.42, 0.05], [BOX(0.115, 0.025, 0.265), sole, 0, -0.46, 0.05]], 'cloth')); body.add(hip); return { hip, knee }; });
    body.add(merge([[BOX(0.4, 0.18, 0.24), leg, 0, 0.86, 0]], 'cloth'));
    if (s) { this.gun = makeRifle(); this.gun.position.set(0, -0.3, 0.03); this.gun.rotation.set(-HP, 0, Math.PI); this.arms[1].el.add(this.gun); }
    this.kind = kind; this.st = ''; this.first = true; this.flashT = 0; this.flinch = 0; this.phase = Math.random() * 6; this.idle = Math.random() * 9; this.speed = 0;
    this.p0 = new THREE.Vector3(); this.p1 = new THREE.Vector3(); this.y0 = 0; this.y1 = 0; this.it = 0; this.dur = 0.07; this.lastT = 0;
    this.cur = Object.assign({}, REST); this.tgt = Object.assign({}, REST);
  }
  // A new server position arrives ~15 times a second: glide to it at constant speed over one interval instead of chasing it.
  target(x, y, z, yaw, st, armed) {
    const now = performance.now() / 1000;
    if (this.first) { this.g.position.set(x, y, z); this.g.rotation.y = yaw; this.first = false; this.lastT = now - 0.07; }
    this.dur = Math.max(0.04, Math.min(0.2, now - this.lastT)); this.lastT = now; this.it = 0;
    this.p0.copy(this.g.position); this.p0.y -= this.cur.yOff; this.p1.set(x, y, z); this.y0 = this.g.rotation.y; let d = yaw - this.y0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; this.y1 = this.y0 + d;
    if (this.gun) this.gun.visible = !!armed;
    if (st !== this.st) { this.st = st; this.tgt = Object.assign({}, REST, POSE[st]); }
  }
  update(dt) {
    const p = this.g.position, px = p.x, pz = p.z; this.it += dt; const a = Math.min(1.25, this.it / this.dur);
    p.x = this.p0.x + (this.p1.x - this.p0.x) * a; p.z = this.p0.z + (this.p1.z - this.p0.z) * a; const baseY = this.p0.y + (this.p1.y - this.p0.y) * Math.min(1, a); this.g.rotation.y = this.y0 + (this.y1 - this.y0) * Math.min(1, a);
    const moved = Math.hypot(p.x - px, p.z - pz); this.speed += (moved / Math.max(dt, 1e-3) - this.speed) * Math.min(1, dt * 8);
    // blend joints toward the pose for the current state (falling over is slower than raising a rifle)
    const c = this.cur, t = this.tgt, k = 1 - Math.exp(-9 * dt), kl = 1 - Math.exp(-5.5 * dt);
    for (const j in c) c[j] += (t[j] - c[j]) * (j === 'lie' || j === 'yOff' || j === 'drop' ? kl : k);
    // layered motion: walk cycle scaled by real ground speed (so feet do not slide), breathing, weight shift, flinch, recoil
    const st = this.st, up = st === 'g' || st === 'a' || st === 'c', w = up ? Math.min(1, this.speed / 1.3) : 0, run = up ? Math.max(0, Math.min(1, (this.speed - 1.6) / 1.4)) : 0;
    if (up) this.phase += moved * (2 * Math.PI / (1.25 + 0.5 * run)); this.idle += dt;
    const ph = this.phase, A = (0.42 + 0.25 * run) * w, br = Math.sin(this.idle * 1.6) * 0.012, sway = up ? Math.sin(this.idle * 0.55) * 0.02 * (1 - w) : 0, hurt = st === 'i' ? Math.sin(this.idle * 2.2) * 0.1 : 0;
    this.flinch = Math.max(0, this.flinch - dt * 4); const fl = this.flinch * this.flinch, kick = this.flashT > 0 ? 0.07 : 0;
    const [L, R] = this.legs;
    L.hip.rotation.x = c.hl - A * Math.sin(ph); L.knee.rotation.x = c.kl + (0.25 + 0.75 * Math.max(0, Math.cos(ph))) * A * 1.5;
    R.hip.rotation.x = c.hr + A * Math.sin(ph); R.knee.rotation.x = c.kr + (0.25 + 0.75 * Math.max(0, -Math.cos(ph))) * A * 1.5;
    this.body.position.y = c.drop - Math.abs(Math.sin(ph)) * 0.035 * w - 0.02 * w; this.body.rotation.z = sway;
    this.upper.rotation.set(c.spine + 0.07 * w + 0.12 * run + br + fl * 0.25, Math.sin(ph) * 0.07 * w + fl * 0.4, -Math.sin(ph) * 0.03 * w - sway);
    const [la, ra] = this.arms, bob = Math.sin(ph * 2) * 0.04 * w;
    la.sh.rotation.set(c.slx + bob + br + hurt - kick, 0, c.slz); la.el.rotation.x = c.el; ra.sh.rotation.set(c.srx + bob + br - kick, 0, c.srz); ra.el.rotation.x = c.er - kick;
    this.g.rotation.x = c.lie; p.y = baseY + c.yOff;
    if (this.gun) { if (this.flashT > 0) this.flashT -= dt; this.gun.userData.flash.visible = this.flashT > 0; }
  }
  muzzle(out) { return out.set(this.g.position.x + Math.sin(this.g.rotation.y) * 0.6, this.g.position.y + 1.35, this.g.position.z + Math.cos(this.g.rotation.y) * 0.6); }
}
// Joint angles per state. h = hip, k = knee, s?x/s?z = shoulder swing / spread, e = elbow, l / r = left / right.
const REST = { hl: 0, hr: 0, kl: 0, kr: 0, slx: 0, slz: 0, srx: 0, srz: 0, el: 0, er: 0, spine: 0, drop: 0, lie: 0, yOff: 0 };
const KN = { kl: 1.65, kr: 1.65, drop: -0.42 }, UPH = { slx: -2.6, srx: -2.6, el: -0.5, er: -0.5, slz: -0.3, srz: 0.3 }, BACK = { slx: 0.55, srx: 0.55, el: 0.4, er: 0.4, slz: 0.25, srz: -0.25 };
const POSE = {
  g: { srx: -0.2, er: -1.0, slx: -0.85, slz: 0.5, el: -0.8 }, a: { srx: -0.5, er: -1.0, slx: -1.05, slz: 0.5, el: -0.75, spine: 0.06 }, c: { srx: -1.05, er: -0.55, slx: -1.3, slz: 0.5, el: -0.35, spine: 0.1, kl: 0.12, kr: 0.12, hl: -0.1, hr: 0.14, drop: -0.02 },
  s: UPH, k: Object.assign({}, UPH, KN), y: Object.assign({}, UPH, KN), u: Object.assign({}, BACK, KN), w: Object.assign({ slx: -2.3, srx: -2.3, el: -1.7, er: -1.7, spine: 0.55 }, KN),
  d: { lie: -HP, yOff: 0.15, slx: -0.2, slz: -0.7, srx: -0.3, srz: 0.5, kl: 0.2, kr: 0.5, hr: -0.25 }, i: { lie: -HP, yOff: 0.15, slx: -0.5, slz: -0.6, srx: -0.2, srz: 0.4, kl: 0.6, hl: -0.4, kr: 0.15 }, j: Object.assign({ lie: HP, yOff: 0.15 }, BACK),
};

// ---------- officer body: vest, belt, holders, legs, and arms that reach to the hands ----------
// Offsets are from the head, with -z forward. These are also the grab zones used by the game.
export const RIG = { pistol: [0.24, -0.72, 0.02], rifle: [0.03, -0.42, -0.2], pouch: [-0.2, -0.62, -0.16], radio: [-0.13, -0.3, -0.1] };
const UPY = new THREE.Vector3(0, 1, 0), a1 = new THREE.Vector3(), a2 = new THREE.Vector3(), a3 = new THREE.Vector3(), a4 = new THREE.Vector3();
let torsoGeo = null, legGeo = null, gloveGeo = null, limbGeo = null;
export class Body {
  constructor() {
    const NAVY = 0x1b2230, VEST = 0x15181d, WEB = 0x23272e;
    if (!torsoGeo) {
      torsoGeo = merge([
        [BOX(0.4, 0.56, 0.2), NAVY, 0, -0.52, 0.08], [BOX(0.35, 0.42, 0.25), VEST, 0, -0.47, 0.08], [BOX(0.07, 0.08, 0.22), VEST, -0.13, -0.25, 0.08], [BOX(0.07, 0.08, 0.22), VEST, 0.13, -0.25, 0.08],
        [BOX(0.2, 0.05, 0.006), 0xc9ccd2, 0, -0.34, -0.047], [BOX(0.2, 0.05, 0.006), 0xc9ccd2, 0, -0.34, 0.207], [BOX(0.11, 0.1, 0.11), NAVY, -0.24, -0.27, 0.08], [BOX(0.11, 0.1, 0.11), NAVY, 0.24, -0.27, 0.08],
        [BOX(0.43, 0.06, 0.27), WEB, 0, -0.76, 0.08],
        [BOX(0.06, 0.13, 0.045), WEB, -0.27, -0.64, -0.07], [BOX(0.06, 0.13, 0.045), WEB, -0.2, -0.64, -0.075], [BOX(0.06, 0.13, 0.045), WEB, -0.13, -0.64, -0.075], [BOX(0.028, 0.03, 0.05), 0x2a2c2f, -0.27, -0.565, -0.07], [BOX(0.028, 0.03, 0.05), 0x2a2c2f, -0.2, -0.565, -0.075], [BOX(0.028, 0.03, 0.05), 0x2a2c2f, -0.13, -0.565, -0.075],
        [BOX(0.06, 0.11, 0.04), 0x0e0f11, -0.13, -0.3, -0.065], [CYL(0.006, 0.12), 0x0e0f11, -0.15, -0.2, -0.065], [BOX(0.02, 0.02, 0.008), 0x30d060, -0.115, -0.265, -0.087],
        [BOX(0.07, 0.17, 0.11), 0x0e0f11, 0.245, -0.78, 0.04], [BOX(0.09, 0.07, 0.04), WEB, 0.1, -0.67, -0.06], [BOX(0.07, 0.012, 0.045), 0xe8e8e8, 0.1, -0.63, -0.06],
        [BOX(0.09, 0.09, 0.05), WEB, 0.02, -0.66, -0.06],
      ], 'cloth').geometry;
      legGeo = merge([[CAP(0.085, 0.72), NAVY, -0.1, -1.2, 0.08], [CAP(0.085, 0.72), NAVY, 0.1, -1.2, 0.08], [BOX(0.11, 0.1, 0.28), 0x0e0f11, -0.1, -1.62, 0.04], [BOX(0.11, 0.1, 0.28), 0x0e0f11, 0.1, -1.62, 0.04]], 'cloth').geometry;
      gloveGeo = merge([[BOX(0.085, 0.034, 0.105), 0x121315, 0, -0.012, 0.035], [BOX(0.08, 0.028, 0.05), 0x1c1e22, 0, -0.012, -0.035], [BOX(0.028, 0.028, 0.06), 0x121315, 0, 0.005, 0.0, 0, 0.7], [BOX(0.075, 0.04, 0.05), 0x1b2230, 0, -0.012, 0.11]], 'plastic').geometry;
      limbGeo = new THREE.CylinderGeometry(0.036, 0.045, 1, 8);
    }
    const g = this.g = new THREE.Group(), cloth = vertexSheen('cloth');
    this.torso = new THREE.Mesh(torsoGeo, cloth); this.legs = new THREE.Mesh(legGeo, cloth); g.add(this.torso, this.legs);
    const sleeve = sheen({ color: NAVY }, 'cloth');
    this.arms = [-1, 1].map(sx => { const up = new THREE.Mesh(limbGeo, sleeve), fore = new THREE.Mesh(limbGeo, sleeve), glove = new THREE.Mesh(gloveGeo, vertexSheen('plastic')); glove.scale.x = sx; g.add(up, fore, glove); return { sx, up, fore, glove }; });
  }
  // hands: [left, right], each { pos, quat } or null
  update(headPos, yaw, hands, feetY) {
    const s = Math.sin(yaw), c = Math.cos(yaw);
    this.torso.position.set(headPos.x + s * 0.05, headPos.y, headPos.z + c * 0.05); this.torso.rotation.y = yaw; this.legs.position.copy(this.torso.position); this.legs.rotation.y = yaw; this.legs.visible = headPos.y - feetY > 1.25;
    this.arms.forEach((a, i) => {
      const h = hands[i]; a.up.visible = a.fore.visible = a.glove.visible = !!h; if (!h) return;
      const sh = a1.set(a.sx * 0.21, -0.24, 0.13).applyAxisAngle(UPY, yaw).add(headPos); a.glove.position.copy(h.pos); a.glove.quaternion.copy(h.quat);
      const wrist = a2.set(0, -0.012, 0.13).applyQuaternion(h.quat).add(h.pos), dir = a3.copy(wrist).sub(sh), d = Math.max(0.05, dir.length()); dir.multiplyScalar(1 / d);
      const L1 = 0.3, L2 = 0.29, dd = Math.min(d, L1 + L2 - 0.005), along = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd), out = Math.sqrt(Math.max(0, L1 * L1 - along * along));
      const pole = a4.set(a.sx * 0.55 * c + 0.35 * s, -0.8, -a.sx * 0.55 * s + 0.35 * c); pole.addScaledVector(dir, -pole.dot(dir)).normalize();
      const el = pole.multiplyScalar(out).addScaledVector(dir, along).add(sh);
      this.limb(a.up, sh, el); this.limb(a.fore, el, wrist);
    });
  }
  limb(m, p, q) { const d = _v.copy(q).sub(p), len = Math.max(0.01, d.length()); m.position.copy(p).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(UPY, d.multiplyScalar(1 / len)); m.scale.set(1, len, 1); }
}

export class Officer {   // another player
  constructor(name, tag) {
    this.g = new THREE.Group();
    this.head = merge([[SPH(0.125), 0x20242a, 0, 0.01, 0], [BOX(0.2, 0.06, 0.03), 0x0a0a0a, 0, 0.0, -0.11], [BOX(0.15, 0.09, 0.02), 0xc79a7b, 0, -0.06, -0.1], [BOX(0.27, 0.06, 0.1), 0x15181d, 0, 0.0, 0]], 'plastic');
    this.body = new Body();
    this.items = [0, 1].map(() => { const g = new THREE.Group(), r = makeRifle(), p = makePistol(), m = makeMag('rifle'); r.visible = p.visible = m.visible = false; g.add(r, p, m); g.userData = { items: [null, r, p, m] }; return g; });
    this.tag = tag; tag.position.y = 0.3; this.head.add(tag);
    this.g.add(this.head, this.body.g, ...this.items); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(0, 0, 0, 'YXZ'); this.hp = [{ pos: new THREE.Vector3(), quat: new THREE.Quaternion() }, { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }];
  }
  set(h, l, r, items, down) {
    if (!h) return; this.head.position.set(h[0], h[1], h[2]); this.q.set(h[3], h[4], h[5], h[6]); this.head.quaternion.slerp(this.q, 0.6); this.e.setFromQuaternion(this.q);
    const hands = [l, r].map((a, i) => { const g = this.items[i]; g.visible = !!a; if (!a) return null; const o = this.hp[i]; o.pos.set(a[0], a[1], a[2]); o.quat.set(a[3], a[4], a[5], a[6]); g.position.copy(o.pos); g.quaternion.copy(o.quat); g.userData.items.forEach((m, k) => { if (m) m.visible = k === (items ? items[i] : 0); }); return o; });
    this.body.update(this.head.position, this.e.y, hands, down ? 99 : h[1] - 1.7);
  }
}

export class Bomb {
  constructor(x, y, z, wires, order) {
    const g = this.g = new THREE.Group(); g.position.set(x, y, z);
    g.add(merge([[BOX(0.34, 0.1, 0.22), 0x2b2b2b, 0, 0.05, 0], [BOX(0.3, 0.02, 0.02), 0x8a1c1c, 0, 0.11, 0.1], [BOX(0.3, 0.02, 0.02), 0x8a1c1c, 0, 0.11, 0]], 'plastic'));
    this.wires = wires.map((c, i) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.1, 6), sheen({ color: WIRE_HEX[c] }, 'plastic')); w.rotation.x = HP; w.position.set(-0.105 + i * 0.07, 0.125, 0.05); g.add(w); return w; });
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const k = c.getContext('2d'); k.fillStyle = '#111'; k.fillRect(0, 0, 256, 96); k.fillStyle = '#fff'; k.font = 'bold 30px sans-serif'; k.fillText('CUT', 10, 58);
    order.forEach((wi, n) => { k.fillStyle = '#' + WIRE_HEX[wires[wi]].toString(16).padStart(6, '0'); k.fillRect(90 + n * 80, 20, 60, 56); k.fillStyle = '#000'; k.fillText(String(n + 1), 110 + n * 80, 60); });
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.075), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) })); lab.rotation.x = -HP; lab.position.set(0, 0.102, -0.06); g.add(lab);
    this.led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff0000 })); this.led.position.set(0.145, 0.115, -0.06); g.add(this.led);
    this.defused = false;
  }
  wirePos(i, out) { return this.wires[i].getWorldPosition(out); }
  set(cutMask, defused) { this.wires.forEach((w, i) => { w.visible = cutMask[i] !== '1'; }); this.defused = !!defused; this.led.material.color.set(defused ? 0x00ff40 : 0xff0000); }
}
