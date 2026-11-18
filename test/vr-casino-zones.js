// quest-store: the casino floor is hidden up the tower and shown from the casino roof, in the lift and on the floor;
// the suites are hidden on the casino floor. Counts what gets drawn from the suites with and without the split.
(async () => {
  const B = window.__bl, wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
  B.loadMap('casino', 'dusk', true); await wait(1500);
  const Z = B.world.root.userData.zones || {}; out.casinoPieces = (Z.casino || []).length; out.suitePieces = (Z.suites || []).length;
  let tris = 0; for (const m of Z.casino || []) m.traverse(o => { if (o.geometry && o.geometry.index) tris += o.geometry.index.count / 3 * (o.count || 1); }); out.casinoTris = Math.round(tris);
  // a stand-in head, so the game's own frame (which ticks the map with the real head) cannot interfere
  const at = async (x, y, z) => { const head = { pos: new B.THREE.Vector3(x, y, z) }; B.world.gfx.tick(0.016, { S: B.S, head, officers: new Map(), level: B.level, renderer: B.renderer, scene: null });
    return { casino: (Z.casino || []).every(m => m.visible), suites: (Z.suites || []).every(m => m.visible) }; };
  B.renderer.setAnimationLoop(null); out.mode = B.S.mode;
  out.suites = await at(30, 61.2 + 1.7, 10);          // in the penthouse
  out.ropeHigh = await at(30, 20, 21);                 // on a rope well above the casino roof
  out.casinoRoof = await at(29, 7.2 + 1.7, 15);        // standing on the casino roof
  out.liftUp = await at(41.5, 61.2 + 1.7, 1.5);        // in the lift car at the suites
  out.floor = await at(37, 1.7, 20);                   // on the casino floor
  out.street = await at(36, 1.7, 70);                  // out on the drive
  return out;
})()
