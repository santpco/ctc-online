// ctc-sync.js — Multiplayer sync for CTC simulator
// Intercepts RC actions → server → broadcast → all execute
(function() {
  'use strict';
  const params = JSON.parse(sessionStorage.getItem('ctc_session') || 'null');
  if (!params) return; // Standalone mode

  const { room, name, role, host } = params;
  const socket = io();
  let _bypass = false; // When true, functions run locally (from broadcast)

  // ── Status bar ───────────────────────────────────
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;display:flex;align-items:center;gap:8px;padding:4px 12px;font:11px "Share Tech Mono",monospace;background:rgba(7,9,13,0.95);border-bottom:1px solid #1c2535;';
  bar.innerHTML = `<span style="color:#ffc144" id="syncStatus">⏳ Conectando...</span>
    <span style="color:#4a6070">|</span>
    <span style="color:${role==='rc'?'#4ea8ff':role==='cgo'?'#a78bfa':'#f59e0b'};font-weight:bold">${role.toUpperCase()}</span>
    <span style="color:#4a6070">${name}</span>
    <span style="color:#4a6070">| Sala: <b style="color:#00e87a">${room}</b></span>
    <span style="color:#4a6070">|</span>
    <span id="syncPlayers" style="color:#4a6070">0 jugadores</span>
    <span style="flex:1"></span>
    <span style="color:${role==='rc'?'#4ea8ff':role==='cgo'?'#a78bfa':'#f59e0b'};font-weight:bold">
      ${role==='rc'?'🔧 CONTROL':role==='cgo'?'👁 OBSERVADOR':'🚂 MAQUINISTA'}</span>`;
  document.body.prepend(bar);
  document.body.style.paddingTop = '28px';

  // ── Capture original CTC functions ───────────────
  const O = {};
  ['openRoute','cancelRoute','doSpawn','mAsp','onSw','onSig','reqBlk','grantBlk',
   'clearBlk','scenario','resetSim','resetSim2','tPause','setTrSpeed',
   'trCmd','sigToSig','undoLast','spawnTrain','runScn'].forEach(fn => {
    if (typeof window[fn] === 'function') O[fn] = window[fn];
  });

  // ── Send action to server ────────────────────────
  function send(type, args, ctx) {
    socket.emit('action', { type, args: args || [], ctx: ctx || {} });
  }

  // ── Execute action locally (from broadcast) ──────
  function exec(type, args, ctx) {
    _bypass = true;
    try {
      if (ctx?.sel !== undefined && window.S) window.S.sel = ctx.sel;
      if (ctx?.selTrId !== undefined) window.selTrId = ctx.selTrId;
      if (O[type]) O[type](...(args || []));
      if (type === 'setTrSpeed') { const s = document.getElementById('spdSel'); if (s) s.value = args[0]; }
    } catch (e) { console.error('[SYNC]', type, e); }
    _bypass = false;
  }

  // ══════════════════════════════════════════════════
  // RC: Override functions to go through server
  // ══════════════════════════════════════════════════
  if (role === 'rc') {
    window.openRoute = function(rk) { if (_bypass) return O.openRoute(rk); send('openRoute', [rk]); };
    window.cancelRoute = function(rk) { if (_bypass) return O.cancelRoute(rk); send('cancelRoute', [rk]); };
    window.doSpawn = function(dir) { if (_bypass) return O.doSpawn(dir); send('doSpawn', [dir]); };
    window.mAsp = function(a) { if (_bypass) return O.mAsp(a); send('mAsp', [a], { sel: window.S?.sel }); };
    window.onSw = function(id) { if (_bypass) return O.onSw(id); send('onSw', [id]); };
    window.reqBlk = function(n, d, v) { if (_bypass) return O.reqBlk(n, d, v); send('reqBlk', [n, d, v]); };
    window.grantBlk = function(n, v) { if (_bypass) return O.grantBlk(n, v); send('grantBlk', [n, v]); };
    window.clearBlk = function(n, v) { if (_bypass) return O.clearBlk(n, v); send('clearBlk', [n, v]); };
    window.scenario = function(n) { if (_bypass) return O.scenario(n); send('scenario', [n]); };
    window.resetSim = function() { if (_bypass) return O.resetSim(); send('resetSim', []); };
    window.resetSim2 = function() { if (_bypass) return O.resetSim2(); send('resetSim2', []); };
    window.tPause = function() { if (_bypass) return O.tPause(); send('tPause', []); };
    window.setTrSpeed = function(v) { if (_bypass) return O.setTrSpeed(v); send('setTrSpeed', [v]); };
    window.trCmd = function(cmd) { if (_bypass) return O.trCmd(cmd); send('trCmd', [cmd], { selTrId: window.selTrId }); };
    window.sigToSig = function(a, b) { if (_bypass) return O.sigToSig(a, b); send('sigToSig', [a, b]); };
    window.undoLast = function() { if (_bypass) return O.undoLast(); send('undoLast', []); };
    window.spawnTrain = function() { if (_bypass) return O.spawnTrain(); send('spawnTrain', []); };
    window.runScn = function() {
      if (_bypass) return O.runScn();
      const v = parseInt(document.getElementById('scnSel')?.value || '0');
      send('scenario', [v]);
    };

    // onSig: selection is local, sigToSig goes through server
    window.onSig = function(id) {
      if (_bypass) return O.onSig(id);
      if (window.S?.mode === 'auto') {
        if (window.S.pending) {
          if (window.S.pending === id) { if (window.clearPend) window.clearPend(); return; }
          const p = window.S.pending;
          if (window.clearPend) window.clearPend();
          send('sigToSig', [p, id]);
        } else {
          O.onSig(id); // First click: local selection ring
        }
      } else {
        O.onSig(id); // Manual mode: local selection
      }
    };
  }

  // ══════════════════════════════════════════════════
  // CGO: Block all modifications
  // ══════════════════════════════════════════════════
  if (role === 'cgo') {
    ['openRoute','cancelRoute','doSpawn','mAsp','reqBlk','grantBlk','clearBlk',
     'scenario','resetSim','resetSim2','spawnTrain','runScn','undoLast','trCmd'].forEach(fn => {
      window[fn] = function() {};
    });
    window.onSig = function(id) {
      const sg = window.SIGS?.[id];
      if (sg && window.log) window.log('👁 ' + sg.l + ' (' + sg.t + ') — solo lectura', 'i');
    };
    window.onSw = function() {};
    // CGO can pause/speed locally for comfort
    window.tPause = O.tPause;
    window.setTrSpeed = O.setTrSpeed;

    setTimeout(() => {
      const mi = document.getElementById('mi');
      if (mi) mi.textContent = 'MODO: OBSERVADOR CGO (solo lectura)';
      document.querySelectorAll('.sg').forEach(s => {
        const t = s.querySelector('.sg-t');
        if (!t) return;
        const txt = t.textContent.toLowerCase();
        if (txt.includes('modo') || txt.includes('manual') || txt.includes('tren manual') || txt.includes('grabación'))
          s.style.display = 'none';
      });
    }, 300);
  }

  // ══════════════════════════════════════════════════
  // ALL ROLES: Receive and execute broadcasts
  // ══════════════════════════════════════════════════
  socket.on('action:exec', (data) => {
    exec(data.type, data.args, data.ctx);
  });

  // ══════════════════════════════════════════════════
  // CONNECTION
  // ══════════════════════════════════════════════════
  socket.on('connect', () => {
    socket.emit('room:join', { name, code: room, role }, (res) => {
      const el = document.getElementById('syncStatus');
      if (res.ok) { el.innerHTML = '🟢 Conectado'; el.style.color = '#00e87a'; }
      else { el.innerHTML = '🔴 ' + res.reason; el.style.color = '#ff4444'; }
    });
  });
  socket.on('disconnect', () => {
    const el = document.getElementById('syncStatus');
    el.innerHTML = '🟡 Reconectando...'; el.style.color = '#ffc144';
  });
  socket.on('room:players', (players) => {
    const el = document.getElementById('syncPlayers');
    if (el) el.textContent = players.length + ' jugadores';
  });
  socket.on('comms:message', (msg) => {
    if (window.log) window.log('📻 ' + msg.from + ': ' + msg.text, 'i');
  });
})();
