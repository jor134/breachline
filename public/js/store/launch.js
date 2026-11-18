// Store build start-up: take over the VR session that js/store/boot.js opened (or open one from the ENTER VR tap when the
// automatic request was refused), then show the in-VR start menu. Nothing connects until the player picks SOLO, ONLINE
// or TUTORIAL there (js/store/ui.js). When the session ends, the 2D page offers ENTER VR again.
export function storeLaunch({ renderer, begin, resume, storeUI, voice, perf, initAudio, status, $ }) {
  const B = window.__boot; if (!B || !B.store) return false;
  let busy = false;
  async function takeOver() {
    if (busy || renderer.xr.isPresenting) return; const s = B.take(); if (!s) return; busy = true;
    try {
      try { initAudio(); } catch (e) { }
      perf.beforeSession(); await renderer.xr.setSession(s); perf.onSession(s);
      if (storeUI.started()) resume(); else { begin('vr'); storeUI.showStart(); }   // back from a system prompt: carry on in the same room
      // VR can end without the player quitting: the headset leaves VR to show a permission prompt (the microphone). Keep the room,
      // the mission and the connection; the 2D page offers ENTER VR to come straight back.
      s.addEventListener('end', () => { storeUI.left(); $('ui').style.display = 'flex'; status(storeUI.started() ? (storeUI.room() ? 'Press ENTER VR to go back to room ' + storeUI.room() + '.' : 'Press ENTER VR to carry on.') : 'Press ENTER VR to play.'); });
    } catch (e) { status('Could not start VR: ' + (e && e.message || e)); } finally { busy = false; }
  }
  B.on(what => {
    if (what === 'session') takeOver();
    else if (what === 'refused') status('Put on your headset and press ENTER VR.');
  });
  if (B.failed && !B.session) status('Put on your headset and press ENTER VR.');
  // In the Quest Browser a site's microphone prompt is drawn as a flat window, which takes you out of VR. So the first time, ask
  // here on the flat page before going in; the browser remembers the answer and every later visit goes straight into VR.
  $('vr').onclick = async () => {
    if (!B.session && voice.on && !voice.mic && !voice.asked && await voice.permission() === 'prompt') {
      voice.asked = true; status('Allow the microphone for squad voice chat...'); const ok = await voice.startMic();
      status(ok ? 'Microphone ready. Press ENTER VR.' : (voice.err || 'No microphone.') + ' Press ENTER VR to play without talking.'); return;
    }
    initAudio(); (B.session ? Promise.resolve() : B.start()).then(takeOver, e => status('Could not start VR: ' + (e && e.message || e))); };
  if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then(ok => { $('vr').disabled = !ok; if (!ok) $('vrnote').textContent = 'You Can\'t Hide needs a Meta Quest headset.'; }).catch(() => { });
  return true;
}
