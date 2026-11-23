# Bake the stadium's crowd and players into one small glTF binary for the headset.
# Fans: each skinned person in the crowd model is posed at K moments of its animation (skinning done here), simplified once (the same
# vertices kept in every pose), and written as one mesh whose base is the first pose and whose morph targets are the others: the game
# plays them on instanced meshes (one draw per person type), blending two poses at a time. The player is simplified and kept static.
# Output frame: metres, y up, feet on y = 0, facing +z.   usage: python3 tools/crowd_glb.py crowd.glb player.glb out.glb [K] [tris] [tex]
import sys, io, json, struct, subprocess, os, tempfile
import numpy as np
from PIL import Image

CROWD, PLAYER, DST = sys.argv[1:4]; K = int(sys.argv[4]) if len(sys.argv) > 4 else 24; TRIS = int(sys.argv[5]) if len(sys.argv) > 5 else 1400
TEX = int(sys.argv[6]) if len(sys.argv) > 6 else 256; SPAN = 6.0; QEM = os.environ.get('QEM', '/tmp/qem')
CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def read(path):
    d = open(path, 'rb').read(); L = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + L]); b0 = 20 + L + 8
    return j, d[b0:b0 + struct.unpack('<I', d[20 + L:24 + L])[0]]
def accessor(j, B, i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; dt = CT[a['componentType']]; n = NC[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); stride = bv.get('byteStride', 0); isz = np.dtype(dt).itemsize * n
    if stride and stride != isz: raw = np.frombuffer(B, np.uint8, a['count'] * stride, off).reshape(a['count'], stride)[:, :isz]; r = np.frombuffer(raw.tobytes(), dt).reshape(a['count'], n)
    else: r = np.frombuffer(B, dt, a['count'] * n, off).reshape(a['count'], n)
    if a.get('normalized') and dt != np.float32: r = r.astype(np.float32) / np.iinfo(dt).max
    return r.copy()
def image(j, B, ti, px):
    im = j['images'][j['textures'][ti]['source']]; bv = j['bufferViews'][im['bufferView']]; o = bv.get('byteOffset', 0)
    img = Image.open(io.BytesIO(B[o:o + bv['byteLength']])).convert('RGB')
    if max(img.size) > px: s = px / max(img.size); img = img.resize((max(1, int(img.size[0] * s)), max(1, int(img.size[1] * s))), Image.LANCZOS)
    buf = io.BytesIO(); img.save(buf, 'JPEG', quality=85); return buf.getvalue()

def qmat(q):
    x, y, z, w = q; return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
def trs(t, r, s):
    M = np.eye(4); M[:3, :3] = qmat(r) * np.array(s)[None, :]; M[:3, 3] = t; return M
def node_local(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4, 4).T
    return trs(n.get('translation', [0, 0, 0]), n.get('rotation', [0, 0, 0, 1]), n.get('scale', [1, 1, 1]))

def simplify(P, I, target):
    if target >= len(I): return P, I, np.arange(len(P))
    with tempfile.TemporaryDirectory() as t:
        fi, fo = os.path.join(t, 'i.bin'), os.path.join(t, 'o.bin')
        with open(fi, 'wb') as f: f.write(struct.pack('<ii', len(P), len(I))); f.write(P.astype(np.float64).tobytes()); f.write(I.astype(np.int32).tobytes())
        subprocess.run([QEM, fi, fo, str(target), 'keep'], check=True, stderr=subprocess.DEVNULL)
        o = open(fo, 'rb').read(); mv, mt = struct.unpack('<ii', o[:8]); q = 8
        NP = np.frombuffer(o, np.float64, mv * 3, q).reshape(mv, 3); q += mv * 24; NI = np.frombuffer(o, np.int32, mt * 3, q).reshape(mt, 3); q += mt * 12; orig = np.frombuffer(o, np.int32, mv, q)
        return NP, NI, orig
def normals(P, I):
    N = np.zeros_like(P); f = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]])
    for k in range(3): np.add.at(N, I[:, k], f)
    return (N / np.maximum(1e-9, np.linalg.norm(N, axis=1, keepdims=True))).astype(np.float32)

# ---------- the crowd: pose every skinned person ----------
j, B = read(CROWD)
nodes = j['nodes']; parent = {}
for i, n in enumerate(nodes):
    for c in n.get('children', []): parent[c] = i
anim = j['animations'][0]; chan = {}
for c in anim['channels']:
    s = anim['samplers'][c['sampler']]; chan[(c['target']['node'], c['target']['path'])] = (accessor(j, B, s['input'])[:, 0], accessor(j, B, s['output']), s.get('interpolation', 'LINEAR'))
def sample(ni, path, t, default):
    if (ni, path) not in chan: return default
    T, V, it = chan[(ni, path)]
    if it == 'CUBICSPLINE': V = V.reshape(len(T), 3, -1)[:, 1]
    if t <= T[0]: return V[0]
    if t >= T[-1]: return V[-1]
    k = np.searchsorted(T, t) - 1; u = (t - T[k]) / max(1e-9, T[k + 1] - T[k])
    if it == 'STEP': return V[k]
    a, b = V[k], V[k + 1]
    if path == 'rotation':
        if np.dot(a, b) < 0: b = -b
        q = a * (1 - u) + b * u; return q / np.linalg.norm(q)
    return a * (1 - u) + b * u
def world_at(t):
    W = {}
    def w(i):
        if i in W: return W[i]
        n = nodes[i]
        if 'matrix' in n and not any((i, p) in chan for p in ('translation', 'rotation', 'scale')): L = node_local(n)
        else: L = trs(sample(i, 'translation', t, n.get('translation', [0, 0, 0])), sample(i, 'rotation', t, n.get('rotation', [0, 0, 0, 1])), sample(i, 'scale', t, n.get('scale', [1, 1, 1])))
        W[i] = (w(parent[i]) @ L) if i in parent else L; return W[i]
    return w

out_bin = bytearray(); views = []; accs = []; meshes = []; mats = []; imgs = []; gnodes = []
def view(arr, target=None):
    while len(out_bin) % 4: out_bin.append(0)
    o = len(out_bin); out_bin.extend(arr.tobytes()); v = {'buffer': 0, 'byteOffset': o, 'byteLength': arr.nbytes}
    if target: v['target'] = target
    views.append(v); return len(views) - 1
def add_acc(arr, ctype, typ, target=34962, minmax=False):
    a = {'bufferView': view(arr, target), 'componentType': ctype, 'count': len(arr), 'type': typ}
    if minmax: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
    accs.append(a); return len(accs) - 1
def add_mesh(name, P, N, UV, I, tex, targets=()):
    imgs.append({'bufferView': view(np.frombuffer(tex, np.uint8)), 'mimeType': 'image/jpeg'})
    mats.append({'name': name, 'pbrMetallicRoughness': {'baseColorTexture': {'index': len(imgs) - 1}, 'metallicFactor': 0.0, 'roughnessFactor': 0.85}})
    pr = {'attributes': {'POSITION': add_acc(P.astype(np.float32), 5126, 'VEC3', minmax=True), 'NORMAL': add_acc(N, 5126, 'VEC3'), 'TEXCOORD_0': add_acc(UV.astype(np.float32), 5126, 'VEC2')},
          'indices': add_acc(I.astype(np.uint16).ravel(), 5123, 'SCALAR', 34963), 'material': len(mats) - 1}
    if len(targets): pr['targets'] = [{'POSITION': add_acc(d.astype(np.float32), 5126, 'VEC3', minmax=True)} for d in targets]
    meshes.append({'name': name, 'primitives': [pr]}); gnodes.append({'name': name, 'mesh': len(meshes) - 1})
    print(name, len(I), 'tris', len(P), 'verts', len(targets), 'targets')

times = np.linspace(0, SPAN, K)
NAMES = ['fan_cheer', 'fan_talk', 'fan_woman', 'fan_grandma']
for k, (ni, n) in enumerate([(i, n) for i, n in enumerate(nodes) if 'skin' in n]):
    sk = j['skins'][n['skin']]; pr = j['meshes'][n['mesh']]['primitives'][0]; at = pr['attributes']
    P0 = accessor(j, B, at['POSITION']).astype(np.float64); I = accessor(j, B, pr['indices']).reshape(-1, 3); UV = accessor(j, B, at['TEXCOORD_0'])
    J = accessor(j, B, at['JOINTS_0']).astype(int); Wt = accessor(j, B, at['WEIGHTS_0']).astype(np.float64); Wt /= np.maximum(1e-9, Wt.sum(1, keepdims=True))
    IBM = accessor(j, B, sk['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1); Ph = np.c_[P0, np.ones(len(P0))]
    poses = []
    for t in times:
        w = world_at(t); M = np.stack([w(jn) @ IBM[q] for q, jn in enumerate(sk['joints'])])
        S = np.zeros((len(P0), 4))
        for c in range(4): S += Wt[:, c:c + 1] * np.einsum('nij,nj->ni', M[J[:, c]], Ph)
        poses.append(S[:, :3])
    poses = np.stack(poses)
    # into our frame: feet on the floor, centred, facing +z (the model's own front is decided from the nose: the head's furthest point forward)
    lo = poses[0].min(0); hi = poses[0].max(0); up = int(np.argmax(hi - lo)) if False else 1
    if (hi - lo)[2] > (hi - lo)[1] * 1.5: poses = poses[:, :, [0, 2, 1]] * np.array([1, 1, -1])   # z-up source
    c = poses[0].mean(0); poses -= np.array([c[0], poses[0][:, 1].min(), c[2]])
    sc = 1.0
    h = poses[0][:, 1].max(); sc = (1.72 if k != 3 else 1.6) / h if h > 0 else 1; poses *= sc
    NP, NI, orig = simplify(poses[0], I, TRIS); P = poses[:, orig]
    tex = image(j, B, j['materials'][pr['material']]['pbrMetallicRoughness']['baseColorTexture']['index'], TEX)
    add_mesh(NAMES[k] if k < 4 else 'fan_%d' % k, P[0], normals(P[0], NI), UV[orig], NI, tex, [P[f] - P[0] for f in range(1, K)])

# ---------- the player ----------
j, B = read(PLAYER); nodes = j['nodes']; parent = {}
for i, n in enumerate(nodes):
    for c in n.get('children', []): parent[c] = i
def wstatic(i): return (wstatic(parent[i]) @ node_local(nodes[i])) if i in parent else node_local(nodes[i])
ni = next(i for i, n in enumerate(nodes) if 'mesh' in n); pr = j['meshes'][nodes[ni]['mesh']]['primitives'][0]; at = pr['attributes']
P = accessor(j, B, at['POSITION']).astype(np.float64); P = (np.c_[P, np.ones(len(P))] @ wstatic(ni).T)[:, :3]; I = accessor(j, B, pr['indices']).reshape(-1, 3); UV = accessor(j, B, at['TEXCOORD_0'])
lo, hi = P.min(0), P.max(0)
if (hi - lo)[2] > (hi - lo)[1] * 1.5: P = P[:, [0, 2, 1]] * np.array([1, 1, -1])
c = P.mean(0); P -= np.array([c[0], P[:, 1].min(), c[2]]); P *= 1.8 / P[:, 1].max()
# it comes in a T-pose with no skeleton: rig it here (bones placed from its proportions, smooth weights by region) and bake a run
# cycle: base = standing with the arms down, morph targets = RUN poses round one stride (the game blends two at a time, and scales
# them down towards the standing base for a jog or a walk)
lo, hi = P[:, :2].min(0), P[:, :2].max(0)
foot = P[P[:, 1] < 0.06]; ank = P[(P[:, 1] > 0.12) & (P[:, 1] < 0.2)]
if foot[:, 2].mean() < ank[:, 2].mean(): P[:, 0] *= -1; P[:, 2] *= -1   # toes point the way it faces: turn it to face +z
print('player toes ahead of ankles by', round(float(foot[:, 2].mean() - ank[:, 2].mean()), 3))
def R(axis, deg):
    t = np.radians(deg); c, s_ = np.cos(t), np.sin(t)
    return {'x': np.array([[1, 0, 0], [0, c, -s_], [0, s_, c]]), 'y': np.array([[c, 0, s_], [0, 1, 0], [-s_, 0, c]]), 'z': np.array([[c, -s_, 0], [s_, c, 0], [0, 0, 1]])}[axis]
sm = lambda v, a, b: np.clip((v - a) / (b - a), 0, 1)
X, Y = P[:, 0], P[:, 1]; ax = np.abs(X); side = np.sign(X)
HIP, KNEE, SH_Y, SH_X, ELB_X = 0.93, 0.5, 1.4, 0.19, 0.5
arm = (Y > 1.12) & (ax > 0.15)
w_ua = np.where(arm, sm(ax, 0.15, 0.25), 0.0); w_fa = np.where(arm, sm(ax, ELB_X - 0.04, ELB_X + 0.04), 0.0)   # upper arm, forearm (of the upper)
leg = (Y < HIP + 0.08) & ~arm
w_th = np.where(leg, 1 - sm(Y, HIP - 0.06, HIP + 0.06), 0.0) * np.where(Y > 0.8, sm(ax, 0.0, 0.06), 1.0)   # thigh (blends into the pelvis at the crotch)
w_sh = np.where(leg, 1 - sm(Y, KNEE - 0.05, KNEE + 0.05), 0.0)
def pose(phase=None, amp=1.0):
    out = P.copy()
    if phase is None: th = {1: 0.0, -1: 0.0}; kn = {1: 3.0, -1: 3.0}; sw = {1: 0.0, -1: 0.0}; el = 12.0; lean = 0.0; bob = 0.0
    else:
        th, kn, sw = {}, {}, {}
        for sd, ph in ((1, phase), (-1, phase + np.pi)):   # x>0 leg leads at phase 0
            th[sd] = 10 + 30 * np.sin(ph); kn[sd] = 16 + 80 * (0.5 + 0.5 * np.cos(ph - 0.5)) ** 2.2; sw[sd] = -30 * np.sin(ph)
        el = 85.0; lean = 9.0; bob = 0.045 * np.cos(2 * phase)
    # legs: thigh about the hip, shin about the knee
    for sd in (1, -1):
        m = side == sd; hip = np.array([0.1 * sd, HIP, 0]); Rt = R('x', -th[sd]); knee = hip + Rt @ (np.array([0.1 * sd, KNEE, 0]) - hip); Rs = Rt @ R('x', kn[sd])
        p0 = P[m]; pt = hip + (p0 - hip) @ Rt.T; ps = knee + (p0 - np.array([0.1 * sd, KNEE, 0])) @ Rs.T
        wt, ws = w_th[m][:, None], w_sh[m][:, None]; legp = pt * (1 - ws) + ps * ws; out[m] = P[m] * (1 - wt) + legp * wt
    # arms: down from the T (about z at the shoulder), swing about x, elbow bent forwards
    for sd in (1, -1):
        m = (side == sd) & arm; shp = np.array([SH_X * sd, SH_Y, 0]); Ru = R('x', -sw[sd]) @ R('z', -80 * sd); elb0 = np.array([ELB_X * sd, SH_Y, 0]); elb = shp + Ru @ (elb0 - shp)
        Rf = Ru @ R('y', -el * sd)
        p0 = P[m]; pu = shp + (p0 - shp) @ Ru.T; pf = elb + (p0 - elb0) @ Rf.T
        wu, wf = w_ua[m][:, None], w_fa[m][:, None]; ap = pu * (1 - wf) + pf * wf; out[m] = P[m] * (1 - wu) + ap * wu
    # the trunk leans forward from the hips, the whole body bobs
    up = Y > HIP; piv = np.array([0, HIP, 0]); Rl = R('x', lean); wl = sm(Y, HIP - 0.05, HIP + 0.15)[:, None]
    out = out * (1 - wl) + (piv + (out - piv) @ Rl.T) * wl
    out[:, 1] += bob
    return out
RUN = 12
frames = [pose(2 * np.pi * k / RUN) for k in range(RUN)]; P = pose()   # (pose() reads the T-pose in P: the frames first)
NP, NI, orig = simplify(P, I, int(TRIS * 1.3)); targets = [f[orig] - NP for f in frames]
# two kits (invented: the home side in navy, the visitors in white); the source's red kit is recoloured, its lettering left as it is
im = j['images'][j['textures'][j['materials'][pr['material']]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]; bv = j['bufferViews'][im['bufferView']]
src = Image.open(io.BytesIO(B[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])).convert('RGB').resize((512, 512), Image.LANCZOS)
A = np.asarray(src).astype(np.float32); r, g, b = A[..., 0], A[..., 1], A[..., 2]; red = (r > g * 1.7) & (r > b * 1.7) & (r > 60)
for name, col in (('player_home', (0.16, 0.24, 0.55)), ('player_away', (0.93, 0.93, 0.9))):
    O = A.copy(); lum = (r * 0.6 + g * 0.2 + b * 0.2) / 140.0
    for c in range(3): O[..., c] = np.where(red, np.clip(lum * col[c] * 255 * (1.6 if col[0] > 0.5 else 1.0), 0, 255), A[..., c])
    buf = io.BytesIO(); Image.fromarray(O.astype(np.uint8)).save(buf, 'JPEG', quality=85)
    add_mesh(name, NP, normals(NP, NI), UV[orig], NI, buf.getvalue(), targets)

while len(out_bin) % 4: out_bin.append(0)
g = {'asset': {'version': '2.0', 'generator': 'tools/crowd_glb.py'}, 'scene': 0, 'scenes': [{'nodes': list(range(len(gnodes)))}], 'nodes': gnodes, 'meshes': meshes, 'materials': mats,
     'textures': [{'source': i, 'sampler': 0} for i in range(len(imgs))], 'images': imgs, 'samplers': [{}], 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(out_bin)}]}
for m in mats: m['pbrMetallicRoughness']['baseColorTexture']['index'] = mats.index(m)
js = json.dumps(g, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
open(DST, 'wb').write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(out_bin)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out_bin), 0x004E4942) + bytes(out_bin))
print(DST, round((28 + len(js) + len(out_bin)) / 1e6, 2), 'MB')
