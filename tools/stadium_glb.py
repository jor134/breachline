# The soccer stadium's shell, from "Modern Stadium" by Razny (Sketchfab, Sketchfab Standard licence; assets-src/LICENSE notes).
# The source is 6.2 million triangles; the Quest draws a few per cent of that at 72 fps. This keeps the bowl, the roof and the
# facades, cut down and flat-coloured:
#   - turned into the game's frame (metres, pitch at y 0, the pitch's long axis along x, its middle at (XC, ZC)), see stadium.js
#   - the volume where the playable VIP block goes (two floors and the terrace in front) and the slot in the roof over it are cut out
#   - the pitch and its markings go (the game draws its own), and so do the railings (thousands of tiny pieces)
#   - the seats (16 triangles each, about 32 000 of them) become strips along each row: a back and a pan, straight runs merged
#   - everything else: welded and simplified per material with tools/qem.c (quadric error), one flat colour per material
# Also writes the seats of the lower tier in front of the VIP block (for the 3D crowd) to public/js/maps/stadium-seats.js.
# usage: gcc -O2 -o /tmp/qem tools/qem.c -lm && python3 tools/stadium_glb.py modern_stadium.glb assets-src/stadium.glb
import sys, os, io, json, struct, subprocess, tempfile
import numpy as np
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]; QEM = os.environ.get('QEM', '/tmp/qem'); RATIO = float(os.environ.get('RATIO', '0.06'))
d = open(src, 'rb').read(); L = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + L]); BIN = 20 + L + 8
N = j['nodes']; par = {c: i for i, n in enumerate(N) for c in n.get('children', [])}
def mat(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4, 4).T
    t = n.get('translation', [0, 0, 0]); x, y, z, w = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
    R = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]]); M = np.eye(4); M[:3, :3] = R * s; M[:3, 3] = t; return M
W = {}
def wd(i):
    if i not in W: W[i] = (wd(par[i]) @ mat(N[i])) if i in par else mat(N[i])
    return W[i]
CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
def acc(i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; dt = CT[a['componentType']]; n = NC[a['type']]
    off = BIN + bv.get('byteOffset', 0) + a.get('byteOffset', 0); st = bv.get('byteStride', 0) or n * np.dtype(dt).itemsize
    if st == n * np.dtype(dt).itemsize: return np.frombuffer(d, dt, a['count'] * n, off).reshape(a['count'], n)
    return np.lib.stride_tricks.as_strided(np.frombuffer(d, np.uint8, a['count'] * st, off).view(dt), (a['count'], n), (st, np.dtype(dt).itemsize)).copy()
IN = 0.0254; PITCH_C = (1205.0, -2063.0); XC, ZC = 28.0, 88.0
def ours(P): return np.stack([(P[:, 2] - PITCH_C[1]) * IN + XC, (P[:, 1] + 59.0) * IN, -(P[:, 0] - PITCH_C[0]) * IN + ZC], 1)
# ---- the cuts (our frame, metres): the VIP block and its terrace, the roof slot and deck over it ----
CUTS = [(-0.5, 56.5, 4.0, 14.7, 5.0, 33.6), (5.5, 56.5, 21.0, 30.5, 16.0, 31.5)]
PITCH = (-30, 86, 50, 126)
SEAT_MATS = {'Tworzywo_sztuczne_01', 'Skra_07', 'Color_M08_1'}
DROP = {'Stal_04__szczotkowana', 'Trawa_03_1', 'Kostka_17'}   # railings; the grass and paving (drawn by the game)
def colour(mi):
    m = j['materials'][mi]; pb = m.get('pbrMetallicRoughness', {}); c = np.array(pb.get('baseColorFactor', [0.8, 0.8, 0.8, 1])[:3])
    if 'baseColorTexture' in pb:
        im = j['images'][j['textures'][pb['baseColorTexture']['index']]['source']]; bv = j['bufferViews'][im['bufferView']]; o = BIN + bv.get('byteOffset', 0)
        px = np.asarray(Image.open(io.BytesIO(d[o:o + bv['byteLength']])).convert('RGB').resize((16, 16))).reshape(-1, 3) / 255.0
        c = c * (px ** 2.2).mean(0)
    return c, m.get('alphaMode') == 'BLEND' or 'Glass' in m['name'] or 'Szko' in m['name']
groups = {}; seats = []
for i, n in enumerate(N):
    if 'mesh' not in n: continue
    M = wd(i)
    for pr in j['meshes'][n['mesh']]['primitives']:
        if pr.get('mode', 4) != 4: continue
        mi = pr.get('material', 0); name = j['materials'][mi]['name']
        if name in DROP or name.startswith('edge_color'): continue
        P = acc(pr['attributes']['POSITION']).astype(np.float64); P = ours((np.c_[P, np.ones(len(P))] @ M.T)[:, :3])
        I = acc(pr['indices']).reshape(-1, 3).astype(np.int64) if 'indices' in pr else np.arange(len(P)).reshape(-1, 3)
        C = P[I].mean(1); keep = np.ones(len(I), bool)
        for x0, x1, y0, y1, z0, z1 in CUTS: keep &= ~((C[:, 0] > x0) & (C[:, 0] < x1) & (C[:, 1] > y0) & (C[:, 1] < y1) & (C[:, 2] > z0) & (C[:, 2] < z1))
        keep &= ~((C[:, 1] < 0.25) & (C[:, 0] > PITCH[0]) & (C[:, 0] < PITCH[1]) & (C[:, 2] > PITCH[2]) & (C[:, 2] < PITCH[3]))
        I = I[keep]
        if not len(I): continue
        if name in SEAT_MATS: seats.append((name, P, I)); continue
        g = groups.setdefault(mi, [[], [], 0]); g[0].append(P); g[1].append(I + g[2]); g[2] += len(P)
def weld(V, T, tol=0.004):
    key = np.round(V / tol).astype(np.int64); _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.reshape(-1)
    T2 = inv[T]; T2 = T2[(T2[:, 0] != T2[:, 1]) & (T2[:, 1] != T2[:, 2]) & (T2[:, 0] != T2[:, 2])]
    s = np.sort(T2, 1); _, f = np.unique(s, axis=0, return_index=True); return V[first], T2[np.sort(f)]
def qem(V, T, target):
    if target >= len(T): return V, T
    t = tempfile.mkdtemp(); a, b = os.path.join(t, 'in.bin'), os.path.join(t, 'out.bin')
    with open(a, 'wb') as f: f.write(struct.pack('<ii', len(V), len(T))); f.write(V.astype(np.float64).tobytes()); f.write(T.astype(np.int32).tobytes())
    subprocess.run([QEM, a, b, str(target)], check=True, stdout=subprocess.DEVNULL)
    r = open(b, 'rb').read(); nv, nt = struct.unpack('<ii', r[:8]); return np.frombuffer(r, np.float64, nv * 3, 8).reshape(nv, 3), np.frombuffer(r, np.int32, nt * 3, 8 + nv * 24).reshape(nt, 3)
# far parts can go coarser: the share of each material's triangles near the VIP block decides how hard it is cut
out_meshes = []
for mi, (Ps, Is, _) in groups.items():
    V, T = weld(np.vstack(Ps), np.vstack(Is)); name = j['materials'][mi]['name']
    r = RATIO * (0.5 if name.startswith('Stal_02') else 1.0)   # the roof trusses: thousands of members, the outline is what reads
    V2, T2 = qem(V, T, max(40, int(len(T) * r)))
    c, glass = colour(mi); out_meshes.append((name, V2.astype(np.float32), T2.astype(np.uint32), c, glass)); print(f'{name:30s} {len(T):8d} -> {len(T2):7d}', flush=True)
# ---- seats -> row strips ----
cen = [];
for name, P, I in seats:
    key = np.round(P * 200).astype(np.int64); _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.reshape(-1); TT = inv[I]
    parent = np.arange(inv.max() + 1)
    def find(a):
        r = a
        while parent[r] != r: r = parent[r]
        while parent[a] != r: parent[a], a = r, parent[a]
        return r
    for t in TT:
        a, b, c = find(t[0]), find(t[1]), find(t[2]); parent[b] = a; parent[c] = a
    roots = np.array([find(t[0]) for t in TT]); C = P[I].mean(1); lo = P[I][:, :, 1].min(1); hi = P[I][:, :, 1].max(1)
    for r in np.unique(roots):
        m = roots == r; cen.append((C[m].mean(0), lo[m].min(), hi[m].max(), name != 'Tworzywo_sztuczne_01'))
print('seats', len(cen))
S = np.array([c[0] for c in cen]); SLO = np.array([c[1] for c in cen]); SHI = np.array([c[2] for c in cen]); VIPSEAT = np.array([c[3] for c in cen])
def facing(p):   # toward the nearest point of the pitch, flat
    tx = np.clip(p[:, 0], PITCH[0] + 6, PITCH[1] - 6); tz = np.clip(p[:, 2], PITCH[2] + 4, PITCH[3] - 4); v = np.stack([tx - p[:, 0], tz - p[:, 2]], 1); return v / (np.linalg.norm(v, axis=1, keepdims=True) + 1e-9)
F = facing(S)
# chains: seats at the same height within 0.8 m of each other
from scipy.spatial import cKDTree as KD
tree = KD(S[:, [0, 2]]); parent = np.arange(len(S))
def find(a):
    r = a
    while parent[r] != r: r = parent[r]
    while parent[a] != r: parent[a], a = r, parent[a]
    return r
for a, b in tree.query_pairs(0.8):
    if abs(S[a, 1] - S[b, 1]) < 0.06: parent[find(b)] = find(a)
roots = np.array([find(i) for i in range(len(S))])
def dp(pts, tol):   # Douglas-Peucker
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; ab = b - a; l = np.linalg.norm(ab) + 1e-9; q = pts - a; dd = np.abs(ab[0] * q[:, 1] - ab[1] * q[:, 0]) / l; k = np.argmax(dd)
    if dd[k] < tol: return np.array([a, b])
    return np.vstack([dp(pts[:k + 1], tol)[:-1], dp(pts[k:], tol)])
SV = []; ST = []; SVV = []; STV = []
def strip(V, T, poly, y0, f, back=0.42):
    for k in range(len(poly) - 1):
        (ax, az), (bx, bz) = poly[k], poly[k + 1]; ox, oz = -f[0] * 0.22, -f[1] * 0.22; fx, fz = f[0] * 0.2, f[1] * 0.2
        base = len(V)
        V += [[ax + ox, y0, az + oz], [bx + ox, y0, bz + oz], [bx + ox, y0 + back, bz + oz], [ax + ox, y0 + back, az + oz],   # the backs
              [ax + ox, y0, az + oz], [bx + ox, y0, bz + oz], [bx + fx, y0, bz + fz], [ax + fx, y0, az + fz]]                   # the pans
        T += [[base, base + 1, base + 2], [base, base + 2, base + 3], [base + 4, base + 6, base + 5], [base + 4, base + 7, base + 6]]
for r in np.unique(roots):
    idx = np.where(roots == r)[0]; p = S[idx]; f = F[idx].mean(0); f /= np.linalg.norm(f) + 1e-9; t = np.array([-f[1], f[0]])
    o = np.argsort(p[:, [0, 2]] @ t); pts = p[o][:, [0, 2]]; y0 = SLO[idx].min() + 0.05
    # split where the gap between neighbours is over a seat and a half (aisles)
    gaps = np.where(np.linalg.norm(np.diff(pts, axis=0), axis=1) > 0.9)[0]
    for seg in np.split(np.arange(len(pts)), gaps + 1):
        if len(seg) < 1: continue
        q = pts[seg]
        if len(q) == 1: q = np.array([q[0] - t * 0.24, q[0] + t * 0.24])
        else: d0 = q[1] - q[0]; d1 = q[-1] - q[-2]; q = np.vstack([q[0] - d0 / np.linalg.norm(d0) * 0.24, q[1:-1], q[-1] + d1 / np.linalg.norm(d1) * 0.24]) if len(q) > 2 else np.array([q[0] - d0 / np.linalg.norm(d0) * 0.24, q[1] + d0 / np.linalg.norm(d0) * 0.24])
        poly = dp(q, 0.06); vip = VIPSEAT[idx[o][seg]].mean() > 0.5
        strip(SVV if vip else SV, STV if vip else ST, poly, y0, f)
for nm, V, T, c in [('seats', SV, ST, np.array([0.05, 0.18, 0.55])), ('seatsVIP', SVV, STV, np.array([0.12, 0.10, 0.10]))]:
    if V: out_meshes.append((nm, np.array(V, np.float32), np.array(T, np.uint32), c, False)); print(nm, len(T))
# seats for the 3D crowd: the lower tier and the boxes level in front of the VIP block and either side of it
sel = (S[:, 0] > -26) & (S[:, 0] < 82) & (S[:, 2] > 26) & (S[:, 2] < 54)
rows = [[round(float(S[i, 0]), 2), round(float(SLO[i] + 0.05), 2), round(float(S[i, 2]), 2), round(float(np.arctan2(F[i, 0], F[i, 1])), 3)] for i in np.where(sel)[0]]
open(os.path.join(os.path.dirname(__file__), '..', 'public/js/maps/stadium-seats.js'), 'w').write(
    '// generated by tools/stadium_glb.py: seats of the stadium model in front of the VIP block, [x, seat height, z, facing (rad, 0 = +z)]\nexport const SEATS = ' + json.dumps(rows, separators=(',', ':')) + ';\n')
print('crowd seats', len(rows))
# ---- write the glb: one mesh per material, flat colours ----
out = bytearray(); views = []; accs = []; meshes = []; mats = []
def put(arr, target):
    while len(out) % 4: out.append(0)
    views.append({'buffer': 0, 'byteOffset': len(out), 'byteLength': arr.nbytes, 'target': target}); out.extend(arr.tobytes()); return len(views) - 1
tot = 0
for k, (name, V, T, c, glass) in enumerate(out_meshes):
    pa = len(accs); accs.append({'bufferView': put(V, 34962), 'componentType': 5126, 'count': len(V), 'type': 'VEC3', 'min': V.min(0).tolist(), 'max': V.max(0).tolist()})
    ia = len(accs); accs.append({'bufferView': put(T.reshape(-1), 34963), 'componentType': 5125, 'count': T.size, 'type': 'SCALAR'})
    m = {'name': name, 'pbrMetallicRoughness': {'baseColorFactor': [float(c[0]), float(c[1]), float(c[2]), 0.45 if glass else 1.0], 'metallicFactor': 0.3 if name.startswith(('Stal', 'Alu', 'Srebro')) else 0.0, 'roughnessFactor': 0.6}, 'doubleSided': True}
    if glass: m['alphaMode'] = 'BLEND'
    mats.append(m); meshes.append({'name': name, 'primitives': [{'attributes': {'POSITION': pa}, 'indices': ia, 'material': k}]}); tot += len(T)
while len(out) % 4: out.append(0)
gl = {'asset': {'version': '2.0', 'generator': 'breachline tools/stadium_glb.py', 'extras': j['asset'].get('extras', {})}, 'scene': 0, 'scenes': [{'nodes': list(range(len(meshes)))}],
      'nodes': [{'mesh': k, 'name': m['name']} for k, m in enumerate(meshes)], 'meshes': meshes, 'materials': mats, 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(out)}]}
js = json.dumps(gl, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
with open(dst, 'wb') as f: f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out))); f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js); f.write(struct.pack('<II', len(out), 0x004E4942)); f.write(out)
print('total triangles', tot, 'bytes', os.path.getsize(dst))
