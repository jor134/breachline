# The winery's kit: props made light enough to repeat by the hundred, and the photo textures for the building, in one glTF binary.
#   wine bottle   "Wine Bottle" by sotocodes (Sketchfab, CC BY 4.0)
#   wine glass    "Wine Glass" by Gamedirection (Sketchfab, CC BY 4.0)
#   oak barrel    "Wooden Wine Barrel" by Joseph Gush (Sketchfab, CC BY 4.0): its textures, for the game's own barrel shape
#   stone wall    "Photoscanned Old Stone Wall (2x4m)" by chrisg4919 (Sketchfab, CC BY 4.0): colour + normal, 2 m x 4 m
#   concrete      "Concrete material" by roko (Sketchfab, CC BY 4.0): colour + normal
#   corten steel  "Kellen Metallo Corten Steel" by Hardscape (Sketchfab, CC BY 4.0): colour
# Each prop is baked to one mesh per material in its own frame (centred on x and z, standing on y = 0, scaled to its real height,
# metres), simplified with tools/qem.c (keep mode: the texture coordinates ride along; seam points locked so nothing cracks).
# Each texture set rides on a 1 m quad named tex_<name>, for the game to take the material off.
#   gcc -O2 -o /tmp/qem tools/qem.c -lm
#   python3 tools/winery_kit.py <uploads dir> assets-src/winery-kit.glb   then   python3 tools/obf_glb.py assets-src/winery-kit.glb public/models/winery/kit.blx
import sys, io, json, struct, os, subprocess, tempfile
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
UP, DST = sys.argv[1:3]; QEM = '/tmp/qem'
PROPS = [   # name, file, target triangles (all materials), real height (m), largest texture, keep texture seams
  ('bottle', '2532a3a8-wine_bottle.glb', 320, 0.30, 256, True),
  ('glass', '5ce25f65-wine_glass.glb', 160, 0.20, 64, False),          # untextured: welded by place alone
]
TEXS = [   # name, file, [(slot, image index, px)]
  ('stone', 'photoscanned_old_stone_wall_2x4m.glb', [('map', 0, (1024, 2048)), ('normalMap', 1, (512, 1024))]),
  ('concrete', 'c22b8472-concrete_material.glb', [('map', 0, (1024, 1024)), ('normalMap', 2, (512, 512))]),
  ('corten', '801885ea-kellen_metallo_corten_steel.glb', [('map', 0, (1024, 1024))]),
  ('barrel', '9eb3e794-wooden_wine_barrel.glb', [('map', 0, (1024, 1024)), ('normalMap', 2, (512, 512))]),   # the game maps it onto its own light barrels
]
CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
def load(f):
    d = open(os.path.join(UP, f), 'rb').read(); L = struct.unpack('<I', d[12:16])[0]; return json.loads(d[20:20 + L]), d[20 + L + 8:]
def acc(j, B, i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; dt = CT[a['componentType']]; n = NC[a['type']]; st = bv.get('byteStride', 0); o = bv.get('byteOffset', 0) + a.get('byteOffset', 0); isz = np.dtype(dt).itemsize * n
    if st and st != isz: return np.frombuffer(np.frombuffer(B, np.uint8, a['count'] * st, o).reshape(a['count'], st)[:, :isz].tobytes(), dt).reshape(a['count'], n).copy()
    r = np.frombuffer(B, dt, a['count'] * n, o).reshape(a['count'], n).copy()
    if a.get('normalized') and dt != np.float32: r = r.astype(np.float32) / np.iinfo(dt).max
    return r
def qm(q):
    x, y, z, w = q; return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
def loc(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4, 4).T
    M = np.eye(4); M[:3, :3] = qm(n.get('rotation', [0, 0, 0, 1])) * np.array(n.get('scale', [1, 1, 1])); M[:3, 3] = n.get('translation', [0, 0, 0]); return M
def image(j, B, ii):
    bv = j['bufferViews'][j['images'][ii]['bufferView']]; o = bv.get('byteOffset', 0); return Image.open(io.BytesIO(B[o:o + bv['byteLength']]))
def qem(V, T, target, lock):
    d = tempfile.mkdtemp(); a, b = os.path.join(d, 'in.bin'), os.path.join(d, 'out.bin')
    with open(a, 'wb') as f: f.write(struct.pack('<ii', len(V), len(T))); f.write(V.astype(np.float64).tobytes()); f.write(T.astype(np.int32).tobytes()); f.write(lock.astype(np.uint8).tobytes())
    subprocess.run([QEM, a, b, str(target), 'keep', 'lock'], check=True, stdout=subprocess.DEVNULL)
    r = open(b, 'rb').read(); nv, nt = struct.unpack('<ii', r[:8]); o = 8 + nv * 24; T2 = np.frombuffer(r, np.int32, nt * 3, o).reshape(nt, 3); src = np.frombuffer(r, np.int32, nv, o + nt * 12)
    return T2, src

out = bytearray(); views = []; accs = []; meshes = []; mats = []; imgs = []; texs = []; nodes = []
def put(arr, target=None):
    while len(out) % 4: out.append(0)
    v = {'buffer': 0, 'byteOffset': len(out), 'byteLength': arr.nbytes}
    if target: v['target'] = target
    views.append(v); out.extend(arr.tobytes()); return len(views) - 1
def add_acc(arr, ct, typ, target=34962, mm=False):
    a = {'bufferView': put(arr, target), 'componentType': ct, 'count': len(arr), 'type': typ}
    if mm: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
    accs.append(a); return len(accs) - 1
def add_img(img, size, normal=False):
    img = img.convert('RGB')
    if normal: img = img.crop((0, 8, img.size[0], img.size[1] - 8))   # (the scan's normal map has a bright strip along its edges)
    img = img.resize(size, Image.LANCZOS); buf = io.BytesIO(); img.save(buf, 'JPEG', quality=88 if not normal else 92)
    imgs.append({'bufferView': put(np.frombuffer(buf.getvalue(), np.uint8)), 'mimeType': 'image/jpeg'}); texs.append({'source': len(imgs) - 1, 'sampler': 0}); return len(texs) - 1
def prim(P, N, UV, I, mat):
    n = np.linalg.norm(N, axis=1, keepdims=True); N = np.where(n > 1e-9, N / np.maximum(n, 1e-9), [0, 1, 0])
    return {'attributes': {'POSITION': add_acc(P.astype(np.float32), 5126, 'VEC3', mm=True), 'NORMAL': add_acc(N.astype(np.float32), 5126, 'VEC3'), 'TEXCOORD_0': add_acc(UV.astype(np.float32), 5126, 'VEC2')},
            'indices': add_acc(I.astype(np.uint32).reshape(-1), 5125, 'SCALAR', 34963), 'material': mat}
credits = []
texcache = {}
for name, f, target, height, tpx, seams in PROPS:
    j, B = load(f); credits.append(j['asset'].get('extras', {})); parts = []
    def walk(i, W):
        n = j['nodes'][i]; W = W @ loc(n)
        if 'mesh' in n:
            for p in j['meshes'][n['mesh']]['primitives']:
                if p.get('mode', 4) != 4: continue   # (lines and points: not drawn)
                P = acc(j, B, p['attributes']['POSITION']).astype(np.float64); P = (np.c_[P, np.ones(len(P))] @ W.T)[:, :3]
                N = acc(j, B, p['attributes']['NORMAL']).astype(np.float64) @ np.linalg.inv(W[:3, :3]) if 'NORMAL' in p['attributes'] else np.zeros_like(P)
                UV = acc(j, B, p['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in p['attributes'] else np.zeros((len(P), 2), np.float32)
                I = (acc(j, B, p['indices']).reshape(-1) if 'indices' in p else np.arange(len(P))).reshape(-1, 3)
                if np.linalg.det(W[:3, :3]) < 0: I = I[:, ::-1]
                parts.append((p.get('material', 0), P, N, UV, I))
        for c in n.get('children', []): walk(c, W)
    for r in j['scenes'][j.get('scene', 0)]['nodes']: walk(r, np.eye(4))
    allP = np.vstack([q[1] for q in parts]); lo, hi = allP.min(0), allP.max(0); k = height / (hi[1] - lo[1]); off = np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
    total = sum(len(q[4]) for q in parts); prs = []; matmap = {}; ntri = 0
    for mi, P, N, UV, I in parts:
        P = (P - off) * k; t = max(12, int(target * len(I) / total))
        if len(I) > t:
            # weld the points that are one point (same place, same texture coordinate), then lock those left that share a place (seams)
            kp = (np.c_[np.round(P / 1e-5), np.round(UV / 1e-4)] if seams else np.round(P / 1e-5)).astype(np.int64); _, first, inv = np.unique(kp, axis=0, return_index=True, return_inverse=True); inv = inv.reshape(-1)
            Nw = np.zeros((len(first), 3)); np.add.at(Nw, inv, N); P, N, UV, I = P[first], Nw, UV[first], inv[I]
            I = I[(I[:, 0] != I[:, 1]) & (I[:, 1] != I[:, 2]) & (I[:, 0] != I[:, 2])]
            key = np.round(P / 1e-5).astype(np.int64); _, inv, cnt = np.unique(key, axis=0, return_inverse=True, return_counts=True); lock = cnt[inv.reshape(-1)] > 1
            I, src = qem(P, I, t, lock); P, N, UV = P[src], N[src], UV[src]
        ntri += len(I)
        if mi not in matmap:
            m = j['materials'][mi]; pb = m.get('pbrMetallicRoughness', {}); sg = m.get('extensions', {}).get('KHR_materials_pbrSpecularGlossiness')
            o = {'name': name + '_' + m.get('name', str(mi)), 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': pb.get('baseColorFactor', [1, 1, 1, 1]), 'metallicFactor': pb.get('metallicFactor', 0.0), 'roughnessFactor': pb.get('roughnessFactor', 0.6)}}
            if sg: o['pbrMetallicRoughness'] = {'baseColorFactor': [0.9, 0.95, 1.0, 0.25], 'metallicFactor': 0.0, 'roughnessFactor': 0.05}; o['alphaMode'] = 'BLEND'   # the glass
            if 'baseColorTexture' in pb: kk = (f, 'c'); texcache[kk] = texcache.get(kk) if kk in texcache else add_img(image(j, B, j['textures'][pb['baseColorTexture']['index']]['source']), (tpx, tpx)); o['pbrMetallicRoughness']['baseColorTexture'] = {'index': texcache[kk]}
            if 'normalTexture' in m: kk = (f, 'n'); texcache[kk] = texcache.get(kk) if kk in texcache else add_img(image(j, B, j['textures'][m['normalTexture']['index']]['source']), (tpx // 2, tpx // 2)); o['normalTexture'] = {'index': texcache[kk]}
            if m.get('alphaMode') == 'BLEND': o['alphaMode'] = 'BLEND'
            mats.append(o); matmap[mi] = len(mats) - 1
        prs.append(prim(P, N, UV, I, matmap[mi]))
    meshes.append({'name': name, 'primitives': prs}); nodes.append({'name': name, 'mesh': len(meshes) - 1})
    print(f'{name:8s} {total:6d} -> {ntri:5d} tris  size {((hi - lo) * k).round(3)}')
for name, f, slots in TEXS:
    j, B = load(f); credits.append(j['asset'].get('extras', {})); o = {'name': 'tex_' + name, 'pbrMetallicRoughness': {'metallicFactor': 0.0, 'roughnessFactor': 0.85}}
    for slot, ii, size in slots:
        t = add_img(image(j, B, ii), size, normal=(slot == 'normalMap' and name == 'stone'))
        if slot == 'map': o['pbrMetallicRoughness']['baseColorTexture'] = {'index': t}
        else: o['normalTexture'] = {'index': t}
    mats.append(o); q = np.array([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], float)
    meshes.append({'name': 'tex_' + name, 'primitives': [prim(q, np.tile([0, 0, 1.0], (4, 1)), q[:, :2], np.array([[0, 1, 2], [0, 2, 3]]), len(mats) - 1)]}); nodes.append({'name': 'tex_' + name, 'mesh': len(meshes) - 1})
while len(out) % 4: out.append(0)
g = {'asset': {'version': '2.0', 'generator': 'breachline tools/winery_kit.py', 'extras': {'credits': credits}}, 'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes,
     'materials': mats, 'textures': texs, 'images': imgs, 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}], 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(out)}]}
js = json.dumps(g, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
open(DST, 'wb').write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out))
print(DST, round((28 + len(js) + len(out)) / 1e6, 2), 'MB')
