// quest-store menus (22 Nov): main menu > START MISSION > PLAY SOLO > board step 1 (pick a mission) > step 2 (options, START)
(async () => { const B = window.__bl, U = B.storeUI, P = B.panel, wait = ms => new Promise(r => setTimeout(r, ms)), out = {}, shots = {}; await wait(3000);
  const btns = () => P.btns.map(b => b.text), snap = n => { shots[n] = P.c.toDataURL('image/png'); };
  U.store = true; U.showStart(); out.main = btns(); snap('main');
  U.act('st:mode'); out.mode = btns(); snap('mode');
  U.act('st:mine'); await wait(7000); B.S.panel = null; B.showLobbyPanel(); await wait(300); out.step1 = btns(); snap('step1');
  const pick = P.btns.find(b => b.act === 'pick:terminal'); B.panelAct(pick.act); await wait(300); out.step2 = btns(); out.next = B.S.nextMap; snap('step2');
  B.panelAct('bmaps'); await wait(200); out.back = P.key.slice(0, 15);
  B.toggleMenu(true); out.menu = btns(); B.toggleMenu(false);
  return { out, shots }; })()
