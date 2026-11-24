// The stadium's crowd and match: a few hundred-odd fans standing at their seats in the stands round the VIP block (four people, each
// one instanced mesh, their baked poses played as morph targets: two poses blended at a time per fan), and the match on the pitch
// below: 22 players in two invented kits chasing a ball, a referee. Nobody down there knows what is happening up in the suites: the
// game carries on the whole mission. Model: models/stadium/crowd (tools/crowd_glb.py).
import * as THREE from '../../vendor/three.module.min.js';
import { ObfLoader } from '../store/obf.js';
import { envMap, pbrMats } from '../mats.js';
import { SEATS } from './stadium-seats.js';
import { BLOCK } from '../core/maps/stadium.js';
import { makeMatch, stepMatch } from './stadium-match.js';

const FANS = 200, POSES = 24, POSE_T = 0.25, RUN = 12;   // the bake: 24 poses 0.25 s apart, played forwards then back
let seed = 11; const rr = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// which seats get a fan: spread round the whole bowl in little groups (friends sit together), a bit thicker in the stands you can
// see from the VIP block; never the terrace or the block itself (stadium-seats.js already leaves those out)
function pickSeats() {
  seed = 11; const out = [], used = new Set(), cx = (BLOCK.x0 + BLOCK.x1) / 2, cz = BLOCK.z1 + 6;
  const near = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]) < 1.6 && Math.abs(a[1] - b[1]) < 0.3;
  for (let guard = 0; out.length < FANS && guard < 20000; guard++) {
    const i = Math.floor(rr() * SEATS.length), s = SEATS[i]; if (used.has(i)) continue;
    const d = Math.hypot(s[0] - cx, s[2] - cz); if (rr() > 0.45 + 0.55 * Math.exp(-d / 70)) continue;   // thinner far away (it shows less)
    used.add(i); out.push(s); const n = Math.floor(rr() * 3);   // and up to two friends beside them
    for (let k = 0, j = Math.max(0, i - 40); k < n && j < Math.min(SEATS.length, i + 40) && out.length < FANS; j++) if (!used.has(j) && near(SEATS[j], s)) { used.add(j); out.push(SEATS[j]); k++; }
  }
  return out;
}

export function makeCrowd(root) {
  const C = { group: new THREE.Group(), fans: [], types: [], match: makeMatch(), t: 0, acc: 0, players: null, ball: null };
  C.group.name = 'crowd'; root.add(C.group);
  const seats = pickSeats(); seats.forEach((s, i) => C.fans.push({ s, type: i % 4, ph: rr() * POSES * 2, rate: 0.7 + rr() * 0.6, ry: s[3] + (rr() - 0.5) * 0.5, k: 0.93 + rr() * 0.12 }));
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), new THREE.MeshLambertMaterial({ color: 0xf4f4f0 })); ball.castShadow = true; C.group.add(ball); C.ball = ball;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), dummy = { morphTargetInfluences: new Float32Array(POSES - 1) }, run = { morphTargetInfluences: new Float32Array(RUN) };
  C.load = () => new Promise((res) => new ObfLoader().load('models/stadium/crowd.glb', gl => {
    const byName = {}; gl.scene.traverse(o => { if (o.isMesh) byName[o.name] = o; });
    const inst = (src, n) => { const mt = src.material; mt.side = THREE.DoubleSide;   // simplified people have a few flipped faces: drawn one-sided they showed as holes
      mt.envMap = envMap; mt.userData.env = mt.envMapIntensity = 0.2; if (!pbrMats.includes(mt)) pbrMats.push(mt);
      const im = new THREE.InstancedMesh(src.geometry, mt, n); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.castShadow = false; im.receiveShadow = false; C.group.add(im); return im; };
    ['fan_cheer', 'fan_talk', 'fan_woman', 'fan_grandma'].forEach((n, t) => { const src = byName[n]; if (!src) return; const list = C.fans.filter(f => f.type === t);
      const im = inst(src, list.length); list.forEach((f, i) => { f.i = i; const [x, y, z] = f.s; e.set(0, f.ry, 0); q.setFromEuler(e); m4.compose(p3.set(x, y - 0.42, z), q, s3.setScalar(f.k)); im.setMatrixAt(i, m4); im.setMorphAt(i, dummy); });
      im.computeBoundingSphere(); C.types[t] = { im, list }; });
    const all = C.match.players;
    C.players = ['player_home', 'player_away'].map((n, k) => { const src = byName[n]; if (!src) return null; const list = all.filter(p => (p.side > 0) === (k === 0)); if (k === 1) list.push(C.match.ref); return { im: inst(src, list.length), list }; });
    for (const p of C.players) if (p) p.im.frustumCulled = false;
    C.ready = true; res(null);
  }, undefined, () => res(null)));
  C.tick = (dt) => {
    stepMatch(C.match, Math.min(dt, 0.05));
    const b = C.match.ball; C.ball.position.set(b.x, b.y, b.z); C.ball.rotation.x += Math.hypot(b.vx, b.vz) * dt / 0.11;
    if (!C.ready) return;
    // the players' run: RUN baked poses round one stride (tools/crowd_glb.py), the two either side of the stride's phase blended,
    // all of it scaled by speed (zero is the standing base: a jog is a smaller stride, stood still is standing)
    for (const P of C.players) { if (!P) continue; P.list.forEach((p, i) => { e.set(0, p.ry, 0); q.setFromEuler(e); m4.compose(p3.set(p.x, 0, p.z), q, s3.setScalar(p.ref ? 0.97 : 1)); P.im.setMatrixAt(i, m4);
        const u = p.ph / (2 * Math.PI) * RUN, a = Math.floor(u) % RUN, w = u - Math.floor(u), amp = Math.min(1, p.sp / 3.2); run.morphTargetInfluences.fill(0);
        run.morphTargetInfluences[a] = (1 - w) * amp; run.morphTargetInfluences[(a + 1) % RUN] += w * amp; P.im.setMorphAt(i, run); });
      P.im.instanceMatrix.needsUpdate = true; if (P.im.morphTexture) P.im.morphTexture.needsUpdate = true; }
    // the fans' poses at 30 Hz: pose u (0..POSES-1, ping-pong), blending its two neighbours
    C.t += dt; if ((C.acc += dt) < 1 / 30) return; C.acc = 0;
    for (const T of C.types) { if (!T) continue; for (const f of T.list) { const raw = (C.t * f.rate / POSE_T + f.ph) % (2 * (POSES - 1)), u = raw < POSES - 1 ? raw : 2 * (POSES - 1) - raw, a = Math.floor(u), w = u - a;
      dummy.morphTargetInfluences.fill(0); if (a > 0) dummy.morphTargetInfluences[a - 1] = 1 - w; if (a + 1 < POSES) dummy.morphTargetInfluences[a] = w; T.im.setMorphAt(f.i, dummy); }
      T.im.morphTexture.needsUpdate = true; }
  };
  return C;
}
