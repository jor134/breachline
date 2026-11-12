// Mansion scenery: street, terraced garden, cliff and ocean, roofs and canopies, exterior lights, interior dressing.
import { terrainY, STAIR } from '../core/maps/mansion.js';
export default {
  env: {
    sky: [[0, '#1c2638'], [0.3, '#3b4a63'], [0.47, '#8b8d9c'], [0.52, '#d6b08e'], [0.56, '#4a4038'], [1, '#2a2622']], skyR: 190, moon: [-95, 80, -130],
    fog: [0x3a4152], fogD: [0.006, 0.011], sunAt: [12, 7], sunFrom: [-51, 23.8, 57.8], shadow: 36, lamps: [[12, 2.5, 12.4], [4.5, 2.7, 12]],
  },
  outer: () => 'stone',
  scenery({ b, hills, hillM, THREE, H, YARD, ALL }) {
    for (const [x, z, r, h] of [[-150, 10, 90, 44], [-120, 120, 110, 38], [20, 170, 120, 40], [150, 110, 100, 46], [170, 0, 80, 30]]) { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7, 1), hillM); m.position.set(x, h / 2 - 3, z); m.rotation.y = x; hills.add(m); }
    // land: street level in front, stepping down beside the house to the back yard, then a cliff and the ocean
    const X0 = YARD.x0 - 70, X1 = YARD.x1 + 70, land = (m, x0, x1, z0, y0, z1, y1, s = 0.3) => b(m).quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], s);
    land('gravel', X0, X1, 16, 0, YARD.z1 + 70, 0); land('gravel', X0, X1, YARD.z0, -H, 0, -H);
    for (const [a, c] of [[X0, -0.1], [24.1, X1]]) { land('gravel', a, c, 12, 0, 16, 0); land('gravel', a, c, 4, -H, 12, 0); land('gravel', a, c, 0, -H, 4, -H); }
    for (const [a, c] of [[-3.6, -0.1], [24.1, 27.6]]) for (let k = 0; k < 8; k++) { const top = -0.4 * (k + 0.5) + 0.03; b('paver').box(a, c, top - 0.5, top, 11 - k, 12 - k, 'xXYZz', 0.5); }
    land('paver', -3, 27, 16.1, 0.02, 25, 0.02, 0.5); land('paver', 9, 15, 25, 0.02, YARD.z1, 0.02, 0.5); land('paver', -3.6, 27.6, YARD.z0 + 0.3, -H + 0.02, -0.1, -H + 0.02, 0.5);
    b('stone').box(X0, X1, -H - 14, -H, YARD.z0 - 0.6, YARD.z0, 'zY', 1); land('ocean', -500, 500, YARD.z0 - 520, -H - 11, YARD.z0 - 0.5, -H - 11, 0.05);
    const wallSeg = (x0, x1, z0, z1, y) => b('stone').box(x0, x1, y, y + 1.6, z0, z1, 'xXYzZ', 1);
    for (const [x0, x1] of [[YARD.x0 - 0.3, YARD.x0], [YARD.x1, YARD.x1 + 0.3]]) { wallSeg(x0, x1, 12, YARD.z1, 0); wallSeg(x0, x1, YARD.z0, 4, -H); for (let z = 4; z < 12; z += 2) b('stone').box(x0, x1, terrainY(z), terrainY(z + 2) + 1.6, z, z + 2, 'xXYzZ', 1); }
    wallSeg(YARD.x0, 9, YARD.z1, YARD.z1 + 0.3, 0); wallSeg(15, YARD.x1, YARD.z1, YARD.z1 + 0.3, 0);
    // glass balustrade along the cliff edge, and a ground-floor deck sheltering the walk-out
    const rail = (x0, x1, z, y) => { b('glass').quad([x0, y, z], [x1, y, z], [x1, y + 1.05, z], [x0, y + 1.05, z], [0, 0, 1]); b('fascia').box(x0, x1, y + 1.05, y + 1.09, z - 0.03, z + 0.03, ALL, 1); };
    rail(YARD.x0, YARD.x1, YARD.z0 + 0.15, -H);
    // roofs: deep flat overhangs, mid-level canopy, raised roof with a dark clerestory band, chimney
    const slab = (x0, x1, y0, y1, z0, z1) => { b('fascia').box(x0, x1, y0, y1, z0, z1, 'xXYzZ', 1); b('soffit').quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], 0.5); };
    slab(-1.6, 25.6, H - 0.05, H + 0.2, 16.1, 18.7); slab(-1.4, -0.1, H - 0.05, H + 0.2, 6, 16.1);
    slab(-1.8, 25.8, 2 * H, 2 * H + 0.28, -0.9, 19); b('dark').box(11, 24.2, 2 * H + 0.28, 2 * H + 0.8, 0.2, 15.8, 'xXzZ'); slab(9.5, 26.6, 2 * H + 0.8, 2 * H + 1.05, -1.4, 19.6);
    b('stone').box(4.8, 6.2, 2 * H + 0.28, 2 * H + 2.1, 5.8, 7.2, 'xXYzZ', 1);
    slab(-0.6, 24.6, -0.22, 0, -2.8, -0.1); rail(-0.6, 24.6, -2.77, 0); for (const x of [0.1, 23.9]) b('stone').box(x - 0.25, x + 0.25, -H, -0.22, -2.75, -2.25, 'xXzZ', 1);
    for (const [x0, x1, y0, y1, z0, z1] of [[-0.14, 24.14, H - 0.14, H + 0.2, -0.16, -0.1], [24.1, 24.16, H - 0.14, H + 0.2, -0.1, 16.1], [-0.16, -0.1, H - 0.14, H + 0.2, -0.1, 6]]) b('fascia').box(x0, x1, y0, y1, z0, z1, ALL, 1);
    const spot = (x, y, z) => b('glow').quad([x - 0.07, y, z - 0.07], [x + 0.07, y, z - 0.07], [x + 0.07, y, z + 0.07], [x - 0.07, y, z + 0.07], [0, -1, 0]);
    for (let x = -0.5; x <= 25; x += 1.7) { spot(x, H - 0.056, 17.4); spot(x, 2 * H - 0.006, 17.6); }
    for (let z = 1; z < 16; z += 2.5) { spot(-1, 2 * H - 0.006, z); spot(25, 2 * H - 0.006, z); }
    for (let x = 1; x <= 24; x += 2.2) spot(x, -0.226, -1.5);
    // interior dressing (no collision): rugs, pendants, chandelier, screen, art
    const rug = (m, x0, x1, z0, z1, y) => b(m).quad([x0, y + 0.02, z0], [x1, y + 0.02, z0], [x1, y + 0.02, z1], [x0, y + 0.02, z1], [0, 1, 0], 1);
    rug('linen', 2.1, 8.8, 9.4, 14.2, 0); rug('carpet', 17, 22.5, 10.2, 13.3, 0); rug('linen', 2.6, 6.4, 9.6, 12.4, H); rug('fabric', 9.8, 14.2, 10.4, 14.6, H); rug('fabric', 2.4, 6.8, 9.6, 14.4, -H); b('dark').box(0.11, 0.15, -H + 0.7, -H + 2.5, 9.6, 14.4, 'X'); b('fascia').box(0.1, 0.13, -H + 0.64, -H + 2.56, 9.54, 14.46, 'xXYyzZ'.replace('x', ''), 1);
    for (const [x, z, y0] of [[18.8, 11.75, 0], [19.75, 11.75, 0], [20.7, 11.75, 0], [18.8, 3.6, 0], [20.2, 3.6, 0]]) { b('fascia').box(x - 0.006, x + 0.006, y0 + 2.0, y0 + H, z - 0.006, z + 0.006, 'xXzZ'); b('glow').box(x - 0.09, x + 0.09, y0 + 1.82, y0 + 2.0, z - 0.09, z + 0.09, ALL); }
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.25 + (i % 3) * 0.22, x = 12 + Math.cos(a) * r, z = 12.4 + Math.sin(a) * r, y = 2.0 + (i % 4) * 0.2; b('fascia').box(x - 0.005, x + 0.005, y + 0.1, H, z - 0.005, z + 0.005, 'xXzZ'); b('glow').box(x - 0.05, x + 0.05, y, y + 0.1, z - 0.05, z + 0.05, ALL); }
    b('dark').box(5.86, 8.14, 0.98, 2.26, 8.1, 8.155, 'Z'); b('fascia').box(5.8, 8.2, 0.92, 2.32, 8.1, 8.15, 'xXYyZ', 1);   // living room TV over the media console, clear of the study door
    b('walnut').box(9.11, 9.14, 1.1, 2.3, 14, 15.4, 'X', 1); b('top').box(14.86, 14.89, 1.2, 2.2, 14.2, 15.2, 'x', 1);
  },
};
