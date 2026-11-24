// quest-store: the stadium map with its models (run with BL_Q0='x=1&' so the heavy models load). Renders a few views into one
// contact sheet (drawn over the page, so the harness's screenshot is the sheet) and counts what the scene draws.
(async () => {
  const B = window.__bl, THREE = B.THREE, wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
  B.loadMap(window.__map || 'stadium', window.__tod || 'night', true);
  const until = async (f, n = 120) => { for (let i = 0; i < n && !f(); i++) await wait(250); return !!f(); };
  const scene = B.world.root.parent; out.crowd = await until(() => { let k = 0; scene.traverse(o => { if (o.isInstancedMesh && o.count > 10) k++; }); return k >= (window.__needInst || 4); });
  await wait(1500);
  if (window.__pre) window.__pre(scene, THREE);
  const R = B.renderer; R.setAnimationLoop(null); R.xr.enabled = false;
  let tris = 0, draws = 0; scene.traverse(o => { if ((o.isMesh) && o.visible && o.geometry) { draws++; const n = o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; tris += n * (o.isInstancedMesh ? o.count : 1); } });
  out.tris = Math.round(tris); out.meshes = draws;
  const views = window.__views || [
    [[28, 22, 128], [28, 10, 40]],          // from above the far stand's front: the VIP block across the pitch
    [[31, 31, 40], [31, 20, 14]],           // the fly-in's view down onto the catwalk
    [[22, 12.6, 14], [28, 11.5, 40]],       // in a suite, looking out over the pitch
    [[30, 8.9, 13], [20, 8, 20]],           // the club bar
    [[45, 2, 70], [28, 3, 88]],             // pitch level: players and the far stand
    [[28, 9.5, 31], [28, 4, 45]],           // the terrace: the crowd below
  ];
  const W = 550, H = 300, cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * Math.ceil(views.length / 2); const g = cv.getContext('2d');
  const cam = new THREE.PerspectiveCamera(70, W / H, 0.05, 2000); R.setPixelRatio(1); R.setSize(W, H, false); R.setViewport(0, 0, W, H); R.setScissorTest(false);
  const G = B.world.gfx, head = { pos: new THREE.Vector3() };
  for (let i = 0; i < views.length; i++) { const [p, t] = views[i]; cam.position.set(...p); cam.lookAt(...t); head.pos.copy(cam.position);
    for (let k = 0; k < 8; k++) G.tick(0.05, { S: B.S, head, officers: new Map(), level: B.level, renderer: R, scene });
    R.render(scene, cam); const c = R.domElement; g.drawImage(c, 0, c.height - H, W, H, (i % 2) * W, Math.floor(i / 2) * H, W, H); }
  const img = new Image(); img.src = cv.toDataURL('image/jpeg', 0.85); img.style.cssText = 'position:fixed;left:0;top:0;height:600px;z-index:99999;background:#000'; document.body.appendChild(img); await wait(300);
  if (window.__legend) out.legend = window.__legend;
  if (window.__legend) out.legend = window.__legend;
  return out;
})()
