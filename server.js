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
  constructor(code, hostId) { this.code = code; this.hostId = hostId; this.state = 'lobby'; this.players = new Map(); this.destroyTimer = null; this.masterRC = null; }
  addPlayer(sid, name, role) {
    const c = this.getRoleCounts(), lim = { rc: 5, cgo: 5, maquinista: 20 };
    if (c[role] >= lim[role]) return { ok: false, reason: 'Max ' + lim[role] + ' ' + role };
    if (this.destroyTimer) { clearTimeout(this.destroyTimer); this.destroyTimer = null; }
    this.players.set(sid, { id: sid, name, role });
    if (role === 'rc' && !this.masterRC) this.masterRC = sid;
    return { ok: true, player: { id: sid, name, role }, isMaster: this.masterRC === sid };
  }
  removePlayer(sid) {
    const p = this.players.get(sid); this.players.delete(sid);
    if (sid === this.masterRC) { this.masterRC = null; for (const [s, pl] of this.players) { if (pl.role === 'rc') { this.masterRC = s; break; } } }
    if (this.players.size === 0) this.destroyTimer = setTimeout(() => rooms.delete(this.code), 30000);
    return p;
  }
  getRoleCounts() { const c = { rc: 0, cgo: 0, maquinista: 0 }; for (const p of this.players.values()) if (c[p.role] !== undefined) c[p.role]++; return c; }
  getPlayerList() { return Array.from(this.players.values()).map(p => ({ id: p.id, name: p.name, role: p.role, isMaster: p.id === this.masterRC })); }
}
function genCode() { const ch = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 6; i++) c += ch[Math.floor(Math.random() * ch.length)]; return c; }

io.on('connection', (socket) => {
  let room = null;
  socket.on('room:create', (d, cb) => { const code = genCode(), rm = new Room(code, socket.id); rooms.set(code, rm); const r = rm.addPlayer(socket.id, d.name, d.role); if (r.ok) { socket.join(code); room = rm; } cb({ ok: r.ok, code, player: r.player, isMaster: r.isMaster }); if (r.ok) io.to(code).emit('room:players', rm.getPlayerList()); });
  socket.on('room:join', (d, cb) => { const rm = rooms.get(d.code?.toUpperCase()); if (!rm) return cb({ ok: false, reason: 'Sala no encontrada' }); const r = rm.addPlayer(socket.id, d.name, d.role); if (!r.ok) return cb({ ok: false, reason: r.reason }); socket.join(d.code.toUpperCase()); room = rm; cb({ ok: true, code: rm.code, player: r.player, gameState: rm.state, isMaster: r.isMaster }); io.to(rm.code).emit('room:players', rm.getPlayerList()); });
  socket.on('game:start', (_, cb) => { if (!room) return cb?.({ ok: false }); room.state = 'running'; io.to(room.code).emit('game:started', {}); cb?.({ ok: true }); });
  socket.on('action', (d) => { if (!room) return; const p = room.players.get(socket.id); if (!p || p.role !== 'rc') return; io.to(room.code).emit('action:exec', { type: d.type, args: d.args || [], ctx: d.ctx || {}, from: p.name }); });
  // IMPORTANT: NOT volatile — reliable delivery
  socket.on('train:sync', (d) => { if (!room || socket.id !== room.masterRC) return; socket.to(room.code).emit('train:sync', d); });
  socket.on('maq:cmd', (d) => { if (!room) return; const p = room.players.get(socket.id); if (!p || p.role !== 'maquinista') return; io.to(room.code).emit('action:exec', { type: 'trCmd', args: [d.cmd], ctx: { selTrId: d.trainId }, from: p.name + ' (MAQ)' }); });
  socket.on('comms:send', (d, cb) => { if (!room) return; const p = room.players.get(socket.id); if (!p) return; io.to(room.code).emit('comms:message', { from: p.name, text: d.text, timestamp: Date.now() }); cb?.({ ok: true }); });
  socket.on('disconnect', () => { if (!room) return; const p = room.removePlayer(socket.id); if (p) { io.to(room.code).emit('room:player-left', { name: p.name }); io.to(room.code).emit('room:players', room.getPlayerList()); if (room.masterRC) io.to(room.masterRC).emit('master:promoted'); } });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('\n🚂 CTC Online → http://localhost:' + PORT + '\n'));
