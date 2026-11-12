# Re-pack a downloaded glTF binary for the headset: textures re-encoded (JPEG unless they need alpha, optional downscale),
# the old specular-glossiness materials (no longer read by three.js) turned into metal-roughness, animations dropped.
# usage: python3 tools/pack_glb.py in.glb out.glb [max_texture_px]
import json, struct, io, sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]; MAX = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
d = open(src, 'rb').read(); L = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + L]); b0 = 20 + L + 8
B = d[b0:b0 + struct.unpack('<I', d[20 + L:24 + L])[0]]
for m in j.get('materials', []):
    sg = m.get('extensions', {}).pop('KHR_materials_pbrSpecularGlossiness', None)
    if sg is not None:
        pb = m.setdefault('pbrMetallicRoughness', {})
        if 'diffuseTexture' in sg: pb['baseColorTexture'] = sg['diffuseTexture']
        if 'diffuseFactor' in sg: pb['baseColorFactor'] = sg['diffuseFactor']
        pb['metallicFactor'] = 0.0; pb['roughnessFactor'] = 0.75
    if not m.get('extensions'): m.pop('extensions', None)
for key in ('extensionsUsed', 'extensionsRequired'):
    if key in j:
        keep = [e for e in j[key] if e != 'KHR_materials_pbrSpecularGlossiness']
        if keep: j[key] = keep
        else: del j[key]
drop = set()
for a in j.get('animations', []):
    for s in a['samplers']: drop.add(j['accessors'][s['input']]['bufferView']); drop.add(j['accessors'][s['output']]['bufferView'])
j.pop('animations', None)
newimg = {}
for im in j.get('images', []):
    bv = j['bufferViews'][im['bufferView']]; o = bv.get('byteOffset', 0); img = Image.open(io.BytesIO(B[o:o + bv['byteLength']]))
    alpha = img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info)
    if alpha and img.convert('RGBA').getchannel('A').getextrema()[0] > 250: alpha = False
    if max(img.size) > MAX: s = MAX / max(img.size); img = img.resize((max(1, int(img.size[0] * s)), max(1, int(img.size[1] * s))), Image.LANCZOS)
    buf = io.BytesIO()
    if alpha: img.convert('RGBA').save(buf, 'PNG', optimize=True); im['mimeType'] = 'image/png'
    else: img.convert('RGB').save(buf, 'JPEG', quality=86); im['mimeType'] = 'image/jpeg'
    newimg[im['bufferView']] = buf.getvalue()
out = bytearray()
for k, bv in enumerate(j['bufferViews']):
    o = bv.get('byteOffset', 0); data = b'' if k in drop else newimg.get(k, B[o:o + bv['byteLength']])
    while len(out) % 4: out.append(0)
    bv['byteOffset'] = len(out); bv['byteLength'] = max(len(data), 0); out += data
while len(out) % 4: out.append(0)
j['buffers'][0]['byteLength'] = len(out)
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
open(dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out))
print(dst, round(len(out) / 1e6, 2), 'MB')
