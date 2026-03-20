// ctc-sync.js — Multiplayer sync for CTC simulator
// Single IIFE — intercepts RC actions → server → broadcast → all execute
(function() {
  'use strict';

  // ── Read session ─────────────────────────────────
  const params = JSON.parse(sessionStorage.getItem('ctc_session') || 'null');
  if (!params) {
    console.log('[SYNC] No session — standalone mode');
    return;
  }

  const { room, name, role } = params;
  console.log('[SYNC] Init:', name, role, room);

  const socket = io();
  let connected = false;
  let _bypass = false; // When true, calls go to original function (from broadcast)

  // ── Status bar ───────────────────────────────────
  const bar = document.createElement('div');
  bar.id = 'syncBar';
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;display:flex;align-items:center;gap:8px;padding:4px 12px;font:11px "Share Tech Mono",monospace;background:rgba(7,9,13,0.95);border-bottom:1px solid #1c2535;';
  const roleColor = role === 'rc' ? '#4ea8ff' : role === 'cgo' ? '#a78bfa' : '#f59e0b';
  const roleLabel = role === 'rc' ? '🔧 CONTROL' : role === 'cgo' ? '👁 OBSERVADOR' : '🚂 MAQUINISTA';
  bar.innerHTML = `
    <span style="color:#ffc144" id="syncStatus">⏳ Conectando...</span>
    <span style="color:#4a6070">|</span>
    <span style="color:${roleColor};font-weight:bold">${role.toUpperCase()}</span>
    <span style="color:#4a6070">${name}</span>
    <span style="color:#4a6070">| Sala: <b style="color:#00e87a">${room}</b></span>
    <span style="color:#4a6070">|</span>
    <span id="syncPlayers" style="color:#4a6070">0 jugadores</span>
    <span style="flex:1"></span>
    <span style="color:${roleColor};font-weight:bold">${roleLabel}</span>`;
  document.body.prepend(bar);
  document.body.style.paddingTop = '28px';

  // ── Wait for CTC to fully initialize, then capture functions ──
  // The CTC code runs synchronously in the <script> before us,
  // so by the time this script runs, all functions exist on window.

  // Capture ALL original CTC functions
  const O = {};
  const fnList = [
    'openRoute', 'cancelRoute', 'doSpawn', 'mAsp', 'onSw', 'onSig',
    'reqBlk', 'grantBlk', 'clearBlk', 'scenario', 'resetSim', 'resetSim2',
    'tPause', 'setTrSpeed', 'trCmd', 'sigToSig', 'undoLast', 'spawnTrain', 'runScn'
  ];
  fnList.forEach(fn => {
    if (typeof window[fn] === 'function') {
      O[fn] = window[fn].bind(window);
    }
  });
  console.log('[SYNC] Captured', Object.keys(O).length, 'functions');

  // ── Send action to server ────────────────────────
  function send(type, args, ctx) {
    if (!connected) {
      console.warn('[SYNC] Not connected, executing locally');
      if (O[type]) O[type](...(args || []));
      return;
    }
    socket.emit('action', { type, args: args || [], ctx: ctx || {} });
  }

  // ── Execute action locally (from broadcast) ──────
  function execFromBroadcast(type, args, ctx) {
    _bypass = true;
    try {
      // Restore context
      if (ctx && ctx.sel !== undefined && window.S) window.S.sel = ctx.sel;
      if (ctx && ctx.selTrId !== undefined) window.selTrId = ctx.selTrId;
      if (ctx && ctx.scnVal !== undefined) {
        const sel = document.getElementById('scnSel');
        if (sel) sel.value = ctx.scnVal;
      }

      if (O[type]) {
        O[type](...(args || []));
      } else {
        console.warn('[SYNC] No original for:', type);
      }

      // Sync UI elements after execution
      if (type === 'setTrSpeed') {
        const sel = document.getElementById('spdSel');
        if (sel) sel.value = args[0];
      }
    } catch (e) {
      console.error('[SYNC] Exec error:', type, e);
    }
    _bypass = false;
  }

  // ══════════════════════════════════════════════════
  // RC: Override functions to go through server
  // ══════════════════════════════════════════════════
  if (role === 'rc') {
    window.openRoute = function(rk) {
      if (_bypass) return O.openRoute(rk);
      send('openRoute', [rk]);
    };
    window.cancelRoute = function(rk) {
      if (_bypass) return O.cancelRoute(rk);
      send('cancelRoute', [rk]);
    };
    window.doSpawn = function(dir) {
      if (_bypass) return O.doSpawn(dir);
      send('doSpawn', [dir]);
    };
    window.mAsp = function(a) {
      if (_bypass) return O.mAsp(a);
      send('mAsp', [a], { sel: window.S ? window.S.sel : null });
    };
    window.onSw = function(id) {
      if (_bypass) return O.onSw(id);
      send('onSw', [id]);
    };
    window.reqBlk = function(n, d, v) {
      if (_bypass) return O.reqBlk(n, d, v);
      send('reqBlk', [n, d, v]);
    };
    window.grantBlk = function(n, v) {
      if (_bypass) return O.grantBlk(n, v);
      send('grantBlk', [n, v]);
    };
    window.clearBlk = function(n, v) {
      if (_bypass) return O.clearBlk(n, v);
      send('clearBlk', [n, v]);
    };
    window.scenario = function(n) {
      if (_bypass) return O.scenario(n);
      send('scenario', [n]);
    };
    window.resetSim = function() {
      if (_bypass) return O.resetSim();
      send('resetSim', []);
    };
    window.resetSim2 = function() {
      if (_bypass) return O.resetSim2();
      send('resetSim2', []);
    };
    window.tPause = function() {
      if (_bypass) return O.tPause();
      send('tPause', []);
    };
    window.setTrSpeed = function(v) {
      if (_bypass) return O.setTrSpeed(v);
      send('setTrSpeed', [v]);
    };
    window.trCmd = function(cmd) {
      if (_bypass) return O.trCmd(cmd);
      send('trCmd', [cmd], { selTrId: window.selTrId });
    };
    window.sigToSig = function(a, b) {
      if (_bypass) return O.sigToSig(a, b);
      send('sigToSig', [a, b]);
    };
    window.undoLast = function() {
      if (_bypass) return O.undoLast();
      send('undoLast', []);
    };
    window.spawnTrain = function() {
      if (_bypass) return O.spawnTrain();
      const dir = document.getElementById('tDir') ? document.getElementById('tDir').value : 'AB';
      send('doSpawn', [dir]);
    };
    window.runScn = function() {
      if (_bypass) return O.runScn();
      const v = document.getElementById('scnSel') ? parseInt(document.getElementById('scnSel').value) : 0;
      if (v > 0) send('scenario', [v], { scnVal: v });
    };

    // onSig: first click is local (selection ring), second click triggers sigToSig via server
    window.onSig = function(id) {
      if (_bypass) return O.onSig(id);

      if (window.S && window.S.mode === 'auto') {
        if (window.S.pending) {
          if (window.S.pending === id) {
            // Cancel selection
            if (typeof window.clearPend === 'function') window.clearPend();
            return;
          }
          const pendId = window.S.pending;
          if (typeof window.clearPend === 'function') window.clearPend();
          // Send sigToSig through server
          send('sigToSig', [pendId, id]);
          return;
        }
        // First click: local selection only
        O.onSig(id);
      } else {
        // Manual mode: local selection
        O.onSig(id);
      }
    };

    console.log('[SYNC] RC overrides installed');
  }

  // ══════════════════════════════════════════════════
  // CGO: Block all modifications, receive broadcasts
  // ══════════════════════════════════════════════════
  if (role === 'cgo') {
    // Block modification functions — they'll still work when called via broadcast
    ['openRoute', 'cancelRoute', 'doSpawn', 'mAsp', 'reqBlk', 'grantBlk',
     'clearBlk', 'scenario', 'resetSim', 'resetSim2', 'spawnTrain', 'runScn',
     'undoLast', 'trCmd'].forEach(fn => {
      window[fn] = function() {
        if (_bypass && O[fn]) return O[fn](...arguments);
        // Blocked for CGO user interaction
      };
    });

    window.onSig = function(id) {
      if (_bypass && O.onSig) return O.onSig(...arguments);
      // Show info only
      var sg = window.SIGS ? window.SIGS[id] : null;
      if (sg && window.log) window.log('👁 ' + sg.l + ' (' + sg.t + ') — solo lectura', 'i');
    };

    window.onSw = function(id) {
      if (_bypass && O.onSw) return O.onSw(...arguments);
      // Blocked
    };

    window.sigToSig = function(a, b) {
      if (_bypass && O.sigToSig) return O.sigToSig(...arguments);
      // Blocked
    };

    // CGO can pause/speed locally
    // tPause and setTrSpeed stay as originals for local use
    // But also respond to broadcasts
    window.tPause = function() {
      if (O.tPause) O.tPause();
    };
    window.setTrSpeed = function(v) {
      if (O.setTrSpeed) O.setTrSpeed(v);
    };

    // Hide modify UI
    setTimeout(function() {
      var mi = document.getElementById('mi');
      if (mi) mi.textContent = 'MODO: OBSERVADOR CGO (solo lectura)';
      var sections = document.querySelectorAll('.sg');
      for (var i = 0; i < sections.length; i++) {
        var t = sections[i].querySelector('.sg-t');
        if (!t) continue;
        var txt = t.textContent.toLowerCase();
        if (txt.indexOf('modo') >= 0 || txt.indexOf('manual') >= 0 ||
            txt.indexOf('tren manual') >= 0 || txt.indexOf('grabación') >= 0) {
          sections[i].style.display = 'none';
        }
      }
    }, 500);

    console.log('[SYNC] CGO overrides installed');
  }

  // ══════════════════════════════════════════════════
  // MAQUINISTA: Same as CGO for now (see CTC, read only)
  // Future: will have cab view
  // ══════════════════════════════════════════════════
  if (role === 'maquinista') {
    // Same blocking as CGO
    ['openRoute', 'cancelRoute', 'doSpawn', 'mAsp', 'reqBlk', 'grantBlk',
     'clearBlk', 'scenario', 'resetSim', 'resetSim2', 'spawnTrain', 'runScn',
     'undoLast', 'trCmd'].forEach(fn => {
      window[fn] = function() {
        if (_bypass && O[fn]) return O[fn](...arguments);
      };
    });
    window.onSig = function(id) {
      if (_bypass && O.onSig) return O.onSig(...arguments);
    };
    window.onSw = function(id) {
      if (_bypass && O.onSw) return O.onSw(...arguments);
    };
    window.sigToSig = function(a, b) {
      if (_bypass && O.sigToSig) return O.sigToSig(...arguments);
    };
    window.tPause = function() { if (O.tPause) O.tPause(); };
    window.setTrSpeed = function(v) { if (O.setTrSpeed) O.setTrSpeed(v); };

    setTimeout(function() {
      var mi = document.getElementById('mi');
      if (mi) mi.textContent = 'MODO: MAQUINISTA (observación CTC)';
    }, 500);

    console.log('[SYNC] MAQ overrides installed');
  }

  // ══════════════════════════════════════════════════
  // ALL ROLES: Receive and execute broadcasts
  // ══════════════════════════════════════════════════
  socket.on('action:exec', function(data) {
    console.log('[SYNC] Broadcast:', data.type, data.args, 'from:', data.from);
    execFromBroadcast(data.type, data.args, data.ctx);
  });

  // ══════════════════════════════════════════════════
  // CONNECTION
  // ══════════════════════════════════════════════════
  socket.on('connect', function() {
    console.log('[SYNC] Socket connected, joining room:', room);
    socket.emit('room:join', { name: name, code: room, role: role }, function(res) {
      var el = document.getElementById('syncStatus');
      if (res.ok) {
        connected = true;
        el.innerHTML = '🟢 Conectado';
        el.style.color = '#00e87a';
        console.log('[SYNC] Joined room successfully');
      } else {
        el.innerHTML = '🔴 ' + (res.reason || 'Error');
        el.style.color = '#ff4444';
        console.error('[SYNC] Join failed:', res.reason);
      }
    });
  });

  socket.on('disconnect', function() {
    connected = false;
    var el = document.getElementById('syncStatus');
    el.innerHTML = '🟡 Reconectando...';
    el.style.color = '#ffc144';
  });

  socket.on('room:players', function(players) {
    var el = document.getElementById('syncPlayers');
    if (el) el.textContent = players.length + ' jugadores';
  });

  socket.on('room:player-left', function(data) {
    if (window.log) window.log('👋 ' + data.name + ' se ha desconectado', 'i');
  });

  socket.on('comms:message', function(msg) {
    if (window.log) window.log('📻 ' + msg.from + ': ' + msg.text, 'i');
  });

})();
