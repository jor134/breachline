// Minimal fake WebXR device for headless testing of the VR code path.
(() => {
  const compose = (p, q) => { const [x, y, z, w] = q, x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
    return new Float32Array([1 - (yy + zz), xy + wz, xz - wy, 0, xy - wz, 1 - (xx + zz), yz + wx, 0, xz + wy, yz - wx, 1 - (xx + yy), 0, p[0], p[1], p[2], 1]); };
  const tf = (p, q) => ({ matrix: compose(p, q), position: { x: p[0], y: p[1], z: p[2], w: 1 }, orientation: { x: q[0], y: q[1], z: q[2], w: q[3] } });
  const persp = (fov, a, n, f) => { const t = 1 / Math.tan(fov / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); };
  const mkPad = () => ({ mapping: 'xr-standard', buttons: Array.from({ length: 6 }, () => ({ value: 0, pressed: false, touched: false })), axes: [0, 0, 0, 0], pulses: 0, hapticActuators: [{ pulse() { pad.pulses++; return Promise.resolve(); } }] });
  let pad;
  const X = window.__xr = { head: { p: [0, 1.7, 0], q: [0, 0, 0, 1] }, left: { p: [-0.25, 1.2, -0.3], q: [0, 0, 0, 1], pad: mkPad() }, right: { p: [0.25, 1.2, -0.3], q: [0, 0, 0, 1], pad: mkPad() }, frames: 0 };
  for (const k of ['left', 'right']) { const pd = X[k].pad; pd.hapticActuators = [{ pulse() { pd.pulses++; return Promise.resolve(); } }]; }
  X.btn = (hand, i, v) => { const b = X[hand].pad.buttons[i]; b.value = v; b.pressed = v > 0.5; };
  const W = 1100, Hh = 600;
  window.XRWebGLBinding = undefined; try { delete window.XRWebGLBinding; } catch { }
  window.XRWebGLLayer = class { constructor() { this.framebuffer = null; this.framebufferWidth = W; this.framebufferHeight = Hh; this.fixedFoveation = 0; } getViewport(v) { return v.eye === 'left' ? { x: 0, y: 0, width: W / 2, height: Hh } : { x: W / 2, y: 0, width: W / 2, height: Hh }; } };
  const srcs = ['left', 'right'].map(h => ({ handedness: h, targetRayMode: 'tracked-pointer', targetRaySpace: { k: h, t: 'ray' }, gripSpace: { k: h, t: 'grip' }, get gamepad() { return X[h].pad; }, profiles: ['oculus-touch-v3'] }));
  class Session extends EventTarget {
    constructor() { super(); this.renderState = { baseLayer: null }; this.inputSources = srcs; this.visibilityState = 'visible'; this.environmentBlendMode = 'opaque'; this.ended = false; }
    updateRenderState(s) { Object.assign(this.renderState, s); }
    async requestReferenceSpace() { return { getOffsetReferenceSpace() { return this; } }; }
    requestAnimationFrame(cb) {
      return requestAnimationFrame(t => {
        if (this.ended) return; X.frames++;
        const frame = { session: this,
          getViewerPose: () => ({ transform: tf(X.head.p, X.head.q), views: ['left', 'right'].map((eye, i) => ({ eye, projectionMatrix: persp(1.6, W / 2 / Hh, 0.05, 200), transform: tf([X.head.p[0] + (i ? 0.032 : -0.032), X.head.p[1], X.head.p[2]], X.head.q) })) }),
          getPose: sp => ({ transform: tf(X[sp.k].p, X[sp.k].q) }) };
        cb(t, frame);
      });
    }
    cancelAnimationFrame(id) { cancelAnimationFrame(id); }
    async end() { this.ended = true; this.dispatchEvent(new Event('end')); }
  }
  const xr = { isSessionSupported: async () => true, requestSession: async () => { const s = new Session(); setTimeout(() => { const e = new Event('inputsourceschange'); e.added = srcs; e.removed = []; s.dispatchEvent(e); }, 50); return s; }, addEventListener() { } };
  Object.defineProperty(navigator, 'xr', { value: xr, configurable: true });
  const gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (...a) { const c = gc.apply(this, a); if (c && a[0] && a[0].startsWith('webgl')) c.makeXRCompatible = async () => { }; return c; };
})();
