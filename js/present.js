// Presentación para el cliente: un único archivo HTML con todo dentro (renders, plano, datos y vídeo opcional).
// Se abre en cualquier móvil u ordenador sin instalar nada y se puede enviar por WhatsApp o email.
import { shrink } from './ai.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toDataURL(blob) {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
}

export async function buildPresentation({ project, slides, planBlob, videoBlob, studio, size, roomLabel, products = [] }) {
  const imgs = [];
  for (const s of slides) imgs.push({ src: await toDataURL(await shrink(s.blob, 1800)), caption: s.caption || '' });
  const plan = planBlob ? await toDataURL(planBlob) : '';
  const video = videoBlob ? await toDataURL(videoBlob) : '';
  const prods = [];
  for (const pr of products) prods.push({ ...pr, img: pr.blob ? await toDataURL(await shrink(pr.blob, 500)) : '' });
  const total = prods.reduce((a, x) => a + (Number(x.price) || 0), 0);
  const eur = (n) => (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
  const date = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const hero = imgs[0]?.src || '';
  const facts = [
    roomLabel && ['Estancia', roomLabel],
    size && ['Superficie', size],
    project.style && ['Estilo', project.style],
    project.materials && ['Materiales', project.materials],
  ].filter(Boolean);

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(project.name)} · Propuesta</title>
<style>
:root{--ink:#1f1f1d;--muted:#6b6a64;--bg:#f6f4ee;--accent:#c2552d}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,"SF Pro Text","Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--bg)}
.hero{position:relative;min-height:78vh;display:flex;align-items:flex-end;background:#111 center/cover no-repeat;color:#fff}
.hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 35%,rgba(0,0,0,.72))}
.hero .in{position:relative;z-index:1;padding:40px 6vw;max-width:1100px;width:100%;margin:0 auto}
.hero small{letter-spacing:.14em;text-transform:uppercase;font-size:12px;opacity:.85}
.hero h1{font-size:clamp(32px,6vw,58px);margin:8px 0 6px;font-weight:600;line-height:1.05}
.hero p{margin:0;opacity:.9;font-size:16px}
main{max-width:1100px;margin:0 auto;padding:36px 6vw 60px}
h2{font-size:22px;margin:40px 0 14px;font-weight:600}
.lead{font-size:18px;line-height:1.6;max-width:760px}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:22px}
.fact{background:#fff;border-radius:14px;padding:14px 16px}.fact b{display:block;font-size:12px;color:var(--muted);font-weight:500;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em}
.gallery{display:grid;gap:18px}
figure{margin:0;background:#fff;border-radius:16px;overflow:hidden}
figure img{width:100%;display:block;cursor:zoom-in}
figcaption{padding:12px 16px;font-size:15px;color:var(--muted)}
.prods{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.prod{background:#fff;border-radius:14px;padding:10px;display:flex;gap:12px;align-items:center}
.prod img,.prod .noimg{width:84px;height:84px;object-fit:cover;border-radius:10px;background:#eee;flex:none}
.prod small{display:block;color:var(--muted);font-size:12px}.prod b{display:block;margin:2px 0}.prod span{display:block}.prod a{color:var(--accent);font-size:14px}
.total{font-size:17px;margin-top:14px}.total small{color:var(--muted);font-size:12px}
.plan{background:#fff;border-radius:16px;padding:16px}.plan img{width:100%;display:block}
video{width:100%;border-radius:16px;background:#000;display:block}
footer{text-align:center;color:var(--muted);font-size:13px;padding:30px 20px 50px}
footer b{color:var(--ink);display:block;font-size:16px;margin-bottom:4px}
.lb{position:fixed;inset:0;background:rgba(0,0,0,.94);display:none;align-items:center;justify-content:center;z-index:9}
.lb.on{display:flex}.lb img{max-width:100vw;max-height:100vh}

.fsbtn{display:inline-flex;align-items:center;gap:8px;margin-top:18px;background:#fff;color:var(--ink);border:0;border-radius:999px;padding:12px 20px;font:600 16px inherit;font-family:inherit;cursor:pointer}
.ss{position:fixed;inset:0;background:#000;z-index:20;display:none;color:#fff;user-select:none;-webkit-user-select:none;touch-action:pan-y}
.ss.on{display:block}.ss .sl{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .6s}
.ss .sl.cur{opacity:1}.ss .sl img{max-width:100%;max-height:100%;object-fit:contain}.ss .sl.plan{background:#fff}
.ss .cap{position:absolute;left:0;right:0;bottom:0;padding:40px 6vw 28px;background:linear-gradient(transparent,rgba(0,0,0,.7));font-size:clamp(16px,2.2vw,24px);text-align:center}
.ss .sl.plan .cap{display:none}.ss .sl video{max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain;background:#000}.ss .sl:not(.cur){pointer-events:none}
.ss .cover{flex-direction:column;text-align:center;background:#111 center/cover}.ss .cover::before{content:"";position:absolute;inset:0;background:rgba(0,0,0,.55)}
.ss .cover>*{position:relative}.ss .cover h1{font-size:clamp(36px,7vw,80px);margin:10px 0}.ss .cover small{letter-spacing:.14em;text-transform:uppercase;opacity:.85}
.ss .ctl{position:absolute;top:14px;right:14px;display:flex;gap:8px;z-index:3;transition:opacity .4s}.ss.idle .ctl,.ss.idle .nav{opacity:0}
.ss button{background:rgba(255,255,255,.16);color:#fff;border:0;border-radius:999px;min-width:46px;height:46px;font-size:20px;cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.ss .nav{position:absolute;top:50%;transform:translateY(-50%);z-index:3;transition:opacity .4s}.ss .prev{left:14px}.ss .next{right:14px}
.ss .dots{position:absolute;bottom:10px;left:0;right:0;text-align:center;z-index:3;font-size:13px;opacity:.7}
@media(min-width:900px){.gallery{grid-template-columns:1fr 1fr}.gallery figure:first-child{grid-column:1/-1}}
</style></head><body>
<header class="hero" style="background-image:url('${hero}')"><div class="in">
<small>${esc(studio || 'Propuesta de reforma')}</small>
<h1>${esc(project.name)}</h1>
<p>${project.client ? `Para ${esc(project.client)} · ` : ''}${esc(date)}</p>
${imgs.length ? '<button class="fsbtn" id="fs-open">⛶ Ver en pantalla completa</button>' : ''}</div></header>
<main>
${project.description ? `<p class="lead">${esc(project.description)}</p>` : ''}
${facts.length ? `<div class="facts">${facts.map(([k, v]) => `<div class="fact"><b>${esc(k)}</b>${esc(v)}</div>`).join('')}</div>` : ''}
${imgs.length ? `<h2>Cómo quedaría</h2><div class="gallery">${imgs.map((im) => `<figure><img src="${im.src}" alt="${esc(im.caption)}" loading="lazy">${im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
${video ? `<h2>Vídeo</h2><video src="${video}" controls playsinline preload="metadata"></video>` : ''}
${prods.length ? `<h2>Mobiliario seleccionado</h2><div class="prods">${prods.map((x) => `<div class="prod">${x.img ? `<img src="${x.img}" alt="">` : '<div class="noimg"></div>'}<div><small>${esc(x.label)}${x.storeLabel ? ' · ' + esc(x.storeLabel) : ''}</small><b>${esc(x.name || x.label)}</b>${x.price ? `<span>${eur(x.price)}</span>` : ''}${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">Ver producto ↗</a>` : ''}</div></div>`).join('')}</div>${total ? `<p class="total">Total mobiliario: <b>${eur(total)}</b> <small>(precios orientativos de tienda)</small></p>` : ''}` : ''}
${plan ? `<h2>Distribución</h2><div class="plan"><img src="${plan}" alt="Plano"></div>` : ''}
</main>
<footer><b>${esc(studio || '')}</b>Propuesta orientativa: las imágenes son una recreación y pueden variar respecto al resultado final.</footer>
<div class="lb" id="lb"><img alt=""></div>
<div class="ss" id="ss">
<div class="sl cover" style="background-image:url('${hero}')"><small>${esc(studio || 'Propuesta de reforma')}</small><h1>${esc(project.name)}</h1><p>${project.client ? `Para ${esc(project.client)}` : esc(date)}</p></div>
${imgs.map((im) => `<div class="sl"><img src="${im.src}" alt="">${im.caption ? `<div class="cap">${esc(im.caption)}</div>` : ''}</div>`).join('')}
${video ? '<div class="sl vid"></div>' : ''}
${plan ? `<div class="sl plan"><img src="${plan}" alt="Plano"></div>` : ''}
<div class="ctl"><button id="ss-play" title="Pase automático">▶</button><button id="ss-close" title="Salir">✕</button></div>
<button class="nav prev" id="ss-prev" aria-label="Anterior">‹</button><button class="nav next" id="ss-next" aria-label="Siguiente">›</button>
<div class="dots" id="ss-dots"></div></div>
<script>
const lb=document.getElementById('lb');
document.querySelectorAll('figure img,.plan img').forEach(i=>i.onclick=()=>{lb.firstElementChild.src=i.src;lb.classList.add('on')});
lb.onclick=()=>lb.classList.remove('on');
(()=>{const ss=document.getElementById('ss');if(!ss)return;const sl=[...ss.querySelectorAll('.sl')];let i=0,timer=null,idle=null;
const vs=ss.querySelector('.sl.vid');if(vs){const src=document.querySelector('main video');const v=document.createElement('video');v.src=src?src.src:'';v.controls=true;v.playsInline=true;v.preload='metadata';v.onclick=e=>e.stopPropagation();v.onended=()=>{if(timer)show(i+1)};vs.append(v)}
const show=n=>{i=(n+sl.length)%sl.length;sl.forEach((x,k)=>{x.classList.toggle('cur',k===i);const v=x.querySelector('video');if(v){if(k===i){v.currentTime=0;v.play().catch(()=>{})}else v.pause()}});document.getElementById('ss-dots').textContent=(i+1)+' / '+sl.length};
const wake=()=>{ss.classList.remove('idle');clearTimeout(idle);idle=setTimeout(()=>ss.classList.add('idle'),2500)};
const play=on=>{clearInterval(timer);timer=on?setInterval(()=>{const v=sl[i].querySelector('video');if(v&&!v.paused&&!v.ended)return;show(i+1)},5000):null;document.getElementById('ss-play').textContent=on?'❚❚':'▶'};
const fsEl=()=>document.fullscreenElement||document.webkitFullscreenElement;
const open=()=>{ss.classList.add('on');show(0);wake();const r=ss.requestFullscreen||ss.webkitRequestFullscreen;if(r)try{const p=r.call(ss);p&&p.catch&&p.catch(()=>{})}catch(e){}};
const close=()=>{play(false);if(parent!==window)parent.postMessage('er-close-presentation','*');ss.classList.remove('on');if(fsEl())(document.exitFullscreen||document.webkitExitFullscreen).call(document)};
document.getElementById('fs-open').onclick=open;
document.getElementById('ss-close').onclick=e=>{e.stopPropagation();close()};
document.getElementById('ss-play').onclick=e=>{e.stopPropagation();play(!timer)};
document.getElementById('ss-prev').onclick=e=>{e.stopPropagation();show(i-1);wake()};
document.getElementById('ss-next').onclick=e=>{e.stopPropagation();show(i+1);wake()};
ss.onclick=e=>{wake();show(e.clientX<innerWidth/3?i-1:i+1)};ss.onmousemove=wake;
let x0=null;ss.addEventListener('touchstart',e=>{x0=e.touches[0].clientX},{passive:true});
ss.addEventListener('touchend',e=>{if(x0==null)return;const dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>40){e.preventDefault();show(dx<0?i+1:i-1);wake()}});
addEventListener('keydown',e=>{if(!ss.classList.contains('on'))return;if(e.key==='ArrowRight'||e.key===' ')show(i+1);else if(e.key==='ArrowLeft')show(i-1);else if(e.key==='Escape')close();wake()});
const onfs=()=>{if(!fsEl()&&ss.classList.contains('on')&&ss.dataset.fs)close();ss.dataset.fs=fsEl()?'1':''};
document.addEventListener('fullscreenchange',onfs);document.addEventListener('webkitfullscreenchange',onfs);
if(location.hash==='#presentar'){ss.classList.add('on');show(0);wake()}})();
</script></body></html>`;
}
