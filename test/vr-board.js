// regression: after PLAY SOLO the training wall shows the MISSION BOARD (q45-q47 showed the mission lobby panel: a comment had swallowed the code)
(async () => { const B = window.__bl, U = B.storeUI, P = B.panel, wait = ms => new Promise(r => setTimeout(r, ms)); await wait(3000);
  U.store = true; U.showStart(); U.act('st:solo'); await wait(3000); B.S.panel = null; B.showLobbyPanel(); await wait(300);
  const first = P.btns.map(b => b.text); B.cycleMap(); await wait(300); const after = P.btns.map(b => b.text).find(t => t.startsWith('MISSION'));
  return { title: P.key.slice(0, 30), first, after }; })()
