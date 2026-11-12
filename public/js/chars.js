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
    this.tpl = tpl; const def = CHARS[tpl.id], wrap = this.wrap = new THREE.Group(); wrap.scale.setScalar(tpl.k); wrap.position.y = tpl.y0;
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
