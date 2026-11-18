# Turn the "Pistol 9mm Custom" Sketchfab scene (a display of two assembled pistols, exploded parts and attachments) into the
# sidearm: only the upright assembled pistol is kept (frame, slide, magazine, red dot on its rail, weapon light, side laser; the
# suppressor is left off), baked to one frame (muzzle toward -z, y up, metres), one mesh per part and material, textures
# re-encoded small. Parts are named for js/m4.js: slide, frame, mag, sight, light.
# usage: python3 tools/pistol9_glb.py in.glb assets-src/pistol9.glb   (then tools/obf_glb.py to public/models/pistol/pistol9.blx)
import sys, io, json, struct
import numpy as np
from PIL import Image
CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
src, dst = sys.argv[1], sys.argv[2]
d = open(src, 'rb').read(); L = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + L]); b0 = 20 + L + 8
def acc(i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]; dt = CT[a['componentType']]; n = NC[a['type']]
    off = b0 + bv.get('byteOffset', 0) + a.get('byteOffset', 0); stride = bv.get('byteStride', 0); isz = np.dtype(dt).itemsize * n
    if stride and stride != isz: return np.frombuffer(d, np.uint8, a['count'] * stride, off).reshape(a['count'], stride)[:, :isz].copy().view(dt).reshape(a['count'], n)
    return np.frombuffer(d, dt, a['count'] * n, off).reshape(a['count'], n).astype(np.float32 if dt == np.float32 else np.uint32)
def mat(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4, 4).T
    t = n.get('translation', [0, 0, 0]); x, y, z, w = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
    R = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
    M = np.eye(4); M[:3, :3] = R * s; M[:3, 3] = t; return M
par = {c: i for i, n in enumerate(j['nodes']) for c in n.get('children', [])}; W = {}
def world(i):
    if i not in W: W[i] = (world(par[i]) @ mat(j['nodes'][i])) if i in par else mat(j['nodes'][i])
    return W[i]
# which part a node belongs to (by its parent's name); None = dropped
def part(name):
    base, _, num = name.partition('.'); k = int(num) if num else 0
    if base == 'CustomPistol9mm' and k <= 22: return 'slide' if k in (0, 6, 7, 12, 13, 18) else 'frame'
    if base == 'Magazine9mm' and k <= 3: return 'mag'
    if base == 'AIM' and k <= 19: return 'sight'
    if base == 'PicatinyBracing1' and k <= 6: return 'sight'
    if base == 'Fleshlight1' and k <= 10: return 'light'
    if base == 'LaserBlock' and k <= 7: return 'frame'
    return None
groups = {}   # (part, material) -> lists
for i, n in enumerate(j['nodes']):
    if 'mesh' not in n or i not in par: continue
    p = part(j['nodes'][par[i]]['name'])
    if not p: continue
    M = world(i); Nm = np.linalg.inv(M[:3, :3]).T
    for pr in j['meshes'][n['mesh']]['primitives']:
        P = acc(pr['attributes']['POSITION']).astype(np.float32); Nn = acc(pr['attributes']['NORMAL']).astype(np.float32) if 'NORMAL' in pr['attributes'] else np.zeros_like(P)
        UV = acc(pr['attributes']['TEXCOORD_0']).astype(np.float32) if 'TEXCOORD_0' in pr['attributes'] else np.zeros((len(P), 2), np.float32)
        I = acc(pr['indices']).reshape(-1).astype(np.uint32) if 'indices' in pr else np.arange(len(P), dtype=np.uint32)
        Pw = (np.c_[P, np.ones(len(P))] @ M.T)[:, :3]; Nw = Nn @ Nm.T; Nw /= np.maximum(1e-9, np.linalg.norm(Nw, axis=1, keepdims=True))
        g = groups.setdefault((p, pr.get('material', 0)), [[], [], [], [], 0]); g[0].append(Pw); g[1].append(Nw); g[2].append(UV); g[3].append(I + g[4]); g[4] += len(P)
# frame: the assembled pistol already has its muzzle toward -z; centre it on the bore line at x = 0
allP = np.vstack([np.vstack(g[0]) for g in groups.values()]); body = np.vstack([np.vstack(g[0]) for (p, mi), g in groups.items() if p == 'frame' and j['materials'][mi]['name'] == 'CustomPistol9mm']); cx = (body[:, 0].min() + body[:, 0].max()) / 2
# images: re-encode, capped (pistol body 1024, attachments 512); alpha kept only where the material blends
out_bin = bytearray(); views = []; accs = []; imgs = []; texs = []; mats = []; matmap = {}; imgmap = {}
def view(data, target=None):
    while len(out_bin) % 4: out_bin.append(0)
    views.append({'buffer': 0, 'byteOffset': len(out_bin), 'byteLength': len(data), **({'target': target} if target else {})}); out_bin.extend(data); return len(views) - 1
def image(idx, cap, alpha):
    key = (idx, cap, alpha)
    if key in imgmap: return imgmap[key]
    im = j['images'][idx]; bv = j['bufferViews'][im['bufferView']]; raw = d[b0 + bv.get('byteOffset', 0): b0 + bv.get('byteOffset', 0) + bv['byteLength']]
    pic = Image.open(io.BytesIO(raw)); pic.thumbnail((cap, cap), Image.LANCZOS); buf = io.BytesIO()
    if alpha: pic.convert('RGBA').save(buf, 'PNG', optimize=True); mime = 'image/png'
    else: pic.convert('RGB').save(buf, 'JPEG', quality=85, optimize=True); mime = 'image/jpeg'
    imgs.append({'bufferView': view(buf.getvalue()), 'mimeType': mime}); texs.append({'source': len(imgs) - 1, 'sampler': 0}); imgmap[key] = len(texs) - 1; return imgmap[key]
def material(mi, body):
    if mi in matmap: return matmap[mi]
    m = json.loads(json.dumps(j['materials'][mi])); cap = 1024 if body else 512; blend = m.get('alphaMode') == 'BLEND'
    def fix(t, alpha=False):
        if t and 'index' in t: t['index'] = image(j['textures'][t['index']]['source'], cap, alpha); t.pop('texCoord', None)
    pb = m.get('pbrMetallicRoughness', {}); fix(pb.get('baseColorTexture'), blend); fix(pb.get('metallicRoughnessTexture')); fix(m.get('normalTexture')); fix(m.get('occlusionTexture')); fix(m.get('emissiveTexture'))
    m.pop('extensions', None); mats.append(m); matmap[mi] = len(mats) - 1; return matmap[mi]
nodes = []; meshes = []
for (p, mi), g in sorted(groups.items()):
    P = np.vstack(g[0]); P[:, 0] -= cx; Nn = np.vstack(g[1]).astype(np.float32); UV = np.vstack(g[2]).astype(np.float32); I = np.concatenate(g[3]).astype(np.uint32)
    a0 = len(accs); accs.append({'bufferView': view(P.astype(np.float32).tobytes(), 34962), 'componentType': 5126, 'count': len(P), 'type': 'VEC3', 'min': P.min(0).tolist(), 'max': P.max(0).tolist()})
    accs.append({'bufferView': view(Nn.tobytes(), 34962), 'componentType': 5126, 'count': len(P), 'type': 'VEC3'})
    accs.append({'bufferView': view(UV.tobytes(), 34962), 'componentType': 5126, 'count': len(P), 'type': 'VEC2'})
    accs.append({'bufferView': view(I.tobytes(), 34963), 'componentType': 5125, 'count': len(I), 'type': 'SCALAR'})
    meshes.append({'name': p, 'primitives': [{'attributes': {'POSITION': a0, 'NORMAL': a0 + 1, 'TEXCOORD_0': a0 + 2}, 'indices': a0 + 3, 'material': material(mi, p in ('frame', 'slide'))}]})
    nodes.append({'name': p, 'mesh': len(meshes) - 1}); print(p, j['materials'][mi]['name'], len(P), 'verts', len(I) // 3, 'tris')
out = {'asset': {'version': '2.0', 'generator': 'tools/pistol9_glb.py', 'extras': j['asset'].get('extras', {})}, 'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes,
       'materials': mats, 'textures': texs, 'images': imgs, 'samplers': [{'magFilter': 9729, 'minFilter': 9987}], 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(out_bin)}]}
while len(out_bin) % 4: out_bin.append(0)
out['buffers'][0]['byteLength'] = len(out_bin)
js = json.dumps(out, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
open(dst, 'wb').write(b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(out_bin)) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(out_bin)) + b'BIN\0' + bytes(out_bin))
print('bounds', np.round(allP.min(0) - [cx, 0, 0], 3), np.round(allP.max(0) - [cx, 0, 0], 3))
