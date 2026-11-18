// quest-store: demo limits. No Digital Goods service here (not a store install), so only the demo plays.
(async () => {
  const B = window.__bl, U = B.storeUI, w = ms => new Promise(r => setTimeout(r, ms)), out = {};
  await U.unlock.ready; out.full = U.unlock.full(); out.store = U.unlock.store;
  const press = act => { const p = B.panel; const b = p.btns.find(x => x.act === act); return b ? (B.tryPanel ? (() => { const save = p.probe; p.probe = () => act; const r = B.tryPanel(new B.THREE.Vector3(), new B.THREE.Vector3(0, 0, -1)); p.probe = save; return r; })() : null) : 'no button ' + act; };
  const act = async a => { const save = B.panel.probe; B.panel.probe = () => a; B.tryPanel(new B.THREE.Vector3(), new B.THREE.Vector3(0, 0, -1)); B.panel.probe = save; await w(400); };
  for (let i = 0; i < 6 && B.S.nextMap !== 'terminal'; i++) await act('map');   // pick the terminal on the board, as a player would
  out.picked = B.S.nextMap; await w(700); out.boardTag = /FULL GAME/.test(B.panel.key);
  const save = B.panel.probe; B.panel.probe = () => 'start'; B.tryPanel(new B.THREE.Vector3(), new B.THREE.Vector3(0, 0, -1)); B.panel.probe = save; await w(300);
  out.blocked = B.S.panel === 'buy'; out.buyText = B.panel.key.slice(0, 60); out.buyBtns = B.panel.btns.map(b => b.act);
  U.act('st:nobuy'); await w(700); out.backToBoard = B.S.panel;
  for (let i = 0; i < 8 && B.S.nextMap !== 'mansion'; i++) await act('map');
  B.panel.probe = () => 'start'; B.tryPanel(new B.THREE.Vector3(), new B.THREE.Vector3(0, 0, -1)); B.panel.probe = save; await w(1500); out.mansionStarts = B.S.phase === 'active';
  B.panel.probe = () => 'edit'; B.tryPanel(new B.THREE.Vector3(), new B.THREE.Vector3(0, 0, -1)); B.panel.probe = save; await w(300); out.editorBlocked = B.S.panel === 'buy';
  return out;
})()
