# The club's dancers and its DJ, baked for the headset (like tools/crowd_glb.py's fans): each person is posed at K moments of a
# dance (skinning done here), simplified once (the same vertices kept in every pose) and written as one mesh whose base is the
# first pose and whose morph targets are the others; the game plays them on instanced meshes (one draw per person), two poses
# blended at a time, forwards then back.
#   - the four people of "Background People for Blender promo" (Jungle Jim, CC BY 4.0) have no dance of their own: they get the
#     two dances below retargeted onto their skeleton (Character Creator bones; each bone takes the source bone's turn from its
#     rest pose, after lining the two rest poses' limbs up, so a T-pose source drives an A-pose body)
#   - "Belly Dance" (zhuoyi0904, CC BY 4.0, a Mixamo dance): the dancer herself, in her own dance
#   - "Dancing girl" (wk1978, CC BY 4.0, Mixamo): the DJ, in her own dance; also the second dance for the crowd
# Output frame: metres, y up, feet on y = 0, facing +z.
#   - "Samba Dancing" (reizibarrientos, CC BY 4.0): a dancer in her own samba; the samba also for the crowd
#   - "Gina Dancing" (Drachengeifer, CC BY 4.0, Mixamo): a dancer in her own dance; the dance also for the crowd
#   - "Tifa dancing" (PainMcpainful, CC BY 4.0, Mixamo): ONLY its dance, for the crowd. The model is a well-known video-game
#     character (someone else's intellectual property, whatever the uploader's licence says), so she never appears in the game
#   python3 tools/dancers_glb.py people.glb belly_dance.glb dancing_girl.glb samba.glb tifa.glb gina.glb out.glb
import sys, io, json, struct, subprocess, os, re, tempfile
import numpy as np
from PIL import Image

PEOPLE, BELLY, GIRL, SAMBA, TIFA, GINA, DST = sys.argv[1:8]
K = int(os.environ.get('K', '32')); STEP = float(os.environ.get('STEP', '0.2')); TRIS = int(os.environ.get('TRIS', '2400')); DJ_TRIS = int(os.environ.get('DJ_TRIS', '9000')); HI_TRIS = int(os.environ.get('HI_TRIS', '9000')); TEX = 512   # near: every dancer at up to HI_TRIS, far at TRIS
QEM = os.environ.get('QEM', '/tmp/qem')
CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

class GLB:
    def __init__(s, path):
        d = open(path, 'rb').read(); L = struct.unpack('<I', d[12:16])[0]; s.j = json.loads(d[20:20 + L]); s.B = d[28 + L:]
        s.nodes = s.j['nodes']; s.parent = {c: i for i, n in enumerate(s.nodes) for c in n.get('children', [])}
        s.chan = {}
        if s.j.get('animations'):
            an = s.j['animations'][0]
            for c in an['channels']:
                sm = an['samplers'][c['sampler']]; s.chan[(c['target']['node'], c['target']['path'])] = (s.acc(sm['input'])[:, 0], s.acc(sm['output']), sm.get('interpolation', 'LINEAR'))
            s.T = max(v[0][-1] for v in s.chan.values())
    def acc(s, i):
        a = s.j['accessors'][i]; bv = s.j['bufferViews'][a['bufferView']]; dt = CT[a['componentType']]; n = NC[a['type']]; o = bv.get('byteOffset', 0) + a.get('byteOffset', 0); st = bv.get('byteStride', 0); isz = np.dtype(dt).itemsize * n
        r = np.frombuffer(np.frombuffer(s.B, np.uint8, a['count'] * st, o).reshape(a['count'], st)[:, :isz].tobytes(), dt).reshape(a['count'], n) if st and st != isz else np.frombuffer(s.B, dt, a['count'] * n, o).reshape(a['count'], n)
        r = r.copy()
        if a.get('normalized') and dt != np.float32: r = r.astype(np.float32) / np.iinfo(dt).max
        return r
    def sample(s, ni, path, t, default):
        if (ni, path) not in s.chan: return np.array(default, float)
        T, V, it = s.chan[(ni, path)]
        if it == 'CUBICSPLINE': V = V.reshape(len(T), 3, -1)[:, 1]
        if t <= T[0]: return V[0].astype(float)
        if t >= T[-1]: return V[-1].astype(float)
        k = np.searchsorted(T, t) - 1; u = (t - T[k]) / max(1e-9, T[k + 1] - T[k]); a, b = V[k].astype(float), V[k + 1].astype(float)
        if it == 'STEP': return a
        if path == 'rotation':
            if np.dot(a, b) < 0: b = -b
            q = a * (1 - u) + b * u; return q / np.linalg.norm(q)
        return a * (1 - u) + b * u
    def local(s, i, t=None):
        n = s.nodes[i]
        if 'matrix' in n and (t is None or not any((i, p) in s.chan for p in ('translation', 'rotation', 'scale'))): return np.array(n['matrix']).reshape(4, 4).T
        tr, ro, sc = n.get('translation', [0, 0, 0]), n.get('rotation', [0, 0, 0, 1]), n.get('scale', [1, 1, 1])
        if t is not None: tr, ro, sc = s.sample(i, 'translation', t, tr), s.sample(i, 'rotation', t, ro), s.sample(i, 'scale', t, sc)
        return trs(tr, ro, sc)
    def worlds(s, t=None, override=None):
        W = {}
        def w(i):
            if i in W: return W[i]
            L = override[i] if override and i in override else s.local(i, t)
            W[i] = (w(s.parent[i]) @ L) if i in s.parent else L; return W[i]
        for i in range(len(s.nodes)): w(i)
        return W
    def image(s, ti, px=TEX):
        im = s.j['images'][s.j['textures'][ti]['source']]; bv = s.j['bufferViews'][im['bufferView']]; o = bv.get('byteOffset', 0)
        img = Image.open(io.BytesIO(s.B[o:o + bv['byteLength']])).convert('RGB')
        if max(img.size) > px: f = px / max(img.size); img = img.resize((max(1, int(img.size[0] * f)), max(1, int(img.size[1] * f))), Image.LANCZOS)
        return img

def qmat(q):
    x, y, z, w = q; return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
def trs(t, r, s):
    M = np.eye(4); M[:3, :3] = qmat(r) * np.array(s)[None, :]; M[:3, 3] = t; return M
def rot_of(M):   # rotation part of a matrix with (near) uniform scale
    R = M[:3, :3]; return R / np.cbrt(abs(np.linalg.det(R)))
def align(a, b):  # rotation taking unit vector a onto b
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b); v = np.cross(a, b); c = np.dot(a, b)
    if c < -0.9999: p = np.array([1, 0, 0]) if abs(a[0]) < 0.9 else np.array([0, 1, 0]); v = np.cross(a, p); v /= np.linalg.norm(v); return 2 * np.outer(v, v) - np.eye(3)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]]); return np.eye(3) + vx + vx @ vx / (1 + c)

def skin_pose(g, ni, W):
    """every primitive of mesh node ni, posed by joint world matrices W: [(material, P, UV, I)]"""
    n = g.nodes[ni]; sk = g.j['skins'][n['skin']]; IBM = g.acc(sk['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    M = np.stack([W[jn] @ IBM[q] for q, jn in enumerate(sk['joints'])]); out = []
    for p in g.j['meshes'][n['mesh']]['primitives']:
        at = p['attributes']; P = g.acc(at['POSITION']).astype(float); J = g.acc(at['JOINTS_0']).astype(int); Wt = g.acc(at['WEIGHTS_0']).astype(float); Wt /= np.maximum(1e-9, Wt.sum(1, keepdims=True))
        Ph = np.c_[P, np.ones(len(P))]; S = np.zeros((len(P), 4))
        for c in range(4): S += Wt[:, c:c + 1] * np.einsum('nij,nj->ni', M[J[:, c]], Ph)
        out.append((p.get('material', 0), S[:, :3], g.acc(at['TEXCOORD_0']) if 'TEXCOORD_0' in at else np.zeros((len(P), 2)), g.acc(p['indices']).reshape(-1, 3)))
    return out

def simplify(P, I, target, UV=None, seams=True):
    if target >= len(I): return I, np.arange(len(P))
    # true duplicates (same point, same texture spot: a mesh exported with split faces) are welded first, so they simplify as one
    if UV is not None:
        key = np.c_[np.round(P / 1e-5), np.round(UV / 1e-5)].astype(np.int64); _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
        inv = inv.reshape(-1); NI, o = simplify(P[first], inv[I], target, None, seams); return NI, first[o]
    with tempfile.TemporaryDirectory() as t:
        fi, fo = os.path.join(t, 'i.bin'), os.path.join(t, 'o.bin')
        # seams: a point split into two vertices (two textures, two parts, a UV cut) is locked, so neither side can pull away from it
        # and open a crack (the holes in the dancers); everything else is simplified as before
        key = np.round(P / 1e-5).astype(np.int64); _, inv, cnt = np.unique(key, axis=0, return_inverse=True, return_counts=True); lock = (cnt[inv.reshape(-1)] > 1).astype(np.uint8) if seams else np.zeros(len(P), np.uint8)
        with open(fi, 'wb') as f: f.write(struct.pack('<ii', len(P), len(I))); f.write(P.astype(np.float64).tobytes()); f.write(I.astype(np.int32).tobytes()); f.write(lock.tobytes())
        subprocess.run([QEM, fi, fo, str(target), 'keep', 'lock'], check=True, stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
        o = open(fo, 'rb').read(); mv, mt = struct.unpack('<ii', o[:8]); q = 8 + mv * 24; NI = np.frombuffer(o, np.int32, mt * 3, q).reshape(mt, 3); q += mt * 12; orig = np.frombuffer(o, np.int32, mv, q)
        return NI, orig
def normals(P, I):
    N = np.zeros_like(P); f = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]])
    for k in range(3): np.add.at(N, I[:, k], f)
    return (N / np.maximum(1e-9, np.linalg.norm(N, axis=1, keepdims=True))).astype(np.float32)

def atlas(images):   # pack a person's textures into one grid (so a person is one mesh, one draw); returns image, uv cells
    n = len(images); cols = int(np.ceil(np.sqrt(n))); rows = int(np.ceil(n / cols)); cell = 1024 // max(cols, rows)
    out = Image.new('RGB', (cols * cell, rows * cell)); cells = []
    for k, im in enumerate(images):
        cx, cy = k % cols, k // cols; out.paste(im.resize((cell, cell), Image.LANCZOS), (cx * cell, cy * cell)); cells.append((cx / cols, cy / rows, 1 / cols, 1 / rows))
    return out, cells
def remap(uv, c):   # a texture's own 0..1 into its cell of the atlas
    u, v = np.mod(uv[:, 0], 1.0), np.mod(uv[:, 1], 1.0); return np.c_[c[0] + u * c[2], c[1] + v * c[3]]
def bake(g, ni, frames, target, height, keep=lambda name: True, name='?'):
    """frames: list of joint-world dicts. -> base P, NI, UV, targets, jpeg"""
    posed = [skin_pose(g, ni, W) for W in frames]
    mats = g.j['materials']; parts = [k for k, (mi, P, UV, I) in enumerate(posed[0]) if keep(mats[mi].get('name', ''))]
    imgs, mlist = [], []
    for k in parts:
        mi = posed[0][k][0]; pbr = mats[mi].get('pbrMetallicRoughness', {})
        if 'baseColorTexture' in pbr: imgs.append(g.image(pbr['baseColorTexture']['index'], 512))
        else: c = [int(255 * v) for v in pbr.get('baseColorFactor', [0.6, 0.6, 0.6])[:3]]; imgs.append(Image.new('RGB', (16, 16), tuple(c)))
    img, rects = atlas(imgs)
    Ps = [np.vstack([posed[f][k][1] for k in parts]) for f in range(len(frames))]
    UV = np.vstack([remap(posed[0][k][2], rects[q]) for q, k in enumerate(parts)])
    off = np.cumsum([0] + [len(posed[0][k][1]) for k in parts]); I = np.vstack([posed[0][k][3] + off[q] for q, k in enumerate(parts)])
    poses = np.stack(Ps)
    # our frame: y up (z-up sources turned), feet on the floor, centred, scaled to the person's height
    lo, hi = poses[0].min(0), poses[0].max(0)
    if (hi - lo)[2] > (hi - lo)[1] * 1.5: poses = poses[:, :, [0, 2, 1]] * np.array([1, 1, -1])
    c = poses[0].mean(0); poses -= np.array([c[0], poses[0][:, 1].min(), c[2]]); poses *= height / poses[0][:, 1].max()
    # weld coincident vertices for the simplifier (UV seams), keep the first of each
    buf = io.BytesIO(); img.save(buf, 'JPEG', quality=85); res = []
    for tg in (target if isinstance(target, (list, tuple)) else [target]):
        NI, orig = simplify(poses[0], I, tg, UV); print(f'{name:12s} {len(NI):6d} tris {len(orig):6d} verts {len(frames)} poses  texture {img.size}')
        res.append((poses[:, orig], NI, UV[orig], buf.getvalue()))
    return res

# ---- the source dances (Mixamo) ----
def key(name): return re.sub(r'_Reference$', '', re.sub(r'_\d+$', '', name.split(':')[-1]))   # Mixamo 'mixamorig:LeftArm_09', mocap 'LeftArm_Reference'
belly, girl, people, samba, tifa, gina = GLB(BELLY), GLB(GIRL), GLB(PEOPLE), GLB(SAMBA), GLB(TIFA), GLB(GINA)
def own_frames(g, t0=0.0):
    return [g.worlds(t0 + k * STEP) for k in range(K)]
MAP = {'Hips': 'Hip', 'Spine': 'Waist', 'Spine1': 'Spine01', 'Spine2': 'Spine02', 'Neck': 'NeckTwist01', 'Head': 'Head'}
for sd, cc in (('Left', 'L'), ('Right', 'R')):
    MAP.update({sd + 'Shoulder': cc + '_Clavicle', sd + 'Arm': cc + '_Upperarm', sd + 'ForeArm': cc + '_Forearm', sd + 'Hand': cc + '_Hand',
                sd + 'UpLeg': cc + '_Thigh', sd + 'Leg': cc + '_Calf', sd + 'Foot': cc + '_Foot', sd + 'ToeBase': cc + '_ToeBase'})
CHILD = {'Hips': 'Spine', 'Spine': 'Spine1', 'Spine1': 'Spine2', 'Spine2': 'Neck', 'Neck': 'Head'}
for sd in ('Left', 'Right'): CHILD.update({sd + 'Shoulder': sd + 'Arm', sd + 'Arm': sd + 'ForeArm', sd + 'ForeArm': sd + 'Hand', sd + 'UpLeg': sd + 'Leg', sd + 'Leg': sd + 'Foot', sd + 'Foot': sd + 'ToeBase'})
def retarget_frames(src, tgt, joints, t0=0.0):
    """joint-world matrices for target skeleton `joints` (node indices) following src's animation"""
    sidx = {}
    for i, n in enumerate(src.nodes):
        k = key(n.get('name', ''))
        if k in MAP and k not in sidx and ('mixamorig' in n.get('name', '') or n.get('name', '').endswith('_Reference')): sidx[k] = i
    tidx = {key(tgt.nodes[i].get('name', '')).replace('CC_Base_', ''): i for i in joints}
    pairs = {m: (sidx[m], tidx[c]) for m, c in MAP.items() if m in sidx and c in tidx}
    S0, T0 = src.worlds(), tgt.worlds()
    corr = {}
    for m, (si, ti) in pairs.items():   # line the rest limbs up: target rest bone direction -> source rest bone direction
        ch = CHILD.get(m)
        if ch and ch in pairs:
            ds = S0[pairs[ch][0]][:3, 3] - S0[si][:3, 3]; dt = T0[pairs[ch][1]][:3, 3] - T0[ti][:3, 3]
            corr[m] = align(dt, ds) if np.linalg.norm(ds) > 1e-6 and np.linalg.norm(dt) > 1e-6 else np.eye(3)
        else: corr[m] = np.eye(3)
    hs, ht = S0[pairs['Hips'][0]][:3, 3][1] - min(S0[pairs['LeftFoot'][0]][:3, 3][1], 0), T0[pairs['Hips'][1]][:3, 3][1] - T0[pairs['LeftFoot'][1]][:3, 3][1]
    ratio = ht / (S0[pairs['Hips'][0]][:3, 3][1] - S0[pairs['LeftFoot'][0]][:3, 3][1])
    order = sorted(joints, key=lambda i: depth(tgt, i)); frames = []
    for k in range(K):
        St = src.worlds(t0 + k * STEP); Rw = {}; W = {}
        for m, (si, ti) in pairs.items(): Rw[ti] = rot_of(St[si]) @ rot_of(S0[si]).T @ corr[m] @ rot_of(T0[ti])
        for i in order:   # walk down the target skeleton: mapped bones take their world turn, the rest keep their rest turn under their parent
            p = tgt.parent.get(i); Pw = W[p] if p in W else (T0[p] if p is not None else np.eye(4))
            Lr = tgt.local(i); sc = np.cbrt(abs(np.linalg.det(Lr[:3, :3])))
            pos = (Pw @ np.r_[Lr[:3, 3], 1])[:3]
            if i == pairs['Hips'][1]: pos = T0[i][:3, 3] + (St[pairs['Hips'][0]][:3, 3] - S0[pairs['Hips'][0]][:3, 3]) * ratio
            R = Rw[i] if i in Rw else rot_of(Pw) @ rot_of(Lr)
            M = np.eye(4); M[:3, :3] = R * np.cbrt(abs(np.linalg.det(Pw[:3, :3]))) * sc; M[:3, 3] = pos; W[i] = M
        full = dict(T0); full.update(W); frames.append(full)
    return frames
def depth(g, i):
    d = 0
    while i in g.parent: i = g.parent[i]; d += 1
    return d

out = []   # (name, P, NI, UV, jpeg)
def lod(name, r): out.append((name,) + r[0]); out.append((name + '_lo',) + r[1])   # near, far
# the four people, two dances between them
pn = [i for i, n in enumerate(people.nodes) if 'skin' in n]
NAMES = ['man1', 'man2', 'woman1', 'woman2']; DANCES = {'belly': (belly, 2.0), 'girl': (girl, 3.0), 'samba': (samba, 3.0), 'tifa': (tifa, 4.0), 'gina': (gina, 2.5)}
PLAN = [(0, 'belly'), (0, 'samba'), (1, 'girl'), (1, 'tifa'), (2, 'gina'), (2, 'samba'), (3, 'tifa')]   # person, dance
for k, dn in PLAN:
    ni = pn[k]; src, t0 = DANCES[dn]
    frames = retarget_frames(src, people, people.j['skins'][people.nodes[ni]['skin']]['joints'], t0=t0 + k * 0.7)
    lod(NAMES[k] + '_' + dn, bake(people, ni, frames, [HI_TRIS, TRIS], 1.78 if k < 2 else 1.66, name=NAMES[k] + '_' + dn))
# the belly dancer
bn = [i for i, n in enumerate(belly.nodes) if 'skin' in n][0]
skip = lambda m: not re.search(r'Eyebrow|Eyelash|Teeth', m)
bnodes = [i for i, n in enumerate(belly.nodes) if 'skin' in n]
def bake_many(g, nis, frames, target, height, keep, name, seams=True):
    mats = g.j['materials']; parts = []   # (posed per frame, material)
    for ni in nis:
        per = [skin_pose(g, ni, W) for W in frames]
        for k in range(len(per[0])):
            mi = per[0][k][0]
            if keep(mats[mi].get('name', '')): parts.append(([per[f][k] for f in range(len(frames))], mi))
    imgs, texk = [], {}
    for _, mi in parts:
        if mi in texk: continue
        pbr = mats[mi].get('pbrMetallicRoughness', {})
        imgs.append(g.image(pbr['baseColorTexture']['index'], 512) if 'baseColorTexture' in pbr else Image.new('RGB', (16, 16), tuple(int(255 * v) for v in pbr.get('baseColorFactor', [0.6, 0.6, 0.6])[:3])))
        texk[mi] = len(imgs) - 1
    img, rects = atlas(imgs)
    Ps = np.stack([np.vstack([pp[f][1] for pp, _ in parts]) for f in range(len(frames))])
    UV = np.vstack([remap(pp[0][2], rects[texk[mi]]) for pp, mi in parts])
    off = np.cumsum([0] + [len(pp[0][1]) for pp, _ in parts]); I = np.vstack([pp[0][3] + off[q] for q, (pp, _) in enumerate(parts)])
    lo, hi = Ps[0].min(0), Ps[0].max(0)
    if (hi - lo)[2] > (hi - lo)[1] * 1.5: Ps = Ps[:, :, [0, 2, 1]] * np.array([1, 1, -1])
    c = Ps[0].mean(0); Ps = Ps - np.array([c[0], Ps[0][:, 1].min(), c[2]]); Ps *= height / Ps[0][:, 1].max()
    buf = io.BytesIO(); img.save(buf, 'JPEG', quality=85); res = []
    for tg in (target if isinstance(target, (list, tuple)) else [target]):
        NI, orig = simplify(Ps[0], I, tg, UV if seams else None, seams); print(f'{name:12s} {len(NI):6d} tris {len(orig):6d} verts {len(frames)} poses  texture {img.size}')
        res.append((Ps[:, orig], NI, UV[orig], buf.getvalue()))
    return res
lod('belly', bake_many(belly, bnodes, own_frames(belly, 1.0), [HI_TRIS, TRIS], 1.68, skip, 'belly'))
for g2, nm, sk in ((samba, 'samba', lambda m: not re.search(r'Eye_trans', m)), (gina, 'gina', lambda m: True)):
    lod(nm, bake_many(g2, [i for i, n in enumerate(g2.nodes) if 'skin' in n], own_frames(g2, 2.0), [HI_TRIS, TRIS], 1.68, sk, nm))
gnodes = [i for i, n in enumerate(girl.nodes) if 'skin' in n]
gskip = lambda m: not re.search(r'Eyelash|Tear|Moisture|Mouth_Cavity|Teeth|nails', m)
out.append(('dj',) + bake_many(girl, gnodes, own_frames(girl, 0.5), DJ_TRIS, 1.68, gskip, 'dj', seams=False)[0])   # as she was before the seam welding (q62)

# ---- write ----
# Two files, each under the host's 25 MiB limit: the far meshes and the DJ (dancers.glb, everyone dancing as soon as it loads),
# and the near meshes (dancers-hi.glb, swapped in when it arrives). The dance poses are stored as 16-bit integers
# (KHR_mesh_quantization): each mesh's offsets are scaled into -1..1, and the scale (extras.morphScale) multiplies the pose weights.
def write(dst, items):
    ob = bytearray(); views = []; accs = []; meshes = []; mats = []; imgs = []; nodes = []
    def view(arr, target=None):
        while len(ob) % 4: ob.append(0)
        o = len(ob); ob.extend(arr.tobytes()); v = {'buffer': 0, 'byteOffset': o, 'byteLength': arr.nbytes}
        if target: v['target'] = target
        views.append(v); return len(views) - 1
    def add_acc(arr, ct, typ, target=34962, mm=False, norm=False, mmv=None):
        a = {'bufferView': view(arr, target), 'componentType': ct, 'count': len(arr), 'type': typ}
        if norm: a['normalized'] = True
        if mm: m = arr if mmv is None else mmv; a['min'] = m.min(0).tolist(); a['max'] = m.max(0).tolist()
        accs.append(a); return len(accs) - 1
    matOf = {}   # a dancer's meshes share one texture and material
    for name, P, NI, UV, jpg in items:
        if jpg not in matOf:
            imgs.append({'bufferView': view(np.frombuffer(jpg, np.uint8)), 'mimeType': 'image/jpeg'})
            mats.append({'name': name, 'pbrMetallicRoughness': {'baseColorTexture': {'index': len(imgs) - 1}, 'metallicFactor': 0.0, 'roughnessFactor': 0.8}, 'doubleSided': True}); matOf[jpg] = len(mats) - 1
        base = P[0].astype(np.float32); D = (P[1:] - P[0]).astype(np.float64); sc = float(np.abs(D).max()) or 1.0
        Q = np.clip(np.round(D / sc * 32767), -32767, 32767).astype(np.int16)
        pr = {'attributes': {'POSITION': add_acc(base, 5126, 'VEC3', mm=True), 'NORMAL': add_acc(normals(P[0], NI), 5126, 'VEC3'), 'TEXCOORD_0': add_acc(UV.astype(np.float32), 5126, 'VEC2')},
              'indices': add_acc(NI.astype(np.uint16 if len(base) < 65536 else np.uint32).ravel(), 5123 if len(base) < 65536 else 5125, 'SCALAR', 34963), 'material': matOf[jpg],
              'targets': [{'POSITION': add_acc(Q[f], 5122, 'VEC3', mm=True, norm=True, mmv=Q[f].astype(np.float64) / 32767)} for f in range(len(Q))]}
        meshes.append({'name': name, 'primitives': [pr], 'extras': {'morphScale': sc}}); nodes.append({'name': name, 'mesh': len(meshes) - 1})
    while len(ob) % 4: ob.append(0)
    g = {'asset': {'version': '2.0', 'generator': 'breachline tools/dancers_glb.py'}, 'extensionsUsed': ['KHR_mesh_quantization'], 'extensionsRequired': ['KHR_mesh_quantization'],
         'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes, 'materials': mats,
         'textures': [{'source': i, 'sampler': 0} for i in range(len(imgs))], 'images': imgs, 'samplers': [{}], 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(ob)}]}
    js = json.dumps(g, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
    open(dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(ob)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(ob), 0x004E4942) + bytes(ob))
    print(dst, round((28 + len(js) + len(ob)) / 1e6, 2), 'MB')
near = [o for o in out if not o[0].endswith('_lo') and o[0] != 'dj' and any(q[0] == o[0] + '_lo' for q in out)]
write(DST, [o for o in out if o not in near]); write(DST.replace('.glb', '-hi.glb'), near)
