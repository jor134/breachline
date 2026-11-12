(async () => {
  const THREE = window.__bl.THREE, B = window.__bl, X = window.__xr, wait = ms => new Promise(r => setTimeout(r, ms)), out = {}, sim = () => B.net.host.sim;
  const toLocal = v => { const p = v.clone(); B.rig.worldToLocal(p); return [p.x, p.y, p.z]; }, until = async (f, n = 60) => { for (let i = 0; i < n && !f(); i++) await wait(250); return !!f(); };
  out.startMap = B.M.id; B.net.send({ t: 'map', m: 'terminal' }); out.mapSwitched = await until(() => B.M.id === 'terminal' && sim().mapId === 'terminal');
  out.doorsMatch = B.level.doors.length === sim().level.doors.length && B.S.doorOpen.length === B.level.doors.length;
  out.panelAtGate = Math.hypot(B.panel.mesh.position.x - B.M.lobby.x, B.panel.mesh.position.z - B.M.lobby.z) < 0.01;
  B.net.send({ t: 'restart', wx: 'clear', map: B.M.id }); out.started = await until(() => B.S.phase === 'active'); out.simMap = sim().mapId; for (const n of sim().npcs) if (n.kind === 's') n.st = 'u';
  out.atSpawn = Math.hypot(B.head.pos.x - B.M.spawn[0][0], B.head.pos.z - B.M.spawn[0][1]) < 3; out.actors = B.S.actors.size; out.bombs = B.S.bombs.length;
  const L = B.level, di = L.doors.findIndex(d => d.pad !== undefined && d.y === 0), d = L.doors[di], dir = L.map.pads[d.pad].dir;
  B.rig.position.x += d.cx + dir * 0.75 - B.head.pos.x; B.rig.position.z += d.cz - B.head.pos.z; await wait(1500);
  out.lockShown = B.world.doors[di].lock.visible;
  B.S.tool = 'hands'; X.left.p = toLocal(new THREE.Vector3(d.cx + dir * 0.25, 1.1, d.cz)); await wait(900); X.btn('left', 1, 1); await wait(600); X.btn('left', 1, 0); out.handsDoNothing = sim().doorLocked[di] && !sim().doorOpen[di];
  B.S.tool = 'cutters'; await wait(400); X.btn('left', 1, 1); out.snipping = await until(() => B.hands[0].hold && B.hands[0].hold.kind === 'snip', 20); out.cut = await until(() => !sim().doorLocked[di], 40); X.btn('left', 1, 0); await wait(500);
  out.lockGone = await until(() => !B.world.doors[di].lock.visible, 20);
  B.S.tool = 'hands'; await wait(300); X.btn('left', 1, 1); out.opened = await until(() => sim().doorOpen[di], 20); X.btn('left', 1, 0);
  out.leafSwung = await until(() => Math.abs(B.world.doors[di].cur) > 1, 20);
  B.S.feetY = 6.4; B.rig.position.x += 60 - B.head.pos.x; B.rig.position.z += -4 - B.head.pos.z; await wait(1500); out.deckY = +B.S.feetY.toFixed(2);
  return out;
})()
