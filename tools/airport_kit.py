# The airport's surroundings from "Airport_and Interior" by Pravin_9271 (Sketchfab), CC BY 4.0.
# The game builds its own playable terminal in the model's layout (core/maps/airport.js); this tool takes everything around it:
#   1. scales the model 2x (its airliners were ~2/3 of real size) and moves it so its terminal lands on the game's (x 0..27, z 0..55),
#      the apron at y = 0;
#   2. drops the model's terminal and forecourt (the game draws its own), three of its seven airliners (two by the forecourt, the one on
#      the runway), the lettering and a stray duplicate of the base slab; the kept airliners are set down on their wheels;
#   3. sorts the flat-coloured materials into a few kinds the game re-dresses with its own (tarmac, concrete, glass, metal, paint) and
#      gives the ground planar texture coordinates;
#   4. simplifies the heavy parts (tools/qem.c) and writes models/airport/scene.blx (via tools/obf_glb.py);
#   5. writes collision boxes for whatever stands inside the playable yard (columns of a 0.5 m grid, merged), as js data.
#   gcc -O2 -o /tmp/qem tools/qem.c -lm
#   python3 tools/airport_kit.py <model .glb> assets-src/airport-kit.glb public/js/core/maps/airport-scene.js [debug.png]
import sys, json, struct, math, os, tempfile, subprocess
import numpy as np
SRC, DST, BOXJS = sys.argv[1:4]
S, OX, OZ, Y0 = 2.0, 8.6, 54.8, 0.07          # game = S * model + (OX, -, OZ); the model's apron top (y 0.07) -> 0
TERM = (-6.0, 11.0, -29.5, 12.0)              # model x0, x1, z0, z1: its terminal and forecourt, dropped
DROP_PLANES = [(-13, 9, 21, 46), (-6, 20, 44, 69), (58, 90, 22, 54)]   # model x0, x1, z0, z1 of the airliners not kept
YARD = (-30.0, 80.0, -72.0, 90.0)             # game: the playable area (collision boxes inside it)
FOOT = (-0.5, 27.5, -0.5, 77.0)               # game: the terminal and its canopy (the game's own collision there)
QEM = '/tmp/qem'
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
inbox = (lambda x, z, b: b[0] < x < b[1] and b[2] < z < b[3])

# ---- gather the parts, model frame ----
parts = []
def walk(i, W):
    n = j['nodes'][i]; W = W @ loc(n)
    if 'mesh' in n:
        for p in j['meshes'][n['mesh']]['primitives']:
            P = acc(p['attributes']['POSITION']).astype(np.float64); P = (np.c_[P, np.ones(len(P))] @ W.T)[:, :3]
            I = (acc(p['indices']).reshape(-1) if 'indices' in p else np.arange(len(P))).reshape(-1, 3).astype(np.int64)
            if np.linalg.det(W[:3, :3]) < 0: I = I[:, ::-1]
            m = j['materials'][p.get('material', 0)]; col = m.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1])
            parts.append({'name': n.get('name', ''), 'mat': m.get('name', ''), 'col': col, 'blend': m.get('alphaMode') == 'BLEND', 'P': P, 'I': I})
    for c in n.get('children', []): walk(c, W)
for r in j['scenes'][0]['nodes']: walk(r, np.eye(4))
print(len(parts), 'parts,', sum(len(p['I']) for p in parts), 'triangles')

# ---- what goes ----
keep = []
for p in parts:
    b0, b1 = p['P'].min(0), p['P'].max(0); c = (b0 + b1) / 2; size = b1 - b0
    if p['name'].startswith('Text') or b1[1] < -5: continue                                   # lettering, the stray slab under everything
    if size[0] < 40 and size[2] < 45 and inbox(c[0], c[2], TERM): continue                 # the terminal and its forecourt
    if any(p['name'].startswith(k) for k in ('Cylinder.270', 'Cube.105', 'Cube.104_Material.002')): continue   # the railing and kerb round the diorama's edge (it would wall off the hangar)
    if size[0] < 40 and size[2] < 40 and any(inbox(c[0], c[2], q) for q in DROP_PLANES): continue
    keep.append(p)
# the kept airliners sit 0.35 above the apron on their wheels: set each down (everything airliner-white within its box)
for q in [(12, 50, -25, 12), (24, 52, 16, 48), (14, 44, 44, 70)]:
    sel = [p for p in keep if p['mat'].startswith('Wind_shield') and p['P'][:, 1].max() < 9 and inbox(*((p['P'].min(0) + p['P'].max(0)) / 2)[[0, 2]], q) and (p['P'].max(0) - p['P'].min(0))[0] < 40]
    wheels = [p['P'][:, 1].min() for p in sel if 'Wheel' in p['name']]
    if wheels:
        dy = min(wheels) - 0.07
        for p in sel: p['P'] = p['P'] - [0, dy, 0]
# ---- into the game frame ----
for p in keep:
    P = p['P']; p['G'] = np.c_[S * P[:, 0] + OX, S * (P[:, 1] - Y0), S * P[:, 2] + OZ]

# ---- the ground under the game's terminal and forecourt is cut out (the game lays its own floors there) ----
CUT = (-3.0, 30.0, -0.5, 77.0)
def clip(poly, k, val, keep_less):
    o = []
    for a_, b_ in zip(poly, poly[1:] + poly[:1]):
        ia, ib = (a_[k] <= val) == keep_less, (b_[k] <= val) == keep_less
        if ia: o.append(a_)
        if ia != ib: t = (val - a_[k]) / (b_[k] - a_[k]); o.append(a_ + (b_ - a_) * t)
    return o
def outside(tri, R):
    res = []; pl = list(tri); x0, x1, z0, z1 = R
    a_ = clip(pl, 0, x0, True); rest = clip(pl, 0, x0, False)
    if len(a_) >= 3: res.append(a_)
    if len(rest) >= 3:
        b_ = clip(rest, 0, x1, False); mid = clip(rest, 0, x1, True)
        if len(b_) >= 3: res.append(b_)
        if len(mid) >= 3:
            for pc in (clip(mid, 2, z0, True), clip(mid, 2, z1, False)):
                if len(pc) >= 3: res.append(pc)
    return res
for p in keep:
    G = p['G']; size = G.max(0) - G.min(0)
    if not (size[1] < 1.0 and max(size[0], size[2]) > 20 and G[:, 1].max() < 0.6): continue
    V = []; I = []
    for t in p['I']:
        q = G[t]
        pcs = [list(q)] if (q[:, 0].max() < CUT[0] or q[:, 0].min() > CUT[1] or q[:, 2].max() < CUT[2] or q[:, 2].min() > CUT[3]) else outside(q, CUT)
        for pg in pcs:
            b0 = len(V); V.extend(pg); I.extend((b0, b0 + k, b0 + k + 1) for k in range(1, len(pg) - 1))
    p['G'] = np.array(V) if V else np.zeros((0, 3)); p['I'] = np.array(I, np.int64).reshape(-1, 3)
keep = [p for p in keep if len(p['I'])]

# ---- materials into kinds ----
def kind(p):
    r, g, b = p['col'][:3]; lum = 0.3 * r + 0.59 * g + 0.11 * b; sat = max(r, g, b) - min(r, g, b); size = p['G'].max(0) - p['G'].min(0)
    if p['blend'] or (b > r + 0.2 and b > 0.5): return 'glass'
    if size[0] > 60 and size[2] > 60 and size[1] < 1: return 'tarmac'
    if lum < 0.06: return 'tarmac' if size[1] < 1.5 and max(size[0], size[2]) > 8 else 'dark'
    if sat > 0.25: return 'paint'
    if lum > 0.55: return 'white'
    return 'metal'
groups = {}
smooth = lambda p: any(k in p['name'] for k in ('wind_shield', 'Body', 'Wheel', 'Sphere'))   # airliners and domes are curved: smooth normals; the rest is boxes
for p in keep: groups.setdefault((kind(p) + ('~' if smooth(p) else ''), tuple(round(c, 2) for c in p['col'][:3])), []).append(p)


# ---- simplify the heavy parts ----
def qem(V, T, target):
    dd = tempfile.mkdtemp(); a, b = os.path.join(dd, 'in.bin'), os.path.join(dd, 'out.bin')
    with open(a, 'wb') as f: f.write(struct.pack('<ii', len(V), len(T))); f.write(V.astype(np.float64).tobytes()); f.write(T.astype(np.int32).tobytes()); f.write(np.zeros(len(V), np.uint8).tobytes())
    subprocess.run([QEM, a, b, str(target), 'keep', 'lock'], check=True, stdout=subprocess.DEVNULL)
    r = open(b, 'rb').read(); nv, nt = struct.unpack('<ii', r[:8]); o = 8 + nv * 24; T2 = np.frombuffer(r, np.int32, nt * 3, o).reshape(nt, 3); src = np.frombuffer(r, np.int32, nv, o + nt * 12)
    return T2, src
def weld(P, I):
    key = np.round(P * 1000).astype(np.int64); _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); return P[first], inv.reshape(-1)[I]
total = 0
for p in keep:
    P, I = weld(p['G'], p['I']); n = len(I)
    if not n: continue
    if n > 600: I, src = qem(P, I, max(200, int(n * (0.22 if n > 3000 else 0.4)))); P = P[src]
    p['G'], p['I'] = P, I; total += len(I)
print('after simplifying:', total, 'triangles')

# ---- collision inside the yard: columns of a 0.5 m grid, merged along x ----
GR = 0.75; nx, nz = int((YARD[1] - YARD[0]) / GR), int((YARD[3] - YARD[2]) / GR)
lo = np.full((nz, nx), 1e9); hi = np.full((nz, nx), -1e9)
for p in keep:
    if kind(p) == 'tarmac': continue
    G = p['G']; Q = G[p['I']]
    for q in Q:
        if q[:, 1].max() < 0.3: continue
        x0, x1, z0, z1 = q[:, 0].min(), q[:, 0].max(), q[:, 2].min(), q[:, 2].max()
        if x1 < YARD[0] or x0 > YARD[1] or z1 < YARD[2] or z0 > YARD[3]: continue
        i0, i1 = max(0, int((x0 - YARD[0]) / GR)), min(nx - 1, int((x1 - YARD[0]) / GR)); k0, k1 = max(0, int((z0 - YARD[2]) / GR)), min(nz - 1, int((z1 - YARD[2]) / GR))
        if (i1 - i0 + 1) * (k1 - k0 + 1) > 4000: continue
        # cells whose centre falls inside the triangle (or the triangle is thin enough to be a wall: all its cells)
        cx = YARD[0] + (np.arange(i0, i1 + 1) + 0.5) * GR; cz = YARD[2] + (np.arange(k0, k1 + 1) + 0.5) * GR; X, Z = np.meshgrid(cx, cz)
        a, b, c = q[0, [0, 2]], q[1, [0, 2]], q[2, [0, 2]]; v0, v1 = b - a, c - a; den = v0[0] * v1[1] - v0[1] * v1[0]
        if abs(den) < 1e-6: m = np.ones_like(X, bool)
        else: wx, wz = X - a[0], Z - a[1]; l1 = (wx * v1[1] - wz * v1[0]) / den; l2 = (v0[0] * wz - v0[1] * wx) / den; m = (l1 >= -0.3) & (l2 >= -0.3) & (l1 + l2 <= 1.3)
        sub_lo = lo[k0:k1 + 1, i0:i1 + 1]; sub_hi = hi[k0:k1 + 1, i0:i1 + 1]
        np.minimum(sub_lo, np.where(m, max(0, q[:, 1].min()), 1e9), out=sub_lo); np.maximum(sub_hi, np.where(m, q[:, 1].max(), -1e9), out=sub_hi)
BOX = []
for k in range(nz):
    i = 0; z0 = YARD[2] + k * GR
    while i < nx:
        x = YARD[0] + (i + 0.5) * GR
        if hi[k, i] < 0.35 or inbox(x, z0 + GR / 2, FOOT): i += 1; continue
        y0, y1 = (0.0 if lo[k, i] < 1.2 else lo[k, i]), hi[k, i]; s = i
        while i + 1 < nx and hi[k, i + 1] >= 0.35 and abs((0.0 if lo[k, i + 1] < 1.2 else lo[k, i + 1]) - y0) < 0.7 and abs(hi[k, i + 1] - y1) < 0.7 and not inbox(YARD[0] + (i + 1.5) * GR, z0 + GR / 2, FOOT): i += 1
        BOX.append([round(YARD[0] + s * GR, 2), round(YARD[0] + (i + 1) * GR, 2), round(y0, 2), round(y1, 2), round(z0, 2), round(z0 + GR, 2)]); i += 1
# merge rows with the same run
BOX.sort(key=lambda b: (b[0], b[1], b[2], b[3], b[4])); M = []
for b in BOX:
    if M and M[-1][0] == b[0] and M[-1][1] == b[1] and abs(M[-1][2] - b[2]) < 0.7 and abs(M[-1][3] - b[3]) < 0.7 and abs(M[-1][5] - b[4]) < 1e-6: M[-1][5] = b[5]; M[-1][3] = max(M[-1][3], b[3])
    else: M.append(b)
print(len(M), 'collision boxes in the yard')
open(BOXJS, 'w').write('// Generated by tools/airport_kit.py: solid boxes for what stands in the playable yard in the airport scenery (airliner, buildings,\n'
                       '// jet bridges, carts): [x0, x1, y0, y1, z0, z1].\nexport const SCENE_BOXES = ' + json.dumps(M, separators=(',', ':')) + ';\n')

# ---- write the glb: one mesh per (kind, colour) ----
out = bytearray(); views = []; accs = []; meshes = []; mats = []; nodes = []
def put(arr, target=None):
    while len(out) % 4: out.append(0)
    v = {'buffer': 0, 'byteOffset': len(out), 'byteLength': arr.nbytes}
    if target: v['target'] = target
    views.append(v); out.extend(arr.tobytes()); return len(views) - 1
def add_acc(arr, ct, typ, target=34962, mm=False):
    a = {'bufferView': put(arr, target), 'componentType': ct, 'count': len(arr), 'type': typ}
    if mm: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
    accs.append(a); return len(accs) - 1
for (kd, col), ps in sorted(groups.items()):
    P = np.concatenate([p['G'] for p in ps]); off = np.cumsum([0] + [len(p['G']) for p in ps])[:-1]; I = np.concatenate([p['I'] + o for p, o in zip(ps, off)])
    if not len(I): continue
    # flat normals (the model is faceted anyway): split vertices per triangle for the hard edges of boxes, weld smooth for the airliners
    Q = P[I]; N = np.cross(Q[:, 1] - Q[:, 0], Q[:, 2] - Q[:, 0]); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
    smooth_ = kd.endswith('~'); kd = kd.rstrip('~')
    if smooth_:   # smooth: area-weighted vertex normals
        VN = np.zeros_like(P); np.add.at(VN, I.reshape(-1), np.repeat(N, 3, axis=0)); VN /= np.maximum(np.linalg.norm(VN, axis=1, keepdims=True), 1e-12); Pv, Nv, Iv = P, VN, I
    else:   # flat: a point per face direction (welded where faces share both)
        Pv = Q.reshape(-1, 3); Nv = np.repeat(N, 3, axis=0); key = np.round(np.c_[Pv * 1000, Nv * 100]).astype(np.int64)
        _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); Pv, Nv, Iv = Pv[first], Nv[first], inv.reshape(-1, 3)
    UV = np.c_[Pv[:, 0], Pv[:, 2]] / 6.0   # planar, 6 m tiles (the game's textured materials use it)
    mats.append({'name': kd, 'pbrMetallicRoughness': {'baseColorFactor': list(col) + [1], 'metallicFactor': 0, 'roughnessFactor': 0.9}, 'doubleSided': kd in ('glass', 'paint', 'metal')})
    prim = {'attributes': {'POSITION': add_acc(Pv.astype(np.float32), 5126, 'VEC3', mm=True), 'NORMAL': add_acc(Nv.astype(np.float32), 5126, 'VEC3'), 'TEXCOORD_0': add_acc(UV.astype(np.float32), 5126, 'VEC2')},
            'indices': add_acc(Iv.astype(np.uint16).reshape(-1), 5123, 'SCALAR', 34963) if len(Pv) < 65536 else add_acc(Iv.astype(np.uint32).reshape(-1), 5125, 'SCALAR', 34963), 'material': len(mats) - 1}
    meshes.append({'name': kd, 'primitives': [prim]}); nodes.append({'name': kd, 'mesh': len(meshes) - 1})
while len(out) % 4: out.append(0)
g = {'asset': {'version': '2.0', 'generator': 'breachline tools/airport_kit.py', 'extras': {'credits': [j['asset'].get('extras', {})]}}, 'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes,
     'materials': mats, 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(out)}]}
js = json.dumps(g, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
open(DST, 'wb').write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out))
print(DST, round((28 + len(js) + len(out)) / 1e6, 2), 'MB,', len(meshes), 'meshes')

if len(sys.argv) > 4:   # debug: from above, game frame, with the yard, the terminal and the collision boxes
    from PIL import Image, ImageDraw
    X0, X1, Z0, Z1, PX = -60, 260, -80, 240, 3
    im = Image.new('RGB', ((X1 - X0) * PX, (Z1 - Z0) * PX), (20, 20, 28)); dr = ImageDraw.Draw(im)
    items = []
    for p in keep:
        Q = p['G'][p['I']]
        for q in Q: items.append((q[:, 1].max(), q, p['col']))
    items.sort(key=lambda t: t[0])
    for _, q, col in items: dr.polygon([((x - X0) * PX, (z - Z0) * PX) for x, y, z in q], fill=tuple(int(255 * min(1, v) ** (1 / 2.2)) for v in col[:3]))
    for b in M: dr.rectangle(((b[0] - X0) * PX, (b[4] - Z0) * PX, (b[1] - X0) * PX, (b[5] - Z0) * PX), outline=(255, 60, 60))
    dr.rectangle(((0 - X0) * PX, (0 - Z0) * PX, (27 - X0) * PX, (55 - Z0) * PX), outline=(0, 255, 0), width=2)
    dr.rectangle(((YARD[0] - X0) * PX, (YARD[2] - Z0) * PX, (YARD[1] - X0) * PX, (YARD[3] - Z0) * PX), outline=(0, 200, 255), width=2)
    dr.rectangle(((6 - X0) * PX, (-66 - Z0) * PX, (58 - X0) * PX, (-24 - Z0) * PX), outline=(255, 200, 0), width=2)
    for x in range(X0, X1, 20): dr.text(((x - X0) * PX + 2, 2), str(x), fill=(255, 255, 0))
    for z in range(Z0, Z1, 20): dr.text((2, (z - Z0) * PX + 2), str(z), fill=(255, 255, 0))
    im.save(sys.argv[4])
