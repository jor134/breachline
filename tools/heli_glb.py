# Turn the "UH-60M Black Hawk (Baltic DLC) | Broken Arrow" Sketchfab lineup (two helicopters side by side) into the casino map's
# helicopter: the first airframe only (with its door guns and its share of the glass), in the game frame (y up, nose toward -x,
# x = 0 at the cabin's middle, z = 0 on the centre line, the cabin floor on y = 0), scaled by S so a player can stand in the cabin,
# the main rotor (hub and the four blades) split off as its own node so it can spin, meshes merged by material, textures re-encoded small.
# usage: python3 tools/heli_glb.py in.glb public/models/heli/uh60.glb
import sys, io, json, struct
import numpy as np
from PIL import Image

S = 1.3            # the real cabin is 1.5 m tall inside; scaled so it is about 1.95 m
FLOOR = 0.72       # cabin floor height in the model (metres, z up)
CABIN = 0.0        # the cabin's middle, along the fuselage from the welded fuselage centre (model metres)
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

def prim(mi):
    p = j['meshes'][mi]['primitives'][0]; a = p['attributes']
    return acc(a['POSITION']), acc(a['NORMAL']), acc(a['TEXCOORD_0']), acc(p['indices']).reshape(-1, 3), p['material']
def components(P, I):   # connected triangle groups, with vertices welded by position (UV seams join)
    key = np.round(P / 0.002).astype(np.int64); _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.ravel(); par = np.arange(inv.max() + 1)
    def find(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    for a, b_, c_ in inv[I]:
        for u, v in ((a, b_), (a, c_)):
            ru, rv = find(u), find(v)
            if ru != rv: par[ru] = rv
    return np.array([find(x) for x in inv])[I[:, 0]]

# ---- the first airframe: its heading from the fuselage's long axis, the rotor hub from the four blades ----
P1, N1, U1, I1, M1 = prim(1)
tr = components(P1, I1); ids, cnt = np.unique(tr, return_counts=True)
body = P1[np.unique(I1[tr == ids[np.argmax(cnt)]].ravel())]; mid = body[(body[:, 2] > 0.8) & (body[:, 2] < 2.8)]
c = mid[:, :2].mean(0); w, v = np.linalg.eigh(np.cov((mid[:, :2] - c).T)); ax = v[:, -1]
fin = P1[P1[:, 2] > 4.3][:, :2].mean(0)
if (fin - c) @ ax < 0: ax = -ax                       # +along runs toward the tail
ac = np.array([-ax[1], ax[0]])
blades = [r for r, n in zip(ids, cnt) if n > 100 and np.ptp(P1[np.unique(I1[tr == r].ravel())][:, :2], 0).max() > 6 and P1[np.unique(I1[tr == r].ravel())][:, 2].min() > 3.4]
assert len(blades) == 4, len(blades)
hub = np.concatenate([P1[np.unique(I1[tr == r].ravel())][:, :2] for r in blades]).mean(0)
R = max(np.linalg.norm(P1[np.unique(I1[tr == r].ravel())][:, :2] - hub, axis=1).max() for r in blades) + 0.1
rotor_tri = np.zeros(len(I1), bool)
for r in ids:
    q = P1[np.unique(I1[tr == r].ravel())]
    if q[:, 2].min() > 3.5 and np.linalg.norm(q[:, :2] - hub, axis=1).max() < R: rotor_tri |= tr == r
origin = c + ax * CABIN
def G(p, at=None):   # model (z up) -> game frame, scaled; at: subtract this game-frame point (the rotor's own origin)
    t = (p[:, :2] - origin) @ ax; s = (p[:, :2] - origin) @ ac
    g = np.stack([t, p[:, 2] - FLOOR, -s], 1) * S
    return g - at if at is not None else g
def GN(n): t = n[:, :2] @ ax; s = n[:, :2] @ ac; return np.stack([t, n[:, 2], -s], 1)
hubG = G(np.array([[hub[0], hub[1], 3.66]]))[0]

# ---- the door: the sliding door on the right (+z in the game frame) is shut in the model; cut the opening out of the side ----
DOOR = (-0.6, 2.2, 0.02, 1.9)    # game frame, after scaling: x from, x to, y from, y to
def clip_poly(poly, axis, val, keep_less):
    out = []
    for k in range(len(poly)):
        a, b = poly[k], poly[(k + 1) % len(poly)]; ia, ib = (a['p'][axis] < val) == keep_less, (b['p'][axis] < val) == keep_less
        if ia: out.append(a)
        if ia != ib:
            t = (val - a['p'][axis]) / (b['p'][axis] - a['p'][axis]); out.append({k2: a[k2] + (b[k2] - a[k2]) * t for k2 in a})
    return out
def subtract_rect(poly, ax_, ay_, r):   # convex pieces of poly outside the rectangle r = (u0, u1, v0, v1) on axes ax_, ay_
    pieces, rest = [], poly
    for axis, val, less in [(ax_, r[0], True), (ax_, r[1], False), (ay_, r[2], True), (ay_, r[3], False)]:
        part = clip_poly(rest, axis, val, less); rest = clip_poly(rest, axis, val, not less)
        if len(part) >= 3: pieces.append(part)
        if len(rest) < 3: return pieces
    return pieces
def cut_door(P, N, U, I):
    T = P[I]; hit = (T[:, :, 2].min(1) > 1.05) & (T[:, :, 0].max(1) > DOOR[0]) & (T[:, :, 0].min(1) < DOOR[1]) & (T[:, :, 1].max(1) > DOOR[2]) & (T[:, :, 1].min(1) < DOOR[3])
    if not hit.any(): return P, N, U, I
    nP, nN, nU, nI, base = [P], [N], [U], [], len(P)
    for t in I[hit]:
        for pc in subtract_rect([{'p': P[v].copy(), 'n': N[v].copy(), 'u': U[v].copy()} for v in t], 0, 1, DOOR):
            ids_ = []
            for v in pc: nP.append(v['p'][None]); nN.append(v['n'][None]); nU.append(v['u'][None]); ids_.append(base); base += 1
            for k in range(1, len(ids_) - 1): nI.append([ids_[0], ids_[k], ids_[k + 1]])
    return np.concatenate(nP), np.concatenate(nN), np.concatenate(nU), np.concatenate([I[~hit], np.array(nI, np.int64).reshape(-1, 3)])

groups = {'body': {}, 'rotor': {}}
def add(node, mat, P, N, U, I):
    keep = np.unique(I.ravel()); remap = -np.ones(len(P), np.int64); remap[keep] = np.arange(len(keep))
    Pg, Ng, Ug, Ig = G(P[keep], hubG if node == 'rotor' else None), GN(N[keep]), U[keep], remap[I]
    if node == 'body': Pg, Ng, Ug, Ig = cut_door(Pg, Ng, Ug, Ig)
    g = groups[node].setdefault(mat, [[], [], [], [], 0])
    g[0].append(Pg); g[1].append(Ng); g[2].append(Ug); g[3].append(Ig + g[4]); g[4] += len(Pg)
add('body', M1, P1, N1, U1, I1[~rotor_tri]); add('rotor', M1, P1, N1, U1, I1[rotor_tri])
inside = lambda P: ((P[:, :2] - c) @ ax > -9) & ((P[:, :2] - c) @ ax < 13) & (np.abs((P[:, :2] - c) @ ac) < 9)
for mi in range(len(j['meshes'])):
    if mi == 1: continue
    P, N, U, I, M = prim(mi); ok = inside(P); I = I[ok[I].all(1)]
    if len(I): add('body', M, P, N, U, I)

# ---- textures and output ----
def jpeg(im, size, q=84):
    im = im.convert('RGB')
    if max(im.size) > size: im = im.resize((size, size * im.size[1] // im.size[0]), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=q, optimize=True); return b.getvalue(), 'image/jpeg'
mats_out, tex_out, imgs, tex_map, mat_map = [], [], [], {}, {}
def tex_for(t, size):
    if t not in tex_map: imgs.append(jpeg(image(t), size)); tex_out.append({'source': len(imgs) - 1, 'sampler': 0}); tex_map[t] = len(tex_out) - 1
    return tex_map[t]
def mat_for(mi):
    if mi in mat_map: return mat_map[mi]
    m = j['materials'][mi]; pbr = m.get('pbrMetallicRoughness', {}); mo = {'name': m.get('name', ''), 'doubleSided': True, 'pbrMetallicRoughness': {'metallicFactor': 0.0, 'roughnessFactor': 0.8}}
    if 'baseColorFactor' in pbr: mo['pbrMetallicRoughness']['baseColorFactor'] = pbr['baseColorFactor']
    if 'baseColorTexture' in pbr: mo['pbrMetallicRoughness']['baseColorTexture'] = {'index': tex_for(pbr['baseColorTexture']['index'], 1024 if m.get('name') == 'DLC2_UH60' else 512)}
    if m.get('alphaMode') == 'BLEND': mo['alphaMode'] = 'BLEND'; mo['pbrMetallicRoughness']['roughnessFactor'] = 0.15
    mats_out.append(mo); mat_map[mi] = len(mats_out) - 1; return mat_map[mi]
bin_ = bytearray(); views = []; accs = []; meshes = []
def add_view(arr, target=None):
    while len(bin_) % 4: bin_.append(0)
    o = len(bin_); bin_.extend(arr.tobytes()); vw = {'buffer': 0, 'byteOffset': o, 'byteLength': arr.nbytes}
    if target: vw['target'] = target
    views.append(vw); return len(views) - 1
tris = 0
for node in ('body', 'rotor'):
    prims = []
    for mat in sorted(groups[node]):
        Pl, Nl, Ul, Il, _ = groups[node][mat]
        P = np.concatenate(Pl).astype(np.float32); N = np.concatenate(Nl); N = (N / np.maximum(1e-9, np.linalg.norm(N, axis=1, keepdims=True))).astype(np.float32)
        U = np.concatenate(Ul).astype(np.float32); I = np.concatenate(Il).astype(np.uint32).ravel(); tris += len(I) // 3
        a0 = len(accs); accs.append({'bufferView': add_view(P, 34962), 'componentType': 5126, 'count': len(P), 'type': 'VEC3', 'min': P.min(0).tolist(), 'max': P.max(0).tolist()})
        accs.append({'bufferView': add_view(N, 34962), 'componentType': 5126, 'count': len(N), 'type': 'VEC3'})
        accs.append({'bufferView': add_view(U, 34962), 'componentType': 5126, 'count': len(U), 'type': 'VEC2'})
        accs.append({'bufferView': add_view(I, 34963), 'componentType': 5125, 'count': len(I), 'type': 'SCALAR'})
        prims.append({'attributes': {'POSITION': a0, 'NORMAL': a0 + 1, 'TEXCOORD_0': a0 + 2}, 'indices': a0 + 3, 'material': mat_for(mat)})
    meshes.append({'name': node, 'primitives': prims})
image_entries = [{'bufferView': add_view(np.frombuffer(data, np.uint8)), 'mimeType': mime} for data, mime in imgs]
while len(bin_) % 4: bin_.append(0)
gl = {'asset': {'version': '2.0', 'generator': 'breachline tools/heli_glb.py', 'extras': j['asset'].get('extras', {})}, 'scene': 0, 'scenes': [{'nodes': [0, 1]}],
      'nodes': [{'name': 'body', 'mesh': 0}, {'name': 'rotor', 'mesh': 1, 'translation': hubG.tolist()}], 'meshes': meshes, 'materials': mats_out, 'textures': tex_out,
      'images': image_entries, 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}], 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(bin_)}]}
js = json.dumps(gl, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(bin_), 0x004E4942) + bytes(bin_)
open(dst, 'wb').write(out)
allP = np.concatenate([np.concatenate(g[0]) for g in groups['body'].values()])
print('wrote', dst, len(out), 'bytes,', tris, 'triangles; hub', hubG.round(2).tolist(), 'body bounds', allP.min(0).round(2).tolist(), allP.max(0).round(2).tolist())
