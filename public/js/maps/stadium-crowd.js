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

const FANS = 160, POSES = 24, POSE_T = 0.25;   // the bake: 24 poses 0.25 s apart, played forwards then back
let seed = 11; const rr = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// which seats get a fan: the nearest to the VIP block's front, with gaps (never the terrace or the block itself)
function pickSeats() {
  seed = 11; const cx = (BLOCK.x0 + BLOCK.x1) / 2, cz = BLOCK.z1 + 6;
  const ok = SEATS.filter(s => !(s[0] > BLOCK.x0 - 0.6 && s[0] < BLOCK.x1 + 0.6 && s[2] < 34));
  ok.sort((a, b) => Math.hypot(a[0] - cx, (a[2] - cz) * 1.4) - Math.hypot(b[0] - cx, (b[2] - cz) * 1.4));
  const near = ok.slice(0, Math.round(FANS * 1.7)), out = [];
  for (const s of near) if (out.length < FANS && rr() < 0.62) out.push(s);
  for (const s of near) if (out.length < FANS && !out.includes(s)) out.push(s);
  return out;
}

export function makeCrowd(root) {
  const C = { group: new THREE.Group(), fans: [], types: [], match: makeMatch(), t: 0, acc: 0, players: null, ball: null };
  C.group.name = 'crowd'; root.add(C.group);
  const seats = pickSeats(); seats.forEach((s, i) => C.fans.push({ s, type: i % 4, ph: rr() * POSES * 2, rate: 0.7 + rr() * 0.6, ry: s[3] + (rr() - 0.5) * 0.5, k: 0.93 + rr() * 0.12 }));
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), new THREE.MeshLambertMaterial({ color: 0xf4f4f0 })); ball.castShadow = true; C.group.add(ball); C.ball = ball;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), dummy = { morphTargetInfluences: new Float32Array(POSES - 1) };
  C.load = () => new Promise((res) => new ObfLoader().load('models/stadium/crowd.glb', gl => {
    const byName = {}; gl.scene.traverse(o => { if (o.isMesh) byName[o.name] = o; });
    const inst = (src, n) => { const mt = src.material; mt.envMap = envMap; mt.userData.env = mt.envMapIntensity = 0.2; if (!pbrMats.includes(mt)) pbrMats.push(mt);
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
    for (const P of C.players) { if (!P) continue; P.list.forEach((p, i) => { const bob = Math.abs(Math.sin(p.ph)) * Math.min(0.09, p.sp * 0.015); e.set(Math.min(0.18, p.sp * 0.02), p.ry, Math.sin(p.ph) * Math.min(0.06, p.sp * 0.01)); q.setFromEuler(e);
      m4.compose(p3.set(p.x, bob, p.z), q, s3.setScalar(p.ref ? 0.97 : 1)); P.im.setMatrixAt(i, m4); }); P.im.instanceMatrix.needsUpdate = true; }
    // the fans' poses at 30 Hz: pose u (0..POSES-1, ping-pong), blending its two neighbours
    C.t += dt; if ((C.acc += dt) < 1 / 30) return; C.acc = 0;
    for (const T of C.types) { if (!T) continue; for (const f of T.list) { const raw = (C.t * f.rate / POSE_T + f.ph) % (2 * (POSES - 1)), u = raw < POSES - 1 ? raw : 2 * (POSES - 1) - raw, a = Math.floor(u), w = u - a;
      dummy.morphTargetInfluences.fill(0); if (a > 0) dummy.morphTargetInfluences[a - 1] = 1 - w; if (a + 1 < POSES) dummy.morphTargetInfluences[a] = w; T.im.setMorphAt(f.i, dummy); }
      T.im.morphTexture.needsUpdate = true; }
  };
  return C;
}
