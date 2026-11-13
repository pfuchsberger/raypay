(() => {
  'use strict';
  const canvas = document.getElementById('fx'), ctx = canvas.getContext('2d');
  const flash = document.getElementById('flash');
  const btn = document.getElementById('play');
  const toggle = document.getElementById('showSettings'), settings = document.getElementById('settings');
  const sound = document.getElementById('sound'), haptic = document.getElementById('haptic');
  let W = 0, H = 0, DPR = 1, run = 0, frame = 0, particles = [], arcs = [], audio = null;
  function resize(){DPR=Math.min(devicePixelRatio||1,2); W=innerWidth;H=innerHeight;canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0)}
  addEventListener('resize', resize);resize();
  const rand = (seed) => { let a=(seed*1664525+1013904223)>>>0; return () => {a=(a*1664525+1013904223)>>>0;return a/4294967296;}; };
  function path(seed, startX, startY, endX, endY, bends=17){
    const r=rand(seed); const p=[];
    for(let i=0;i<=bends;i++){let t=i/bends; let jitter=i===0||i===bends?0:(r()-.5)*W*.25;
      p.push({x:startX+(endX-startX)*t+jitter,y:startY+(endY-startY)*t+(i===0||i===bends?0:(r()-.5)*H*.075)});
    }return p;
  }
  function build(){
    arcs = [path(10,W*.12,H*.86,W*.91,H*.13,23),path(21,W*.08,H*.91,W*.79,H*.06,19),path(33,W*.33,H*.94,W*.96,H*.21,22)];
    const r=rand(94);particles=[];
    for(let i=0;i<135;i++){
      let angle=r()*Math.PI*2, radius=22+r()*Math.min(W,H)*.9;
      particles.push({x:W*.52,y:H*.48,dx:Math.cos(angle)*radius,dy:Math.sin(angle)*radius,delay:r()*.35,size:1+r()*3.4,kind:i%9===0?'coin':'spark',rot:r()*6.28});
    }
  }
  function strokeArc(points, portion, color, width, blur=0){
    if(portion<=0)return;const n=Math.max(1,Math.ceil((points.length-1)*Math.min(portion,1)));ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
    for(let i=1;i<=n;i++){const j=Math.min(i,points.length-1);ctx.lineTo(points[j].x,points[j].y)}
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='miter';ctx.shadowColor='#ffe954';ctx.shadowBlur=blur;ctx.stroke();ctx.shadowBlur=0;
  }
  function render(t0){
    if(t0!==run)return;
    let now=performance.now();let t=(now-t0)/1750;ctx.clearRect(0,0,W,H);
    if(t>=1){flash.style.opacity='0';return;}
    let reveal=Math.min(1,t/.23), fade=t<.38?1:Math.max(0,(1-t)/.62);
    flash.style.opacity=String(t<.1?t*7:Math.max(0,fade*.65));
    ctx.save();ctx.globalCompositeOperation='lighter';
    arcs.forEach((a,i)=>{
      const p=Math.max(0,Math.min(1,reveal-i*.13));const k=fade*(1-i*.19);
      ctx.globalAlpha=k*.44;strokeArc(a,p,'#ffc500',23,30);
      ctx.globalAlpha=k*.78;strokeArc(a,p,'#ffdd28',10,16);
      ctx.globalAlpha=k;strokeArc(a,p,'#fffce6',3.5,8);
    });
    for(const [i,p] of particles.entries()){
      const q=Math.max(0,(t-p.delay)/(1-p.delay));if(q<=0||q>=1)continue;
      const ease=1-Math.pow(1-q,2);let alpha=(1-q)*.94;
      ctx.globalAlpha=alpha;
      const x=p.x+p.dx*ease,y=p.y+p.dy*ease;
      if(p.kind==='coin'){ctx.font=`${15+5*alpha}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#ffed80';ctx.fillText(i%2===0?'$':'€',x,y)}
      else{ctx.fillStyle=i%3===0?'#fffde7':'#ffd93d';ctx.beginPath();ctx.arc(x,y,Math.max(.4,p.size*(1-q*.65)),0,Math.PI*2);ctx.fill()}
    }
    ctx.restore();frame=requestAnimationFrame(()=>render(t0));
  }
  function chime(){
    if(!sound.checked)return;
    try{
      audio=audio||new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();
      const n=audio.currentTime;
      for(const [hz,lag,lvl] of [[880,0,.17],[1318.5,.07,.095],[1760,.16,.055]]){
        const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(hz,n+lag);o.frequency.exponentialRampToValueAtTime(hz*1.015,n+lag+.25);
        g.gain.setValueAtTime(.0001,n+lag);g.gain.exponentialRampToValueAtTime(lvl,n+lag+.013);g.gain.exponentialRampToValueAtTime(.0001,n+lag+.48);
        o.connect(g);g.connect(audio.destination);o.start(n+lag);o.stop(n+lag+.5);
      }
    }catch(_){}
  }
  function fire(withAudio=true){
    cancelAnimationFrame(frame);resize();build();run=performance.now();frame=requestAnimationFrame(()=>render(run));
    if(withAudio)chime();
    if(haptic.checked&&navigator.vibrate)navigator.vibrate([20,35,40]);
  }
  btn.addEventListener('click',()=>fire(true));
  toggle.addEventListener('click',()=>settings.classList.toggle('show'));
  sound.checked=localStorage.getItem('raypay_sound')!=='false';
  haptic.checked=localStorage.getItem('raypay_haptic')!=='false';
  sound.addEventListener('change',()=>localStorage.setItem('raypay_sound',String(sound.checked)));
  haptic.addEventListener('change',()=>localStorage.setItem('raypay_haptic',String(haptic.checked)));
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
  // Permite un disparo visual al recibir una URL desde Atajos. iOS puede bloquear audio sin interacción.
  const q=new URLSearchParams(location.search);
  if(q.has('play')||q.has('auto'))setTimeout(()=>fire(false),300);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&(q.has('play')||q.has('auto')))setTimeout(()=>fire(false),150);
  });
})();
