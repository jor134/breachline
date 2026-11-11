(async () => {
  const THREE = window.__bl.THREE, B = window.__bl, X = window.__xr, wait = ms => new Promise(r => setTimeout(r, ms)), out = {}, sim = B.net.host.sim;
  const toLocal = v => { const p = v.clone(); B.rig.worldToLocal(p); return [p.x, p.y, p.z]; }, until = async (f, n = 60) => { for (let i = 0; i < n && !f(); i++) await wait(250); return !!f(); };
  B.net.send({ t: 'restart', wx: 'clear' }); await until(() => B.S.phase === 'active'); for (const n of sim.npcs) if (n.kind === 's') n.st = 'u';
  X.left.p = toLocal(B.bodyPt(B.HOLSTER.flash, new THREE.Vector3())); out.zone = await until(() => B.hands[0].zone === 'flash'); X.btn('left', 1, 1); out.holding = await until(() => B.hands[0].item === 'flash');
  for (let i = 0; i < 5; i++) { X.left.p = toLocal(B.head.pos.clone().add(new THREE.Vector3(-0.3, -0.2 + i * 0.06, -0.3 - i * 0.15))); await wait(400); } X.btn('left', 1, 0); out.thrown = await until(() => sim.players.get(1).fl === 1 && B.hands[0].item === null); out.flashEvent = await until(() => sim.gren.length === 0, 80);
  X.right.p = toLocal(B.guns.rifle.mesh.position.clone()); out.rifleZone = await until(() => B.hands[1].zone === 'rifle'); X.btn('right', 1, 1); out.rifle = await until(() => B.hands[1].item === 'rifle'); X.btn('right', 1, 0); await wait(600);
  X.right.p = toLocal(B.head.pos.clone().add(new THREE.Vector3(0.2, -0.3, -0.35))); await wait(800); out.reticle = B.guns.rifle.ud.ret.visible;
  B.S.tool = 'cam'; const d1 = B.world.level.doors[1]; sim.doorOpen[1] = false; sim.doorTrap[1] = 1; B.rig.position.x += d1.cx - B.head.pos.x; B.rig.position.z += d1.cz + 0.7 - B.head.pos.z; await wait(1200);
  X.left.p = toLocal(new THREE.Vector3(d1.cx, 1.0, d1.cz + 0.25)); await wait(900); X.btn('left', 0, 1); out.cam = await until(() => B.dcam.screen.visible); out.trapShown = B.world.doors[1].trap.visible; out.stillClosed = !sim.doorOpen[1]; X.btn('left', 0, 0); out.camOff = await until(() => !B.dcam.screen.visible);
  B.S.tool = 'cutters'; await wait(500); X.btn('left', 0, 1); out.disarmed = await until(() => !sim.doorTrap[1], 120); X.btn('left', 0, 0);
  return out;
})()
