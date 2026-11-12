// Audio: recorded sound effects (public/sfx, see CREDITS.md) played through head-related (HRTF) 3D panning, muffled when a wall is in
// the way, with a short room reverb indoors. Rain, thunder, smoke hiss, ear ringing and the night-vision whine are still synthesised:
// no free recordings of those were found in a repository.
let ctx = null, noiseBuf = null, master = null, dry = null, send = null, occluder = null, inside = false;
const L = { x: 0, y: 0, z: 0 };
export function initAudio() {
  if (ctx) { ctx.resume?.(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.18; comp.connect(ctx.destination);   // keeps close gunfire from clipping
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(comp); dry = master;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // room reverb: a generated impulse response (dense early reflections, ~1.1 s decay) fed by a send whose level follows indoors / outdoors
  const n = Math.floor(ctx.sampleRate * 1.3), ir = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const a = ir.getChannelData(c); for (let i = 0; i < n; i++) { const t = i / ctx.sampleRate; a[i] = (Math.random() * 2 - 1) * Math.exp(-t * 5.2) * (t < 0.012 ? t / 0.012 : 1); } }
  const conv = ctx.createConvolver(); conv.buffer = ir; const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 5200;
  send = ctx.createGain(); send.gain.value = 0.1; send.connect(conv); conv.connect(tone); tone.connect(master);
  loadSamples();
}
// occluded(x, y, z) -> true when a solid surface lies between the listener and that point
export function setOccluder(fn) { occluder = fn; }
export function setListener(p, f, isInside) {
  L.x = p.x; L.y = p.y; L.z = p.z; if (!ctx) return; const l = ctx.listener;
  if (l.positionX) { l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z; l.forwardX.value = f.x; l.forwardY.value = f.y; l.forwardZ.value = f.z; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
  else { l.setPosition(p.x, p.y, p.z); l.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
  if (isInside !== inside) { inside = isInside; send.gain.setTargetAtTime(inside ? 0.32 : 0.07, ctx.currentTime, 0.3); }
}
// Route a sound: pos null = in your own head (your gun, your hands); otherwise placed in 3D, muffled through walls, with reverb.
function out(pos, wet = 1) {
  if (!pos) { const g = ctx.createGain(); g.connect(dry); if (wet > 0) { const s = ctx.createGain(); s.gain.value = 0.5 * wet; g.connect(s); s.connect(send); } return g; }
  const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1.6; p.rolloffFactor = 1.1; p.maxDistance = 80;
  if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
  p.connect(dry); let head = p;
  if (occluder && occluder(pos.x, pos.y, pos.z)) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 650; const g = ctx.createGain(); g.gain.value = 0.55; f.connect(g); g.connect(p); head = f; }
  if (wet > 0) { const s = ctx.createGain(); s.gain.value = wet; p.connect(s); s.connect(send); }
  return head;
}
function burst(pos, dur, freq, gain, type = 'lowpass', q = 0.7) {
  if (!ctx) return; const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.6 + Math.random() * 0.8;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(out(pos)); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
function tone(pos, f0, f1, dur, gain, type = 'sine') {
  if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(out(pos, 0)); o.start(t); o.stop(t + dur + 0.02);
}
// ---- recorded sounds: sfx/manifest.json maps a name to one file or a list of variants ----
const samples = {};
async function loadSamples() {
  try {
    const man = await (await fetch('sfx/manifest.json')).json();
    await Promise.all(Object.entries(man).map(async ([name, files]) => {
      const list = [];
      for (const f of Array.isArray(files) ? files : [files]) { try { list.push(await new Promise((res, rej) => fetch('sfx/' + f).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b, res, rej)).catch(rej))); } catch { } }
      if (list.length) samples[name] = list;
    }));
  } catch { }
}
const lastVar = {};
function sample(name, pos, gain = 1, opt = {}) {
  const list = samples[name]; if (!list || !ctx) return false;
  let i = Math.floor(Math.random() * list.length); if (list.length > 1 && i === lastVar[name]) i = (i + 1) % list.length; lastVar[name] = i;   // never the same variant twice in a row
  const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = list[i]; s.playbackRate.value = (opt.rate || 1) * (0.97 + Math.random() * 0.06); g.gain.value = gain;
  s.connect(g); g.connect(out(pos, opt.wet ?? 1)); s.start(ctx.currentTime + (opt.delay || 0)); return true;
}
const dist = p => p ? Math.hypot(p.x - L.x, p.y - L.y, p.z - L.z) : 0;
// Continuous rain: one looping noise source; quieter and duller under a roof.
let amb = null;
export function setAmbience(rain, isInside) {
  if (!ctx) return;
  if (!amb) { const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; const g = ctx.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(master); src.start(); amb = { f, g }; }
  const t = ctx.currentTime; amb.g.gain.setTargetAtTime(rain * (isInside ? 0.1 : 0.34), t, 0.4); amb.f.frequency.setTargetAtTime(isInside ? 520 : 5200, t, 0.4);
}
const P = k => k === 'pistol' ? 'pistol_' : '';
export const sfx = {
  // weapons (Free Firearm Sound Library: AR-15 and Walther PPQ recordings)
  shot(pos, kind) {
    const far = kind !== 'pistol' && dist(pos) > 16 && samples.rifle_far;   // distant rifle fire: the recording made further from the gun
    if (sample(far ? 'rifle_far' : kind === 'pistol' ? 'pistol' : 'rifle', pos, pos ? (far ? 1.4 : 1.15) : 0.85, { wet: pos ? 1 : 0.8 })) return;
    burst(pos, 0.2, 2400, 1.6); tone(pos, 160, 40, 0.14, 1.2);
  },
  dry(kind) { sample(P(kind) + 'click', null, 0.9, { wet: 0 }) || burst(null, 0.03, 4000, 0.4, 'highpass'); },
  magOut(kind) { sample(P(kind) + 'magout', null, 1, { wet: 0.2 }) || burst(null, 0.06, 1800, 0.5, 'bandpass', 3); },
  magIn(kind) { sample(P(kind) + 'magin', null, 1, { wet: 0.2 }) || burst(null, 0.05, 2400, 0.6, 'bandpass', 3); },
  rack(kind) { sample(P(kind) + 'rack', null, 1, { wet: 0.2 }) || burst(null, 0.07, 3000, 0.6, 'bandpass', 2); },
  bolt(kind) { sample(P(kind) + 'bolt', null, 1, { wet: 0.2 }) || burst(null, 0.06, 2200, 0.7, 'bandpass', 2); },
  lock() { sample('lock', null, 0.8, { wet: 0 }) || tone(null, 900, 500, 0.05, 0.3, 'square'); },
  selector() { sample('selector', null, 1, { wet: 0 }) || burst(null, 0.02, 5000, 0.3, 'highpass'); },
  pickTick() { sample('selector', null, 0.45, { wet: 0, rate: 1.3 + Math.random() * 0.5 }); },
  // doors, locks, cuffs, wires (Kenney RPG Audio and Impact Sounds)
  door(pos, open) { sample(open ? 'door_open' : 'door_close', pos, 1.1) || tone(pos, 140, 70, 0.25, 0.5, 'triangle'); },
  rattle(pos) { sample('locked', pos, 1.2) || burst(pos, 0.04, 1500, 0.5, 'bandpass', 4); },
  unlock(pos) { sample('unlock', pos, 1.2) || burst(pos, 0.03, 3500, 0.5, 'highpass'); },
  kick(pos, ok) { if (!sample('kick', pos, 1.6)) tone(pos, 90, 35, 0.25, 1.6); if (ok) sample('door_open', pos, 1.3, { rate: 1.6, delay: 0.05 }); },
  cuff(pos) { sample('cuff', pos, 1.2) || burst(pos, 0.03, 5000, 0.5, 'highpass'); },
  cut(pos, ok) { sample('snip', pos, 1.1); if (ok) sample('ok', pos, 0.5, { delay: 0.15 }); else sample('error', pos, 0.8, { delay: 0.1 }) || tone(pos, 220, 110, 0.5, 0.35, 'square'); },
  impact(pos, glass) { sample(glass ? 'impact_glass' : 'impact', pos, 0.9) || burst(pos, 0.05, 3500, 0.35, 'bandpass', 1.5); },
  clink(pos) { sample('clink', pos, 1.1) || burst(pos, 0.05, 4000, 0.3, 'bandpass', 2); },
  step(pos, mat, gain) { sample('step_' + mat, pos, gain, { wet: 0.5 }); },
  hurt() { sample('hurt', null, 1.1, { wet: 0 }); tone(null, 110, 50, 0.3, 0.5, 'sawtooth'); },
  power(pos, on) { sample('power', pos, 1.3) || burst(pos, 0.08, 1200, 0.9); if (on) tone(null, 50, 110, 0.5, 0.25, 'sawtooth'); else tone(null, 110, 28, 1.3, 0.35, 'sawtooth'); },
  // explosives (Kenney Sci-Fi Sounds explosions, layered)
  boom(pos) { if (!sample('boom', pos, 2.2)) { burst(pos, 2.5, 300, 2.5); } tone(pos, 70, 22, 1.6, 1.4); },
  bang(pos) { sample('flashbang', pos, 2.4) || burst(pos, 0.5, 6000, 3.2); burst(pos, 0.12, 7000, 2.2, 'highpass'); tone(pos, 160, 40, 0.25, 1.6); },
  // interface (Kenney Interface Sounds)
  click() { sample('ui', null, 0.7, { wet: 0 }) || burst(null, 0.02, 4000, 0.3, 'highpass'); },
  beep(pos, f = 1200) { if (!sample(f <= 300 ? 'error' : 'ui', null, 0.8, { wet: 0 })) tone(pos, f, f, 0.08, 0.25, 'square'); },
  ok() { sample('ok', null, 0.8, { wet: 0 }) || tone(null, 660, 660, 0.12, 0.3, 'triangle'); },
  // still synthesised
  ring(k) { if (!ctx || k < 0.05) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 4100; g.gain.setValueAtTime(0.22 * Math.min(1, k * 1.5), t); g.gain.exponentialRampToValueAtTime(0.001, t + 1 + k * 4); o.connect(g); g.connect(master); o.start(t); o.stop(t + 1.2 + k * 4); },
  hiss(pos) { burst(pos, 3.5, 5000, 0.6, 'highpass'); },
  thunder() { burst(null, 3.2, 160, 2.2); tone(null, 70, 24, 2.6, 1.6); setTimeout(() => burst(null, 2.2, 110, 1.2), 500); },
  nvg(on) { tone(null, on ? 500 : 2600, on ? 2800 : 400, on ? 0.5 : 0.25, 0.12, 'sine'); burst(null, 0.03, 4000, 0.3, 'highpass'); },
  say(text, pitch = 1) { try { if (window.speechSynthesis) { const u = new SpeechSynthesisUtterance(text); u.rate = 1.25; u.pitch = pitch; u.volume = 0.9; speechSynthesis.speak(u); } } catch { } },
};

// A race-car engine: two detuned saws through a low-pass, panned in 3D. The caller moves it, sets its pitch (doppler
// included) and loudness every frame. Returns null until the audio is running.
export function engineVoice() {
  if (!ctx) return null;
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createPanner();
  o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.Q.value = 2; g.gain.value = 0;
  p.panningModel = 'equalpower'; p.distanceModel = 'linear'; p.refDistance = 1; p.maxDistance = 1e4; p.rolloffFactor = 0;   // loudness is set by hand
  o1.connect(f); o2.connect(f); f.connect(g); g.connect(p); p.connect(dry); o1.start(); o2.start();
  return {
    set(x, y, z, hz, gain, muffle) {
      const t = ctx.currentTime; if (p.positionX) { p.positionX.setTargetAtTime(x, t, 0.02); p.positionY.value = y; p.positionZ.setTargetAtTime(z, t, 0.02); } else p.setPosition(x, y, z);
      o1.frequency.setTargetAtTime(hz, t, 0.03); o2.frequency.setTargetAtTime(hz * 0.502, t, 0.03); f.frequency.setTargetAtTime(muffle ? 700 : 2600, t, 0.1); g.gain.setTargetAtTime(gain, t, 0.04);
    },
    stop() { try { o1.stop(); o2.stop(); g.disconnect(); p.disconnect(); } catch (e) { } },
  };
}
