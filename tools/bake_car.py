# Bakes the Khronos "Car Concept" sample (CC-BY 4.0, Eric Chadwick / Darmstadt Graphics Group) into a compact, texture-free mesh:
# node transforms applied, interior dropped, flat material colours stored per vertex, vertices welded on a 12 mm grid.
# Usage: python3 -I bake_car.py CarConcept.glb out.bin
import sys, json, struct, numpy as np
src, dst = sys.argv[1], sys.argv[2]
b = open(src, 'rb').read(); n = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + n]); bin0 = 20 + n + 8
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
def acc(i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; dt = np.dtype(CT[a['componentType']]); k = NC[a['type']]
    off = bin0 + bv.get('byteOffset', 0) + a.get('byteOffset', 0); stride = bv.get('byteStride', dt.itemsize * k)
    raw = np.frombuffer(b, dtype=np.uint8, count=stride * (a['count'] - 1) + dt.itemsize * k, offset=off)
    out = np.lib.stride_tricks.as_strided(raw, shape=(a['count'], dt.itemsize * k), strides=(stride, 1)).copy().view(dt).reshape(a['count'], k).astype(np.float64)
    if a.get('normalized'): out /= np.iinfo(dt).max
    return out
def local(nd):
    if 'matrix' in nd: return np.array(nd['matrix'], dtype=np.float64).reshape(4, 4).T
    t = nd.get('translation', [0, 0, 0]); x, y, z, w = nd.get('rotation', [0, 0, 0, 1]); s = nd.get('scale', [1, 1, 1])
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4); M[:3, :3] = R * np.array(s); M[:3, 3] = t; return M
SKIP = {'Interior 1', 'Interior 2', 'Interior 3 Carmine', 'Interior 3 Pearl', 'Interior 3 Graphite', 'Floormat', 'Dashboard', 'Panel Sides'}
COL = {'Glass': (0.012, 0.016, 0.02), 'Headlight': (0.9, 0.88, 0.8), 'Brakelight': (0.35, 0.01, 0.01), 'Signallight': (0.5, 0.2, 0.02), 'License': (0.55, 0.55, 0.55), 'Disc': (0.3, 0.3, 0.3), 'Tireside': (0.012, 0.012, 0.012), 'Mirror': (0.5, 0.5, 0.5), 'Rim2': (0.55, 0.55, 0.57), 'Rim1': (0.02, 0.02, 0.02), 'Paint 1 Carmine': (0.05, 0.055, 0.065), 'Paint 2 Carmine': (0.02, 0.02, 0.022)}
P, N, C, G, I = [], [], [], [], []; base = 0
def walk(i, M):
    global base
    nd = j['nodes'][i]; M = M @ local(nd)
    if 'mesh' in nd:
        for pr in j['meshes'][nd['mesh']]['primitives']:
            m = j['materials'][pr['material']]; name = m.get('name') or ''
            if name in SKIP or pr.get('mode', 4) != 4: continue
            p = acc(pr['attributes']['POSITION']); nr = acc(pr['attributes']['NORMAL']); idx = acc(pr['indices']).astype(np.int64).ravel() if 'indices' in pr else np.arange(len(p))
            p = (np.c_[p, np.ones(len(p))] @ M.T)[:, :3]; nm = np.linalg.inv(M[:3, :3]).T; nr = nr @ nm.T; nr /= np.maximum(1e-9, np.linalg.norm(nr, axis=1))[:, None]
            col = COL.get(name) or tuple(max(0.012, c) for c in m.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1])[:3])
            shiny = name.startswith('Paint') or name in ('Glass', 'Mirror', 'Rim2', 'Headlight', 'Brakelight', 'Signallight')
            if np.linalg.det(M[:3, :3]) < 0: idx = idx.reshape(-1, 3)[:, ::-1].ravel()
            P.append(p); N.append(nr); C.append(np.tile(col, (len(p), 1))); G.append(np.full(len(p), 0 if shiny else 1)); I.append((idx + base, 0 if shiny else 1)); base += len(p)
    for c in nd.get('children', []): walk(c, M)
for r in j['scenes'][j.get('scene', 0)]['nodes']: walk(r, np.eye(4))
P = np.vstack(P); N = np.vstack(N); C = np.vstack(C); G = np.concatenate(G)
# weld: vertices of one group and colour that fall in the same 6 mm cell with a similar normal become one
key = np.c_[np.round(P / 0.012).astype(np.int64), np.round(N * 2).astype(np.int64), np.round(C * 255).astype(np.int64), G]
_, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.ravel()
cnt = np.bincount(inv); P2 = np.c_[[np.bincount(inv, P[:, k]) / cnt for k in range(3)]].T; N2 = np.c_[[np.bincount(inv, N[:, k]) for k in range(3)]].T; N2 /= np.maximum(1e-9, np.linalg.norm(N2, axis=1))[:, None]; C2 = C[first]
groups = []
for g in (0, 1):
    t = np.concatenate([inv[i].reshape(-1, 3) for i, gg in I if gg == g]); t = t[(t[:, 0] != t[:, 1]) & (t[:, 1] != t[:, 2]) & (t[:, 0] != t[:, 2])]; groups.append(t)
mn, mx = P2.min(0), P2.max(0)
# stand the car on y = 0, centred in x/z, nose toward -z
P2 = P2 - np.array([(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2]); size = mx - mn
q = np.round(P2 / size.max() * 32767).astype(np.int16); nq = np.round(N2 * 127).astype(np.int8); cq = np.round(np.sqrt(np.clip(C2, 0, 1)) * 255).astype(np.uint8)   # colours stored gamma-encoded
idx = np.concatenate(groups).astype(np.uint32).ravel()
head = json.dumps({'verts': len(q), 'scale': float(size.max() / 32767), 'size': [float(s) for s in size], 'groups': [[0, int(groups[0].size)], [int(groups[0].size), int(groups[1].size)]], 'credit': 'Car Concept by Eric Chadwick, (c) Darmstadt Graphics Group GmbH, CC-BY 4.0 (geometry only, simplified)'}).encode()
head += b' ' * ((4 - len(head) % 4) % 4)
pad = lambda a: a.tobytes() + b'\0' * ((4 - a.nbytes % 4) % 4)
open(dst, 'wb').write(struct.pack('<I', len(head)) + head + pad(q) + pad(nq) + pad(cq) + idx.tobytes())
print('verts', len(P), '->', len(q), 'tris', sum(len(g) for g in groups), 'size', size.round(2), 'bytes', 4 + len(head) + q.nbytes + nq.nbytes + cq.nbytes + idx.nbytes)
