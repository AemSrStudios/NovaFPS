// NovaFPS room relay MVP for Cloudflare Workers + Durable Objects.
// This is a transport/lobby prototype, not an authoritative anti-cheat/game server.
export class NovaRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
  }

  async fetch(request) {
    const upgrade = request.headers.get('Upgrade');
    if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
      return new Response('NovaFPS room relay. Connect with WebSocket.', { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const url = new URL(request.url);
    const name = (url.searchParams.get('name') || 'Guest').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'Guest';
    const id = crypto.randomUUID();
    const current = [...this.sessions.values()];
    if (current.length >= 16) return new Response('Room is full (16 players maximum).', { status: 429 });
    server.accept();
    this.sessions.set(id, { id, name, x: 2.5, y: 9.5, yaw: 0, pitch: 0, health: 100, alive: false, lastMessageAt: 0, socket: server });
    server.serializeAttachment?.({ id, name });
    server.addEventListener('message', event => this.onMessage(id, event.data));
    server.addEventListener('close', () => this.remove(id));
    server.addEventListener('error', () => this.remove(id));
    this.send(server, { type: 'welcome', id, players: this.publicPlayers(id) });
    this.broadcast({ type: 'players', players: this.publicPlayers() }, id);
    return new Response(null, { status: 101, webSocket: client });
  }

  publicPlayers(exceptId = '') {
    const players = {};
    for (const [id, p] of this.sessions) {
      if (id !== exceptId) players[id] = this.publicPlayer(p);
    }
    return players;
  }

  publicPlayer(p) {
    return { id: p.id, name: p.name, x: p.x, y: p.y, yaw: p.yaw, pitch: p.pitch, health: p.health, alive: p.alive };
  }

  onMessage(id, raw) {
    const p = this.sessions.get(id);
    if (!p || typeof raw !== 'string' || raw.length > 2048) return;
    const now = Date.now();
    // Basic flood guard. This is not a substitute for authoritative game validation.
    if (now - p.lastMessageAt < 20) return;
    p.lastMessageAt = now;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'hello') {
      this.send(p.socket, { type: 'welcome', id, players: this.publicPlayers(id) });
      return;
    }
    if (m.type !== 'state' || !m.state || typeof m.state !== 'object') return;
    const s = m.state;
    const x = Number(s.x), y = Number(s.y), yaw = Number(s.yaw), pitch = Number(s.pitch), health = Number(s.health);
    // Clamp and reject malformed values. Full collision and speed validation belongs in the game server phase.
    if (![x, y, yaw, pitch, health].every(Number.isFinite)) return;
    p.x = Math.max(1, Math.min(23, x));
    p.y = Math.max(1, Math.min(17, y));
    p.yaw = Math.max(-Math.PI * 20, Math.min(Math.PI * 20, yaw));
    p.pitch = Math.max(-1, Math.min(1, pitch));
    p.health = Math.max(0, Math.min(100, health));
    p.alive = Boolean(s.alive);
    this.broadcast({ type: 'state', player: this.publicPlayer(p) }, id);
  }

  send(socket, data) {
    try { if (socket.readyState === 1) socket.send(JSON.stringify(data)); } catch {}
  }

  broadcast(data, exceptId = '') {
    for (const [id, p] of this.sessions) if (id !== exceptId) this.send(p.socket, data);
  }

  remove(id) {
    if (!this.sessions.has(id)) return;
    this.sessions.delete(id);
    this.broadcast({ type: 'leave', id });
    this.broadcast({ type: 'players', players: this.publicPlayers() });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/health') {
      return Response.json({ service: 'NovaFPS multiplayer relay', status: 'ok', maxPlayersPerRoom: 16, authoritativeCombat: false });
    }
    if (url.pathname !== '/ws') return new Response('Not found', { status: 404 });
    const room = (url.searchParams.get('room') || 'lobby').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'lobby';
    const id = env.NOVA_ROOM.idFromName(room);
    return env.NOVA_ROOM.get(id).fetch(request);
  }
};
