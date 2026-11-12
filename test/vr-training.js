(async () => {
  const B = window.__bl, wait = ms => new Promise(r => setTimeout(r, ms)), out = {}, sim = B.net.host.sim, me = B.S.me.id;
  await wait(800);
  out.map = B.M.id; out.phase = B.S.phase; out.board = B.S.panel; out.targets = sim.targets.length;
  B.rig.position.set(10, 0, 16.2); await wait(900);
  const p = sim.players.get(me); out.at = [p.hx, p.hz].map(v => +v.toFixed(2));
  sim.t += 1; sim.shot(me, { o: [p.hx, 1.5, p.hz], d: [10 - p.hx, 0.97 - 1.5, 7 - p.hz], w: 'rifle' }); await wait(500);
  out.staticDown = sim.targets[2].up === 0; out.hud = B.S.tstats && B.S.tstats[0];
  // walk into the kill house first room
  const h0 = B.M.houseRooms[0]; B.rig.position.set(23.5, 0, 12.5); await wait(900); out.houseOn = sim.house.on; out.houseUp = sim.targets.filter(t => t.kind === 'house' && t.up).length;
  out.colors = sim.targets.filter(t => t.kind === 'house' && t.room === 0).map(t => t.hostile);
  B.rig.position.set(10, 0, 16.2); await wait(300);
  return out;
})()
