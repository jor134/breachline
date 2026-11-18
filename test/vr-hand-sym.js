// Left and right hands held mirror-symmetrically must pose mirror-symmetrically (in the body's frame).
(async () => {
  const B = window.__bl, X = window.__xr, wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
  await wait(5000);
  const h = B.head.pos.clone().sub(B.rig.position);
  X.left.p = [h.x - 0.2, h.y - 0.4, h.z - 0.35]; X.right.p = [h.x + 0.2, h.y - 0.4, h.z - 0.35];
  const qa = new B.THREE.Quaternion().setFromEuler(new B.THREE.Euler(-0.3, 0.2, 0.1)); X.right.q = qa.toArray(); X.left.q = [qa.x, -qa.y, -qa.z, qa.w];
  await wait(2500);
  const b = B.myBody, sk = b.skin, r = sk.role; if (!sk) return { skin: false };
  const P = i => sk.gp[i].clone();
  const rel = (S) => { const hp = P(r.hand[S]), iq = b.H[S].wq.clone().invert(); const pts = {}; r.fingers[S].forEach((ch, f) => { pts['f' + f] = P(ch[ch.length - 1]).sub(hp); }); pts.th = P(r.thumb[S][2]).sub(hp); pts.el = P(r.fore[S]).sub(hp); for (const k in pts) pts[k].applyQuaternion(iq); return pts; };
  const L = rel('L'), R = rel('R');
  for (const k in L) { const m = L[k].clone(); m.x = -m.x; out[k] = { L: L[k].toArray().map(v => +v.toFixed(3)), R: R[k].toArray().map(v => +v.toFixed(3)), err: +m.distanceTo(R[k]).toFixed(3) }; }
  return out;
})()
