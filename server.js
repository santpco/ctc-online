const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, pingTimeout: 60000, pingInterval: 25000 });

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

class Room {
  constructor(code, hostId) {
    this.code = code; this.hostId = hostId; this.state = 'lobby';
    this.players = new Map(); this.createdAt = Date.now(); this.destroyTimer = null;
  }
  addPlayer(socketId, name, role) {
    const counts = this.getRoleCounts();
    const limits = { rc: 5, cgo: 5, maquinista: 20 };
    if (counts[role] >= limits[role]) return { ok: false, reason: `Máximo de ${limits[role]} ${role} alcanzado` };
    if (this.destroyTimer) { clearTimeout(this.destroyTimer); this.destroyTimer = null; }
    const player = { id: socketId, name, role, connected: true, joinedAt: Date.now() };
    this.players.set(socketId, player);
    return { ok: true, player };
  }
  removePlayer(socketId) {
    const player = this.players.get(socketId);
    this.players.delete(socketId);
    if (this.players.size === 0) {
      this.destroyTimer = setTimeout(() => { rooms.delete(this.code); console.log(`[ROOM] ${this.code} eliminada`); }, 30000);
    }
    return player;
  }
  getRoleCounts() {
    const c = { rc: 0, cgo: 0, maquinista: 0 };
    for (const p of this.players.values()) if (c[p.role] !== undefined) c[p.role]++;
    return c;
  }
  getPlayerList() {
    return Array.from(this.players.values()).map(p => ({ id: p.id, name: p.name, role: p.role }));
  }
}

function genCode() {
  const ch = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = '';
  for (let i = 0; i < 6; i++) c += ch[Math.floor(Math.random() * ch.length)]; return c;
}

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('room:create', (data, cb) => {
    const code = genCode();
    const room = new Room(code, socket.id); rooms.set(code, room);
    const r = room.addPlayer(socket.id, data.name, data.role);
    if (r.ok) { socket.join(code); currentRoom = room; console.log(`[+] ${data.name} creó ${code}`); }
    cb({ ok: r.ok, code, player: r.player, reason: r.reason });
    if (r.ok) io.to(code).emit('room:players', room.getPlayerList());
  });

  socket.on('room:join', (data, cb) => {
    const room = rooms.get(data.code?.toUpperCase());
    if (!room) return cb({ ok: false, reason: 'Sala no encontrada' });
    const r = room.addPlayer(socket.id, data.name, data.role);
    if (!r.ok) return cb({ ok: false, reason: r.reason });
    socket.join(data.code.toUpperCase()); currentRoom = room;
    console.log(`[+] ${data.name} → ${data.code} (${data.role})`);
    cb({ ok: true, code: room.code, player: r.player, gameState: room.state });
    io.to(room.code).emit('room:players', room.getPlayerList());
  });

  socket.on('game:start', (_, cb) => {
    if (!currentRoom) return cb?.({ ok: false });
    currentRoom.state = 'running';
    io.to(currentRoom.code).emit('game:started', {});
    console.log(`[GAME] ${currentRoom.code} iniciada`);
    cb?.({ ok: true });
  });

  // ═══ ACTION RELAY — core of multiplayer ═══
  socket.on('action', (data) => {
    if (!currentRoom) return;
    const player = currentRoom.players.get(socket.id);
    if (!player || player.role !== 'rc') return;
    io.to(currentRoom.code).emit('action:exec', {
      type: data.type, args: data.args || [], ctx: data.ctx || {}, from: player.name
    });
  });

  socket.on('comms:send', (data, cb) => {
    if (!currentRoom) return;
    const player = currentRoom.players.get(socket.id);
    if (!player) return;
    io.to(currentRoom.code).emit('comms:message', { from: player.name, text: data.text, timestamp: Date.now() });
    cb?.({ ok: true });
  });

  socket.on('disconnect', () => {
    if (currentRoom) {
      const p = currentRoom.removePlayer(socket.id);
      if (p) {
        io.to(currentRoom.code).emit('room:player-left', { name: p.name });
        io.to(currentRoom.code).emit('room:players', currentRoom.getPlayerList());
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`\n🚂 CTC Online → http://localhost:${PORT}\n`));
