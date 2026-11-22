(async () => {
  const B = window.__bl, THREE = B.THREE, X = window.__xr, wait = ms => new Promise(r => setTimeout(r, ms)), out = {}, ED = B.ED, E = ED._E;
  const until = async (f, n = 60) => { for (let i = 0; i < n && !f(); i++) await wait(150); return !!f(); };
  await until(() => B.S.mode === 'vr' && B.M.id === 'training' && B.S.me.id, 80); await wait(800);
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (B.S.tilt || 0) * Math.PI / 180);
  const point = async (x, y, z) => { B.rig.updateMatrixWorld(true); const hp = new THREE.Vector3(...X.right.p).applyMatrix4(B.rig.matrixWorld), d = new THREE.Vector3(x, y, z).sub(hp).normalize();
    const qw = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), d).multiply(tilt.clone().invert()); const ql = B.rig.quaternion.clone().invert().multiply(qw); X.right.q = [ql.x, ql.y, ql.z, ql.w]; await wait(120); };
  const trig = async v => { X.btn('right', 0, v); await wait(150); };
  const tap = async (x, z, y = 0) => { await point(x, y, z); await trig(1); await trig(0); await wait(250); };
  const drag = async (x0, z0, x1, z1, y = 0) => { await point(x0, y, z0); await trig(1); for (let k = 1; k <= 5; k++) await point(x0 + (x1 - x0) * k / 5, y, z0 + (z1 - z0) * k / 5); await trig(0); await wait(300); };
  const go = async (x, z) => { B.rig.position.x += x - B.head.pos.x; B.rig.position.z += z - B.head.pos.z; await wait(300); };
  B.openEditor(); await wait(400); ED.act('open:blank'); await wait(600);
  await go(14, 26);
  ED.act('tool:room'); await drag(8, 8, 16, 15); await wait(300); await go(20, 26); await drag(17, 9, 23, 15); await wait(300); await go(14, 26);
  ED.act('tool:door'); await tap(12, 15.2); await tap(20, 15.2);
  ED.act('tool:glass'); await drag(21, 15.2, 22.5, 15.2); await drag(9, 15.2, 11, 15.2);
  await go(15, 14);
  ED.act('tool:furn'); await tap(10, 9.5); await tap(13.5, 12); await go(20, 13); await tap(19, 10.5); await tap(22, 12); await go(15, 14);
  ED.act('tool:s'); await tap(11, 12); await go(20, 13); await tap(21, 13.5); ED.act('tool:c'); await tap(18.5, 12.5); await go(15, 14); ED.act('tool:b'); await tap(9.5, 13.5);
  await go(15, 26); ED.act('tool:spawn'); await tap(14, 21);
  ED.act('tool:tree'); await tap(4, 17); await tap(3, 9); await tap(26, 5); await tap(6, 3); await tap(29, 9);
  ED.act('tool:pwall'); await drag(2, 23, 10, 23); 
  out.doc = [ED.doc.rooms.length, ED.doc.furniture.length, ED.doc.s.length, ED.doc.trees.length].join('|');
  window.__X = X; return out;
})()
