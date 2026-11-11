// Procedural weather and air: rain streaks and splashes, drifting ground mist, dust motes, lightning. No textures or samples.
import * as THREE from '../vendor/three.module.min.js';
import { inFoot, terrainY, H } from './core/level.js';

export function makeWeather(scene) {
  const NR = 2200, R = 11, NS = 150, NM = 44, ND = 150, r = () => Math.random();
  // rain: line streaks in a box that follows the player; drops stop at roofs and ground, so it never rains indoors
  const drop = new Float32Array(NR * 3), rpos = new Float32Array(NR * 6), rgeo = new THREE.BufferGeometry(); rgeo.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
  const rain = new THREE.LineSegments(rgeo, new THREE.LineBasicMaterial({ color: 0xaec4d8, transparent: true, opacity: 0.5, depthWrite: false })); rain.frustumCulled = false; rain.visible = false; scene.add(rain);
  for (let i = 0; i < NR; i++) { drop[i * 3] = (r() * 2 - 1) * R; drop[i * 3 + 1] = r() * 16 - 4; drop[i * 3 + 2] = (r() * 2 - 1) * R; }
  const points = (n, size, opacity, map) => { const a = new Float32Array(n * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size, sizeAttenuation: true, transparent: true, opacity, depthWrite: false, map: map || null })); p.frustumCulled = false; p.visible = false; scene.add(p); return { a, p, g }; };
  const splash = points(NS, 0.06, 0.55), life = new Float32Array(NS);
  const soft = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const mist = points(NM, 9, 0.1, soft); for (let i = 0; i < NM; i++) { mist.a[i * 3] = (r() * 2 - 1) * 22; mist.a[i * 3 + 1] = 0; mist.a[i * 3 + 2] = (r() * 2 - 1) * 22; }
  const dust = points(ND, 0.016, 0.32, soft), dv = new Float32Array(ND * 3); for (let i = 0; i < ND * 3; i++) { dust.a[i] = (r() * 2 - 1) * 4; dv[i] = (r() - 0.5) * 0.06; } dust.p.visible = true;
  const bolt = new THREE.DirectionalLight(0xcfdcff, 0); bolt.position.set(20, 60, -40); scene.add(bolt);
  const S = { wx: 'clear', n: 0, wind: [0, 0], boltT: 0, next: 9, inside: false, first: true };
  return {
    state: S,
    set(wx, night, nvg) {
      S.wx = wx; const wet = wx === 'rain' || wx === 'storm'; S.n = wx === 'storm' ? NR : wx === 'rain' ? 1300 : 0; rgeo.setDrawRange(0, S.n * 2); rain.visible = splash.p.visible = wet; S.wind = wx === 'storm' ? [5.5, 2.5] : [1.4, 0.6];
      mist.p.visible = wx === 'fog' || wet; mist.p.material.opacity = wx === 'fog' ? 0.12 : 0.045;
      const tint = nvg ? 0x7dff8c : night ? 0x7f93a8 : 0xbfd0e0; rain.material.color.set(tint); splash.p.material.color.set(tint); mist.p.material.color.set(nvg ? 0x3c9a48 : night ? 0x39424e : 0xb9c0c8); dust.p.material.color.set(nvg ? 0x9cffac : 0xfff1d8); dust.p.material.opacity = night && !nvg ? 0.14 : 0.32;
    },
    // returns lightning brightness 0..1 this frame
    update(dt, head, onThunder) {
      const hx = head.x, hy = head.y, hz = head.z, [wx, wz] = S.wind; S.inside = inFoot(hx, hz) && hy < 2 * H;
      for (let i = 0; i < S.n; i++) {
        const k = i * 3; let x = drop[k] + wx * dt, y = drop[k + 1] - (15 + (i % 7)) * dt, z = drop[k + 2] + wz * dt;
        if (x - hx > R) x -= 2 * R; else if (x - hx < -R) x += 2 * R; if (z - hz > R) z -= 2 * R; else if (z - hz < -R) z += 2 * R;
        if (y < (inFoot(x, z) ? 2 * H + 0.3 : terrainY(z)) || S.first) { x = hx + (r() * 2 - 1) * R; z = hz + (r() * 2 - 1) * R; y = hy + 6 + r() * 6; }
        drop[k] = x; drop[k + 1] = y; drop[k + 2] = z; const j = i * 6; rpos[j] = x; rpos[j + 1] = y; rpos[j + 2] = z; rpos[j + 3] = x - wx * 0.022; rpos[j + 4] = y + 0.34; rpos[j + 5] = z - wz * 0.022;
      }
      S.first = false; if (S.n) rgeo.attributes.position.needsUpdate = true;
      if (splash.p.visible) { for (let i = 0; i < NS; i++) { if ((life[i] -= dt) > 0) continue; life[i] = 0.08 + r() * 0.12; let x = hx + (r() * 2 - 1) * 9, z = hz + (r() * 2 - 1) * 9; const roof = inFoot(x, z); splash.a[i * 3] = x; splash.a[i * 3 + 1] = (roof ? 2 * H + 0.3 : terrainY(z)) + 0.04; splash.a[i * 3 + 2] = z; } splash.g.attributes.position.needsUpdate = true; }
      if (mist.p.visible) { for (let i = 0; i < NM; i++) { const k = i * 3; let x = mist.a[k] + (0.25 + wx * 0.12) * dt, z = mist.a[k + 2] + 0.1 * dt; if (x - hx > 22) x -= 44; else if (x - hx < -22) x += 44; if (z - hz > 22) z -= 44; else if (z - hz < -22) z += 44; mist.a[k] = x; mist.a[k + 2] = z; mist.a[k + 1] = inFoot(x, z) ? -50 : terrainY(z) + 0.9 + (i % 5) * 0.35; } mist.g.attributes.position.needsUpdate = true; }
      for (let i = 0; i < ND; i++) { const k = i * 3; for (let c = 0; c < 3; c++) { let v = dust.a[k + c] + dv[k + c] * dt; if (v > 4) v -= 8; else if (v < -4) v += 8; dust.a[k + c] = v; } } dust.p.position.set(hx, hy, hz); dust.g.attributes.position.needsUpdate = true;
      let flash = 0;
      if (S.wx === 'storm') { if ((S.next -= dt) <= 0) { S.next = 7 + r() * 15; S.boltT = 0.42; if (onThunder) setTimeout(onThunder, 350 + r() * 2200); } }
      if (S.boltT > 0) { S.boltT -= dt; const t = S.boltT; flash = t > 0.3 ? 1 : t > 0.22 ? 0.15 : t > 0.12 ? 0.8 : t / 0.12 * 0.5; }
      bolt.intensity = flash * 3.2; return flash;
    },
  };
}
