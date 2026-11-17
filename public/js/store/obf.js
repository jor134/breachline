// Loads the two Sketchfab Standard models (pistol, BAe 146), which may not be served as stand-alone files. They ship as
// obfuscated .blx packs made by tools/obf_glb.py; this reverses the key stream in the browser and hands the glb to
// GLTFLoader.parse. Same load(url, onLoad, onProgress, onError) shape as GLTFLoader, so callers only swap the class.
// A .glb url is mapped to its .blx neighbour.
import { GLTFLoader } from '../../vendor/GLTFLoader.js';

const SEED = 0x9E3779B9;
export function unpackBlx(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, false) !== 0x424C5831) throw new Error('not a BLX1 pack');   // 'BLX1'
  const n = dv.getUint32(4, true), src = new Uint8Array(buf, 8, n), out = new Uint8Array(n);
  let x = SEED;
  for (let i = 0; i < n; i++) { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; out[i] = src[i] ^ (x & 0xFF); }
  return out.buffer;
}

export class ObfLoader {
  load(url, onLoad, onProgress, onError) {
    const u = url.replace(/\.glb$/, '.blx'), base = u.slice(0, u.lastIndexOf('/') + 1);
    fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.arrayBuffer(); })
      .then(buf => new GLTFLoader().parse(unpackBlx(buf), base, onLoad, onError))
      .catch(e => onError && onError(e));
  }
}
