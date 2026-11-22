// Graphics mode (quest-store, VRC.Quest.Performance.1). PERFORMANCE is the default and holds the headset's frame rate on the
// big maps; QUALITY puts back the costlier look for players who prefer it. Chosen from the in-game menu, remembered on this headset.
//   PERFORMANCE: 4 lamp lights lent to the nearest lamps, glass drawn without per-light shading, strong foveated rendering
//   QUALITY:     every lamp its own light, fully lit glass, light foveated rendering (sharper edges of the view)
// Everything else from the performance work (merged character pieces, people behind walls skipped, no reflection rebuilds) is the
// same in both, because it does not change what you see.
import { cheapGlass } from '../mats.js';

const KEY = 'ych_gfx';
let mode = 'perf';
try { if (localStorage.getItem(KEY) === 'quality') mode = 'quality'; } catch (e) { }

export const gfxMode = () => mode;
export const gfxLabel = () => mode === 'quality' ? 'GRAPHICS: QUALITY' : 'GRAPHICS: PERFORMANCE';
export function toggleGfx() { mode = mode === 'quality' ? 'perf' : 'quality'; try { localStorage.setItem(KEY, mode); } catch (e) { } return mode; }

// Apply to the current map (after it is built, and whenever the mode changes)
export function applyGfx(world, renderer) {
  const q = mode === 'quality';
  if (world) {
    if (world.setLampPool) world.setLampPool(q ? 99 : 4);
    world.root.traverse(o => {
      if (!o.isMesh) return; const U = o.userData;
      if (q) { if (U.fullMat) { o.material = U.fullMat; U.fullMat = null; } return; }
      const m = o.material; if (!m || Array.isArray(m) || !m.transparent || !m.userData || m.userData.gloss !== 'glass' || !m.isMeshPhongMaterial) return;
      U.fullMat = m; o.material = cheapGlass(m);
    });
  }
  if (renderer && renderer.xr.isPresenting) { try { renderer.xr.setFoveation(q ? 0.35 : 1); } catch (e) { } }
}
