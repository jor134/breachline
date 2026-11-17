// Casino: fast-rope out of the helicopter hand over hand, walk to a roof rope, rappel down the glass with the stick,
// break the window, lean in to the suite. Then the service lift, the CCTV wall and the helicopter leaving.
(async () => {
  const THREE = window.__bl.THREE, B = window.__bl, X = window.__xr, wait = ms => new Promise(r => setTimeout(r, ms)), out = {}, sim = () => B.net.host.sim;
  const toLocal = v => { const p = v.clone(); B.rig.worldToLocal(p); return [p.x, p.y, p.z]; }, until = async (f, n = 60) => { for (let i = 0; i < n && !f(); i++) await wait(250); return !!f(); };
  const errs = []; window.addEventListener('error', e => errs.push(String(e.message)));
  B.net.send({ t: 'map', m: 'casino' }); out.mapSwitched = await until(() => B.M.id === 'casino' && sim().mapId === 'casino');
  B.net.send({ t: 'restart', wx: 'clear', map: 'casino' }); out.started = await until(() => B.S.phase === 'active'); for (const n of sim().npcs) if (n.kind === 's') { n.st = 'u'; n.armed = false; }
  const RY = B.M.ropes[1].top, SY = B.M.ropes[1].mid.y, PY = B.M.ropes[1].bot;
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
  X.btn('left', 1, 0); out.onRoof = !B.S.rope && Math.abs(B.S.feetY - RY) < 0.05; out.roofFeet = +B.S.feetY.toFixed(2);
  // walk to the first breach window's rope, clip in, rappel with the stick (back = down)
  const ri = M.ropes.findIndex(r => !r.heli), r1 = M.ropes[ri];
  B.rig.position.x += r1.top0[0] - B.head.pos.x; B.rig.position.z += r1.top0[1] - B.head.pos.z; await wait(300);
  // climb the parapet: grip its top with an empty hand, pull down; then down again and clip in by gripping the davit arm
  X.btn('left', 1, 0); await wait(120); X.left.p = toLocal(new THREE.Vector3(r1.x + 0.6, RY + 1.1, 19.8)); await wait(150); X.btn('left', 1, 1); await wait(250);
  { const p = X.left.p.slice(); X.left.p = [p[0], p[1] - 0.3, p[2]]; await wait(400); } X.btn('left', 1, 0); await wait(300);
  out.onParapet = Math.abs(B.S.feetY - RY - 1.1) < 0.02 && B.head.pos.z > 19.7; out.parapetAt = [B.head.pos.x, B.S.feetY, B.head.pos.z].map(v => +v.toFixed(2));
  B.rig.position.z += 1.5; await wait(300); out.noFallOutward = Math.abs(B.S.feetY - RY - 1.1) < 0.02 && B.head.pos.z < 20.2;
  B.rig.position.z -= 2.2; await wait(500); out.steppedDown = Math.abs(B.S.feetY - RY) < 0.02;
  B.rig.position.x += r1.top0[0] - B.head.pos.x; B.rig.position.z += r1.top0[1] - B.head.pos.z; await wait(300);
  X.btn('left', 1, 0); await wait(120); X.left.p = toLocal(new THREE.Vector3(r1.x, r1.arm[1], 19.6)); await wait(150); X.btn('left', 1, 1); await wait(250);
  out.clippedRoof = !!B.S.rope && B.S.rope.i === ri; X.btn('left', 1, 0); await wait(150);
  X.left.pad.axes[3] = 1; await until(() => B.S.rope && B.S.feetY - SY < 0.05, 240); X.left.pad.axes[3] = 0; await wait(300);
  out.atWindow = !!B.S.rope && Math.abs(B.S.feetY - SY) < 0.4; out.hintGlass = B.S.ropeHint;
  const wi = B.level.doors.findIndex(d => d.win && Math.abs(d.cx - r1.winAt[0]) < 0.1); sim().shatter(wi, sim().players.get(B.S.me.id)); await until(() => B.S.doorOpen[wi], 20); await wait(300);
  out.paneGone = !B.world.doors[wi].g.visible; out.hintLean = B.S.ropeHint;
  X.left.pad.axes[3] = -1; await until(() => !B.S.rope, 20); X.left.pad.axes[3] = 0; await wait(300);
  out.inSuite = !B.S.rope && Math.abs(B.S.feetY - SY) < 0.05 && B.head.pos.z < 20; out.suiteAt = [B.head.pos.x, B.S.feetY, B.head.pos.z].map(v => +v.toFixed(2));
  // no walking out of the broken window; reach out for the rope instead and run it all the way down to the casino roof
  B.rig.position.z += 2.5; await wait(400); out.noFallFromWindow = Math.abs(B.S.feetY - SY) < 0.05 && B.head.pos.z < 20.4;
  B.rig.position.x += r1.x - B.head.pos.x; B.rig.position.z += 19.4 - B.head.pos.z; await wait(300); out.promptInside = B.ropes.prompt();
  X.btn('left', 1, 0); await wait(120); X.left.p = toLocal(new THREE.Vector3(r1.x, SY + 1.3, 20.0)); await wait(150); X.btn('left', 1, 1); await wait(250);
  out.backOnRope = !!B.S.rope && Math.abs(B.S.feetY - SY) < 0.05; X.btn('left', 1, 0); await wait(1100);
  const t0 = performance.now(); X.left.pad.axes[3] = 1; await until(() => !B.S.rope, 400); X.left.pad.axes[3] = 0; await wait(300); out.descentSec = +((performance.now() - t0) / 1000).toFixed(1);
  out.onCasinoRoof = !B.S.rope && Math.abs(B.S.feetY - PY) < 0.05 && B.head.pos.z > 20.8; out.casinoRoofAt = [B.head.pos.x, B.S.feetY, B.head.pos.z].map(v => +v.toFixed(2));
  await wait(3000); out.promptAfter = B.ropes.prompt();   // nothing to grab from down here
  out.errors = errs.slice(0, 5);
  return out;
})()
