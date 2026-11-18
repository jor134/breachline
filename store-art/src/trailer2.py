# Trailer v2: picture only from the headset captures, the theme music underneath (cut on its 1.2 s bar grid).
# Music: track 14 s on, so the drop at 26.16 s lands at 12.16 s; the quieter stretch (track 52-62) carries the editor.
import subprocess, sys
U = '/mnt/user-data/uploads/'
V = {1: U + 'com_oculus_browser-20261117-234609-0.mp4', 2: U + 'com_oculus_browser-20261117-235049-0.mp4', 3: U + 'com_oculus_browser-20261117-235412-0.mp4'}
MUSIC, M0 = U + 'a7a53981-youcanthide2.mp3', 14.0
EDL = [  # (video, start, length)
  (2, 37.0, 4.8), (1, 13.0, 3.6), (2, 9.0, 3.76),             # arrival, rain, casino, stacked on the door -> drop
  (2, 5.0, 2.4), (2, 60.6, 3.6), (2, 66.0, 2.4),              # wheel: kick / breach, flashbang, entry
  (2, 134.4, 2.4), (2, 138.6, 2.4), (2, 153.0, 2.4),          # wheel on a locked door, officer moves, suspect gives up
  (2, 141.4, 2.4), (1, 46.6, 2.4), (1, 18.0, 3.6),            # hostage, squad wheel in the casino, casino floor
  (2, 148.4, 2.4), (2, 156.0, 3.6),                           # cuffs, night vision
  (3, 21.0, 2.4), (3, 60.0, 2.4), (3, 129.0, 2.4), (3, 180.0, 2.4), (3, 201.0, 2.4),   # map editor
  (1, 74.4, 2.4),                                             # casino wide
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
