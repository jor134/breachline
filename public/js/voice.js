// Voice chat between the people in a room (the same approach as Kerbside's hangouts): one WebRTC audio connection per pair,
// set up with "perfect negotiation" (either side may start; the higher id yields), signalled through the room's Durable Object
// ({ t: 'sig', to, data } out, { t: 'sig', from, data } back). Bots and solo play have no voice. STUN by default; with the
// TURN_KEY_ID / TURN_KEY_API_TOKEN secrets on the Worker, /api/ice hands out Cloudflare TURN servers too (strict networks).
export function createVoice(send) {
  const V = { on: localStorage.getItem('bl_voice') !== '0', mic: null, muted: false, err: '', pcs: new Map(), audio: new Map(), me: null, ice: null, needTap: false, micLevel: () => 0 };
  let actx = null;
  const ctx = () => { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; if (!actx) actx = new C(); if (actx.state === 'suspended') actx.resume().catch(() => { }); return actx; };
  function meter(stream) {
    const c = ctx(); if (!c) return () => 0;
    try { const src = c.createMediaStreamSource(stream), an = c.createAnalyser(); an.fftSize = 512; src.connect(an); const buf = new Uint8Array(an.fftSize); let lvl = 0;
      return () => { an.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; } lvl = Math.max(Math.sqrt(s / buf.length) * 5, lvl * 0.85); return Math.min(1, lvl); }; } catch (e) { return () => 0; }
  }
  // the microphone: asked for from a tap on the page (a headset cannot show the prompt once you are inside VR)
  V.permission = async () => { try { const p = await navigator.permissions.query({ name: 'microphone' }); return p.state; } catch (e) { return 'unknown'; } };
  V.startMic = async () => {
    if (V.mic || !V.on) return !!V.mic; V.err = '';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { V.err = 'This browser cannot use a microphone here.'; return false; }
    try { V.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }); V.mic.getAudioTracks().forEach(t => { t.enabled = !V.muted; }); V.micLevel = meter(V.mic);
      for (const id of [...V.pcs.keys()]) drop(id);   // connections made before the mic arrived are rebuilt with it on the next snapshot
      return true; }
    catch (e) { V.mic = null; V.err = e && e.name === 'NotAllowedError' ? 'Microphone blocked: you can still listen. Allow the mic in the browser\'s site settings to talk.' : 'No microphone found: you can still listen.'; return false; }
  };
  V.setOn = v => { V.on = v; localStorage.setItem('bl_voice', v ? '1' : '0'); if (!v) { V.stop(); } };
  V.setMuted = v => { V.muted = v; if (V.mic) V.mic.getAudioTracks().forEach(t => { t.enabled = !v; }); };
  V.getIce = async () => { if (V.ice) return V.ice; try { const r = await fetch('api/ice', { cache: 'no-store' }); V.ice = r.ok ? await r.json() : null; } catch (e) { V.ice = null; } if (!V.ice) V.ice = { iceServers: [{ urls: ['stun:stun.cloudflare.com:3478'] }] }; return V.ice; };
  V.unlock = () => { ctx(); for (const a of V.audio.values()) a.el.play().then(() => { V.needTap = false; }).catch(() => { V.needTap = true; }); };
  // keep one connection to every other person in the room
  V.sync = (me, ids, online) => {
    if (!online || !V.on) { if (V.pcs.size) V.stop(true); return; }
    V.me = me; const want = new Set(ids.filter(id => id !== me));
    for (const id of want) if (!V.pcs.has(id)) peer(id);
    for (const id of [...V.pcs.keys()]) if (!want.has(id)) drop(id);
  };
  function peer(id) {
    const pc = new RTCPeerConnection({ iceServers: (V.ice && V.ice.iceServers) || [{ urls: ['stun:stun.cloudflare.com:3478'] }] });
    const st = { pc, polite: V.me > id, making: false, ignore: false }; V.pcs.set(id, st);
    if (V.mic) V.mic.getTracks().forEach(t => pc.addTrack(t, V.mic)); else pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.onnegotiationneeded = async () => { try { st.making = true; await pc.setLocalDescription(); send({ t: 'sig', to: id, data: { desc: pc.localDescription } }); } catch (e) { } finally { st.making = false; } };
    pc.onicecandidate = e => { if (e.candidate) send({ t: 'sig', to: id, data: { cand: e.candidate } }); };
    pc.ontrack = e => attach(id, e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]));
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') try { pc.restartIce(); } catch (err) { } };
    return st;
  }
  V.signal = async (from, data) => {
    if (!V.on || !data) return; let st = V.pcs.get(from); if (!st) st = peer(from); const pc = st.pc;
    try {
      if (data.desc) { const collision = data.desc.type === 'offer' && (st.making || pc.signalingState !== 'stable'); st.ignore = !st.polite && collision; if (st.ignore) return;
        await pc.setRemoteDescription(data.desc); if (data.desc.type === 'offer') { await pc.setLocalDescription(); send({ t: 'sig', to: from, data: { desc: pc.localDescription } }); } }
      else if (data.cand) { try { await pc.addIceCandidate(data.cand); } catch (e) { if (!st.ignore) throw e; } }
    } catch (e) { /* one bad message must not break the room */ }
  };
  function attach(id, stream) {
    let a = V.audio.get(id);
    if (!a) { const el = document.createElement('audio'); el.autoplay = true; el.playsInline = true; el.setAttribute('playsinline', ''); el.style.display = 'none'; document.body.appendChild(el); a = { el, level: () => 0 }; V.audio.set(id, a); }
    if (a.el.srcObject !== stream) { a.el.srcObject = stream; a.level = meter(stream); a.el.play().then(() => { V.needTap = false; }).catch(() => { V.needTap = true; }); }
  }
  function drop(id) { const st = V.pcs.get(id); if (st) { try { st.pc.close(); } catch (e) { } V.pcs.delete(id); } const a = V.audio.get(id); if (a) { a.el.srcObject = null; a.el.remove(); V.audio.delete(id); } }
  V.stop = keepMic => { for (const id of [...V.pcs.keys()]) drop(id); if (!keepMic && V.mic) { V.mic.getTracks().forEach(t => t.stop()); V.mic = null; V.micLevel = () => 0; } };
  V.level = id => { const a = V.audio.get(id); return a ? a.level() : 0; };
  V.state = id => { const st = V.pcs.get(id); if (!st) return 'none'; const s = st.pc.connectionState || st.pc.iceConnectionState; return s === 'connected' || s === 'completed' ? 'ok' : s === 'failed' ? 'failed' : 'connecting'; };
  return V;
}
