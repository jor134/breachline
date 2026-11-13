// Your own body in VR must sit behind your eyes, looking level and looking down (run: python3 test/vr.py test/vr-body.js shot.png with BL_QS='&chars=1').
// Expect neckAhead < -0.05 in both, i.e. the neck is behind the eyes.
(async () => {
  const B = window.__bl, X = window.__xr, wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
  await wait(4000);
  for (const [name, a] of [['level', 0], ['down60', -1.05]]) {
    X.head.q = [Math.sin(a / 2), 0, 0, Math.cos(a / 2)]; await wait(1500);
    const sk = B.myBody.skin; if (!sk) return 'no skin';
    const V = B.rig.position.constructor, head = new V(), neck = new V(), chest = new V(); B.camera.getWorldPosition(head);
    const r = sk.role; sk.bones[r.neck].getWorldPosition(neck); sk.bones[r.spine[r.spine.length - 1]].getWorldPosition(chest);
    const fwd = new V(0, 0, -1).applyQuaternion(B.camera.getWorldQuaternion(new B.rig.quaternion.constructor())); fwd.y = 0; fwd.normalize();
    out[name] = { neckAhead: +neck.clone().sub(head).dot(fwd).toFixed(3), chestAhead: +chest.clone().sub(head).dot(fwd).toFixed(3), neckBelow: +(head.y - neck.y).toFixed(3) };
  }
  return out;
})()
