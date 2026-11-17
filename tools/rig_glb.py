# Slim a downloaded rigged character for the headset: drop the meshes that are not skinned to its skeleton (a held weapon,
# loose decals), simplify each skinned mesh (tools/qem.c in "keep" mode, so every vertex keeps its own skin weights and texture
# coordinates), keep only colour, normal and emissive textures (re-encoded small), drop the bundled animation and the extensions
# the game does not use. The skeleton and its bind pose are untouched, so js/chars.js can pose it as before.
# usage: python3 tools/rig_glb.py in.glb out.glb [ratio] [texture_px]      (build the simplifier first: gcc -O2 -o /tmp/qem tools/qem.c -lm)
import sys, io, json, struct, subprocess, os, tempfile
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]; RATIO = float(sys.argv[3]) if len(sys.argv) > 3 else 0.35; TEX = int(sys.argv[4]) if len(sys.argv) > 4 else 512
QEM = os.environ.get('QEM', '/tmp/qem')
KEEP_MORE = { 'face': 1.0, 'mask': 1.0, 'gloves': 1.0, 'uniform': 1.0, 'patch': 1.0, 'helmet': 0.7, 'night_vis_goggles': 0.85, 'eyes': 0.3 }   # fractions of triangles kept where detail shows (or thin pieces would break up)
CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
d = open(src, 'rb').read(); L = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + L]); b0 = 20 + L + 8
B = d[b0:b0 + struct.unpack('<I', d[20 + L:24 + L])[0]]
def acc(i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; dt = CT[a['componentType']]; n = NC[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); stride = bv.get('byteStride', 0); isz = np.dtype(dt).itemsize * n
    if stride and stride != isz:
        raw = np.frombuffer(B, np.uint8, a['count'] * stride, off).reshape(a['count'], stride)[:, :isz]; r = np.frombuffer(raw.tobytes(), dt).reshape(a['count'], n)
    else: r = np.frombuffer(B, dt, a['count'] * n, off).reshape(a['count'], n)
    if a.get('normalized') and dt != np.float32: r = r.astype(np.float32) / np.iinfo(dt).max
    return r.copy()

# ---- which meshes stay: those on a skinned node ----
skinned = set(n['mesh'] for n in j['nodes'] if 'mesh' in n and 'skin' in n)
dropped = []
for n in j['nodes']:
    if 'mesh' in n and n['mesh'] not in skinned: dropped.append(n.get('name')); del n['mesh']
print('dropped unskinned meshes:', dropped)

# ---- simplify ----
def simplify(P, I, target):
    if target >= len(I): return P, I, np.arange(len(P))
    with tempfile.TemporaryDirectory() as t:
        fi, fo = os.path.join(t, 'i.bin'), os.path.join(t, 'o.bin')
        with open(fi, 'wb') as f: f.write(struct.pack('<ii', len(P), len(I))); f.write(P.astype(np.float64).tobytes()); f.write(I.astype(np.int32).tobytes())
        subprocess.run([QEM, fi, fo, str(target), 'keep'], check=True, stderr=subprocess.DEVNULL)
        o = open(fo, 'rb').read(); mv, mt = struct.unpack('<ii', o[:8]); q = 8
        NP = np.frombuffer(o, np.float64, mv * 3, q).reshape(mv, 3); q += mv * 24; NI = np.frombuffer(o, np.int32, mt * 3, q).reshape(mt, 3); q += mt * 12; orig = np.frombuffer(o, np.int32, mv, q)
        return NP, NI, orig

out_bin = bytearray(); views = []; accs = []
def view(arr, target=None):
    while len(out_bin) % 4: out_bin.append(0)
    o = len(out_bin); out_bin.extend(arr.tobytes()); v = {'buffer': 0, 'byteOffset': o, 'byteLength': arr.nbytes}
    if target: v['target'] = target
    views.append(v); return len(views) - 1
def add_acc(arr, ctype, typ, target=34962, minmax=False, normalized=False):
    a = {'bufferView': view(arr, target), 'componentType': ctype, 'count': len(arr), 'type': typ}
    if minmax: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
    if normalized: a['normalized'] = True
    accs.append(a); return len(accs) - 1
tri0 = tri1 = 0
for mi, m in enumerate(j['meshes']):
    if mi not in skinned: m['primitives'] = []; continue
    for p in m['primitives']:
        at = p['attributes']; P = acc(at['POSITION']).astype(np.float64); I = acc(p['indices']).reshape(-1, 3) if 'indices' in p else np.arange(len(P)).reshape(-1, 3)
        mat = j['materials'][p['material']]['name'] if 'material' in p else ''; keep = KEEP_MORE.get(mat, RATIO); target = max(60, int(len(I) * keep))
        NP, NI, orig = simplify(P, I, target); tri0 += len(I); tri1 += len(NI)
        na = {'POSITION': add_acc(NP.astype(np.float32), 5126, 'VEC3', minmax=True)}
        if 'NORMAL' in at: nn = acc(at['NORMAL'])[orig].astype(np.float32); nn /= np.maximum(1e-9, np.linalg.norm(nn, axis=1, keepdims=True)); na['NORMAL'] = add_acc(nn, 5126, 'VEC3')
        if 'TEXCOORD_0' in at: na['TEXCOORD_0'] = add_acc(acc(at['TEXCOORD_0'])[orig].astype(np.float32), 5126, 'VEC2')
        if 'JOINTS_0' in at: jt = acc(at['JOINTS_0'])[orig]; na['JOINTS_0'] = add_acc(jt.astype(np.uint16), 5123, 'VEC4')
        if 'WEIGHTS_0' in at: w = acc(at['WEIGHTS_0'])[orig].astype(np.float32); w /= np.maximum(1e-9, w.sum(1, keepdims=True)); na['WEIGHTS_0'] = add_acc(w, 5126, 'VEC4')
        p['attributes'] = na; idx = NI.astype(np.uint16 if len(NP) < 65536 else np.uint32).ravel(); p['indices'] = add_acc(idx, 5123 if idx.dtype == np.uint16 else 5125, 'SCALAR', 34963)
        p.pop('targets', None)
print('triangles', tri0, '->', tri1)
for s in j.get('skins', []): s['inverseBindMatrices'] = add_acc(acc(s['inverseBindMatrices']).astype(np.float32), 5126, 'MAT4', None)
j.pop('animations', None)
# meshes left with no primitives: unhook them
empty = {i for i, m in enumerate(j['meshes']) if not m['primitives']}
for n in j['nodes']:
    if n.get('mesh') in empty: del n['mesh']

# ---- materials and textures ----
used_tex = {}
def tref(t):
    if t['index'] not in used_tex: used_tex[t['index']] = len(used_tex)
    t['index'] = used_tex[t['index']]; t.pop('texCoord', None); t.pop('extensions', None); return t
for m in j['materials']:
    pb = m.setdefault('pbrMetallicRoughness', {}); pb.pop('metallicRoughnessTexture', None); pb['metallicFactor'] = 0.0; pb['roughnessFactor'] = min(0.85, pb.get('roughnessFactor', 0.75))
    m.pop('occlusionTexture', None); m.pop('extensions', None)
live_mats = set(p['material'] for mi in skinned for p in j['meshes'][mi]['primitives'] if 'material' in p)
for i, m in enumerate(j['materials']):
    if i not in live_mats: continue
    if 'baseColorTexture' in m['pbrMetallicRoughness']: tref(m['pbrMetallicRoughness']['baseColorTexture'])
    for k in ('normalTexture', 'emissiveTexture'):
        if k in m: tref(m[k])
for i, m in enumerate(j['materials']):
    if i not in live_mats: m['pbrMetallicRoughness'].pop('baseColorTexture', None); m.pop('normalTexture', None); m.pop('emissiveTexture', None)
old_tex = j['textures']; new_tex = [None] * len(used_tex); new_img = []; img_of = {}
normals = set(m['normalTexture']['index'] for i, m in enumerate(j['materials']) if i in live_mats and 'normalTexture' in m)
for oi, ni in used_tex.items():
    t = dict(old_tex[oi]); si = t['source']
    if si not in img_of:
        im = j['images'][si]; bv = j['bufferViews'][im['bufferView']]; o = bv.get('byteOffset', 0); img = Image.open(io.BytesIO(B[o:o + bv['byteLength']]))
        alpha = img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info)
        if alpha and img.convert('RGBA').getchannel('A').getextrema()[0] > 250: alpha = False
        px = TEX if ni not in normals else min(TEX, 512)
        if max(img.size) > px: s = px / max(img.size); img = img.resize((max(1, int(img.size[0] * s)), max(1, int(img.size[1] * s))), Image.LANCZOS)
        buf = io.BytesIO()
        if alpha: img.convert('RGBA').save(buf, 'PNG', optimize=True); mime = 'image/png'
        else: img.convert('RGB').save(buf, 'JPEG', quality=84 if ni not in normals else 90); mime = 'image/jpeg'
        new_img.append({'bufferView': view(np.frombuffer(buf.getvalue(), np.uint8)), 'mimeType': mime}); img_of[si] = len(new_img) - 1
    t['source'] = img_of[si]; t.pop('extensions', None); new_tex[ni] = t
j['textures'] = new_tex; j['images'] = new_img; j['samplers'] = j.get('samplers') or [{}]
for k in ('extensionsUsed', 'extensionsRequired'): j.pop(k, None)
j['accessors'] = accs; j['bufferViews'] = views
while len(out_bin) % 4: out_bin.append(0)
j['buffers'] = [{'byteLength': len(out_bin)}]
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
open(dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(out_bin)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out_bin), 0x004E4942) + bytes(out_bin))
print(dst, round((28 + len(js) + len(out_bin)) / 1e6, 2), 'MB,', len(new_img), 'images')
