# Trailer v5 (storyboard store-art/trailer_storyboard.png): 60 s map montage on the theme music's 1.2 s bar grid.
# Headset footage plus three in-engine casino renders (helicopter over the tower, the look down the glass, officers on the ropes),
# rendered frame by frame by /tmp/cine/run.py into /tmp/cine/frames. Cards from cards4.py.
import subprocess, sys
U = '/mnt/user-data/uploads/'
V = {'N': U + 'com_jordanbreccia_youcanthide-20261118-170551-0.mp4', 2: U + 'com_oculus_browser-20261117-235049-0.mp4', 3: U + 'com_oculus_browser-20261117-235412-0.mp4'}
MUSIC, M0 = U + 'a7a53981-youcanthide2.mp3', 14.0
R = '/tmp/cine/frames/'
EDL = [   # ('i', image, len) | ('r', render name, len) | (video, start, len)
  ('i', '/tmp/tr4/intro.png', 3.6),
  (2, 37.4, 2.4), (2, 5.0, 2.4), (2, 60.6, 3.6),                                  # mansion: front in the rain, at the door, flashbang
  ('r', 'r1', 3.6), ('r', 'r2', 2.4), ('N', 343.0, 2.4), ('r', 'r3', 2.4), ('N', 311.4, 1.2), ('N', 376.0, 1.2),   # casino (drop at 12.16 s)
  ('N', 246.0, 3.6), ('N', 181.0, 2.4), ('N', 66.6, 3.6),                          # airport: to the jet, a surrender, gearing up
  ('N', 76.6, 3.6), ('N', 20.0, 2.4), ('N', 84.0, 3.6),                            # Grand Prix: cars flat out, garage arrest, tool wheel
  (3, 21.0, 2.4), (3, 129.0, 2.4), (3, 201.0, 2.4), (3, 180.0, 2.4),               # editor
  ('i', '/tmp/tr4/end.png', 6.0),
]
OVER = [('/tmp/tr4/c_raid.png', 25.4, 3.2), ('/tmp/tr4/c_edit.png', 44.6, 4.4)]   # lower-third cards: (image, at, for)
inputs, fc = [], []
for k, (v, a, d) in enumerate(EDL):
    if v == 'i': inputs += ['-loop', '1', '-t', str(d), '-i', a]; fc.append(f'[{k}:v]fps=30,scale=1920:1080,setsar=1,format=yuv420p,fade=t=in:st=0:d=0.5,fade=t=out:st={d-0.4:.2f}:d=0.4,setpts=PTS-STARTPTS[v{k}]'); continue
    if v == 'r': inputs += ['-framerate', '30', '-i', R + a + '_%04d.jpg']; fc.append(f'[{k}:v]fps=30,scale=1920:1080,setsar=1,format=yuv420p,trim=duration={d},fade=t=in:st=0:d=0.12,fade=t=out:st={d-0.12:.2f}:d=0.12,setpts=PTS-STARTPTS[v{k}]'); continue
    inputs += ['-ss', str(a), '-t', str(d), '-i', V[v]]
    fc.append(f'[{k}:v]fps=30,scale=1920:1080,setsar=1,eq=gamma=1.12:contrast=1.04:saturation=1.05,format=yuv420p,fade=t=in:st=0:d=0.12,fade=t=out:st={d-0.12:.2f}:d=0.12,setpts=PTS-STARTPTS[v{k}]')
n = len(EDL); fc.append(''.join(f'[v{i}]' for i in range(n)) + f'concat=n={n}:v=1:a=0[c0]')
for j, (img, at, ln) in enumerate(OVER):
    inputs += ['-loop', '1', '-t', str(ln), '-i', img]; k = n + j
    fc.append(f'[{k}:v]format=rgba,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st={ln-0.35:.2f}:d=0.35:alpha=1,setpts=PTS-STARTPTS+{at}/TB[o{j}]')
    fc.append(f'[c{j}][o{j}]overlay=0:0:eof_action=pass:format=auto[c{j+1}]')
total = sum(d for _, _, d in EDL)
inputs += ['-ss', str(M0), '-t', str(total), '-i', MUSIC]; ka = n + len(OVER)
fc.append(f'[c{len(OVER)}]format=yuv420p[vv]')
fc.append(f'[{ka}:a]aresample=48000,aformat=channel_layouts=stereo,afade=t=in:st=0:d=1.5,afade=t=out:st={total - 2.5:.2f}:d=2.5,loudnorm=I=-16:TP=-1.5:LRA=11[aa]')
out = sys.argv[1] if len(sys.argv) > 1 else 'out/trailer_1920x1080.mp4'
subprocess.run(['ffmpeg', '-v', 'error', '-y'] + inputs + ['-filter_complex', ';'.join(fc), '-map', '[vv]', '-map', '[aa]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-t', str(total), out], check=True)
print('total', total)
