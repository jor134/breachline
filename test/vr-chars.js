// Squad and suspect models: your own body and arms follow the controllers, a teammate in front shows the full model.
(async () => {
  const THREE = window.__bl.THREE, B = window.__bl, X = window.__xr, wait = ms => new Promise(r => setTimeout(r, ms)), out = {}, host = B.net.host, sim = host.sim;
  B.net.send({ t: 'start' }); await wait(1500); sim.addPlayer(2, 'BRAVO'); await wait(2500);
  for (const n of sim.npcs) if (n.kind === 's') n.st = 'u'; sim.players.get(1).hp = 1e9;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, 0, 0, 'YXZ')); X.head.q = q.toArray();   // look down at yourself
  X.right.p = [0.12, 1.15, -0.32]; X.right.q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, 0, 0)).toArray(); X.left.p = [-0.2, 1.2, -0.45]; X.left.q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 0.3, 0.9)).toArray();
  const mate = () => { const h = B.head.pos, f = B.head.fwd, fx = f.x, fz = f.z, l = Math.hypot(fx, fz), x = h.x + fx / l * (window.__md || 2.0), z = h.z + fz / l * (window.__md || 2.0), yaw = Math.atan2(fx / l, fz / l), hq = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, yaw, 0, 'YXZ'));
    const loc = (dx, dy, dz) => new THREE.Vector3(dx, dy, dz).applyQuaternion(hq).add(new THREE.Vector3(x, 1.68, z)), r = loc(...(window.__rh || [0.14, -0.32, -0.28])), lft = loc(...(window.__lh || [-0.08, -0.3, -0.58])); const hq2 = window.__hq ? hq.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...window.__hq))) : hq;
    sim.pose(2, { h: [x, 1.68, z, ...hq.toArray()], r: [r.x, r.y, r.z, ...hq2.toArray()], l: [lft.x, lft.y, lft.z, ...hq2.toArray()], g: window.__g || [0, 1] }); };
  try { mate(); } catch (e) { out.err = String(e); } const iv = setInterval(mate, 60); await wait(4000);
  const me = B.myBody || null; out.officers = B.S.officers.size; const o = [...B.S.officers.values()][0]; out.mateSkin = !!(o && o.body.skin);
  out.suspectSkins = [...B.S.actors.values()].filter(a => a.skin).length;
  const P = v => v.toArray().map(x => +x.toFixed(2)); out.myHead = P(B.head.pos); out.mateHead = o && P(o.head.position); out.mateHolder = o && o.body.holder && P(o.body.holder.position); out.myHolder = B.myBody.holder && P(B.myBody.holder.position);
  out.myEye = B.myBody.eye && P(B.myBody.eye); out.mateHeadBone = o && o.body.skin && P(o.body.skin.bones[o.body.skin.role.head].getWorldPosition(new THREE.Vector3()));
  await wait(1500); clearInterval(iv);
  return out;
})()
