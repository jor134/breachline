# The club's furniture kit, from "Night Club" by MBRODERI2 (Sketchfab, CC BY 4.0). The model is one small bar room (9 x 10 m);
# the game builds a far bigger hall and furnishes it with the model's pieces. This cuts the model into kits (each one or more of
# its nodes, baked into the kit's own frame: centred on x and z, standing on y = 0, metres, facing +z as the model has them),
# one mesh per material in each kit, and writes them into one glTF binary with the model's textures (shrunk).
# Its materials are the old specular-glossiness kind, which three.js no longer reads: turned into metal-rough (diffuse -> base
# colour, 1 - glossiness -> roughness, emissive kept). Blended materials become alpha-masked (cheap, no sorting) unless glass.
#   python3 tools/club_kit.py night_club.glb assets-src/club-kit.glb
import sys, io, json, struct, re
import numpy as np
from PIL import Image

SRC, DST = sys.argv[1:3]; TEX = 512
d = open(SRC, 'rb').read(); L = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + L]); B = d[20 + L + 8:]
CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
def acc(i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; dt = CT[a['componentType']]; n = NC[a['type']]; st = bv.get('byteStride', 0); o = bv.get('byteOffset', 0) + a.get('byteOffset', 0); isz = np.dtype(dt).itemsize * n
    if st and st != isz: return np.frombuffer(np.frombuffer(B, np.uint8, a['count'] * st, o).reshape(a['count'], st)[:, :isz].tobytes(), dt).reshape(a['count'], n).copy()
    return np.frombuffer(B, dt, a['count'] * n, o).reshape(a['count'], n).copy()
def qm(q):
    x, y, z, w = q; return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
def loc(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4, 4).T
    M = np.eye(4); M[:3, :3] = qm(n.get('rotation', [0, 0, 0, 1])) * np.array(n.get('scale', [1, 1, 1])); M[:3, 3] = n.get('translation', [0, 0, 0]); return M
prims = []   # (node name, world matrix, primitive)
def walk(i, W):
    n = j['nodes'][i]; W = W @ loc(n)
    if 'mesh' in n:
        for p in j['meshes'][n['mesh']]['primitives']: prims.append((n.get('name', ''), W, p))
    for c in n.get('children', []): walk(c, W)
for r in j['scenes'][0]['nodes']: walk(r, np.eye(4))

# kits: name -> (node-name pattern, which instance: None = all that match, or the first match only)
KITS = {
  'bar': (r'^Bar_2_', 'all'), 'barcorner': (r'^Bar_Corner_', 'all'), 'barend': (r'^Bar_End_', 'all'),
  'barstool': (r'^Bar_Stool\d*_', 'first'), 'table': (r'^Table\d*_', 'first'),
  'shelf': (r'^Shelf\d*_', 'first'),
  'bench': (r'^Curved_Bench_5_', 'all'), 'djstand': (r'^(DJ_Stand|DJ_Sound_Controller|Laptop|DJ_Table_Ornament)', 'all'),
  'speaker': (r'^Large_Speaker_', 'all'), 'screen': (r'^BigScreen_', 'all'), 'swivel': (r'^SwivelLightGlow1_', 'all'), 'spot': (r'^Spot_light_10_', 'all'),
  'ceilspeaker': (r'^Speaker_Ceiling1?_', 'first'), 'lightbar': (r'^LightBar86_', 'all'), 'pole': (r'^Support_pole_1_', 'all'), 'steps': (r'^Steps_', 'all'), 'dancefloor': (r'^DanceFloor_', 'all'),
}
used_mats = {}; kits = {}
for kit, (pat, which) in KITS.items():
    sel = [p for p in prims if re.match(pat, p[0])]
    if which == 'first' and sel:   # the first object only (its pieces are one node per material: 'Bar_2_M_BarTop_0', 'Bar_2_M_BarWood_0')
        base = lambda n: re.sub(r'_M_\w+_\d+$|_lambert1_\d+$', '', n); first = base(sel[0][0]); sel = [p for p in sel if base(p[0]) == first]
    if not sel: print('no match for', kit, pat); continue
    parts = []
    for name, W, p in sel:
        P = acc(p['attributes']['POSITION']).astype(np.float64); P = (np.c_[P, np.ones(len(P))] @ W.T)[:, :3]
        N = acc(p['attributes']['NORMAL']).astype(np.float64) @ np.linalg.inv(W[:3, :3]) if 'NORMAL' in p['attributes'] else None
        UV = acc(p['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in p['attributes'] else np.zeros((len(P), 2), np.float32)
        I = acc(p['indices']).reshape(-1) if 'indices' in p else np.arange(len(P)); parts.append((p.get('material', 0), P, N, UV, I))
    allP = np.vstack([q[1] for q in parts]); c = allP.mean(0); lo = allP.min(0)
    off = np.array([(allP[:, 0].min() + allP[:, 0].max()) / 2, lo[1], (allP[:, 2].min() + allP[:, 2].max()) / 2])
    bym = {}
    for mi, P, N, UV, I in parts:
        e = bym.setdefault(mi, [[], [], [], [], 0]); e[0].append(P - off); e[1].append(N if N is not None else np.zeros_like(P)); e[2].append(UV); e[3].append(I + e[4]); e[4] += len(P)
    kits[kit] = {mi: (np.vstack(e[0]), np.vstack(e[1]), np.vstack(e[2]), np.concatenate(e[3])) for mi, e in bym.items()}
    for mi in bym: used_mats[mi] = True
    size = allP.max(0) - allP.min(0); print(f'{kit:12s} {len(sel):3d} parts  size {size.round(2)}  tris {sum(len(v[3]) // 3 for v in kits[kit].values())}')

# ---- write ----
out = bytearray(); views = []; accs = []; meshes = []; mats = []; imgs = []; texs = []; nodes = []; matmap = {}; imgmap = {}
def put(arr, target=None):
    while len(out) % 4: out.append(0)
    v = {'buffer': 0, 'byteOffset': len(out), 'byteLength': arr.nbytes}
    if target: v['target'] = target
    views.append(v); out.extend(arr.tobytes()); return len(views) - 1
def add_acc(arr, ct, typ, target=34962, mm=False):
    a = {'bufferView': put(arr, target), 'componentType': ct, 'count': len(arr), 'type': typ}
    if mm: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
    accs.append(a); return len(accs) - 1
def texture(ti, alpha):
    key = (ti, alpha)
    if key in imgmap: return imgmap[key]
    im = j['images'][j['textures'][ti]['source']]; bv = j['bufferViews'][im['bufferView']]; o = bv.get('byteOffset', 0)
    img = Image.open(io.BytesIO(B[o:o + bv['byteLength']])); img = img.convert('RGBA' if alpha else 'RGB')
    if max(img.size) > TEX: s = TEX / max(img.size); img = img.resize((max(1, int(img.size[0] * s)), max(1, int(img.size[1] * s))), Image.LANCZOS)
    buf = io.BytesIO(); img.save(buf, 'PNG' if alpha else 'JPEG', **({} if alpha else {'quality': 85}))
    imgs.append({'bufferView': put(np.frombuffer(buf.getvalue(), np.uint8)), 'mimeType': 'image/png' if alpha else 'image/jpeg'}); texs.append({'source': len(imgs) - 1, 'sampler': 0})
    imgmap[key] = len(texs) - 1; return imgmap[key]
GLASSY = {'M_LargeSpeakerandGlasses': False, 'M_BarShelves': True}
def material(mi):
    if mi in matmap: return matmap[mi]
    m = j['materials'][mi]; sg = m.get('extensions', {}).get('KHR_materials_pbrSpecularGlossiness', {}); blend = m.get('alphaMode') == 'BLEND'
    o = {'name': m['name'], 'pbrMetallicRoughness': {'metallicFactor': 0.0, 'roughnessFactor': round(1 - 0.8 * sg.get('glossinessFactor', 0.4), 3), 'baseColorFactor': sg.get('diffuseFactor', [1, 1, 1, 1])}, 'doubleSided': True}
    if 'diffuseTexture' in sg: o['pbrMetallicRoughness']['baseColorTexture'] = {'index': texture(sg['diffuseTexture']['index'], blend)}
    if 'emissiveTexture' in m: o['emissiveTexture'] = {'index': texture(m['emissiveTexture']['index'], False)}; o['emissiveFactor'] = m.get('emissiveFactor', [1, 1, 1])
    if blend: o['alphaMode'] = 'MASK'; o['alphaCutoff'] = 0.4
    mats.append(o); matmap[mi] = len(mats) - 1; return matmap[mi]
for kit, bym in kits.items():
    prs = []
    for mi, (P, N, UV, I) in bym.items():
        n = np.linalg.norm(N, axis=1, keepdims=True); N = np.where(n > 1e-9, N / np.maximum(n, 1e-9), [0, 1, 0])
        prs.append({'attributes': {'POSITION': add_acc(P.astype(np.float32), 5126, 'VEC3', mm=True), 'NORMAL': add_acc(N.astype(np.float32), 5126, 'VEC3'), 'TEXCOORD_0': add_acc(UV.astype(np.float32), 5126, 'VEC2')},
                    'indices': add_acc(I.astype(np.uint32), 5125, 'SCALAR', 34963), 'material': material(mi)})
    meshes.append({'name': kit, 'primitives': prs}); nodes.append({'name': kit, 'mesh': len(meshes) - 1})
while len(out) % 4: out.append(0)
g = {'asset': {'version': '2.0', 'generator': 'breachline tools/club_kit.py', 'extras': j['asset'].get('extras', {})}, 'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes,
     'materials': mats, 'textures': texs, 'images': imgs, 'samplers': [{'magFilter': 9729, 'minFilter': 9987}], 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(out)}]}
js = json.dumps(g, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
open(DST, 'wb').write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out))
print(DST, round((28 + len(js) + len(out)) / 1e6, 2), 'MB')
