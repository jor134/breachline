// SWAT bots: AI officers who fill the squad up to four. They are players in the simulation (so suspects see them, shoot them,
// and the mission rules count them), driven from here instead of by a headset. A human SWAT player orders them with the wheel;
// with no human on the SWAT side (a solo terrorist) they run the mission on their own.
// Orders: follow, hold, move (go there and hold), and tasks on a pointed-at thing: open / pick / kick / breach a door, cut a door's
// wire, defuse a bomb, detain a hostage or a suspect, revive an officer. A task done, a bot goes back to following or holding.
import { findPath, raySphere } from './level.js';

export const BOT_NAMES = ['ALPHA', 'BRAVO', 'CHARLIE'];
export const BOT_ST = ['follow', 'hold', 'move', 'door', 'defuse', 'detain', 'revive', 'engage'];   // status code -> word, sent in the snapshot
const CUFFABLE = { s: 1, k: 1, y: 1, i: 1 }, DONE = { d: 1, u: 1, j: 1 };
const ang = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;

export const BotMixin = {
  // Fill the squad: four minus the human SWAT players, at most three bots. Called from reset().
  spawnBots() {
    for (const [id, p] of this.players) if (p.bot) this.players.delete(id);
    if (this.M.training || this.constructor.BOTS === false) return;   // tests switch bots off
    const humans = [...this.players.values()], swat = humans.filter(p => p.team !== 'tango').length, n = Math.max(0, Math.min(3, 4 - swat));
    const used = new Set(humans.map(p => p.slot));
    for (let i = 0; i < n; i++) {
      let slot = 0; while (used.has(slot)) slot++; used.add(slot);
      const [x, z] = this.M.spawn[slot % this.M.spawn.length], id = 900 + i;
      this.players.set(id, { id, name: BOT_NAMES[i], slot, hp: 100, down: false, hx: x, hy: 1.62, hz: z, y: 0, h: null, l: null, r: null, g: [0, 1], lastShot: -9, lastShout: -9, lastKick: -9, lastBrk: -9, has: true, w: 0, med: false, fl: 2, sm: 1, team: 'swat', entered: false, locks: 0, traps: 0,
        bot: { i, x, z, y: 0, yaw: Math.PI, path: null, pi: 0, spd: 0, base: 'follow', task: null, st: 0, aim: 0, cool: 0, burst: 3, foe: null, sayT: -9, shoutT: -9, repath: 0, seen: {}, hold: null, crouch: false, pitch: 0, lead: null, heard: null } });
      this.botPose(this.players.get(id));
    }
  },
  // A human joining mid-mission takes a bot's place.
  dropBot() { const b = [...this.players.values()].filter(p => p.bot).sort((a, c) => (c.down - a.down) || (c.id - a.id))[0]; if (b) { this.players.delete(b.id); this.ev({ e: 'bsay', p: b.id, k: 'leave' }); } },
  bots() { return [...this.players.values()].filter(p => p.bot); },
  bsay(p, k) { const b = p.bot; if (this.t - b.sayT < 1.2 && k !== 'onit') return; b.sayT = this.t; this.ev({ e: 'bsay', p: p.id, k }); },

  // ---- orders from a human SWAT player ----
  order(id, m) {
    const me = this.players.get(id); if (!me || me.bot || me.team === 'tango' || this.phase !== 'active' || !m) return;
    const bots = this.bots().filter(p => !p.down); if (!bots.length) return;
    const k = m.k, num = v => Number.isFinite(v);
    if (k === 'follow' || k === 'hold') { for (const p of bots) { const b = p.bot; b.base = k; b.task = null; b.path = null; b.lead = id; b.hold = k === 'hold' ? [b.x, b.z, b.y, b.yaw] : null; } this.bsay(bots[0], k === 'follow' ? 'follow' : 'hold'); return; }
    let task = null, at = null;
    if (k === 'move' && num(m.x) && num(m.z) && num(m.y)) { task = { k: 'move', x: m.x, z: m.z, y: this.level.groundY(m.x, m.z, m.y + 0.5) }; at = [m.x, m.z]; }
    else if (['open', 'pick', 'kick', 'breach', 'unwire'].includes(k)) { const d = this.level.doors[m.d]; if (!d) return; task = { k: 'door', how: k, d: m.d }; at = [d.cx, d.cz]; }
    else if (k === 'defuse') { const b = this.bombs[m.b]; if (!b || b.defused) return; task = { k: 'defuse', b: m.b }; at = [b.x, b.z]; }
    else if (k === 'detain') { const n = this.npcs.find(q => q.id === m.n); if (!n || DONE[n.st]) return; task = { k: 'detain', n: n.id }; at = [n.x, n.z]; }
    else if (k === 'revive') { const q = this.players.get(m.p); if (!q || !q.down || q.team === 'tango') return; task = { k: 'revive', p: q.id }; at = [q.hx, q.hz]; }
    if (!task) return;
    // the nearest bot that is not already busy takes it; if all are busy, the nearest one drops what it is doing
    const free = bots.filter(p => !p.bot.task || p.bot.task.k === 'move'), pool = free.length ? free : bots;
    const p = pool.sort((a, c) => Math.hypot(a.bot.x - at[0], a.bot.z - at[1]) - Math.hypot(c.bot.x - at[0], c.bot.z - at[1]))[0];
    const b = p.bot; b.task = Object.assign(task, { ph: 'go', t: 0 }); b.path = null; b.lead = id; if (k === 'move') { b.base = 'hold'; } this.bsay(p, 'onit');
    this.ev({ e: 'border', p: p.id, k });
  },

  // ---- per tick ----
  tickBots(dt) {
    const bots = this.bots(); if (!bots.length) return;
    const humans = [...this.players.values()].filter(p => !p.bot && p.team !== 'tango' && p.has);
    const auto = !humans.length;   // nobody to give orders: run the mission
    bots.forEach((p, k) => { if (!p.down) this.tickBot(p, dt, auto, humans, bots, k); this.botPose(p); });
  },
  tickBot(p, dt, auto, humans, bots, k) {
    const b = p.bot; b.st = b.task ? { move: 2, door: 3, defuse: 4, detain: 5, revive: 6 }[b.task.k] : b.base === 'hold' ? 1 : 0;
    // 1. threats come first: shoot a suspect who is shooting or about to execute; challenge an armed one who is not
    const foe = this.botFoe(p);
    if (foe) { b.st = 7; this.botFight(p, foe, dt); return; }
    b.aim = Math.max(0, b.aim - dt * 2); b.crouch = false;
    // 2. call out to anyone in view who has not complied yet (civilians, unaware suspects)
    if (this.t - b.shoutT > 2.5) for (const n of this.npcs) { if (!(n.kind === 'c' ? n.st === 'w' : (n.st === 'g' || n.st === 'a') && n.armed)) continue; const d = Math.hypot(n.x - b.x, n.z - b.z); if (d < 9 && Math.abs(n.y - b.y) < 1.5 && this.clear(b.x, b.y + 1.6, b.z, n.x, n.y + 1.2, n.z)) { b.shoutT = this.t; p.lastShout = -9; this.shout(p.id); break; } }
    // 3. the current task, or follow / hold
    if (!b.task && auto && k === 0) b.task = this.botPlan(p);
    if (!b.task && !auto && b.base === 'follow') { const q = humans.find(h => h.down && Math.hypot(h.hx - b.x, h.hz - b.z) < 25); if (q && !bots.some(o => o.bot.task && o.bot.task.k === 'revive' && o.bot.task.p === q.id)) b.task = { k: 'revive', p: q.id, ph: 'go', t: 0 }; }   // an officer down: go and get him up
    if (b.task) { if (this.botTask(p, b.task, dt)) { b.task = null; b.path = null; if (b.base === 'hold') b.hold = [b.x, b.z, b.y, b.yaw]; } return; }
    if (b.base === 'hold' && b.hold) { if (Math.hypot(b.hold[0] - b.x, b.hold[1] - b.z) > 0.6) this.botGo(p, b.hold[0], b.hold[1], b.hold[2], dt, 2.4); else { b.path = null; b.spd = 0; this.botLook(p, dt); } return; }
    // follow: a human leader, or in auto mode the first bot
    const lead = auto ? (k === 0 ? null : bots[0]) : (this.players.get(b.lead) && !this.players.get(b.lead).down ? this.players.get(b.lead) : humans.find(h => !h.down) || humans[0]);
    if (!lead || lead === p) { this.botLook(p, dt); return; }
    const lx = lead.bot ? lead.bot.x : lead.hx, lz = lead.bot ? lead.bot.z : lead.hz, ly = lead.bot ? lead.bot.y : lead.y, d = Math.hypot(lx - b.x, lz - b.z), gap = 1.8 + (k - (auto ? 1 : 0)) * 0.9;
    if (d > gap + 0.6 || Math.abs(ly - b.y) > 1.2) { if (!b.path || (b.repath -= dt) <= 0 || Math.hypot(b.pt[0] - lx, b.pt[1] - lz) > 1.5) { b.repath = 1; b.pt = [lx, lz]; this.botPath(p, lx, lz, ly); } this.botWalk(p, dt, d > 7 ? 3.4 : 2.4, gap); }
    else { b.path = null; b.spd = 0; this.botLook(p, dt); }
  },
  // Who to shoot (or challenge): the nearest visible suspect in a firefight or holding a hostage at gunpoint, or a terrorist player.
  botFoe(p) {
    const b = p.bot, ey = b.y + (b.crouch ? 1.0 : 1.6); let best = null, bd = 1e9;
    const view = (x, y, z, d, always) => { if (d > 26) return false; if (!always && d > 3 && Math.abs(ang(Math.atan2(x - b.x, z - b.z), b.yaw)) > 1.15) return false; if (this.smokes.length && this.inSmoke(b.x, ey, b.z, x, y, z)) return false; return this.clear(b.x, ey, b.z, x, y, z); };
    for (const n of this.npcs) {
      if (n.kind !== 's' || DONE[n.st] || n.st === 's' || n.st === 'k' || n.st === 'i' || !n.armed) continue;
      const d = Math.hypot(n.x - b.x, n.z - b.z), hot = n.st === 'c' || n.exec; if (d >= bd || (!hot && (d > 11 || !this.clear(b.x, ey, b.z, n.x, n.y + 1.3, n.z, true))) || !view(n.x, n.y + 1.3, n.z, d, hot && n.tgt === p.id)) continue;   // an unaware one is only worth stopping for within shouting range
      bd = d; best = { n, hot, x: n.x, y: n.y + 1.25, z: n.z, d };
    }
    for (const q of this.players.values()) { if (q.team !== 'tango' || q.down || !q.has) continue; const d = Math.hypot(q.hx - b.x, q.hz - b.z); const heard = b.heard && this.t - b.heard[3] < 3 && Math.hypot(b.heard[0] - q.hx, b.heard[1] - q.hz) < 4; if (d < bd && view(q.hx, q.hy - 0.3, q.hz, d, heard)) { bd = d; best = { q, hot: true, x: q.hx, y: q.hy - 0.35, z: q.hz, d }; } }
    return best;
  },
  botFight(p, f, dt) {
    const b = p.bot, a = Math.atan2(f.x - b.x, f.z - b.z), off = ang(a, b.yaw), s = 7 * dt; b.yaw += Math.abs(off) < s ? off : Math.sign(off) * s; b.path = null; b.spd = 0;
    b.pitch = Math.atan2(f.y - (b.y + 1.5), f.d);
    if (!f.hot) {   // armed but not fighting yet: shout him down, rifle up, no shot (that would be unauthorised force)
      if (this.t - b.shoutT > 1.6) { b.shoutT = this.t; p.lastShout = -9; this.shout(p.id); }
      b.aim = Math.min(b.aim, 0.2); return;
    }
    if (f.n && f.n.st === 'c' && f.n.tgt === p.id) b.crouch = true;   // under fire: get low
    if (b.foe !== (f.n || f.q)) { b.foe = f.n || f.q; b.aim = 0; this.bsay(p, 'contact'); }
    b.aim += dt; if (Math.abs(off) > 0.12 || b.aim < (f.q ? 0.75 : 0.45)) return;
    if ((b.cool -= dt) > 0) return;
    // a clean line? no hostage, held shield or officer in front of the target
    const ey = b.y + (b.crouch ? 1.0 : 1.6), dx0 = f.x - b.x, dy0 = f.y - ey, dz0 = f.z - b.z, dl = Math.hypot(dx0, dy0, dz0);
    for (const n of this.npcs) { if (n.kind !== 'c' || n.st === 'd') continue; if (raySphere(b.x, ey, b.z, dx0 / dl, dy0 / dl, dz0 / dl, n.x, n.y + 1.0, n.z, 0.45) >= 0 && Math.hypot(n.x - b.x, n.z - b.z) < f.d + 0.3) { b.cool = 0.3; return; } }
    for (const q of this.players.values()) { if (q === p || q.team === 'tango' || q.down) continue; if (raySphere(b.x, ey, b.z, dx0 / dl, dy0 / dl, dz0 / dl, q.hx, q.hy - 0.4, q.hz, 0.4) >= 0 && Math.hypot(q.hx - b.x, q.hz - b.z) < f.d) { b.cool = 0.3; return; } }
    const sp = 0.025 + 0.004 * f.d + (f.q ? 0.03 : 0), rn = () => (this.rnd() - 0.5) * 2 * sp;
    const tx = f.x + rn() * f.d, ty = f.y + rn() * f.d * 0.8, tz = f.z + rn() * f.d, dx = tx - b.x, dy = ty - ey, dz = tz - b.z, l = Math.hypot(dx, dy, dz);
    p.lastShot = -9; this.shot(p.id, { o: [b.x + dx / l * 0.3, ey, b.z + dz / l * 0.3], d: [dx / l, dy / l, dz / l], w: 'rifle' });
    if (--b.burst > 0) b.cool = 0.14; else { b.burst = 2 + Math.floor(this.rnd() * 3); b.cool = 0.45 + this.rnd() * 0.4; }
  },
  // Auto mode (no human SWAT): the lead bot picks the next job.
  botPlan(p) {
    const b = p.bot, near = (x, z) => Math.hypot(x - b.x, z - b.z);
    const downBot = this.bots().find(q => q.down); if (downBot) return { k: 'revive', p: downBot.id, ph: 'go', t: 0 };
    let best = null, bd = 1e9; const take = (task, x, z, w = 1) => { const d = near(x, z) * w; if (d < bd) { bd = d; best = task; } };
    for (const n of this.npcs) { if (n.st === 'x' || n.held) continue; if (n.kind === 'c' ? (n.st === 'w' || n.st === 'y') : CUFFABLE[n.st]) take({ k: 'detain', n: n.id }, n.x, n.z, n.kind === 'c' ? 1 : 0.8); }
    this.bombs.forEach((bm, i) => { if (!bm.defused) take({ k: 'defuse', b: i }, bm.x, bm.z, 0.9); });
    if (!best) { const q = [...this.players.values()].find(q => q.team === 'tango' && !q.down); if (q) take({ k: 'move', x: q.hx, z: q.hz, y: q.y, hunt: true }, q.hx, q.hz); else for (const n of this.npcs) if (n.kind === 's' && !DONE[n.st]) take({ k: 'move', x: n.x, z: n.z, y: n.y, hunt: true }, n.x, n.z); }
    return best && Object.assign(best, { ph: 'go', t: 0 });
  },
  // Work a task. Returns true when it is finished (done or impossible).
  botTask(p, T, dt) {
    const b = p.bot;
    if (T.k === 'move') { if (T.hunt && (T.t += dt) > 8) return true; const r = this.botApproach(p, T, T.x, T.z, T.y, T.hunt ? 3 : 0.7, dt, T.hunt ? 2.4 : 3.0); return r !== 'going'; }
    if (T.k === 'revive') { const q = this.players.get(T.p); if (!q || !q.down) return true; const r = this.botApproach(p, T, q.hx, q.hz, q.y, 1.2, dt, 3.2, -1, true); if (r === 'fail') return true; if (r === 'going') return false; b.crouch = true; this.botFace(p, q.hx, q.hz, dt); if ((T.w = (T.w || 0) + dt) > 3) { this.revive(p.id, q.id); this.bsay(p, 'up'); return true; } return false; }
    if (T.k === 'detain') {
      const n = this.npcs.find(q => q.id === T.n); if (!n || DONE[n.st] || n.st === 'x' || n.st === 'd') return true;
      if (n.kind === 's' && !CUFFABLE[n.st]) return (T.t += dt) > 10;   // not giving up yet: the fight logic handles him; give up the order after a while
      const r = this.botApproach(p, T, n.x, n.z, n.y, 1.1, dt, 2.8, -1, true); if (r === 'fail') return true; if (r === 'going') return false;
      this.botFace(p, n.x, n.z, dt);
      if (!CUFFABLE[n.st]) { if (this.t - b.shoutT > 1.5) { b.shoutT = this.t; p.lastShout = -9; this.shout(p.id); } return (T.t += dt) > 8; }
      if ((T.t += dt) > 1.2) { this.cuff(p.id, n.id); this.bsay(p, 'cuffed'); return true; } return false;
    }
    if (T.k === 'defuse') {
      const bm = this.bombs[T.b]; if (!bm || bm.defused) return true;
      if (T.ph === 'go') { const fy = this.level.groundY(b.x, b.z, bm.y - 0.5), r = this.botApproach(p, T, bm.x, bm.z, Math.min(fy, bm.y - 0.4), 1.0, dt, 2.8); if (r === 'fail') return true; if (r === 'going') return false; T.ph = 'work'; T.t = 0; this.bsay(p, 'bomb'); }
      b.path = null; b.crouch = bm.y - b.y < 1.0; this.botFace(p, bm.x, bm.z, dt);
      if ((T.t += dt) > 5 && T.t - (T.last || 0) > 1.1) { T.last = T.t; p.y = b.y; this.cut(p.id, T.b, bm.order[bm.n]); if (bm.defused) { this.bsay(p, 'defused'); return true; } }
      return T.t > 20;
    }
    if (T.k === 'door') return this.botDoor(p, T, dt);
    return true;
  },
  // Doors: walk to this side of it, check for a wire (and cut it), then open / pick / kick; a breach throws a flashbang in and clears the room.
  botDoor(p, T, dt) {
    const b = p.bot, D = this.level.doors[T.d]; if (!D) return true;
    if (T.side == null) T.side = D.horiz ? Math.sign(b.z - D.cz) || 1 : Math.sign(b.x - D.cx) || 1;   // this side of the door, fixed when the job starts
    if (T.ph === 'go') {
      if (!T.stand) T.stand = D.horiz ? [D.cx, D.cz + T.side * 0.85] : [D.cx + T.side * 0.85, D.cz];
      const r = this.botApproach(p, T, T.stand[0], T.stand[1], D.y, 0.45, dt, 2.8, T.d); if (r === 'fail') return true; if (r === 'going') return false;
      T.ph = 'check'; T.t = 0;
    }
    this.botFace(p, D.cx, D.cz, dt);
    if (T.ph === 'check') {   // a careful look along the gap: most wires get spotted
      if ((T.t += dt) < 0.8) return false;
      if (this.doorTrap[T.d] && !this.doorOpen[T.d] && (T.how === 'unwire' || this.botSpots(p, T.d))) { T.ph = 'unwire'; T.t = 0; this.bsay(p, 'wire'); return false; }
      if (T.how === 'unwire') { this.bsay(p, 'nowire'); return true; }
      T.ph = 'entry'; T.t = 0;
    }
    if (T.ph === 'unwire') { b.crouch = true; if ((T.t += dt) < 3) return false; this.disarm(p.id, T.d); b.crouch = false; if (T.how === 'unwire') return true; T.ph = 'entry'; T.t = 0; }
    if (T.ph === 'entry') {
      if (this.doorOpen[T.d]) { if (T.how !== 'breach') return true; T.ph = 'flash'; T.t = 0; }
      else if (this.doorLocked[T.d] && D.pad !== undefined) { b.crouch = true; if ((T.t += dt) < 3) return false; this.snip(p.id, T.d); b.crouch = false; this.door(p.id, T.d); if (T.how !== 'breach') return true; T.ph = 'flash'; T.t = 0; }   // bolt cutters through a padlock
      else if (this.doorLocked[T.d] && (T.how === 'open')) { this.ev({ e: 'locked', d: T.d }); this.bsay(p, 'locked'); return true; }
      else if (this.doorLocked[T.d] && T.how === 'pick') { b.crouch = true; if ((T.t += dt) < 4) return false; this.pick(p.id, T.d); b.crouch = false; this.door(p.id, T.d); return true; }
      else if (T.how === 'kick' || (T.how === 'breach' && this.doorLocked[T.d])) { if ((T.t += dt) < 0.4) return false; T.t = 0; T.kicks = (T.kicks || 0) + 1; this.kick(p.id, T.d); if (!this.doorOpen[T.d] && T.kicks >= 5) { this.bsay(p, 'locked'); return true; } if (!this.doorOpen[T.d]) return false; if (T.how === 'kick') return true; T.ph = 'flash'; T.t = 0; }
      else { this.door(p.id, T.d); if (T.how !== 'breach') return true; T.ph = 'flash'; T.t = 0; }
      return false;
    }
    if (T.ph === 'flash') {
      if (T.t === 0 && p.fl > 0) { const fx = D.horiz ? D.cx : D.cx - T.side * 3.2, fz = D.horiz ? D.cz - T.side * 3.2 : D.cz, ey = b.y + 1.4, dx = fx - b.x, dz = fz - b.z, l = Math.hypot(dx, dz) || 1; this.throw(p.id, { k: 'flash', o: [b.x, ey, b.z], v: [dx / l * 6.5, 2.2, dz / l * 6.5] }); this.bsay(p, 'flash'); }
      if ((T.t += dt) < (p.fl >= 0 ? 1.9 : 0.5)) return false;
      T.ph = 'clear'; T.t = 0; T.in = D.horiz ? [D.cx, D.cz - T.side * 2.6] : [D.cx - T.side * 2.6, D.cz]; if (!this.botPath(p, T.in[0], T.in[1], D.y)) return true;
    }
    if (T.ph === 'clear') { if (!this.botWalk(p, dt, 2.6, 0)) { b.base = 'hold'; b.hold = [b.x, b.z, b.y, b.yaw]; this.bsay(p, 'clear'); return true; } return (T.t += dt) > 12; }
    return true;
  },
  // Get within `reach` of a point: 'there', 'going' or 'fail'. Moving targets (a hostage, a downed officer) are re-pathed now and then.
  botApproach(p, T, x, z, y, reach, dt, sp, skip = -1, moving = false) {
    const b = p.bot, d = Math.hypot(x - b.x, z - b.z);
    if (d <= reach && Math.abs(y - b.y) < 1.2) { b.path = null; b.spd = 0; return 'there'; }
    if (moving && b.path && (b.repath -= dt) <= 0) b.path = null;
    if (!b.path) { if (T.pathed && d < reach + 0.9 && Math.abs(y - b.y) < 1.2) return 'there'; if ((T.np = (T.np || 0) + 1) > 24) return 'fail'; if (!this.botPath(p, x, z, y)) return 'fail'; T.pathed = true; b.repath = 1.5; }
    this.botWalk(p, dt, sp, 0, skip, !!T.sub); return 'going';
  },
  botSpots(p, did) { const b = p.bot; if (b.seen[did] === undefined) b.seen[did] = this.rnd() < 0.85; return b.seen[did]; },
  botFace(p, x, z, dt) { const b = p.bot, a = Math.atan2(x - b.x, z - b.z), d = ang(a, b.yaw), s = 6 * dt; b.yaw += Math.abs(d) < s ? d : Math.sign(d) * s; b.pitch *= 0.9; },
  botLook(p, dt) { const b = p.bot; b.pitch *= 0.9; if (b.heard && this.t - b.heard[3] < 4) this.botFace(p, b.heard[0], b.heard[1], dt); },
  botPath(p, x, z, y) { const b = p.bot; b.path = findPath(this.level, b.x, b.z, b.y, x, z, y); b.pi = 1; return !!b.path; },
  botGo(p, x, z, y, dt, sp) { const b = p.bot; if (!b.path && !this.botPath(p, x, z, y)) return false; return this.botWalk(p, dt, sp, 0); },
  // Walk the path, stopping `stop` metres short; a closed door on the way is handled on the spot (wire check, pick or kick, open).
  botWalk(p, dt, sp, stop, skipDoor = -1, inner = false) {
    const b = p.bot; if (!b.path) return false;
    if (stop > 0) { const e = b.path[b.path.length - 1]; if (Math.hypot(e[0] - b.x, e[1] - b.z) < stop) { b.path = null; b.spd = 0; return false; } }
    if (!inner && b.doorT == null) for (let i = b.pi; i < Math.min(b.path.length, b.pi + 5); i++) {
      const [wx, wz] = b.path[i]; if (Math.hypot(wx - b.x, wz - b.z) > 2.2) break;
      const did = this.level.doors.findIndex((D, j) => j !== skipDoor && !this.doorOpen[j] && Math.abs(D.y - b.y) < 1 && Math.hypot(D.cx - wx, D.cz - wz) < 0.75);
      if (did >= 0) { const T = { k: 'door', how: this.doorLocked[did] ? 'pick' : 'open', d: did, ph: 'go', t: 0, sub: true }; b.sub = { T }; b.doorT = 0; break; }
    }
    if (!inner && b.sub) { const s = b.sub; if (!this.botDoor(p, s.T, dt)) return true; b.sub = null; b.doorT = null; b.path = null; return false; }   // a fresh path from here once it is open
    const moving = this.walk(b, dt, sp, false, true);
    p.hx = b.x; p.hz = b.z; p.y = b.y;
    return moving;
  },
  // Head and hands for the snapshot (the same shape a headset sends), rifle up when aiming.
  botPose(p) {
    const b = p.bot; if (!b) return;
    const eye = p.down ? 0.3 : b.crouch ? 1.05 : 1.62, th = b.yaw + Math.PI, pit = b.aim > 0.1 ? b.pitch : b.pitch * 0.5 - 0.15;
    const cy = Math.cos(th / 2), sy = Math.sin(th / 2), cp = Math.cos(pit / 2), sp = Math.sin(pit / 2);
    const q = [cy * sp, sy * cp, -sy * sp, cy * cp].map(r3);   // yaw about y, then pitch about the turned x axis
    const fx = -Math.sin(th), fz = -Math.cos(th), rx = Math.cos(th), rz = -Math.sin(th), up = Math.sin(pit), fl = Math.cos(pit);
    const at = (r, u, f) => [r2(b.x + rx * r + fx * f * fl), r2(b.y + eye + u + up * f), r2(b.z + rz * r + fz * f * fl)];
    p.hx = b.x; p.hz = b.z; p.y = b.y; p.hy = b.y + eye; p.light = this.night;
    p.h = [r2(b.x), r2(b.y + eye), r2(b.z), ...q];
    p.r = [...at(0.17, -0.27, 0.22), ...q]; p.l = [...at(0.02, -0.25, 0.5), ...q]; p.g = [0, 1];
  },
  // Gunfire from a terrorist player is something the bots hear and turn toward.
  botHear(x, z) { for (const p of this.bots()) if (Math.hypot(p.bot.x - x, p.bot.z - z) < 30) p.bot.heard = [x, z, 0, this.t]; },
};
