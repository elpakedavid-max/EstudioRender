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
@media(min-width:900px){.gallery{grid-template-columns:1fr 1fr}.gallery figure:first-child{grid-column:1/-1}}
</style></head><body>
<header class="hero" style="background-image:url('${hero}')"><div class="in">
<small>${esc(studio || 'Propuesta de reforma')}</small>
<h1>${esc(project.name)}</h1>
<p>${project.client ? `Para ${esc(project.client)} · ` : ''}${esc(date)}</p></div></header>
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
<script>
const lb=document.getElementById('lb');
document.querySelectorAll('figure img,.plan img').forEach(i=>i.onclick=()=>{lb.firstElementChild.src=i.src;lb.classList.add('on')});
lb.onclick=()=>lb.classList.remove('on');
</script></body></html>`;
}
