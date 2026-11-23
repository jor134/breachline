// quest-store (23 Nov): hostage voices. A solo mission; every hostage's voice matches their model (man or woman); 'plead' plays
// the recorded 'help', 'comply' the sigh, a hit the cry, each in the hostage's own voice; held hostages sob when you are near.
(async () => {
  const B = window.__bl, wait = ms => new Promise(r => setTimeout(r, ms)), out = {}, sim = () => B.net.host.sim;
  const until = async (f, n = 80) => { for (let i = 0; i < n && !f(); i++) await wait(250); return !!f(); };
  B.net.send({ t: 'restart', wx: 'clear', map: 'mansion' }); out.started = await until(() => B.S.phase === 'active');
  const calls = []; const vo = B.sfx.vo; B.sfx.vo = (n, p, g) => { const r = vo.call(B.sfx, n, p, g); calls.push([n, r]); return r; };
  await wait(3000);
  const civs = [...B.S.actors.values()].filter(a => a.kind === 'c'); out.civs = civs.length; out.women = civs.filter(a => a.female).length;
  const man = civs.find(a => !a.female), woman = civs.find(a => a.female), id = a => [...B.S.actors].find(([k, v]) => v === a)[0];
  for (const a of [man, woman]) if (a) { B.onEvent({ e: 'say', n: id(a), k: 'plead' }); B.onEvent({ e: 'say', n: id(a), k: 'comply' }); B.onEvent({ e: 'hit', n: id(a), dead: false }); }
  out.eventCalls = calls.splice(0);
  // stand by a held hostage for a while: they should sob
  const held = civs.find(a => a.st === 'w'); out.heldState = held ? held.st : null;
  if (held) { const p = held.g.position; B.rig.position.set(p.x + 1.5, p.y, p.z); B.S.feetY = p.y; for (let i = 0; i < 120 && !calls.some(c => c[0].startsWith('vo_c_cry')); i++) await wait(500); }
  out.head = [B.head.pos.x, B.head.pos.y, B.head.pos.z].map(v => +v.toFixed(1)); out.held = held && [held.g.position.x, held.g.position.y, held.g.position.z].map(v => +v.toFixed(1));
  out.cry = calls.filter(c => c[0].startsWith('vo_c_cry'));
  return out;
})()
