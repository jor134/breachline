# Builds public/sfx/ from free sound libraries cloned from GitHub. Re-run after changing the table below.
#   FFL    = buddingmonkey/FreeFirearmsSFXLibrary   (Free Firearm Sound Library, CC0)
#   RPG    = Boyquotes/kenney-rpg-audio-for-godot   (Kenney RPG Audio, CC0)
#   IMPACT = Boyquotes/kenney-impact-sounds-for-godot (Kenney Impact Sounds, CC0)
#   SCIFI  = Boyquotes/kenney-sci-fi-sounds-for-godot (Kenney Sci-Fi Sounds, CC0)
#   UI     = Calinou/kenney-interface-sounds        (Kenney Interface Sounds, CC0)
# Each entry cuts one event (start, length in seconds; None = whole file), makes it mono 44.1 kHz,
# fades the tail, scales it to a target peak, and writes a 96 kbps MP3 (MP3 decodes on Quest, iPhone and desktop).
# Usage: python3 -I tools/build_sfx.py <folder holding the five clones> public/sfx
import sys, os, json, subprocess, re
src, dst = sys.argv[1], sys.argv[2]
FFL, RPG = 'FreeFirearmsSFXLibrary', 'kenney-rpg-audio-for-godot/addons/kenney rpg audio'
IMPACT, SCIFI, UI = 'kenney-impact-sounds-for-godot/addons/kenney impact sounds', 'kenney-sci-fi-sounds-for-godot/addons/kenney sci-fi sounds', 'kenney-interface-sounds/addons/kenney_interface_sounds'
AR, PPQ = FFL + '/Master Tracks/AR-15/', FFL + '/Master Tracks/Walther PPQ/'
# name: [(file, start, length, peak dB), ...]  several entries = random variants
T = {
  'rifle':        [(FFL + '/Prepared SFX/AR-15/D_32P.wav', 0.69, 1.25, -1), (FFL + '/Prepared SFX/AR-15/D_32P.wav', 5.63, 1.25, -1)],
  'rifle_far':    [(FFL + '/Prepared SFX/AR-15/D_24P.wav', 0.53, 1.9, -2)],
  'pistol':       [(FFL + '/Prepared SFX/Walther PPQ/X_39P.wav', 1.39, 1.1, -1), (FFL + '/Prepared SFX/Walther PPQ/X_39P.wav', 6.43, 1.1, -1)],
  'magout':       [(AR + 'D_5.wav', 1.18, 0.6, -4), (AR + 'D_3.wav', 1.43, 0.45, -4)],
  'magin':        [(AR + 'D_4.wav', 0.93, 0.55, -3)],
  'rack':         [(AR + 'D_14.wav', 0.49, 0.5, -3)],
  'bolt':         [(AR + 'D_13.wav', 0.33, 0.35, -3), (AR + 'D_13.wav', 1.18, 0.35, -3)],
  'click':        [(AR + 'D_16.wav', 0.36, 0.25, -6)],
  'selector':     [(AR + 'D_19.wav', 0.31, 0.16, -8), (AR + 'D_19.wav', 1.085, 0.16, -8)],
  'pistol_magout': [(PPQ + 'X_5.wav', 1.34, 0.4, -4), (PPQ + 'X_5.wav', 3.61, 0.4, -4)],
  'pistol_magin': [(PPQ + 'X_4.wav', 0.85, 0.35, -3), (PPQ + 'X_4.wav', 2.99, 0.35, -3)],
  'pistol_rack':  [(PPQ + 'X_8.wav', 0.83, 0.38, -3)],
  'pistol_bolt':  [(PPQ + 'X_17.wav', 1.14, 0.28, -3)],
  'pistol_click': [(PPQ + 'X_18.wav', 0.55, 0.22, -6)],
  'lock':         [(PPQ + 'X_14.wav', 0.74, 0.35, -6)],
  'door_open':    [(RPG + '/door_open_1.ogg', None, None, -4), (RPG + '/door_open_2.ogg', None, None, -4)],
  'door_close':   [(RPG + '/door_close_%d.ogg' % i, None, None, -4) for i in (1, 2, 3)],
  'locked':       [(RPG + '/metal_latch.ogg', None, None, -4), (RPG + '/belt_handle_1.ogg', None, None, -5)],
  'unlock':       [(RPG + '/metal_click.ogg', None, None, -4)],
  'cuff':         [(RPG + '/belt_handle_2.ogg', None, None, -4), (RPG + '/metal_click.ogg', None, None, -5)],
  'snip':         [(RPG + '/knife_slice.ogg', None, None, -5), (RPG + '/knife_slice_2.ogg', None, None, -5)],
  'kick':         [(IMPACT + '/impact_wood_heavy_%03d.ogg' % i, None, None, -1) for i in (0, 1, 2)],
  'impact':       [(IMPACT + '/impact_generic_light_%03d.ogg' % i, None, None, -4) for i in (0, 1, 2, 3)],
  'impact_glass': [(IMPACT + '/impact_glass_light_%03d.ogg' % i, None, None, -5) for i in (0, 1, 2)],
  'clink':        [(IMPACT + '/impact_metal_light_%03d.ogg' % i, None, None, -5) for i in (0, 1, 2)],
  'hurt':         [(IMPACT + '/impact_punch_heavy_%03d.ogg' % i, None, None, -2) for i in (0, 1, 2)],
  'power':        [(IMPACT + '/impact_metal_heavy_%03d.ogg' % i, None, None, -3) for i in (0, 1)],
  'boom':         [(SCIFI + '/low_frequency_explosion_%03d.ogg' % i, None, None, -1) for i in (0, 1)],
  'flashbang':    [(SCIFI + '/explosion_crunch_%03d.ogg' % i, None, None, -1) for i in (0, 2, 4)],
  'ui':           [(UI + '/select_00%d.wav' % i, None, None, -9) for i in (1, 2)],
  'ok':           [(UI + '/confirmation_001.wav', None, None, -8)],
  'error':        [(UI + '/error_004.wav', None, None, -9)],
}
for m in ('wood', 'concrete', 'carpet', 'grass', 'snow'):
  T['step_' + m] = [(IMPACT + '/footstep_%s_%03d.ogg' % (m, i), None, None, -6) for i in (0, 1, 2, 3)]
T['step_metal'] = [(IMPACT + '/impact_plate_light_%03d.ogg' % i, None, None, -9) for i in (0, 1, 2, 3)]   # ship deck, gangways, inside containers

def peak_db(path):
  out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
  return float(re.search(r'max_volume: (-?[\d.]+) dB', out).group(1))

os.makedirs(dst, exist_ok=True); man = {}; tmp = os.path.join(dst, '_tmp.wav'); total = 0
for name, parts in T.items():
  files = []
  for n, (f, start, length, target) in enumerate(parts):
    path = os.path.join(src, f); cut = ['-ss', str(start), '-t', str(length)] if start is not None else []
    dur = length if length else float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout)
    fade = min(0.5, dur * 0.4)
    # gun foley: cut handling rumble below 110 Hz and trim silence before the click so the sound lands on the action
    pre = 'highpass=f=110,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.004,' if '/Master Tracks/' in f else ''
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *cut, '-i', path, '-ac', '1', '-ar', '44100', '-af', f'{pre}afade=t=in:d=0.004,afade=t=out:st={max(0, dur - fade - 0.06):.3f}:d={fade:.3f}', tmp], check=True)
    gain = target - peak_db(tmp); out = f'{name}{"_" + str(n + 1) if len(parts) > 1 else ""}.mp3'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-af', f'volume={gain:.2f}dB', '-codec:a', 'libmp3lame', '-b:a', '96k', os.path.join(dst, out)], check=True)
    files.append(out); total += os.path.getsize(os.path.join(dst, out))
  man[name] = files if len(files) > 1 else files[0]
os.remove(tmp)
json.dump(man, open(os.path.join(dst, 'manifest.json'), 'w'), indent=1)
print(len(man), 'sounds,', sum(len(v) if isinstance(v, list) else 1 for v in man.values()), 'files,', round(total / 1024), 'KB')
