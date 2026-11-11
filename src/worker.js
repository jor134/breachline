// BREACHLINE Worker: static app comes from /public; /ws/<ROOM> connects to that room's Durable Object.
import { RoomHost, TICK } from '../public/js/core/host.js';

export default {
  async fetch(req, env) {
    const url = new URL(req.url), m = url.pathname.match(/^\/ws\/([A-Za-z0-9]{3,8})$/);
    if (m) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
      return env.ROOMS.get(env.ROOMS.idFromName(m[1].toUpperCase())).fetch(req);
    }
    return new Response('Not found', { status: 404 });
  },
};

export class Room {
  constructor() {
    this.socks = new Map(); this.next = 1; this.timer = null;
    this.host = new RoomHost((id, obj) => {
      const s = JSON.stringify(obj);
      if (id == null) { for (const ws of this.socks.values()) try { ws.send(s); } catch {} }
      else { try { this.socks.get(id)?.send(s); } catch {} }
    });
  }
  async fetch(req) {
    const name = new URL(req.url).searchParams.get('name') || 'Officer';
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const id = this.next++; this.socks.set(id, server);
    if (!this.host.join(id, name)) { this.socks.delete(id); server.close(4000, 'Room full'); return new Response(null, { status: 101, webSocket: client }); }
    const bye = () => { if (!this.socks.delete(id)) return; this.host.leave(id); if (!this.socks.size && this.timer) { clearInterval(this.timer); this.timer = null; } };
    server.addEventListener('message', e => { try { this.host.message(id, JSON.parse(e.data)); } catch {} });
    server.addEventListener('close', bye); server.addEventListener('error', bye);
    if (!this.timer) { let last = Date.now(); this.timer = setInterval(() => { const now = Date.now(), dt = Math.min(0.25, (now - last) / 1000); last = now; this.host.tick(dt); }, TICK * 1000); }
    return new Response(null, { status: 101, webSocket: client });
  }
}
