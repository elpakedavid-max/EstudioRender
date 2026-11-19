// Vídeo de presentación en el navegador: renders con movimiento suave, rótulos, plano y música generada.
export function buildTimeline({ title, subtitle, slides, planImg, studio, vertical }) {
  const scenes = [];
  scenes.push({ kind: 'title', dur: 3.5 });
  slides.forEach((s, i) => scenes.push({ kind: 'image', img: s.img, caption: s.caption, dur: 7, move: ['zoomin', 'panright', 'zoomout', 'panleft'][i % 4] }));
  if (planImg) scenes.push({ kind: 'plan', img: planImg, dur: 5.5 });
  scenes.push({ kind: 'end', dur: 3 });
  let t = 0;
  for (const s of scenes) { s.start = t; t += s.dur; }
  return { scenes, total: t, title, subtitle, studio, vertical, bg: slides[0]?.img };
}

const ease = (x) => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, x))) / 2;

function cover(ctx, img, W, H, zoom, fx, fy) {
  const k = Math.max(W / img.width, H / img.height) * zoom;
  const w = img.width * k, h = img.height * k;
  const x = (W - w) * fx, y = (H - h) * fy;
  ctx.drawImage(img, x, y, w, h);
}

function contain(ctx, img, W, H, pad) {
  const k = Math.min((W - pad * 2) / img.width, (H - pad * 2) / img.height);
  const w = img.width * k, h = img.height * k;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

export function drawFrame(ctx, tl, t) {
  const { width: W, height: H } = ctx.canvas;
  const s = tl.scenes.find((x) => t >= x.start && t < x.start + x.dur) || tl.scenes[tl.scenes.length - 1];
  const lt = t - s.start, p = lt / s.dur;
  const fade = Math.min(1, lt / 0.6, (s.dur - lt) / 0.6);
  ctx.save();
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = Math.max(0, fade);
  const big = Math.round(H * (tl.vertical ? 0.045 : 0.075));
  const small = Math.round(big * 0.45);
  if (s.kind === 'title' || s.kind === 'end') {
    if (tl.bg) {
      ctx.filter = 'blur(18px) brightness(0.45)';
      cover(ctx, tl.bg, W, H, 1.1, 0.5, 0.5);
      ctx.filter = 'none';
    }
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (s.kind === 'title') {
      ctx.font = `600 ${big}px -apple-system, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText(tl.title, W / 2, H / 2 - big * 0.45, W * 0.9);
      ctx.fillStyle = '#dddddd';
      ctx.font = `${small}px -apple-system, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText(tl.subtitle, W / 2, H / 2 + big * 0.55, W * 0.9);
    } else {
      ctx.font = `600 ${Math.round(big * 0.7)}px -apple-system, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText(tl.studio || tl.title, W / 2, H / 2 - small * 0.6, W * 0.9);
      ctx.fillStyle = '#cccccc';
      ctx.font = `${small}px -apple-system, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText('Propuesta de reforma', W / 2, H / 2 + small * 1.1, W * 0.9);
    }
  } else if (s.kind === 'image') {
    const e = ease(p);
    let z = 1.0, fx = 0.5, fy = 0.5;
    if (s.move === 'zoomin') { z = 1 + 0.12 * e; fy = 0.42; }
    else if (s.move === 'zoomout') { z = 1.12 - 0.12 * e; }
    else if (s.move === 'panright') { z = 1.14; fx = e; }
    else if (s.move === 'panleft') { z = 1.14; fx = 1 - e; }
    cover(ctx, s.img, W, H, z, fx, fy);
    if (s.caption) {
      const bh = Math.round(H * (tl.vertical ? 0.07 : 0.1));
      ctx.globalAlpha = Math.max(0, fade) * 0.5; ctx.fillStyle = '#000'; ctx.fillRect(0, H - bh, W, bh);
      ctx.globalAlpha = Math.max(0, fade); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(bh * 0.36)}px -apple-system, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText(s.caption, Math.round(W * 0.04), H - bh / 2, W * 0.92);
    }
  } else if (s.kind === 'plan') {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    contain(ctx, s.img, W, H, Math.round(Math.min(W, H) * 0.05));
  }
  ctx.restore();
}

// Música ambiental generada (sin derechos), conectada a un destino de audio
export function scheduleMusic(ac, dest, total) {
  const master = ac.createGain();
  master.gain.setValueAtTime(0, ac.currentTime);
  master.gain.linearRampToValueAtTime(0.22, ac.currentTime + 1.2);
  master.gain.setValueAtTime(0.22, ac.currentTime + Math.max(1.3, total - 2.5));
  master.gain.linearRampToValueAtTime(0, ac.currentTime + total);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
  // Reverb sencilla
  const conv = ac.createConvolver();
  const len = ac.sampleRate * 2.2, ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / ac.sampleRate * 2.6); }
  conv.buffer = ir;
  const wet = ac.createGain(); wet.gain.value = 0.35;
  lp.connect(master); lp.connect(conv); conv.connect(wet); wet.connect(master);
  master.connect(dest);
  const hz = (n) => 440 * 2 ** ((n - 69) / 12);
  const chords = [[48, 55, 59, 62, 64], [45, 52, 55, 59, 60], [41, 48, 52, 55, 59], [43, 50, 55, 57, 62]];
  const seg = 5.75;
  const t0 = ac.currentTime + 0.05;
  const nSeg = Math.ceil(total / seg);
  for (let i = 0; i < nSeg; i++) {
    const ch = chords[i % chords.length];
    const st = t0 + i * seg;
    ch.forEach((note, k) => {
      [-0.12, 0.12].forEach((det) => {
        const o = ac.createOscillator(); o.type = 'sine';
        o.frequency.value = hz(k ? note + 12 : note) * 2 ** (det / 12);
        const g = ac.createGain();
        const amp = k ? 0.05 : 0.07;
        g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(amp, st + 1.6);
        g.gain.setValueAtTime(amp, st + seg - 0.2); g.gain.linearRampToValueAtTime(0, st + seg + 1.5);
        o.connect(g); g.connect(lp); o.start(st); o.stop(st + seg + 1.6);
      });
    });
  }
  const step = 60 / 84 / 2; const pattern = [2, 3, 4, 3, 1, 3, 4, 2];
  let j = 0;
  for (let t = 1.2; t < total - 2; t += step, j++) {
    const ci = Math.floor(t / seg) % chords.length;
    const f = hz(chords[ci][pattern[j % pattern.length]] + 12);
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ac.createGain(); const st = t0 + t;
    const amp = 0.05 + Math.random() * 0.015;
    g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(amp, st + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, st + 1.5);
    o.connect(g); g.connect(lp); o.start(st); o.stop(st + 1.6);
  }
}

function pickMime() {
  const opts = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return opts.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}

// Graba el vídeo en tiempo real. onProgress(0..1)
export async function recordVideo(canvas, tl, { music = true, onProgress } = {}) {
  const ctx = canvas.getContext('2d');
  const stream = canvas.captureStream(30);
  let ac;
  if (music) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const dest = ac.createMediaStreamDestination();
    scheduleMusic(ac, dest, tl.total);
    dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  }
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8e6 } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  rec.start(500);
  const start = performance.now();
  await new Promise((resolve) => {
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      drawFrame(ctx, tl, Math.min(t, tl.total - 0.001));
      onProgress && onProgress(Math.min(1, t / tl.total));
      if (t < tl.total) requestAnimationFrame(tick); else resolve();
    };
    tick();
  });
  rec.stop();
  await done;
  if (ac) ac.close();
  const type = (mime || 'video/webm').split(';')[0];
  return new Blob(chunks, { type });
}
