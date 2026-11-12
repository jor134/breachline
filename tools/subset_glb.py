# Keep only some nodes of a glTF binary (their subtrees and the path from the root), drop everything else they don't use.
# usage: python3 tools/subset_glb.py in.glb out.glb 'regex1' ['regex2' ...]   (regexes match node names)
import json, struct, sys, re
src, dst, pats = sys.argv[1], sys.argv[2], [re.compile(p) for p in sys.argv[3:]]
d = open(src, 'rb').read(); L = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + L]); b0 = 20 + L + 8
B = d[b0:b0 + struct.unpack('<I', d[20 + L:24 + L])[0]]
N = j['nodes']; par = {c: i for i, n in enumerate(N) for c in n.get('children', [])}
keep = set()
def sub(i):
    keep.add(i)
    for c in N[i].get('children', []): sub(c)
for i, n in enumerate(N):
    if any(p.search(n.get('name', '')) for p in pats):
        sub(i); k = i
        while k in par: k = par[k]; keep.add(k)
for s in j.get('skins', []):   # a kept skinned mesh needs its whole skeleton
    pass
nmap = {o: k for k, o in enumerate(sorted(keep))}
nodes = []
for o in sorted(keep):
    n = dict(N[o]); 
    if 'children' in n: n['children'] = [nmap[c] for c in n['children'] if c in keep]; n['children'] or n.pop('children')
    nodes.append(n)
used_mesh = sorted({n['mesh'] for n in nodes if 'mesh' in n}); mmap = {o: k for k, o in enumerate(used_mesh)}
for n in nodes:
    if 'mesh' in n: n['mesh'] = mmap[n['mesh']]
meshes = [j['meshes'][o] for o in used_mesh]
used_mat = sorted({p['material'] for m in meshes for p in m['primitives'] if 'material' in p}); matmap = {o: k for k, o in enumerate(used_mat)}
mats = [j['materials'][o] for o in used_mat]
texrefs = []
def walk(o):
    if isinstance(o, dict):
        if 'index' in o and set(o) & {'texCoord', 'index'} and len(o) <= 4: texrefs.append(o)
        for v in o.values(): walk(v)
    elif isinstance(o, list):
        for v in o: walk(v)
walk(mats)
used_tex = sorted({t['index'] for t in texrefs}); tmap = {o: k for k, o in enumerate(used_tex)}
for t in texrefs: t['index'] = tmap[t['index']]
texs = [dict(j['textures'][o]) for o in used_tex]
used_img = sorted({t['source'] for t in texs}); imap = {o: k for k, o in enumerate(used_img)}
for t in texs: t['source'] = imap[t['source']]
imgs = [dict(j['images'][o]) for o in used_img]
acc_used = set()
for m in meshes:
    for p in m['primitives']:
        p['material'] = matmap.get(p.get('material'), 0) if 'material' in p else p.pop('material', None) or 0
        acc_used |= set(p['attributes'].values());
        if 'indices' in p: acc_used.add(p['indices'])
        for t in p.get('targets', []): acc_used |= set(t.values())
skins = []
for n in nodes:
    if 'skin' in n:
        s = dict(j['skins'][n['skin']]); s['joints'] = [nmap[x] for x in s['joints'] if x in nmap]
        if 'inverseBindMatrices' in s: acc_used.add(s['inverseBindMatrices'])
        n['skin'] = len(skins); skins.append(s)
amap = {o: k for k, o in enumerate(sorted(acc_used))}; accs = [dict(j['accessors'][o]) for o in sorted(acc_used)]
for m in meshes:
    for p in m['primitives']:
        p['attributes'] = {k: amap[v] for k, v in p['attributes'].items()}
        if 'indices' in p: p['indices'] = amap[p['indices']]
for s in skins:
    if 'inverseBindMatrices' in s: s['inverseBindMatrices'] = amap[s['inverseBindMatrices']]
# every kept accessor gets its own tight buffer view (source files often pack all meshes into a few huge views)
CS = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
out = bytearray(); bvs = []
def put(data, extra):
    while len(out) % 4: out.append(0)
    bv = dict(extra); bv['buffer'] = 0; bv['byteOffset'] = len(out); bv['byteLength'] = len(data); out.extend(data); bvs.append(bv); return len(bvs) - 1
for a in accs:
    if 'bufferView' not in a: continue
    sv = j['bufferViews'][a['bufferView']]; es = CS[a['componentType']] * NC[a['type']]; st = sv.get('byteStride', es); o = sv.get('byteOffset', 0) + a.get('byteOffset', 0)
    data = B[o:o + st * (a['count'] - 1) + es]; extra = {k: sv[k] for k in ('target',) if k in sv}
    if st != es: extra['byteStride'] = st
    a['bufferView'] = put(data, extra); a['byteOffset'] = 0
for im in imgs:
    sv = j['bufferViews'][im['bufferView']]; o = sv.get('byteOffset', 0); im['bufferView'] = put(B[o:o + sv['byteLength']], {})
while len(out) % 4: out.append(0)
roots = [nmap[r] for r in j['scenes'][j.get('scene', 0)]['nodes'] if r in nmap]
J = {'asset': j['asset'], 'scene': 0, 'scenes': [{'nodes': roots}], 'nodes': nodes, 'meshes': meshes, 'materials': mats, 'textures': texs, 'images': imgs, 'accessors': accs, 'bufferViews': bvs, 'buffers': [{'byteLength': len(out)}]}
if 'samplers' in j: J['samplers'] = j['samplers']
if skins: J['skins'] = skins
for k in ('extensionsUsed', 'extensionsRequired'):
    if k in j: J[k] = j[k]
js = json.dumps(J, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
open(dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out))
print(dst, len(nodes), 'nodes', len(meshes), 'meshes', round(len(out) / 1e6, 2), 'MB')
