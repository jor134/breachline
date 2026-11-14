// The tutorial in VR: it starts on its own (?tut=1), its coach panel floats in front, NEXT is pressed by pointing and pulling
// the trigger, and walking to the green marker passes the MOVE step.
(async () => {
  const THREE = window.__bl.THREE, B = window.__bl, X = window.__xr, wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
  const until = async (f, n = 60) => { for (let i = 0; i < n && !f(); i++) await wait(250); return !!f(); };
  const toLocal = v => { const p = v.clone(); B.rig.worldToLocal(p); return [p.x, p.y, p.z]; };
  out.visible = await until(() => B.coach.mesh.visible, 40); out.active = B.tut.active;
  const btn = B.coach.btns.find(b => b.act === 'tut:next'); out.hasNext = !!btn;
  // aim the right controller at the NEXT button and pull the trigger
  const m = B.coach.mesh; m.updateMatrixWorld(true);
  const target = m.localToWorld(new THREE.Vector3(((btn.x + btn.w / 2) / 1024 - 0.5) * 1.6, (0.5 - (btn.y + btn.h / 2) / 768) * 1.2, 0));
  const from = B.head.pos.clone().add(new THREE.Vector3(0.15, -0.3, 0)), dir = target.clone().sub(from).normalize();
  const wq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir), rq = B.rig.quaternion.clone().invert().multiply(wq);
  X.right.p = toLocal(from); X.right.q = [rq.x, rq.y, rq.z, rq.w]; await wait(500);
  X.btn('right', 0, 1); await wait(300); X.btn('right', 0, 0); await wait(500);
  out.afterNext = B.coach.btns.map(b => b.act).join(',');
  // walk to the firing line marker
  const p = toLocal(new THREE.Vector3(10, 0, 15.7)); B.rig.position.x += 10 - B.head.pos.x; B.rig.position.z += 15.7 - B.head.pos.z; await wait(1500);
  out.afterMove = B.coach.key;
  return out;
})()
