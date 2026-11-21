// Store build: keeps the frame rate up on every headset (VRC.Quest.Performance.1 wants at least 60 fps; we aim for 72).
//
// - Before VR starts: if this browser cannot scale the viewport per frame (Quest Browser 35+ can), the dynamic step below has
//   nothing to work with, so the render target starts a little smaller instead (Quest 2 more than Quest 3).
// - When VR starts: ask for 72 Hz (both headsets support it; Quest 3 could do 90, but 72 leaves headroom for the busy maps).
// - Every frame: watch for dropped frames. A second with several drops lowers the render resolution a step (dynamic viewport
//   scaling: the browser renders a smaller part of the same target and stretches it, no shader or texture changes, so the step
//   itself costs nothing); eight clean seconds raise it a step again. Foveated rendering is set to its maximum as the session starts.
//   Steps: 100%, 90%, 80%, 72%, 66% of the headset's normal resolution.
export const SCALES = [1, 0.9, 0.8, 0.72, 0.66];

export function makePerf(renderer) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const P = { device: /Quest 2/.test(ua) ? 'quest2' : /Quest 3/.test(ua) ? 'quest3' : /Quest Pro/.test(ua) ? 'questpro' : 'other', level: 0, scale: 1, hz: 72,
    vs: typeof XRView !== 'undefined' && !!XRView.prototype && 'requestViewportScale' in XRView.prototype, drops: 0, frames: 0, winT: 0, clean: 0, cool: 0, log: [] };

  // dynamic viewport scaling: three.js asks the layer for each eye's viewport once a frame; ask for the scaled one first
  if (typeof XRWebGLLayer !== 'undefined' && XRWebGLLayer.prototype && !XRWebGLLayer.prototype.__blScaled) {
    const orig = XRWebGLLayer.prototype.getViewport;
    XRWebGLLayer.prototype.getViewport = function (view) { P.hooked = true; if (view && view.requestViewportScale) { try { view.requestViewportScale(P.scale); } catch (e) { } } return orig.call(this, view); };
    XRWebGLLayer.prototype.__blScaled = true;
  }
  // (q30 also sent the request through the WebXR layers binding; in the headset that shrank the eye buffer to 66% with no frame
  // rate gained, because the frames were late on the CPU side, so it is off again: resolution stays at full.)

  P.beforeSession = () => { try { renderer.xr.setFramebufferScaleFactor(P.vs ? 1 : P.device === 'quest2' ? 0.8 : 0.88); } catch (e) { } };
  P.onSession = s => {
    // fixed foveated rendering: three.js only hands its foveation setting to a layer that already exists, and the layer is made
    // when the session starts, so it has to be set again now (OVR Metrics showed FOV 0 until this)
    try { renderer.xr.setFoveation(1); } catch (e) { }
    P.level = 0; P.scale = 1; P.winT = 0; P.drops = 0; P.frames = 0; P.clean = 0; P.cool = 5;   // the first seconds in VR are loading hitches, not a slow scene
    try { const rates = s.supportedFrameRates ? [...s.supportedFrameRates] : []; if (s.updateTargetFrameRate && rates.includes(72)) s.updateTargetFrameRate(72).catch(() => { }); } catch (e) { }
  };
  P.set = lv => { lv = Math.max(0, Math.min(SCALES.length - 1, lv)); if (lv === P.level) return; P.level = lv; P.scale = SCALES[lv]; P.log.push([Math.round(performance.now() / 1000), lv]); if (P.log.length > 20) P.log.shift(); console.info('[perf] resolution ' + Math.round(P.scale * 100) + '%'); };
  // dt: seconds since the last frame, unclamped. presenting: only judge frames drawn in the headset.
  P.tick = (dt, presenting) => {
    if (!presenting || !(dt > 0) || dt > 0.5) return;   // a long gap is a pause (menu, loading), not a slow frame
    const hz = renderer.xr.getSession && renderer.xr.getSession() && renderer.xr.getSession().frameRate || 72; P.hz = hz;
    P.frames++; if (dt > 1.5 / hz) P.drops++; P.winT += dt; if (P.cool > 0) P.cool -= dt;
    if (P.winT < 1) return;
    const bad = P.drops >= Math.max(3, P.frames * 0.05), clean = P.drops === 0;
    if (P.cool <= 0 && bad) { P.set(P.level + 1); P.cool = 2; P.clean = 0; }
    else if (clean) { if (++P.clean >= 8 && P.cool <= 0) { P.set(P.level - 1); P.clean = 0; P.cool = 2; } }
    else P.clean = 0;
    P.winT = 0; P.drops = 0; P.frames = 0;
  };
  // CPU side of each frame, averaged: game update, handing the scene to the GPU (draw calls), and the AI tick (solo host)
  P.cpu = { up: 0, draw: 0, calls: 0, sim: 0, peak: 0 };
  const ease = (a, b) => a + (b - a) * 0.05;
  P.cpuNote = (up, draw, calls) => { const c = P.cpu; c.up = ease(c.up, up); c.draw = ease(c.draw, draw); c.calls = ease(c.calls, calls); c.peak = Math.max(c.peak * 0.995, up + draw); };
  P.simNote = ms => { P.cpu.sim = ease(P.cpu.sim, ms); };
  P.report = () => { const c = P.cpu, f = v => v.toFixed(1); return (P.hooked ? 'res ' + Math.round(P.scale * 100) + '%   ' : '') + 'cpu ' + f(c.up) + '+' + f(c.draw) + ' ms (' + Math.round(c.calls) + ' draws)   ai ' + f(c.sim) + ' ms'; };
  return P;
}
