// Casino: fast-rope out of the helicopter hand over hand, walk to a roof rope, rappel down the glass with the stick,
// break the window, lean in to the suite. Then the service lift, the CCTV wall and the helicopter leaving.
(async () => {
  const THREE = window.__bl.THREE, B = window.__bl, X = window.__xr, wait = ms => new Promise(r => setTimeout(r, ms)), out = {}, sim = () => B.net.host.sim;
  const toLocal = v => { const p = v.clone(); B.rig.worldToLocal(p); return [p.x, p.y, p.z]; }, until = async (f, n = 60) => { for (let i = 0; i < n && !f(); i++) await wait(250); return !!f(); };
  const errs = []; window.addEventListener('error', e => errs.push(String(e.message)));
  B.net.send({ t: 'map', m: 'casino' }); out.mapSwitched = await until(() => B.M.id === 'casino' && sim().mapId === 'casino');
  B.net.send({ t: 'restart', wx: 'clear', map: 'casino' }); out.started = await until(() => B.S.phase === 'active'); for (const n of sim().npcs) if (n.kind === 's') { n.st = 'u'; n.armed = false; }
  const M = B.M, heliRope = M.ropes.findIndex(r => r.heli); await wait(600);
  out.flying = !!B.S.fly && B.head.pos.x > 80; out.flyStart = [B.head.pos.x, B.head.pos.y, B.head.pos.z].map(v => +v.toFixed(1));
  await until(() => B.S.officers.size >= 1, 20); out.botsRideAlong = B.S.officers.size > 0 && [...B.S.officers.values()].every(o => o.g.position.x > 80);
  out.ropeBlockedInFlight = B.ropes.near(new THREE.Vector3(36 + B.S.fly.off.x, M.spawnY + 1 + B.S.fly.off.y, 10.05 + B.S.fly.off.z), 2) !== heliRope;
  await until(() => !B.S.fly, 600); await wait(400);
  out.spawnAboard = !B.S.fly && B.S.feetY > M.spawnY - 0.1 && B.head.pos.y > M.spawnY + 1 && Math.abs(B.head.pos.x - 36) < 3;
  // grip the fast rope with the left hand, then pull it up hand over hand
  const r0 = M.ropes[heliRope], grab = async (x, z) => { X.btn('left', 1, 0); await wait(120); X.left.p = toLocal(new THREE.Vector3(x, B.head.pos.y - 0.25, z)); await wait(150); X.btn('left', 1, 1); await wait(200); };
  B.rig.position.x += r0.x - B.head.pos.x; B.rig.position.z += (r0.z - 0.65) - B.head.pos.z; await wait(200);
  await grab(r0.x, r0.z); out.clippedHeli = !!B.S.rope && B.S.rope.i === heliRope; const y0 = B.S.feetY;
  for (let k = 0; k < 24 && B.S.rope; k++) { if (k) await grab(r0.x, r0.z); const p = X.left.p.slice(); X.left.p = [p[0], p[1] + 0.45, p[2]]; await wait(600); if (k === 0) out.pullLowers = B.S.feetY < y0 - 0.3; }
  X.btn('left', 1, 0); out.onRoof = !B.S.rope && Math.abs(B.S.feetY - 21.6) < 0.05; out.roofFeet = +B.S.feetY.toFixed(2);
  // walk to the first breach window's rope, clip in, rappel with the stick (back = down)
  const ri = M.ropes.findIndex(r => !r.heli), r1 = M.ropes[ri];
  B.rig.position.x += r1.top0[0] - B.head.pos.x; B.rig.position.z += r1.top0[1] - B.head.pos.z; await wait(300);
  // climb the parapet: grip its top with an empty hand, pull down; then down again and clip in by gripping the davit arm
  X.btn('left', 1, 0); await wait(120); X.left.p = toLocal(new THREE.Vector3(r1.x + 0.6, 21.6 + 1.1, 19.8)); await wait(150); X.btn('left', 1, 1); await wait(250);
  { const p = X.left.p.slice(); X.left.p = [p[0], p[1] - 0.3, p[2]]; await wait(400); } X.btn('left', 1, 0); await wait(300);
  out.onParapet = Math.abs(B.S.feetY - 22.7) < 0.02 && B.head.pos.z > 19.7; out.parapetAt = [B.head.pos.x, B.S.feetY, B.head.pos.z].map(v => +v.toFixed(2));
  B.rig.position.z += 1.5; await wait(300); out.noFallOutward = Math.abs(B.S.feetY - 22.7) < 0.02 && B.head.pos.z < 20.2;
  B.rig.position.z -= 2.2; await wait(500); out.steppedDown = Math.abs(B.S.feetY - 21.6) < 0.02;
  B.rig.position.x += r1.top0[0] - B.head.pos.x; B.rig.position.z += r1.top0[1] - B.head.pos.z; await wait(300);
  X.btn('left', 1, 0); await wait(120); X.left.p = toLocal(new THREE.Vector3(r1.x, r1.arm[1], 19.6)); await wait(150); X.btn('left', 1, 1); await wait(250);
  out.clippedRoof = !!B.S.rope && B.S.rope.i === ri; X.btn('left', 1, 0); await wait(150);
  X.left.pad.axes[3] = 1; await until(() => B.S.rope && B.S.feetY - r1.bot < 0.05, 240); X.left.pad.axes[3] = 0; await wait(300);
  out.atWindow = !!B.S.rope && Math.abs(B.S.feetY - r1.bot) < 0.05; out.hintGlass = B.S.ropeHint;
  const wi = B.level.doors.findIndex(d => d.win && Math.abs(d.cx - r1.winAt[0]) < 0.1); sim().shatter(wi, sim().players.get(B.S.me.id)); await until(() => B.S.doorOpen[wi], 20); await wait(300);
  out.paneGone = !B.world.doors[wi].g.visible; out.hintLean = B.S.ropeHint;
  X.left.pad.axes[3] = -1; await until(() => !B.S.rope, 20); X.left.pad.axes[3] = 0; await wait(300);
  out.inSuite = !B.S.rope && Math.abs(B.S.feetY - 10.8) < 0.05 && B.head.pos.z < 20; out.suiteAt = [B.head.pos.x, B.S.feetY, B.head.pos.z].map(v => +v.toFixed(2));
  // the service lift: into the car at the suites, USE its door, ride down
  const c = M.lift.car, ld = B.level.doors.findIndex(d => d.lift === 1); B.rig.position.x += (c.x0 + c.x1) / 2 - B.head.pos.x; B.rig.position.z += (c.z0 + c.z1) / 2 - B.head.pos.z; await wait(300);
  void ld;   // nothing to press: it leaves by itself
  await until(() => Math.abs(B.S.feetY) < 0.05, 240); out.liftDown = Math.abs(B.S.feetY) < 0.05; { const sp = sim().players.get(B.S.me.id); out.liftPost = { phase: sim().phase, ride: sim().lift.ride, t: sim().t, at: sim().lift.at, simY: sp.y, feet: B.S.feetY, rigY: B.rig.position.y, me: B.S.me.id }; }
  // the CCTV wall refreshes while someone stands in the security office
  B.rig.position.x += 64 - B.head.pos.x; B.rig.position.z += 28 - B.head.pos.z; const calls0 = B.renderer.info.render.frame; await wait(1500); out.cctvFrames = B.renderer.info.render.frame - calls0;
  out.errors = errs.slice(0, 5);
  return out;
})()
