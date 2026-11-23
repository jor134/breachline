// quest-store: main menu > CREDITS > DEBUG ON > TEST MODE pad > a code > ENTER (no Worker here: it answers with an error) > BACK
// lands on the credits again, and BACK there on the main menu. (q50 left you stuck on the pad.)
(async () => { const B = window.__bl, U = B.storeUI, P = B.panel, wait = ms => new Promise(r => setTimeout(r, ms)), out = {}; await wait(3000);
  const btns = () => P.btns.map(b => b.text);
  U.store = true; U.showStart(); U.act('st:credits:0'); out.credits = B.S.panel;
  if (!btns().some(t => t.startsWith('TEST MODE'))) U.act('st:debug'); out.debugBtns = btns().filter(t => /DEBUG|TEST/.test(t));
  U.act('st:tester'); out.pad = B.S.panel;
  for (const k of '1234567') U.act('st:tkey:' + k); U.act('st:tgo'); await wait(1500); out.afterEnter = B.S.panel; out.msg = U.tmsg;
  U.act('st:tback'); await wait(200); out.afterBack = B.S.panel; out.held = U.holdsPanel(); out.btns = btns();
  U.redraw(); out.afterRedraw = B.S.panel;
  const back = P.btns.find(b => b.text === 'BACK'); if (back) U.act(back.act.replace(/^st:/, 'st:')); await wait(200); out.home = B.S.panel;
  return out; })()
