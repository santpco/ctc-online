// app.js — Lobby only. Game happens on ctc.html
const socket = io();
let myPlayer = null, roomCode = null, isHost = false;
let selectedRole = { create: 'rc', join: 'cgo' };

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
  const el = document.getElementById(id);
  if (el) { el.classList.add('active'); el.style.display = 'flex'; }
}

function selectRole(btn, ctx) {
  btn.parentElement.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedRole[ctx] = btn.dataset.role;
}

function createRoom() {
  const name = document.getElementById('create-name').value.trim();
  if (!name) { document.getElementById('create-error').textContent = 'Escribe tu nombre'; return; }
  const btn = document.getElementById('btn-create');
  btn.disabled = true; btn.textContent = 'Creando...';
  socket.emit('room:create', { name, role: selectedRole.create }, (res) => {
    btn.disabled = false; btn.innerHTML = '<span class="btn-icon">+</span> Crear Sala';
    if (res.ok) { roomCode = res.code; myPlayer = res.player; isHost = true; enterLobby(); }
    else document.getElementById('create-error').textContent = res.reason || 'Error';
  });
}

function joinRoom() {
  const name = document.getElementById('join-name').value.trim();
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  if (!name) { document.getElementById('join-error').textContent = 'Escribe tu nombre'; return; }
  if (!code || code.length < 4) { document.getElementById('join-error').textContent = 'Introduce el código'; return; }
  const btn = document.getElementById('btn-join');
  btn.disabled = true; btn.textContent = 'Conectando...';
  socket.emit('room:join', { name, code, role: selectedRole.join }, (res) => {
    btn.disabled = false; btn.innerHTML = '<span class="btn-icon">→</span> Unirse';
    if (res.ok) {
      roomCode = res.code; myPlayer = res.player; isHost = false;
      if (res.gameState === 'running') goToGame();
      else enterLobby();
    } else document.getElementById('join-error').textContent = res.reason || 'No se pudo unir';
  });
}

function enterLobby() {
  showScreen('screen-lobby');
  document.getElementById('lobby-code').textContent = roomCode;
  document.getElementById('host-actions').style.display = isHost ? 'block' : 'none';
  document.getElementById('lobby-status').textContent = isHost ? 'Eres el host. Inicia cuando estéis listos.' : 'Esperando al host...';
}

function copyCode() {
  navigator.clipboard?.writeText(roomCode).then(() => {
    const btn = event.target; btn.textContent = '✓'; setTimeout(() => btn.textContent = 'Copiar', 2000);
  });
}

socket.on('room:players', (players) => {
  const lists = { rc: document.getElementById('list-rc'), cgo: document.getElementById('list-cgo'), maquinista: document.getElementById('list-maquinista') };
  const counts = { rc: 0, cgo: 0, maquinista: 0 };
  Object.values(lists).forEach(ul => { if (ul) ul.innerHTML = ''; });
  for (const p of players) {
    counts[p.role]++;
    const li = document.createElement('li');
    li.innerHTML = `<span class="dot-green"></span> ${p.name}`;
    if (p.id === socket.id) li.style.fontWeight = '600';
    lists[p.role]?.appendChild(li);
  }
  const rc = document.getElementById('count-rc'), cgo = document.getElementById('count-cgo'), maq = document.getElementById('count-maq');
  if (rc) rc.textContent = `${counts.rc}/5`;
  if (cgo) cgo.textContent = `${counts.cgo}/5`;
  if (maq) maq.textContent = `${counts.maquinista}/20`;
});

function startGame() {
  const btn = document.getElementById('btn-start');
  btn.disabled = true; btn.textContent = 'Iniciando...';
  socket.emit('game:start', {}, (res) => {
    if (!res.ok) { btn.disabled = false; btn.textContent = '🚂 Iniciar Partida'; }
  });
}

socket.on('game:started', () => goToGame());

function goToGame() {
  // Store session for CTC page to read
  sessionStorage.setItem('ctc_session', JSON.stringify({
    room: roomCode, name: myPlayer.name, role: myPlayer.role, host: isHost
  }));
  // Disconnect lobby socket BEFORE navigating
  socket.disconnect();
  // Small delay to ensure disconnect completes, then navigate
  setTimeout(() => { window.location.href = '/ctc.html'; }, 100);
}
