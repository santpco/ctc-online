// ctc-sync.js — FINAL: smooth ghosts, fixed cab, realistic signals
(function() {
  'use strict';
  var params = JSON.parse(sessionStorage.getItem('ctc_session') || 'null');
  if (!params) return;
  var room = params.room, nm = params.name, role = params.role;
  var socket = io(), conn = false, _bp = false, myTrain = null, rxN = 0;
  var ns = 'http://www.w3.org/2000/svg';

  // Status bar
  var bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;display:flex;align-items:center;gap:8px;padding:4px 12px;font:12px "Share Tech Mono",monospace;background:#0a0e14;border-bottom:2px solid #1c2535;';
  var C = role === 'rc' ? '#4ea8ff' : role === 'cgo' ? '#a78bfa' : '#f59e0b';
  bar.innerHTML = '<span id="ss" style="color:#ffc144">⏳</span>' +
    '<b style="color:' + C + '">' + role.toUpperCase() + '</b>' +
    '<span style="color:#aaa">' + nm + '</span>' +
    '<span style="color:#00e87a;font-weight:bold">' + room + '</span>' +
    '<span id="sp" style="color:#aaa">0</span>' +
    '<span style="flex:1"></span>' +
    '<span id="sd" style="color:#ff0;font-size:11px"></span>';
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
    } catch (e) { console.error('[S]', t, e); }
    _bp = false;
  }

  // ALL roles execute action broadcasts
  socket.on('action:exec', function(d) { exec(d.type, d.args, d.ctx); });

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
    var bgI = null;
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) { bgI = setInterval(function() { if (window.S && !window.S.paused) { if (O.tickTrains) O.tickTrains(); if (window.S.tick % 8 === 0 && O.updUI) O.updUI(); if (window.S.tick % 4 === 0 && O.updPN) O.updPN(); if (typeof window.simTime === 'number') window.simTime += 0.05; if (window.S.tick % 3 === 0 && O.mallaTrack) O.mallaTrack(); window.S.tick++; } }, 18); }
      else { if (bgI) { clearInterval(bgI); bgI = null; } }
    });
    var txN = 0;
    setInterval(function() {
      if (!conn || !window.S) return;
      var d = [];
      for (var i = 0; i < window.S.trains.length; i++) {
        var t = window.S.trains[i]; if (t.done) continue;
        var idx = Math.min(t.pi, t.pts.length - 2), p = t.pts[idx], q = t.pts[idx + 1];
        if (!p || !q) continue;
        d.push({ id: t.id, x: p.x + (q.x - p.x) * t.t, y: p.y + (q.y - p.y) * t.t,
          spd: t.spd, w: t.w, mHold: t.mHold, sl: t.sl, dir: t.dir,
          stopTimer: t.stopTimer || 0, color: t.color || '#e8a020', cs: t.cs });
      }
      var sigs = {}; if (window.S.sig) for (var s in window.S.sig) sigs[s] = window.S.sig[s].asp;
      txN++;
      socket.emit('train:sync', { trains: d, sigs: sigs, paused: window.S.paused, trSpeedMult: window.trSpeedMult || 1, seq: txN });
      var db = document.getElementById('sd'); if (db) { db.textContent = '🟢TX' + txN + ' T' + d.length; db.style.color = '#0f0'; }
    }, 200);
  }

  // ══════════════════════════════════════════════════
  // CGO & MAQ — ghost trains with smooth interpolation
  // ══════════════════════════════════════════════════
  if (role === 'cgo' || role === 'maquinista') {
    window.tickTrains = function() {};
    window.onSig = function(id) { if (_bp) return O.onSig(id); };
    window.onSw = function(id) { if (_bp) return O.onSw(id); };
    window.sigToSig = function(a, b) { if (_bp) return O.sigToSig(a, b); };
    ['spawnTrain','runScn','tPause','setTrSpeed'].forEach(function(f) { window[f] = function() { if (_bp && O[f]) return O[f].apply(null, arguments); }; });

    // Ghost trains with SMOOTH interpolation
    var ghosts = {}; // id → {g, tx, ty, cx, cy, color, dir, ...state}
    var gTR = document.getElementById('gTR');
    var lastSigs = {};
    var lastTrainData = [];

    function ensureGhost(id, color) {
      if (!gTR) gTR = document.getElementById('gTR');
      if (!gTR) return null;
      if (ghosts[id]) return ghosts[id];
      var g = document.createElementNS(ns, 'g');
      var r = document.createElementNS(ns, 'rect');
      r.setAttribute('width', '54'); r.setAttribute('height', '20'); r.setAttribute('rx', '4');
      r.setAttribute('fill', color || '#e8a020'); r.setAttribute('stroke', '#000'); r.setAttribute('stroke-width', '1.5');
      g.appendChild(r);
      var t = document.createElementNS(ns, 'text');
      t.setAttribute('x', '27'); t.setAttribute('y', '15'); t.setAttribute('fill', '#1a0800');
      t.setAttribute('font-family', 'Share Tech Mono,monospace'); t.setAttribute('font-size', '11');
      t.setAttribute('font-weight', '900'); t.setAttribute('text-anchor', 'middle'); t.textContent = id;
      g.appendChild(t); gTR.appendChild(g);
      ghosts[id] = { g: g, tx: 0, ty: 0, cx: 0, cy: 0, init: false };
      return ghosts[id];
    }

    // ★ SMOOTH ANIMATION LOOP — lerp ghosts toward target position ★
    function animateGhosts() {
      for (var id in ghosts) {
        var gh = ghosts[id];
        if (!gh.init) continue;
        // Lerp 20% per frame toward target (smooth at 60fps)
        gh.cx += (gh.tx - gh.cx) * 0.2;
        gh.cy += (gh.ty - gh.cy) * 0.2;
        gh.g.setAttribute('transform', 'translate(' + (gh.cx - 27) + ',' + (gh.cy - 10) + ')');
      }
      requestAnimationFrame(animateGhosts);
    }
    requestAnimationFrame(animateGhosts);

    // Hide local trains
    setInterval(function() {
      if (!window.S || !window.S.trains) return;
      for (var i = 0; i < window.S.trains.length; i++) {
        var t = window.S.trains[i];
        if (t.el && t.el.getAttribute('display') !== 'none') t.el.setAttribute('display', 'none');
        if (t.pathLine && t.pathLine.getAttribute('display') !== 'none') t.pathLine.setAttribute('display', 'none');
      }
    }, 500);

    socket.on('train:sync', function(data) {
      rxN++;
      var db = document.getElementById('sd');
      if (db) { db.textContent = '🟢RX' + rxN + ' T' + (data.trains ? data.trains.length : 0); db.style.color = '#0f0'; }
      var st = data.trains || [];
      lastTrainData = st;
      lastSigs = data.sigs || {};
      // Update ghost targets (animation loop does the smooth movement)
      var alive = {};
      for (var i = 0; i < st.length; i++) {
        var td = st[i]; alive[td.id] = true;
        var gh = ensureGhost(td.id, td.color);
        if (gh) {
          gh.tx = td.x; gh.ty = td.y;
          if (!gh.init) { gh.cx = td.x; gh.cy = td.y; gh.init = true; }
          // Store state for maquinista cab
          gh.spd = td.spd; gh.w = td.w; gh.mHold = td.mHold; gh.sl = td.sl;
          gh.dir = td.dir; gh.stopTimer = td.stopTimer; gh.color = td.color; gh.cs = td.cs;
        }
      }
      for (var gid in ghosts) {
        if (!alive[gid]) {
          if (ghosts[gid].g.parentNode) ghosts[gid].g.parentNode.removeChild(ghosts[gid].g);
          delete ghosts[gid];
        }
      }
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
        if (myTrain) renderCab();
        else if (st.length > 0) updateMaqGrid(st);
      }
    });

    if (role === 'cgo') setTimeout(function() {
      var mi = document.getElementById('mi'); if (mi) mi.textContent = 'OBSERVADOR CGO';
      document.querySelectorAll('.sg').forEach(function(s) { var t = s.querySelector('.sg-t'); if (!t) return; var tx = t.textContent.toLowerCase();
        if (tx.indexOf('modo') >= 0 || tx.indexOf('manual') >= 0 || tx.indexOf('tren manual') >= 0 || tx.indexOf('grabación') >= 0 || tx.indexOf('escenario') >= 0 || tx.indexOf('rutas') >= 0 || tx.indexOf('bloqueos') >= 0) s.style.display = 'none'; });
      var sp = document.getElementById('spdSel'); if (sp) sp.parentElement.style.display = 'none';
      document.querySelectorAll('.sg').forEach(function(s) { if (s.querySelector('#pBtn')) s.style.display = 'none'; });
    }, 500);

    if (role === 'maquinista') {
      setTimeout(buildCab, 300);
      // Maquinista also runs its own render loop for smooth cab animation
      setInterval(function() { if (myTrain) renderCab(); }, 50);
    }
  }

  // ══════════════════════════════════════════════════
  // MAQUINISTA CAB
  // ══════════════════════════════════════════════════
  var cabC = null, cabX = null, cabOK = false, cabW = 0, cabH = 0;

  function buildCab() {
    if (cabOK) return; cabOK = true;
    var dw = document.querySelector('.dw'); if (dw) dw.style.display = 'none';
    var sb = document.querySelector('.sb'); if (sb) sb.style.display = 'none';
    var vt = document.getElementById('viewToggle'); if (vt) vt.style.display = 'none';
    var d = document.createElement('div');
    d.style.cssText = 'flex:1;display:flex;flex-direction:column;background:#070a0e;overflow:hidden;min-height:0;';
    d.innerHTML =
      '<div id="maqSel" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">' +
        '<div style="font:bold 28px Rajdhani,sans-serif;color:#f59e0b">🚂 Selecciona tu tren</div>' +
        '<div style="font:13px \'Share Tech Mono\',monospace;color:#4a6070">RC debe lanzar tren manual</div>' +
        '<div id="maqGrid" style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center"></div></div>' +
      '<div id="cabIn" style="flex:1;display:none;flex-direction:column;min-height:0;overflow:hidden">' +
        '<div id="cabWrap" style="flex:1;min-height:0;overflow:hidden;position:relative"><canvas id="cabCvs"></canvas></div>' +
        '<div style="flex-shrink:0;height:90px;background:#0d1117;border-top:1px solid #1c2535;display:flex;align-items:center;justify-content:center;gap:20px;padding:8px;flex-wrap:wrap">' +
          '<div style="text-align:center;min-width:60px"><div style="font:bold 36px Rajdhani,sans-serif;color:#00e87a" id="cSpd">0</div><div style="font:8px \'Share Tech Mono\',monospace;color:#4a6070">km/h</div></div>' +
          '<div style="min-width:90px"><div style="font:10px \'Share Tech Mono\',monospace;color:#fff" id="cTid">-</div><div style="font:9px \'Share Tech Mono\',monospace;color:#4a6070" id="cSt">-</div><div style="font:9px \'Share Tech Mono\',monospace;color:#4a6070" id="cPos">-</div></div>' +
          '<div style="display:flex;gap:4px"><button onclick="window._mc(\'go\')" style="padding:6px 14px;font:bold 12px Rajdhani;background:#0e3320;color:#44dd77;border:1px solid #1a5533;border-radius:4px;cursor:pointer">▶ Marcha</button><button onclick="window._mc(\'stop\')" style="padding:6px 14px;font:bold 12px Rajdhani;background:#661616;color:#ff6666;border:1px solid #882222;border-radius:4px;cursor:pointer">⏹ Parar</button><button onclick="window._mc(\'rev\')" style="padding:6px 14px;font:bold 12px Rajdhani;background:#1a1a40;color:#8888ff;border:1px solid #333366;border-radius:4px;cursor:pointer">↩ Retro</button></div>' +
          '<div style="display:flex;align-items:center;gap:4px"><div id="cSa" style="width:16px;height:16px;border-radius:50%;background:#222;border:2px solid #333"></div><div id="cSn" style="font:9px \'Share Tech Mono\',monospace;color:#8888aa">-</div></div></div></div>';
    var app = document.querySelector('.app'); if (app) app.appendChild(d);
    window._mc = function(cmd) { if (myTrain && conn) socket.emit('maq:cmd', { trainId: myTrain, cmd: cmd }); };
    cabC = document.getElementById('cabCvs');
    if (cabC) { cabX = cabC.getContext('2d'); sizeCab(); }
    window.addEventListener('resize', sizeCab);
  }

  function sizeCab() {
    if (!cabC) return;
    var wrap = document.getElementById('cabWrap');
    if (!wrap) return;
    cabW = wrap.clientWidth; cabH = wrap.clientHeight;
    cabC.width = cabW; cabC.height = cabH;
    cabC.style.width = cabW + 'px'; cabC.style.height = cabH + 'px';
  }

  function updateMaqGrid(trains) {
    var g = document.getElementById('maqGrid'); if (!g) return;
    g.innerHTML = '';
    for (var i = 0; i < trains.length; i++) {
      var t = trains[i], c = document.createElement('div');
      c.style.cssText = 'padding:14px 20px;background:#151b25;border:2px solid #1c2535;border-radius:10px;cursor:pointer;text-align:center;min-width:110px;';
      c.innerHTML = '<div style="width:36px;height:14px;background:' + (t.color || '#e8a020') + ';border-radius:4px;margin:0 auto 8px"></div><div style="font:bold 20px \'Share Tech Mono\',monospace;color:#fff">' + t.id + '</div><div style="font:11px \'Share Tech Mono\',monospace;color:#4a6070;margin-top:4px">' + (t.dir === 'AB' ? '→ Par' : '← Impar') + '</div>';
      c.onmouseover = function() { this.style.borderColor = '#f59e0b'; };
      c.onmouseout = function() { this.style.borderColor = '#1c2535'; };
      (function(tid) { c.onclick = function() { myTrain = tid; document.getElementById('maqSel').style.display = 'none'; document.getElementById('cabIn').style.display = 'flex'; document.getElementById('cTid').textContent = 'Tren ' + tid; setTimeout(sizeCab, 50); }; })(t.id);
      g.appendChild(c);
    }
  }

  // ═══ REALISTIC SIGNAL DRAWING ═══
  function drawSignal(x, rY, asp, label, dir, isAvz, ctx) {
    var sC = { STOP: '#ff2222', GO: '#00ee55', PREC: '#ffcc00', PREC_ADV: '#ffcc00', PREC_PRE: '#ffcc00', AN_PAR: '#ffcc00', REBASE: '#ff8844', WHITE_VERT: '#ddeeff', WHITE_HORIZ: '#ddeeff' };
    var postH = isAvz ? 55 : 65;
    var headH = isAvz ? 30 : 40;
    var headW = 14;
    var headTop = rY - postH;
    // Post
    ctx.strokeStyle = '#2a4030'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x, rY - 4); ctx.lineTo(x, headTop + headH); ctx.stroke();
    // Housing
    ctx.fillStyle = '#080f0a'; ctx.strokeStyle = '#2a5040'; ctx.lineWidth = 1.5;
    ctx.fillRect(x - headW / 2, headTop, headW, headH); ctx.strokeRect(x - headW / 2, headTop, headW, headH);
    // Lenses
    var nLens = isAvz ? 3 : 4;
    var spacing = headH / (nLens + 1);
    var lensR = 4;
    // Determine which lens lights up
    var litIndex = -1, litColor = '#222';
    if (!isAvz) {
      // Standard 4-lens: [green, red, white, yellow] top to bottom
      switch (asp) {
        case 'GO': litIndex = 0; litColor = '#00ee55'; break;
        case 'STOP': litIndex = 1; litColor = '#ff2222'; break;
        case 'REBASE': litIndex = 1; litColor = '#ff2222'; break; // red + white
        case 'PREC': case 'PREC_ADV': litIndex = 3; litColor = '#ffcc00'; break;
      }
    } else {
      // Avanzada 3-lens: [green, red, yellow]
      switch (asp) {
        case 'GO': litIndex = 0; litColor = '#00ee55'; break;
        case 'STOP': litIndex = 1; litColor = '#ff2222'; break;
        case 'AN_PAR': case 'PREC_PRE': litIndex = 2; litColor = '#ffcc00'; break;
        case 'PREC_ADV': litIndex = 0; litColor = '#00ee55'; break;
      }
    }
    for (var li = 0; li < nLens; li++) {
      var ly = headTop + spacing * (li + 1);
      var isLit = (li === litIndex);
      ctx.beginPath(); ctx.arc(x, ly, lensR, 0, Math.PI * 2);
      ctx.fillStyle = isLit ? litColor : '#0d1a10';
      ctx.fill();
      ctx.strokeStyle = '#1a3020'; ctx.lineWidth = 0.5; ctx.stroke();
      // Glow
      if (isLit) {
        ctx.beginPath(); ctx.arc(x, ly, lensR + 5, 0, Math.PI * 2);
        ctx.fillStyle = litColor + '30'; ctx.fill();
      }
    }
    // Second lit lens for REBASE (white) and PREC_ADV (yellow+green)
    if (!isAvz && asp === 'REBASE') {
      var wy = headTop + spacing * 3;
      ctx.beginPath(); ctx.arc(x, wy, lensR, 0, Math.PI * 2); ctx.fillStyle = '#ddeeff'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, wy, lensR + 5, 0, Math.PI * 2); ctx.fillStyle = '#ddeeff30'; ctx.fill();
    }
    if (!isAvz && asp === 'PREC_ADV') {
      var gy = headTop + spacing * 1;
      ctx.beginPath(); ctx.arc(x, gy - spacing + spacing, lensR, 0, Math.PI * 2); ctx.fillStyle = '#00ee55'; ctx.fill();
    }
    if (isAvz && asp === 'PREC_ADV') {
      var yy = headTop + spacing * 3;
      ctx.beginPath(); ctx.arc(x, yy, lensR, 0, Math.PI * 2); ctx.fillStyle = '#ffcc00'; ctx.fill();
    }
    // Direction arrow
    var arrowY = headTop - 8;
    ctx.fillStyle = dir === 'R' ? '#ff6666' : '#6688ff';
    ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(dir === 'R' ? '→' : '←', x, arrowY);
    // Label
    ctx.fillStyle = '#6a8898'; ctx.font = '8px "Share Tech Mono",monospace'; ctx.textAlign = 'center';
    ctx.fillText(label, x, arrowY - 10);
  }

  function renderCab() {
    if (!cabC || !cabX || !myTrain) return;
    // Find my ghost
    var gh = ghosts[myTrain];
    if (!gh || !gh.init) return;
    var W = cabW, H = cabH, x = cabX;
    if (W < 10 || H < 10) return;
    var myX = gh.cx, myY = gh.cy;

    // Background
    var sk = x.createLinearGradient(0, 0, 0, H * .55);
    sk.addColorStop(0, '#0a1218'); sk.addColorStop(1, '#162030');
    x.fillStyle = sk; x.fillRect(0, 0, W, H * .55);
    x.fillStyle = '#121810'; x.fillRect(0, H * .55, W, H * .45);
    x.fillStyle = '#1e1c14'; x.fillRect(0, H * .55 - 10, W, 28);
    var rY = H * .55;
    // Rails
    x.strokeStyle = '#777'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, rY); x.lineTo(W, rY); x.stroke();
    x.beginPath(); x.moveTo(0, rY + 10); x.lineTo(W, rY + 10); x.stroke();
    // Sleepers
    x.strokeStyle = '#2a2520'; x.lineWidth = 3;
    var off = (myX * 2) % 18;
    for (var sx = -20; sx < W + 20; sx += 18) { x.beginPath(); x.moveTo(sx - off, rY - 5); x.lineTo(sx - off, rY + 15); x.stroke(); }

    var cx = W / 2, sc = 2.5, SL = window.STN_LBL || {};
    var nN = '-', nA = 'STOP', nD = 99999;

    // Stations
    if (window.XS && window.STNS) for (var si = 0; si < window.STNS.length; si++) {
      var p = window.STNS[si], X = window.XS[p], ssx = cx + (X.center - myX) * sc;
      if (ssx < -250 || ssx > W + 250) continue;
      // Platform
      x.fillStyle = '#2a2520'; x.fillRect(ssx - 60, rY - 16, 120, 12);
      x.strokeStyle = '#444'; x.lineWidth = 1; x.strokeRect(ssx - 60, rY - 16, 120, 12);
      // Name
      x.fillStyle = '#6ad0e0'; x.font = 'bold 12px Rajdhani,sans-serif'; x.textAlign = 'center';
      x.fillText(SL[p] || p, ssx, rY - 24);
    }

    // Signals — realistic multi-lens
    if (lastSigs && window.SIGS) for (var sid in window.SIGS) {
      var sg = window.SIGS[sid], asp = lastSigs[sid] || 'STOP';
      var ssx2 = cx + (sg.x - myX) * sc;
      if (ssx2 < -80 || ssx2 > W + 80 || Math.abs(sg.y - myY) > 60) continue;
      drawSignal(ssx2, rY, asp, sg.l, sg.d, !!sg.avz, x);
      // Track next signal ahead
      var ah = (gh.dir === 'AB') ? (sg.x > myX && sg.d === 'R') : (sg.x < myX && sg.d === 'L');
      if (ah && !sg.avz && sg.t !== 'ret') {
        var dist = Math.abs(sg.x - myX);
        if (dist < nD) { nD = dist; nN = sg.l; nA = asp; }
      }
    }

    // Other trains
    for (var oid in ghosts) {
      if (oid === myTrain) continue;
      var og = ghosts[oid]; if (!og.init) continue;
      var ox = cx + (og.cx - myX) * sc;
      if (ox < -50 || ox > W + 50 || Math.abs(og.cy - myY) > 40) continue;
      x.fillStyle = og.color || '#e8a020'; x.fillRect(ox - 18, rY - 10, 36, 13);
      x.strokeStyle = '#000'; x.lineWidth = 1; x.strokeRect(ox - 18, rY - 10, 36, 13);
      x.fillStyle = '#fff'; x.font = 'bold 9px Rajdhani'; x.textAlign = 'center'; x.fillText(oid, ox, rY - 13);
    }

    // My train
    x.fillStyle = gh.color || '#f59e0b';
    x.fillRect(cx - 25, rY - 13, 50, 16);
    x.strokeStyle = '#fff'; x.lineWidth = 2; x.strokeRect(cx - 25, rY - 13, 50, 16);
    x.fillStyle = '#fff'; x.font = 'bold 11px Rajdhani'; x.textAlign = 'center';
    x.fillText(myTrain, cx, rY - 16);
    // Direction
    x.fillStyle = '#f59e0b'; x.font = 'bold 16px sans-serif';
    x.fillText(gh.dir === 'AB' ? '→' : '←', cx, rY + 30);

    // Info panel
    var spd = gh.w || gh.mHold ? 0 : Math.round(gh.spd * 50 * (window.trSpeedMult || 1));
    var e = document.getElementById('cSpd'); if (e) e.textContent = spd;
    e = document.getElementById('cSt'); if (e) e.textContent = gh.mHold ? '⏹ Detenido' : gh.stopTimer > 0 ? '🚏 Parada' : gh.w ? '🔴 Señal' : '🟢 Marcha';
    var pos = 'En línea';
    if (window.XS && window.STNS) for (var pi = 0; pi < window.STNS.length; pi++) {
      var pp = window.STNS[pi], PX = window.XS[pp];
      if (myX >= PX.leftEdge && myX <= PX.rightEdge) { pos = SL[pp] || pp; break; }
    }
    e = document.getElementById('cPos'); if (e) e.textContent = pos;
    e = document.getElementById('cSn'); if (e) e.textContent = nN;
    var sCC = { STOP: '#ff2222', GO: '#00ee55', PREC: '#ffcc00', AN_PAR: '#ffcc00', PREC_ADV: '#ffcc00', PREC_PRE: '#ffcc00', REBASE: '#ff8844' };
    var nc = sCC[nA] || '#222';
    e = document.getElementById('cSa'); if (e) { e.style.background = nc; e.style.borderColor = nc === '#222' ? '#333' : nc; e.style.boxShadow = nc === '#222' ? 'none' : '0 0 8px ' + nc; }
  }

  // Connection
  socket.on('connect', function() {
    socket.emit('room:join', { name: nm, code: room, role: role }, function(r) {
      var e = document.getElementById('ss');
      if (r.ok) { conn = true; e.textContent = '🟢'; e.style.color = '#00e87a'; }
      else { e.textContent = '🔴'; e.style.color = '#f44'; }
    });
  });
  socket.on('disconnect', function() { conn = false; document.getElementById('ss').textContent = '🟡'; document.getElementById('ss').style.color = '#ffc144'; });
  socket.on('room:players', function(p) { var e = document.getElementById('sp'); if (e) e.textContent = p.length + ' jug'; });
  socket.on('room:player-left', function(d) { if (window.log) window.log('👋 ' + d.name, 'i'); });
  socket.on('comms:message', function(m) { if (window.log) window.log('📻 ' + m.from + ': ' + m.text, 'i'); });
})();
