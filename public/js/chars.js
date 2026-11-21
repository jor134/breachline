// Downloaded, rigged characters (public/models/chars, credits in LICENSE.md there).
// None of them come with usable animations, so they are posed every frame from the game's own procedural skeleton:
// - suspects copy the joint angles of the invisible stick rig in actors.js Human (walk cycle, cover, surrender, lying down ...)
// - officers solve two-bone IK so the arms reach the controllers, the head follows the headset and the legs bend to crouch.
// Bones are driven by rotation only (their lengths stay the model's own); rotations are composed in the character's frame.
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
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
  // "S.W.A.T. Operator" by Mateusz Wolinski (CC BY 4.0, Mixamo rig): the squad
  swat: { file: 'swat.glb', h: 1.84, hips: 'mixamorigHips_64', spine: ['mixamorigSpine_53', 'mixamorigSpine1_52', 'mixamorigSpine2_51'], neck: 'mixamorigNeck_2', head: 'mixamorigHead_1',
    thigh: side('mixamorigLeftUpLeg_58', 'mixamorigRightUpLeg_63'), shin: side('mixamorigLeftLeg_57', 'mixamorigRightLeg_62'), foot: side('mixamorigLeftFoot_56', 'mixamorigRightFoot_61'),
    up: side('mixamorigLeftArm_25', 'mixamorigRightArm_49'), fore: side('mixamorigLeftForeArm_24', 'mixamorigRightForeArm_48'), hand: side('mixamorigLeftHand_23', 'mixamorigRightHand_47'),
    fingers: { L: [['mixamorigLeftHandIndex1_10', 'mixamorigLeftHandIndex2_9', 'mixamorigLeftHandIndex3_8'], ['mixamorigLeftHandMiddle1_14', 'mixamorigLeftHandMiddle2_13', 'mixamorigLeftHandMiddle3_12']], R: [['mixamorigRightHandIndex1_34', 'mixamorigRightHandIndex2_33', 'mixamorigRightHandIndex3_32'], ['mixamorigRightHandMiddle1_38', 'mixamorigRightHandMiddle2_37', 'mixamorigRightHandMiddle3_36']] },
    rest: { L: [['mixamorigLeftHandRing1_18', 'mixamorigLeftHandRing2_17', 'mixamorigLeftHandRing3_16'], ['mixamorigLeftHandPinky1_22', 'mixamorigLeftHandPinky2_21', 'mixamorigLeftHandPinky3_20']], R: [['mixamorigRightHandRing1_42', 'mixamorigRightHandRing2_41', 'mixamorigRightHandRing3_40'], ['mixamorigRightHandPinky1_46', 'mixamorigRightHandPinky2_45', 'mixamorigRightHandPinky3_44']] },   // ring and little fingers (they follow the middle finger)
    thumb: { L: ['mixamorigLeftHandThumb1_6', 'mixamorigLeftHandThumb2_5', 'mixamorigLeftHandThumb3_4'], R: ['mixamorigRightHandThumb1_30', 'mixamorigRightHandThumb2_29', 'mixamorigRightHandThumb3_28'] } },
  // "Business Man" by qsardor: the high-value target (Mixamo rig)
  boss: { file: 'boss.glb', h: 1.8, hips: 'mixamorigHips_01', spine: ['mixamorigSpine_02', 'mixamorigSpine1_03', 'mixamorigSpine2_04'], neck: 'mixamorigNeck_05', head: 'mixamorigHead_06',
    thigh: side('mixamorigLeftUpLeg_056', 'mixamorigRightUpLeg_00'), shin: side('mixamorigLeftLeg_057', 'mixamorigRightLeg_061'), foot: side('mixamorigLeftFoot_058', 'mixamorigRightFoot_062'),
    up: side('mixamorigLeftArm_09', 'mixamorigRightArm_033'), fore: side('mixamorigLeftForeArm_010', 'mixamorigRightForeArm_034'), hand: side('mixamorigLeftHand_011', 'mixamorigRightHand_035') },
  // civilians (Michael Constantine's figures): They come unrigged; loadCivilians() builds a skeleton and weights for each.
  psx: { hips: 'hips', spine: ['spine', 'chest'], neck: 'neck', head: 'head', thigh: side('thighL', 'thighR'), shin: side('shinL', 'shinR'), foot: side('footL', 'footR'),
    up: side('upL', 'upR'), fore: side('foreL', 'foreR'), hand: side('handL', 'handR') },
};
export const SUSPECT_MODELS = ['thug', 'gunman'];
const Q = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
export const CHARS_ON = !Q.get('lite') || !!Q.get('chars');   // ?lite=1 (tests) keeps the built-in figures unless &chars=1

const cache = {}, ready = {};
export function loadChar(id) {
  return cache[id] || (cache[id] = new Promise((res, rej) => new GLTFLoader().load('models/chars/' + CHARS[id].file, g => {
    const sc = g.scene; sc.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(sc), k = CHARS[id].h / (bb.max.y - bb.min.y);
    // Both sides of every face: the models have thin single-sided pieces (helmet straps, collar, pouch flaps, the inside of the gloves
    // and sleeves) and some faces wound the wrong way, which showed as see-through holes. Blended parts (eyes) become cut-outs so
    // they never sort wrongly against the rest.
    sc.traverse(o => { if (o.isMesh) { const m = o.material; m.side = THREE.DoubleSide; if (m.transparent) { m.transparent = false; m.alphaTest = 0.5; m.depthWrite = true; } m.envMap = envMap; m.userData.env = m.envMapIntensity = 0.35; if (!pbrMats.includes(m)) pbrMats.push(m); o.castShadow = false; o.receiveShadow = true; } });
    packRig(sc);
    ready[id] = { id, scene: sc, k, y0: -bb.min.y * k }; res(ready[id]);
  }, undefined, rej)));
}
export const charReady = id => ready[id] || null;

// ---- civilians: Michael Constantine's civilian and police figures (public/models/civ, CC BY 4.0). They come without a
// skeleton: each gets one fitted to its shape and rigid-ish weights (every vertex follows its nearest limb segment,
// blended a little where two meet). One file per person, loaded the first time someone needs that person.
export const CIV_FILES = ['male_civ_v1', 'female_civ_v1', 'male_civ_v2', 'female_civ_v4', 'male_civ_v5', 'male_pol_v1', 'female_pol_v2'];
const civP = {};
export function loadCivilian(k) {
  const f = CIV_FILES[((k % CIV_FILES.length) + CIV_FILES.length) % CIV_FILES.length];
  return civP[f] || (civP[f] = new Promise((res, rej) => new GLTFLoader().load('models/civ/' + f + '.glb', g => {
    g.scene.updateMatrixWorld(true); const parts = []; g.scene.traverse(o => { if (o.isMesh) parts.push(o); });
    try { res(rigCivilian(parts, CIV_FILES.indexOf(f), f)); } catch (e) { console.warn('civilian rig failed', f, e); rej(e); }
  }, undefined, rej)));
}
export const loadCivilians = () => Promise.all(CIV_FILES.map((f, k) => loadCivilian(k).catch(() => null))).then(l => l.filter(Boolean));
function rigCivilian(parts, i, name) {
  // bake each part into metres, y-up, facing +z, then stand the person on the origin
  const geos = parts.map(m => { const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld); return g; }), bb = new THREE.Box3();
  for (const g of geos) { g.computeBoundingBox(); bb.union(g.boundingBox); }
  if (bb.max.y - bb.min.y > 10) { for (const g of geos) { g.scale(0.01, 0.01, 0.01); g.computeBoundingBox(); } bb.min.multiplyScalar(0.01); bb.max.multiplyScalar(0.01); }   // centimetres
  for (const g of geos) { g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); g.computeBoundingBox(); }
  const pts = []; for (const g of geos) { const P = g.attributes.position; for (let k = 0; k < P.count; k++) pts.push(P.getX(k), P.getY(k), P.getZ(k)); }
  const n = pts.length / 3, X = k => pts[k * 3], Y = k => pts[k * 3 + 1], Z = k => pts[k * 3 + 2], H = bb.max.y - bb.min.y;
  const band = (y0, y1, side) => { let mx = 0, zs = 0, c = 0; for (let k = 0; k < n; k++) { const y = Y(k), x = X(k) * side; if (y < y0 * H || y > y1 * H || x < 0) continue; if (x > mx) mx = x; zs += Z(k); c++; } return [mx, c ? zs / c : 0]; };
  const mid = (y0, y1) => { let zs = 0, c = 0; for (let k = 0; k < n; k++) { const y = Y(k); if (y < y0 * H || y > y1 * H || Math.abs(X(k)) > 0.12) continue; zs += Z(k); c++; } return c ? zs / c : 0; };
  // proportions come from the shoulder line rather than the full height, which includes hair. T-pose: the arms show where it is.
  let tipY = 0; { let t = 0; for (let k = 1; k < n; k++) if (Math.abs(X(k)) > Math.abs(X(t))) t = k; tipY = Y(t); }
  const tpose = tipY > 0.65 * H; let armY = 0.8 * H;
  if (tpose) { let ys = 0, c = 0; for (let k = 0; k < n; k++) { const ax = Math.abs(X(k)); if (ax > 0.42 && ax < 0.58) { ys += Y(k); c++; } } if (c) armY = ys / c; }
  const collar = tpose ? armY + 0.09 : 0.82 * H, shY = collar - 0.07, hy = 0.69 * shY, ky = 0.355 * shY, J = {}, F = y => y / H;
  J.hips = [0, hy, mid(F(hy) - 0.03, F(hy) + 0.03)]; J.chest = [0, shY - 0.12, mid(F(shY - 0.15), F(shY - 0.09))]; J.spine = [0, (hy + J.chest[1]) / 2, (J.hips[2] + J.chest[2]) / 2];
  J.neck = [0, collar + 0.01, mid(F(collar), F(collar + 0.04))]; J.head = [0, collar + 0.1, mid(F(collar + 0.08), F(collar + 0.14))]; J.top = [0, H, J.head[2]];
  const armLine = {};
  for (const [S, sd] of [['L', 1], ['R', -1]]) {
    // the shoulder joint: A-pose, just inside the widest point at shoulder height; T-pose, the chest's edge below the armpit.
    // The arm runs out to the outermost fingertip.
    const dX = tpose ? band(F(shY - 0.26), F(shY - 0.16), sd)[0] + 0.05 : band(F(shY - 0.03), F(shY + 0.03), sd)[0]; let tip = 0; for (let k = 1; k < n; k++) if (X(k) * sd > X(tip) * sd) tip = k;
    const tp = new THREE.Vector3(X(tip), Y(tip), Z(tip)), sh = new THREE.Vector3(sd * Math.max(0.1, dX - 0.07), shY, J.chest[2]), at = t => sh.clone().lerp(tp, t).toArray();
    J['up' + S] = sh.toArray(); J['fore' + S] = at(0.46); J['hand' + S] = at(0.84); J['tip' + S] = tp.toArray(); armLine[S] = new THREE.Line3(sh.clone(), tp.clone());
    const [lgX, lgZ] = band(F(ky - 0.05), F(ky + 0.05), sd); const lx = sd * Math.max(0.06, lgX - 0.06);
    J['thigh' + S] = [sd * 0.09, hy - 0.03, J.hips[2]]; J['shin' + S] = [lx, ky, lgZ]; J['foot' + S] = [lx, 0.08, lgZ - 0.02]; J['toe' + S] = [lx, 0.02, lgZ + 0.12];
  }
  // where the torso ends and the arm begins, slice by slice: the first clear gap in the sideways spread of vertices
  // (below the armpit); above it, the shoulder joint's line
  const SL = 0.03, edge = { L: [], R: [] };
  for (const [S, sd] of [['L', 1], ['R', -1]]) { const shx = Math.abs(J['up' + S][0]);
    for (let y = 0; y < shY + 0.1; y += SL) { const xs = []; for (let k = 0; k < n; k++) if (Y(k) >= y && Y(k) < y + SL && X(k) * sd > 0) xs.push(X(k) * sd); xs.sort((a, b) => a - b);
      let e = y > shY - (tpose ? 0.16 : 0.06) ? shx : Infinity; for (let q = 1; q < xs.length; q++) if (xs[q - 1] > 0.08 && xs[q] - xs[q - 1] > 0.035) { e = Math.min(e, (xs[q] + xs[q - 1]) / 2); break; }
      edge[S].push(e); } }
  const isArm = (x, y) => { const S = x > 0 ? 'L' : 'R', e = edge[S][Math.max(0, Math.min(edge[S].length - 1, Math.floor(y / SL)))]; const ax = Math.abs(x); if (tpose && y > armY + 0.09 && ax < Math.abs(J['up' + S][0]) + 0.15) return false; return ax > e && y > J['tip' + S][1] - 0.12 || ax > Math.abs(J['up' + S][0]) + 0.12; };
  const names = ['hips', 'spine', 'chest', 'neck', 'head', 'upL', 'foreL', 'handL', 'upR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
  const parent = { spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', upL: 'chest', foreL: 'upL', handL: 'foreL', upR: 'chest', foreR: 'upR', handR: 'foreR', thighL: 'hips', shinL: 'thighL', footL: 'shinL', thighR: 'hips', shinR: 'thighR', footR: 'shinR' };
  const end = { hips: 'spine', spine: 'chest', chest: 'neck', neck: 'head', head: 'top', upL: 'foreL', foreL: 'handL', handL: 'tipL', upR: 'foreR', foreR: 'handR', handR: 'tipR', thighL: 'shinL', shinL: 'footL', footL: 'toeL', thighR: 'shinR', shinR: 'footR', footR: 'toeR' };
  const bones = names.map(nm => { const b = new THREE.Bone(); b.name = nm; return b; }), B = Object.fromEntries(names.map((nm, k) => [nm, bones[k]])), W = nm => new THREE.Vector3(...J[nm]);
  for (const nm of names) { const b = B[nm]; if (parent[nm]) { B[parent[nm]].add(b); b.position.copy(W(nm)).sub(W(parent[nm])); } else b.position.copy(W(nm)); }
  // weights: nearest segment wins; near a joint the two closest share. Torso segments are favoured slightly so armpits stay with the chest;
  // the head mesh follows the head and neck only.
  const seg = names.map(nm => [W(nm), W(end[nm]), /^(hips|spine|chest)$/.test(nm) ? 0.8 : 1]), p = new THREE.Vector3(), c = new THREE.Vector3(), l3 = new THREE.Line3(), headOnly = [3, 4];
  const root = new THREE.Group(), skel = new THREE.Skeleton(bones); let first = null;
  geos.forEach((geo, gi) => {
    const P = geo.attributes.position, m = P.count, si = new Uint16Array(m * 4), sw = new Float32Array(m * 4)
    for (let k = 0; k < m; k++) {
      p.set(P.getX(k), P.getY(k), P.getZ(k)); let a = 0, da = Infinity, b = 0, db = Infinity;
      // only what lies along the arm, outside the shoulder joint, is arm; the jacket's sides and the armpit stay with the torso
      const isHead = p.y > collar - 0.01 && Math.abs(p.x) < 0.15, sideL = p.x > 0, armV = !isHead && isArm(p.x, p.y);
      seg.forEach(([s0, s1, f], q) => { if (isHead && !headOnly.includes(q)) return; const arm = q >= 5 && q <= 10; if (arm ? (!armV || (q <= 7) !== sideL) : armV) return; l3.set(s0, s1); l3.closestPointToPoint(p, true, c); const d = c.distanceTo(p) * f; if (d < da) { b = a; db = da; a = q; da = d; } else if (d < db) { b = q; db = d; } });
      let wa = 1, wb = 0; if (db < da * 1.35) { const ia = 1 / Math.pow(da + 1e-3, 4), ib = 1 / Math.pow(db + 1e-3, 4); wa = ia / (ia + ib); wb = 1 - wa; }
      // quest-store: the shoulder blends. Arm and torso were split hard, so a raised arm tore away from a flap of shoulder left on the
      // chest (hands-up hostages looked to have arms coming out of their chests). Round the shoulder joint the weight now passes
      // gradually from the chest to the upper arm, across the deltoid and the top of the armpit.
      if (!isHead) { const S = sideL ? 'L' : 'R', ui = sideL ? 5 : 8, shx = Math.abs(J['up' + S][0]), ax = Math.abs(p.x), dy = p.y - shY;
        if (ax > shx - 0.1 && ax < shx + 0.12 && dy > -0.2 && dy < 0.12 && (a === 2 || a === 1 || (a === ui && ax < shx + 0.02))) {
          const sm = (e0, e1, v) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
          const t = sm(shx - 0.1, shx + 0.05, ax) * (1 - sm(0.04, 0.12, dy)) * sm(-0.2, -0.1, dy);
          if (t > 0.02 && t < 0.98) { a = ui; b = 2; wa = t; wb = 1 - t; } else if (t >= 0.98) { a = ui; b = 0; wa = 1; wb = 0; } } }
      si[k * 4] = a; si[k * 4 + 1] = b; sw[k * 4] = wa; sw[k * 4 + 1] = wb;
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    const mat = parts[gi].material; mat.envMap = envMap; mat.userData.env = mat.envMapIntensity = 0.2; mat.metalness = 0; if (mat.transparent) { mat.transparent = false; mat.alphaTest = 0.5; mat.depthWrite = true; }   // hair cards and lashes: cut out, not blended (blending sorts badly) if (!pbrMats.includes(mat)) pbrMats.push(mat);
    const mesh = new THREE.SkinnedMesh(geo, mat); mesh.receiveShadow = true; if (!first) { first = mesh; mesh.add(B.hips); } root.add(mesh);
  });
  root.updateMatrixWorld(true); skel.calculateInverses(); for (const o of root.children) o.bind(skel, first.matrixWorld);
  return { id: 'civ' + i, def: 'psx', scene: root, k: 1, y0: 0, name };
}

// Fewer pieces per character, same look (quest-store, VRC.Quest.Performance.1). The officer model arrives as 35 skinned pieces,
// 17 of them the same uniform cloth, and every piece costs a draw call per eye per frame. Pieces that share a material, a parent,
// a placement and a skeleton are stitched into one. Each material keeps its own piece, so anything found by material (your own
// goggles, hidden in first person) still is.
const rigKey = sk => sk.bones.map(b => b.uuid).join();
function packRig(sc) {
  sc.updateMatrixWorld(true);
  const groups = new Map(); sc.traverse(o => { if (!o.isSkinnedMesh || Array.isArray(o.material) || o.geometry.morphAttributes.position) return;
    const k = [o.parent.uuid, o.material.uuid, rigKey(o.skeleton), o.matrix.elements.map(v => v.toFixed(5)).join(), o.bindMatrix.elements.map(v => v.toFixed(5)).join(), !!o.geometry.index, Object.keys(o.geometry.attributes).sort().join()].join('|');
    (groups.get(k) || groups.set(k, []).get(k)).push(o); });
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geo = mergeGeometries(list.map(o => o.geometry)); if (!geo) continue;
    const a = list[0], m = new THREE.SkinnedMesh(geo, a.material); m.name = a.name; m.matrix.copy(a.matrix); m.matrix.decompose(m.position, m.quaternion, m.scale);
    m.castShadow = a.castShadow; m.receiveShadow = a.receiveShadow; a.parent.add(m); m.bind(a.skeleton, a.bindMatrix);
    for (const o of list) o.parent.remove(o);
  }
}

// Clone a rigged scene. Pieces that shared a skeleton in the original share one in the copy: each skeleton works out its bone
// matrices and sends them to the GPU every frame, so one per character instead of one per piece.
function cloneSkinned(src) {
  const out = src.clone(true), sMap = new Map(), list = [], skels = new Map();
  (function walk(a, b) { sMap.set(a, b); for (let i = 0; i < a.children.length; i++) walk(a.children[i], b.children[i]); })(src, out);
  src.traverse(o => { if (o.isSkinnedMesh) list.push(o); });
  for (const o of list) { const c = sMap.get(o), k = rigKey(o.skeleton) + '|' + o.skeleton.boneInverses.length;
    let sk = skels.get(k); if (!sk || sk.src.boneInverses.some((m, i) => !m.equals(o.skeleton.boneInverses[i]))) { sk = { s: new THREE.Skeleton(o.skeleton.bones.map(b => sMap.get(b)), o.skeleton.boneInverses), src: o.skeleton }; skels.set(k, sk); }
    c.bind(sk.s, o.bindMatrix); c.frustumCulled = false; }
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
    if (def.rest) this.role.rest = { L: def.rest.L.map(c => c.map(B)), R: def.rest.R.map(c => c.map(B)) };
    this.str = new Float32Array(n).fill(1);   // quest-store: per-bone stretch of its offset from the parent (arms reaching past their length)
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
      const k = this.str[i]; if (k !== 1 || b.userData.str) { b.position.copy(rp[i]).multiplyScalar(k); b.userData.str = k !== 1; }   // the skin follows the moved joint
      gp[i].copy(rp[i]).multiplyScalar(s * k).applyQuaternion(PQ).add(PP);
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
