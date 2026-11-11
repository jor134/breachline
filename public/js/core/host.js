// Room host: wraps the simulation behind a message protocol. Runs in the Durable Object, or in the browser for solo practice.
import { Sim } from './sim.js';
export const TICK = 1 / 15;
export class RoomHost {
  constructor(send) { this.send = send; this.sim = new Sim(); }   // send(idOrNull, object)
  get count() { return this.sim.players.size; }
  join(id, name) {
    if (this.count >= 4) { this.send(id, { t: 'full' }); return false; }
    const p = this.sim.addPlayer(id, name);
    this.send(id, { t: 'welcome', id, slot: p.slot, init: this.sim.init() });
    return true;
  }
  leave(id) { this.sim.removePlayer(id); if (!this.count) this.sim.reset(1); }
  message(id, m) {
    if (!m || typeof m !== 'object') return; const s = this.sim;
    switch (m.t) {
      case 'pose': s.pose(id, m); break;
      case 'shot': s.shot(id, m); break;
      case 'shout': s.shout(id); break;
      case 'cuff': s.cuff(id, m.n); break;
      case 'heal': s.heal(id); break;
      case 'breaker': s.breaker(id); break;
      case 'revive': s.revive(id, m.p); break;
      case 'door': s.door(id, m.d); break;
      case 'pick': s.pick(id, m.d); break;
      case 'kick': s.kick(id, m.d); break;
      case 'cut': s.cut(id, m.b, m.w); break;
      case 'restart':
      case 'start': if (m.t === 'restart' || s.phase !== 'active') { s.start((Date.now() ^ (Math.random() * 1e9)) >>> 0, false, m.wx); this.send(null, { t: 'init', init: s.init() }); } break;
    }
  }
  tick(dt = TICK) { this.sim.tick(dt); this.send(null, this.sim.snapshot()); }
}
