// Ropes (map.ropes): fast-roping out of the helicopter and rappelling down a building's face.
// VR is hand over hand: grip the rope with an empty hand and pull it up to lower yourself (the hand stays where it holds the
// rope, your body moves); let go and the harness holds you. The left stick does the same for anyone who prefers it.
// Phone and desktop: USE near a rope clips in, forward / back (W / S or the thumb pad) climb and descend, USE at the
// bottom swings in through a broken window (or steps off at the top). At a breach window the glass must be shot or kicked
// in first. The fast rope from the helicopter lets you off on the roof by itself.
export function createRopes(ctx) {
  const { THREE, S, rig, head, hands, sfx, buzz, hint } = ctx, v = new THREE.Vector3();
  const R = () => (ctx.M().ropes || []);
  const hangAt = r => [r.x + r.out[0] * 0.45, r.z + r.out[1] * 0.45];
  const winOf = r => { if (!r.winAt) return -1; const L = ctx.level(); return L.doors.findIndex(d => d.win && Math.abs(d.cx - r.winAt[0]) < 0.1 && Math.abs(d.cz - r.winAt[1]) < 0.1); };
  const winOpen = r => { const w = winOf(r); return w < 0 || !!S.doorOpen[w]; };
  // move the rig so the head (VR) / body (desktop) sits over (x, z), feet at y
  function placeAt(x, z, y) { ctx.headWorld(); rig.position.x += x - head.pos.x; rig.position.z += z - head.pos.z; rig.position.y = y; S.feetY = y; ctx.headWorld(); }
  function near(p, maxD) {   // the rope whose line passes closest to point p, within maxD
    let best = -1, bd = maxD; R().forEach((r, i) => { if (r.heli && S.fly) return; if (p.y < r.bot - 0.3 || p.y > r.top + 2.4) return; let d = Math.hypot(p.x - r.x, p.z - r.z);
      if (r.arm) { const za = Math.min(r.arm[0], r.z), zb = Math.max(r.arm[0], r.z); d = Math.min(d, Math.hypot(p.x - r.x, p.y - r.arm[1], p.z - Math.max(za, Math.min(zb, p.z)))); }   // the davit arm the rope hangs from
      if (d < bd) { bd = d; best = i; } }); return best;
  }
  function clip(i, y) {
    const r = R()[i], [hx, hz] = hangAt(r); S.rope = { i, y: Math.max(r.bot, Math.min(r.top, y)) }; S.crouch = false;
    placeAt(hx, hz, S.rope.y); sfx.clink(v.set(r.x, S.rope.y + 1.5, r.z)); for (const h of hands) buzz(h, 0.6, 60);
  }
  function off(to) { const r = R()[S.rope.i]; S.rope = null; for (const h of hands) h.rope = null; placeAt(to[0], to[1], to[2]); sfx.step && sfx.step(v.set(to[0], to[2], to[1]), 'metal'); void r; }
  // VR: an empty hand gripping near a rope takes hold of it (clipping in if you are not on it yet). True if it did.
  function grabVR(h) {
    if (h.item || ctx.gunIn(h) || S.me.down) return false;
    const i = near(h.pos, 0.4); if (i < 0) return false;
    if (S.rope && S.rope.i !== i) return false;
    if (!S.rope) clip(i, S.feetY);
    h.rope = { y: h.pos.y, t: performance.now() }; buzz(h, 0.5, 40); return true;
  }
  function releaseVR(h) { if (h.rope) { h.rope = null; return true; } return false; }
  // every frame while on a rope
  function tick(dt, L) {
    if (!S.rope) return false;
    const r = R()[S.rope.i]; if (!r || S.me.down) { S.rope = null; return false; }
    const y0 = S.rope.y; let y = y0;
    if (S.mode === 'vr') {
      ctx.headWorld();
      const hs = hands.filter(h => h.rope && h.active && h.in.grip > 0.5).sort((a, b) => b.rope.t - a.rope.t), h = hs[0];
      for (const q of hands) if (q.rope && !(q.in.grip > 0.5)) q.rope = null;
      if (h) y -= h.pos.y - h.rope.y;                                   // pull the rope up: you go down
      if (L && Math.abs(L.sy) > 0.3 && !hs.length) y -= L.sy * 1.3 * dt;  // the stick, for anyone not pulling (back = down)
    } else y += (ctx.climb() || 0) * 1.5 * dt;
    y = Math.max(r.bot, Math.min(r.top, y)); S.rope.y = y; rig.position.y += y - y0; S.feetY = y;
    if (S.mode === 'vr') for (const q of hands) if (q.rope) q.rope.y = q.pos.y + (y - y0);
    // ways off: the fast rope lets you off at the bottom; at a breach window lean in (VR) or USE; at the top step back over the parapet
    const [hx, hz] = hangAt(r), lean = ((hx - head.pos.x) * r.out[0] + (hz - head.pos.z) * r.out[1]);   // how far the head has moved in toward the building
    const atBot = y - r.bot < 0.35, atTop = r.top - y < 0.35, fwd = S.mode === 'vr' && L && L.sy < -0.7;
    if (r.heli && atBot) { off(r.step); return true; }
    if (atBot && r.winAt) {
      if (!winOpen(r)) S.ropeHint = S.mode === 'vr' ? 'SHOOT OR KICK THE GLASS IN' : 'SHOOT OR KICK (Q) THE GLASS IN';
      else { S.ropeHint = S.mode === 'vr' ? 'LEAN IN TO SWING INSIDE' : 'USE TO SWING INSIDE'; if (S.mode === 'vr' && (lean > 0.35 || fwd)) off(r.step); }
    } else if (atTop && !r.heli) { S.ropeHint = S.mode === 'vr' ? 'LEAN IN TO CLIMB OVER' : 'USE TO CLIMB OVER'; if (S.mode === 'vr' && (lean > 0.4 || fwd)) off(r.top0); }
    else if (atTop && r.heli) S.ropeHint = S.mode === 'vr' ? 'PULL THE ROPE UP TO LOWER YOURSELF' : 'BACK / S TO GO DOWN';
    else S.ropeHint = '';
    return true;
  }
  // desktop / phone USE: clip in near a rope, or get off it where you can
  function use() {
    if (S.me.down) return false;
    if (S.rope) { const r = R()[S.rope.i]; if (S.rope.y - r.bot < 0.4 && r.winAt && winOpen(r)) { off(r.step); return true; } if (r.top - S.rope.y < 0.4 && !r.heli) { off(r.top0); return true; } return true; }
    const p = v.copy(head.pos); p.y = S.feetY + 1; const i = near(p, 1.4); if (i < 0) return false;
    clip(i, S.feetY); return true;
  }
  // what to say when you are near a rope and not on it
  function prompt() {
    if (S.rope || S.me.down) return ''; const p = v.copy(head.pos); p.y = S.feetY + 1; const i = near(p, 1.6); if (i < 0) return '';
    return S.mode === 'vr' ? (R()[i].arm ? 'GRIP THE ROPE OR ITS ARM WITH AN EMPTY HAND' : 'GRIP THE ROPE WITH AN EMPTY HAND') : 'USE: CLIP IN TO THE ROPE';
  }
  function reset() { S.rope = null; for (const h of hands) h.rope = null; S.ropeHint = ''; }
  return { grabVR, releaseVR, tick, use, prompt, reset, near };
}
