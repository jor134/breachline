(async () => {
  const B = window.__bl, THREE = B.THREE, w = ms => new Promise(r => setTimeout(r, ms)), C = window.SHOT || {};
  B.begin('desktop'); await w(2500);
  B.net.send({ t: 'restart', map: 'mansion', tod: 'night', wx: 'clear' }); await w(4000);
  document.getElementById('hud').style.display = 'none'; B.camera.traverse(o => { if (o !== B.camera) o.visible = false; }); B.panel.mesh.visible = false;
  const r0 = B.rig.position.clone();
  B.rig.position.set(r0.x + (C.dx||-6), r0.y, r0.z + (C.dz||6)); B.camera.position.y = C.h || 1.66; B.camera.rotation.set(C.pitch||0.05, C.yaw||-0.5, 0, 'YXZ');
  const { Human } = await import('./js/actors.js');
  const fwd = new THREE.Vector3(0, 0, -1).applyEuler(B.camera.rotation); const cp = new THREE.Vector3(); B.camera.getWorldPosition(cp);
  for (const s of (C.sus || [])) { const h = new Human('s', s.v||0, 900 + Math.random()*99|0); B.camera.parent.parent.add(h.g); const p = cp.clone().addScaledVector(fwd, s.d); p.addScaledVector(new THREE.Vector3(1, 0, 0).applyEuler(B.camera.rotation).setY(0).normalize(), s.x || 0); h.target(p.x, r0.y + (s.y||0), p.z, Math.atan2(cp.x - p.x, cp.z - p.z) + (s.yaw||0), s.st||'g', 1); for (let i=0;i<30;i++) h.update(1/30); }
  if (C.yaw2) B.camera.rotation.y += C.yaw2; if (C.pitch2) B.camera.rotation.x += C.pitch2; if (C.fov) { B.camera.fov = C.fov; B.camera.updateProjectionMatrix(); }
  const hide = o => { if (o) Object.defineProperty(o, 'visible', { get: () => false, set() { }, configurable: true }); };
  for (const g of Object.values(B.guns)) hide(g.mesh); hide(B.rifleMesh); B.hands.forEach(h => { hide(h.mesh); hide(h.grip); hide(h.model); });
  if (C.nvg !== false) { B.toggleNVG(); await w(1500); }
  return { cam: cp.toArray().map(v=>+v.toFixed(1)), r0: r0.toArray().map(v=>+v.toFixed(1)) };
})()
