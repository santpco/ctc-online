// ctc-sync.js — FINAL with visible debug
(function() {
  'use strict';
  var params = JSON.parse(sessionStorage.getItem('ctc_session') || 'null');
  if (!params) return;
  var room = params.room, nm = params.name, role = params.role;
  var socket = io(), conn = false, _bp = false, myTrain = null, rxN = 0;
  var ns = 'http://www.w3.org/2000/svg';

  // ── HIGHLY VISIBLE STATUS BAR ──
  var bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;display:flex;align-items:center;gap:8px;padding:4px 12px;font:12px "Share Tech Mono",monospace;background:#0a0e14;border-bottom:2px solid #1c2535;';
  var C = role === 'rc' ? '#4ea8ff' : role === 'cgo' ? '#a78bfa' : '#f59e0b';
  bar.innerHTML =
    '<span id="ss" style="color:#ffc144;font-size:14px">⏳</span>' +
    '<b style="color:' + C + '">' + role.toUpperCase() + '</b>' +
    '<span style="color:#aaa">' + nm + '</span>' +
    '<span style="color:#00e87a;font-weight:bold">' + room + '</span>' +
    '<span style="color:#666">|</span>' +
    '<span id="sp" style="color:#aaa">0 jugadores</span>' +
    '<span style="flex:1"></span>' +
    '<span id="sd" style="color:#ff0;font-size:11px;font-weight:bold">NO SYNC</span>';
  document.body.prepend(bar);
  document.body.style.paddingTop = '28px';

  // Capture originals
  var O = {};
  ['openRoute','cancelRoute','doSpawn','mAsp','onSw','onSig','reqBlk','grantBlk',
   'clearBlk','scenario','resetSim','resetSim2','tPause','setTrSpeed','trCmd','sigToSig',
   'undoLast','spawnTrain','runScn','posTr','updSeg','tickTrains','updUI','updTrainPanel',
   'updPN','mallaTrack','syncAvz','updBlkD','updAsp','updSw'].forEach(function(f) {
    if (typeof window[f] === 'function') O[f] = window[f];
  });

  function send(t, a, c) {
    if (!conn) { if (O[t]) O[t].apply(null, a || []); return; }
    socket.emit('action', { type: t, args: a || [], ctx: c || {} });
  }
  function exec(t, a, c) {
    _bp = true;
    try {
      if (c && c.sel !== undefined && window.S) window.S.sel = c.sel;
      if (c && c.selTrId !== undefined) window.selTrId = c.selTrId;
      if (O[t]) O[t].apply(null, a || []);
    } catch (e) { console.error('[SYNC ERR]', t, e); }
    _bp = false;
  }

  // ALL roles execute action broadcasts
  socket.on('action:exec', function(d) {
    console.log('[ACTION RX]', d.type, d.from);
    exec(d.type, d.args, d.ctx);
  });

  // ══════════════════════════════════════════════════
  // RC
  // ══════════════════════════════════════════════════
  if (role === 'rc') {
    window.openRoute = function(r) { if (_bp) return O.openRoute(r); send('openRoute', [r]); };
    window.cancelRoute = function(r) { if (_bp) return O.cancelRoute(r); send('cancelRoute', [r]); };
    window.doSpawn = function(d) { if (_bp) return O.doSpawn(d); send('doSpawn', [d]); };
    window.mAsp = function(a) { if (_bp) return O.mAsp(a); send('mAsp', [a], { sel: window.S ? window.S.sel : null }); };
    window.onSw = function(i) { if (_bp) return O.onSw(i); send('onSw', [i]); };
    window.reqBlk = function(n, d, v) { if (_bp) return O.reqBlk(n, d, v); send('reqBlk', [n, d, v]); };
    window.grantBlk = function(n, v) { if (_bp) return O.grantBlk(n, v); send('grantBlk', [n, v]); };
    window.clearBlk = function(n, v) { if (_bp) return O.clearBlk(n, v); send('clearBlk', [n, v]); };
    window.scenario = function(n) { if (_bp) return O.scenario(n); send('scenario', [n]); };
    window.resetSim = function() { if (_bp) return O.resetSim(); send('resetSim', []); };
    window.resetSim2 = function() { if (_bp) return O.resetSim2(); send('resetSim2', []); };
    window.tPause = function() { if (_bp) return O.tPause(); send('tPause', []); };
    window.setTrSpeed = function(v) { if (_bp) return O.setTrSpeed(v); send('setTrSpeed', [v]); };
    window.trCmd = function(c) { if (_bp) return O.trCmd(c); send('trCmd', [c], { selTrId: window.selTrId }); };
    window.sigToSig = function(a, b) { if (_bp) return O.sigToSig(a, b); send('sigToSig', [a, b]); };
    window.undoLast = function() { if (_bp) return O.undoLast(); send('undoLast', []); };
    window.spawnTrain = function() { if (_bp) return O.spawnTrain(); send('doSpawn', [document.getElementById('tDir') ? document.getElementById('tDir').value : 'AB']); };
    window.runScn = function() { if (_bp) return O.runScn(); var v = document.getElementById('scnSel') ? parseInt(document.getElementById('scnSel').value) : 0; if (v > 0) send('scenario', [v]); };
    window.onSig = function(id) { if (_bp) return O.onSig(id); if (window.S && window.S.mode === 'auto') { if (window.S.pending) { if (window.S.pending === id) { if (window.clearPend) window.clearPend(); return; } var p = window.S.pending; if (window.clearPend) window.clearPend(); send('sigToSig', [p, id]); return; } O.onSig(id); } else { O.onSig(id); } };

    // Background sim
    var bgI = null;
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) { bgI = setInterval(function() { if (window.S && !window.S.paused) { if (O.tickTrains) O.tickTrains(); if (window.S.tick % 8 === 0 && O.updUI) O.updUI(); if (window.S.tick % 4 === 0 && O.updPN) O.updPN(); if (typeof window.simTime === 'number') window.simTime += 0.05; if (window.S.tick % 3 === 0 && O.mallaTrack) O.mallaTrack(); window.S.tick++; } }, 18); }
      else { if (bgI) { clearInterval(bgI); bgI = null; } }
    });

    // Send train positions every 250ms
    var txN = 0;
    setInterval(function() {
      if (!conn) { var db = document.getElementById('sd'); if (db) db.textContent = 'NOT CONNECTED'; return; }
      if (!window.S) { var db2 = document.getElementById('sd'); if (db2) db2.textContent = 'NO STATE'; return; }
      var d = [];
      for (var i = 0; i < window.S.trains.length; i++) {
        var t = window.S.trains[i]; if (t.done) continue;
        var idx = Math.min(t.pi, t.pts.length - 2), p = t.pts[idx], q = t.pts[idx + 1];
        if (!p || !q) continue;
        d.push({ id: t.id,
          x: Math.round((p.x + (q.x - p.x) * t.t) * 100) / 100,
          y: Math.round((p.y + (q.y - p.y) * t.t) * 100) / 100,
          spd: t.spd, w: t.w, mHold: t.mHold, sl: t.sl, dir: t.dir,
          stopTimer: t.stopTimer || 0, color: t.color || '#e8a020', cs: t.cs
        });
      }
      var sigs = {}; if (window.S.sig) for (var s in window.S.sig) sigs[s] = window.S.sig[s].asp;
      txN++;
      socket.emit('train:sync', { trains: d, sigs: sigs, paused: window.S.paused, trSpeedMult: window.trSpeedMult || 1, seq: txN });
      var db3 = document.getElementById('sd'); if (db3) db3.textContent = '🟢 TX:' + txN + ' trenes:' + d.length;
      db3.style.color = '#00ff00';
    }, 250);
  }

  // ══════════════════════════════════════════════════
  // CGO & MAQUINISTA
  // ══════════════════════════════════════════════════
  if (role === 'cgo' || role === 'maquinista') {
    // Disable local train movement
    window.tickTrains = function() {};
    // Block user clicks
    window.onSig = function(id) { if (_bp) return O.onSig(id); };
    window.onSw = function(id) { if (_bp) return O.onSw(id); };
    window.sigToSig = function(a, b) { if (_bp) return O.sigToSig(a, b); };
    ['spawnTrain','runScn','tPause','setTrSpeed'].forEach(function(f) { window[f] = function() { if (_bp && O[f]) return O[f].apply(null, arguments); }; });

    // Ghost trains
    var ghosts = {};
    var gTR = null;
    // Try to get gTR now, retry later
    gTR = document.getElementById('gTR');
    if (!gTR) setTimeout(function() { gTR = document.getElementById('gTR'); console.log('[GHOST] gTR found:', !!gTR); }, 500);

    function ensureGhost(id, x, y, color) {
      if (!gTR) { gTR = document.getElementById('gTR'); if (!gTR) { console.log('[GHOST] NO gTR layer!'); return; } }
      if (!ghosts[id]) {
        console.log('[GHOST] Creating ghost for', id, 'at', x, y);
        var g = document.createElementNS(ns, 'g');
        var r = document.createElementNS(ns, 'rect');
        r.setAttribute('width', '54'); r.setAttribute('height', '20'); r.setAttribute('rx', '4');
        r.setAttribute('fill', color || '#e8a020'); r.setAttribute('stroke', '#000'); r.setAttribute('stroke-width', '1.5');
        g.appendChild(r);
        var t = document.createElementNS(ns, 'text');
        t.setAttribute('x', '27'); t.setAttribute('y', '15'); t.setAttribute('fill', '#1a0800');
        t.setAttribute('font-family', 'Share Tech Mono,monospace'); t.setAttribute('font-size', '11');
        t.setAttribute('font-weight', '900'); t.setAttribute('text-anchor', 'middle'); t.textContent = id;
        g.appendChild(t); gTR.appendChild(g); ghosts[id] = g;
      }
      ghosts[id].setAttribute('transform', 'translate(' + (x - 27) + ',' + (y - 10) + ')');
    }
    function killGhost(id) { if (ghosts[id]) { ghosts[id].remove(); delete ghosts[id]; } }

    // Hide local train elements (created by doSpawn broadcast) every 500ms
    setInterval(function() {
      if (!window.S || !window.S.trains) return;
      for (var i = 0; i < window.S.trains.length; i++) {
        var t = window.S.trains[i];
        if (t.el && t.el.getAttribute('display') !== 'none') t.el.setAttribute('display', 'none');
        if (t.pathLine && t.pathLine.getAttribute('display') !== 'none') t.pathLine.setAttribute('display', 'none');
      }
    }, 500);

    // RECEIVE SYNC
    socket.on('train:sync', function(data) {
      rxN++;
      var db = document.getElementById('sd');
      if (db) { db.textContent = '🟢 RX:' + rxN + '/' + (data.seq||'?') + ' trenes:' + (data.trains?data.trains.length:0); db.style.color = '#00ff00'; }

      var st = data.trains || [];

      // Position ghosts
      var alive = {};
      for (var i = 0; i < st.length; i++) {
        alive[st[i].id] = true;
        ensureGhost(st[i].id, st[i].x, st[i].y, st[i].color);
      }
      for (var gid in ghosts) if (!alive[gid]) killGhost(gid);

      // Sync signals
      if (data.sigs && window.S && window.S.sig) {
        for (var sigId in data.sigs) {
          if (window.S.sig[sigId] && window.S.sig[sigId].asp !== data.sigs[sigId]) {
            if (O.updAsp) O.updAsp(sigId, data.sigs[sigId]);
          }
        }
      }

      // Maquinista
      if (role === 'maquinista') {
        if (myTrain) renderCab(st, data.sigs, data.trSpeedMult);
        else if (st.length > 0) updateMaqGrid(st);
      }
    });

    // CGO UI
    if (role === 'cgo') setTimeout(function() {
      var mi = document.getElementById('mi'); if (mi) mi.textContent = 'OBSERVADOR CGO';
      document.querySelectorAll('.sg').forEach(function(s) { var t = s.querySelector('.sg-t'); if (!t) return; var tx = t.textContent.toLowerCase();
        if (tx.indexOf('modo') >= 0 || tx.indexOf('manual') >= 0 || tx.indexOf('tren manual') >= 0 || tx.indexOf('grabación') >= 0 || tx.indexOf('escenario') >= 0 || tx.indexOf('rutas') >= 0 || tx.indexOf('bloqueos') >= 0) s.style.display = 'none'; });
      var sp = document.getElementById('spdSel'); if (sp) sp.parentElement.style.display = 'none';
      document.querySelectorAll('.sg').forEach(function(s) { if (s.querySelector('#pBtn')) s.style.display = 'none'; });
    }, 500);

    if (role === 'maquinista') setTimeout(buildCab, 300);
  }

  // ══════════════════════════════════════════════════
  // MAQUINISTA CAB
  // ══════════════════════════════════════════════════
  var cabC = null, cabX = null, cabOK = false;
  function buildCab() {
    if (cabOK) return; cabOK = true;
    var dw = document.querySelector('.dw'); if (dw) dw.style.display = 'none';
    var sb = document.querySelector('.sb'); if (sb) sb.style.display = 'none';
    var vt = document.getElementById('viewToggle'); if (vt) vt.style.display = 'none';
    var d = document.createElement('div');
    d.style.cssText = 'flex:1;display:flex;flex-direction:column;background:#070a0e;overflow:hidden;';
    d.innerHTML =
      '<div id="maqSel" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">' +
        '<div style="font:bold 28px Rajdhani,sans-serif;color:#f59e0b">🚂 Selecciona tu tren</div>' +
        '<div style="font:13px \'Share Tech Mono\',monospace;color:#4a6070">El RC debe lanzar un tren manual primero</div>' +
        '<div style="font:11px \'Share Tech Mono\',monospace;color:#ffc144" id="maqWait">Esperando datos del RC...</div>' +
        '<div id="maqGrid" style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center"></div></div>' +
      '<div id="cabIn" style="flex:1;display:none;flex-direction:column">' +
        '<div style="flex:1;overflow:hidden;background:#080c14"><canvas id="cabCvs" style="width:100%;height:100%"></canvas></div>' +
        '<div style="height:90px;background:#0d1117;border-top:1px solid #1c2535;display:flex;align-items:center;justify-content:center;gap:20px;padding:8px;flex-wrap:wrap">' +
          '<div style="text-align:center;min-width:60px"><div style="font:bold 36px Rajdhani,sans-serif;color:#00e87a" id="cSpd">0</div><div style="font:8px \'Share Tech Mono\',monospace;color:#4a6070">km/h</div></div>' +
          '<div style="min-width:90px"><div style="font:10px \'Share Tech Mono\',monospace;color:#fff" id="cTid">-</div><div style="font:9px \'Share Tech Mono\',monospace;color:#4a6070" id="cSt">-</div><div style="font:9px \'Share Tech Mono\',monospace;color:#4a6070" id="cPos">-</div></div>' +
          '<div style="display:flex;gap:4px"><button onclick="window._mc(\'go\')" style="padding:6px 14px;font:bold 12px Rajdhani;background:#0e3320;color:#44dd77;border:1px solid #1a5533;border-radius:4px;cursor:pointer">▶ Marcha</button><button onclick="window._mc(\'stop\')" style="padding:6px 14px;font:bold 12px Rajdhani;background:#661616;color:#ff6666;border:1px solid #882222;border-radius:4px;cursor:pointer">⏹ Parar</button><button onclick="window._mc(\'rev\')" style="padding:6px 14px;font:bold 12px Rajdhani;background:#1a1a40;color:#8888ff;border:1px solid #333366;border-radius:4px;cursor:pointer">↩ Retro</button></div>' +
          '<div style="display:flex;align-items:center;gap:4px"><div id="cSa" style="width:16px;height:16px;border-radius:50%;background:#222;border:2px solid #333"></div><div id="cSn" style="font:9px \'Share Tech Mono\',monospace;color:#8888aa">-</div></div></div></div>';
    var app = document.querySelector('.app'); if (app) app.appendChild(d);
    window._mc = function(cmd) { if (myTrain && conn) socket.emit('maq:cmd', { trainId: myTrain, cmd: cmd }); };
    cabC = document.getElementById('cabCvs'); if (cabC) cabX = cabC.getContext('2d');
    window.addEventListener('resize', function() { if (cabC && cabC.parentElement) { cabC.width = cabC.parentElement.clientWidth; cabC.height = cabC.parentElement.clientHeight; } });
  }

  function updateMaqGrid(trains) {
    var g = document.getElementById('maqGrid'), w = document.getElementById('maqWait');
    if (!g) { console.log('[MAQ] No grid element!'); return; }
    if (w) w.style.display = 'none';
    console.log('[MAQ] Building grid with', trains.length, 'trains');
    g.innerHTML = '';
    for (var i = 0; i < trains.length; i++) {
      var t = trains[i], c = document.createElement('div');
      c.style.cssText = 'padding:16px 24px;background:#151b25;border:2px solid #1c2535;border-radius:10px;cursor:pointer;text-align:center;min-width:110px;';
      c.innerHTML = '<div style="width:36px;height:14px;background:' + (t.color || '#e8a020') + ';border-radius:4px;margin:0 auto 8px"></div><div style="font:bold 20px \'Share Tech Mono\',monospace;color:#fff">' + t.id + '</div><div style="font:11px \'Share Tech Mono\',monospace;color:#4a6070;margin-top:4px">' + (t.dir === 'AB' ? '→ Par' : '← Impar') + '</div>';
      c.onmouseover = function() { this.style.borderColor = '#f59e0b'; this.style.background = '#1a2030'; };
      c.onmouseout = function() { this.style.borderColor = '#1c2535'; this.style.background = '#151b25'; };
      (function(tid) { c.onclick = function() {
        console.log('[MAQ] Selected train:', tid);
        myTrain = tid;
        document.getElementById('maqSel').style.display = 'none';
        document.getElementById('cabIn').style.display = 'flex';
        document.getElementById('cTid').textContent = 'Tren ' + tid;
        if (cabC && cabC.parentElement) { cabC.width = cabC.parentElement.clientWidth; cabC.height = cabC.parentElement.clientHeight; }
      }; })(t.id);
      g.appendChild(c);
    }
  }

  function renderCab(trains, sigs, spdM) {
    if (!cabC || !cabX || !myTrain) return;
    var my = null; for (var i = 0; i < trains.length; i++) if (trains[i].id === myTrain) { my = trains[i]; break; } if (!my) return;
    if (cabC.parentElement) { cabC.width = cabC.parentElement.clientWidth; cabC.height = cabC.parentElement.clientHeight; }
    var W = cabC.width, H = cabC.height, x = cabX; if (W < 10 || H < 10) return;
    var sk = x.createLinearGradient(0, 0, 0, H * .55); sk.addColorStop(0, '#0c1520'); sk.addColorStop(1, '#1a2a3a');
    x.fillStyle = sk; x.fillRect(0, 0, W, H * .55); x.fillStyle = '#141810'; x.fillRect(0, H * .55, W, H * .45);
    x.fillStyle = '#222018'; x.fillRect(0, H * .55 - 8, W, 24);
    var rY = H * .55; x.strokeStyle = '#666'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, rY); x.lineTo(W, rY); x.stroke();
    x.beginPath(); x.moveTo(0, rY + 10); x.lineTo(W, rY + 10); x.stroke();
    x.strokeStyle = '#2a2520'; x.lineWidth = 3; var off = (my.x * 2) % 18;
    for (var sx = -20; sx < W + 20; sx += 18) { x.beginPath(); x.moveTo(sx - off, rY - 4); x.lineTo(sx - off, rY + 14); x.stroke(); }
    var cx = W / 2, sc = 2.5, SL = window.STN_LBL || {};
    var sC = { STOP: '#ff2222', GO: '#00ee55', PREC: '#ffcc00', PREC_ADV: '#ffcc00', PREC_PRE: '#ffcc00', AN_PAR: '#ffcc00', REBASE: '#ff8800' };
    var nN = '-', nA = 'STOP', nD = 99999;
    if (window.XS && window.STNS) for (var si = 0; si < window.STNS.length; si++) { var p = window.STNS[si], X = window.XS[p], sx2 = cx + (X.center - my.x) * sc; if (sx2 < -200 || sx2 > W + 200) continue; x.fillStyle = '#2a2520'; x.fillRect(sx2 - 50, rY - 14, 100, 10); x.fillStyle = '#6ad0e0'; x.font = 'bold 11px Rajdhani'; x.textAlign = 'center'; x.fillText(SL[p] || p, sx2, rY - 22); }
    if (sigs && window.SIGS) for (var sid in window.SIGS) { var sg = window.SIGS[sid], asp = sigs[sid] || 'STOP'; var sx3 = cx + (sg.x - my.x) * sc; if (sx3 < -100 || sx3 > W + 100 || Math.abs(sg.y - my.y) > 60) continue; x.strokeStyle = '#444'; x.lineWidth = 2; x.beginPath(); x.moveTo(sx3, rY - 4); x.lineTo(sx3, rY - 50); x.stroke(); x.fillStyle = '#111'; x.fillRect(sx3 - 7, rY - 50, 14, 20); var cl = sC[asp] || '#222'; x.beginPath(); x.arc(sx3, rY - 40, 4, 0, Math.PI * 2); x.fillStyle = cl; x.fill(); if (cl !== '#222') { x.beginPath(); x.arc(sx3, rY - 40, 8, 0, Math.PI * 2); x.fillStyle = cl + '40'; x.fill(); } x.fillStyle = '#8888aa'; x.font = '7px "Share Tech Mono"'; x.textAlign = 'center'; x.fillText(sg.l, sx3, rY - 54); var ah = my.dir === 'AB' ? (sg.x > my.x && sg.d === 'R') : (sg.x < my.x && sg.d === 'L'); if (ah && !sg.avz && sg.t !== 'ret') { var dist = Math.abs(sg.x - my.x); if (dist < nD) { nD = dist; nN = sg.l; nA = asp; } } }
    for (var oi = 0; oi < trains.length; oi++) { var ot = trains[oi]; if (ot.id === myTrain) continue; var ox = cx + (ot.x - my.x) * sc; if (ox < -50 || ox > W + 50) continue; x.fillStyle = ot.color || '#e8a020'; x.fillRect(ox - 16, rY - 10, 32, 12); x.fillStyle = '#fff'; x.font = 'bold 8px Rajdhani'; x.textAlign = 'center'; x.fillText(ot.id, ox, rY - 13); }
    x.fillStyle = my.color || '#f59e0b'; x.fillRect(cx - 22, rY - 12, 44, 14); x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.strokeRect(cx - 22, rY - 12, 44, 14); x.fillStyle = '#fff'; x.font = 'bold 10px Rajdhani'; x.textAlign = 'center'; x.fillText(my.id, cx, rY - 15);
    var spd = my.w || my.mHold ? 0 : Math.round(my.spd * 50 * (spdM || 1));
    var e = document.getElementById('cSpd'); if (e) e.textContent = spd;
    e = document.getElementById('cSt'); if (e) e.textContent = my.mHold ? '⏹ Detenido' : my.w ? '🔴 Señal' : '🟢 Marcha';
    var pos = '-'; if (window.XS && window.STNS) for (var pi = 0; pi < window.STNS.length; pi++) { var pp = window.STNS[pi], PX = window.XS[pp]; if (my.x >= PX.leftEdge && my.x <= PX.rightEdge) { pos = SL[pp] || pp; break; } }
    e = document.getElementById('cPos'); if (e) e.textContent = pos;
    e = document.getElementById('cSn'); if (e) e.textContent = nN;
    var nc = sC[nA] || '#222'; e = document.getElementById('cSa'); if (e) { e.style.background = nc; e.style.borderColor = nc === '#222' ? '#333' : nc; }
  }

  // ══════════════════════════════════════════════════
  // CONNECTION
  // ══════════════════════════════════════════════════
  socket.on('connect', function() {
    console.log('[SYNC] Socket connected, joining room:', room, 'as', role);
    socket.emit('room:join', { name: nm, code: room, role: role }, function(r) {
      var e = document.getElementById('ss');
      if (r.ok) {
        conn = true;
        e.textContent = '🟢'; e.style.color = '#00e87a';
        console.log('[SYNC] Joined room OK');
        // Ping test
        socket.emit('sync:ping', {}, function(pr) { console.log('[SYNC] Ping result:', pr); });
      } else {
        e.textContent = '🔴 ' + (r.reason || ''); e.style.color = '#ff4444';
        console.error('[SYNC] Join failed:', r.reason);
      }
    });
  });
  socket.on('disconnect', function() { conn = false; var e = document.getElementById('ss'); e.textContent = '🟡 DESCONECTADO'; e.style.color = '#ffc144'; });
  socket.on('room:players', function(p) { var e = document.getElementById('sp'); if (e) e.textContent = p.length + ' jugadores'; });
  socket.on('room:player-left', function(d) { if (window.log) window.log('👋 ' + d.name, 'i'); });
  socket.on('comms:message', function(m) { if (window.log) window.log('📻 ' + m.from + ': ' + m.text, 'i'); });
})();
