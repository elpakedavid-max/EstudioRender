// Editor de plano a escala (unidades: centímetros).
// Arriba = fondo, abajo = frente / entrada. x crece hacia la derecha mirando desde la entrada.
import { CATALOG, CAT_COLORS, byType, symbol } from './catalog.js';
import { uid } from './db.js';

export function emptyPlan(width = 500, length = 700) {
  const W = Math.round(width), L = Math.round(length);
  return {
    walls: [
      { id: uid(), x1: 0, y1: 0, x2: W, y2: 0 },
      { id: uid(), x1: W, y1: 0, x2: W, y2: L },
      { id: uid(), x1: W, y1: L, x2: 0, y2: L },
      { id: uid(), x1: 0, y1: L, x2: 0, y2: 0 },
    ],
    openings: [],
    items: [],
    notes: [],
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r1 = (v) => Math.round(v * 10) / 10;
export const fmtM = (cm) => (cm / 100).toFixed(2).replace('.', ',');

export function roomBounds(plan) {
  if (!plan.walls.length) return bounds(plan);
  const xs = plan.walls.flatMap((w) => [w.x1, w.x2]), ys = plan.walls.flatMap((w) => [w.y1, w.y2]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export function bounds(plan) {
  let minX = 0, minY = 0, maxX = 100, maxY = 100, first = true;
  const add = (x, y) => {
    if (first) { minX = maxX = x; minY = maxY = y; first = false; }
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  };
  plan.walls.forEach((w) => { add(w.x1, w.y1); add(w.x2, w.y2); });
  plan.items.forEach((it) => { add(it.x, it.y); add(it.x + it.w, it.y + it.d); });
  if (first) return { minX: 0, minY: 0, maxX: 500, maxY: 700 };
  return { minX, minY, maxX, maxY };
}

function wallLen(w) { return Math.hypot(w.x2 - w.x1, w.y2 - w.y1); }

// Marcado SVG del plano (compartido por el editor y la exportación)
export function planMarkup(plan, { selectedId = null, showHits = false, level = 'all' } = {}) {
  const out = [];
  const b = bounds(plan);
  // Rejilla de 50 cm
  const gx0 = Math.floor((b.minX - 100) / 50) * 50, gx1 = Math.ceil((b.maxX + 100) / 50) * 50;
  const gy0 = Math.floor((b.minY - 100) / 50) * 50, gy1 = Math.ceil((b.maxY + 100) / 50) * 50;
  let grid = '';
  for (let x = gx0; x <= gx1; x += 50) grid += `<line x1="${x}" y1="${gy0}" x2="${x}" y2="${gy1}" class="${x % 100 === 0 ? 'g1' : 'g2'}"/>`;
  for (let y = gy0; y <= gy1; y += 50) grid += `<line x1="${gx0}" y1="${y}" x2="${gx1}" y2="${y}" class="${y % 100 === 0 ? 'g1' : 'g2'}"/>`;
  out.push(`<g class="grid">${grid}</g>`);

  // Suelo (polígono aproximado con los extremos de muros) — rectángulo de límites
  out.push(`<rect class="floor" x="${b.minX}" y="${b.minY}" width="${b.maxX - b.minX}" height="${b.maxY - b.minY}"/>`);

  // Piezas (las de nivel alto con trazo discontinuo)
  const items = [...plan.items].sort((a, c) => (a.type === 'alfombra' || a.type === 'zona' ? -1 : 0) - (c.type === 'alfombra' || c.type === 'zona' ? -1 : 0));
  for (const it of items) {
    if (level !== 'all' && (it.level || 'baja') !== level) continue;
    const cat = byType(it.type)?.cat || 'Estructura';
    const [fill, stroke] = CAT_COLORS[cat] || ['#eee', '#555'];
    const sel = it.id === selectedId ? ' selected' : '';
    const alto = it.level === 'alta' ? ' alto' : '';
    const fs = Math.max(9, Math.min(18, Math.min(it.w, it.d) / 4));
    const rot = it.rot || 0;
    const counter = rot ? `rotate(${-rot} ${r1(it.w / 2)} ${r1(it.d / 2)})` : '';
    out.push(`<g class="item${sel}${alto} t-${it.type}" data-id="${it.id}" data-kind="item" transform="translate(${r1(it.x)} ${r1(it.y)}) rotate(${rot} ${r1(it.w / 2)} ${r1(it.d / 2)})">
      <rect width="${r1(it.w)}" height="${r1(it.d)}" rx="3" fill="${fill}" stroke="${stroke}" class="body"/>
      <g stroke="${stroke}">${symbol(it.type, it.w, it.d)}</g>
      <text x="${r1(it.w / 2)}" y="${r1(it.d / 2)}" font-size="${r1(fs)}" fill="#2C2C2A" text-anchor="middle" dominant-baseline="central" transform="${counter}">${esc(it.label)}</text>
    </g>`);
  }

  // Muros
  for (const w of plan.walls) {
    const sel = w.id === selectedId ? ' selected' : '';
    out.push(`<line class="wall${sel}" data-id="${w.id}" data-kind="wall" x1="${r1(w.x1)}" y1="${r1(w.y1)}" x2="${r1(w.x2)}" y2="${r1(w.y2)}" style="stroke-width:${w.t || 12}"/>`);
    if (showHits) out.push(`<line class="hit" data-id="${w.id}" data-kind="wall" x1="${r1(w.x1)}" y1="${r1(w.y1)}" x2="${r1(w.x2)}" y2="${r1(w.y2)}"/>`);
  }

  // Huecos: puertas, ventanas, correderas
  for (const o of plan.openings) {
    const w = plan.walls.find((x) => x.id === o.wallId);
    if (!w) continue;
    const L = wallLen(w); if (!L) continue;
    const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
    const cx = w.x1 + ux * L * o.t, cy = w.y1 + uy * L * o.t;
    let ax = cx - ux * o.w / 2, ay = cy - uy * o.w / 2, bx = cx + ux * o.w / 2, by = cy + uy * o.w / 2;
    if (o.flip) { [ax, bx] = [bx, ax]; [ay, by] = [by, ay]; }
    const sel = o.id === selectedId ? ' selected' : '';
    // Normal hacia el interior (aprox. hacia el centro de los límites)
    let nx = -uy, ny = ux;
    const mid = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
    if ((mid.x - cx) * nx + (mid.y - cy) * ny < 0) { nx = -nx; ny = -ny; }
    if (o.out) { nx = -nx; ny = -ny; }
    let g = `<line class="gap" x1="${r1(ax)}" y1="${r1(ay)}" x2="${r1(bx)}" y2="${r1(by)}"/>`;
    if (o.type === 'ventana') {
      g += `<line class="win" x1="${r1(ax - nx * 4)}" y1="${r1(ay - ny * 4)}" x2="${r1(bx - nx * 4)}" y2="${r1(by - ny * 4)}"/><line class="win" x1="${r1(ax + nx * 4)}" y1="${r1(ay + ny * 4)}" x2="${r1(bx + nx * 4)}" y2="${r1(by + ny * 4)}"/>`;
    } else if (o.type === 'corredera') {
      g += `<line class="door" x1="${r1(ax + nx * 6)}" y1="${r1(ay + ny * 6)}" x2="${r1(cx + ux * o.w * 0.1 + nx * 6)}" y2="${r1(cy + uy * o.w * 0.1 + ny * 6)}"/><line class="door thin" x1="${r1(cx - ux * o.w * 0.1 + nx * 12)}" y1="${r1(cy - uy * o.w * 0.1 + ny * 12)}" x2="${r1(bx + nx * 12)}" y2="${r1(by + ny * 12)}"/>`;
    } else if (o.type === 'puerta') {
      const ex = ax + nx * o.w, ey = ay + ny * o.w;
      g += `<line class="door" x1="${r1(ax)}" y1="${r1(ay)}" x2="${r1(ex)}" y2="${r1(ey)}"/><path class="swing" d="M ${r1(ex)} ${r1(ey)} A ${o.w} ${o.w} 0 0 ${(bx - ax) * ny - (by - ay) * nx > 0 ? 1 : 0} ${r1(bx)} ${r1(by)}"/>`;
    } else if (o.type === 'entrada') {
      g += `<line class="door" x1="${r1(ax)}" y1="${r1(ay)}" x2="${r1(ax + nx * o.w * 0.9)}" y2="${r1(ay + ny * o.w * 0.9)}"/><text class="openlabel" x="${r1(cx - nx * 28)}" y="${r1(cy - ny * 28)}" text-anchor="middle" dominant-baseline="central">Entrada</text>`;
    }
    out.push(`<g class="opening${sel}" data-id="${o.id}" data-kind="opening">${g}<line class="hit" x1="${r1(ax)}" y1="${r1(ay)}" x2="${r1(bx)}" y2="${r1(by)}"/></g>`);
  }

  // Cotas de muros
  for (const w of plan.walls) {
    const L = wallLen(w); if (L < 30) continue;
    const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
    let nx = -uy, ny = ux;
    const mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2;
    const mid = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
    if ((mid.x - mx) * nx + (mid.y - my) * ny > 0) { nx = -nx; ny = -ny; }
    const tx = mx + nx * 34, ty = my + ny * 34;
    let ang = Math.atan2(uy, ux) * 180 / Math.PI;
    if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
    out.push(`<text class="dim" x="${r1(tx)}" y="${r1(ty)}" text-anchor="middle" dominant-baseline="central" transform="rotate(${r1(ang)} ${r1(tx)} ${r1(ty)})">${fmtM(L)} m</text>`);
  }

  // Notas
  for (const n of plan.notes) {
    const sel = n.id === selectedId ? ' selected' : '';
    if (n.kind === 'ink') {
      const d = n.points.map((p, i) => `${i ? 'L' : 'M'}${r1(p[0])} ${r1(p[1])}`).join(' ');
      out.push(`<path class="ink${sel}" data-id="${n.id}" data-kind="note" d="${d}" stroke="${n.color || '#C0392B'}" stroke-width="${n.width || 3}"/>`);
    } else if (n.kind === 'line' || n.kind === 'arrow' || n.kind === 'dim') {
      const c = n.color || (n.kind === 'dim' ? '#444441' : '#C0392B');
      const L = Math.hypot(n.x2 - n.x1, n.y2 - n.y1) || 1;
      const ux = (n.x2 - n.x1) / L, uy = (n.y2 - n.y1) / L, px = -uy, py = ux;
      let g = `<line x1="${r1(n.x1)}" y1="${r1(n.y1)}" x2="${r1(n.x2)}" y2="${r1(n.y2)}" stroke="${c}" stroke-width="${n.kind === 'dim' ? 1.5 : 3}" ${n.dash ? 'stroke-dasharray="10 7"' : ''}/>`;
      const head = (x, y, dx, dy, s) => `<path d="M ${r1(x - dx * s + dy * s * 0.5)} ${r1(y - dy * s - dx * s * 0.5)} L ${r1(x)} ${r1(y)} L ${r1(x - dx * s - dy * s * 0.5)} ${r1(y - dy * s + dx * s * 0.5)}" fill="none" stroke="${c}" stroke-width="${n.kind === 'dim' ? 1.5 : 3}"/>`;
      if (n.kind === 'arrow') g += head(n.x2, n.y2, ux, uy, 16);
      if (n.kind === 'dim') {
        g += head(n.x2, n.y2, ux, uy, 9) + head(n.x1, n.y1, -ux, -uy, 9);
        g += `<line x1="${r1(n.x1 - px * 10)}" y1="${r1(n.y1 - py * 10)}" x2="${r1(n.x1 + px * 10)}" y2="${r1(n.y1 + py * 10)}" stroke="${c}" stroke-width="1"/><line x1="${r1(n.x2 - px * 10)}" y1="${r1(n.y2 - py * 10)}" x2="${r1(n.x2 + px * 10)}" y2="${r1(n.y2 + py * 10)}" stroke="${c}" stroke-width="1"/>`;
        let ang = Math.atan2(uy, ux) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
        const tx = (n.x1 + n.x2) / 2 + px * 14 * (py > 0 ? -1 : 1), ty = (n.y1 + n.y2) / 2 + py * 14 * (py > 0 ? -1 : 1);
        g += `<text x="${r1(tx)}" y="${r1(ty)}" font-size="15" fill="${c}" text-anchor="middle" dominant-baseline="central" transform="rotate(${r1(ang)} ${r1(tx)} ${r1(ty)})">${fmtM(L)}</text>`;
      }
      g += `<line class="hit" x1="${r1(n.x1)}" y1="${r1(n.y1)}" x2="${r1(n.x2)}" y2="${r1(n.y2)}"/>`;
      out.push(`<g class="shape${sel}" data-id="${n.id}" data-kind="note">${g}</g>`);
    } else if (n.kind === 'rect') {
      const c = n.color || '#185FA5';
      out.push(`<g class="shape${sel}" data-id="${n.id}" data-kind="note"><rect x="${r1(n.x)}" y="${r1(n.y)}" width="${r1(n.w)}" height="${r1(n.h)}" fill="${c}" fill-opacity="${n.fill ? 0.18 : 0}" stroke="${c}" stroke-width="2.5" ${n.dash ? 'stroke-dasharray="10 7"' : ''} rx="2"/></g>`);
    } else if (n.kind === 'circle') {
      const c = n.color || '#185FA5';
      out.push(`<g class="shape${sel}" data-id="${n.id}" data-kind="note"><circle cx="${r1(n.cx)}" cy="${r1(n.cy)}" r="${r1(n.r)}" fill="${c}" fill-opacity="${n.fill ? 0.18 : 0}" stroke="${c}" stroke-width="2.5" ${n.dash ? 'stroke-dasharray="10 7"' : ''}/></g>`);
    } else {
      out.push(`<g class="textnote${sel}" data-id="${n.id}" data-kind="note"><text x="${r1(n.x)}" y="${r1(n.y)}" fill="${n.color || '#185FA5'}" font-size="${n.size || 20}">${esc(n.text)}</text></g>`);
    }
  }

  // Orientación
  out.push(`<text class="orient" x="${r1((b.minX + b.maxX) / 2)}" y="${r1(b.minY - 70)}" text-anchor="middle">FONDO</text>`);
  out.push(`<text class="orient" x="${r1((b.minX + b.maxX) / 2)}" y="${r1(b.maxY + 85)}" text-anchor="middle">FRENTE / ENTRADA</text>`);
  return out.join('\n');
}

const PLAN_CSS = `
.grid .g1{stroke:#dcd9cf;stroke-width:1}.grid .g2{stroke:#ecebe5;stroke-width:.6}
.floor{fill:#F6F4EE}
.wall{stroke:#2C2C2A;stroke-width:12;stroke-linecap:square}
.wall.selected{stroke:#D85A30}
.hit{stroke:transparent;stroke-width:34;stroke-linecap:round}
.gap{stroke:#F6F4EE;stroke-width:14}
.win{stroke:#185FA5;stroke-width:2}
.door{stroke:#2C2C2A;stroke-width:3}.door.thin{stroke-width:2}
.swing{fill:none;stroke:#888780;stroke-width:1.2;stroke-dasharray:4 3}
.opening.selected .gap{stroke:#FAC775}
.item .body{stroke-width:1.2}.item .sym{fill:none;stroke-width:1}.item .sym.dashed{stroke-dasharray:8 6}
.item.alto .body{fill-opacity:.35;stroke-dasharray:10 6;stroke-width:2}
.item.t-alfombra .body,.item.t-zona .body{fill-opacity:.45;stroke-dasharray:6 4}
.item.selected .body{stroke:#D85A30;stroke-width:3}
.dim{font:15px sans-serif;fill:#5F5E5A}
.orient{font:600 18px sans-serif;fill:#B4B2A9;letter-spacing:3px}
.openlabel{font:13px sans-serif;fill:#5F5E5A}
.ink{fill:none;stroke-linecap:round;stroke-linejoin:round}
.ink.selected{stroke:#D85A30 !important}
.shape.selected line:not(.hit),.shape.selected rect,.shape.selected circle,.shape.selected path{stroke:#D85A30 !important}
.shape rect,.shape circle{pointer-events:all}
.textnote text{font-family:'Comic Sans MS','Segoe Print',cursive,sans-serif}
.textnote.selected text{fill:#D85A30}
text{font-family:-apple-system,'Segoe UI',Roboto,sans-serif}
`;

// SVG completo para exportar (PNG / referencia de render)
export function planSVGString(plan, { title = '', subtitle = '', level = 'all' } = {}) {
  const b = bounds(plan);
  const pad = 130;
  const x0 = b.minX - pad, y0 = b.minY - pad - (title ? 50 : 0);
  const w = b.maxX - b.minX + pad * 2, h = b.maxY - b.minY + pad * 2 + (title ? 50 : 0);
  const head = title ? `<text x="${b.minX}" y="${b.minY - pad + 10}" font-size="28" font-weight="600" fill="#2C2C2A">${esc(title)}</text><text x="${b.minX}" y="${b.minY - pad + 42}" font-size="17" fill="#5F5E5A">${esc(subtitle)}</text>` : '';
  const headBg = title ? `<rect x="${x0}" y="${y0}" width="${w}" height="${b.minY - pad + 60 - y0}" fill="#ffffff"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" width="${Math.round(w * 2)}" height="${Math.round(h * 2)}"><style>${PLAN_CSS}</style><rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#ffffff"/>${planMarkup(plan, { level })}${headBg}${head}</svg>`;
}

export async function planPNG(plan, opts = {}) {
  const svg = planSVGString(plan, opts);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const maxSide = 1600;
  const k = Math.min(1, maxSide / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

// ---------------------------------------------------------------------------
// Editor interactivo
const SHAPE_TOOLS = ['room', 'dim', 'line', 'arrow', 'rect', 'circle', 'measure'];

export class PlanEditor {
  constructor(host, plan, { onChange, onSelect } = {}) {
    this.host = host;
    this.plan = plan;
    this.onChange = onChange || (() => {});
    this.onSelect = onSelect || (() => {});
    this.tool = 'select';
    this.itemType = null;
    this.inkColor = '#C0392B';
    this.selectedId = null;
    this.undoStack = [];
    this.redoStack = [];
    this.k = 1; this.tx = 0; this.ty = 0;
    this.pointers = new Map();
    this.penSeen = false;
    this.level = 'all';
    this.snapOn = true;
    host.innerHTML = `<svg class="plan-svg" tabindex="0"><style>${PLAN_CSS}</style><g class="world"><g class="content"></g><g class="overlay"></g></g></svg>`;
    this.svg = host.querySelector('svg');
    this.world = host.querySelector('.world');
    this.content = host.querySelector('.content');
    this.overlay = host.querySelector('.overlay');
    this.bind();
    this.render();
    requestAnimationFrame(() => this.fit());
  }

  // --- utilidades
  snapshot() { this.undoStack.push(JSON.stringify(this.plan)); if (this.undoStack.length > 80) this.undoStack.shift(); this.redoStack = []; }
  undo() { if (!this.undoStack.length) return; this.redoStack.push(JSON.stringify(this.plan)); this.replace(JSON.parse(this.undoStack.pop())); }
  redo() { if (!this.redoStack.length) return; this.undoStack.push(JSON.stringify(this.plan)); this.replace(JSON.parse(this.redoStack.pop())); }
  replace(p) { Object.keys(this.plan).forEach((k) => delete this.plan[k]); Object.assign(this.plan, p); this.select(null); this.changed(); }
  changed() { this.render(); this.onChange(this.plan); }

  setTool(t, itemType = null) {
    this.tool = t; this.itemType = itemType;
    this.svg.dataset.tool = t;
    if (t !== 'select') this.select(null);
  }

  select(id) {
    this.selectedId = id;
    this.render();
    this.onSelect(this.getSelected());
  }

  getSelected() {
    const id = this.selectedId; if (!id) return null;
    const p = this.plan;
    const it = p.items.find((x) => x.id === id); if (it) return { kind: 'item', obj: it };
    const w = p.walls.find((x) => x.id === id); if (w) return { kind: 'wall', obj: w };
    const o = p.openings.find((x) => x.id === id); if (o) return { kind: 'opening', obj: o };
    const n = p.notes.find((x) => x.id === id); if (n) return { kind: 'note', obj: n };
    return null;
  }

  removeSelected() {
    const s = this.getSelected(); if (!s) return;
    this.snapshot();
    this.removeById(s.obj.id);
    this.select(null); this.changed();
  }

  duplicateSelected() {
    const s = this.getSelected(); if (!s) return;
    const c = JSON.parse(JSON.stringify(s.obj)); c.id = uid();
    if (s.kind === 'item') { c.x += 20; c.y += 20; this.update((p) => p.items.push(c)); }
    else if (s.kind === 'note') {
      if (c.points) c.points = c.points.map((q) => [q[0] + 20, q[1] + 20]);
      else if ('x1' in c) { c.x1 += 20; c.y1 += 20; c.x2 += 20; c.y2 += 20; }
      else if (c.kind === 'circle') { c.cx += 20; c.cy += 20; }
      else { c.x += 20; c.y += 20; }
      this.update((p) => p.notes.push(c));
    } else return;
    this.select(c.id);
  }

  removeById(id) {
    const p = this.plan;
    p.items = p.items.filter((x) => x.id !== id);
    p.notes = p.notes.filter((x) => x.id !== id);
    p.openings = p.openings.filter((x) => x.id !== id && x.wallId !== id);
    p.walls = p.walls.filter((x) => x.id !== id);
  }

  render() {
    this.content.innerHTML = planMarkup(this.plan, { selectedId: this.selectedId, showHits: true, level: this.level });
    this.applyTransform();
  }

  applyTransform() { this.world.setAttribute('transform', `translate(${this.tx} ${this.ty}) scale(${this.k})`); }

  fit() {
    const r = this.svg.getBoundingClientRect();
    if (!r.width) return;
    const b = bounds(this.plan);
    const w = b.maxX - b.minX + 260, h = b.maxY - b.minY + 300;
    this.k = Math.min(r.width / w, r.height / h);
    this.tx = r.width / 2 - ((b.minX + b.maxX) / 2) * this.k;
    this.ty = r.height / 2 - ((b.minY + b.maxY) / 2) * this.k;
    this.applyTransform();
  }

  toWorld(clientX, clientY) {
    const r = this.svg.getBoundingClientRect();
    return { x: (clientX - r.left - this.tx) / this.k, y: (clientY - r.top - this.ty) / this.k };
  }

  // --- geometría
  sn(v) { const st = this.snapOn ? 5 : 1; return Math.round(v / st) * st; }

  snapPoint(p, excludeWallId = null) {
    const tol = 22 / this.k + 6;
    let best = null, bd = tol;
    for (const w of this.plan.walls) {
      if (w.id === excludeWallId) continue;
      for (const q of [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]) {
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < bd) { bd = d; best = q; }
      }
    }
    if (best) return { ...best };
    return { x: this.sn(p.x), y: this.sn(p.y) };
  }

  straighten(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    let len = Math.hypot(dx, dy);
    let ang = Math.atan2(dy, dx);
    const step = Math.PI / 4;
    const snapped = Math.round(ang / step) * step;
    if (Math.abs(snapped - ang) < ((this.snapOn ? 10 : 4) * Math.PI) / 180) ang = snapped;
    len = this.sn(len);
    let end = { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len };
    const s = this.snapPoint(end);
    if (Math.hypot(s.x - end.x, s.y - end.y) < 22 / this.k + 6) end = s;
    return { x: Math.round(end.x), y: Math.round(end.y) };
  }

  nearestWall(p) {
    let best = null, bd = Infinity, bt = 0;
    for (const w of this.plan.walls) {
      const L = wallLen(w); if (!L) continue;
      const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
      let t = ((p.x - w.x1) * ux + (p.y - w.y1) * uy) / L;
      t = Math.max(0, Math.min(1, t));
      const cx = w.x1 + ux * L * t, cy = w.y1 + uy * L * t;
      const d = Math.hypot(cx - p.x, cy - p.y);
      if (d < bd) { bd = d; best = w; bt = t; }
    }
    return best ? { wall: best, t: bt, dist: bd } : null;
  }

  // --- eventos
  bind() {
    const svg = this.svg;
    svg.addEventListener('pointerdown', (e) => this.down(e));
    svg.addEventListener('pointermove', (e) => this.move(e));
    svg.addEventListener('pointerup', (e) => this.up(e));
    svg.addEventListener('pointercancel', (e) => this.up(e, true));
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * 0.0015);
      this.zoomAt(e.clientX, e.clientY, f);
    }, { passive: false });
    window.addEventListener('resize', () => this.fit());
    this._keys = (e) => {
      if (!document.body.contains(this.svg)) { window.removeEventListener('keydown', this._keys); return; }
      if (e.target.closest && e.target.closest('input,textarea,select,dialog')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); this.redo(); }
      else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); this.duplicateSelected(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { if (this.selectedId) { e.preventDefault(); this.removeSelected(); } }
      else if (e.key === 'Escape') { this.select(null); this.host.dispatchEvent(new CustomEvent('toolreset')); }
      else if (this.selectedId && e.key.startsWith('Arrow')) {
        const s = this.getSelected(); if (!s || s.kind !== 'item') return;
        e.preventDefault();
        const st = e.shiftKey ? 50 : (this.snapOn ? 5 : 1);
        this.update(() => { if (e.key === 'ArrowLeft') s.obj.x -= st; if (e.key === 'ArrowRight') s.obj.x += st; if (e.key === 'ArrowUp') s.obj.y -= st; if (e.key === 'ArrowDown') s.obj.y += st; });
      }
    };
    window.addEventListener('keydown', this._keys);
  }

  zoomAt(cx, cy, f) {
    const r = this.svg.getBoundingClientRect();
    const px = cx - r.left, py = cy - r.top;
    const nk = Math.max(0.05, Math.min(8, this.k * f));
    f = nk / this.k;
    this.tx = px - (px - this.tx) * f;
    this.ty = py - (py - this.ty) * f;
    this.k = nk;
    this.applyTransform();
  }

  isNavPointer(e) {
    // Con lápiz: el dedo sirve para mover/zoom. Sin lápiz: dos dedos navegan.
    if (e.pointerType === 'pen') return false;
    if (e.pointerType === 'touch' && this.penSeen) return true;
    if (e.button === 1 || e.button === 2) return true;
    return false;
  }

  down(e) {
    if (e.pointerType === 'pen') this.penSeen = true;
    this.svg.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    const touches = [...this.pointers.values()].filter((p) => p.type === 'touch');
    if (touches.length >= 2) { this.cancelGesture(); this.startPinch(); return; }
    if (this.isNavPointer(e)) { this.gesture = { mode: 'pan', last: { x: e.clientX, y: e.clientY } }; return; }
    e.preventDefault();
    const p = this.toWorld(e.clientX, e.clientY);
    const target = e.target.closest('[data-id]');
    const t = this.tool;

    if (t === 'select') {
      if (target) {
        const id = target.dataset.id; const kind = target.dataset.kind;
        this.select(id);
        const s = this.getSelected();
        if (s && (kind === 'item' || kind === 'note' || kind === 'opening')) {
          this.snapshot();
          this.gesture = { mode: 'drag', start: p, orig: JSON.parse(JSON.stringify(s.obj)), kind: s.kind, moved: false };
        } else if (s && kind === 'wall') {
          this.snapshot();
          this.gesture = { mode: 'dragwall', start: p, orig: { ...s.obj }, moved: false };
        }
      } else {
        this.select(null);
        this.gesture = { mode: 'pan', last: { x: e.clientX, y: e.clientY } };
      }
    } else if (t === 'wall') {
      const a = this.snapPoint(p);
      this.gesture = { mode: 'wall', a, pts: [p] };
    } else if (SHAPE_TOOLS.includes(t)) {
      this.gesture = { mode: 'shape', tool: t, a: this.snapPoint(p) };
    } else if (t === 'ink') {
      this.gesture = { mode: 'ink', pts: [[p.x, p.y]], width: e.pointerType === 'pen' ? 1.5 + (e.pressure || 0.5) * 4 : 3 };
    } else if (t === 'erase') {
      this.gesture = { mode: 'erase', erased: false };
      if (target) { this.snapshot(); this.removeById(target.dataset.id); this.gesture.erased = true; this.changed(); }
    } else {
      this.gesture = { mode: 'tap', start: p, client: { x: e.clientX, y: e.clientY } };
    }
  }

  move(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { ...this.pointers.get(e.pointerId), x: e.clientX, y: e.clientY });
    const g = this.gesture; if (!g) return;
    if (g.mode === 'pinch') { this.updatePinch(); return; }
    if (g.mode === 'pan') {
      this.tx += e.clientX - g.last.x; this.ty += e.clientY - g.last.y;
      g.last = { x: e.clientX, y: e.clientY }; this.applyTransform(); return;
    }
    const p = this.toWorld(e.clientX, e.clientY);
    if (g.mode === 'drag') {
      const dx = this.sn(p.x - g.start.x), dy = this.sn(p.y - g.start.y);
      if (!dx && !dy && !g.moved) return;
      g.moved = true;
      const s = this.getSelected(); if (!s) return;
      if (s.kind === 'item') { s.obj.x = g.orig.x + dx; s.obj.y = g.orig.y + dy; }
      else if (s.kind === 'note') {
        const o = g.orig;
        if (s.obj.kind === 'ink') s.obj.points = o.points.map((q) => [q[0] + dx, q[1] + dy, q[2]]);
        else if ('x1' in o) { s.obj.x1 = o.x1 + dx; s.obj.y1 = o.y1 + dy; s.obj.x2 = o.x2 + dx; s.obj.y2 = o.y2 + dy; }
        else if (s.obj.kind === 'circle') { s.obj.cx = o.cx + dx; s.obj.cy = o.cy + dy; }
        else { s.obj.x = o.x + dx; s.obj.y = o.y + dy; }
      } else if (s.kind === 'opening') {
        const w = this.plan.walls.find((x) => x.id === s.obj.wallId);
        if (w) {
          const L = wallLen(w), ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
          const t = ((p.x - w.x1) * ux + (p.y - w.y1) * uy) / L;
          const half = s.obj.w / 2 / L;
          s.obj.t = Math.max(half, Math.min(1 - half, Math.round(t * L / 5) * 5 / L));
        }
      }
      this.render();
    } else if (g.mode === 'dragwall') {
      const dx = this.sn(p.x - g.start.x), dy = this.sn(p.y - g.start.y);
      if (!dx && !dy && !g.moved) return;
      g.moved = true;
      const s = this.getSelected(); if (!s) return;
      // Mover el muro en perpendicular, arrastrando los extremos que comparten otros muros
      const o = g.orig; const L = wallLen(o); const nx = -(o.y2 - o.y1) / L, ny = (o.x2 - o.x1) / L;
      const dn = dx * nx + dy * ny; const mx = Math.round(nx * dn), my = Math.round(ny * dn);
      const moveEnd = (ox, oy, nxp, nyp) => {
        for (const w of this.plan.walls) {
          if (w.id === s.obj.id) continue;
          if (w._ox1 === undefined) { w._ox1 = w.x1; w._oy1 = w.y1; w._ox2 = w.x2; w._oy2 = w.y2; }
          if (w._ox1 === ox && w._oy1 === oy) { w.x1 = nxp; w.y1 = nyp; }
          if (w._ox2 === ox && w._oy2 === oy) { w.x2 = nxp; w.y2 = nyp; }
        }
      };
      s.obj.x1 = o.x1 + mx; s.obj.y1 = o.y1 + my; s.obj.x2 = o.x2 + mx; s.obj.y2 = o.y2 + my;
      moveEnd(o.x1, o.y1, s.obj.x1, s.obj.y1); moveEnd(o.x2, o.y2, s.obj.x2, s.obj.y2);
      this.render();
    } else if (g.mode === 'wall') {
      g.pts.push(p);
      const b = this.straighten(g.a, p);
      const len = Math.hypot(b.x - g.a.x, b.y - g.a.y);
      this.overlay.innerHTML = `<line x1="${g.a.x}" y1="${g.a.y}" x2="${b.x}" y2="${b.y}" stroke="#D85A30" stroke-width="12" stroke-opacity=".7" stroke-linecap="square"/>
        <text x="${(g.a.x + b.x) / 2}" y="${(g.a.y + b.y) / 2 - 22}" font-size="${18 / Math.max(this.k, 0.4)}" fill="#D85A30" text-anchor="middle">${fmtM(len)} m</text>`;
    } else if (g.mode === 'shape') {
      const a = g.a; const lin = ['dim', 'line', 'arrow', 'measure'].includes(g.tool);
      const b = lin ? this.straighten(a, p) : this.snapPoint(p);
      g.b = b;
      const fs = 18 / Math.max(this.k, 0.4); const col = '#D85A30';
      let o = '';
      if (g.tool === 'room' || g.tool === 'rect') {
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
        o = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${col}" fill-opacity=".08" stroke="${col}" stroke-width="${g.tool === 'room' ? 10 : 3}" stroke-opacity=".7"/>
          <text x="${x + w / 2}" y="${y - 14}" font-size="${fs}" fill="${col}" text-anchor="middle">${fmtM(w)} × ${fmtM(h)} m</text>`;
      } else if (g.tool === 'circle') {
        const r = Math.hypot(b.x - a.x, b.y - a.y);
        o = `<circle cx="${a.x}" cy="${a.y}" r="${r}" fill="${col}" fill-opacity=".08" stroke="${col}" stroke-width="3"/><text x="${a.x}" y="${a.y - r - 12}" font-size="${fs}" fill="${col}" text-anchor="middle">Ø ${fmtM(r * 2)} m</text>`;
      } else {
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        o = `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${col}" stroke-width="3" ${g.tool === 'measure' ? 'stroke-dasharray="8 6"' : ''}/>
          <text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 16}" font-size="${fs}" fill="${col}" text-anchor="middle">${fmtM(len)} m</text>`;
      }
      this.overlay.innerHTML = o;
    } else if (g.mode === 'ink') {
      g.pts.push([r1(p.x), r1(p.y)]);
      const d = g.pts.map((q, i) => `${i ? 'L' : 'M'}${q[0]} ${q[1]}`).join(' ');
      this.overlay.innerHTML = `<path d="${d}" fill="none" stroke="${this.inkColor}" stroke-width="${g.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if (g.mode === 'erase') {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const target = el && el.closest && el.closest('[data-id]');
      if (target && this.svg.contains(target)) {
        if (!g.erased) this.snapshot();
        g.erased = true;
        this.removeById(target.dataset.id); this.changed();
      }
    }
  }

  up(e, cancelled = false) {
    this.pointers.delete(e.pointerId);
    const g = this.gesture;
    if (!g) return;
    if (g.mode === 'pinch') { if (this.pointers.size < 2) this.gesture = null; return; }
    this.gesture = null;
    this.overlay.innerHTML = '';
    if (cancelled) return;
    const p = this.toWorld(e.clientX, e.clientY);
    if (g.mode === 'drag' || g.mode === 'dragwall') {
      this.plan.walls.forEach((w) => { delete w._ox1; delete w._oy1; delete w._ox2; delete w._oy2; });
      if (g.moved) this.changed(); else this.undoStack.pop();
      this.onSelect(this.getSelected());
    } else if (g.mode === 'wall') {
      const b = this.straighten(g.a, p);
      if (Math.hypot(b.x - g.a.x, b.y - g.a.y) >= 20) {
        this.snapshot();
        this.plan.walls.push({ id: uid(), x1: g.a.x, y1: g.a.y, x2: b.x, y2: b.y });
        this.changed();
      }
    } else if (g.mode === 'shape') {
      const a = g.a, b = g.b || a, tool = g.tool;
      const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y), len = Math.hypot(b.x - a.x, b.y - a.y);
      if (tool === 'measure') {
        if (len > 2) this.flash(`Distancia: ${fmtM(len)} m`);
      } else if (tool === 'room') {
        if (w >= 50 && h >= 50) {
          this.snapshot();
          const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), x1 = x0 + w, y1 = y0 + h;
          this.plan.walls.push({ id: uid(), x1: x0, y1: y0, x2: x1, y2: y0 }, { id: uid(), x1: x1, y1: y0, x2: x1, y2: y1 }, { id: uid(), x1: x1, y1: y1, x2: x0, y2: y1 }, { id: uid(), x1: x0, y1: y1, x2: x0, y2: y0 });
          this.changed();
        }
      } else if (tool === 'rect') {
        if (w >= 10 && h >= 10) { this.snapshot(); this.plan.notes.push({ id: uid(), kind: 'rect', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w, h, color: this.inkColor, fill: true }); this.changed(); }
      } else if (tool === 'circle') {
        if (len >= 8) { this.snapshot(); this.plan.notes.push({ id: uid(), kind: 'circle', cx: a.x, cy: a.y, r: Math.round(len), color: this.inkColor, fill: true }); this.changed(); }
      } else if (len >= 10) {
        this.snapshot();
        this.plan.notes.push({ id: uid(), kind: tool, x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: tool === 'dim' ? '#444441' : this.inkColor });
        this.changed();
      }
    } else if (g.mode === 'ink') {
      if (g.pts.length > 1) {
        this.snapshot();
        this.plan.notes.push({ id: uid(), kind: 'ink', points: simplify(g.pts, 1.2 / this.k), color: this.inkColor, width: r1(g.width) });
        this.changed();
      }
    } else if (g.mode === 'tap') {
      this.tap(p, g.client);
    }
  }

  tap(p) {
    const t = this.tool;
    if (t === 'door' || t === 'window' || t === 'sliding' || t === 'entry') {
      const nw = this.nearestWall(p);
      if (!nw || nw.dist > 60) { this.flash('Toca cerca de una pared'); return; }
      const type = { door: 'puerta', window: 'ventana', sliding: 'corredera', entry: 'entrada' }[t];
      const w = { puerta: 80, ventana: 120, corredera: 90, entrada: 100 }[type];
      const L = wallLen(nw.wall);
      const half = w / 2 / L;
      this.snapshot();
      const o = { id: uid(), wallId: nw.wall.id, t: Math.max(half, Math.min(1 - half, nw.t)), w, type };
      this.plan.openings.push(o);
      this.setTool('select');
      this.changed(); this.select(o.id);
      this.host.dispatchEvent(new CustomEvent('toolreset'));
    } else if (t === 'item' && this.itemType) {
      const c = byType(this.itemType);
      this.snapshot();
      const it = { id: uid(), type: c.type, label: c.label, w: c.w, d: c.d, rot: 0, x: this.sn(p.x - c.w / 2), y: this.sn(p.y - c.d / 2), level: c.type === 'altillo' ? 'alta' : 'baja' };
      this.plan.items.push(it);
      this.setTool('select');
      this.changed(); this.select(it.id);
      this.host.dispatchEvent(new CustomEvent('toolreset'));
    } else if (t === 'text') {
      this.host.dispatchEvent(new CustomEvent('asktext', { detail: p }));
    }
  }

  addTextNote(p, text) {
    if (!text) return;
    this.snapshot();
    this.plan.notes.push({ id: uid(), kind: 'text', x: Math.round(p.x), y: Math.round(p.y), text, color: '#185FA5', size: 20 });
    this.changed();
  }

  flash(msg) { this.host.dispatchEvent(new CustomEvent('flash', { detail: msg })); }

  cancelGesture() { this.gesture = null; this.overlay.innerHTML = ''; }
  startPinch() {
    const [a, b] = [...this.pointers.values()];
    this.gesture = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), c0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, k0: this.k, tx0: this.tx, ty0: this.ty };
  }
  updatePinch() {
    const pts = [...this.pointers.values()]; if (pts.length < 2) return;
    const [a, b] = pts; const g = this.gesture;
    const d = Math.hypot(a.x - b.x, a.y - b.y); const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const r = this.svg.getBoundingClientRect();
    const k = Math.max(0.05, Math.min(8, g.k0 * d / (g.d0 || 1)));
    const wx = (g.c0.x - r.left - g.tx0) / g.k0, wy = (g.c0.y - r.top - g.ty0) / g.k0;
    this.k = k; this.tx = c.x - r.left - wx * k; this.ty = c.y - r.top - wy * k;
    this.applyTransform();
  }

  // Edición desde el panel
  update(fn) { this.snapshot(); fn(this.plan); this.changed(); this.onSelect(this.getSelected()); }

  setWallLength(wall, cm) {
    const L = wallLen(wall); if (!L || !cm) return;
    this.update(() => {
      const ux = (wall.x2 - wall.x1) / L, uy = (wall.y2 - wall.y1) / L;
      const ox = wall.x2, oy = wall.y2;
      wall.x2 = Math.round(wall.x1 + ux * cm); wall.y2 = Math.round(wall.y1 + uy * cm);
      for (const w of this.plan.walls) {
        if (w.id === wall.id) continue;
        if (w.x1 === ox && w.y1 === oy) { w.x1 = wall.x2; w.y1 = wall.y2; }
        if (w.x2 === ox && w.y2 === oy) { w.x2 = wall.x2; w.y2 = wall.y2; }
      }
    });
  }
}

// Simplificación de trazos (Ramer–Douglas–Peucker)
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const dmax = { d: 0, i: 0 };
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const L = Math.hypot(bx - ax, by - ay) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((by - ay) * pts[i][0] - (bx - ax) * pts[i][1] + bx * ay - by * ax) / L;
    if (d > dmax.d) { dmax.d = d; dmax.i = i; }
  }
  if (dmax.d > eps) {
    const l = simplify(pts.slice(0, dmax.i + 1), eps), r = simplify(pts.slice(dmax.i), eps);
    return l.slice(0, -1).concat(r);
  }
  return [pts[0], pts[pts.length - 1]];
}

export { CATALOG };
