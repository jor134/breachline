# The semi truck ("semi truck" by zairiqzairiq, CC BY 4.0) for the terminal and Grand Prix maps. Run on tools/pack_glb.py's output.
# - the trailer's box (its four printed sides: a haulier's livery) is dropped: the game puts a shipping container or a team's
#   own trailer on the chassis instead
# - the cab's paint is made white, its lettering and logos painted out (the windows kept), so the game can paint each cab
# - the maker's badge under the grille is cropped off
# usage: python3 tools/pack_glb.py semi_truck.glb /tmp/t.glb 512 && python3 tools/truck_glb.py /tmp/t.glb public/models/truck/truck.glb
import sys, json, struct, io
import numpy as np
from PIL import Image, ImageFilter
src, dst = sys.argv[1], sys.argv[2]
d = open(src, 'rb').read(); L = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + L]); B = d[20 + L + 8:20 + L + 8 + struct.unpack('<I', d[20 + L:24 + L])[0]]
DROP = {'semiside_sub', 'semifront_sub', 'semiback_sub', 'semitrrf_sub'}
PAINT = {'semiorg_sub', 'semiwin_sub', 'semisideb_sub', 'semisidecb_sub', 'semisidec2_sub', 'semicabb2_sub'}
def img_of(mi):
    t = j['materials'][mi]['pbrMetallicRoughness'].get('baseColorTexture'); return None if t is None else j['textures'][t['index']]['source']
def read(ii):
    bv = j['bufferViews'][j['images'][ii]['bufferView']]; o = bv.get('byteOffset', 0); return Image.open(io.BytesIO(B[o:o + bv['byteLength']])).convert('RGB')
new = {}
for mi, m in enumerate(j['materials']):
    ii = img_of(mi)
    if ii is None or ii in new: continue
    if m['name'] in PAINT:
        a = np.asarray(read(ii), np.float32) / 255; v = a.max(2)
        dark = Image.fromarray(((v < 0.3) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))   # big dark areas (windows) only, not lettering; holes in them filled
        win = np.asarray(dark) > 0; out = np.full_like(a, 0.93); out[win] = a[win]
        new[ii] = Image.fromarray((out * 255).astype(np.uint8))
    elif m['name'] == 'semigrill_sub':
        im = read(ii); w, h = im.size; new[ii] = im.crop((0, 0, w, int(h * 0.8))).resize((w, h))
# drop the trailer box nodes
for nd in j['nodes']:
    if nd.get('children'): nd['children'] = [c for c in nd['children'] if not ('mesh' in j['nodes'][c] and j['materials'][j['meshes'][j['nodes'][c]['mesh']]['primitives'][0]['material']]['name'] in DROP)]
for m in j['materials']:
    if m['name'] in PAINT: m['name'] = 'paint'
# rebuild the binary with the changed images
out = bytearray(); views = []
for k, bv in enumerate(j['bufferViews']):
    o = bv.get('byteOffset', 0); data = B[o:o + bv['byteLength']]
    for ii, im in enumerate(j['images']):
        if im['bufferView'] == k and ii in new: f = io.BytesIO(); new[ii].save(f, 'JPEG', quality=88); data = f.getvalue(); im['mimeType'] = 'image/jpeg'
    while len(out) % 4: out.append(0)
    nb = dict(bv); nb['byteOffset'] = len(out); nb['byteLength'] = len(data); out.extend(data); views.append(nb)
while len(out) % 4: out.append(0)
j['bufferViews'] = views; j['buffers'] = [{'byteLength': len(out)}]
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
open(dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out))
print('written', dst, len(out) // 1024, 'KB')
