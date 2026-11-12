# Sound effects

Built by `tools/build_sfx.py` from free libraries on GitHub (see CREDITS.md). `manifest.json` maps each sound name to one file or a list of variants; the game picks a variant at random.
To swap a sound, drop a file here and point its name at it in `manifest.json`. Any name that is missing falls back to the synthesised version in `public/js/audio.js`.
