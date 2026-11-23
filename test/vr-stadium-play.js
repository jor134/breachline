// quest-store: a solo mission on the stadium (a test map: the solo host lets it through only in test mode, so this sets the tester
// token the way the tester pad would). The fly-in, the ropes' feet on the terrace, the match running, the club and suites zones.
(async () => {
  const B = window.__bl, wait = ms => new Promise(r => setTimeout(r, ms)), out = {}, sim = () => B.net.host.sim;
  const errs = []; window.addEventListener('error', e => errs.push(String(e.message)));
  const until = async (f, n = 80) => { for (let i = 0; i < n && !f(); i++) await wait(250); return !!f(); };
  try { localStorage.setItem('bl-tester', 'test-token'); } catch (e) {}
  if (B.TEST) { B.TEST.token = 'test-token'; B.TEST.ok = true; }
  B.net.send({ t: 'map', m: 'stadium' }); out.mapSwitched = await until(() => B.M.id === 'stadium' && sim().mapId === 'stadium');
  B.net.send({ t: 'restart', wx: 'clear', map: 'stadium', tod: 'night' }); out.started = await until(() => B.S.phase === 'active' || !!B.S.fly);
  await wait(600); out.fly = !!B.S.fly; out.flyStart = [B.head.pos.x, B.head.pos.y, B.head.pos.z].map(v => +v.toFixed(1)); const t0 = performance.now(); let frames = 0; const f0 = B.renderer.info.render.frame;
  await until(() => !B.S.fly, 600); await wait(400); out.aboard = B.S.feetY > B.M.spawnY - 0.1 && B.head.pos.y > B.M.spawnY + 1; out.landedY = +B.head.pos.y.toFixed(2);
  const G = B.world.gfx; out.heliVisible = !!B.world.root.parent.getObjectByName('crowd');
  const b0 = { ...B.world.root.parent.getObjectByName('crowd').children[0].position }; await wait(2000); const b1 = B.world.root.parent.getObjectByName('crowd').children[0].position; out.ballMoved = Math.hypot(b1.x - b0.x, b1.z - b0.z) > 0.2;
  out.frames = B.renderer.info.render.frame - f0; out.secs = +((performance.now() - t0) / 1000).toFixed(1);
  const Z = B.world.root.userData.zones || {}; out.zones = Object.fromEntries(Object.entries(Z).map(([k, v]) => [k, v.length]));
  out.phase = B.S.phase; out.npcs = sim().npcs.length; out.bombs = B.S.bombs.length;
  out.errs = errs.slice(0, 5); return out;
})()
