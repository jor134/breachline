// BODY FIT gear up/down moves the vest gear and its grab zones; the slung rifle hangs across the front (barrel level, to the left).
(async () => {
  const B = window.__bl, X = window.__xr, THREE = B.THREE, wait = ms => new Promise(r => setTimeout(r, ms)); await wait(3500);
  const out = {}, zone = () => { const v = new THREE.Vector3(); return v; };
  B.showFit(); await wait(300); out.btns = B.tryPanel ? 'ok' : 'no';
  const r = B.guns ? B.guns.rifle.mesh : null;
  B.fitStep('reset'); await wait(300);
  const y0 = B.myBody.torso.position.y; B.fitStep('gup'); B.fitStep('gup'); await wait(300); out.gearUp = +(B.myBody.torso.position.y - y0).toFixed(3);
  B.fitStep('reset'); await wait(300);
  const m = [...B.rig.parent.children].length;
  // the holstered rifle's barrel direction relative to where you face
  const rifle = B.rifleMesh; if (rifle) { const d = new THREE.Vector3(0, 0, -1).applyQuaternion(rifle.quaternion), f = B.head.fwd.clone().setY(0).normalize(), right = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0));
    out.barrel = { left: +(-d.dot(right)).toFixed(2), down: +(-d.y).toFixed(2), fwd: +d.dot(f).toFixed(2) }; }
  X.head.q = [-0.5, 0, 0, 0.866]; await wait(800);   // look down at yourself
  return out;
})()
