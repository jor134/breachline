(async () => {
  const THREE = window.__bl.THREE, B = window.__bl, X = window.__xr, wait = ms => new Promise(r => setTimeout(r, ms)), out = {}, sim = B.net.host.sim;
  const toLocal = v => { const p = v.clone(); B.rig.worldToLocal(p); return [p.x, p.y, p.z]; }, until = async (f, n = 60) => { for (let i = 0; i < n && !f(); i++) await wait(250); return !!f(); };
  B.net.send({ t: 'restart', wx: 'clear' }); await until(() => B.S.phase === 'active'); for (const n of sim.npcs) if (n.kind === 's') n.st = 'u';
  // fingers follow the controller: open, then a fist
  X.btn('left', 1, 0); X.btn('left', 0, 0); await wait(800); out.open = +B.hands[0].pose.g.toFixed(2);
  X.left.pad.buttons[1].value = 1; X.left.pad.buttons[1].pressed = false; await wait(600);
  // a fist away from any vest item: grip pressed would grab, so test the curl via trigger instead
  X.left.pad.buttons[1].value = 0; X.btn('left', 0, 1); out.indexCurl = await until(() => B.hands[0].pose.i > 0.9); X.btn('left', 0, 0);
  // take the rifle: fingers wrap
  X.right.p = toLocal(B.guns.rifle.mesh.position.clone()); await until(() => B.hands[1].zone === 'rifle'); X.btn('right', 1, 1); await until(() => B.hands[1].item === 'rifle'); X.btn('right', 1, 0); await wait(500); out.wrap = +B.hands[1].pose.g.toFixed(2);
  // radio menu shows END MISSION, pressing it ends the mission
  X.left.p = toLocal(B.bodyPt(B.HOLSTER.radio, new THREE.Vector3())); await until(() => B.hands[0].zone === 'radio'); X.btn('left', 1, 1); await wait(400); X.btn('left', 1, 0); out.menu = await until(() => B.S.menu);
  out.endButton = !!B.panel.btns.find(b => b.act === 'end');
  const eb = B.panel.btns.find(b => b.act === 'end'), bw = B.panel.mesh.localToWorld(new THREE.Vector3(((eb.x + eb.w / 2) / 1024 - 0.5) * 1.6, (0.5 - (eb.y + eb.h / 2) / 768) * 1.2, 0));
  X.left.p = toLocal(B.head.pos.clone().add(new THREE.Vector3(-0.15, -0.25, 0)).addScaledVector(B.head.fwd, 0.25)); await wait(400);
  for (let i = 0; i < 3; i++) { const o = B.hands[0].pos.clone(), m = new THREE.Matrix4().lookAt(o, bw, new THREE.Vector3(0, 1, 0)), q = B.rig.quaternion.clone().invert().multiply(new THREE.Quaternion().setFromRotationMatrix(m)); X.left.q = [q.x, q.y, q.z, q.w]; await wait(300); }
  out.probe = B.panel.probe(B.hands[0].pos, new THREE.Vector3(0, 0, -1).applyQuaternion(B.hands[0].quat), false);
  X.btn('left', 0, 1); await wait(400); X.btn('left', 0, 0); out.ended = await until(() => sim.phase === 'ended', 12); out.menuAfter = B.S.menu; out.mag = B.guns.rifle.st.mag; out.result = sim.report && sim.report.result;
  return out;
})()
