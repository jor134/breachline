// Manual weapon handling state machine. Pure logic.
export const GUNS = {
  rifle: { cap: 30, auto: true, interval: 0.085, mags: 5, recoil: 1 },
  pistol: { cap: 17, auto: false, interval: 0.1, mags: 3, recoil: 1.6 },
};
export function createGun(kind) { return { kind, mag: GUNS[kind].cap, chamber: true, locked: false, mode: 'semi', last: -1 }; }
// edge = trigger just pressed this frame; held = trigger currently down. Returns 'fire' | 'click' | null.
export function pullTrigger(g, now, edge, held) {
  if (!held) return null;
  const auto = g.mode === 'auto' && GUNS[g.kind].auto;
  if (!edge && !auto) return null;
  if (!g.chamber) return edge ? 'click' : null;
  if (now - g.last < GUNS[g.kind].interval) return null;
  g.last = now; g.chamber = false;
  if (g.mag > 0) { g.mag--; g.chamber = true; } else if (g.mag === 0) g.locked = true;
  return 'fire';
}
export function ejectMag(g) { const r = g.mag; g.mag = null; return r; }
export function insertMag(g, rounds) { if (g.mag !== null) return false; g.mag = rounds; return true; }
// bolt / slide release button
export function release(g) {
  if (!g.locked) return null; g.locked = false;
  if (g.mag > 0) { g.mag--; g.chamber = true; return 'chamber'; }
  return 'empty';
}
// pull the charging handle / slide fully back and let go
export function rack(g) {
  const live = g.chamber; g.chamber = false; g.locked = false;
  if (g.mag > 0) { g.mag--; g.chamber = true; return live ? 'ejected-live' : 'chamber'; }
  if (g.mag === 0) g.locked = true;
  return live ? 'ejected-live' : 'empty';
}
export function toggleMode(g) { if (GUNS[g.kind].auto) g.mode = g.mode === 'auto' ? 'semi' : 'auto'; return g.mode; }
