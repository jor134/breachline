// Night-vision goggles flip down and up instead of switching instantly: a dark band (the goggle housing passing in front of the
// eyes) sweeps down over the view, the green image comes on behind it as it passes, and the band carries on out at the bottom.
// Flipping them up runs it the other way. About a third of a second each way.
import * as THREE from '../../vendor/three.module.min.js';

export function makeNvgFlip(camera, apply) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.25, 'rgba(0,0,0,1)'); gr.addColorStop(0.75, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const band = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, depthWrite: false, fog: false }));
  band.position.z = -0.3; band.renderOrder = 997; band.visible = false; camera.add(band);
  const F = { t: -1, down: true, swapped: false, T: 0.34 };
  F.busy = () => F.t >= 0;
  F.start = down => { F.t = 0; F.down = down; F.swapped = false; band.visible = true; };
  F.tick = dt => {
    if (F.t < 0) return; F.t += dt; const u = Math.min(1, F.t / F.T), e = u * u * (3 - 2 * u), y = F.down ? 1.3 - 2.6 * e : -1.3 + 2.6 * e;
    band.position.y = y;
    if (!F.swapped && u >= 0.5) { F.swapped = true; apply(F.down); }   // the band covers the eyes: switch the picture behind it
    if (u >= 1) { F.t = -1; band.visible = false; }
  };
  return F;
}
