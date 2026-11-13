# Turn the BAe 146 Sketchfab model into the airport map's jet: game frame (y up, nose toward +z, wheels on y = 0, x = 0 on the
# centre line), scaled by S, cockpit instrument meshes dropped, the aisle-side seat of the three-seat block removed so the aisle is
# wide enough in VR, the remaining seats squashed to a normal seat-back height, the built-in airstairs removed (the map has a
# stair truck), a cargo hatch cut in the starboard lower skin, the airline's name and tail logo painted out, meshes merged by
# material and the textures re-encoded small. Prints the seat rows (game-local z ranges) for the collision boxes.
# usage: python3 tools/jet_glb.py in.glb public/models/jet/bae146.glb
import sys, io, json, struct
import numpy as np
from PIL import Image
sys.path.insert(0, __file__.rsplit('/', 1)[0])

S = 1.25
FLOOR = 1.615                     # cabin floor height in the unscaled game frame
SEAT_TOP = 1.12                   # wanted seat-back height above the floor, metres after scaling
KEEP = [1, 16, 17, 18, 19, 20, 21, 22, 39, 41]
AIRFRAME = {19, 20, 21, 22}
BULKHEADS = [8.24, -6.8]   # cabin bulkheads (unscaled z): their door openings are widened to the new aisle
BDOOR = (-0.48, 0.52, 1.6, 3.36)
HATCH = dict(x=-1.0, z0=-4.0, z1=-2.6, y0=0.86, y1=1.56)   # unscaled game frame, starboard side
STAIRS = dict(x=1.8, z0=8.4, z1=9.35, y=1.62, rx=2.02, ry=2.9)   # steps below the sill, and the hand rails further out

CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
src, dst = sys.argv[1], sys.argv[2]
d = open(src, 'rb').read(); L = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + L]); b0 = 20 + L + 8
B = d[b0:b0 + struct.unpack('<I', d[20 + L:24 + L])[0]]
def acc(i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; dt = CT[a['componentType']]; n = NC[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); stride = bv.get('byteStride', 0); isz = np.dtype(dt).itemsize * n
    if stride and stride != isz:
        raw = np.frombuffer(B, np.uint8, a['count'] * stride, off).reshape(a['count'], stride)[:, :isz]; return np.frombuffer(raw.tobytes(), dt).reshape(a['count'], n).astype(np.float64 if dt == np.float32 else np.int64)
    r = np.frombuffer(B, dt, a['count'] * n, off); return (r.reshape(a['count'], n) if n > 1 else r).astype(np.float64 if dt == np.float32 else np.int64)
def image(t):
    im = j['images'][j['textures'][t]['source']]; bv = j['bufferViews'][im['bufferView']]; o = bv.get('byteOffset', 0); return Image.open(io.BytesIO(B[o:o + bv['byteLength']]))
G = lambda p: np.stack([-p[:, 1], p[:, 2] + 4.30, -p[:, 0]], 1)   # Sketchfab z-up, nose at -x  ->  y-up, nose at +z

# ---- clip triangles against a rectangle in a 2D projection: keep only what lies outside it ----
def clip_poly(poly, axis, val, keep_less):
    out = []
    for k in range(len(poly)):
        a, b = poly[k], poly[(k + 1) % len(poly)]; ia, ib = (a['p'][axis] < val) == keep_less, (b['p'][axis] < val) == keep_less
        if ia: out.append(a)
        if ia != ib:
            t = (val - a['p'][axis]) / (b['p'][axis] - a['p'][axis]); out.append({k2: a[k2] + (b[k2] - a[k2]) * t for k2 in a})
    return out
def subtract_rect(poly, ax, ay, r):   # r = (u0, u1, v0, v1) on axes ax, ay: returns convex pieces outside the rectangle
    pieces, rest = [], poly
    for axis, val, less in [(ax, r[0], True), (ax, r[1], False), (ay, r[2], True), (ay, r[3], False)]:
        part = clip_poly(rest, axis, val, less); rest = clip_poly(rest, axis, val, not less)
        if len(part) >= 3: pieces.append(part)
        if len(rest) < 3: return pieces
    return pieces   # what is left in `rest` is inside the rectangle: dropped

prims = {}   # material -> [P, N, UV, I]
rows = []
for mi in KEEP:
    for pr in j['meshes'][mi]['primitives']:
        P = G(acc(pr['attributes']['POSITION'])); N = G(acc(pr['attributes']['NORMAL'])); N[:, 1] -= 4.30
        UV = acc(pr['attributes']['TEXCOORD_0']); I = acc(pr['indices']).reshape(-1, 3); mat = pr['material']
        C = P[I].mean(1)
        if mi == 1:   # seats: connected components; drop the aisle seat of the three-seat block; squash the rest to a normal height
            par = np.arange(len(P))
            def f(a):
                while par[a] != a: par[a] = par[par[a]]; a = par[a]
                return a
            for t in I:
                ra, rb, rc = f(t[0]), f(t[1]), f(t[2]); par[rb] = ra; par[f(rc)] = ra
            root = np.array([f(a) for a in range(len(P))]); comp = root[I[:, 0]]
            cc = {}
            for ti, c in enumerate(comp): cc.setdefault(c, []).append(ti)
            # group components into seats by rounding their centre to the seat grid, then drop whole seats
            keep = np.ones(len(I), bool)
            for c, tis in cc.items():   # every piece (cushion, back, arm rest, legs) of the aisle seat, wherever its centre falls
                cen = C[tis].mean(0)
                if -0.53 < cen[0] < 0.24 and cen[2] < 9.5: keep[tis] = False
            I = I[keep]
            k = SEAT_TOP / ((P[:, 1].max() - FLOOR) * S); P[:, 1] = FLOOR + (P[:, 1] - FLOOR) * k
            q = P[np.unique(I)]; q = q[q[:, 2] < 9.5]
            zs = np.round(q[:, 2] / 0.85).astype(int)
            for r in sorted(set(zs)):
                s = q[zs == r]; rows.append([round(float(s[:, 2].min()) * S, 3), round(float(s[:, 2].max()) * S, 3)])
        if mi in AIRFRAME:   # built-in airstairs out
            C = P[I].mean(1); zin = (C[:, 2] > STAIRS['z0']) & (C[:, 2] < STAIRS['z1']); m = zin & (((C[:, 0] > STAIRS['x']) & (C[:, 1] < STAIRS['y'])) | ((C[:, 0] > STAIRS['rx']) & (C[:, 1] < STAIRS['ry']))); I = I[~m]
        if mi == 39:   # widen the bulkhead doorways front and back to match the aisle
            T = P[I]; flat = (np.abs(T[:, :, 2] - T[:, :, 2].mean(1, keepdims=True)).max(1) < 0.02)
            for zb in BULKHEADS:
                hit = flat & (np.abs(T[:, :, 2].mean(1) - zb) < 0.12) & (T[:, :, 0].max(1) > BDOOR[0]) & (T[:, :, 0].min(1) < BDOOR[1]) & (T[:, :, 1].min(1) < BDOOR[3])
                if not hit.any(): continue
                newP, newN, newUV, newI = [P], [N], [UV], []; base = len(P)
                for t in I[hit]:
                    poly = [{'p': P[v].copy(), 'n': N[v].copy(), 'u': UV[v].copy()} for v in t]
                    for pc in subtract_rect(poly, 0, 1, BDOOR):
                        ids = []
                        for v in pc: newP.append(v['p'][None]); newN.append(v['n'][None]); newUV.append(v['u'][None]); ids.append(base); base += 1
                        for a in range(1, len(ids) - 1): newI.append([ids[0], ids[a], ids[a + 1]])
                P = np.concatenate(newP); N = np.concatenate(newN); UV = np.concatenate(newUV)
                I = np.concatenate([I[~hit], np.array(newI, np.int64).reshape(-1, 3)]); T = P[I]; flat = (np.abs(T[:, :, 2] - T[:, :, 2].mean(1, keepdims=True)).max(1) < 0.02)
        if mi in AIRFRAME or mi == 39:   # the cargo hatch: cut a clean rectangle out of the starboard skin
            C = P[I].mean(1); hit = (C[:, 0] < HATCH['x'])
            T = P[I]; zmin, zmax, ymin, ymax = T[:, :, 2].min(1), T[:, :, 2].max(1), T[:, :, 1].min(1), T[:, :, 1].max(1)
            hit &= (zmax > HATCH['z0']) & (zmin < HATCH['z1']) & (ymax > HATCH['y0']) & (ymin < HATCH['y1'])
            if hit.any():
                newP, newN, newUV, newI = [P], [N], [UV], []
                base = len(P)
                for t in I[hit]:
                    poly = [{'p': P[v].copy(), 'n': N[v].copy(), 'u': UV[v].copy()} for v in t]
                    for pc in subtract_rect(poly, 2, 1, (HATCH['z0'], HATCH['z1'], HATCH['y0'], HATCH['y1'])):
                        ids = []
                        for v in pc: newP.append(v['p'][None]); newN.append(v['n'][None]); newUV.append(v['u'][None]); ids.append(base); base += 1
                        for a in range(1, len(ids) - 1): newI.append([ids[0], ids[a], ids[a + 1]])
                P = np.concatenate(newP); N = np.concatenate(newN); UV = np.concatenate(newUV)
                I = np.concatenate([I[~hit], np.array(newI, np.int64).reshape(-1, 3)])
        used = np.unique(I); remap = -np.ones(len(P), np.int64); remap[used] = np.arange(len(used)); P, N, UV, I = P[used], N[used], UV[used], remap[I]   # drop orphaned vertices
        P = P * S
        acc_ = prims.setdefault(mat, [[], [], [], [], 0])
        acc_[0].append(P); acc_[1].append(N); acc_[2].append(UV); acc_[3].append(I + acc_[4]); acc_[4] += len(P)

# ---- textures ----
def jpeg(im, size, q=82):
    im = im.convert('RGB');
    if max(im.size) > size: im = im.resize((size, size * im.size[1] // im.size[0]), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=q, optimize=True); return b.getvalue(), 'image/jpeg'
def paint_out(im, boxes):   # fill each box row by row, blending the pixels just outside its left and right edges
    a = np.asarray(im.convert('RGB')).astype(np.float32).copy()
    for x0, y0, x1, y1 in boxes:
        for y in range(y0, y1):
            l, r = a[y, max(0, x0 - 3)], a[y, min(a.shape[1] - 1, x1 + 3)]
            for x in range(x0, x1): t = (x - x0) / max(1, x1 - x0); a[y, x] = l * (1 - t) + r * t
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))
mats_out, tex_out, imgs = [], [], []
tex_map = {}
def tex_for(t):
    if t in tex_map: return tex_map[t]
    im = image(t)
    if t == 0:   # the livery atlas: the airline's name on both sides and the tail logo, painted out
        im = paint_out(im, [(596, 682, 688, 714), (336, 824, 428, 857), (56, 740, 138, 820), (883, 882, 965, 960)]); data = jpeg(im, 1024, 86)
    else: data = jpeg(im, 512)
    imgs.append(data); tex_out.append({'source': len(imgs) - 1, 'sampler': 0}); tex_map[t] = len(tex_out) - 1; return tex_map[t]
order = sorted(prims)
bin_ = bytearray(); views = []; accs = []; meshes_prims = []
def add_view(arr, target=None):
    while len(bin_) % 4: bin_.append(0)
    o = len(bin_); bin_.extend(arr.tobytes()); v = {'buffer': 0, 'byteOffset': o, 'byteLength': arr.nbytes}
    if target: v['target'] = target
    views.append(v); return len(views) - 1
for mat in order:
    Pl, Nl, Ul, Il, _ = prims[mat]
    P = np.concatenate(Pl).astype(np.float32); N = np.concatenate(Nl); N = (N / np.maximum(1e-9, np.linalg.norm(N, axis=1, keepdims=True))).astype(np.float32)
    U = np.concatenate(Ul).astype(np.float32); I = np.concatenate(Il).astype(np.uint32).ravel()
    if len(I) == 0: continue
    a0 = len(accs); accs.append({'bufferView': add_view(P, 34962), 'componentType': 5126, 'count': len(P), 'type': 'VEC3', 'min': P.min(0).tolist(), 'max': P.max(0).tolist()})
    accs.append({'bufferView': add_view(N, 34962), 'componentType': 5126, 'count': len(N), 'type': 'VEC3'})
    accs.append({'bufferView': add_view(U, 34962), 'componentType': 5126, 'count': len(U), 'type': 'VEC2'})
    accs.append({'bufferView': add_view(I, 34963), 'componentType': 5125, 'count': len(I), 'type': 'SCALAR'})
    m = j['materials'][mat]; pbr = m.get('pbrMetallicRoughness', {}); mo = {'name': m.get('name', ''), 'doubleSided': True, 'pbrMetallicRoughness': {'metallicFactor': 0.0, 'roughnessFactor': 0.85}}
    if 'baseColorFactor' in pbr: mo['pbrMetallicRoughness']['baseColorFactor'] = pbr['baseColorFactor']
    if 'baseColorTexture' in pbr: mo['pbrMetallicRoughness']['baseColorTexture'] = {'index': tex_for(pbr['baseColorTexture']['index'])}
    if m.get('alphaMode') == 'BLEND': mo['alphaMode'] = 'BLEND'
    mats_out.append(mo)
    meshes_prims.append({'attributes': {'POSITION': a0, 'NORMAL': a0 + 1, 'TEXCOORD_0': a0 + 2}, 'indices': a0 + 3, 'material': len(mats_out) - 1})
image_entries = []
for data, mime in imgs: image_entries.append({'bufferView': add_view(np.frombuffer(data, np.uint8)), 'mimeType': mime})
while len(bin_) % 4: bin_.append(0)
gl = {'asset': {'version': '2.0', 'generator': 'breachline tools/jet_glb.py', 'extras': j['asset'].get('extras', {})}, 'scene': 0, 'scenes': [{'nodes': [0]}],
      'nodes': [{'name': 'jet', 'mesh': 0}], 'meshes': [{'name': 'jet', 'primitives': meshes_prims}], 'materials': mats_out, 'textures': tex_out,
      'images': image_entries, 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}], 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(bin_)}]}
js = json.dumps(gl, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(bin_), 0x004E4942) + bytes(bin_)
open(dst, 'wb').write(out)
print('wrote', dst, len(out), 'bytes,', len(meshes_prims), 'primitives,', sum(a['count'] for a in accs if a['type'] == 'SCALAR') // 3, 'triangles')
print('ROWS', json.dumps(rows))
