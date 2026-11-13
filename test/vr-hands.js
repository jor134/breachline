// Own hands seen from the headset: both controllers held out in front, pointing forward, head tilted down. Screenshot check.
(async () => {
  const B = window.__bl, X = window.__xr, wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
  await wait(5000);
  const a = -0.55; X.head.q = [Math.sin(a / 2), 0, 0, Math.cos(a / 2)];
  const h = B.head.pos.clone().sub(B.rig.position);
  X.left.p = [h.x - 0.17, h.y - 0.38, h.z - 0.38]; X.right.p = [h.x + 0.17, h.y - 0.38, h.z - 0.4];
  const t = -0.35; X.left.q = X.right.q = [Math.sin(t / 2), 0, 0, Math.cos(t / 2)];
  await wait(3000); out.skin = !!B.myBody.skin; return out;
})()
