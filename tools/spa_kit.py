# The Grand Prix surroundings: the circuit model laid around the game's own pit building, paddock and straight.
#   "Circuit de Spa-Francorchamps 1992 layout" by Dave Love (Sketchfab, Tyler_Dave), CC BY 4.0
# What it does, in order:
#   1. brings every part into the game's frame: the model's pit straight runs along +x on the game's track centre line
#      (z = -23), its pit building sits around the game's own one (x 0..54), one model unit = 0.165 m (the tarmac is ~10.5 m wide);
#   2. flattens the ground along the straight where the paddock is played (the real straight climbs ~3.5 % toward the hairpin),
#      keeping the real hills further out;
#   3. cuts away everything inside the playable paddock and over the straight beside it (the game draws its own there),
#      except the model's pit building on either side of the game's one; ground and road pieces are clipped exactly at the edge;
#   4. drops the DRS boards (anachronistic) and the normal maps, turns blended cut-outs into alpha-tested ones, and shrinks
#      the textures (opaque ones to JPEG);
#   5. writes the track's centre line through the hairpin and down the hill as js data for the race (circuit.js).
#   python3 tools/spa_kit.py <circuit .glb> assets-src/spa-kit.glb public/js/core/maps/spa-path.js
#   python3 tools/obf_glb.py assets-src/spa-kit.glb public/models/grandprix/spa.blx
import sys, io, json, struct, math
import numpy as np
from PIL import Image
SRC, DST, PATHJS = sys.argv[1:4]
S = 0.165                                   # metres per model unit
AX, AZ = 3780.5, -4280.0                    # model point (track centre beside the west end of the model's pit building) ...
GX, GZ = 27.0, -23.0                        # ... lands here: the middle of the game's pit building, on the track centre line
PHI = math.atan(0.0175)                     # the model's straight leans 1 degree off its z axis
YK, YB = 0.035, 328.3                       # track height along the straight: y = YB + YK * u (u: model units along it from the anchor)
UCLAMP = ((-150 - GX) / S, (230 - GX) / S)  # flattened over game x -150..230 (the whole straight, the paddock, the hairpin)
YARD = (-61.0, 101.0, -4.05, 40.6)          # cut: x0, x1, z0, z1 (game frame): the paddock behind the pit lane; the model's own track and pit lane stay
KEEP_PITS = ('bldnbbldnb', 'bldgrptopsel', 'bldnc1', 'mtlamtla0051')   # the model's pit building ...
PITS_GAP = (-70.0, 62.0)                    # ... kept east of the game's own building only (an alley between them); rebuilt by the game
GROUND = ('grass', 'road', 'rmbl', 'grvl', 'hill', 'segwide', 'gbrm', 'rdgrass', 'blyat')
DROP = ('Drssign',)
WORLD = 650.0                               # nothing whose every corner is further than this from the pits (the camera sees 640 m; fog hides it before)
DETAIL, FAR = ('twall', 'twtp', 'fncposts', 'grdrl'), 350.0   # tyre walls, fence posts, guard rails: only within this of the pits
PWX = (-61.0, 101.0)                        # the circuit's pit-wall rails go along the paddock: the game draws its own slim wall there
YOFF = 0.0                                  # lift so the straight's tarmac lands on y = 0
CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
d = open(SRC, 'rb').read(); L = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + L]); B = d[20 + L + 8:]
def acc(i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; dt = CT[a['componentType']]; n = NC[a['type']]; st = bv.get('byteStride', 0); o = bv.get('byteOffset', 0) + a.get('byteOffset', 0); isz = np.dtype(dt).itemsize * n
    if st and st != isz: return np.frombuffer(np.frombuffer(B, np.uint8, a['count'] * st, o).reshape(a['count'], st)[:, :isz].tobytes(), dt).reshape(a['count'], n).copy()
    return np.frombuffer(B, dt, a['count'] * n, o).reshape(a['count'], n).copy()
def qm(q):
    x, y, z, w = q; return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
def loc(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4, 4).T
    M = np.eye(4); M[:3, :3] = qm(n.get('rotation', [0, 0, 0, 1])) * np.array(n.get('scale', [1, 1, 1])); M[:3, 3] = n.get('translation', [0, 0, 0]); return M
c, s = math.cos(PHI), math.sin(PHI)
def to_game(P):
    u = -(P[:, 2] - AZ); v = P[:, 0] - AX
    up = u * c + v * s; vp = -u * s + v * c
    y = P[:, 1] - (YB + YK * np.clip(u, *UCLAMP))
    return np.c_[GX + S * up, S * y + YOFF, GZ + S * vp]
def rot_n(N):   # model normals into the game frame (x' from -z, z' from x, then the small turn)
    u = -N[:, 2]; v = N[:, 0]; return np.c_[u * c + v * s, N[:, 1], -u * s + v * c]

# ---- gather everything, by material ----
parts = {}
def walk(i, W):
    n = j['nodes'][i]; W = W @ loc(n)
    if 'mesh' in n:
        for p in j['meshes'][n['mesh']]['primitives']:
            m = j['materials'][p['material']]; mn = m.get('name', '')
            if any(k in mn for k in DROP): continue
            P = acc(p['attributes']['POSITION']).astype(np.float64); P = (np.c_[P, np.ones(len(P))] @ W.T)[:, :3]
            N = acc(p['attributes']['NORMAL']).astype(np.float64) @ np.linalg.inv(W[:3, :3]) if 'NORMAL' in p['attributes'] else np.tile([0, 1.0, 0], (len(P), 1))
            UV = acc(p['attributes']['TEXCOORD_0']).astype(np.float64) if 'TEXCOORD_0' in p['attributes'] else np.zeros((len(P), 2))
            I = (acc(p['indices']).reshape(-1) if 'indices' in p else np.arange(len(P))).reshape(-1, 3).astype(np.int64)
            if np.linalg.det(W[:3, :3]) < 0: I = I[:, ::-1]
            parts.setdefault(p['material'], []).append((to_game(P), rot_n(N), UV, I))
    for ch in n.get('children', []): walk(ch, W)
for r in j['scenes'][0]['nodes']: walk(r, np.eye(4))

# ---- level the straight exactly: the residual height of the track's centre line, every 5 m, taken off everything at that x ----
def ray_y(lst, x, z):
    best = None
    for P, N, UV, I in lst:
        T = P[I]; lo_ = T[:, :, [0, 2]].min(1); hi_ = T[:, :, [0, 2]].max(1)
        for ti in np.nonzero((lo_[:, 0] <= x) & (hi_[:, 0] >= x) & (lo_[:, 1] <= z) & (hi_[:, 1] >= z))[0]:
            a, b, c_ = T[ti]; v0 = b[[0, 2]] - a[[0, 2]]; v1 = c_[[0, 2]] - a[[0, 2]]; v2 = np.array([x, z]) - a[[0, 2]]; den = v0[0] * v1[1] - v0[1] * v1[0]
            if abs(den) < 1e-9: continue
            l1 = (v2[0] * v1[1] - v2[1] * v1[0]) / den; l2 = (v0[0] * v2[1] - v0[1] * v2[0]) / den
            if l1 >= -1e-6 and l2 >= -1e-6 and l1 + l2 <= 1 + 1e-6:
                y_ = a[1] + l1 * (b[1] - a[1]) + l2 * (c_[1] - a[1]); best = y_ if best is None else max(best, y_)
    return best
track = [q for mi in parts if any(k in j['materials'][mi]['name'] for k in ('road3x', 'roadgrdx', 'road1x')) for q in parts[mi]]
LX = np.arange(-150, 231, 5.0); LR = np.array([ray_y(track, x, GZ) for x in LX], dtype=object)
ok = np.array([r is not None for r in LR]); LR = np.interp(LX, LX[ok], LR[ok].astype(float))
print('straight residual before levelling: %.2f .. %.2f m' % (LR.min(), LR.max()))
for mi in parts:
    for P, N, UV, I in parts[mi]: P[:, 1] -= np.interp(np.clip(P[:, 0], LX[0], LX[-1]), LX, LR)

# ---- cut the playable area out ----
X0, X1, Z0, Z1 = YARD
def clip(poly, k, val, keep_less):   # poly: list of rows [x,y,z,nx,ny,nz,u,v]; half-plane on column k
    out = []
    for a, b in zip(poly, poly[1:] + poly[:1]):
        ia, ib = (a[k] <= val) == keep_less, (b[k] <= val) == keep_less
        if ia: out.append(a)
        if ia != ib: t = (val - a[k]) / (b[k] - a[k]); out.append(a + (b - a) * t)
    return out
def outside_pieces(tri):   # the parts of a triangle outside the yard rectangle, as convex polygons
    res = []; p = list(tri)
    a = clip(p, 0, X0, True)
    if len(a) >= 3: res.append(a)
    rest = clip(p, 0, X0, False)
    if len(rest) >= 3:
        b = clip(rest, 0, X1, False)
        if len(b) >= 3: res.append(b)
        mid = clip(rest, 0, X1, True)
        if len(mid) >= 3:
            e = clip(mid, 2, Z0, True)
            if len(e) >= 3: res.append(e)
            f = clip(mid, 2, Z1, False)
            if len(f) >= 3: res.append(f)
    return res
out_parts = {}; cut = kept = 0
for mi, lst in parts.items():
    mn = j['materials'][mi].get('name', ''); ground = any(k in mn for k in GROUND); pits = any(k in mn for k in KEEP_PITS); rail = 'grdrl' in mn or 'twtp' in mn; detail = any(k in mn for k in DETAIL)
    V = []; Ix = []
    for P, N, UV, I in lst:
        R = np.c_[P, N, UV]; Q = R[I]; mn_ = Q[:, :, [0, 2]].min(1); mx_ = Q[:, :, [0, 2]].max(1)
        tch = (mx_[:, 0] > X0) & (mn_[:, 0] < X1) & (mx_[:, 1] > Z0) & (mn_[:, 1] < Z1)
        if rail: tch |= (mx_[:, 0] > PWX[0]) & (mn_[:, 0] < PWX[1]) & (mx_[:, 1] > -17.5) & (mn_[:, 1] < -13)
        if detail: tch_far = np.hypot(Q[:, :, 0].mean(1) - 20, Q[:, :, 2].mean(1)) > FAR
        else: tch_far = np.zeros(len(Q), bool)
        tch_far |= np.hypot(Q[:, :, 0] - 20, Q[:, :, 2]).min(1) > WORLD; tch = tch & ~tch_far
        for ti in np.nonzero(~tch & ~tch_far)[0]:
            b0 = len(V); V.extend(Q[ti]); Ix.append((b0, b0 + 1, b0 + 2))
        for ti in np.nonzero(tch)[0]:
            q = Q[ti]; cx, cz = q[:, 0].mean(), q[:, 2].mean(); cut += 1
            if pits and -5 < cz < 15 and not (PITS_GAP[0] < cx < PITS_GAP[1]): polys = [list(q)]
            elif rail and q[:, 0].max() > PWX[0] and q[:, 0].min() < PWX[1] and -17.5 < cz < -13: polys = [pg for pg in (clip(list(q), 0, PWX[0], True), clip(list(q), 0, PWX[1], False)) if len(pg) >= 3]   # the pit-wall rails, along the paddock
            elif ground: polys = outside_pieces(q)
            elif X0 < cx < X1 and Z0 < cz < Z1: polys = []
            else: polys = [list(q)]
            for pg in polys:
                b0 = len(V); V.extend(pg)
                for k in range(1, len(pg) - 1): Ix.append((b0, b0 + k, b0 + k + 1))
    if Ix:   # weld: one point per place + normal + texture coordinate
        V = np.array(V); Ix = np.array(Ix); key = np.round(V * [1e3, 1e3, 1e3, 1e2, 1e2, 1e2, 1e4, 1e4]).astype(np.int64)
        _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); out_parts[mi] = (V[first], inv.reshape(-1)[Ix]); kept += len(Ix)
print('triangles kept', kept, 'touched by the cut', cut)

# ---- the buildings: taken out of the model and handed to the game as boxes it rebuilds in its own style ----
# every building piece (bldg*/bldn*, not the tyre walls) is drawn onto a 0.5 m grid from above; touching pieces make one
# building; each gets its smallest turned rectangle, its height (ground to top) and a kind from what most of it is made of
import cv2
BUILD = lambda mn: (mn.replace('Meshes', '').startswith('bldg') or mn.replace('Meshes', '').startswith('bldn')) and not any(k in mn for k in ('twtp', 'objwall', 'concrt'))
G0, GR = -700.0, 0.5
grid_ = np.zeros((int(1400 / GR), int(1400 / GR)), np.uint8); btris = []
for mi in [m for m in out_parts if BUILD(j['materials'][m]['name'])]:
    V, I = out_parts.pop(mi); mn = j['materials'][mi]['name']
    for t in I:
        q = V[t, :3]; pts = np.round((q[:, [0, 2]] - G0) / GR).astype(np.int32)
        cv2.fillConvexPoly(grid_, pts, 255); cv2.polylines(grid_, [pts], True, 255, 1)
        btris.append((q, mn))
grid_ = cv2.dilate(grid_, np.ones((3, 3), np.uint8))
ncomp, lab = cv2.connectedComponents(grid_, connectivity=8)
comp = {}
for q, mn in btris:
    cxp, czp = np.round((q[:, [0, 2]].mean(0) - G0) / GR).astype(int); k = lab[czp, cxp]
    a = 0.5 * np.linalg.norm(np.cross(q[1] - q[0], q[2] - q[0]))
    e = comp.setdefault(k, {'y0': 1e9, 'y1': -1e9, 'm': {}}); e['y0'] = min(e['y0'], q[:, 1].min()); e['y1'] = max(e['y1'], q[:, 1].max()); e['m'][mn] = e['m'].get(mn, 0) + a
BLD = []
tri_c = np.array([q[:, [0, 2]].mean(0) for q, mn in btris]); tri_k = lab[np.round((tri_c[:, 1] - G0) / GR).astype(int), np.round((tri_c[:, 0] - G0) / GR).astype(int)]
tri_y = np.array([(q[:, 1].min(), q[:, 1].max()) for q, mn in btris]); tri_m = [mn for q, mn in btris]
for k, e in comp.items():
    if k == 0: continue
    ys, xs = np.nonzero(lab == k)
    (cx_, cz_), (w_, d_), ang = cv2.minAreaRect(np.c_[xs, ys].astype(np.float32))
    cx_ = cx_ * GR + G0; cz_ = cz_ * GR + G0; w_ = max(0.3, w_ * GR - 1.0); d_ = max(0.3, d_ * GR - 1.0); r_ = math.radians(ang)   # the dilation backed off
    dom = max(e['m'], key=e['m'].get)
    if w_ * d_ < 12 or 'gurder' in dom: continue                                # girders and scraps
    if PWX[0] < cx_ < PWX[1] and -17.5 < cz_ < -13: continue                   # the circuit's pit-wall booth: the game's wall replaces it
    if d_ > w_: w_, d_, r_ = d_, w_, r_ + math.pi / 2                           # width is the long side
    ux, uz = math.cos(r_), math.sin(r_); sel = np.nonzero(tri_k == k)[0]
    along = (tri_c[sel, 0] - cx_) * ux + (tri_c[sel, 1] - cz_) * uz
    n = max(1, math.ceil(w_ / 24)); sw = w_ / n                                 # long ones in pieces, each with its own ground and top (they climb hills)
    for i in range(n):
        a0 = -w_ / 2 + i * sw; m_ = sel[(along >= a0 - 0.5) & (along <= a0 + sw + 0.5)]
        if not len(m_): continue
        y0_, y1_ = tri_y[m_, 0].min(), tri_y[m_, 1].max(); mc = a0 + sw / 2
        dm = max(set(tri_m[t] for t in m_), key=lambda mm: sum(1 for t in m_ if tri_m[t] == mm))
        px_, pz_ = cx_ + ux * mc, cz_ + uz * mc
        kind = 'tent' if 'tent' in dm else 'pits' if (-6 < pz_ < 16 and 50 < px_ < 160) else 'stand' if 'bldgpc' in dm or 'gsbars' in dm else 'canopy' if y0_ > 2.0 and abs(pz_) < 60 and -160 < px_ < 240 else 'block'
        BLD.append((round(px_, 2), round(pz_, 2), round(sw, 2), round(d_, 2), round(r_, 4), round(float(y0_), 2), round(float(y1_), 2), kind, dm.replace('Meshes', '')[4:24]))
BLD.sort(key=lambda b: b[0])
print(len(BLD), 'building pieces:', {k: sum(1 for b in BLD if b[7] == k) for k in ('pits', 'block', 'stand', 'tent', 'canopy')})

# ---- the race line: out of the bus-stop chicane, down the pit straight, round the hairpin, down the hill behind the paddock ----
# Hand-placed on the model's tarmac (centre of the track), the hairpin an arc; heights from the model's road under each point;
# then a speed for every point (straights ~280 km/h, ~3 g through the hairpin, braking 3.5 g, pulling away ~1.2 g) and the time
# a car takes to get there. circuit.js plays cars along it.
LINE = [(-560, -245), (-480, -207), (-400, -172), (-340, -142), (-280, -111), (-230, -82), (-180, -56), (-140, -38), (-100, -27.5), (-60, -23.5), (-20, -23), (190, -23)]
HC, HR = (200.0, -10.5), 12.5                 # the hairpin: centre and radius of the line through it
DESC = [(150, 22), (100, 43), (60, 62), (20, 79), (-20, 95), (-60, 111), (-100, 128), (-130, 136)]
def dens(pts, step=2.0):
    out_ = [np.array(pts[0], float)]
    for a, b in zip(pts, pts[1:]):
        a, b = np.array(a, float), np.array(b, float); n = max(1, int(np.linalg.norm(b - a) / step))
        for k in range(1, n + 1): out_.append(a + (b - a) * k / n)
    return out_
def smooth(pts, it=40):   # relax the corners of the hand-placed line (ends fixed)
    P_ = np.array(pts)
    for _ in range(it): P_[1:-1] = P_[1:-1] * 0.5 + (P_[:-2] + P_[2:]) * 0.25
    return P_
# the hairpin: from the straight's tangent point round to where the line down the hill touches the circle
dv = np.array(DESC[0], float) - np.array(DESC[1], float); dv /= np.linalg.norm(dv)          # the descent, run backwards (toward the hairpin)
nrm = np.array([dv[1], -dv[0]])                                                            # its normal toward the circle centre side
if np.dot(np.array(HC) - np.array(DESC[0]), nrm) < 0: nrm = -nrm
tB = np.array(HC) - nrm * HR                                                              # where the descent leaves the circle
a0, a1 = math.atan2(-HR, 0), math.atan2(tB[1] - HC[1], tB[0] - HC[0])                      # from straight up (z = HC.z - R) clockwise round
if a1 < a0: a1 += 2 * math.pi
arc = [(HC[0] + HR * math.cos(a), HC[1] + HR * math.sin(a)) for a in np.linspace(a0, a1, 24)]
line = dens(LINE) [:-1] + dens([LINE[-1], (HC[0], HC[1] - HR)]) + [np.array(q) for q in arc] + dens([tuple(tB)] + DESC)[1:]
line = smooth(dens([tuple(q) for q in line], 2.0), 12)
# heights: the model's road under each point
roads = [out_parts[mi] for mi in out_parts if 'road' in j['materials'][mi]['name'] or 'grass' in j['materials'][mi]['name']]
def height(x, z):
    best = None
    for V, I in roads:
        T = V[I][:, :, [0, 1, 2]]; lo_ = T[:, :, [0, 2]].min(1); hi_ = T[:, :, [0, 2]].max(1)
        k = np.nonzero((lo_[:, 0] <= x) & (hi_[:, 0] >= x) & (lo_[:, 1] <= z) & (hi_[:, 1] >= z))[0]
        for ti in k:
            a, b, c_ = T[ti]; v0 = b[[0, 2]] - a[[0, 2]]; v1 = c_[[0, 2]] - a[[0, 2]]; v2 = np.array([x, z]) - a[[0, 2]]
            den = v0[0] * v1[1] - v0[1] * v1[0]
            if abs(den) < 1e-9: continue
            l1 = (v2[0] * v1[1] - v2[1] * v1[0]) / den; l2 = (v0[0] * v2[1] - v0[1] * v2[0]) / den
            if l1 >= -1e-6 and l2 >= -1e-6 and l1 + l2 <= 1 + 1e-6:
                y_ = a[1] + l1 * (b[1] - a[1]) + l2 * (c_[1] - a[1]); best = y_ if best is None else max(best, y_)
    return best
H_ = [height(x, z) for x, z in line]
for k in range(len(H_)):
    if H_[k] is None: H_[k] = H_[k - 1] if k else 0.0
H_ = np.convolve(np.pad(np.array(H_), 3, mode='edge'), np.ones(7) / 7, mode='valid')
print('straight height at x 27:', round(height(27, -23) or 0, 3))
seg = np.linalg.norm(np.diff(line, axis=0), axis=1); sx = np.r_[0, np.cumsum(seg)]
# speed: curvature limit, then braking (backward) and acceleration (forward) passes
hd = np.unwrap(np.arctan2(np.gradient(line[:, 1]), np.gradient(line[:, 0]))); curv = np.abs(np.gradient(hd)) / np.maximum(np.gradient(sx), 1e-6)
curv = np.convolve(np.pad(curv, 4, mode='edge'), np.ones(9) / 9, mode='valid')
VMAX, ALAT, DEC, ACC = 78.0, 30.0, 34.0, 12.0
v = np.minimum(VMAX, np.sqrt(ALAT / np.maximum(curv, 1e-6))); v[0] = min(v[0], 44.0)
for k in range(1, len(v)): v[k] = min(v[k], math.sqrt(v[k - 1] ** 2 + 2 * ACC * (1 - v[k - 1] / (VMAX * 1.15)) * seg[k - 1]))
for k in range(len(v) - 2, -1, -1): v[k] = min(v[k], math.sqrt(v[k + 1] ** 2 + 2 * DEC * seg[k]))
tt = np.r_[0, np.cumsum(seg / ((v[1:] + v[:-1]) / 2))]
print('race line', round(sx[-1]), 'm,', round(tt[-1], 1), 's; slowest', round(v.min() * 3.6), 'km/h')
keep = [0]
for k in range(1, len(line) - 1):
    if sx[k] - sx[keep[-1]] >= 4 or abs(hd[k] - hd[keep[-1]]) > 0.08: keep.append(k)
keep.append(len(line) - 1)
pts = ','.join(f'{line[k, 0]:.1f},{line[k, 1]:.1f},{H_[k]:.2f},{tt[k]:.2f}' for k in keep)
open(PATHJS, 'w').write('// Generated by tools/spa_kit.py from the circuit model: the race line as x, z, y, seconds from its start, every few metres.\n'
    '// Out of the bus-stop chicane, down the pit straight (along z = -23), round the hairpin, down the hill behind the paddock.\n'
    f'export const LINE = [{pts}];\n'
    '// The circuit\'s buildings, rebuilt by the game: centre x, z, width (the long side), depth, rotation about y (three.js), lowest y, top y, kind.\n'
    'export const BUILDINGS = ' + json.dumps([[*b_[:4], round(-b_[4], 4), *b_[5:8]] for b_ in BLD], separators=(',', ':')) + ';\n')
print(PATHJS, len(keep), 'points')
LINE_DBG = line

# ---- write the glb ----
out = bytearray(); views = []; accs = []; meshes = []; mats = []; imgs = []; texs = []; nodes = []; imgmap = {}
def put(arr, target=None):
    while len(out) % 4: out.append(0)
    v = {'buffer': 0, 'byteOffset': len(out), 'byteLength': arr.nbytes}
    if target: v['target'] = target
    views.append(v); out.extend(arr.tobytes()); return len(views) - 1
def add_acc(arr, ct, typ, target=34962, mm=False):
    a = {'bufferView': put(arr, target), 'componentType': ct, 'count': len(arr), 'type': typ}
    if mm: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
    accs.append(a); return len(accs) - 1
def image(ii):
    bv = j['bufferViews'][j['images'][ii]['bufferView']]; o = bv.get('byteOffset', 0); return Image.open(io.BytesIO(B[o:o + bv['byteLength']]))
def add_img(ii):
    if ii in imgmap: return imgmap[ii]
    im = image(ii); alpha = im.mode in ('RGBA', 'LA', 'P') and np.array(im.convert('RGBA'))[:, :, 3].min() < 250
    w, h = im.size; k = min(1.0, 512 / max(w, h)); im = im.resize((max(8, int(w * k)), max(8, int(h * k))), Image.LANCZOS)
    buf = io.BytesIO()
    if alpha: im.convert('RGBA').quantize(256, method=Image.FASTOCTREE).save(buf, 'PNG', optimize=True); mime = 'image/png'
    else: im.convert('RGB').save(buf, 'JPEG', quality=85); mime = 'image/jpeg'
    imgs.append({'bufferView': put(np.frombuffer(buf.getvalue(), np.uint8)), 'mimeType': mime}); texs.append({'source': len(imgs) - 1, 'sampler': 0})
    imgmap[ii] = (len(texs) - 1, alpha); return imgmap[ii]
for mi, (V, I) in sorted(out_parts.items()):
    m = j['materials'][mi]; pb = m.get('pbrMetallicRoughness', {}); o = {'name': m.get('name', str(mi)).replace('Meshes', '')[:40], 'doubleSided': True,
        'pbrMetallicRoughness': {'baseColorFactor': pb.get('baseColorFactor', [1, 1, 1, 1]), 'metallicFactor': 0.0, 'roughnessFactor': 0.92}}
    if 'baseColorTexture' in pb:
        t, alpha = add_img(j['textures'][pb['baseColorTexture']['index']]['source']); o['pbrMetallicRoughness']['baseColorTexture'] = {'index': t}
        if alpha: o['alphaMode'] = 'MASK'; o['alphaCutoff'] = 0.5
    mats.append(o)
    P = V[:, :3].astype(np.float32); N = V[:, 3:6]; n = np.linalg.norm(N, axis=1, keepdims=True); N = np.where(n > 1e-9, N / np.maximum(n, 1e-9), [0, 1, 0]).astype(np.float32)
    prim = {'attributes': {'POSITION': add_acc(P, 5126, 'VEC3', mm=True), 'NORMAL': add_acc(N, 5126, 'VEC3'), 'TEXCOORD_0': add_acc(V[:, 6:8].astype(np.float32), 5126, 'VEC2')},
            'indices': add_acc(I.astype(np.uint16).reshape(-1), 5123, 'SCALAR', 34963) if len(P) < 65536 else add_acc(I.astype(np.uint32).reshape(-1), 5125, 'SCALAR', 34963), 'material': len(mats) - 1}
    meshes.append({'name': o['name'], 'primitives': [prim]}); nodes.append({'name': o['name'], 'mesh': len(meshes) - 1})
while len(out) % 4: out.append(0)
g = {'asset': {'version': '2.0', 'generator': 'breachline tools/spa_kit.py', 'extras': {'credits': [j['asset'].get('extras', {})]}}, 'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes,
     'materials': mats, 'textures': texs, 'images': imgs, 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}], 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(out)}]}
js = json.dumps(g, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
open(DST, 'wb').write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out))
print(DST, round((28 + len(js) + len(out)) / 1e6, 2), 'MB', len(meshes), 'meshes')

# ---- debug: the result from above, in the game frame ----
if len(sys.argv) > 4:
    from PIL import ImageDraw
    import hashlib
    bx0, bx1, bz0, bz1, px = [float(a) for a in sys.argv[4:9]]
    im = Image.new('RGB', (int((bx1 - bx0) * px), int((bz1 - bz0) * px)), (25, 25, 25)); dr = ImageDraw.Draw(im)
    order = sorted(out_parts, key=lambda mi: (0 if 'grass' in j['materials'][mi]['name'] or 'hill' in j['materials'][mi]['name'] else 1 if 'road' in j['materials'][mi]['name'] else 2))
    for mi in order:
        V, I = out_parts[mi]; mn = j['materials'][mi]['name']; h = int(hashlib.md5(mn.encode()).hexdigest()[:6], 16)
        col = (95, 95, 95) if 'road' in mn else (45, 75, 40) if ('grass' in mn or 'hill' in mn) else (h % 200 + 55, (h >> 8) % 200 + 55, (h >> 16) % 200 + 55)
        for t in I: dr.polygon([((V[k, 0] - bx0) * px, (V[k, 2] - bz0) * px) for k in t], fill=col)
    gs = int(sys.argv[10]) if len(sys.argv) > 10 else 50
    for x in range(int(bx0 // gs * gs), int(bx1), gs): dr.line([((x - bx0) * px, 0), ((x - bx0) * px, im.height)], fill=(120, 120, 0)); dr.text(((x - bx0) * px + 2, 6), str(x), fill=(255, 255, 0))
    for z in range(int(bz0 // gs * gs), int(bz1), gs): dr.line([(0, (z - bz0) * px), (im.width, (z - bz0) * px)], fill=(120, 120, 0)); dr.text((8, (z - bz0) * px), str(z), fill=(255, 255, 0))
    dr.rectangle(((0 - bx0) * px, (-4 - bz0) * px, (54 - bx0) * px, (16 - bz0) * px), outline=(255, 0, 0))
    dr.rectangle(((X0 - bx0) * px, (Z0 - bz0) * px, (X1 - bx0) * px, (Z1 - bz0) * px), outline=(0, 200, 255))
    dr.line([((x - bx0) * px, (z - bz0) * px) for x, z in LINE_DBG], fill=(255, 40, 40), width=2)
    KC = {'pits': (255, 60, 60), 'block': (255, 255, 255), 'stand': (60, 160, 255), 'tent': (255, 200, 0), 'canopy': (200, 0, 200)}
    for cx_, cz_, w_, d_, r_, y0_, y1_, kd, dm in BLD:
        cr, sr = math.cos(r_), math.sin(r_); cs = [(cx_ + a * w_ / 2 * cr - b * d_ / 2 * sr, cz_ + a * w_ / 2 * sr + b * d_ / 2 * cr) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        dr.polygon([((x - bx0) * px, (z - bz0) * px) for x, z in cs], outline=KC[kd]); dr.text(((cx_ - bx0) * px, (cz_ - bz0) * px), f'{kd[0]}{y1_ - y0_:.0f} {dm[:8]}', fill=KC[kd])
    im.save(sys.argv[9])
