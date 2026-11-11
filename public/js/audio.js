// Procedural audio (no samples). Positional via PannerNode.
let ctx = null, noiseBuf = null, master = null;
export function initAudio() {
  if (ctx) { ctx.resume?.(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function setListener(p, f) {
  if (!ctx) return; const l = ctx.listener;
  if (l.positionX) { l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z; l.forwardX.value = f.x; l.forwardY.value = f.y; l.forwardZ.value = f.z; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
  else { l.setPosition(p.x, p.y, p.z); l.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
}
function out(pos) {
  if (!pos) return master; const p = ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 2; p.rolloffFactor = 1.2;
  if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
  p.connect(master); return p;
}
function burst(pos, dur, freq, gain, type = 'lowpass', q = 0.7) {
  if (!ctx) return; const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.6 + Math.random() * 0.8;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(out(pos)); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
function tone(pos, f0, f1, dur, gain, type = 'sine') {
  if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(out(pos)); o.start(t); o.stop(t + dur + 0.02);
}
export const sfx = {
  shot(pos, kind) { burst(pos, kind === 'pistol' ? 0.16 : 0.22, kind === 'pistol' ? 3200 : 2200, 1.6); tone(pos, 160, 40, 0.14, 1.2); burst(pos, 0.5, 600, 0.25); },
  click() { burst(null, 0.03, 4000, 0.4, 'highpass'); },
  magOut() { burst(null, 0.06, 1800, 0.5, 'bandpass', 3); tone(null, 300, 180, 0.05, 0.2, 'square'); },
  magIn() { burst(null, 0.05, 2400, 0.6, 'bandpass', 3); tone(null, 220, 320, 0.06, 0.25, 'square'); },
  rack() { burst(null, 0.07, 3000, 0.6, 'bandpass', 2); setTimeout(() => burst(null, 0.06, 2200, 0.7, 'bandpass', 2), 90); },
  lock() { tone(null, 900, 500, 0.05, 0.3, 'square'); },
  door(pos) { tone(pos, 140, 70, 0.25, 0.5, 'triangle'); burst(pos, 0.2, 500, 0.3); },
  cuff(pos) { for (let i = 0; i < 4; i++) setTimeout(() => burst(pos, 0.03, 5000, 0.5, 'highpass'), i * 60); },
  beep(pos, f = 1200) { tone(pos, f, f, 0.08, 0.25, 'square'); },
  cut(pos, ok) { burst(pos, 0.04, 6000, 0.5, 'highpass'); tone(pos, ok ? 900 : 220, ok ? 1400 : 110, ok ? 0.15 : 0.5, 0.35, 'square'); },
  hurt() { tone(null, 110, 50, 0.3, 0.9, 'sawtooth'); burst(null, 0.2, 900, 0.5); },
  impact(pos) { burst(pos, 0.05, 3500, 0.35, 'bandpass', 1.5); },
  boom() { burst(null, 2.5, 300, 2.5); tone(null, 80, 20, 2, 2); },
  ok() { tone(null, 660, 660, 0.12, 0.3, 'triangle'); setTimeout(() => tone(null, 990, 990, 0.2, 0.3, 'triangle'), 130); },
  say(text, pitch = 1) { try { if (window.speechSynthesis) { const u = new SpeechSynthesisUtterance(text); u.rate = 1.25; u.pitch = pitch; u.volume = 0.9; speechSynthesis.speak(u); } } catch { } },
};
