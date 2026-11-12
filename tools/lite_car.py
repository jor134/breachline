# Lighter copy of the parked sports car (models/car/car.bin, see car.js for the format) by vertex clustering,
# with the body paint turned white so each parked copy can be tinted its own colour.
# usage: python3 tools/lite_car.py in.bin out.bin [cell_cm]
import json, struct, sys
import numpy as np
src, dst = sys.argv[1], sys.argv[2]; CELL = float(sys.argv[3]) / 100 if len(sys.argv) > 3 else 0.04
b = open(src, 'rb').read(); hl = struct.unpack('<I', b[:4])[0]; h = json.loads(b[4:4 + hl]); n = h['verts']; pad = lambda v: (v + 3) & ~3
o = 4 + hl; q = np.frombuffer(b, np.int16, n * 3, o).reshape(n, 3); o += pad(n * 6); nq = np.frombuffer(b, np.int8, n * 3, o).reshape(n, 3); o += pad(n * 3)
cq = np.frombuffer(b, np.uint8, n * 3, o).reshape(n, 3); o += pad(n * 3); idx = np.frombuffer(b, np.uint32, (len(b) - o) // 4, o)
k = h['scale'] * 4.4 / h['size'][2]; P = q.astype(np.float64) * k   # metres at a 4.4 m car
outQ, outN, outC, outI, groups = [], [], [], [], []; base = 0; ib = 0
for gi, (s, c) in enumerate(h['groups']):
    T = idx[s:s + c].reshape(-1, 3).astype(np.int64); used = np.unique(T)
    key = np.floor(P[used] / CELL).astype(np.int64); uk, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.reshape(-1)
    m = len(uk); remap = np.full(n, -1, np.int64); remap[used] = inv
    cnt = np.bincount(inv, minlength=m)[:, None]
    NP = np.zeros((m, 3)); np.add.at(NP, inv, P[used]); NP /= cnt
    NN = np.zeros((m, 3)); np.add.at(NN, inv, nq[used].astype(np.float64)); NN /= np.maximum(1e-6, np.linalg.norm(NN, axis=1))[:, None]
    NC = np.zeros((m, 3)); np.add.at(NC, inv, cq[used].astype(np.float64)); NC /= cnt
    if gi == 0: NC[:] = 255   # body paint: white, tinted per car
    T2 = remap[T]; T2 = T2[(T2[:, 0] != T2[:, 1]) & (T2[:, 1] != T2[:, 2]) & (T2[:, 0] != T2[:, 2])]
    _, first = np.unique(np.sort(T2, 1), axis=0, return_index=True); T2 = T2[np.sort(first)]
    outQ.append(NP); outN.append(NN); outC.append(NC); outI.append(T2.reshape(-1) + base); groups.append([ib, T2.size]); base += m; ib += T2.size
    print('group', gi, len(used), '->', m, 'verts', len(T), '->', len(T2), 'tris')
Pq = np.vstack(outQ); N = len(Pq); sc = np.abs(Pq).max() / 32000
head = dict(h, verts=N, scale=sc * h['size'][2] / 4.4, groups=groups); head['credit'] = h.get('credit', '') + '; lighter copy (tools/lite_car.py)'
hj = json.dumps(head).encode(); hj += b' ' * ((4 - (4 + len(hj)) % 4) % 4)    # data must start on a 4-byte boundary
def p4(x): return x + b'\0' * ((4 - len(x) % 4) % 4)
out = struct.pack('<I', len(hj)) + hj
out += p4(np.round(Pq / sc).astype(np.int16).tobytes()) + p4(np.round(np.vstack(outN) * 127).astype(np.int8).tobytes()) + p4(np.round(np.vstack(outC)).astype(np.uint8).tobytes())
out += np.concatenate(outI).astype(np.uint32).tobytes()
open(dst, 'wb').write(out); print('written', dst, len(out) // 1024, 'KB')
