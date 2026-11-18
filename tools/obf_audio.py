#!/usr/bin/env python3
"""Pack bought sound clips (voice packs, the theme music) into obfuscated .blx files, the same format as tools/obf_glb.py,
so they are not plain downloadable .mp3s at public URLs: the store licences ask that players can't lift the files out of the
game. js/audio.js unpacks them (js/store/obf.js unpackBlx) before decoding.

  python3 tools/obf_audio.py public/sfx/vo_s_spot_1.mp3 [more.mp3 ...]   -> writes .blx next to each and deletes the .mp3
"""
import os, struct, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from obf_glb import stream

for src in sys.argv[1:]:
    data = open(src, 'rb').read(); k = stream(len(data)); dst = os.path.splitext(src)[0] + '.blx'
    open(dst, 'wb').write(b'BLX1' + struct.pack('<I', len(data)) + bytes(a ^ b for a, b in zip(data, k))); os.remove(src)
