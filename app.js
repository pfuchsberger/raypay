(() => {
  'use strict';
  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d', { alpha:true });
  const flash = document.getElementById('flash');
  const thunder = document.getElementById('thunder');
  let W=0,H=0,DPR=1,frame=0,token=0,arcs=[],particles=[],lastVisibilityFire=0;
  function resize() {
    DPR=Math.min(window.devicePixelRatio||1,2);
    W=innerWidth; H=innerHeight;
    canvas.width=Math.round(W*DPR);
    canvas.height=Math.round(H*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  window.addEventListener('resize',resize);
  resize();
  const rng=(seed)=>{ let a=seed>>>0;return ()=>{a=(a*1664525+1013904223)>>>0;return a/4294967296;}; };
  function bolt(seed,x1,y1,x2,y2,segments=22,amplitude=.17) {
    const r=rng(seed),points=[];
    for(let i=0;i<=segments;i++){
      const t=i/segments;
      const edge=(i===0||i===segments)?0:Math.sin(t*Math.PI);
      points.push({
        x:x1+(x2-x1)*t+(r()-.5)*W*amplitude*edge,
        y:y1+(y2-y1)*t+(r()-.5)*H*.052*edge
      });
    }
    return points;
  }
  function createElectricity() {
    // Varios rayos amarillos, de punta a punta de la pantalla.
    arcs=[
      {points:bolt(12,W*.07,H*.92,W*.95,H*.07,24,.18),thick:1},
      {points:bolt(87,W*.24,H*.99,W*.79,H*.05,20,.15),thick:.64},
      {points:bolt(31,W*.04,H*.72,W*.91,H*.31,17,.13),thick:.5},
      {points:bolt(119,W*.5,H*.57,W*.99,H*.76,12,.11),thick:.31}
    ];
    const r=rng(191),cx=W*.53,cy=H*.46;
    particles=[];
    for(let i=0;i<130;i++){
      let a=r()*Math.PI*2,dist=(.12+r()*.8)*Math.max(W,H);
      particles.push({x:cx,y:cy,dx:Math.cos(a)*dist,dy:Math.sin(a)*dist,
        delay:r()*.32,size:.5+r()*2.6});
    }
  }
  function drawArc(points,reveal,color,lineWidth,glow) {
    if(reveal<=0)return;
    const n=Math.max(1,Math.ceil((points.length-1)*Math.min(reveal,1)));
    ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
    for(let i=1;i<=n;i++)ctx.lineTo(points[i].x,points[i].y);
    ctx.strokeStyle=color; ctx.lineWidth=lineWidth;
    ctx.lineCap='round';ctx.lineJoin='round';
    ctx.shadowColor='#ffe044';ctx.shadowBlur=glow;
    ctx.stroke();ctx.shadowBlur=0;
  }
  function animate(start,runId){
    if(runId!==token)return;
    const t=(performance.now()-start)/1800;
    ctx.clearRect(0,0,W,H);
    if(t>=1){flash.style.opacity='0';return;}
    const reveal=Math.min(1,t/.24),fade=t<.37?1:Math.max(0,(1-t)/.63);
    const strobe=t<.085?Math.sin(t/.085*Math.PI)*.85:t<.19?.38*fade:.16*fade;
    flash.style.opacity=String(Math.max(0,strobe));
    ctx.save();ctx.globalCompositeOperation='lighter';
    arcs.forEach((a,i)=>{
      const progress=Math.max(0,Math.min(1,reveal-i*.09));
      const strength=fade*(1-i*.15);
      ctx.globalAlpha=strength*.42;drawArc(a.points,progress,'#ffc400',24*a.thick,32);
      ctx.globalAlpha=strength*.88;drawArc(a.points,progress,'#ffe128',10*a.thick,19);
      ctx.globalAlpha=strength;drawArc(a.points,progress,'#fffde8',3.2*a.thick,7);
    });
    for(let i=0;i<particles.length;i++){
      const p=particles[i],q=Math.max(0,(t-p.delay)/(1-p.delay));
      if(q<=0||q>=1)continue;
      const ease=1-(1-q)*(1-q);
      ctx.globalAlpha=(1-q)*fade*.92;
      ctx.fillStyle=i%4===0?'#fffde4':'#ffdf42';
      ctx.beginPath();ctx.arc(p.x+p.dx*ease,p.y+p.dy*ease,Math.max(.4,p.size*(1-q*.5)),0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
    frame=requestAnimationFrame(()=>animate(start,runId));
  }
  // --- Audio ---
  // iOS: (1) sólo deja sonar dentro de un gesto válido (touchend/click, NO pointerdown/touchstart);
  // (2) con el interruptor de silencio activo, Web Audio queda mudo salvo que la sesión sea 'playback'.
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch(_){ }
  const AC = window.AudioContext || window.webkitAudioContext;
  let actx = null, thunderBuf = null;
  if (AC) {
    try {
      actx = new AC();
      fetch('thunder.wav').then(r => r.arrayBuffer())
        .then(b => new Promise((ok, ko) => actx.decodeAudioData(b, ok, ko)))
        .then(buf => { thunderBuf = buf; }).catch(() => {});
    } catch(_) { actx = null; }
  }
  function playElement(){
    try {thunder.pause();thunder.currentTime=0;const p=thunder.play();if(p&&p.catch)p.catch(()=>{});}catch(_){ }
  }
  function playThunder(){
    // Al abrir mediante Atajos (sin toque), iOS bloquea el audio: el rayo visual igual se ve.
    if (actx && thunderBuf) {
      try {
        if (actx.state !== 'running') actx.resume();
        const src = actx.createBufferSource();
        src.buffer = thunderBuf; src.connect(actx.destination); src.start(0);
        return;
      } catch(_) { }
    }
    playElement();
  }
  function fire(withSound=true){
    cancelAnimationFrame(frame);resize();createElectricity();
    const thisRun=++token;
    frame=requestAnimationFrame(()=>animate(performance.now(),thisRun));
    if(withSound)playThunder();
    if(navigator.vibrate)navigator.vibrate([25,38,65]);
  }
  // La pantalla entera sirve como botón invisible, sin textos ni controles.
  // touchend (iPhone) y click (desktop) cuentan como gesto para habilitar audio; pointerdown no.
  let lastTouch=0;
  document.addEventListener('touchend',()=>{lastTouch=Date.now();fire(true);},{passive:true});
  document.addEventListener('click',()=>{if(Date.now()-lastTouch>800)fire(true);});
  document.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fire(true);}});
  // URL usada por Atajos: ?play=1. También la apertura desde el ícono ?auto=1.
  const params=new URLSearchParams(location.search);
  const auto=params.has('play')||params.has('auto');
  if(auto)setTimeout(()=>fire(true),260);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&auto&&performance.now()-lastVisibilityFire>2200){
      lastVisibilityFire=performance.now();setTimeout(()=>fire(true),220);
    }
  });
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js?v=5').catch(()=>{});
})();
