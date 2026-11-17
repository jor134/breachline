#!/usr/bin/env python3
"""Pack a .glb that may not be served as a stand-alone file (Sketchfab Standard licence) into an obfuscated .blx.

  python3 tools/obf_glb.py assets-src/pistol.glb public/models/pistol/pistol.blx

Format: b'BLX1' + uint32 length + the glb bytes XORed with a xorshift32 key stream. js/store/obf.js reverses it in the
browser. This is obfuscation, not encryption: it stops the model being a plain downloadable .glb at a public URL.
The un-obfuscated originals live in assets-src/ (outside public/, so the Worker never serves them).
"""
import struct, sys

SEED = 0x9E3779B9

def stream(n):
    x, out = SEED, bytearray(n)
    for i in range(n):
        x ^= (x << 13) & 0xFFFFFFFF; x ^= x >> 17; x ^= (x << 5) & 0xFFFFFFFF
        out[i] = x & 0xFF
    return out

def pack(src, dst):
    data = open(src, 'rb').read()
    if data[:4] != b'glTF': sys.exit(src + ' is not a .glb')
    k = stream(len(data))
    open(dst, 'wb').write(b'BLX1' + struct.pack('<I', len(data)) + bytes(a ^ b for a, b in zip(data, k)))

if __name__ == '__main__':
    pack(sys.argv[1], sys.argv[2])
