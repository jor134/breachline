// Gait checks: the squad's feet point forward (no duck walk); a suspect sidestepping plants each foot instead of gliding.
(async () => {
  const B = window.__bl, THREE = B.THREE, wait = ms => new Promise(r => setTimeout(r, ms)), out = {}; await wait(4000);
  // 1. your own (SWAT) legs walking forward: heading of each foot (foot bone to toe bone) in the body's frame, degrees
  const b = B.myBody, sk = b.skin; out.skin = !!sk;
  if (sk) { const hd = { L: [], R: [] };
    for (let i = 0; i < 25; i++) { B.rig.position.z -= 0.05; await wait(30);
      for (const S of ['L', 'R']) { const fi = sk.role.foot[S], ti = sk.par.indexOf(fi), d = sk.gp[ti].clone().sub(sk.gp[fi]); hd[S].push(Math.atan2(d.x, d.z) * 180 / Math.PI); } }
    const avg = a => +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(1); out.footHeadingDeg = { L: avg(hd.L), R: avg(hd.R) }; }
  // 2. a suspect walking sideways (to his left, +x in his frame... world +x with yaw 0): how far the lower (planted) foot slides
  const { Human } = await import('./js/actors.js'); const h = new Human('s', 0, 999); B.camera.parent.parent.add(h.g);
  const ft = [new THREE.Vector3(), new THREE.Vector3()], prev = [null, null]; let x = 0, slide = 0, travel = 0, n = 0;
  h.target(0, 0, 0, 0, 'g', 1);
  for (let i = 0; i < 160; i++) { x += 1.2 / 60; if (i % 4 === 0) h.target(x, 0, 0, 0, 'g', 1); h.update(1 / 60); h.g.updateMatrixWorld(true);
    h.legs.forEach((l, k) => { ft[k].set(0, -0.46, 0.05); l.knee.localToWorld(ft[k]); });
    const lo = ft[0].y < ft[1].y ? 0 : 1; if (i > 40 && prev[lo]) { slide += Math.abs(ft[lo].x - prev[lo].x); travel += 1.2 / 60; n++; }
    prev[0] = ft[0].clone(); prev[1] = ft[1].clone(); }
  out.sidestep = { plantedSlidePerMetre: +(slide / travel).toFixed(2), feetGap: +Math.abs(ft[0].x - ft[1].x).toFixed(2) };
  h.g.parent.remove(h.g);
  return out;
})()
