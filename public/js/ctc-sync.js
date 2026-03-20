// ctc-sync.js — Multiplayer sync + Maquinista cab view
(function() {
  'use strict';
  var params = JSON.parse(sessionStorage.getItem('ctc_session') || 'null');
  if (!params) return;

  var room = params.room, name = params.name, role = params.role;
  var socket = io();
  var connected = false, isMaster = false, _bypass = false;
  var myTrainId = null; // For maquinista

  // ── Status bar ───────────────────────────────────
  var bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;display:flex;align-items:center;gap:8px;padding:4px 12px;font:11px "Share Tech Mono",monospace;background:rgba(7,9,13,0.95);border-bottom:1px solid #1c2535;';
  var clr = role==='rc'?'#4ea8ff':role==='cgo'?'#a78bfa':'#f59e0b';
  var lbl = role==='rc'?'🔧 RC':role==='cgo'?'👁 CGO':'🚂 MAQ';
  bar.innerHTML='<span style="color:#ffc144" id="syncStatus">⏳</span>'+
    '<span style="color:#4a6070">|</span>'+
    '<span style="color:'+clr+';font-weight:bold">'+lbl+'</span> '+
    '<span style="color:#4a6070">'+name+'</span>'+
    '<span style="color:#4a6070">| <b style="color:#00e87a">'+room+'</b></span>'+
    '<span style="color:#4a6070">|</span>'+
    '<span id="syncPlayers" style="color:#4a6070">0</span>'+
    '<span id="syncMaster" style="color:#4a6070;margin-left:4px"></span>'+
    '<span style="flex:1"></span>'+
    '<span style="color:'+clr+';font-weight:bold">'+lbl+'</span>';
  document.body.prepend(bar);
  document.body.style.paddingTop='28px';

  // ── Capture originals ────────────────────────────
  var O={};
  ['openRoute','cancelRoute','doSpawn','mAsp','onSw','onSig','reqBlk','grantBlk',
   'clearBlk','scenario','resetSim','resetSim2','tPause','setTrSpeed',
   'trCmd','sigToSig','undoLast','spawnTrain','runScn','posTr','updSeg'].forEach(function(fn){
    if(typeof window[fn]==='function')O[fn]=window[fn];
  });

  function send(t,a,c){
    if(!connected){if(O[t])O[t].apply(null,a||[]);return;}
    socket.emit('action',{type:t,args:a||[],ctx:c||{}});
  }
  function execB(t,a,c){
    _bypass=true;
    try{
      if(c&&c.sel!==undefined&&window.S)window.S.sel=c.sel;
      if(c&&c.selTrId!==undefined)window.selTrId=c.selTrId;
      if(c&&c.scnVal!==undefined){var s=document.getElementById('scnSel');if(s)s.value=c.scnVal;}
      if(O[t])O[t].apply(null,a||[]);
      if(t==='setTrSpeed'){var s2=document.getElementById('spdSel');if(s2)s2.value=a[0];}
    }catch(e){console.error('[SYNC]',t,e);}
    _bypass=false;
  }

  // ══════════════════════════════════════════════════
  // RC OVERRIDES
  // ══════════════════════════════════════════════════
  if(role==='rc'){
    window.openRoute=function(rk){if(_bypass)return O.openRoute(rk);send('openRoute',[rk]);};
    window.cancelRoute=function(rk){if(_bypass)return O.cancelRoute(rk);send('cancelRoute',[rk]);};
    window.doSpawn=function(dir){if(_bypass)return O.doSpawn(dir);send('doSpawn',[dir]);};
    window.mAsp=function(a){if(_bypass)return O.mAsp(a);send('mAsp',[a],{sel:window.S?window.S.sel:null});};
    window.onSw=function(id){if(_bypass)return O.onSw(id);send('onSw',[id]);};
    window.reqBlk=function(n,d,v){if(_bypass)return O.reqBlk(n,d,v);send('reqBlk',[n,d,v]);};
    window.grantBlk=function(n,v){if(_bypass)return O.grantBlk(n,v);send('grantBlk',[n,v]);};
    window.clearBlk=function(n,v){if(_bypass)return O.clearBlk(n,v);send('clearBlk',[n,v]);};
    window.scenario=function(n){if(_bypass)return O.scenario(n);send('scenario',[n]);};
    window.resetSim=function(){if(_bypass)return O.resetSim();send('resetSim',[]);};
    window.resetSim2=function(){if(_bypass)return O.resetSim2();send('resetSim2',[]);};
    window.tPause=function(){if(_bypass)return O.tPause();send('tPause',[]);};
    window.setTrSpeed=function(v){if(_bypass)return O.setTrSpeed(v);send('setTrSpeed',[v]);};
    window.trCmd=function(cmd){if(_bypass)return O.trCmd(cmd);send('trCmd',[cmd],{selTrId:window.selTrId});};
    window.sigToSig=function(a,b){if(_bypass)return O.sigToSig(a,b);send('sigToSig',[a,b]);};
    window.undoLast=function(){if(_bypass)return O.undoLast();send('undoLast',[]);};
    window.spawnTrain=function(){if(_bypass)return O.spawnTrain();
      var dir=document.getElementById('tDir')?document.getElementById('tDir').value:'AB';
      send('doSpawn',[dir]);};
    window.runScn=function(){if(_bypass)return O.runScn();
      var v=document.getElementById('scnSel')?parseInt(document.getElementById('scnSel').value):0;
      if(v>0)send('scenario',[v],{scnVal:v});};
    window.onSig=function(id){if(_bypass)return O.onSig(id);
      if(window.S&&window.S.mode==='auto'){
        if(window.S.pending){if(window.S.pending===id){if(window.clearPend)window.clearPend();return;}
          var p=window.S.pending;if(window.clearPend)window.clearPend();send('sigToSig',[p,id]);return;}
        O.onSig(id);}else{O.onSig(id);}};

    // Master RC: sync train positions
    socket.on('master:promoted',function(){isMaster=true;
      var el=document.getElementById('syncMaster');if(el)el.textContent='★ MASTER';});

    setInterval(function(){
      if(!connected||!isMaster||!window.S||!window.S.trains)return;
      var d=[];
      for(var i=0;i<window.S.trains.length;i++){
        var tr=window.S.trains[i];if(tr.done)continue;
        var idx=Math.min(tr.pi,tr.pts.length-2);
        var p=tr.pts[idx],q=tr.pts[idx+1];
        var cx=p?p.x+(q.x-p.x)*tr.t:0,cy=p?p.y+(q.y-p.y)*tr.t:0;
        d.push({id:tr.id,pi:tr.pi,t:tr.t,spd:tr.spd,
          x:Math.round(cx*10)/10,y:Math.round(cy*10)/10,
          w:tr.w,mHold:tr.mHold,sl:tr.sl,cs:tr.cs,
          dir:tr.dir,done:tr.done,stopTimer:tr.stopTimer||0,
          color:tr.color||'#e8a020'});
      }
      // Also collect signal states for maquinista
      var sigs={};
      if(window.S.sig){
        for(var sid in window.S.sig){
          sigs[sid]={asp:window.S.sig[sid].asp};
        }
      }
      socket.volatile.emit('train:sync',{trains:d,tick:window.S.tick,
        paused:window.S.paused,simTime:window.simTime||0,
        trSpeedMult:window.trSpeedMult||1,signals:sigs});
    },300);
  }

  // ══════════════════════════════════════════════════
  // CGO: Full read-only
  // ══════════════════════════════════════════════════
  if(role==='cgo'){
    ['openRoute','cancelRoute','doSpawn','mAsp','reqBlk','grantBlk','clearBlk',
     'scenario','resetSim','resetSim2','spawnTrain','runScn','undoLast','trCmd',
     'tPause','setTrSpeed'].forEach(function(fn){
      window[fn]=function(){if(_bypass&&O[fn])return O[fn].apply(null,arguments);};
    });
    window.onSig=function(){if(_bypass&&O.onSig)return O.onSig.apply(null,arguments);};
    window.onSw=function(){if(_bypass&&O.onSw)return O.onSw.apply(null,arguments);};
    window.sigToSig=function(){if(_bypass&&O.sigToSig)return O.sigToSig.apply(null,arguments);};

    setTimeout(function(){
      var mi=document.getElementById('mi');if(mi)mi.textContent='MODO: OBSERVADOR CGO';
      document.querySelectorAll('.sg').forEach(function(s){
        var t=s.querySelector('.sg-t');if(!t)return;var tx=t.textContent.toLowerCase();
        if(tx.indexOf('modo')>=0||tx.indexOf('manual')>=0||tx.indexOf('tren manual')>=0||
           tx.indexOf('grabación')>=0||tx.indexOf('escenario')>=0||tx.indexOf('rutas rápidas')>=0||
           tx.indexOf('bloqueos')>=0)s.style.display='none';
      });
      var sp=document.getElementById('spdSel');if(sp)sp.parentElement.style.display='none';
      document.querySelectorAll('.sg').forEach(function(s){
        var b=s.querySelector('#pBtn');if(b)s.style.display='none';
      });
    },500);

    // CGO receives train sync
    socket.on('train:sync',function(data){applySyncToLocal(data);});
  }

  // ══════════════════════════════════════════════════
  // MAQUINISTA: Simplified cab view
  // ══════════════════════════════════════════════════
  if(role==='maquinista'){
    // Block all CTC interactions
    ['openRoute','cancelRoute','doSpawn','mAsp','reqBlk','grantBlk','clearBlk',
     'scenario','resetSim','resetSim2','spawnTrain','runScn','undoLast','trCmd',
     'tPause','setTrSpeed'].forEach(function(fn){
      window[fn]=function(){if(_bypass&&O[fn])return O[fn].apply(null,arguments);};
    });
    window.onSig=function(){if(_bypass&&O.onSig)return O.onSig.apply(null,arguments);};
    window.onSw=function(){if(_bypass&&O.onSw)return O.onSw.apply(null,arguments);};
    window.sigToSig=function(){if(_bypass&&O.sigToSig)return O.sigToSig.apply(null,arguments);};

    var lastSyncData=null;

    // Hide CTC, show cab view
    setTimeout(function(){buildCabView();},200);

    socket.on('train:sync',function(data){
      lastSyncData=data;
      applySyncToLocal(data);
      if(myTrainId)renderCab(data);
    });

    // Also receive action broadcasts to keep CTC state in sync (for segment colors etc)
    // (handled by the global action:exec listener below)
  }

  // ── Shared: apply train sync to local CTC ──────
  function applySyncToLocal(data){
    if(!window.S||!window.S.trains)return;
    if(typeof data.trSpeedMult==='number')window.trSpeedMult=data.trSpeedMult;
    if(typeof data.simTime==='number')window.simTime=data.simTime;
    if(typeof data.paused==='boolean'&&window.S.paused!==data.paused){
      window.S.paused=data.paused;
      var pb=document.getElementById('pBtn');if(pb)pb.textContent=data.paused?'▶':'⏸';
    }
    var st=data.trains;if(!st)return;
    for(var si=0;si<st.length;si++){
      var sd=st[si],local=null;
      for(var li=0;li<window.S.trains.length;li++){
        if(window.S.trains[li].id===sd.id){local=window.S.trains[li];break;}
      }
      if(!local)continue;
      local.pi=sd.pi;local.t=sd.t;local.spd=sd.spd;local.w=sd.w;
      local.mHold=sd.mHold;local.sl=sd.sl;local.dir=sd.dir;local.stopTimer=sd.stopTimer;
      if(sd.cs!==local.cs){
        if(local.cs&&window.S.seg[local.cs]){window.S.seg[local.cs].occ=false;if(O.updSeg)O.updSeg(local.cs);}
        local.cs=sd.cs;
        if(local.cs&&window.S.seg[local.cs]){window.S.seg[local.cs].occ=true;if(O.updSeg)O.updSeg(local.cs);}
      }
      if(O.posTr)O.posTr(local);
    }
    for(var ri=window.S.trains.length-1;ri>=0;ri--){
      var tr=window.S.trains[ri],found=false;
      for(var fi=0;fi<st.length;fi++){if(st[fi].id===tr.id){found=true;break;}}
      if(!found&&!tr.done){tr.done=true;if(tr.el)tr.el.remove();if(tr.pathLine)tr.pathLine.remove();window.S.trains.splice(ri,1);}
    }
  }

  // ══════════════════════════════════════════════════
  // MAQUINISTA CAB VIEW
  // ══════════════════════════════════════════════════
  var cabDiv=null,cabCanvas=null,cabCtx=null,trainSelectDiv=null;
  var STN_LBL=null; // Will read from window.STN_LBL after CTC loads

  function buildCabView(){
    STN_LBL=window.STN_LBL||{};
    // Hide CTC diagram
    var dw=document.querySelector('.dw');if(dw)dw.style.display='none';
    var sb=document.querySelector('.sb');if(sb)sb.style.display='none';
    var vt=document.getElementById('viewToggle');if(vt)vt.style.display='none';

    // Create cab container
    cabDiv=document.createElement('div');
    cabDiv.style.cssText='flex:1;display:flex;flex-direction:column;background:#070a0e;overflow:hidden;';

    // Train selection
    trainSelectDiv=document.createElement('div');
    trainSelectDiv.id='maqSelect';
    trainSelectDiv.style.cssText='flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;';
    trainSelectDiv.innerHTML='<div style="font:bold 24px Rajdhani,sans-serif;color:#f59e0b">🚂 Selecciona tu tren</div>'+
      '<div style="font:12px \'Share Tech Mono\',monospace;color:#4a6070">Esperando trenes... El RC debe lanzar un escenario</div>'+
      '<div id="maqTrainGrid" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:600px"></div>';
    cabDiv.appendChild(trainSelectDiv);

    // Cab view (hidden until train selected)
    var cabInner=document.createElement('div');
    cabInner.id='cabInner';
    cabInner.style.cssText='flex:1;display:none;flex-direction:column;';
    cabInner.innerHTML=
      '<div id="cabLateral" style="flex:1;position:relative;overflow:hidden;background:#080c14;min-height:200px">'+
        '<canvas id="cabCanvas" style="width:100%;height:100%;display:block"></canvas>'+
      '</div>'+
      '<div id="cabControls" style="height:120px;background:#0d1117;border-top:1px solid #1c2535;display:flex;align-items:center;justify-content:center;gap:20px;padding:16px;">'+
        '<div style="text-align:center">'+
          '<div style="font:bold 48px Rajdhani,sans-serif;color:#00e87a" id="cabSpeed">0</div>'+
          '<div style="font:10px \'Share Tech Mono\',monospace;color:#4a6070">km/h</div>'+
        '</div>'+
        '<div style="display:flex;flex-direction:column;gap:6px;align-items:center">'+
          '<div style="font:10px \'Share Tech Mono\',monospace;color:#4a6070" id="cabTrainId">---</div>'+
          '<div style="font:10px \'Share Tech Mono\',monospace;color:#4a6070" id="cabState">---</div>'+
          '<div style="font:10px \'Share Tech Mono\',monospace;color:#4a6070" id="cabPos">---</div>'+
        '</div>'+
        '<div style="display:flex;gap:8px">'+
          '<button onclick="window._maqCmd(\'go\')" style="padding:10px 20px;font:bold 14px Rajdhani;background:#0e3320;color:#44dd77;border:1px solid #1a5533;border-radius:6px;cursor:pointer">▶ Marcha</button>'+
          '<button onclick="window._maqCmd(\'stop\')" style="padding:10px 20px;font:bold 14px Rajdhani;background:#661616;color:#ff6666;border:1px solid #882222;border-radius:6px;cursor:pointer">⏹ Parar</button>'+
          '<button onclick="window._maqCmd(\'rev\')" style="padding:10px 20px;font:bold 14px Rajdhani;background:#1a1a40;color:#8888ff;border:1px solid #333366;border-radius:6px;cursor:pointer">↩ Retroceder</button>'+
        '</div>'+
        '<div id="cabNextSig" style="display:flex;align-items:center;gap:8px">'+
          '<div style="font:9px \'Share Tech Mono\',monospace;color:#4a6070">Próxima señal:</div>'+
          '<div id="cabSigAsp" style="width:24px;height:24px;border-radius:50%;background:#222;border:2px solid #333"></div>'+
          '<div id="cabSigName" style="font:11px \'Share Tech Mono\',monospace;color:#8888aa">---</div>'+
        '</div>'+
      '</div>';
    cabDiv.appendChild(cabInner);

    document.querySelector('.app').appendChild(cabDiv);

    // Maquinista commands
    window._maqCmd=function(cmd){
      if(!myTrainId||!connected)return;
      socket.emit('maq:cmd',{trainId:myTrainId,cmd:cmd});
    };

    cabCanvas=document.getElementById('cabCanvas');
    cabCtx=cabCanvas.getContext('2d');
  }

  function updateTrainGrid(trains){
    var grid=document.getElementById('maqTrainGrid');
    if(!grid||!trains)return;
    grid.innerHTML='';
    for(var i=0;i<trains.length;i++){
      var tr=trains[i];
      var card=document.createElement('div');
      card.style.cssText='padding:12px 20px;background:#151b25;border:2px solid #1c2535;border-radius:8px;cursor:pointer;text-align:center;transition:all 0.2s;min-width:100px;';
      card.innerHTML='<div style="width:30px;height:12px;background:'+tr.color+';border-radius:3px;margin:0 auto 6px"></div>'+
        '<div style="font:bold 18px \'Share Tech Mono\',monospace;color:#fff">'+tr.id+'</div>'+
        '<div style="font:10px \'Share Tech Mono\',monospace;color:#4a6070">'+(tr.dir==='AB'?'→ Par':'← Impar')+'</div>';
      card.onmouseover=function(){this.style.borderColor='#f59e0b';};
      card.onmouseout=function(){this.style.borderColor='#1c2535';};
      (function(tid){
        card.onclick=function(){
          myTrainId=tid;
          document.getElementById('maqSelect').style.display='none';
          document.getElementById('cabInner').style.display='flex';
          document.getElementById('cabTrainId').textContent='Tren '+tid;
          resizeCab();
        };
      })(tr.id);
      grid.appendChild(card);
    }
  }

  function resizeCab(){
    if(!cabCanvas)return;
    var r=cabCanvas.parentElement;
    cabCanvas.width=r.clientWidth;cabCanvas.height=r.clientHeight;
  }
  window.addEventListener('resize',resizeCab);

  function renderCab(data){
    if(!cabCanvas||!cabCtx||!myTrainId)return;

    // Update train grid if no train selected yet
    if(!myTrainId||document.getElementById('maqSelect').style.display!=='none'){
      updateTrainGrid(data.trains);
      return;
    }

    // Find my train
    var my=null;
    for(var i=0;i<data.trains.length;i++){
      if(data.trains[i].id===myTrainId){my=data.trains[i];break;}
    }
    if(!my){document.getElementById('cabState').textContent='Tren perdido';return;}

    resizeCab();
    var W=cabCanvas.width,H=cabCanvas.height;
    if(W<10||H<10)return;
    var ctx=cabCtx;

    // Sky gradient
    var sky=ctx.createLinearGradient(0,0,0,H*0.55);
    sky.addColorStop(0,'#0c1520');sky.addColorStop(1,'#1a2a3a');
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,H*0.55);

    // Ground
    ctx.fillStyle='#141810';ctx.fillRect(0,H*0.55,W,H*0.45);

    // Ballast
    ctx.fillStyle='#222018';ctx.fillRect(0,H*0.55-8,W,24);

    // Rails
    var railY=H*0.55;
    ctx.strokeStyle='#666';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(0,railY);ctx.lineTo(W,railY);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,railY+10);ctx.lineTo(W,railY+10);ctx.stroke();

    // Sleepers
    ctx.strokeStyle='#2a2520';ctx.lineWidth=3;
    var offset=(my.x*2)%18;
    for(var sx=-20;sx<W+20;sx+=18){
      ctx.beginPath();ctx.moveTo(sx-offset,railY-4);ctx.lineTo(sx-offset,railY+14);ctx.stroke();
    }

    // Center of screen = my train position
    var cx=W/2,scale=2.5;
    var myX=my.x,myY=my.y;

    // Draw stations
    if(window.XS&&window.STNS){
      for(var si=0;si<window.STNS.length;si++){
        var p=window.STNS[si],X=window.XS[p];
        var screenX=cx+(X.center-myX)*scale;
        if(screenX<-200||screenX>W+200)continue;
        // Platform
        ctx.fillStyle='#2a2520';
        ctx.fillRect(screenX-50,railY-14,100,10);
        ctx.strokeStyle='#444';ctx.lineWidth=1;
        ctx.strokeRect(screenX-50,railY-14,100,10);
        // Name
        var sName=(STN_LBL&&STN_LBL[p])?STN_LBL[p]:('Est.'+(si+1));
        ctx.fillStyle='#6ad0e0';ctx.font='bold 11px Rajdhani,sans-serif';ctx.textAlign='center';
        ctx.fillText(sName,screenX,railY-22);
      }
    }

    // Draw signals near me
    var sigColors={'STOP':'#ff2222','GO':'#00ee55','PREC':'#ffcc00','PREC_ADV':'#ffcc00',
      'PREC_PRE':'#ffcc00','AN_PAR':'#ffcc00','REBASE':'#ff8800',
      'WHITE_VERT':'#ddeeff','WHITE_HORIZ':'#ddeeff'};
    var nextSigName='---',nextSigAsp='STOP',nextSigDist=99999;

    if(data.signals&&window.SIGS){
      for(var sid in window.SIGS){
        var sg=window.SIGS[sid];
        var asp=data.signals[sid]?data.signals[sid].asp:'STOP';
        var screenSX=cx+(sg.x-myX)*scale;
        if(screenSX<-100||screenSX>W+100)continue;
        if(Math.abs(sg.y-myY)>60)continue;

        // Signal post
        var postBot=railY-4,postTop=postBot-50;
        ctx.strokeStyle='#444';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(screenSX,postBot);ctx.lineTo(screenSX,postTop);ctx.stroke();

        // Signal head
        ctx.fillStyle='#111';ctx.fillRect(screenSX-8,postTop,16,24);
        ctx.strokeStyle='#333';ctx.lineWidth=1;ctx.strokeRect(screenSX-8,postTop,16,24);

        // Light
        var col=sigColors[asp]||'#222';
        ctx.beginPath();ctx.arc(screenSX,postTop+12,5,0,Math.PI*2);
        ctx.fillStyle=col;ctx.fill();
        if(col!=='#222'){
          ctx.beginPath();ctx.arc(screenSX,postTop+12,10,0,Math.PI*2);
          ctx.fillStyle=col+'40';ctx.fill();
        }

        // Label
        ctx.fillStyle='#8888aa';ctx.font='8px "Share Tech Mono",monospace';ctx.textAlign='center';
        ctx.fillText(sg.l,screenSX,postTop-4);

        // Track next signal ahead
        var isAhead=(my.dir==='AB')?(sg.x>myX&&sg.d==='R'):(sg.x<myX&&sg.d==='L');
        if(isAhead&&!sg.avz&&sg.t!=='ret'){
          var dist=Math.abs(sg.x-myX);
          if(dist<nextSigDist){nextSigDist=dist;nextSigName=sg.l;nextSigAsp=asp;}
        }
      }
    }

    // Draw other trains
    for(var oi=0;oi<data.trains.length;oi++){
      var ot=data.trains[oi];
      if(ot.id===myTrainId)continue;
      var osx=cx+(ot.x-myX)*scale;
      if(osx<-60||osx>W+60)continue;
      if(Math.abs(ot.y-myY)>40)continue;
      ctx.fillStyle=ot.color||'#e8a020';
      ctx.fillRect(osx-18,railY-10,36,12);
      ctx.fillStyle='#fff';ctx.font='bold 9px Rajdhani,sans-serif';ctx.textAlign='center';
      ctx.fillText(ot.id,osx,railY-13);
    }

    // My train (center)
    ctx.fillStyle=my.color||'#f59e0b';
    ctx.fillRect(cx-24,railY-12,48,14);
    ctx.strokeStyle='#fff';ctx.lineWidth=1.5;
    ctx.strokeRect(cx-24,railY-12,48,14);
    // Cab
    var cabX=my.dir==='AB'?cx+14:cx-24;
    ctx.fillStyle='#222';ctx.fillRect(cabX,railY-20,10,10);
    // Number
    ctx.fillStyle='#fff';ctx.font='bold 11px Rajdhani,sans-serif';ctx.textAlign='center';
    ctx.fillText(my.id,cx,railY-24);

    // Direction arrow
    ctx.fillStyle='#f59e0b';ctx.font='bold 16px sans-serif';
    ctx.fillText(my.dir==='AB'?'→':'←',cx,railY+30);

    // Update info panel
    var speedEst=my.w?0:Math.round(my.spd*50*(window.trSpeedMult||1));
    document.getElementById('cabSpeed').textContent=my.mHold?'0':my.w?'0':speedEst;
    document.getElementById('cabState').textContent=
      my.mHold?'⏹ Detenido':my.stopTimer>0?'🚏 Parada comercial':my.w?'🔴 Señal en rojo':my.sl>0?'🟡 Frenando':'🟢 En marcha';

    // Position: find which station we're near
    var posText='En línea';
    if(window.XS&&window.STNS){
      for(var pi=0;pi<window.STNS.length;pi++){
        var pp=window.STNS[pi],PX=window.XS[pp];
        if(my.x>=PX.leftEdge&&my.x<=PX.rightEdge){
          posText=(STN_LBL&&STN_LBL[pp])?STN_LBL[pp]:('Est.'+(pi+1));break;
        }
      }
    }
    document.getElementById('cabPos').textContent=posText;

    // Next signal
    var sigAspEl=document.getElementById('cabSigAsp');
    var sigNameEl=document.getElementById('cabSigName');
    sigNameEl.textContent=nextSigName;
    var nc=sigColors[nextSigAsp]||'#222';
    sigAspEl.style.background=nc;
    sigAspEl.style.borderColor=nc==='#222'?'#333':nc;
    sigAspEl.style.boxShadow=nc==='#222'?'none':'0 0 8px '+nc;
  }

  // ══════════════════════════════════════════════════
  // ALL: Receive broadcasts
  // ══════════════════════════════════════════════════
  socket.on('action:exec',function(d){execB(d.type,d.args,d.ctx);});

  // ══════════════════════════════════════════════════
  // CONNECTION
  // ══════════════════════════════════════════════════
  socket.on('connect',function(){
    socket.emit('room:join',{name:name,code:room,role:role},function(res){
      var el=document.getElementById('syncStatus');
      if(res.ok){
        connected=true;isMaster=!!res.isMaster;
        el.innerHTML='🟢 Conectado';el.style.color='#00e87a';
        if(isMaster){var m=document.getElementById('syncMaster');if(m)m.textContent='★ MASTER';}
      }else{el.innerHTML='🔴 '+(res.reason||'Error');el.style.color='#ff4444';}
    });
  });
  socket.on('disconnect',function(){
    connected=false;
    var el=document.getElementById('syncStatus');
    el.innerHTML='🟡 Reconectando...';el.style.color='#ffc144';
  });
  socket.on('room:players',function(p){
    var el=document.getElementById('syncPlayers');if(el)el.textContent=p.length+' jugadores';
  });
  socket.on('room:player-left',function(d){if(window.log)window.log('👋 '+d.name+' desconectado','i');});
  socket.on('comms:message',function(m){if(window.log)window.log('📻 '+m.from+': '+m.text,'i');});
})();
