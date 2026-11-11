// Characters (placeholder mannequins), remote officers, bombs, weapon models.
import * as THREE from '../vendor/three.module.min.js';
import { WIRE_HEX } from './shared.js';
const cache = new Map();
export const mat = c => cache.get(c) || cache.set(c, new THREE.MeshLambertMaterial({ color: c })).get(c);
const box = (w, h, d, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); return m; };

export function makeRifle() {
  const g = new THREE.Group(), k = 0x1b1d20;
  g.add(box(0.05, 0.07, 0.24, k, 0, 0.045, -0.04), box(0.046, 0.05, 0.3, 0x24272b, 0, 0.05, -0.3), box(0.02, 0.02, 0.16, k, 0, 0.05, -0.52), box(0.04, 0.06, 0.24, k, 0, 0.035, 0.2), box(0.034, 0.09, 0.04, k, 0, -0.03, 0.02));
  g.add(box(0.006, 0.03, 0.006, k, 0, 0.09, -0.42), box(0.004, 0.035, 0.03, k, -0.02, 0.1, -0.06), box(0.004, 0.035, 0.03, k, 0.02, 0.1, -0.06), box(0.044, 0.004, 0.03, k, 0, 0.118, -0.06), box(0.03, 0.02, 0.05, k, 0, 0.085, 0.09));
  const mag = box(0.03, 0.14, 0.055, 0x2c3035, 0, -0.06, -0.1); g.add(mag);
  const bolt = box(0.006, 0.02, 0.06, 0xd0a040, 0.026, 0.055, -0.05); bolt.visible = false; g.add(bolt);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd070 })); flash.position.set(0, 0.05, -0.64); flash.visible = false; g.add(flash);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2020, depthTest: false, transparent: true })); dot.position.set(0, 0.1, -40); dot.visible = false; dot.renderOrder = 20; g.add(dot);
  g.userData = { kind: 'rifle', mag, bolt, flash, dot, muzzle: new THREE.Vector3(0, 0.05, -0.6), magwell: new THREE.Vector3(0, -0.03, -0.1), rack: new THREE.Vector3(0, 0.085, 0.09), fore: new THREE.Vector3(0, 0.02, -0.3), sightY: 0.1 };
  return g;
}
export function makePistol() {
  const g = new THREE.Group(), k = 0x1b1d20;
  const slide = box(0.028, 0.035, 0.19, 0x26292d, 0, 0.045, -0.05); g.add(slide, box(0.03, 0.11, 0.045, k, 0, -0.02, 0.018), box(0.005, 0.012, 0.005, k, 0, 0.068, -0.135), box(0.014, 0.012, 0.005, k, 0, 0.068, 0.035));
  const mag = box(0.032, 0.012, 0.05, 0x3a3f45, 0, -0.08, 0.018); g.add(mag);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd070 })); flash.position.set(0, 0.045, -0.18); flash.visible = false; g.add(flash);
  g.userData = { kind: 'pistol', mag, slide, flash, muzzle: new THREE.Vector3(0, 0.045, -0.15), magwell: new THREE.Vector3(0, -0.09, 0.018), rack: new THREE.Vector3(0, 0.05, 0.03), sightY: 0.074 };
  return g;
}
export const makeMag = kind => kind === 'pistol' ? box(0.026, 0.11, 0.04, 0x3a3f45) : box(0.03, 0.14, 0.055, 0x2c3035);

const SUS = [[0x23262b, 0x1a1c20], [0x3b2f24, 0x20242a], [0x2a3327, 0x1c1c1c], [0x30303a, 0x242424]];
const CIV = [[0xc9c2b0, 0x4a5568], [0x8fa8c8, 0x3b3b3b], [0xc88f8f, 0x565a70], [0xd8d2c0, 0x6b5a48]];
export class Human {
  constructor(kind, v) {
    const s = kind === 's', [top, bottom] = (s ? SUS : CIV)[v % 4], skin = 0xc79a7b;
    const g = this.g = new THREE.Group(); g.rotation.order = 'YXZ'; const body = this.body = new THREE.Group(); g.add(body);
    this.upper = new THREE.Group(); this.upper.position.y = 0.9; body.add(this.upper);
    this.upper.add(box(0.42, 0.56, 0.24, top, 0, 0.3, 0), box(0.1, 0.08, 0.1, skin, 0, 0.62, 0));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), mat(s ? 0x15161a : skin)); head.position.y = 0.74; this.upper.add(head);
    if (s) this.upper.add(box(0.16, 0.035, 0.02, skin, 0, 0.76, 0.105));
    this.arms = [-1, 1].map(sx => { const a = new THREE.Group(); a.position.set(sx * 0.265, 0.52, 0); a.add(box(0.11, 0.6, 0.11, top, 0, -0.28, 0), box(0.09, 0.09, 0.09, skin, 0, -0.6, 0)); this.upper.add(a); return a; });
    this.legs = [-1, 1].map(sx => { const l = new THREE.Group(); l.position.set(sx * 0.1, 0.9, 0); l.add(box(0.16, 0.9, 0.18, bottom, 0, -0.45, 0)); body.add(l); return l; });
    body.add(box(0.4, 0.16, 0.23, bottom, 0, 0.86, 0));
    if (s) { this.gun = makeRifle(); this.gun.userData.dot.visible = false; this.gun.position.set(0, -0.6, 0.02); this.gun.rotation.set(-Math.PI / 2, 0, Math.PI); this.arms[1].add(this.gun); }
    this.kind = kind; this.st = ''; this.tx = 0; this.ty = 0; this.tz = 0; this.tyaw = 0; this.phase = 0; this.first = true; this.flashT = 0;
  }
  target(x, y, z, yaw, st, armed) {
    this.tx = x; this.ty = y; this.tz = z; this.tyaw = yaw;
    if (this.first) { this.g.position.set(x, y, z); this.g.rotation.y = yaw; this.first = false; }
    if (this.gun) this.gun.visible = !!armed;
    if (st !== this.st) { this.st = st; this.pose(); }
  }
  pose() {
    const s = this.st, kneel = s === 'k' || s === 'y' || s === 'u' || s === 'w', [l, r] = this.arms;
    this.g.rotation.x = s === 'd' ? -Math.PI / 2 : 0; this.yOff = s === 'd' ? 0.14 : 0;
    this.body.position.y = kneel ? -0.42 : 0; for (const leg of this.legs) { leg.scale.y = kneel ? 0.53 : 1; leg.rotation.x = 0; }
    this.upper.rotation.x = s === 'w' ? 0.55 : 0; l.rotation.z = r.rotation.z = 0;
    const ax = { g: -0.75, a: -1.1, c: -1.5, s: -3.0, k: -2.7, y: -2.7, u: 0.55, w: -2.5, d: -0.2 }[s] ?? 0;
    r.rotation.x = ax; l.rotation.x = (s === 'g' || s === 'a') ? -0.5 : ax; if (s === 'c') { l.rotation.z = 0.5; }
    if (s === 's' || s === 'k' || s === 'y') { l.rotation.z = -0.25; r.rotation.z = 0.25; }
  }
  update(dt) {
    const p = this.g.position, k = 1 - Math.exp(-12 * dt), dx = this.tx - p.x, dz = this.tz - p.z, sp = Math.hypot(dx, dz) / Math.max(dt, 1e-3) * k;
    p.x += dx * k; p.z += dz * k; p.y += (this.ty + (this.yOff || 0) - p.y) * k;
    let d = this.tyaw - this.g.rotation.y; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; this.g.rotation.y += d * k;
    const standing = this.st === 'g' || this.st === 'a' || this.st === 'c';
    if (standing && sp > 0.3) { this.phase += dt * 8; const a = Math.sin(this.phase) * 0.5; this.legs[0].rotation.x = a; this.legs[1].rotation.x = -a; } else if (standing) { this.legs[0].rotation.x *= 0.8; this.legs[1].rotation.x *= 0.8; }
    if (this.gun) { if (this.flashT > 0) { this.flashT -= dt; this.gun.userData.flash.visible = this.flashT > 0; } }
  }
  muzzle(out) { return out.set(this.g.position.x + Math.sin(this.g.rotation.y) * 0.6, this.g.position.y + 1.4, this.g.position.z + Math.cos(this.g.rotation.y) * 0.6); }
}

export class Officer {   // another player
  constructor(name, tag) {
    this.g = new THREE.Group();
    this.head = new THREE.Group(); const h = new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 8), mat(0x20242a)); this.head.add(h, box(0.2, 0.06, 0.03, 0x0a0a0a, 0, 0.01, -0.11));
    this.torso = box(0.44, 0.6, 0.26, 0x23272e); this.legs = box(0.34, 0.85, 0.2, 0x1c1f24);
    this.hands = [0, 1].map(() => { const g = new THREE.Group(); g.add(box(0.08, 0.1, 0.12, 0x15171a)); const r = makeRifle(), p = makePistol(), m = makeMag('rifle'); r.visible = p.visible = m.visible = false; g.add(r, p, m); g.userData = { items: [null, r, p, m] }; return g; });
    this.tag = tag; tag.position.y = 0.3; this.head.add(tag);
    this.g.add(this.head, this.torso, this.legs, ...this.hands); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(0, 0, 0, 'YXZ');
  }
  set(h, l, r, items, down) {
    if (!h) return; this.head.position.set(h[0], h[1], h[2]); this.q.set(h[3], h[4], h[5], h[6]); this.head.quaternion.slerp(this.q, 0.6);
    this.e.setFromQuaternion(this.q); const yaw = this.e.y;
    this.torso.position.set(h[0], h[1] - 0.5, h[2]); this.torso.rotation.y = yaw; this.legs.position.set(h[0], h[1] - 1.2, h[2]); this.legs.rotation.y = yaw; this.legs.visible = h[1] > 1.2 && !down;
    [l, r].forEach((a, i) => { const g = this.hands[i]; g.visible = !!a; if (!a) return; g.position.set(a[0], a[1], a[2]); g.quaternion.set(a[3], a[4], a[5], a[6]); g.userData.items.forEach((m, k) => { if (m) m.visible = k === (items ? items[i] : 0); }); });
  }
}

export class Bomb {
  constructor(x, y, z, wires, order) {
    const g = this.g = new THREE.Group(); g.position.set(x, y, z);
    g.add(box(0.34, 0.1, 0.22, 0x2b2b2b, 0, 0.05, 0), box(0.3, 0.02, 0.02, 0x8a1c1c, 0, 0.11, 0.1), box(0.3, 0.02, 0.02, 0x8a1c1c, 0, 0.11, 0));
    this.wires = wires.map((c, i) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.1, 6), mat(WIRE_HEX[c])); w.rotation.x = Math.PI / 2; w.position.set(-0.105 + i * 0.07, 0.125, 0.05); g.add(w); return w; });
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const k = c.getContext('2d'); k.fillStyle = '#111'; k.fillRect(0, 0, 256, 96); k.fillStyle = '#fff'; k.font = 'bold 30px sans-serif'; k.fillText('CUT', 10, 58);
    order.forEach((wi, n) => { k.fillStyle = '#' + WIRE_HEX[wires[wi]].toString(16).padStart(6, '0'); k.fillRect(90 + n * 80, 20, 60, 56); k.fillStyle = '#000'; k.fillText(String(n + 1), 110 + n * 80, 60); });
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.075), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) })); lab.rotation.x = -Math.PI / 2; lab.position.set(0, 0.102, -0.06); g.add(lab);
    this.led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff0000 })); this.led.position.set(0.145, 0.115, -0.06); g.add(this.led);
    this.defused = false; this.v = new THREE.Vector3();
  }
  wirePos(i, out) { return this.wires[i].getWorldPosition(out); }
  set(cutMask, defused) { this.wires.forEach((w, i) => { w.visible = cutMask[i] !== '1'; }); this.defused = !!defused; this.led.material.color.set(defused ? 0x00ff40 : 0xff0000); }
}
