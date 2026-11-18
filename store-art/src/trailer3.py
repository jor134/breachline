# Trailer v2: picture only from the headset captures, the theme music underneath (cut on its 1.2 s bar grid).
# Music: track 14 s on, so the drop at 26.16 s lands at 12.16 s; the quieter stretch (track 52-62) carries the editor.
import subprocess, sys
U = '/mnt/user-data/uploads/'
V = {'N': U + 'com_jordanbreccia_youcanthide-20261118-170551-0.mp4', 1: U + 'com_oculus_browser-20261117-234609-0.mp4', 2: U + 'com_oculus_browser-20261117-235049-0.mp4', 3: U + 'com_oculus_browser-20261117-235412-0.mp4'}
MUSIC, M0 = U + 'a7a53981-youcanthide2.mp3', 14.0
EDL = [  # (video, start, length): N = the 18 Nov capture (casino, airport, Grand Prix)
  (2, 37.4, 2.4), ('N', 280.0, 2.4), ('N', 286.5, 2.4), ('N', 305.6, 4.96),   # the mansion front in the rain, a few seconds of helicopter, over the roof edge -> drop
  ('N', 343.0, 3.6), ('N', 348.0, 3.6), ('N', 311.4, 1.4), ('N', 326.6, 3.4),   # down the tower on the rope, through the glass, squad inside
  (2, 5.0, 2.4), (2, 60.6, 3.6),                              # squad wheel: kick / breach, flashbang
  ('N', 66.6, 2.4), ('N', 76.6, 3.6), ('N', 20.0, 2.4),       # Grand Prix: out on the track, cars flat out past you, a garage arrest
  (3, 21.0, 2.4), (3, 129.0, 2.4), (3, 201.0, 2.4),           # map editor (the music's quiet stretch)
  ('N', 246.0, 1.2), ('N', 253.8, 2.4), ('N', 181.0, 2.4), ('N', 84.0, 2.4),   # airport: up to the jet, a surrender; the bomb tool wheel
  ('N', 376.0, 2.4), ('N', 382.0, 2.4),                       # casino floor
]
END = 4.5
inputs, fc = [], []
for k, (v, a, d) in enumerate(EDL):
    inputs += ['-ss', str(a), '-t', str(d), '-i', V[v]]
    fc.append(f'[{k}:v]fps=30,scale=1920:1080,setsar=1,eq=gamma=1.12:contrast=1.04:saturation=1.05,format=yuv420p,fade=t=in:st=0:d=0.12,fade=t=out:st={d-0.12:.2f}:d=0.12,setpts=PTS-STARTPTS[v{k}]')
k = len(EDL); inputs += ['-loop', '1', '-t', str(END), '-i', '/tmp/tr2/endcard.png']
fc.append(f'[{k}:v]fps=30,scale=1920:1080,setsar=1,format=yuv420p,fade=t=in:st=0:d=0.6[v{k}]')
fc.append(''.join(f'[v{i}]' for i in range(k + 1)) + f'concat=n={k + 1}:v=1:a=0[vv]')
total = sum(d for _, _, d in EDL) + END
inputs += ['-ss', str(M0), '-t', str(total), '-i', MUSIC]
fc.append(f'[{k + 1}:a]aresample=48000,aformat=channel_layouts=stereo,afade=t=in:st=0:d=1.5,afade=t=out:st={total - 2.5:.2f}:d=2.5,loudnorm=I=-16:TP=-1.5:LRA=11[aa]')
out = sys.argv[1] if len(sys.argv) > 1 else 'out/trailer_1920x1080.mp4'
subprocess.run(['ffmpeg', '-v', 'error', '-y'] + inputs + ['-filter_complex', ';'.join(fc), '-map', '[vv]', '-map', '[aa]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-t', str(total), out], check=True)
print('total', total)
