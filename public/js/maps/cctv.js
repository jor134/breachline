// CCTV for the maps that have a security room (the club, the casino): one monitor that cycles through the building's cameras, a
// few seconds each, labelled. Only the camera on screen is drawn, a third of the frames, and only while someone is in the room with
// the power on. Drawing a camera into a picture needs its own build of every material's shader (no tone mapping there), which is
// what made walking into the room hang: those are built once, in the background, on the map's first frame.
import * as THREE from '../../vendor/three.module.min.js';

const label = () => { const c = document.createElement('canvas'); c.width = 512; c.height = 48; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { c, t }; };
// cams: [[name, [x, y, z] position, [x, y, z] looking at]]; at: the screen's centre; ry: its turn (0 faces +z); w: its width (16:9)
export function makeCCTV(root, cams, { at, ry = 0, w = 1.4, hold = 4, inRoom }) {
  const rt = new THREE.WebGLRenderTarget(512, 288), list = [], h = w * 9 / 16;
  for (const [name, p, t] of cams) {
    const cam = new THREE.PerspectiveCamera(78, 16 / 9, 0.1, 140); cam.layers.enable(5); cam.position.set(...p); cam.lookAt(...t); list.push({ name, cam });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.28), new THREE.MeshLambertMaterial({ color: 0xe0e0e0 })); box.position.set(...p); box.lookAt(...t); root.add(box);   // the camera itself
  }
  const g = new THREE.Group(); g.position.set(...at); g.rotation.y = ry; root.add(g);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.14, 0.05), new THREE.MeshLambertMaterial({ color: 0x0b0c0e })); bezel.position.set(0, -0.02, -0.03); g.add(bezel);
  const mat = new THREE.MeshBasicMaterial({ map: rt.texture, color: 0xb8c8e0, toneMapped: false }), screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); g.add(screen);
  const L = label(), lm = new THREE.MeshBasicMaterial({ map: L.t, transparent: true, toneMapped: false }), lab = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, w * 0.6 * 48 / 512), lm); lab.position.set(-w * 0.18, h / 2 - w * 0.035, 0.002); g.add(lab);
  const C = { on: true, k: -1, t: 0, n: 0, warm: false, mats: [mat, lm] };
  const show = k => { C.k = k % list.length; const x = L.c.getContext('2d'); x.clearRect(0, 0, 512, 48); x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(0, 0, 512, 48); x.fillStyle = '#9fd8ff'; x.font = 'bold 30px monospace'; x.textBaseline = 'middle';
    x.fillText(list[C.k].name + '   ' + (C.k + 1) + '/' + list.length, 12, 25); x.fillStyle = '#ff4040'; x.beginPath(); x.arc(492, 24, 8, 0, 6.283); x.fill(); L.t.needsUpdate = true; };
  show(0);
  const draw = (renderer, scene, cam) => { const xe = renderer.xr.enabled, prev = renderer.getRenderTarget(); renderer.xr.enabled = false; renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(prev); renderer.xr.enabled = xe; };
  C.tick = (dt, renderer, scene, head) => {
    if (!renderer) return;
    if (!C.warm) { C.warm = true; const prev = renderer.getRenderTarget(); renderer.setRenderTarget(rt);   // the shaders, built ahead
      try { if (renderer.compileAsync) renderer.compileAsync(scene, list[0].cam).catch(() => { }); else renderer.compile(scene, list[0].cam); } catch (e) { } renderer.setRenderTarget(prev); }
    if (!C.on || !inRoom(head.pos)) return;
    if ((C.t += dt) > hold) { C.t = 0; show(C.k + 1); C.n = 0; }
    if (C.n++ % 3 === 0) draw(renderer, scene, list[C.k].cam);
  };
  C.look = (night, nvg) => { C.on = !night; mat.color.set(night ? 0x000000 : nvg ? 0x8cff9c : 0xb8c8e0); lab.visible = !night; };
  C.dispose = () => { rt.dispose(); L.t.dispose(); };
  return C;
}
