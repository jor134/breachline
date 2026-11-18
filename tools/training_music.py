# Training-room music for You Can't Hide: an original, procedurally synthesised loop (no samples), 110 BPM in D minor.
# Dark half-time groove: gliding 808 sub bass, punchy kick, clap on beat 3, sparse hats, a detuned saw pad and a plucked arp,
# through a simple reverb. Rendered three times over and the middle cut, so it loops seamlessly (reverb tails wrap round).
# Usage: python3 tools/training_music.py public/sfx/music_training.mp3
import sys, subprocess, numpy as np
from scipy.signal import fftconvolve, butter, sosfilt
SR = 44100; BPM = 110; BEAT = 60 / BPM; BAR = 4 * BEAT; BARS = 24; LOOP = BARS * BAR
rng = np.random.default_rng(7)
def midi(n): return 440 * 2 ** ((n - 69) / 12)
def env(n, a, d, s=0.0, r=None):
    t = np.arange(n) / SR; e = np.minimum(1, t / max(a, 1e-4)) * (s + (1 - s) * np.exp(-t / d)); return e
def lp(x, fc, order=2): return sosfilt(butter(order, fc / (SR / 2), 'low', output='sos'), x)
def hp(x, fc, order=2): return sosfilt(butter(order, fc / (SR / 2), 'high', output='sos'), x)
def bp(x, lo, hi): return sosfilt(butter(2, [lo / (SR / 2), hi / (SR / 2)], 'band', output='sos'), x)
N = int(LOOP * 3 * SR) + SR * 4; L = np.zeros(N); R = np.zeros(N)
def add(sig, t, pan=0.0, g=1.0):
    i = int(t * SR); sig = sig[: max(0, N - i)]; L[i:i + len(sig)] += sig * g * np.cos((pan + 1) * np.pi / 4) * 1.414; R[i:i + len(sig)] += sig * g * np.sin((pan + 1) * np.pi / 4) * 1.414
# chords (2 bars each): Dm, F, C, Bb   -- roots for the bass, voicings for the pad, tones for the arp
PROG = [(38, [62, 65, 69, 74]), (41, [60, 65, 69, 72]), (36, [60, 64, 67, 72]), (34, [62, 65, 70, 74])]
def kick():
    n = int(0.45 * SR); t = np.arange(n) / SR; f = 45 + 110 * np.exp(-t / 0.03); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.tanh(2.2 * np.sin(ph) * np.exp(-t / 0.16)) + 0.25 * hp(rng.standard_normal(n), 3000) * np.exp(-t / 0.004)
def clap():
    n = int(0.35 * SR); t = np.arange(n) / SR; nz = bp(rng.standard_normal(n), 900, 4500); e = np.zeros(n)
    for d in (0, 0.011, 0.022): e += np.exp(-np.maximum(0, t - d) / 0.012) * (t >= d)
    return nz * (e * 0.6 + np.exp(-t / 0.09) * 0.5)
def hat(open_=False):
    n = int((0.25 if open_ else 0.06) * SR); t = np.arange(n) / SR; return hp(rng.standard_normal(n), 7000) * np.exp(-t / (0.08 if open_ else 0.015))
def b808(note, dur, glide_to=None):
    n = int(dur * SR); t = np.arange(n) / SR; f0 = midi(note); f = f0 * (1 + 0.6 * np.exp(-t / 0.02))
    if glide_to is not None: k = np.clip((t - dur * 0.6) / (dur * 0.35), 0, 1); f = f * (midi(glide_to) / f0) ** (k * k * (3 - 2 * k))
    ph = 2 * np.pi * np.cumsum(f) / SR; s = np.sin(ph) + 0.15 * np.sin(2 * ph)
    return np.tanh(1.8 * s) * env(n, 0.004, 1.6, 0.35) * np.minimum(1, (n - np.arange(n)) / (0.03 * SR))
def saw(f, n, det=0.0):
    ph = (np.arange(n) * f * (2 ** (det / 1200)) / SR + rng.random()) % 1; return 2 * ph - 1
def pad(notes, dur):
    n = int(dur * SR); s = np.zeros(n)
    for m in notes:
        for d in (-9, 0, 8): s += saw(midi(m), n, d)
    s = lp(s / (len(notes) * 3), 1100); t = np.arange(n) / SR; e = np.minimum(1, t / 0.9) * np.minimum(1, (n - np.arange(n)) / (0.6 * SR)); return s * e
def pluck(note, dur=0.32):
    n = int(dur * SR); t = np.arange(n) / SR; s = saw(midi(note), n, 0) * 0.6 + saw(midi(note), n, 7) * 0.4
    cut = 600 + 3500 * np.exp(-t / 0.05); out = np.zeros(n); y = 0.0; a = 1 - np.exp(-2 * np.pi * cut / SR)
    for i in range(n): y += a[i] * (s[i] - y); out[i] = y
    return out * np.exp(-t / 0.13)
def lead(note, dur):
    n = int(dur * SR); t = np.arange(n) / SR; f = midi(note) * (1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / 0.4)); ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.18 * np.sin(3 * ph) + 0.08 * saw(midi(note), n, 4)
    return lp(s, 2600) * np.minimum(1, t / 0.03) * np.exp(-t / 1.6) * np.minimum(1, (n - np.arange(n)) / (0.08 * SR))
# an 8-bar melody in D minor, (bar, beat, note, beats long); played in the full sections, an octave up for the last 8 bars' second half
MEL = [(0, 0, 69, 1.5), (0, 1.5, 67, 0.5), (0, 2, 65, 2), (1, 0, 64, 1), (1, 1, 65, 1), (1, 2, 62, 2),
       (2, 0, 65, 1.5), (2, 1.5, 67, 0.5), (2, 2, 69, 1.5), (2, 3.5, 72, 0.5), (3, 0, 71 - 1, 1), (3, 1, 69, 3),
       (4, 0, 67, 1.5), (4, 1.5, 65, 0.5), (4, 2, 64, 2), (5, 0, 60, 1), (5, 1, 64, 1), (5, 2, 67, 2),
       (6, 0, 70, 1.5), (6, 1.5, 69, 0.5), (6, 2, 67, 1), (6, 3, 65, 1), (7, 0, 62, 4)]
K, C, H, HO = kick(), clap(), hat(), hat(True)
ARP = [0, 2, 1, 3, 2, 1, 3, 2]
for rep in range(3):
    base = rep * LOOP
    for bar in range(BARS):
        t0 = base + bar * BAR; root, voic = PROG[(bar // 2) % 4]; sec = bar // 8   # 0: intro (no arp), 1: full, 2: full + rolls
        if bar % 2 == 0: add(pad(voic, 2 * BAR + 0.8), t0, 0, 0.8)
        # kick: 1, the "and" of 2 sometimes, 4-and on the 2nd bar
        for bt in ([0, 2.5] if bar % 2 == 0 else [0, 1.75, 3.5]): add(K, t0 + bt * BEAT, 0, 0.62)
        add(C, t0 + 2 * BEAT, 0.05, 0.55 if sec else 0.35)
        if sec >= 1 or bar % 4 >= 2:
            for e8 in range(8): add(HO if e8 == 7 and bar % 4 == 3 else H, t0 + e8 * BEAT / 2, 0.35, 0.16 if e8 % 2 else 0.22)
            if sec == 2 and bar % 2 == 1:
                for r in range(6): add(H, t0 + 3 * BEAT + r * BEAT / 6, 0.35, 0.12 + 0.02 * r)
        # 808: root on 1, a lower/upper hit on the 2nd bar, glide into the next chord at the end of each 2-bar chord
        if bar % 2 == 0: add(b808(root, 1.6 * BEAT), t0, 0, 0.45); add(b808(root, 0.9 * BEAT), t0 + 2.5 * BEAT, 0, 0.4)
        else:
            nxt = PROG[((bar // 2) + 1) % 4][0]; add(b808(root + 12 if sec == 2 else root, 1.2 * BEAT), t0 + 0.0 * BEAT, 0, 0.38)
            add(b808(root, 1.9 * BEAT, glide_to=nxt), t0 + 1.75 * BEAT, 0, 0.42)
        if sec >= 1:
            for (mb, bt, nt, ln) in MEL:
                if mb == bar % 8: add(lead(nt + (12 if sec == 2 and bar % 8 >= 4 else 0), ln * BEAT + 0.15), t0 + bt * BEAT, 0.15, 0.3)
            tones = [v + 12 for v in voic] if sec == 2 and bar % 4 >= 2 else voic
            for s16 in range(16):
                if (s16 * 5 + bar) % 7 == 3: continue   # gaps keep it from feeling mechanical
                add(pluck(tones[ARP[s16 % 8]]), t0 + s16 * BEAT / 4, -0.4 + 0.8 * ((s16 % 4) / 3), 0.34)
# reverb: exponentially decaying stereo noise impulse
irn = int(2.2 * SR); te = np.arange(irn) / SR; irL = rng.standard_normal(irn) * np.exp(-te / 0.55); irR = rng.standard_normal(irn) * np.exp(-te / 0.55)
irL, irR = lp(irL, 5000) / 60, lp(irR, 5000) / 60
wetL = fftconvolve(hp(L, 200), irL)[:N]; wetR = fftconvolve(hp(R, 200), irR)[:N]
oL, oR = L + 0.35 * wetL, R + 0.35 * wetR
i0, i1 = int(LOOP * SR), int(2 * LOOP * SR); out = np.stack([oL[i0:i1], oR[i0:i1]], 1)
out = np.tanh(out / np.max(np.abs(out)) * 1.1) ; out = out / np.max(np.abs(out)) * 0.89
pcm = (out * 32767).astype(np.int16).tobytes()
dst = sys.argv[1] if len(sys.argv) > 1 else 'music_training.mp3'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '160k', dst], input=pcm, check=True)
print('wrote', dst, round(LOOP, 2), 's loop')
