// ctc-sync.js — Multiplayer sync (definitive)
// Ghost trains for non-master. Reliable emit (no volatile). Sync counter for debug.
(function() {
  'use strict';
  var params = JSON.parse(sessionStorage.getItem('ctc_session') || 'null');
  if (!params) return;
  var room = params.room, name = params.name, role = params.role;
  var socket = io(), connected = false, isMaster = false, _bypass = false;
  var myTrainId = null, syncCount = 0;
  var ns = 'http://www.w3.org/2000/svg';

  // Status bar
  var bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;display:flex;align-items:center;gap:8px;padding:4px 12px;font:11px "Share Tech Mono",monospace;background:rgba(7,9,13,0.95);border-bottom:1px solid #1c2535;';
  var clr = role === 'rc' ? '#4ea8ff' : role === 'cgo' ? '#a78bfa' : '#f59e0b';
  bar.innerHTML = '<span style="color:#ffc144" id="syncStatus">⏳</span>' +
    '<span style="color:#4a6070">|</span><span style="color:' + clr + ';font-weight:bold">' + role.toUpperCase() + '</span> ' +
    '<span style="color:#4a6070">' + name + ' | <b style="color:#00e87a">' + room + '</b></span>' +
    '<span style="color:#4a6070">|</span><span id="syncPlayers" style="color:#4a6070">0</span>' +
    '<span id="syncMaster" style="color:#ffc144;margin-left:4px"></span>' +
    '<span style="flex:1"></span>' +
    '<span id="syncCounter" style="color:#333;font-size:9px"></span>' +
    '<span style="color:' + clr + ';margin-left:8px">' + (role === 'rc' ? '🔧' : role === 'cgo' ? '👁' : '🚂') + '</span>';
  document.body.prepend(bar);
  document.body.style.paddingTop = '28px';

  // Capture originals
  var O = {};
  ['openRoute','cancelRoute','doSpawn','mAsp','onSw','onSig','reqBlk','grantBlk',
   'clearBlk','scenario','resetSim','resetSim2','tPause','setTrSpeed','trCmd','sigToSig',
   'undoLast','spawnTrain','runScn','posTr','updSeg','tickTrains','updUI','updTrainPanel',
   'updPN','mallaTrack','syncAvz','updBlkD','updAsp','updSw'].forEach(function(fn) {
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
      if (O[t]) O[t].apply(null, a || []);
    } catch (e) { console.error('[S]', t, e); }
    _bypass = false;
  }

  // ══════════════════════════════════════════════════
  // RC
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
    window.spawnTrain = function() { if (_bypass) return O.spawnTrain(); send('doSpawn', [document.getElementById('tDir') ? document.getElementById('tDir').value : 'AB']); };
    window.runScn = function() { if (_bypass) return O.runScn(); var v = document.getElementById('scnSel') ? parseInt(document.getElementById('scnSel').value) : 0; if (v > 0) send('scenario', [v]); };
    window.onSig = function(id) { if (_bypass) return O.onSig(id); if (window.S && window.S.mode === 'auto') { if (window.S.pending) { if (window.S.pending === id) { if (window.clearPend) window.clearPend(); return; } var p = window.S.pending; if (window.clearPend) window.clearPend(); send('sigToSig', [p, id]); return; } O.onSig(id); } else { O.onSig(id); } };

    // Background-safe
    var bgI = null;
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) { bgI = setInterval(function() { if (window.S && !window.S.paused) { if (O.tickTrains) O.tickTrains(); if (window.S.tick % 8 === 0) { if (O.updUI) O.updUI(); } if (window.S.tick % 4 === 0 && O.updPN) O.updPN(); if (typeof window.simTime === 'number') window.simTime += 0.05; if (window.S.tick % 3 === 0 && O.mallaTrack) O.mallaTrack(); window.S.tick++; } }, 18); }
      else { if (bgI) { clearInterval(bgI); bgI = null; } }
    });

    socket.on('master:promoted', function() { isMaster = true; var m = document.getElementById('syncMaster'); if (m) m.textContent = '★ MASTER'; });

    // Broadcast state every 250ms — RELIABLE (no volatile)
    var syncSeq = 0;
    setInterval(function() {
      if (!connected || !isMaster || !window.S) return;
      var tr = window.S.trains, d = [];
      for (var i = 0; i < tr.length; i++) {
        var t = tr[i]; if (t.done) continue;
        var idx = Math.min(t.pi, t.pts.length - 2), p = t.pts[idx], q = t.pts[idx + 1];
        if (!p || !q) continue;
        d.push({ id: t.id,
          x: Math.round((p.x + (q.x - p.x) * t.t) * 10) / 10,
          y: Math.round((p.y + (q.y - p.y) * t.t) * 10) / 10,
          spd: t.spd, w: t.w, mHold: t.mHold, sl: t.sl, cs: t.cs,
          dir: t.dir, stopTimer: t.stopTimer || 0, color: t.color || '#e8a020'
        });
      }
      var sigs = {}; if (window.S.sig) { for (var sid in window.S.sig) sigs[sid] = window.S.sig[sid].asp; }
      var segs = {}; if (window.S.seg) { for (var segId in window.S.seg) { var sg = window.S.seg[segId]; segs[segId] = (sg.occ ? 2 : sg.res ? 1 : 0); } }
      var sws = {}; if (window.S.sw) { for (var swId in window.S.sw) { var sw = window.S.sw[swId]; sws[swId] = sw.pos + (sw.lk ? 'L' : ''); } }
      var blks = []; if (window.S.blk) { for (var bn = 0; bn < window.S.blk.length; bn++) { var b = window.S.blk[bn]; blks.push(b ? b.s[0] + (b.d || '') : ''); } }
      var bv2 = []; if (window.S.blkV2) { for (var bvn = 0; bvn < window.S.blkV2.length; bvn++) { var bv = window.S.blkV2[bvn]; bv2.push(bv ? bv.s[0] + (bv.d || '') : ''); } }
      syncSeq++;
      // Regular emit, NOT volatile
      socket.emit('train:sync', { seq: syncSeq, trains: d, sigs: sigs, segs: segs, sws: sws, blks: blks, bv2: bv2, paused: window.S.paused, trSpeedMult: window.trSpeedMult || 1, simTime: window.simTime || 0 });
      var sc = document.getElementById('syncCounter'); if (sc) sc.textContent = 'TX:' + syncSeq + ' T:' + d.length;
    }, 250);
  }

  // ══════════════════════════════════════════════════
  // CGO & MAQUINISTA — Ghost trains, full state from RC
  // ══════════════════════════════════════════════════
  if (role === 'cgo' || role === 'maquinista') {
    // Disable ALL local simulation and interaction
    window.tickTrains = function() {};
    window.doSpawn = function() {};
    window.spawnTrain = function() {};
    ['openRoute','cancelRoute','mAsp','reqBlk','grantBlk','clearBlk','scenario',
     'resetSim','resetSim2','runScn','undoLast','trCmd','tPause','setTrSpeed'].forEach(function(fn) { window[fn] = function() {}; });
    window.onSig = function() {}; window.onSw = function() {}; window.sigToSig = function() {};

    // Also disable the CTC's main loop from doing anything
    // The loop still runs (rAF) but tickTrains is empty, so trains don't move locally
    // We just need to prevent simTime and S.tick from diverging
    // Override the loop's simTime increment by resetting on each sync
    
    // Ghost trains
    var ghosts = {};
    var gTR = null;
    // Wait for DOM
    setTimeout(function() { gTR = document.getElementById('gTR'); }, 100);

    function ensureGhost(id, color) {
      if (ghosts[id]) return ghosts[id];
      if (!gTR) gTR = document.getElementById('gTR');
      if (!gTR) return null;
      var g = document.createElementNS(ns, 'g');
      var r = document.createElementNS(ns, 'rect');
      r.setAttribute('width', '54'); r.setAttribute('height', '20'); r.setAttribute('rx', '4');
      r.setAttribute('fill', color || '#e8a020'); r.setAttribute('stroke', '#000'); r.setAttribute('stroke-width', '1.5');
      g.appendChild(r);
      var t = document.createElementNS(ns, 'text');
      t.setAttribute('x', '27'); t.setAttribute('y', '15'); t.setAttribute('fill', '#1a0800');
      t.setAttribute('font-family', 'Share Tech Mono,monospace'); t.setAttribute('font-size', '11');
      t.setAttribute('font-weight', '900'); t.setAttribute('text-anchor', 'middle');
      t.textContent = id; g.appendChild(t);
      gTR.appendChild(g);
      ghosts[id] = { g: g };
      return ghosts[id];
    }

    function killGhost(id) {
      if (ghosts[id]) { if (ghosts[id].g.parentNode) ghosts[id].g.parentNode.removeChild(ghosts[id].g); delete ghosts[id]; }
    }

    // ── RECEIVE SYNC ──
    socket.on('train:sync', function(data) {
      syncCount++;
      var sc = document.getElementById('syncCounter'); if (sc) sc.textContent = 'RX:' + (data.seq || '?') + ' #' + syncCount + ' T:' + (data.trains ? data.trains.length : 0);

      // Sync pause
      if (window.S) {
        if (typeof data.paused === 'boolean') window.S.paused = data.paused;
        if (typeof data.simTime === 'number') window.simTime = data.simTime;
        if (typeof data.trSpeedMult === 'number') window.trSpeedMult = data.trSpeedMult;
      }

      // ── GHOST TRAINS ──
      var st = data.trains || [];
      var alive = {};
      for (var i = 0; i < st.length; i++) {
        var td = st[i]; alive[td.id] = true;
        var gh = ensureGhost(td.id, td.color);
        if (gh) gh.g.setAttribute('transform', 'translate(' + (td.x - 27) + ',' + (td.y - 10) + ')');
      }
      for (var gid in ghosts) { if (!alive[gid]) killGhost(gid); }

      // ── SIGNALS ──
      if (data.sigs && window.S && window.S.sig) {
        for (var sigId in data.sigs) {
          if (window.S.sig[sigId] && window.S.sig[sigId].asp !== data.sigs[sigId]) {
            if (O.updAsp) O.updAsp(sigId, data.sigs[sigId]);
          }
        }
      }

      // ── SEGMENTS ──
      if (data.segs && window.S && window.S.seg) {
        for (var segId in data.segs) {
          var ls = window.S.seg[segId]; if (!ls) continue;
          var v = data.segs[segId]; // 0=free, 1=reserved, 2=occupied
          var newOcc = v === 2, newRes = v === 1;
          if (ls.occ !== newOcc || ls.res !== newRes) {
            ls.occ = newOcc; ls.res = newRes;
            if (O.updSeg) O.updSeg(segId);
          }
        }
      }

      // ── SWITCHES ──
      if (data.sws && window.S && window.S.sw) {
        for (var swId in data.sws) {
          var lsw = window.S.sw[swId]; if (!lsw) continue;
          var sv = data.sws[swId]; // "NL" or "N" or "RL" or "R"
          var newPos = sv[0]; var newLk = sv.length > 1 && sv[1] === 'L';
          if (lsw.pos !== newPos || lsw.lk !== newLk) {
            lsw.pos = newPos; lsw.lk = newLk;
            if (typeof window.updSw === 'function') window.updSw(swId);
          }
        }
      }

      // ── BLOCKS ──
      var blkMap = { l: 'libre', p: 'pedido', c: 'concedido', o: 'ocupado' };
      if (data.blks && window.S && window.S.blk) {
        for (var bn = 1; bn < data.blks.length && bn < window.S.blk.length; bn++) {
          if (!data.blks[bn] || !window.S.blk[bn]) continue;
          var bStr = data.blks[bn]; // e.g. "c→" or "l"
          var bState = blkMap[bStr[0]] || 'libre';
          var bDir = bStr.length > 1 ? bStr.substring(1) : null;
          if (window.S.blk[bn].s !== bState || window.S.blk[bn].d !== bDir) {
            window.S.blk[bn].s = bState; window.S.blk[bn].d = bDir;
            if (O.updBlkD) O.updBlkD(bn, 'V1');
          }
        }
      }
      if (data.bv2 && window.S && window.S.blkV2) {
        for (var bvn = 1; bvn < data.bv2.length && bvn < window.S.blkV2.length; bvn++) {
          if (!data.bv2[bvn] || !window.S.blkV2[bvn]) continue;
          var bv2Str = data.bv2[bvn];
          var bv2State = blkMap[bv2Str[0]] || 'libre';
          var bv2Dir = bv2Str.length > 1 ? bv2Str.substring(1) : null;
          if (window.S.blkV2[bvn].s !== bv2State || window.S.blkV2[bvn].d !== bv2Dir) {
            window.S.blkV2[bvn].s = bv2State; window.S.blkV2[bvn].d = bv2Dir;
            if (O.updBlkD) O.updBlkD(bvn, 'V2');
          }
        }
      }

      // Maquinista cab
      if (role === 'maquinista') {
        if (myTrainId) renderCab(st, data.sigs);
        else if (st.length > 0) updateTrainGrid(st);
      }
    });

    // CGO: hide UI
    if (role === 'cgo') {
      setTimeout(function() {
        var mi = document.getElementById('mi'); if (mi) mi.textContent = 'OBSERVADOR CGO';
        document.querySelectorAll('.sg').forEach(function(s) { var t = s.querySelector('.sg-t'); if (!t) return; var tx = t.textContent.toLowerCase();
          if (tx.indexOf('modo') >= 0 || tx.indexOf('manual') >= 0 || tx.indexOf('tren manual') >= 0 || tx.indexOf('grabación') >= 0 || tx.indexOf('escenario') >= 0 || tx.indexOf('rutas') >= 0 || tx.indexOf('bloqueos') >= 0) s.style.display = 'none'; });
        var sp = document.getElementById('spdSel'); if (sp) sp.parentElement.style.display = 'none';
        document.querySelectorAll('.sg').forEach(function(s) { if (s.querySelector('#pBtn')) s.style.display = 'none'; });
      }, 500);
    }
    if (role === 'maquinista') setTimeout(buildCabView, 300);
  }

  // ══════════════════════════════════════════════════
  // MAQUINISTA CAB
  // ══════════════════════════════════════════════════
  var cabCanvas = null, cabCtx = null, cabBuilt = false;
  function buildCabView() {
    if (cabBuilt) return; cabBuilt = true;
    var dw = document.querySelector('.dw'); if (dw) dw.style.display = 'none';
    var sb = document.querySelector('.sb'); if (sb) sb.style.display = 'none';
    var vt = document.getElementById('viewToggle'); if (vt) vt.style.display = 'none';
    var cab = document.createElement('div');
    cab.style.cssText = 'flex:1;display:flex;flex-direction:column;background:#070a0e;overflow:hidden;';
    cab.innerHTML =
      '<div id="maqSelect" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;">' +
      '<div style="font:bold 24px Rajdhani,sans-serif;color:#f59e0b">🚂 Selecciona tu tren</div>' +
      '<div style="font:12px \'Share Tech Mono\',monospace;color:#4a6070">RC debe lanzar tren (Tren Manual → Lanzar)</div>' +
      '<div id="maqTrainGrid" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:600px"></div>' +
      '<div id="maqWaiting" style="font:11px \'Share Tech Mono\',monospace;color:#ffc144">Esperando...</div></div>' +
      '<div id="cabInner" style="flex:1;display:none;flex-direction:column;">' +
      '<div style="flex:1;position:relative;overflow:hidden;background:#080c14;min-height:200px"><canvas id="cabCanvas" style="width:100%;height:100%;display:block"></canvas></div>' +
      '<div style="height:100px;background:#0d1117;border-top:1px solid #1c2535;display:flex;align-items:center;justify-content:center;gap:20px;padding:10px;flex-wrap:wrap;">' +
      '<div style="text-align:center;min-width:60px"><div style="font:bold 36px Rajdhani,sans-serif;color:#00e87a" id="cabSpeed">0</div><div style="font:8px \'Share Tech Mono\',monospace;color:#4a6070">km/h</div></div>' +
      '<div style="min-width:100px"><div style="font:10px \'Share Tech Mono\',monospace;color:#fff" id="cabTrainId">---</div><div style="font:9px \'Share Tech Mono\',monospace;color:#4a6070" id="cabState">---</div><div style="font:9px \'Share Tech Mono\',monospace;color:#4a6070" id="cabPos">---</div></div>' +
      '<div style="display:flex;gap:4px"><button onclick="window._maqCmd(\'go\')" style="padding:6px 12px;font:bold 12px Rajdhani;background:#0e3320;color:#44dd77;border:1px solid #1a5533;border-radius:4px;cursor:pointer">▶</button><button onclick="window._maqCmd(\'stop\')" style="padding:6px 12px;font:bold 12px Rajdhani;background:#661616;color:#ff6666;border:1px solid #882222;border-radius:4px;cursor:pointer">⏹</button><button onclick="window._maqCmd(\'rev\')" style="padding:6px 12px;font:bold 12px Rajdhani;background:#1a1a40;color:#8888ff;border:1px solid #333366;border-radius:4px;cursor:pointer">↩</button></div>' +
      '<div style="display:flex;align-items:center;gap:4px"><div id="cabSigAsp" style="width:16px;height:16px;border-radius:50%;background:#222;border:2px solid #333"></div><div id="cabSigName" style="font:9px \'Share Tech Mono\',monospace;color:#8888aa">---</div></div></div></div>';
    var app = document.querySelector('.app'); if (app) app.appendChild(cab);
    window._maqCmd = function(cmd) { if (myTrainId && connected) socket.emit('maq:cmd', { trainId: myTrainId, cmd: cmd }); };
    cabCanvas = document.getElementById('cabCanvas');
    if (cabCanvas) cabCtx = cabCanvas.getContext('2d');
    window.addEventListener('resize', function() { if (cabCanvas && cabCanvas.parentElement) { cabCanvas.width = cabCanvas.parentElement.clientWidth; cabCanvas.height = cabCanvas.parentElement.clientHeight; } });
  }

  function updateTrainGrid(trains) {
    var grid = document.getElementById('maqTrainGrid'), wait = document.getElementById('maqWaiting');
    if (!grid) return;
    if (wait) wait.style.display = 'none';
    grid.innerHTML = '';
    for (var i = 0; i < trains.length; i++) {
      var tr = trains[i], card = document.createElement('div');
      card.style.cssText = 'padding:14px 20px;background:#151b25;border:2px solid #1c2535;border-radius:8px;cursor:pointer;text-align:center;min-width:100px;';
      card.innerHTML = '<div style="width:32px;height:12px;background:' + (tr.color || '#e8a020') + ';border-radius:3px;margin:0 auto 6px"></div><div style="font:bold 18px \'Share Tech Mono\',monospace;color:#fff">' + tr.id + '</div><div style="font:10px \'Share Tech Mono\',monospace;color:#4a6070">' + (tr.dir === 'AB' ? '→' : '←') + '</div>';
      card.onmouseover = function() { this.style.borderColor = '#f59e0b'; };
      card.onmouseout = function() { this.style.borderColor = '#1c2535'; };
      (function(tid) { card.onclick = function() { myTrainId = tid; document.getElementById('maqSelect').style.display = 'none'; document.getElementById('cabInner').style.display = 'flex'; document.getElementById('cabTrainId').textContent = 'Tren ' + tid; if (cabCanvas && cabCanvas.parentElement) { cabCanvas.width = cabCanvas.parentElement.clientWidth; cabCanvas.height = cabCanvas.parentElement.clientHeight; } }; })(tr.id);
      grid.appendChild(card);
    }
  }

  function renderCab(trains, sigs) {
    if (!cabCanvas || !cabCtx || !myTrainId) return;
    var my = null; for (var i = 0; i < trains.length; i++) { if (trains[i].id === myTrainId) { my = trains[i]; break; } } if (!my) return;
    var par = cabCanvas.parentElement; if (par) { cabCanvas.width = par.clientWidth; cabCanvas.height = par.clientHeight; }
    var W = cabCanvas.width, H = cabCanvas.height, ctx = cabCtx; if (W < 10 || H < 10) return;
    var sky = ctx.createLinearGradient(0, 0, 0, H * 0.55); sky.addColorStop(0, '#0c1520'); sky.addColorStop(1, '#1a2a3a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.55); ctx.fillStyle = '#141810'; ctx.fillRect(0, H * 0.55, W, H * 0.45); ctx.fillStyle = '#222018'; ctx.fillRect(0, H * 0.55 - 8, W, 24);
    var rY = H * 0.55; ctx.strokeStyle = '#666'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, rY); ctx.lineTo(W, rY); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, rY + 10); ctx.lineTo(W, rY + 10); ctx.stroke();
    ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 3; var off = (my.x * 2) % 18; for (var sx = -20; sx < W + 20; sx += 18) { ctx.beginPath(); ctx.moveTo(sx - off, rY - 4); ctx.lineTo(sx - off, rY + 14); ctx.stroke(); }
    var cx = W / 2, sc = 2.5, SL = window.STN_LBL || {};
    var sigC = { STOP: '#ff2222', GO: '#00ee55', PREC: '#ffcc00', PREC_ADV: '#ffcc00', PREC_PRE: '#ffcc00', AN_PAR: '#ffcc00', REBASE: '#ff8800' };
    var nSN = '---', nSA = 'STOP', nSD = 99999;
    if (window.XS && window.STNS) { for (var si = 0; si < window.STNS.length; si++) { var p = window.STNS[si], X = window.XS[p], ssx = cx + (X.center - my.x) * sc; if (ssx < -200 || ssx > W + 200) continue; ctx.fillStyle = '#2a2520'; ctx.fillRect(ssx - 50, rY - 14, 100, 10); ctx.strokeStyle = '#444'; ctx.lineWidth = 1; ctx.strokeRect(ssx - 50, rY - 14, 100, 10); ctx.fillStyle = '#6ad0e0'; ctx.font = 'bold 11px Rajdhani,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(SL[p] || ('E' + (si + 1)), ssx, rY - 22); } }
    if (sigs && window.SIGS) { for (var sid in window.SIGS) { var sg = window.SIGS[sid], asp = sigs[sid] || 'STOP'; var ssx2 = cx + (sg.x - my.x) * sc; if (ssx2 < -100 || ssx2 > W + 100 || Math.abs(sg.y - my.y) > 60) continue; ctx.strokeStyle = '#444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ssx2, rY - 4); ctx.lineTo(ssx2, rY - 50); ctx.stroke(); ctx.fillStyle = '#111'; ctx.fillRect(ssx2 - 7, rY - 50, 14, 20); var col = sigC[asp] || '#222'; ctx.beginPath(); ctx.arc(ssx2, rY - 40, 4, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); if (col !== '#222') { ctx.beginPath(); ctx.arc(ssx2, rY - 40, 8, 0, Math.PI * 2); ctx.fillStyle = col + '40'; ctx.fill(); } ctx.fillStyle = '#8888aa'; ctx.font = '7px "Share Tech Mono",monospace'; ctx.textAlign = 'center'; ctx.fillText(sg.l, ssx2, rY - 54); var ah = (my.dir === 'AB') ? (sg.x > my.x && sg.d === 'R') : (sg.x < my.x && sg.d === 'L'); if (ah && !sg.avz && sg.t !== 'ret') { var dist = Math.abs(sg.x - my.x); if (dist < nSD) { nSD = dist; nSN = sg.l; nSA = asp; } } } }
    for (var oi = 0; oi < trains.length; oi++) { var ot = trains[oi]; if (ot.id === myTrainId) continue; var osx = cx + (ot.x - my.x) * sc; if (osx < -50 || osx > W + 50 || Math.abs(ot.y - my.y) > 40) continue; ctx.fillStyle = ot.color || '#e8a020'; ctx.fillRect(osx - 16, rY - 10, 32, 12); ctx.fillStyle = '#fff'; ctx.font = 'bold 8px Rajdhani'; ctx.textAlign = 'center'; ctx.fillText(ot.id, osx, rY - 13); }
    ctx.fillStyle = my.color || '#f59e0b'; ctx.fillRect(cx - 22, rY - 12, 44, 14); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(cx - 22, rY - 12, 44, 14); ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Rajdhani'; ctx.textAlign = 'center'; ctx.fillText(my.id, cx, rY - 15);
    var spd = my.w || my.mHold ? 0 : Math.round(my.spd * 50 * (window.trSpeedMult || 1));
    var el = document.getElementById('cabSpeed'); if (el) el.textContent = spd;
    el = document.getElementById('cabState'); if (el) el.textContent = my.mHold ? '⏹ Detenido' : my.stopTimer > 0 ? '🚏 Parada' : my.w ? '🔴 Señal' : '🟢 Marcha';
    var posT = 'En línea'; if (window.XS && window.STNS) { for (var pi = 0; pi < window.STNS.length; pi++) { var pp = window.STNS[pi], PX = window.XS[pp]; if (my.x >= PX.leftEdge && my.x <= PX.rightEdge) { posT = SL[pp] || ('E' + (pi + 1)); break; } } }
    el = document.getElementById('cabPos'); if (el) el.textContent = posT;
    el = document.getElementById('cabSigName'); if (el) el.textContent = nSN;
    var nc = sigC[nSA] || '#222'; el = document.getElementById('cabSigAsp'); if (el) { el.style.background = nc; el.style.borderColor = nc === '#222' ? '#333' : nc; }
  }

  // Only RC processes action broadcasts
  socket.on('action:exec', function(d) { if (role === 'rc') execB(d.type, d.args, d.ctx); });

  // Connection
  socket.on('connect', function() { socket.emit('room:join', { name: name, code: room, role: role }, function(res) { var el = document.getElementById('syncStatus'); if (res.ok) { connected = true; isMaster = !!res.isMaster; el.innerHTML = '🟢'; el.style.color = '#00e87a'; if (isMaster) { var m = document.getElementById('syncMaster'); if (m) m.textContent = '★ MASTER'; } } else { el.innerHTML = '🔴'; el.style.color = '#ff4444'; } }); });
  socket.on('disconnect', function() { connected = false; document.getElementById('syncStatus').innerHTML = '🟡'; document.getElementById('syncStatus').style.color = '#ffc144'; });
  socket.on('room:players', function(p) { var el = document.getElementById('syncPlayers'); if (el) el.textContent = p.length; });
  socket.on('room:player-left', function(d) { if (window.log) window.log('👋 ' + d.name, 'i'); });
  socket.on('comms:message', function(m) { if (window.log) window.log('📻 ' + m.from + ': ' + m.text, 'i'); });
})();
