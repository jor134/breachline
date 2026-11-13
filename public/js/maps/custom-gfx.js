// Scenery for player-made maps: ground to the horizon, flat roofs on top of the rooms, lights in the biggest rooms, day or night.
// Walls, floors and the ground take the map's style preset, or textures the creator uploaded (served by /api/tex/<id>).
import * as THREE from '../../vendor/three.module.min.js';
import { sheen, tex, grid } from '../mats.js';
import { PRESETS, matKey } from '../core/maps/custom.js';
const loader = new THREE.TextureLoader();
export function customGfx(map) {
  const st = map.style || {}, P = PRESETS[st.preset] || PRESETS.house, [W, D] = [map.YARD.x1, map.YARD.z1], H = map.H;
  const wall = matKey(st.wall) || P.wall, outer = matKey(st.outer) || P.outer, ground = matKey(st.ground) || P.ground;
  let tod = 'day';
  // lights: the biggest rooms get a lamp each, at most eight
  const lamps = map.rooms.map(r => [(r[4] - r[2]) * (r[5] - r[3]), r]).sort((a, b) => b[0] - a[0]).slice(0, 8).map(([a, r]) => [(r[2] + r[4]) / 2, r[0] * H + H - 0.4, (r[3] + r[5]) / 2, 5 + Math.min(6, a / 12), 6 + Math.sqrt(a) * 1.2]);
  const common = { skyR: 400, sunAt: [W / 2, D / 2], shadow: Math.max(24, Math.max(W, D) * 0.6), lamps };
  const DAY = { ...common, sky: [[0, '#3f78c4'], [0.3, '#85b2e4'], [0.45, '#bcd3ea'], [0.5, '#c6d6e6'], [1, '#9aa69a']], moon: [160, 140, -40], fog: [0xc6d6e6], fogD: [0.004, 0.008], sunFrom: [40, 80, 30], sunCol: 0xfff3dc, sunK: 1.5, hemi: 1.3, hemiSky: 0xd8e6f6, hemiGround: 0x8c867a, hillColor: 0x6d7a6a };
  const NIGHT = { ...common, sky: [[0, '#06081a'], [0.3, '#14183a'], [0.45, '#2a2a52'], [0.5, '#1d1f3a'], [1, '#111222']], moon: [-150, 120, 80], fog: [0x1d1f3a], fogD: [0.006, 0.012], sunFrom: [-40, 70, 60], sunCol: 0xe0e8ff, sunK: 1.3, hemi: 1.0, hemiSky: 0x8a94c0, hemiGround: 0x3a3a46, hillColor: 0x0b0c18 };
  return {
    get env() { return tod === 'night' ? NIGHT : DAY; },
    setTod(t) { tod = t === 'night' ? 'night' : 'day'; },
    noCast: ['cgrass', 'casphalt', 'gravel', 'paver'],
    outer: () => outer, inner: () => wall,
    mats(M) {
      const S = (t, gl) => sheen({ map: t }, gl);
      if (!M.cconcrete) Object.assign(M, {
        cconcrete: S(tex('#9c9a95', 2500, grid(2, 2, 'rgba(50,50,50,0.25)')), 'stone'), cmetal: S(tex('#6d757d', 600, grid(6, 1, 'rgba(20,24,28,0.4)')), 'metal'), cglassy: S(tex('#2c3a4a', 600, grid(2, 1, 'rgba(10,16,24,0.5)')), 'metal'),
        cgrass: S(tex('#55744a', 6000), 'matte'), casphalt: S(tex('#3b3c3e', 9000), 'matte'),
      });
      for (const k of ['concrete', 'metal', 'glassy', 'grass', 'asphalt']) if (!M[k]) M[k] = M['c' + k];
      // uploaded textures: a plain material now, the picture when it arrives
      const keys = new Set([wall, outer, ground, ...map.rooms.map(r => r[6])].filter(k => typeof k === 'string' && k.startsWith('utex_')));
      for (const k of keys) if (!M[k]) { const m = M[k] = sheen({ color: 0xffffff }, 'satin'); loader.load('api/tex/' + k.slice(5), t => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; m.map = t; m.needsUpdate = true; }); }
    },
    scenery({ b, hills, hillM }) {
      const g = ground === 'grass' || ground === 'asphalt' ? 'c' + ground : ground;
      b(g).quad([-400, -0.005, -400], [W + 400, -0.005, -400], [W + 400, -0.005, D + 400], [-400, -0.005, D + 400], [0, 1, 0], 0.25);
      // a flat roof over every room with nothing built on top of it
      for (const r of map.rooms) {
        const [f, , x0, z0, x1, z1] = r, y = (f + 1) * H;
        if (map.rooms.some(q => q[0] === f + 1 && q[2] <= x0 && q[4] >= x1 && q[3] <= z0 && q[5] >= z1)) continue;
        b('fascia').box(x0 - 0.12, x1 + 0.12, y, y + 0.25, z0 - 0.12, z1 + 0.12, 'xXYzZ', 0.5);
      }
      for (const [x, z, r, h] of [[-160, -120, 120, 34], [W + 170, -60, 140, 40], [W / 2, D + 220, 160, 30], [-180, D + 60, 110, 26]]) { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7, 1), hillM); m.position.set(x, h / 2 - 3, z); hills.add(m); }
    },
  };
}
