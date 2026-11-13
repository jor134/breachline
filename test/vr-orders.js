// Order wheel in VR: hold the left upper button (Y), move the hand down onto HOLD, let go: every bot holds. A short tap still shouts.
(async () => {
  const THREE = window.__bl.THREE, B = window.__bl, X = window.__xr, wait = ms => new Promise(r => setTimeout(r, ms)), out = {}, sim = B.net.host.sim;
  const toLocal = v => { const p = v.clone(); B.rig.worldToLocal(p); return [p.x, p.y, p.z]; }, until = async (f, n = 60) => { for (let i = 0; i < n && !f(); i++) await wait(250); return !!f(); };
  B.net.send({ t: 'restart', wx: 'clear', map: 'mansion' }); await until(() => B.S.phase === 'active' && sim.bots().length === 3); out.bots = sim.bots().length;
  await until(() => [...B.S.officers.values()].filter(o => o.bot).length === 3); out.seen = [...B.S.officers.values()].filter(o => o.bot).length;
  const base = B.head.pos.clone().add(new THREE.Vector3(-0.2, -0.25, -0.4)); X.left.p = toLocal(base); await wait(600);
  X.btn('left', 5, 1); await until(() => B.wheel.open, 40); out.open = B.wheel.open; out.kind = B.wheel.kind; out.items = B.wheel.items.map(i => i[0]).join(','); out.bin = B.hands[0].in.b; out.bT = B.hands[0].bT; out.target = B.wheel.target && B.wheel.target.kind;
  const deg = B.wheel.items.find(i => i[0] === 'hold')[2] * Math.PI / 180; B.wheel.mesh.updateMatrixWorld(true); X.left.p = toLocal(B.wheel.mesh.localToWorld(new THREE.Vector3(Math.cos(deg) * 0.11, -Math.sin(deg) * 0.11, 0))); await wait(2500);
  out.sel = B.wheel.sel; X.btn('left', 5, 0); out.held = await until(() => sim.bots().every(p => p.bot.base === 'hold'), 40);
  const shouts = () => sim.events.length; X.btn('left', 5, 1); await wait(100); X.btn('left', 5, 0); await wait(600);
  out.stillHolding = sim.bots().every(p => p.bot.base === 'hold');
  return out;
})()
