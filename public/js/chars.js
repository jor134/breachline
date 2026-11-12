// Downloaded, rigged characters (public/models/chars, credits in LICENSE.md there).
// None of them come with usable animations, so they are posed every frame from the game's own procedural skeleton:
// - suspects copy the joint angles of the invisible stick rig in actors.js Human (walk cycle, cover, surrender, lying down ...)
// - officers solve two-bone IK so the arms reach the controllers, the head follows the headset and the legs bend to crouch.
// Bones are driven by rotation only (their lengths stay the model's own); rotations are composed in the character's frame.
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { envMap, pbrMats } from './mats.js';

const side = (L, R) => ({ L, R });
export const CHARS = {
  // "terrorist" by DJMaesen: balaclava, sweater, holstered pistol
  thug: { file: 'thug.glb', h: 1.8, hips: 'hip_01', spine: ['spine_012', 'chest_013'], neck: 'neck_061', head: 'head_062',
    thigh: side('L_leg_02', 'R_leg_07'), shin: side('L_knee_03', 'R_knee_08'), foot: side('L_ankle_04', 'R_ankle_09'),
    up: side('L_arm_015', 'R_arm_00'), fore: side('L_elbow_016', 'R_elbow_039'), hand: side('L_wrist_017', 'R_wrist_040') },
  // "Terrorist 4" by Upgrade titan camera man
  gunman: { file: 'gunman.glb', h: 1.78, hips: 'root_hips_03', spine: ['spine_lower_010', 'spine_upper_011', 'spine_upper_1_012'], neck: 'head_neck_lower_013', head: 'head_neck_upper_014',
    thigh: side('leg_left_thigh_02', 'leg_right_thigh_01'), shin: side('leg_left_knee_04', 'leg_right_knee_07'), foot: side('leg_left_ankle_05', 'leg_right_ankle_08'),
    up: side('arm_left_shoulder_2_017', 'arm_right_shoulder_2_015'), fore: side('arm_left_elbow_018', 'arm_right_elbow_032'), hand: side('arm_left_wrist_019', 'arm_right_wrist_033') },
  // "Tm Phoenix V2" by ErhanMatur
  phoenix: { file: 'phoenix.glb', h: 1.8, hips: 'pelvis_01', spine: ['spine_0_016', 'spine_1_017', 'spine_2_018', 'spine_3_020'], neck: 'neck_0_082', head: 'head_0_083',
    thigh: side('leg_upper_L_09', 'leg_upper_R_02'), shin: side('leg_lower_L_012', 'leg_lower_R_05'), foot: side('ankle_L_013', 'ankle_R_06'),
    up: side('arm_upper_L_052', 'arm_upper_R_022'), fore: side('arm_lower_L_055', 'arm_lower_R_025'), hand: side('hand_L_058', 'hand_R_028') },
  // "Counter terrorist" by davidthe19th: the squad
  swat: { file: 'swat.glb', h: 1.82, hips: 'ValveBipedBip01_Pelvis_01', spine: ['ValveBipedBip01_Spine_00', 'ValveBipedBip01_Spine1_010', 'ValveBipedBip01_Spine2_011', 'ValveBipedBip01_Spine4_012'], neck: 'ValveBipedBip01_Neck1_013', head: 'ValveBipedBip01_Head1_014',
    thigh: side('ValveBipedBip01_L_Thigh_02', 'ValveBipedBip01_R_Thigh_06'), shin: side('ValveBipedBip01_L_Calf_03', 'ValveBipedBip01_R_Calf_07'), foot: side('ValveBipedBip01_L_Foot_04', 'ValveBipedBip01_R_Foot_08'),
    up: side('ValveBipedBip01_L_UpperArm_017', 'ValveBipedBip01_R_UpperArm_032'), fore: side('ValveBipedBip01_L_Forearm_018', 'ValveBipedBip01_R_Forearm_033'), hand: side('ValveBipedBip01_L_Hand_019', 'ValveBipedBip01_R_Hand_034'),
    fingers: { L: [['ValveBipedBip01_L_Finger1_023', 'ValveBipedBip01_L_Finger11_024', 'ValveBipedBip01_L_Finger12_025'], ['ValveBipedBip01_L_Finger2_020', 'ValveBipedBip01_L_Finger21_021', 'ValveBipedBip01_L_Finger22_022']], R: [['ValveBipedBip01_R_Finger1_038', 'ValveBipedBip01_R_Finger11_039', 'ValveBipedBip01_R_Finger12_040'], ['ValveBipedBip01_R_Finger2_035', 'ValveBipedBip01_R_Finger21_036', 'ValveBipedBip01_R_Finger22_037']] },
    thumb: { L: ['ValveBipedBip01_L_Finger0_026', 'ValveBipedBip01_L_Finger01_027', 'ValveBipedBip01_L_Finger02_028'], R: ['ValveBipedBip01_R_Finger0_041', 'ValveBipedBip01_R_Finger01_042', 'ValveBipedBip01_R_Finger02_043'] } },
  // "Business Man" by qsardor: the high-value target (Mixamo rig)
  boss: { file: 'boss.glb', h: 1.8, hips: 'mixamorigHips_01', spine: ['mixamorigSpine_02', 'mixamorigSpine1_03', 'mixamorigSpine2_04'], neck: 'mixamorigNeck_05', head: 'mixamorigHead_06',
    thigh: side('mixamorigLeftUpLeg_056', 'mixamorigRightUpLeg_00'), shin: side('mixamorigLeftLeg_057', 'mixamorigRightLeg_061'), foot: side('mixamorigLeftFoot_058', 'mixamorigRightFoot_062'),
    up: side('mixamorigLeftArm_09', 'mixamorigRightArm_033'), fore: side('mixamorigLeftForeArm_010', 'mixamorigRightForeArm_034'), hand: side('mixamorigLeftHand_011', 'mixamorigRightHand_035') },
  // "Characters_psx" by Elbolillo: civilians. They come unrigged; loadCivilians() builds a skeleton and weights for each.
  psx: { hips: 'hips', spine: ['spine', 'chest'], neck: 'neck', head: 'head', thigh: side('thighL', 'thighR'), shin: side('shinL', 'shinR'), foot: side('footL', 'footR'),
    up: side('upL', 'upR'), fore: side('foreL', 'foreR'), hand: side('handL', 'handR') },
};
export const SUSPECT_MODELS = ['thug', 'gunman', 'phoenix'];
const Q = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
export const CHARS_ON = !Q.get('lite') || !!Q.get('chars');   // ?lite=1 (tests) keeps the built-in figures unless &chars=1

const cache = {}, ready = {};
export function loadChar(id) {
  return cache[id] || (cache[id] = new Promise((res, rej) => new GLTFLoader().load('models/chars/' + CHARS[id].file, g => {
    const sc = g.scene; sc.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(sc), k = CHARS[id].h / (bb.max.y - bb.min.y);
    sc.traverse(o => { if (o.isMesh) { const m = o.material; m.envMap = envMap; m.userData.env = m.envMapIntensity = 0.35; if (!pbrMats.includes(m)) pbrMats.push(m); o.castShadow = false; o.receiveShadow = true; } });
    ready[id] = { id, scene: sc, k, y0: -bb.min.y * k }; res(ready[id]);
  }, undefined, rej)));
}
export const charReady = id => ready[id] || null;

// ---- civilians: one file of unrigged low-poly people. Each gets a skeleton fitted to its shape and rigid-ish weights
// (every vertex follows its nearest limb segment, blended a little where two meet). Units: the file's, 4.6 = 1.75 m.
let civP = null;
export function loadCivilians() {
  return civP || (civP = new Promise((res, rej) => new GLTFLoader().load('models/chars/civilians.glb', g => {
    const list = []; g.scene.traverse(o => { if (o.isMesh) list.push(o); });
    res(list.map((o, i) => { try { return rigCivilian(o, i); } catch (e) { console.warn('civilian rig failed', o.name, e); return null; } }).filter(Boolean));
  }, undefined, rej)));
}
function rigCivilian(src, i) {
  const geo = src.geometry.clone(), P = geo.attributes.position, n = P.count, K = 1.75 / 4.6;
  for (let k = 0; k < n; k++) { const x = P.getX(k), y = P.getY(k), z = P.getZ(k); P.setXYZ(k, y * K, z * K, x * K); }   // z-up, facing +x  ->  y-up, facing +z, metres
  geo.computeBoundingBox(); const bb = geo.boundingBox; geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, 0); geo.computeVertexNormals(); geo.computeBoundingBox();
  const H = geo.boundingBox.max.y, V = i3 => new THREE.Vector3(P.getX(i3), P.getY(i3), P.getZ(i3));
  // the outer edge and mean depth of one side of the body over a band of heights
  const band = (y0, y1, side, minX = 0) => { let mx = 0, zs = 0, c = 0; for (let k = 0; k < n; k++) { const y = P.getY(k), x = P.getX(k) * side; if (y < y0 * H || y > y1 * H || x < minX) continue; if (x > mx) mx = x; zs += P.getZ(k); c++; } return [mx, c ? zs / c : 0]; };
  const mid = (y0, y1) => { let zs = 0, c = 0; for (let k = 0; k < n; k++) { const y = P.getY(k); if (y < y0 * H || y > y1 * H || Math.abs(P.getX(k)) > 0.12) continue; zs += P.getZ(k); c++; } return c ? zs / c : 0; };
  const J = {}; J.hips = [0, 0.53 * H, mid(0.5, 0.56)]; J.spine = [0, 0.63 * H, mid(0.6, 0.66)]; J.chest = [0, 0.73 * H, mid(0.7, 0.76)]; J.neck = [0, 0.845 * H, mid(0.83, 0.86)]; J.head = [0, 0.885 * H, mid(0.87, 0.92)]; J.top = [0, H, J.head[2]];
  for (const [S, sd] of [['L', 1], ['R', -1]]) {
    // the arm hangs from the shoulder to the outermost point of the body on that side (the fingertips, in an A-pose)
    const [shX] = band(0.79, 0.82, sd); let tip = 0; for (let k = 1; k < n; k++) if (P.getX(k) * sd > P.getX(tip) * sd) tip = k;
    const sh = new THREE.Vector3(sd * Math.max(0.12, shX - 0.05), 0.81 * H, J.chest[2]), tp = V(tip), at = t => sh.clone().lerp(tp, t).toArray();
    J['up' + S] = sh.toArray(); J['fore' + S] = at(0.45); J['hand' + S] = at(0.8); J['tip' + S] = tp.toArray();
    const [lgX, lgZ] = band(0.22, 0.32, sd, 0.0); const lx = sd * Math.max(0.06, lgX - 0.07);
    J['thigh' + S] = [sd * 0.09 * H / 1.75, 0.51 * H, J.hips[2]]; J['shin' + S] = [lx, 0.275 * H, lgZ]; J['foot' + S] = [lx, 0.05 * H, lgZ - 0.02]; J['toe' + S] = [lx, 0.02, lgZ + 0.12];
  }
  const names = ['hips', 'spine', 'chest', 'neck', 'head', 'upL', 'foreL', 'handL', 'upR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
  const parent = { spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', upL: 'chest', foreL: 'upL', handL: 'foreL', upR: 'chest', foreR: 'upR', handR: 'foreR', thighL: 'hips', shinL: 'thighL', footL: 'shinL', thighR: 'hips', shinR: 'thighR', footR: 'shinR' };
  const end = { hips: 'spine', spine: 'chest', chest: 'neck', neck: 'head', head: 'top', upL: 'foreL', foreL: 'handL', handL: 'tipL', upR: 'foreR', foreR: 'handR', handR: 'tipR', thighL: 'shinL', shinL: 'footL', footL: 'toeL', thighR: 'shinR', shinR: 'footR', footR: 'toeR' };
  const bones = names.map(nm => { const b = new THREE.Bone(); b.name = nm; return b; }), B = Object.fromEntries(names.map((nm, k) => [nm, bones[k]])), W = nm => new THREE.Vector3(...J[nm]);
  for (const nm of names) { const b = B[nm]; if (parent[nm]) { B[parent[nm]].add(b); b.position.copy(W(nm)).sub(W(parent[nm])); } else b.position.copy(W(nm)); }
  // weights: nearest segment wins; near a joint the two closest share. Torso segments are favoured slightly so armpits stay with the chest.
  const seg = names.map(nm => [W(nm), W(end[nm]), /^(hips|spine|chest)$/.test(nm) ? 0.8 : 1]), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), p = new THREE.Vector3(), c = new THREE.Vector3(), l3 = new THREE.Line3();
  for (let k = 0; k < n; k++) {
    p.set(P.getX(k), P.getY(k), P.getZ(k)); let a = 0, da = Infinity, b = 0, db = Infinity;
    seg.forEach(([s0, s1, f], m) => { l3.set(s0, s1); l3.closestPointToPoint(p, true, c); const d = c.distanceTo(p) * f; if (d < da) { b = a; db = da; a = m; da = d; } else if (d < db) { b = m; db = d; } });
    let wa = 1, wb = 0; if (db < da * 1.35) { const ia = 1 / Math.pow(da + 1e-3, 4), ib = 1 / Math.pow(db + 1e-3, 4); wa = ia / (ia + ib); wb = 1 - wa; }
    si[k * 4] = a; si[k * 4 + 1] = b; sw[k * 4] = wa; sw[k * 4 + 1] = wb;
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  const m = src.material; m.envMap = envMap; m.userData.env = m.envMapIntensity = 0.25; if (!pbrMats.includes(m)) pbrMats.push(m);
  const mesh = new THREE.SkinnedMesh(geo, m), root = new THREE.Group(); mesh.add(B.hips); root.add(mesh); root.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(bones)); mesh.receiveShadow = true;
  return { id: 'psx' + i, def: 'psx', scene: root, k: 1, y0: 0, name: src.name };
}

// Clone a rigged scene: every skinned mesh gets its own skeleton bound to the cloned bones.
function cloneSkinned(src) {
  const out = src.clone(true), sMap = new Map(), list = [];
  (function walk(a, b) { sMap.set(a, b); for (let i = 0; i < a.children.length; i++) walk(a.children[i], b.children[i]); })(src, out);
  src.traverse(o => { if (o.isSkinnedMesh) list.push(o); });
  for (const o of list) { const c = sMap.get(o); c.bind(new THREE.Skeleton(o.skeleton.bones.map(b => sMap.get(b)), o.skeleton.boneInverses), o.bindMatrix); c.frustumCulled = false; }
  return out;
}

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m = new THREE.Matrix4(), X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
// A posed copy of a character inside `holder`. Works in the holder's frame ("g"): gq / gp are each bone's rotation / position there.
export class Skin {
  constructor(tpl, holder) {
    this.tpl = tpl; const def = CHARS[tpl.def || tpl.id], wrap = this.wrap = new THREE.Group(); wrap.scale.setScalar(tpl.k); wrap.position.y = tpl.y0;
    const sc = cloneSkinned(tpl.scene); wrap.add(sc); holder.add(wrap); holder.updateMatrixWorld(true);
    this.bones = []; const idx = new Map(), inv = new THREE.Matrix4().copy(holder.matrixWorld).invert();
    sc.traverse(o => { if (o.isBone) { idx.set(o, this.bones.length); this.bones.push(o); } });
    const n = this.bones.length; this.par = new Int16Array(n); this.gq = []; this.gp = []; this.sc = new Float32Array(n); this.rq = []; this.rp = [];
    this.top = [];   // for bones whose parent is not a bone: the fixed transform from the holder to that parent
    this.bones.forEach((b, i) => {
      const p = idx.has(b.parent) ? idx.get(b.parent) : -1; this.par[i] = p; this.rq.push(b.quaternion.clone()); this.rp.push(b.position.clone()); this.gq.push(new THREE.Quaternion()); this.gp.push(new THREE.Vector3());
      if (p < 0) { _m.multiplyMatrices(inv, b.parent.matrixWorld); const P = new THREE.Vector3(), R = new THREE.Quaternion(), S = new THREE.Vector3(); _m.decompose(P, R, S); this.top[i] = { P, R, s: S.x }; }
    });
    const B = name => { const i = this.bones.findIndex(b => b.name === name); return i; };
    this.role = {}; for (const k of ['hips', 'neck', 'head']) this.role[k] = B(def[k]); this.role.spine = def.spine.map(B);
    for (const k of ['thigh', 'shin', 'foot', 'up', 'fore', 'hand']) this.role[k] = { L: B(def[k].L), R: B(def[k].R) };
    if (def.fingers) { this.role.fingers = { L: def.fingers.L.map(c => c.map(B)), R: def.fingers.R.map(c => c.map(B)) }; this.role.thumb = { L: def.thumb.L.map(B), R: def.thumb.R.map(B) }; }
    this.solve(null);   // rest pose in the holder's frame
    this.restQ = this.gq.map(q => q.clone()); this.restP = this.gp.map(p => p.clone());
    const dirTo = (a, b) => _v.copy(this.restP[b]).sub(this.restP[a]).normalize().clone();
    // turn T- and A-pose limbs straight down, so they match the game's rig whose limbs hang at zero angle
    this.align = new Map();
    for (const s of ['L', 'R']) {
      const r = this.role; this.align.set(r.up[s], new THREE.Quaternion().setFromUnitVectors(dirTo(r.up[s], r.fore[s]), DOWN));
      const af = new THREE.Quaternion().setFromUnitVectors(dirTo(r.fore[s], r.hand[s]), DOWN); this.align.set(r.fore[s], af); this.align.set(r.hand[s], af);
      this.align.set(r.thigh[s], new THREE.Quaternion().setFromUnitVectors(dirTo(r.thigh[s], r.shin[s]), DOWN)); this.align.set(r.shin[s], new THREE.Quaternion().setFromUnitVectors(dirTo(r.shin[s], r.foot[s]), DOWN));
    }
    this.len = s => [this.restP[this.role.up[s]].distanceTo(this.restP[this.role.fore[s]]), this.restP[this.role.fore[s]].distanceTo(this.restP[this.role.hand[s]])];
    this.want = new Map(); this.hipsOff = new THREE.Vector3();
    // cull off-screen characters: a bounding sphere from the rest pose, padded so crouching, reaching and lying stay inside it
    holder.updateMatrixWorld(true); wrap.traverse(o => { if (o.isSkinnedMesh) { o.computeBoundingSphere(); o.boundingSphere.radius *= 1.5; o.frustumCulled = true; } });
  }
  // Walk the bones parent-first. want: bone index -> rotation in the holder's frame (or a function of the bone's position and its parent's rotation).
  solve(want) {
    const { bones, par, gq, gp, rq, rp } = this;
    for (let i = 0; i < bones.length; i++) {
      const p = par[i], b = bones[i];
      let PQ, PP, s; if (p < 0) { const t = this.top[i]; PQ = t.R; PP = t.P; s = t.s; } else { PQ = gq[p]; PP = gp[p]; s = this.sc[p]; }
      this.sc[i] = s * b.scale.x;
      gp[i].copy(rp[i]).multiplyScalar(s).applyQuaternion(PQ).add(PP);
      if (i === this.role.hips && want) { gp[i].add(this.hipsOff); b.position.copy(_v.copy(gp[i]).sub(PP).applyQuaternion(_q.copy(PQ).invert()).multiplyScalar(1 / s)); }
      let w = want ? want.get(i) : undefined; if (typeof w === 'function') w = w(gp[i], PQ);
      if (w) { gq[i].copy(w); b.quaternion.copy(_q.copy(PQ).invert().multiply(w)); }
      else { if (want === null) b.quaternion.copy(rq[i]); gq[i].copy(PQ).multiply(b.quaternion); }
    }
  }
  // rotation in the holder's frame for bone i given a rig rotation D (from the rig's rest): D * align * rest
  rig(i, D, out = new THREE.Quaternion()) { out.copy(D); const a = this.align.get(i); if (a) out.multiply(a); return out.multiply(this.restQ[i]); }
  dispose() { this.wrap.parent && this.wrap.parent.remove(this.wrap); }
}
// a rotation mirrored left-right (reflection across the x = 0 plane)
export const mirror = (q, out = new THREE.Quaternion()) => out.set(q.x, -q.y, -q.z, q.w);

// Two vectors to a rotation: maps (d0, u0) onto (d1, u1), both pairs orthogonalised.
const _a = new THREE.Matrix4(), _b = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
function frame(d, u, m) { _y.copy(d).normalize(); _z.copy(u).addScaledVector(_y, -u.dot(_y)).normalize(); _x.crossVectors(_y, _z); return m.makeBasis(_x, _y, _z); }
export function align2(d0, u0, d1, u1, out = new THREE.Quaternion()) { frame(d1, u1, _a); frame(d0, u0, _b); return out.setFromRotationMatrix(_a.multiply(_b.transpose())); }
