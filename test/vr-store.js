// quest-store additions: CREDITS and PLAYERS in the VR menu, and the obfuscated Sketchfab Standard models still load.
(async () => {
  const B = window.__bl, out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
  B.toggleMenu(true); await wait(100);
  out.menuHasCredits = B.panel.btns.some(b => b.act === 'st:credits:0');
  out.soloHasNoPlayers = !B.panel.btns.some(b => b.act === 'st:players');
  B.storeUI.act('st:credits:0'); out.credits1 = B.panel.key.startsWith('CREDITSPage 1 of');
  B.storeUI.act('st:credits:99'); out.creditsWrap = /Page \d+ of/.test(B.panel.key);
  B.toggleMenu(false);
  const { loadSidearm } = await import('/js/m4.js');
  out.pistol = await loadSidearm().then(() => true, e => 'ERR ' + e);
  const { ObfLoader } = await import('/js/store/obf.js');
  out.jet = await new Promise(res => new ObfLoader().load('models/jet/bae146.glb', g => res(!!g.scene && g.scene.children.length > 0), undefined, e => res('ERR ' + e)));
  out.rawGlbGone = (await fetch('models/pistol/pistol.glb')).status;
  return out;
})()
