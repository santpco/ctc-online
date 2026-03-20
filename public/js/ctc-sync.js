// ctc-sync.js — Definitive multiplayer sync
// FIX: Non-master clients position trains using x,y directly, NOT local path
(function() {
  'use strict';
  var params = JSON.parse(sessionStorage.getItem('ctc_session') || 'null');
  if (!params) return;
  var room = params.room, name = params.name, role = params.role;
  var socket = io(), connected = false, isMaster = false, _bypass = false;
  var myTrainId = null;

  // ── Status bar ───────────────────────────────────
  var bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;display:flex;align-items:center;gap:8px;padding:4px 12px;font:11px "Share Tech Mono",monospace;background:rgba(7,9,13,0.95);border-bottom:1px solid #1c2535;';
  var clr = role === 'rc' ? '#4ea8ff' : role === 'cgo' ? '#a78bfa' : '#f59e0b';
  bar.innerHTML = '<span style="color:#ffc144" id="syncStatus">⏳</span>' +
    '<span style="color:#4a6070">|</span>' +
    '<span style="color:' + clr + ';font-weight:bold">' + role.toUpperCase() + '</span> ' +
    '<span style="color:#4a6070">' + name + '</span>' +
    '<span style="color:#4a6070">| <b style="color:#00e87a">' + room + '</b></span>' +
    '<span style="color:#4a6070">|</span>' +
    '<span id="syncPlayers" style="color:#4a6070">0</span>' +
    '<span id="syncMaster" style="color:#ffc144;margin-left:4px"></span>' +
    '<span style="flex:1"></span>' +
    '<span style="color:' + clr + '">' + (role === 'rc' ? '🔧 RC' : role === 'cgo' ? '👁 CGO' : '🚂 MAQ') + '</span>';
  document.body.prepend(bar);
  document.body.style.paddingTop = '28px';

  // ── Capture originals ────────────────────────────
  var O = {};
  ['openRoute', 'cancelRoute', 'doSpawn', 'mAsp', 'onSw', 'onSig', 'reqBlk', 'grantBlk',
    'clearBlk', 'scenario', 'resetSim', 'resetSim2', 'tPause', 'setTrSpeed',
    'trCmd', 'sigToSig', 'undoLast', 'spawnTrain', 'runScn', 'posTr', 'updSeg',
    'tickTrains', 'updUI', 'updTrainPanel', 'updPN', 'mallaTrack', 'drawMalla',
    'syncAvz', 'updBlkD', 'updAsp'].forEach(function(fn) {
    if (typeof window[fn] === 'function') O[fn] = window[fn];
  });

  function send(t, a, c) {
    if (!connected) { if (O[t]) O[t].apply(null, a || []); return; }
    socket.emit('action', { type: t, args: a || [], ctx: c || {} });
  }
  function execB(t, a, c) {
    _bypass = true;
    try {
      if (c && c.sel !== undefined && window.S) window.S.sel = c.sel;
      if (c && c.selTrId !== undefined) window.selTrId = c.selTrId;
      if (c && c.scnVal !== undefined) { var s = document.getElementById('scnSel'); if (s) s.value = c.scnVal; }
      if (O[t]) O[t].apply(null, a || []);
      if (t === 'setTrSpeed') { var s2 = document.getElementById('spdSel'); if (s2) s2.value = a[0]; }
    } catch (e) { console.error('[S]', t, e); }
    _bypass = false;
  }

  // ── Direct position: move train SVG element using x,y coordinates ──
  // This bypasses posTr which uses local path array (can differ between clients)
  function directPosition(train, x, y) {
    if (train.el) {
      train.el.setAttribute('transform', 'translate(' + (x - 27) + ',' + (y - 10) + ')');
    }
    // Store for maquinista cab rendering
    train._syncX = x;
    train._syncY = y;
  }

  // ══════════════════════════════════════════════════
  // RC OVERRIDES
  // ══════════════════════════════════════════════════
  if (role === 'rc') {
    window.openRoute = function(rk) { if (_bypass) return O.openRoute(rk); send('openRoute', [rk]); };
    window.cancelRoute = function(rk) { if (_bypass) return O.cancelRoute(rk); send('cancelRoute', [rk]); };
    window.doSpawn = function(dir) { if (_bypass) return O.doSpawn(dir); send('doSpawn', [dir]); };
    window.mAsp = function(a) { if (_bypass) return O.mAsp(a); send('mAsp', [a], { sel: window.S ? window.S.sel : null }); };
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
    window.spawnTrain = function() {
      if (_bypass) return O.spawnTrain();
      var dir = document.getElementById('tDir') ? document.getElementById('tDir').value : 'AB';
      send('doSpawn', [dir]);
    };
    window.runScn = function() {
      if (_bypass) return O.runScn();
      var v = document.getElementById('scnSel') ? parseInt(document.getElementById('scnSel').value) : 0;
      if (v > 0) send('scenario', [v], { scnVal: v });
    };
    window.onSig = function(id) {
      if (_bypass) return O.onSig(id);
      if (window.S && window.S.mode === 'auto') {
        if (window.S.pending) {
          if (window.S.pending === id) { if (window.clearPend) window.clearPend(); return; }
          var p = window.S.pending; if (window.clearPend) window.clearPend();
          send('sigToSig', [p, id]); return;
        }
        O.onSig(id);
      } else { O.onSig(id); }
    };

    // Background-safe simulation for master RC
    var bgInterval = null;
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        bgInterval = setInterval(function() {
          if (window.S && !window.S.paused) {
            if (O.tickTrains) O.tickTrains();
            if (window.S.tick % 8 === 0 && O.updUI) O.updUI();
            if (window.S.tick % 4 === 0 && O.updPN) O.updPN();
            if (typeof window.simTime === 'number') window.simTime += 0.05;
            if (window.S.tick % 3 === 0 && O.mallaTrack) O.mallaTrack();
            window.S.tick++;
          }
        }, 18);
      } else {
        if (bgInterval) { clearInterval(bgInterval); bgInterval = null; }
      }
    });

    socket.on('master:promoted', function() {
      isMaster = true;
      var m = document.getElementById('syncMaster'); if (m) m.textContent = '★ MASTER';
    });

    // Broadcast train+signal+block state every 250ms
    setInterval(function() {
      if (!connected || !isMaster || !window.S) return;
      var trains = window.S.trains, d = [];
      for (var i = 0; i < trains.length; i++) {
        var tr = trains[i]; if (tr.done) continue;
        var idx = Math.min(tr.pi, tr.pts.length - 2);
        var p = tr.pts[idx], q = tr.pts[idx + 1];
        var tx = p ? p.x + (q.x - p.x) * tr.t : 0;
        var ty = p ? p.y + (q.y - p.y) * tr.t : 0;
        d.push({
          id: tr.id, x: Math.round(tx * 10) / 10, y: Math.round(ty * 10) / 10,
          spd: tr.spd, w: tr.w, mHold: tr.mHold, sl: tr.sl, cs: tr.cs,
          dir: tr.dir, stopTimer: tr.stopTimer || 0, color: tr.color || '#e8a020'
        });
      }
      var sigs = {};
      if (window.S.sig) { for (var sid in window.S.sig) sigs[sid] = { asp: window.S.sig[sid].asp }; }
      var blks = [], blkv2 = [];
      if (window.S.blk) { for (var bi = 0; bi < window.S.blk.length; bi++) { var b = window.S.blk[bi]; blks.push(b ? { s: b.s, d: b.d } : null); } }
      if (window.S.blkV2) { for (var bi2 = 0; bi2 < window.S.blkV2.length; bi2++) { var bv = window.S.blkV2[bi2]; blkv2.push(bv ? { s: bv.s, d: bv.d } : null); } }
      socket.volatile.emit('train:sync', {
        trains: d, tick: window.S.tick, paused: window.S.paused,
        simTime: window.simTime || 0, trSpeedMult: window.trSpeedMult || 1,
        signals: sigs, blks: blks, blkv2: blkv2
      });
    }, 250);
  }

  // ══════════════════════════════════════════════════
  // CGO & MAQUINISTA: No local simulation
  // ══════════════════════════════════════════════════
  if (role === 'cgo' || role === 'maquinista') {
    // CRITICAL: Disable local train movement
    window.tickTrains = function() {};

    // Block user interactions (allow via _bypass from broadcasts)
    ['openRoute', 'cancelRoute', 'doSpawn', 'mAsp', 'reqBlk', 'grantBlk', 'clearBlk',
      'scenario', 'resetSim', 'resetSim2', 'spawnTrain', 'runScn', 'undoLast', 'trCmd',
      'tPause', 'setTrSpeed'].forEach(function(fn) {
      window[fn] = function() { if (_bypass && O[fn]) return O[fn].apply(null, arguments); };
    });
    window.onSig = function() { if (_bypass && O.onSig) return O.onSig.apply(null, arguments); };
    window.onSw = function() { if (_bypass && O.onSw) return O.onSw.apply(null, arguments); };
    window.sigToSig = function() { if (_bypass && O.sigToSig) return O.sigToSig.apply(null, arguments); };

    // ── RECEIVE TRAIN SYNC ──
    socket.on('train:sync', function(data) {
      if (!window.S) return;

      // Sync globals
      if (typeof data.trSpeedMult === 'number') window.trSpeedMult = data.trSpeedMult;
      if (typeof data.simTime === 'number') window.simTime = data.simTime;
      if (typeof data.paused === 'boolean') {
        window.S.paused = data.paused;
        var pb = document.getElementById('pBtn'); if (pb) pb.textContent = data.paused ? '▶' : '⏸';
      }
      window.S.tick = data.tick || window.S.tick;

      var st = data.trains || [];

      // ── Position each train using DIRECT x,y from RC ──
      for (var si = 0; si < st.length; si++) {
        var sd = st[si], local = null;
        for (var li = 0; li < window.S.trains.length; li++) {
          if (window.S.trains[li].id === sd.id) { local = window.S.trains[li]; break; }
        }
        if (!local) continue;

        // Update state
        local.spd = sd.spd; local.w = sd.w; local.mHold = sd.mHold;
        local.sl = sd.sl; local.dir = sd.dir; local.stopTimer = sd.stopTimer;

        // Update segment
        if (sd.cs !== local.cs) {
          if (local.cs && window.S.seg[local.cs]) { window.S.seg[local.cs].occ = false; if (O.updSeg) O.updSeg(local.cs); }
          local.cs = sd.cs;
          if (local.cs && window.S.seg[local.cs]) { window.S.seg[local.cs].occ = true; if (O.updSeg) O.updSeg(local.cs); }
        }

        // ★ KEY FIX: Position using x,y directly, NOT posTr ★
        directPosition(local, sd.x, sd.y);
      }

      // Remove trains RC no longer has
      for (var ri = window.S.trains.length - 1; ri >= 0; ri--) {
        var tr = window.S.trains[ri], found = false;
        for (var fi = 0; fi < st.length; fi++) { if (st[fi].id === tr.id) { found = true; break; } }
        if (!found) { tr.done = true; if (tr.el) tr.el.remove(); if (tr.pathLine) tr.pathLine.remove(); window.S.trains.splice(ri, 1); }
      }

      // Sync blocks
      if (data.blks && window.S.blk) {
        for (var bn = 1; bn < data.blks.length && bn < window.S.blk.length; bn++) {
          if (!data.blks[bn] || !window.S.blk[bn]) continue;
          if (window.S.blk[bn].s !== data.blks[bn].s || window.S.blk[bn].d !== data.blks[bn].d) {
            window.S.blk[bn].s = data.blks[bn].s; window.S.blk[bn].d = data.blks[bn].d;
            if (O.updBlkD) O.updBlkD(bn, 'V1');
          }
        }
      }
      if (data.blkv2 && window.S.blkV2) {
        for (var bv = 1; bv < data.blkv2.length && bv < window.S.blkV2.length; bv++) {
          if (!data.blkv2[bv] || !window.S.blkV2[bv]) continue;
          if (window.S.blkV2[bv].s !== data.blkv2[bv].s || window.S.blkV2[bv].d !== data.blkv2[bv].d) {
            window.S.blkV2[bv].s = data.blkv2[bv].s; window.S.blkV2[bv].d = data.blkv2[bv].d;
            if (O.updBlkD) O.updBlkD(bv, 'V2');
          }
        }
      }

      // Sync signals
      if (data.signals && window.S.sig) {
        for (var sigId in data.signals) {
          if (window.S.sig[sigId] && window.S.sig[sigId].asp !== data.signals[sigId].asp) {
            if (O.updAsp) O.updAsp(sigId, data.signals[sigId].asp);
          }
        }
      }

      // Update UI panels
      if (O.updUI) O.updUI();
      if (O.updTrainPanel) O.updTrainPanel();

      // Maquinista: update cab or train grid
      if (role === 'maquinista') {
        if (myTrainId) {
          renderCab(data);
        } else {
          updateTrainGrid(st);
        }
      }
    });

    // CGO: hide UI
    if (role === 'cgo') {
      setTimeout(function() {
        var mi = document.getElementById('mi'); if (mi) mi.textContent = 'OBSERVADOR CGO (solo lectura)';
        document.querySelectorAll('.sg').forEach(function(s) {
          var t = s.querySelector('.sg-t'); if (!t) return; var tx = t.textContent.toLowerCase();
          if (tx.indexOf('modo') >= 0 || tx.indexOf('manual') >= 0 || tx.indexOf('tren manual') >= 0 ||
            tx.indexOf('grabación') >= 0 || tx.indexOf('escenario') >= 0 || tx.indexOf('rutas') >= 0 ||
            tx.indexOf('bloqueos') >= 0) s.style.display = 'none';
        });
        var sp = document.getElementById('spdSel'); if (sp) sp.parentElement.style.display = 'none';
        document.querySelectorAll('.sg').forEach(function(s) { if (s.querySelector('#pBtn')) s.style.display = 'none'; });
      }, 500);
    }

    // Maquinista: build cab view
    if (role === 'maquinista') setTimeout(buildCabView, 400);
  }

  // ══════════════════════════════════════════════════
  // MAQUINISTA CAB
  // ══════════════════════════════════════════════════
  var cabCanvas = null, cabCtx = null;

  function buildCabView() {
    // Hide CTC
    var dw = document.querySelector('.dw'); if (dw) dw.style.display = 'none';
    var sb = document.querySelector('.sb'); if (sb) sb.style.display = 'none';
    var vt = document.getElementById('viewToggle'); if (vt) vt.style.display = 'none';

    var cab = document.createElement('div');
    cab.style.cssText = 'flex:1;display:flex;flex-direction:column;background:#070a0e;overflow:hidden;';

    // Selection screen
    var sel = document.createElement('div'); sel.id = 'maqSelect';
    sel.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;';
    sel.innerHTML = '<div style="font:bold 24px Rajdhani,sans-serif;color:#f59e0b">🚂 Selecciona tu tren</div>' +
      '<div style="font:12px \'Share Tech Mono\',monospace;color:#4a6070">El RC debe crear un tren (Tren Manual → Lanzar)</div>' +
      '<div id="maqTrainGrid" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:600px"></div>' +
      '<div id="maqWaiting" style="font:11px \'Share Tech Mono\',monospace;color:#ffc144;margin-top:10px">Esperando trenes...</div>';
    cab.appendChild(sel);

    // Cab view
    var inner = document.createElement('div'); inner.id = 'cabInner';
    inner.style.cssText = 'flex:1;display:none;flex-direction:column;';
    inner.innerHTML =
      '<div style="flex:1;position:relative;overflow:hidden;background:#080c14;min-height:200px">' +
      '<canvas id="cabCanvas" style="width:100%;height:100%;display:block"></canvas></div>' +
      '<div style="height:110px;background:#0d1117;border-top:1px solid #1c2535;display:flex;align-items:center;justify-content:center;gap:24px;padding:12px;flex-wrap:wrap;">' +
      '<div style="text-align:center;min-width:70px">' +
      '<div style="font:bold 42px Rajdhani,sans-serif;color:#00e87a" id="cabSpeed">0</div>' +
      '<div style="font:9px \'Share Tech Mono\',monospace;color:#4a6070">km/h</div></div>' +
      '<div style="display:flex;flex-direction:column;gap:2px;min-width:130px">' +
      '<div style="font:11px \'Share Tech Mono\',monospace;color:#fff" id="cabTrainId">---</div>' +
      '<div style="font:10px \'Share Tech Mono\',monospace;color:#4a6070" id="cabState">---</div>' +
      '<div style="font:10px \'Share Tech Mono\',monospace;color:#4a6070" id="cabPos">---</div></div>' +
      '<div style="display:flex;gap:6px">' +
      '<button onclick="window._maqCmd(\'go\')" style="padding:8px 16px;font:bold 13px Rajdhani;background:#0e3320;color:#44dd77;border:1px solid #1a5533;border-radius:5px;cursor:pointer">▶ Marcha</button>' +
      '<button onclick="window._maqCmd(\'stop\')" style="padding:8px 16px;font:bold 13px Rajdhani;background:#661616;color:#ff6666;border:1px solid #882222;border-radius:5px;cursor:pointer">⏹ Parar</button>' +
      '<button onclick="window._maqCmd(\'rev\')" style="padding:8px 16px;font:bold 13px Rajdhani;background:#1a1a40;color:#8888ff;border:1px solid #333366;border-radius:5px;cursor:pointer">↩ Retro</button></div>' +
      '<div style="display:flex;align-items:center;gap:6px">' +
      '<div style="font:8px \'Share Tech Mono\',monospace;color:#4a6070">Señal:</div>' +
      '<div id="cabSigAsp" style="width:18px;height:18px;border-radius:50%;background:#222;border:2px solid #333"></div>' +
      '<div id="cabSigName" style="font:10px \'Share Tech Mono\',monospace;color:#8888aa">---</div></div>' +
      '</div>';
    cab.appendChild(inner);

    var appEl = document.querySelector('.app');
    if (appEl) appEl.appendChild(cab);

    window._maqCmd = function(cmd) {
      if (!myTrainId || !connected) return;
      socket.emit('maq:cmd', { trainId: myTrainId, cmd: cmd });
    };

    cabCanvas = document.getElementById('cabCanvas');
    if (cabCanvas) cabCtx = cabCanvas.getContext('2d');
    window.addEventListener('resize', resizeCab);
  }

  function resizeCab() {
    if (!cabCanvas || !cabCanvas.parentElement) return;
    cabCanvas.width = cabCanvas.parentElement.clientWidth;
    cabCanvas.height = cabCanvas.parentElement.clientHeight;
  }

  function updateTrainGrid(trains) {
    var grid = document.getElementById('maqTrainGrid');
    var waiting = document.getElementById('maqWaiting');
    if (!grid) return;
    if (!trains || trains.length === 0) {
      if (waiting) waiting.style.display = '';
      return;
    }
    if (waiting) waiting.style.display = 'none';
    // Rebuild grid every time (simple, ensures accuracy)
    grid.innerHTML = '';
    for (var i = 0; i < trains.length; i++) {
      var tr = trains[i];
      var card = document.createElement('div');
      card.style.cssText = 'padding:12px 18px;background:#151b25;border:2px solid #1c2535;border-radius:8px;cursor:pointer;text-align:center;min-width:90px;transition:border-color 0.2s;';
      card.innerHTML = '<div style="width:28px;height:10px;background:' + (tr.color || '#e8a020') + ';border-radius:3px;margin:0 auto 5px"></div>' +
        '<div style="font:bold 16px \'Share Tech Mono\',monospace;color:#fff">' + tr.id + '</div>' +
        '<div style="font:9px \'Share Tech Mono\',monospace;color:#4a6070">' + (tr.dir === 'AB' ? '→ Par' : '← Impar') + '</div>';
      card.onmouseover = function() { this.style.borderColor = '#f59e0b'; };
      card.onmouseout = function() { this.style.borderColor = '#1c2535'; };
      (function(tid) { card.onclick = function() { selectMyTrain(tid); }; })(tr.id);
      grid.appendChild(card);
    }
  }

  function selectMyTrain(tid) {
    myTrainId = tid;
    var sel = document.getElementById('maqSelect'); if (sel) sel.style.display = 'none';
    var inner = document.getElementById('cabInner'); if (inner) inner.style.display = 'flex';
    var tid2 = document.getElementById('cabTrainId'); if (tid2) tid2.textContent = 'Tren ' + tid;
    resizeCab();
  }

  function renderCab(data) {
    if (!cabCanvas || !cabCtx || !myTrainId) return;
    var my = null;
    for (var i = 0; i < data.trains.length; i++) { if (data.trains[i].id === myTrainId) { my = data.trains[i]; break; } }
    if (!my) return;

    resizeCab();
    var W = cabCanvas.width, H = cabCanvas.height, ctx = cabCtx;
    if (W < 10 || H < 10) return;

    // Sky
    var sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    sky.addColorStop(0, '#0c1520'); sky.addColorStop(1, '#1a2a3a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.55);
    ctx.fillStyle = '#141810'; ctx.fillRect(0, H * 0.55, W, H * 0.45);
    ctx.fillStyle = '#222018'; ctx.fillRect(0, H * 0.55 - 8, W, 24);

    var rY = H * 0.55;
    ctx.strokeStyle = '#666'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, rY); ctx.lineTo(W, rY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, rY + 10); ctx.lineTo(W, rY + 10); ctx.stroke();

    ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 3;
    var off = (my.x * 2) % 18;
    for (var sx = -20; sx < W + 20; sx += 18) { ctx.beginPath(); ctx.moveTo(sx - off, rY - 4); ctx.lineTo(sx - off, rY + 14); ctx.stroke(); }

    var cx = W / 2, sc = 2.5, SL = window.STN_LBL || {};
    var sigC = { STOP: '#ff2222', GO: '#00ee55', PREC: '#ffcc00', PREC_ADV: '#ffcc00', PREC_PRE: '#ffcc00', AN_PAR: '#ffcc00', REBASE: '#ff8800' };
    var nextSN = '---', nextSA = 'STOP', nextSD = 99999;

    // Stations
    if (window.XS && window.STNS) {
      for (var si = 0; si < window.STNS.length; si++) {
        var p = window.STNS[si], X = window.XS[p], ssx = cx + (X.center - my.x) * sc;
        if (ssx < -200 || ssx > W + 200) continue;
        ctx.fillStyle = '#2a2520'; ctx.fillRect(ssx - 50, rY - 14, 100, 10);
        ctx.strokeStyle = '#444'; ctx.lineWidth = 1; ctx.strokeRect(ssx - 50, rY - 14, 100, 10);
        ctx.fillStyle = '#6ad0e0'; ctx.font = 'bold 11px Rajdhani,sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(SL[p] || ('Est.' + (si + 1)), ssx, rY - 22);
      }
    }

    // Signals
    if (data.signals && window.SIGS) {
      for (var sid in window.SIGS) {
        var sg = window.SIGS[sid], asp = data.signals[sid] ? data.signals[sid].asp : 'STOP';
        var ssx2 = cx + (sg.x - my.x) * sc;
        if (ssx2 < -100 || ssx2 > W + 100 || Math.abs(sg.y - my.y) > 60) continue;
        ctx.strokeStyle = '#444'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ssx2, rY - 4); ctx.lineTo(ssx2, rY - 50); ctx.stroke();
        ctx.fillStyle = '#111'; ctx.fillRect(ssx2 - 7, rY - 50, 14, 20);
        var col = sigC[asp] || '#222';
        ctx.beginPath(); ctx.arc(ssx2, rY - 40, 4, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
        if (col !== '#222') { ctx.beginPath(); ctx.arc(ssx2, rY - 40, 8, 0, Math.PI * 2); ctx.fillStyle = col + '40'; ctx.fill(); }
        ctx.fillStyle = '#8888aa'; ctx.font = '7px "Share Tech Mono",monospace'; ctx.textAlign = 'center';
        ctx.fillText(sg.l, ssx2, rY - 54);
        var ahead = (my.dir === 'AB') ? (sg.x > my.x && sg.d === 'R') : (sg.x < my.x && sg.d === 'L');
        if (ahead && !sg.avz && sg.t !== 'ret') { var dist = Math.abs(sg.x - my.x); if (dist < nextSD) { nextSD = dist; nextSN = sg.l; nextSA = asp; } }
      }
    }

    // Other trains
    for (var oi = 0; oi < data.trains.length; oi++) {
      var ot = data.trains[oi]; if (ot.id === myTrainId) continue;
      var osx = cx + (ot.x - my.x) * sc;
      if (osx < -50 || osx > W + 50 || Math.abs(ot.y - my.y) > 40) continue;
      ctx.fillStyle = ot.color || '#e8a020'; ctx.fillRect(osx - 16, rY - 10, 32, 12);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 8px Rajdhani'; ctx.textAlign = 'center'; ctx.fillText(ot.id, osx, rY - 13);
    }

    // My train
    ctx.fillStyle = my.color || '#f59e0b'; ctx.fillRect(cx - 22, rY - 12, 44, 14);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(cx - 22, rY - 12, 44, 14);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Rajdhani'; ctx.textAlign = 'center'; ctx.fillText(my.id, cx, rY - 15);
    ctx.fillStyle = '#f59e0b'; ctx.font = '14px sans-serif'; ctx.fillText(my.dir === 'AB' ? '→' : '←', cx, rY + 28);

    // Info
    var spd = my.w || my.mHold ? 0 : Math.round(my.spd * 50 * (data.trSpeedMult || 1));
    document.getElementById('cabSpeed').textContent = spd;
    document.getElementById('cabState').textContent = my.mHold ? '⏹ Detenido' : my.stopTimer > 0 ? '🚏 Parada' : my.w ? '🔴 Señal roja' : my.sl > 0 ? '🟡 Frenando' : '🟢 Marcha';
    var posT = 'En línea';
    if (window.XS && window.STNS) { for (var pi = 0; pi < window.STNS.length; pi++) { var pp = window.STNS[pi], PX = window.XS[pp]; if (my.x >= PX.leftEdge && my.x <= PX.rightEdge) { posT = SL[pp] || ('Est.' + (pi + 1)); break; } } }
    document.getElementById('cabPos').textContent = posT;
    document.getElementById('cabSigName').textContent = nextSN;
    var nc = sigC[nextSA] || '#222'; var sa = document.getElementById('cabSigAsp');
    sa.style.background = nc; sa.style.borderColor = nc === '#222' ? '#333' : nc;
  }

  // ══════════════════════════════════════════════════
  // ALL: Receive action broadcasts
  // ══════════════════════════════════════════════════
  socket.on('action:exec', function(d) { execB(d.type, d.args, d.ctx); });

  // ══════════════════════════════════════════════════
  // CONNECTION
  // ══════════════════════════════════════════════════
  socket.on('connect', function() {
    socket.emit('room:join', { name: name, code: room, role: role }, function(res) {
      var el = document.getElementById('syncStatus');
      if (res.ok) { connected = true; isMaster = !!res.isMaster; el.innerHTML = '🟢'; el.style.color = '#00e87a'; if (isMaster) { var m = document.getElementById('syncMaster'); if (m) m.textContent = '★ MASTER'; } }
      else { el.innerHTML = '🔴 ' + (res.reason || ''); el.style.color = '#ff4444'; }
    });
  });
  socket.on('disconnect', function() { connected = false; var el = document.getElementById('syncStatus'); el.innerHTML = '🟡'; el.style.color = '#ffc144'; });
  socket.on('room:players', function(p) { var el = document.getElementById('syncPlayers'); if (el) el.textContent = p.length + ' jugadores'; });
  socket.on('room:player-left', function(d) { if (window.log) window.log('👋 ' + d.name, 'i'); });
  socket.on('comms:message', function(m) { if (window.log) window.log('📻 ' + m.from + ': ' + m.text, 'i'); });
})();
