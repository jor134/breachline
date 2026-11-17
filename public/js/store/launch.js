// Store build start-up: take over the VR session that js/store/boot.js opened (or open one from the ENTER VR tap when the
// automatic request was refused), then show the in-VR start menu. Nothing connects until the player picks SOLO, ONLINE
// or TUTORIAL there (js/store/ui.js). When the session ends, the 2D page offers ENTER VR again.
export function storeLaunch({ renderer, begin, storeUI, initAudio, status, $ }) {
  const B = window.__boot; if (!B || !B.store) return false;
  let busy = false;
  async function takeOver() {
    if (busy || renderer.xr.isPresenting) return; const s = B.take(); if (!s) return; busy = true;
    try {
      try { initAudio(); } catch (e) { }
      await renderer.xr.setSession(s); begin('vr'); storeUI.showStart();
      s.addEventListener('end', () => { location.reload(); });   // a clean start: the 2D page asks for VR again
    } catch (e) { status('Could not start VR: ' + (e && e.message || e)); } finally { busy = false; }
  }
  B.on(what => {
    if (what === 'session') takeOver();
    else if (what === 'refused') status('Put on your headset and press ENTER VR.');
  });
  if (B.failed && !B.session) status('Put on your headset and press ENTER VR.');
  $('vr').onclick = () => { initAudio(); (B.session ? Promise.resolve() : B.start()).then(takeOver, e => status('Could not start VR: ' + (e && e.message || e))); };
  if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then(ok => { $('vr').disabled = !ok; if (!ok) $('vrnote').textContent = 'You Can\'t Hide needs a Meta Quest headset.'; }).catch(() => { });
  return true;
}
