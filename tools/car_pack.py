# Turn "Generic passenger car pack" (Comrade1280, CC BY 4.0) into the game's parked-car set: the ten cars are laid out around the
# model at odd angles with loose wheels, so each body gets the four wheels under it, and one node per car is written that puts it
# in the game frame (nose toward +z, centred, wheels on y = 0, metres). The ground disc is dropped. Textures are re-encoded
# afterwards by tools/pack_glb.py.
# usage: python3 tools/car_pack.py in.glb tmp.glb && python3 tools/pack_glb.py tmp.glb public/models/car/pack.glb 512
import sys, json, struct, io
import numpy as np
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
d = open(src, 'rb').read(); L = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + L]); b0 = 20 + L + 8; B = d[b0:b0 + struct.unpack('<I', d[20 + L:24 + L])[0]]
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}; CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}
def acc(i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; n = NC[a['type']]; dt = np.dtype(CT[a['componentType']]); o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    st = bv.get('byteStride', dt.itemsize * n)
    if st == dt.itemsize * n: return np.frombuffer(B, dt, a['count'] * n, o).reshape(a['count'], n).astype(np.float64)
    raw = np.frombuffer(B, np.uint8, st * (a['count'] - 1) + dt.itemsize * n, o)
    return np.lib.stride_tricks.as_strided(raw, (a['count'], dt.itemsize * n), (st, 1)).copy().view(dt).reshape(a['count'], n).astype(np.float64)
def mat(nd):
    if 'matrix' in nd: return np.array(nd['matrix']).reshape(4, 4).T
    T = np.eye(4); t = nd.get('translation', [0, 0, 0]); x, y, z, w = nd.get('rotation', [0, 0, 0, 1]); s = nd.get('scale', [1, 1, 1])
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    T[:3, :3] = R * np.array(s); T[:3, 3] = t; return T
W = {}
def walk(i, P):
    M = P @ mat(j['nodes'][i]); W[i] = M
    for c in j['nodes'][i].get('children', []): walk(c, M)
for r in j['scenes'][0]['nodes']: walk(r, np.eye(4))
def pts(i, want=None):   # world points of the meshes under node i (optionally only those whose material name starts with want)
    out = []
    for c in [i] + j['nodes'][i].get('children', []):
        m = j['nodes'][c].get('mesh')
        if m is None: continue
        for p in j['meshes'][m]['primitives']:
            if want and not j['materials'][p['material']]['name'].startswith(want): continue
            P = acc(p['attributes']['POSITION']); out.append((np.c_[P, np.ones(len(P))] @ W[c].T)[:, :3])
    return np.vstack(out) if out else np.zeros((0, 3))
def texel(p, mi):
    t = j['materials'][mi]['pbrMetallicRoughness']['baseColorTexture']['index']; im = j['images'][j['textures'][t]['source']]; bv = j['bufferViews'][im['bufferView']]
    img = np.asarray(Image.open(io.BytesIO(B[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])).convert('RGB'), np.float32) / 255
    uv = acc(p['attributes']['TEXCOORD_0']); h, w = img.shape[:2]; return img[((uv[:, 1] % 1) * (h - 1)).astype(int), ((uv[:, 0] % 1) * (w - 1)).astype(int)]
NAMES = {'Compact Body': 'compact', 'Coupe Body': 'coupe', 'Hatchback Body': 'hatch', 'minivan body': 'minivan', 'Offroad Body': 'offroad', 'Pickup Body': 'pickup',
         'Sedan Body': 'sedan', 'Sport body': 'sport', 'SUV Body': 'suv', 'Wagon Body': 'wagon'}
bodies = [i for i, nd in enumerate(j['nodes']) if nd.get('name') in NAMES]
wheels = [i for i, nd in enumerate(j['nodes']) if nd.get('name', '').startswith('Wheel_') and nd.get('children')]
nodes = []; kinds = []
for bi in bodies:
    P = pts(bi); lo, hi = P.min(0), P.max(0); pad = 0.05 * (hi - lo)
    ws = [wi for wi in wheels if ((pts(wi).mean(0) > lo - pad) & (pts(wi).mean(0) < hi + pad)).all()]; assert len(ws) == 4, (j['nodes'][bi]['name'], ws)
    c = P[:, [0, 2]].mean(0); w, v = np.linalg.eigh(np.cov((P[:, [0, 2]] - c).T)); ax = v[:, -1]          # long axis in the ground plane
    # nose: the end where the optics are not red (headlights), from the optics texture
    lights = []
    for cc in j['nodes'][bi]['children']:
        for p in j['meshes'][j['nodes'][cc]['mesh']]['primitives']:
            if j['materials'][p['material']]['name'].startswith('Optics'):
                X = acc(p['attributes']['POSITION']); X = (np.c_[X, np.ones(len(X))] @ W[cc].T)[:, :3]; col = texel(p, p['material'])
                red = (col[:, 0] > 0.45) & (col[:, 1] < 0.35); lights.append(((X[:, [0, 2]] - c) @ ax, red))
    s = np.concatenate([l[0] for l in lights]); r = np.concatenate([l[1] for l in lights])
    if s[r].mean() > s[~r].mean(): ax = -ax                                                                 # +ax runs toward the nose
    allp = np.vstack([P] + [pts(wi) for wi in ws]); c = (allp[:, [0, 2]] @ np.c_[ax, [-ax[1], ax[0]]]); mid = (c.min(0) + c.max(0)) / 2
    # game frame: z' = along the nose axis, x' = across (right-handed with y up), centred, wheels on y = 0
    R = np.eye(4); R[2, 0], R[2, 2] = ax[0], ax[1]; R[0, 0], R[0, 2] = ax[1], -ax[0]
    T = np.eye(4); T[:3, 3] = [0, -allp[:, 1].min(), 0]
    Pc = (np.c_[allp, np.ones(len(allp))] @ (T @ R).T)[:, :3]; T2 = np.eye(4); T2[0, 3] = -(Pc[:, 0].min() + Pc[:, 0].max()) / 2; T2[2, 3] = -(Pc[:, 2].min() + Pc[:, 2].max()) / 2
    M = T2 @ T @ R; Pc = (np.c_[allp, np.ones(len(allp))] @ M.T)[:, :3]; size = (Pc.max(0) - Pc.min(0)).round(2).tolist()
    kids = []
    for ni in [bi] + ws:
        for cc in [ni] + j['nodes'][ni].get('children', []):
            if j['nodes'][cc].get('mesh') is None: continue
            nodes.append({'name': j['nodes'][cc]['name'], 'mesh': j['nodes'][cc]['mesh'], 'matrix': (M @ W[cc]).T.reshape(-1).tolist()}); kids.append(len(nodes) - 1)
    nodes.append({'name': NAMES[j['nodes'][bi]['name']], 'children': kids, 'extras': {'size': size}}); kinds.append(len(nodes) - 1)
    print(f"{NAMES[j['nodes'][bi]['name']]:8s} L {size[2]:.2f}  W {size[0]:.2f}  H {size[1]:.2f}")
import hashlib   # the cars share some identical textures (the light clusters): point them all at one copy
first = {}
for i, im in enumerate(j['images']):
    bv = j['bufferViews'][im['bufferView']]; h = hashlib.md5(B[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]).hexdigest(); first.setdefault(h, i); im['_k'] = first[h]
for t in j['textures']: t['source'] = j['images'][t['source']]['_k']
used = sorted({t['source'] for t in j['textures']}); remap = {o: n for n, o in enumerate(used)}
for t in j['textures']: t['source'] = remap[t['source']]
j['images'] = [{k: v for k, v in j['images'][o].items() if k != '_k'} for o in used]; print(len(used), 'distinct textures')
j['nodes'] = nodes; j['scenes'] = [{'nodes': kinds}]; j['scene'] = 0; j.pop('animations', None)
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4); Bp = B + b'\0' * ((4 - len(B) % 4) % 4)
open(dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(Bp)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(Bp), 0x004E4942) + Bp)
