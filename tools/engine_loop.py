# The race cars' engine: "grandprix" (freesound_community, Pixabay) cut into a seamless loop for js/audio.js engineVoice().
# A 16 s stretch is cross-faded end into start; the file carries PAD seconds of the loop's own end before it and of its start after
# it, so the game can loop between PAD and PAD + loop length without a click, whatever silence the MP3 encoder adds.
# usage: python3 tools/engine_loop.py in.mp3 public/sfx/engine_f1.mp3
import sys, subprocess, numpy as np
src, dst = sys.argv[1], sys.argv[2]; SR = 24000; T0, T1, XF, PAD = 2.0, 18.0, 0.6, 0.25
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
a = np.frombuffer(raw, np.float32).astype(np.float64)
seg = a[int(T0 * SR):int(T1 * SR) + int(XF * SR)]; x = int(XF * SR); n = len(seg) - x
ramp = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, x)); loop = seg[:n].copy(); loop[:x] = seg[:x] * ramp + seg[n:] * (1 - ramp)   # the tail fades into the head
loop *= 0.5 / np.sqrt((loop ** 2).mean()) * 0.25   # about -18 dBFS RMS, room for the mix
p = int(PAD * SR); out = np.concatenate([loop[-p:], loop, loop[:p]]).astype(np.float32)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '96k', dst], input=out.tobytes(), check=True)
print(f'loop {n / SR:.3f} s, pad {PAD} s, peak {np.abs(out).max():.2f} ->', dst)
