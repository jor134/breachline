// quest-store: START MISSION and JOIN A SQUAD panels (quick match, friends, 6-character room codes), PLAYERS detail, the suppressor and the pistol's
// spare magazine. Runs without the Worker: friends show as unavailable.
(async () => {
  const B = window.__bl, U = B.storeUI, out = {}, wait = ms => new Promise(r => setTimeout(r, ms)), P = B.panel;
  U.showStart(); U.act('st:mode'); out.modeBtns = P.btns.map(b => b.act).join(','); out.noSolo = !P.btns.some(b => b.act === 'st:solo'); out.openDefault = U.hostOpen;
  U.act('st:online'); out.online = P.btns.map(b => b.act).join(',');
  U.act('st:code'); out.keys = P.btns.filter(b => b.act.startsWith('st:key:')).length;
  for (const k of 'AB2') U.act('st:key:' + k); U.act('st:join'); out.shortCode = U.msg;
  U.act('st:new'); out.newCode = U.code; out.newOk = /^[A-HJ-NP-Z2-9]{6}$/.test(U.code);
  U.act('st:oback'); U.act('st:fl:0'); await wait(300); out.friends = P.key.slice(0, 120);
  U.act('st:ohome'); U.act('st:hostopen'); out.hostOpen = U.hostOpen; U.act('st:hostopen');
  U.act('st:qm'); await wait(400); out.qm = P.key.slice(0, 140); U.act('st:mmstop');
  out.wsExtra = U.wsExtra('ABCDEF', false);
  U.act('st:back');
  B.toggleMenu(true); out.menuSupp = P.btns.some(b => b.act === 'supp');
  const { SUPP } = await import('/js/actors.js'); const before = SUPP.on; B.panelAct ? 0 : 0;
  out.suppBefore = before;
  B.toggleMenu(false);
  // mutes: a stranger from quick match starts muted, a friend does not
  B.S.officers.set(7, { name: 'HAWK-11', bot: false }); B.S.officers.set(8, { name: 'WOLF-40', bot: false });
  U.onMsg({ t: 'owner', id: B.S.me.id, open: true, mm: [7, 8] }); U.onMsg({ t: 'rel', m: { 8: 'friend' } });
  out.strangerMuted = B.voice.isPeerMuted(7); out.friendMuted = B.voice.isPeerMuted(8);
  U.act('st:pl:7'); out.player = P.btns.map(b => b.text).join(' | ');
  U.act('st:mute:7'); out.unmutedSticks = !B.voice.isPeerMuted(7); U.onMsg({ t: 'owner', id: B.S.me.id, open: true, mm: [7, 8] }); out.unmutedStillAfterOwner = !B.voice.isPeerMuted(7);
  U.act('st:players'); out.players = P.btns.map(b => b.text).join(' | ');
  await wait(1500);
  const { loadSidearm } = await import('/js/m4.js'); const r = await loadSidearm(); out.supp = r.supp.children.length; out.suppTip = r.pts.suppTip && r.pts.suppTip.z.toFixed(3); out.muzzle = r.pts.muzzle.z.toFixed(3); out.magLoose = !!r.magLoose;
  return out;
})()
