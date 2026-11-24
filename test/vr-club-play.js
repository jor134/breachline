// quest-store: a solo mission on the club (a test map: the solo host lets it through only in test mode, so this sets the tester
// token the way the tester pad would). The squad at the van, the dancers placed, the music running, no errors over a few seconds.
(async () => {
  const B = window.__bl, wait = ms => new Promise(r => setTimeout(r, ms)), out = {}, sim = () => B.net.host.sim, errs = [];
  window.addEventListener('error', e => errs.push(String(e.message)));
  const until = async (f, n = 80) => { for (let i = 0; i < n && !f(); i++) await wait(250); return !!f(); };
  try { localStorage.setItem('bl-tester', 'test-token'); } catch (e) { }
  if (B.TEST) { B.TEST.token = 'test-token'; B.TEST.ok = true; }
  B.net.send({ t: 'map', m: 'club' }); out.mapSwitched = await until(() => B.M.id === 'club' && sim().mapId === 'club');
  B.net.send({ t: 'restart', wx: 'clear', map: 'club', tod: 'night' }); out.started = await until(() => B.S.phase === 'active');
  await wait(1500); out.start = [B.head.pos.x, B.head.pos.y, B.head.pos.z].map(v => +v.toFixed(1));
  out.dancers = !!B.world.root.parent.getObjectByName('dancers');
  const f0 = B.renderer.info.render.frame; await wait(4000); out.frames = B.renderer.info.render.frame - f0;
  out.phase = B.S.phase; out.npcs = sim().npcs.length; out.bombs = B.S.bombs.length; out.errs = errs.slice(0, 5);
  return out;
})()
