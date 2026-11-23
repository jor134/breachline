# Hostage voices (quest-store, 23 Nov): cut, level and convert the hostage recordings into public/sfx/vo_c_*.mp3, a man's and a
# woman's version of each. The recordings are one voice each, so the other version is the same take pitch-shifted (rubberband,
# formants shifted with it, so it reads as another person rather than the same one sped up): men's takes up 4.5 semitones for the
# women, the woman's "help" down 4 for the men. Crying has a real take for each: the man's and the woman's sobbing.
#   python3 tools/build_hostage_vo.py <crying-male.mp3> <male-sigh.mp3> <male-death.mp3> <help-help.mp3> <woman-sobbing.mp3>
import sys, subprocess, os
CRY, SIGH, DIE, HELP, SOB = sys.argv[1:6]
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sfx')
UP, DOWN = 2 ** (4.5 / 12), 2 ** (-4 / 12)
# name, source, [start, end] in seconds (None: all of it), the take's own voice ('m' or 'f'), which versions to make
CUTS = [('cry', CRY, [0.6, 2.2], 'm', 'm'), ('cry', CRY, [2.2, 4.3], 'm', 'm'), ('cry', CRY, [4.3, 7.0], 'm', 'm'),
        ('cry', SOB, [0.0, 3.6], 'f', 'f'), ('cry', SOB, [4.6, 9.6], 'f', 'f'), ('cry', SOB, [9.6, 12.4], 'f', 'f'), ('cry', SOB, [12.4, 17.0], 'f', 'f'),
        ('sigh', SIGH, None, 'm', 'mf'), ('die', DIE, None, 'm', 'mf'), ('help', HELP, None, 'f', 'mf')]   # name, source, cut, the take's voice, who gets it
made = {}
for name, src, cut, own, whom in CUTS:
    for who in whom:
        n = made.setdefault((name, who), 0) + 1; made[(name, who)] = n
        dst = os.path.join(OUT, f'vo_c_{name}_{who}_{n}.mp3')
        af = [] if cut is None else [f'atrim={cut[0]}:{cut[1]}', 'asetpts=PTS-STARTPTS']
        if who != own: af.append(f'rubberband=pitch={UP if own == "m" else DOWN}:formant=shifted')
        af += ['silenceremove=start_periods=1:start_threshold=-45dB', 'areverse', 'silenceremove=start_periods=1:start_threshold=-45dB', 'areverse',
               'afade=t=in:d=0.02', 'loudnorm=I=-17:TP=-2:LRA=9', 'aresample=44100']
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-ac', '1', '-af', ','.join(af), '-c:a', 'libmp3lame', '-q:a', '5', dst], check=True)
        print(dst)
