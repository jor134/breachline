// Radio grab zone vs the radio drawn on the vest with the body turned 80 degrees (run with BL_QS='&chars=1'): the vest gear must turn with the body.
(async () => {
  const B = window.__bl, X = window.__xr, wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
  await wait(4000);
  for (const [name, a] of [['level', 0], ['down45', -0.8]]) {
    const qy = new B.camera.quaternion.constructor().setFromAxisAngle(new B.rig.position.constructor(0, 1, 0), 1.4), qx = new B.camera.quaternion.constructor().setFromAxisAngle(new B.rig.position.constructor(1, 0, 0), a), qq = qy.multiply(qx); X.head.q = [qq.x, qq.y, qq.z, qq.w]; await wait(1200);
    const t = B.myBody.torso; t.updateMatrixWorld(true); const p = t.localToWorld(new B.rig.position.constructor(-0.13, -0.3, -0.105));
    // put the left controller on the drawn radio (rig is at the origin, so world = local)
    X.left.p = [p.x - B.rig.position.x, p.y, p.z - B.rig.position.z]; await wait(900);
    const z = B.bodyPt(B.HOLSTER.radio, new B.rig.position.constructor()); out[name] = { zone: B.zoneFor(B.hands[0], B.hands[1]), toZone: +p.distanceTo(z).toFixed(3), dy: +(p.y - z.y).toFixed(3), back: +(B.myBody.back || 0).toFixed(3), active: B.hands[0].active, item: B.hands[0].item || null, held: !!B.hands[0].held };
  }
  return out;
})()
