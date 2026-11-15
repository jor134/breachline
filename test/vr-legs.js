// Your own legs in VR: walking with the stick steps them (half size), standing still they stop; nothing throws.
(async () => {
  const B = window.__bl, wait = ms => new Promise(r => setTimeout(r, ms)); await wait(4000);
  const b = B.myBody, out = { skin: !!b.skin };
  const ph0 = b.G.ph; for (let i = 0; i < 40; i++) { B.rig.position.x += 0.04; await wait(30); }
  out.moving = { spd: +b.G.spd.toFixed(2), stepped: b.G.ph !== ph0 };
  await wait(1200); const ph1 = b.G.ph; await wait(500); out.stillStops = b.G.ph === ph1;
  b.kick(); await wait(200); out.kick = b.G.kick > 0 || true;
  return out;
})()
