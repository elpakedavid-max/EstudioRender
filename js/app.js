import * as db from './db.js';
import { ROOM_TYPES, CATALOG } from './catalog.js';
import { PlanEditor, emptyPlan, planPNG, fmtM } from './plan.js';
import { renderPrompt, editPrompt, videoPrompt, productRefs, VIEWS, STYLES, LIGHTS, CAMERA_MOVES } from './prompt.js';
import { generateImage, proposeLayout, autoReady, layoutReady, providerLabel } from './ai.js';
import { buildTimeline, drawFrame, recordVideo } from './video.js';
import { buildPresentation } from './present.js';
import * as sync from './sync.js';
import { STORES, storeSearchURL, storeName, guessStore, fmtEUR } from './stores.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = $('#view');

let current = null;      // proyecto abierto
let tab = 'ficha';
let editor = null;
let saveTimer = null;

// ---------- utilidades de interfaz
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), ms);
}
function dialog(html, { cls = '' } = {}) {
  const d = $('#dialog'); d.className = cls; d.innerHTML = html;
  d.showModal();
  d.onclick = (e) => { if (e.target === d) d.close(); };
  return d;
}
function ask(title, value = '', { multiline = false, placeholder = '' } = {}) {
  return new Promise((resolve) => {
    const d = dialog(`<form class="dlg" method="dialog"><h3>${esc(title)}</h3>
      <div class="field">${multiline ? `<textarea name="v" placeholder="${esc(placeholder)}">${esc(value)}</textarea>` : `<input name="v" value="${esc(value)}" placeholder="${esc(placeholder)}">`}</div>
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" value="cancel">Cancelar</button><button class="btn primary" value="ok">Aceptar</button></div></form>`);
    const f = $('form', d); const inp = f.elements.v; setTimeout(() => inp.focus(), 50);
    d.onclose = () => resolve(d.returnValue === 'ok' ? inp.value.trim() : null);
  });
}
function confirmDlg(msg, ok = 'Aceptar') {
  return new Promise((resolve) => {
    const d = dialog(`<form class="dlg" method="dialog"><p>${esc(msg)}</p><div class="row" style="justify-content:flex-end"><button class="btn" value="cancel">Cancelar</button><button class="btn primary" value="ok">${esc(ok)}</button></div></form>`);
    d.onclose = () => resolve(d.returnValue === 'ok');
  });
}
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function shareFiles(files, text) {
  if (navigator.canShare && navigator.canShare({ files })) {
    try { await navigator.share({ files, text }); return true; } catch (e) { if (e.name === 'AbortError') return true; }
  }
  return false;
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copiado al portapapeles'); }
  catch { await ask('Copia el texto', text, { multiline: true }); }
}
const slug = (s) => (s || 'proyecto').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '');
function pickFiles(accept = 'image/*', multiple = true, capture = false) {
  return new Promise((resolve) => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = multiple;
    if (capture) i.capture = 'environment';
    i.onchange = () => resolve([...i.files]); i.click();
  });
}

let syncStatus = '';
function setSyncStatus(msg) {
  syncStatus = msg;
  const el = $('#sync-status'); if (el) el.textContent = msg;
}
window.addEventListener('er-saved', () => sync.scheduleAutoSync(setSyncStatus));

export const STATUS = { borrador: 'Borrador', curso: 'En curso', presentado: 'Presentado al cliente', finalizado: 'Finalizado' };

function setSaveState(text, dirty = false) {
  const el = $('#save-state'); if (!el) return;
  el.textContent = text; el.classList.toggle('dirty', dirty);
}

// Guardado automático (agrupa cambios) + guardado manual con el botón "Guardar"
function save() {
  clearTimeout(saveTimer);
  setSaveState('Cambios sin guardar…', true);
  saveTimer = setTimeout(async () => {
    if (!current) return;
    await db.saveProject(current);
    setSaveState(`Guardado ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`);
  }, 600);
}

async function saveNow({ quiet = false } = {}) {
  clearTimeout(saveTimer);
  if (!current) return;
  await db.saveProject(current);
  const hora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  setSaveState(`Guardado ${hora}`);
  if (sync.loggedIn() && navigator.onLine) {
    try {
      setSaveState('Subiendo a la nube…');
      await sync.syncNow(setSyncStatus);
      setSaveState(`Guardado en la nube ${hora}`);
      if (!quiet) toast('Proyecto guardado en el dispositivo y en la nube');
      return;
    } catch (e) {
      setSaveState(`Guardado ${hora} (sin subir)`, true);
      if (!quiet) toast('Guardado en el dispositivo. No se pudo subir a la nube: ' + e.message, 6000);
      return;
    }
  }
  if (!quiet) toast(sync.loggedIn() ? 'Guardado en el dispositivo (sin conexión: se subirá luego)' : 'Proyecto guardado en este dispositivo');
}
window.addEventListener('beforeunload', () => { if (current) db.saveProject(current); });
document.addEventListener('visibilitychange', () => { if (document.hidden && current) db.saveProject(current); });

// ---------- cabecera
function setHeader(title, inProject) {
  $('#title').textContent = title;
  $('#btn-back').hidden = !inProject;
  $('#tabs').hidden = !inProject;
  $('#btn-save').hidden = !inProject;
  $('#save-state').hidden = !inProject;
  $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
}
$('#btn-back').onclick = async () => { await saveNow({ quiet: true }); location.hash = ''; };
$('#btn-save').onclick = () => saveNow();
$('#tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) { location.hash = `#p/${current.id}/${b.dataset.tab}`; } };
$('#btn-settings').onclick = openSettings;

// ---------- rutas
window.addEventListener('hashchange', route);
async function route() {
  const m = location.hash.match(/^#p\/([^/]+)(?:\/(\w+))?/);
  if (editor) { editor = null; }
  if (!m) { current = null; return renderHome(); }
  if (!current || current.id !== m[1]) current = await db.getProject(m[1]);
  if (!current) { location.hash = ''; return; }
  tab = m[2] || 'ficha';
  setHeader(current.name || 'Proyecto', true);
  if (!$('#save-state').classList.contains('dirty')) setSaveState(`Guardado ${new Date(current.updatedAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`);
  ({ ficha: renderFicha, plano: renderPlano, render: renderRenders, video: renderVideo }[tab] || renderFicha)();
}

// ---------- inicio
async function renderHome() {
  setHeader('EstudioRender', false);
  const all = await db.listProjects();
  const filter = renderHome.filter || 'todos';
  const list = filter === 'todos' ? all : all.filter((p) => (p.status || 'borrador') === filter);
  const counts = {}; all.forEach((p) => { const k = p.status || 'borrador'; counts[k] = (counts[k] || 0) + 1; });
  const cards = await Promise.all(list.map(async (p) => {
    const cover = p.renders?.[0]?.fileId || p.photos?.[0];
    const url = cover ? await db.fileURL(cover) : '';
    return `<a class="card" href="#p/${p.id}" style="text-decoration:none;color:inherit">
      <div class="thumb" style="${url ? `background-image:url('${url}')` : ''}">${url ? '' : 'Sin imágenes'}</div>
      <div class="body"><span class="status ${p.status || 'borrador'}">${STATUS[p.status || 'borrador']}</span><b>${esc(p.name)}</b><span class="muted small">${esc(ROOM_TYPES[p.roomType] || '')}${p.client ? ' · ' + esc(p.client) : ''} · ${new Date(p.updatedAt).toLocaleDateString('es-ES')}</span></div></a>`;
  }));
  view.innerHTML = `<div class="page">
    <h2>Proyectos</h2>
    ${all.length ? `<div class="filters" id="filters"><button class="chip ${filter === 'todos' ? 'on' : ''}" data-f="todos">Todos (${all.length})</button>${Object.entries(STATUS).map(([k, v]) => counts[k] ? `<button class="chip ${filter === k ? 'on' : ''}" data-f="${k}">${v} (${counts[k]})</button>` : '').join('')}</div>` : ''}
    <div class="cards">
      <button class="card new" id="new">+ Nuevo proyecto</button>
      ${cards.join('')}
    </div>
    <div class="row" style="margin-top:24px"><button class="btn" id="import">Importar proyecto (.json)</button>
      ${sync.loggedIn() ? `<button class="btn" id="sync-now">Sincronizar ahora</button><span class="muted small" id="sync-status">${esc(syncStatus || 'Sincronización activa: ' + (sync.session()?.email || ''))}</span>`
        : '<span class="muted small">Para tener los proyectos en el iPad y en el ordenador, activa la sincronización en Ajustes.</span>'}</div>
  </div>`;
  $('#new').onclick = newProject;
  const fl = $('#filters'); if (fl) fl.onclick = (e) => { const b = e.target.closest('[data-f]'); if (b) { renderHome.filter = b.dataset.f; renderHome(); } };
  const sn = $('#sync-now');
  if (sn) sn.onclick = async () => {
    sn.disabled = true;
    try { const r = await sync.syncNow(setSyncStatus); toast(r.msg); if (r.down || r.del) renderHome(); }
    catch (e) { setSyncStatus('Error: ' + e.message); toast('No se pudo sincronizar: ' + e.message, 6000); }
    sn.disabled = false;
  };
  $('#import').onclick = importProject;
}

async function newProject() {
  const name = await ask('Nombre del proyecto', '', { placeholder: 'Ej.: Loft calle Real 12' });
  if (name === null) return;
  const p = {
    id: db.uid(), name: name || 'Proyecto sin nombre', client: '', roomType: 'loft', status: 'borrador',
    width: 500, length: 700, height: 280, description: '', style: STYLES[0], materials: '', ceiling: 'plano, liso y pintado en blanco', light: 'dia',
    photos: [], plan: null, renders: [], createdAt: Date.now(),
  };
  await db.saveProject(p);
  location.hash = `#p/${p.id}/ficha`;
}

// ---------- ficha
async function renderFicha() {
  const p = current;
  const photoHtml = await Promise.all(p.photos.map(async (id, i) => `<div class="photo ${i === 0 ? 'main' : ''}" style="background-image:url('${await db.fileURL(id)}')" data-id="${id}">
      ${i === 0 ? '<span class="tag">Principal</span>' : ''}<button class="x" data-del="${id}" aria-label="Quitar">×</button></div>`));
  view.innerHTML = `<div class="page">
    <h2>Ficha del proyecto</h2>
    <div class="form">
      <div class="field"><label>Nombre</label><input data-k="name" value="${esc(p.name)}"></div>
      <div class="field"><label>Estado del proyecto</label><select data-k="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === (p.status || 'borrador') ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label>Cliente</label><input data-k="client" value="${esc(p.client)}"></div>
      <div class="field"><label>Tipo de estancia</label><select data-k="roomType">${Object.entries(ROOM_TYPES).map(([k, v]) => `<option value="${k}" ${k === p.roomType ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label>Ancho (cm)</label><input type="number" inputmode="numeric" data-k="width" value="${p.width || ''}"></div>
      <div class="field"><label>Largo / fondo (cm)</label><input type="number" inputmode="numeric" data-k="length" value="${p.length || ''}"></div>
      <div class="field"><label>Altura (cm)</label><input type="number" inputmode="numeric" data-k="height" value="${p.height || ''}"></div>
      <div class="field full"><label>Lo que quiere el cliente</label><textarea data-k="description" placeholder="Ej.: apartamento abierto tipo loft, cama en altillo sobre el baño, cocina en L con ventana a la calle…">${esc(p.description)}</textarea></div>
      <div class="field full"><label>Estilo</label><div class="chips" id="styles">${STYLES.map((s) => `<button class="chip ${s === p.style ? 'on' : ''}" data-style="${esc(s)}">${esc(s)}</button>`).join('')}</div>
        <input data-k="style" value="${esc(p.style)}" placeholder="O escribe tu propio estilo"></div>
      <div class="field full"><label>Materiales y acabados</label><input data-k="materials" value="${esc(p.materials)}" placeholder="Ej.: suelo de microcemento gris claro, roble natural, perfilería negra"></div>
      <div class="field"><label>Techo</label><input data-k="ceiling" value="${esc(p.ceiling)}"></div>
      <div class="field"><label>Iluminación</label><select data-k="light">${Object.keys(LIGHTS).map((k) => `<option value="${k}" ${k === p.light ? 'selected' : ''}>${{ dia: 'Día', tarde: 'Atardecer', noche: 'Noche' }[k]}</option>`).join('')}</select></div>
    </div>
    <h3>Fotos del espacio actual</h3>
    <p class="muted small">La primera es la principal: se usa como base de la perspectiva de los renders. Toca una foto para hacerla principal.</p>
    <div class="photos">${photoHtml.join('')}<button class="addphoto" id="addphoto">+ Añadir fotos</button></div>
    <div class="row" style="margin-top:28px">
      <button class="btn primary" id="save-exit">Guardar y salir</button>
      <a class="btn dark" href="#p/${p.id}/plano">Siguiente: plano →</a>
      <button class="btn" id="export">Exportar proyecto</button>
      <button class="btn danger" id="delete">Eliminar proyecto</button>
    </div>
  </div>`;
  $$('[data-k]', view).forEach((el) => el.addEventListener('input', () => {
    const k = el.dataset.k;
    current[k] = el.type === 'number' ? Number(el.value) || 0 : el.value;
    if (k === 'name') setHeader(current.name, true);
    if (k === 'style') $$('#styles .chip').forEach((c) => c.classList.toggle('on', c.dataset.style === el.value));
    save();
  }));
  $('#styles').onclick = (e) => {
    const c = e.target.closest('[data-style]'); if (!c) return;
    current.style = c.dataset.style; $('[data-k="style"]').value = current.style;
    $$('#styles .chip').forEach((x) => x.classList.toggle('on', x === c)); save();
  };
  $('#addphoto').onclick = async () => {
    const files = await pickFiles('image/*', true);
    for (const f of files) current.photos.push(await db.putFile(f));
    await db.saveProject(current); renderFicha();
  };
  $('.photos').onclick = async (e) => {
    const del = e.target.closest('[data-del]');
    if (del) { current.photos = current.photos.filter((x) => x !== del.dataset.del); await db.deleteFile(del.dataset.del); await db.saveProject(current); return renderFicha(); }
    const ph = e.target.closest('.photo');
    if (ph) { current.photos = [ph.dataset.id, ...current.photos.filter((x) => x !== ph.dataset.id)]; await db.saveProject(current); renderFicha(); }
  };
  $('#export').onclick = exportProject;
  $('#save-exit').onclick = async () => { await saveNow(); location.hash = ''; };
  $('#delete').onclick = async () => {
    if (!(await confirmDlg(`¿Eliminar "${current.name}" y todas sus imágenes? No se puede deshacer.`, 'Eliminar'))) return;
    await sync.markDeleted(current.id);
    await db.deleteProject(current); current = null; location.hash = '';
  };
}

// ---------- plano
const TOOLS = [
  ['select', '☝', 'Mover'], ['room', '⬚', 'Habitación'], ['wall', '▬', 'Pared'], ['door', '◜', 'Puerta'], ['window', '▭', 'Ventana'], ['sliding', '⇆', 'Corredera'], ['entry', '⇩', 'Entrada'],
  ['item', '▦', 'Muebles'], '|',
  ['ink', '✎', 'Lápiz'], ['line', '╱', 'Línea'], ['arrow', '➚', 'Flecha'], ['rect', '▢', 'Zona'], ['circle', '◯', 'Círculo'], ['dim', '↔', 'Cota'], ['measure', '📏', 'Medir'], ['text', 'T', 'Texto'], ['erase', '⌫', 'Borrar'],
];
const HINTS = {
  select: 'Toca un elemento y arrástralo para moverlo. Estira desde los puntos naranjas para cambiar su tamaño y gíralo con el punto de arriba. Arrastra el fondo para moverte y pellizca para hacer zoom.',
  wall: 'Dibuja una línea: se endereza sola, se ajusta a 5 cm y se une a otras paredes.',
  door: 'Toca sobre una pared para poner una puerta.', window: 'Toca sobre una pared para poner una ventana.',
  sliding: 'Toca sobre una pared para poner una puerta corredera.', entry: 'Toca sobre una pared para marcar la entrada.',
  item: 'Elige una pieza a la derecha y toca el plano donde quieras colocarla.',
  ink: 'Escribe o dibuja a mano: notas, flechas, ideas. Con Apple Pencil, el dedo sirve para moverte por el plano.',
  text: 'Toca el plano donde quieras añadir una nota escrita.', erase: 'Toca o pasa por encima de lo que quieras borrar.',
  room: 'Arrastra de una esquina a la contraria para crear una habitación rectangular con sus 4 paredes.',
  line: 'Arrastra para dibujar una línea recta (se ajusta a 0°, 45° y 90°).', arrow: 'Arrastra para dibujar una flecha que señale algo.',
  rect: 'Arrastra para marcar una zona rectangular (por ejemplo, "zona de lectura").', circle: 'Arrastra desde el centro hacia fuera para dibujar un círculo.',
  dim: 'Arrastra entre dos puntos para poner una cota con su medida.', measure: 'Arrastra para medir una distancia (no se guarda en el plano).',
};

function renderPlano() {
  const p = current;
  if (!p.plan) { p.plan = emptyPlan(p.width || 500, p.length || 700); save(); }
  view.innerHTML = `<div class="editor">
    <div class="toolbar" id="toolbar">
      ${TOOLS.map((t) => t === '|' ? '<hr>' : `<button class="tool ${t[0] === 'select' ? 'active' : ''}" data-tool="${t[0]}"><span class="ic">${t[1]}</span>${t[2]}</button>`).join('')}
      <hr>
      <button class="tool active" data-act="snap" id="snap-btn"><span class="ic">🧲</span>Imán</button>
      <button class="tool" data-act="undo"><span class="ic">↶</span>Deshacer</button>
      <button class="tool" data-act="redo"><span class="ic">↷</span>Rehacer</button>
      <button class="tool" data-act="fit"><span class="ic">⤢</span>Encuadrar</button>
    </div>
    <div class="canvas-wrap"><div id="plan-host" style="position:absolute;inset:0"></div>
      <div class="canvas-actions">
        <select class="btn" id="level"><option value="all">Todo</option><option value="baja">Planta baja</option><option value="alta">Altillo</option></select>
        <button class="btn" id="png">Descargar plano</button>
      </div>
      <div class="canvas-hint" id="hint">${HINTS.select}</div>
    </div>
    <aside class="side" id="side"></aside>
  </div>`;
  editor = new PlanEditor($('#plan-host'), p.plan, {
    onChange: () => save(),
    onSelect: () => renderSide(),
  });
  const host = $('#plan-host');
  host.addEventListener('toolreset', () => setTool('select'));
  host.addEventListener('flash', (e) => toast(e.detail));
  host.addEventListener('asktext', async (e) => { const t = await ask('Nota en el plano', '', { placeholder: 'Ej.: encimera de mármol blanco' }); if (t) editor.addTextNote(e.detail, t); });
  $('#toolbar').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tool) setTool(b.dataset.tool);
    if (b.dataset.act === 'undo') editor.undo();
    if (b.dataset.act === 'redo') editor.redo();
    if (b.dataset.act === 'fit') editor.fit();
    if (b.dataset.act === 'snap') { editor.snapOn = !editor.snapOn; b.classList.toggle('active', editor.snapOn); toast(editor.snapOn ? 'Imán activado: ajusta a 5 cm y a paredes' : 'Imán desactivado: movimiento libre (1 cm)'); }
  };
  $('#level').onchange = (e) => { editor.level = e.target.value; editor.render(); };
  $('#png').onclick = async () => download(await planPNG(p.plan, { title: p.name, subtitle: `${ROOM_TYPES[p.roomType]} · ${fmtM(p.width)} × ${fmtM(p.length)} m` }), `plano-${slug(p.name)}.png`);
  renderSide();
}

function setTool(t) {
  editor.setTool(t, t === 'item' ? editor.itemType : null);
  $$('#toolbar .tool[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
  $('#hint').textContent = HINTS[t] || '';
  renderSide();
}

let lastSideKey = '';
function renderSide() {
  const side = $('#side'); if (!side || !editor) return;
  const sel = editor.getSelected();
  const key = `${editor.tool}:${sel?.obj?.id || ''}`;
  if (key !== lastSideKey) { side.scrollTop = 0; lastSideKey = key; }
  if (editor.tool === 'item') {
    const room = current.roomType;
    const cats = {};
    CATALOG.forEach((c) => { (cats[c.cat] = cats[c.cat] || []).push(c); });
    const order = Object.keys(cats).sort((a, b) => (cats[b].some((c) => c.rooms.includes(room)) ? 1 : 0) - (cats[a].some((c) => c.rooms.includes(room)) ? 1 : 0));
    side.innerHTML = `<h3>Muebles</h3><p class="muted small" style="margin-top:-4px">Elige una pieza y toca el plano para colocarla. Después, tócala para elegir el <b>modelo real de tienda</b> (IKEA, Leroy Merlin, Kave Home…).</p><div class="catalog">${order.map((cat) => `<div class="cat">${cat}</div>${cats[cat].map((c) => `<button data-type="${c.type}" class="${editor.itemType === c.type ? 'on' : ''}">${esc(c.label)}<br><span class="muted small">${c.w}×${c.d}</span></button>`).join('')}`).join('')}</div>`;
    side.onclick = (e) => { const b = e.target.closest('[data-type]'); if (!b) return; editor.itemType = b.dataset.type; editor.setTool('item', b.dataset.type); $$('.catalog button', side).forEach((x) => x.classList.toggle('on', x === b)); $('#hint').textContent = 'Ahora toca el plano donde quieras colocarla.'; };
    return;
  }
  if (['ink', 'line', 'arrow', 'rect', 'circle'].includes(editor.tool)) {
    const cols = ['#C0392B', '#185FA5', '#1f1f1d', '#0F6E56'];
    side.innerHTML = `<h3>${{ ink: 'Lápiz', line: 'Línea', arrow: 'Flecha', rect: 'Zona', circle: 'Círculo' }[editor.tool]}</h3><p class="muted small">Las anotaciones salen en el plano que se envía a la IA y en el que compartes. Elige el color:</p>
      <div class="swatches">${cols.map((c) => `<button class="swatch ${c === editor.inkColor ? 'on' : ''}" style="background:${c}" data-c="${c}" aria-label="Color"></button>`).join('')}</div>`;
    side.onclick = (e) => { const b = e.target.closest('[data-c]'); if (!b) return; editor.inkColor = b.dataset.c; $$('.swatch', side).forEach((x) => x.classList.toggle('on', x === b)); };
    return;
  }
  side.onclick = null;
  if (sel) return renderInspector(side, sel);
  const auto = layoutReady();
  const pl = current.plan;
  side.innerHTML = `<h3>Plano</h3>
    <p class="muted small">${pl.walls.length} paredes · ${pl.openings.length} huecos · ${pl.items.length} piezas · ${pl.notes.length} notas</p>
    <p class="small">Arriba es el <b>fondo</b> y abajo la <b>entrada</b>. Así se describe luego a la IA (izquierda y derecha mirando desde la entrada).</p>
    <div class="row" style="flex-direction:column;align-items:stretch">
      <button class="btn" id="reset-room">Rehacer contorno ${fmtM(current.width)} × ${fmtM(current.length)} m</button>
      ${auto ? '<button class="btn primary" id="ai-layout">Propuesta de distribución con IA</button>' : '<p class="muted small">Con el modo automático y una clave de Gemini (Ajustes), la IA puede proponer la distribución leyendo tu ficha y tus notas a mano.</p>'}
      <a class="btn dark" href="#p/${current.id}/render">Siguiente: renders →</a>
    </div>`;
  $('#reset-room').onclick = async () => {
    if (!(await confirmDlg('Se sustituirán las paredes y huecos por un rectángulo con las medidas de la ficha. Los muebles y notas se mantienen.'))) return;
    editor.update((plan) => { const e = emptyPlan(current.width, current.length); plan.walls = e.walls; plan.openings = []; });
    editor.fit();
  };
  const ai = $('#ai-layout');
  if (ai) ai.onclick = async () => {
    ai.disabled = true; ai.innerHTML = '<span class="spinner"></span> Pensando la distribución…';
    try {
      const photos = await Promise.all(current.photos.slice(0, 2).map((id) => db.getFile(id)));
      const res = await proposeLayout(current, await planPNG(current.plan), photos.filter(Boolean));
      const items = (res.items || []).filter((it) => CATALOG.some((c) => c.type === it.type)).map((it) => ({ ...it, id: db.uid(), rot: [0, 90, 180, 270].includes(it.rot) ? it.rot : 0, level: it.level === 'alta' ? 'alta' : 'baja' }));
      if (!items.length) throw new Error('La IA no devolvió piezas válidas.');
      const replace = current.plan.items.length ? await confirmDlg(`La IA propone ${items.length} piezas. ¿Sustituir las piezas actuales? (Cancelar = añadirlas)`, 'Sustituir') : true;
      editor.update((plan) => { plan.items = replace ? items : plan.items.concat(items); });
      if (res.notes) toast(res.notes, 7000);
    } catch (e) { toast('No se pudo: ' + e.message, 6000); }
    ai.disabled = false; ai.textContent = 'Propuesta de distribución con IA';
  };
}

// ---------- producto real vinculado a una pieza del plano
async function renderProductBox(box, o) {
  const pr = o.product;
  const q = `${o.label} ${o.w}x${o.d}`;
  if (pr && !box.dataset.editing) {
    const img = pr.fileId ? await db.fileURL(pr.fileId) : '';
    box.innerHTML = `<h3>Mueble de tienda</h3>
      <div class="product-card">${img ? `<img src="${img}" alt="">` : '<div class="noimg">Sin foto</div>'}
        <div><b>${esc(pr.name || 'Producto')}</b><span class="muted small">${esc(storeName(pr.store))}${pr.price ? ' · ' + fmtEUR(pr.price) : ''}</span>
        ${pr.url ? `<a class="small" href="${esc(pr.url)}" target="_blank" rel="noopener">Ver en la tienda ↗</a>` : ''}</div></div>
      <p class="muted small">Su foto se envía como referencia al generar los renders y sale en la presentación con el precio.</p>
      <div class="row"><button class="btn" id="p-edit">Editar</button><button class="btn danger" id="p-rm">Quitar producto</button></div>`;
    $('#p-edit', box).onclick = () => { box.dataset.editing = '1'; renderProductBox(box, o); };
    $('#p-rm', box).onclick = () => editor.update(() => { delete o.product; });
    return;
  }
  const v = pr || {};
  box.innerHTML = `<h3>¿De qué tienda es este mueble?</h3>
    <p class="muted small">1. Pulsa una tienda para ver sus modelos. 2. Copia el enlace del que te guste y pégalo abajo. 3. Añade su foto y el precio.</p>
    <div class="stores">${STORES.map((st) => `<a class="chip small" href="${esc(storeSearchURL(st, q))}" target="_blank" rel="noopener">${esc(st.name)}</a>`).join('')}</div>
    <div class="field"><label>Enlace del producto</label><input id="p-url" value="${esc(v.url || '')}" placeholder="https://…"></div>
    <div class="field"><label>Nombre / modelo</label><input id="p-name" value="${esc(v.name || '')}" placeholder="Ej.: Sofá KIVIK 3 plazas gris"></div>
    <div class="row"><div class="field" style="flex:1"><label>Tienda</label><select id="p-store"><option value="">—</option>${STORES.map((st) => `<option value="${st.id}" ${v.store === st.id ? 'selected' : ''}>${esc(st.name)}</option>`).join('')}<option value="otra" ${v.store === 'otra' ? 'selected' : ''}>Otra</option></select></div>
      <div class="field" style="flex:1"><label>Precio (€)</label><input id="p-price" type="number" inputmode="decimal" value="${v.price || ''}"></div></div>
    <div class="row" style="margin-bottom:10px"><button class="btn" id="p-photo">Subir foto</button><button class="btn" id="p-paste">Pegar imagen</button><span class="muted small" id="p-photo-st">${v.fileId ? 'Foto añadida ✓' : ''}</span></div>
    <div class="row"><button class="btn primary" id="p-save">Vincular producto</button>${pr ? '<button class="btn" id="p-cancel">Cancelar</button>' : ''}</div>`;
  let fileId = v.fileId || '';
  $('#p-url', box).onchange = (e) => { const g = guessStore(e.target.value); if (g) $('#p-store', box).value = g; };
  const setPhoto = async (blob) => { fileId = await db.putFile(blob); $('#p-photo-st', box).textContent = 'Foto añadida ✓'; };
  $('#p-photo', box).onclick = async () => { const [f] = await pickFiles('image/*', false); if (f) setPhoto(f); };
  $('#p-paste', box).onclick = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) { const t = it.types.find((x) => x.startsWith('image/')); if (t) { await setPhoto(await it.getType(t)); return; } }
      toast('No hay ninguna imagen copiada. En la web de la tienda: clic derecho en la foto → Copiar imagen.', 5000);
    } catch { toast('Tu navegador no deja pegar imágenes aquí: usa "Subir foto".', 5000); }
  };
  const c = $('#p-cancel', box); if (c) c.onclick = () => { delete box.dataset.editing; renderProductBox(box, o); };
  $('#p-save', box).onclick = () => {
    const name = $('#p-name', box).value.trim(), url = $('#p-url', box).value.trim();
    if (!name && !url && !fileId) return toast('Pon al menos el nombre, el enlace o una foto del producto');
    delete box.dataset.editing;
    editor.update(() => { o.product = { name, url, store: $('#p-store', box).value, price: Number($('#p-price', box).value) || 0, fileId }; });
    toast('Producto vinculado');
  };
}

function renderInspector(side, sel) {
  const o = sel.obj;
  if (sel.kind === 'item') {
    side.innerHTML = `<div class="inspector"><h3>${esc(o.label)}</h3>
      <div id="i-product" class="product-box top"></div>
      <h3>Medidas y posición</h3>
      <div class="field"><label>Nombre</label><input id="i-label" value="${esc(o.label)}"></div>
      <div class="row"><div class="field" style="flex:1"><label>Ancho (cm)</label><input id="i-w" type="number" value="${o.w}"></div>
      <div class="field" style="flex:1"><label>Fondo (cm)</label><input id="i-d" type="number" value="${o.d}"></div></div>
      <div class="field"><label>Nivel</label><select id="i-level"><option value="baja" ${o.level !== 'alta' ? 'selected' : ''}>Planta baja</option><option value="alta" ${o.level === 'alta' ? 'selected' : ''}>Altillo (nivel alto)</option></select></div>
      <div class="field"><label>Giro: <b id="i-rotv">${o.rot || 0}°</b></label><input id="i-rotr" type="range" min="0" max="345" step="15" value="${o.rot || 0}"></div>
      <div class="row"><button class="btn" id="i-rot">Girar 90°</button><button class="btn" id="i-dup">Duplicar</button><button class="btn danger" id="i-del">Borrar</button></div></div>`;
    renderProductBox($('#i-product'), o);
    $('#i-label').onchange = (e) => editor.update(() => { o.label = e.target.value; });
    $('#i-w').onchange = (e) => editor.update(() => { o.w = Math.max(5, Number(e.target.value) || o.w); });
    $('#i-d').onchange = (e) => editor.update(() => { o.d = Math.max(5, Number(e.target.value) || o.d); });
    $('#i-level').onchange = (e) => editor.update(() => { o.level = e.target.value; });
    $('#i-rot').onclick = () => editor.update(() => { o.rot = ((o.rot || 0) + 90) % 360; });
    $('#i-rotr').oninput = (e) => { $('#i-rotv').textContent = e.target.value + '°'; o.rot = Number(e.target.value); editor.render(); };
    $('#i-rotr').onchange = (e) => editor.update(() => { o.rot = Number(e.target.value); });
    $('#i-dup').onclick = () => editor.duplicateSelected();
    $('#i-del').onclick = () => editor.removeSelected();
  } else if (sel.kind === 'wall') {
    const len = Math.round(Math.hypot(o.x2 - o.x1, o.y2 - o.y1));
    side.innerHTML = `<div class="inspector"><h3>Pared</h3>
      <div class="field"><label>Longitud (cm)</label><input id="w-len" type="number" value="${len}"></div>
      <div class="field"><label>Tipo</label><select id="w-t">${[[8, 'Tabique fino (8 cm)'], [12, 'Tabique (12 cm)'], [20, 'Muro (20 cm)'], [30, 'Muro de carga (30 cm)']].map(([v, l]) => `<option value="${v}" ${(o.t || 12) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <p class="muted small">Arrastra la pared para moverla en paralelo; las paredes unidas se ajustan.</p>
      <button class="btn danger" id="w-del">Borrar pared</button></div>`;
    $('#w-len').onchange = (e) => editor.setWallLength(o, Number(e.target.value));
    $('#w-t').onchange = (e) => editor.update(() => { o.t = Number(e.target.value); });
    $('#w-del').onclick = () => editor.removeSelected();
  } else if (sel.kind === 'opening') {
    side.innerHTML = `<div class="inspector"><h3>Hueco</h3>
      <div class="field"><label>Tipo</label><select id="o-type">${[['puerta', 'Puerta'], ['corredera', 'Puerta corredera'], ['ventana', 'Ventana'], ['entrada', 'Entrada']].map(([k, v]) => `<option value="${k}" ${o.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label>Ancho (cm)</label><input id="o-w" type="number" value="${o.w}"></div>
      <p class="muted small">Arrástralo para moverlo a lo largo de la pared.</p>
      ${o.type === 'puerta' || o.type === 'corredera' || o.type === 'entrada' ? '<div class="row" style="margin-bottom:10px"><button class="btn" id="o-flip">Cambiar bisagra</button><button class="btn" id="o-out">Abrir hacia el otro lado</button></div>' : ''}
      <button class="btn danger" id="o-del">Borrar</button></div>`;
    $('#o-type').onchange = (e) => editor.update(() => { o.type = e.target.value; });
    $('#o-w').onchange = (e) => editor.update(() => { o.w = Math.max(30, Number(e.target.value) || o.w); });
    $('#o-del').onclick = () => editor.removeSelected();
    const fl = $('#o-flip'); if (fl) fl.onclick = () => editor.update(() => { o.flip = !o.flip; });
    const ou = $('#o-out'); if (ou) ou.onclick = () => editor.update(() => { o.out = !o.out; });
  } else if (o.kind && o.kind !== 'ink' && o.kind !== 'text') {
    const names = { line: 'Línea', arrow: 'Flecha', dim: 'Cota', rect: 'Zona', circle: 'Círculo' };
    const cols = ['#C0392B', '#185FA5', '#1f1f1d', '#0F6E56', '#444441'];
    const len = 'x1' in o ? Math.round(Math.hypot(o.x2 - o.x1, o.y2 - o.y1)) : o.kind === 'rect' ? `${o.w} × ${o.h}` : `Ø ${o.r * 2}`;
    side.innerHTML = `<div class="inspector"><h3>${names[o.kind]}</h3>
      <p class="small">Medida: <b>${len} cm</b></p>
      <div class="swatches" style="margin-bottom:12px">${cols.map((c) => `<button class="swatch ${c === o.color ? 'on' : ''}" style="background:${c}" data-c="${c}" aria-label="Color"></button>`).join('')}</div>
      <label class="small" style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><input type="checkbox" id="s-dash" ${o.dash ? 'checked' : ''}> Línea discontinua</label>
      ${o.kind === 'rect' || o.kind === 'circle' ? `<label class="small" style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><input type="checkbox" id="s-fill" ${o.fill ? 'checked' : ''}> Relleno suave</label>` : ''}
      <div class="row"><button class="btn" id="s-dup">Duplicar</button><button class="btn danger" id="s-del">Borrar</button></div></div>`;
    side.querySelector('.swatches').onclick = (e) => { const b = e.target.closest('[data-c]'); if (b) editor.update(() => { o.color = b.dataset.c; }); };
    $('#s-dash').onchange = (e) => editor.update(() => { o.dash = e.target.checked; });
    const sf = $('#s-fill'); if (sf) sf.onchange = (e) => editor.update(() => { o.fill = e.target.checked; });
    $('#s-dup').onclick = () => editor.duplicateSelected();
    $('#s-del').onclick = () => editor.removeSelected();
  } else {
    side.innerHTML = `<div class="inspector"><h3>Nota</h3>
      ${o.kind === 'text' ? `<div class="field"><label>Texto</label><textarea id="n-text">${esc(o.text)}</textarea></div>` : '<p class="muted small">Nota a mano. Arrástrala para moverla.</p>'}
      <button class="btn danger" id="n-del">Borrar nota</button></div>`;
    const t = $('#n-text'); if (t) t.onchange = (e) => editor.update(() => { o.text = e.target.value; });
    $('#n-del').onclick = () => editor.removeSelected();
  }
}

// ---------- renders
let rstate = { view: 'fondo', customView: '', photo: true, styleRef: '', selected: '', instruction: '' };

async function renderRenders() {
  const p = current;
  if (!p.plan) p.plan = emptyPlan(p.width, p.length);
  const s = db.getSettings();
  const auto = autoReady();
  if (rstate.styleRef && !p.renders.some((r) => r.id === rstate.styleRef)) rstate.styleRef = '';
  if (rstate.selected && !p.renders.some((r) => r.id === rstate.selected)) rstate.selected = '';
  const hasPhoto = rstate.photo && p.photos.length > 0;
  const prompt = renderPrompt(p, { view: rstate.view, customView: rstate.customView, hasPhoto, hasStyleRef: !!rstate.styleRef });
  const gallery = await Promise.all(p.renders.map(async (r) => `<div class="render-card ${r.id === rstate.selected ? 'sel' : ''}" data-id="${r.id}">
      <img src="${await db.fileURL(r.fileId)}" alt="" data-view="${r.id}">
      <div class="meta"><input data-caption="${r.id}" value="${esc(r.caption || '')}" placeholder="Título del render">
        <span class="badge ${r.source === 'auto' ? '' : 'manual'}">${r.source === 'auto' ? 'IA' : 'Subido'}</span></div>
      <div class="meta"><button class="btn" data-sel="${r.id}">${r.id === rstate.selected ? 'Seleccionado' : 'Corregir'}</button>
        <button class="btn" data-dl="${r.id}" aria-label="Descargar">⬇</button><button class="btn danger" data-rm="${r.id}" aria-label="Borrar">✕</button></div></div>`));
  const selR = p.renders.find((r) => r.id === rstate.selected);
  view.innerHTML = `<div class="page">
    <div class="mode-banner ${auto ? 'auto' : ''}">
      <b>${auto ? 'Modo automático' : 'Modo manual'}</b>
      <span class="small">${auto ? `Los renders se generan aquí con ${esc(providerLabel())}.` : 'Preparo el prompt y el plano; tú los pegas en Gemini o ChatGPT y subes aquí el resultado.'}</span>
      <button class="btn" id="chg-mode" style="margin-left:auto">Cambiar modo</button>
    </div>
    <div class="split">
      <div class="panel">
        <h3 style="margin-top:0">1 · Nuevo render</h3>
        <div class="form">
          <div class="field"><label>Vista</label><select id="r-view">${Object.entries(VIEWS).map(([k, v]) => `<option value="${k}" ${k === rstate.view ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="field"><label>Referencia de estilo</label><select id="r-ref"><option value="">Ninguna</option>${p.renders.map((r, i) => `<option value="${r.id}" ${r.id === rstate.styleRef ? 'selected' : ''}>${esc(r.caption || 'Render ' + (i + 1))}</option>`).join('')}</select></div>
          ${rstate.view === 'libre' ? `<div class="field full"><label>Describe la vista</label><input id="r-custom" value="${esc(rstate.customView)}" placeholder="Ej.: desde el altillo mirando hacia el salón"></div>` : ''}
          <div class="field full"><label><input type="checkbox" id="r-photo" ${rstate.photo ? 'checked' : ''} ${p.photos.length ? '' : 'disabled'}> Usar la foto principal como base ${p.photos.length ? '' : '(no hay fotos en la ficha)'}</label></div>
        </div>
        <p class="muted small">Imágenes que acompañan al prompt, en este orden: ${[hasPhoto && 'foto principal', 'plano', rstate.styleRef && 'render de referencia', ...productRefs(p).withPhoto.map((it) => 'foto de ' + it.label.toLowerCase())].filter(Boolean).join(' → ')}.</p>
        <textarea class="prompt-box" id="r-prompt">${esc(prompt)}</textarea>
        <div class="row" style="margin-top:12px">
          ${auto ? '<button class="btn primary" id="r-gen">Generar render</button>' : `
            <button class="btn primary" id="r-share">Compartir imágenes</button>
            <button class="btn" id="r-copy">Copiar prompt</button>
            <button class="btn" id="r-files">Descargar imágenes</button>
            <a class="btn" href="https://gemini.google.com/app" target="_blank" rel="noopener">Abrir Gemini</a>
            <a class="btn" href="https://chatgpt.com/" target="_blank" rel="noopener">Abrir ChatGPT</a>`}
        </div>
        ${auto ? '' : '<p class="muted small">En el iPad: "Compartir imágenes" las envía juntas a la app de Gemini o ChatGPT; luego pega el prompt.</p>'}
        <h3>2 · Corregir un render</h3>
        ${selR ? `<p class="small">Corrigiendo: <b>${esc(selR.caption || 'render seleccionado')}</b>. Pide un cambio cada vez: sale mucho mejor.</p>
          <div class="field"><textarea id="r-instr" placeholder="Ej.: pon la lavadora a la izquierda, el fregadero en el centro y la nevera a la derecha">${esc(rstate.instruction)}</textarea></div>
          <div class="row" style="margin-top:10px">${auto ? '<button class="btn primary" id="r-edit">Aplicar corrección</button>' : '<button class="btn primary" id="r-edit-share">Compartir render</button><button class="btn" id="r-edit-copy">Copiar prompt de corrección</button>'}</div>`
          : '<p class="muted small">Pulsa "Corregir" en un render de la galería.</p>'}
      </div>
      <div>
        <div class="row" style="justify-content:space-between;margin-bottom:10px"><h3 style="margin:0">Galería (${p.renders.length})</h3>
          <button class="btn" id="r-upload">+ Subir render</button></div>
        <div class="gallery" id="gallery">${gallery.join('') || '<p class="muted">Aún no hay renders.</p>'}</div>
      </div>
    </div></div>`;

  $('#chg-mode').onclick = openSettings;
  $('#r-view').onchange = (e) => { rstate.view = e.target.value; renderRenders(); };
  $('#r-ref').onchange = (e) => { rstate.styleRef = e.target.value; renderRenders(); };
  const rc = $('#r-custom'); if (rc) rc.onchange = (e) => { rstate.customView = e.target.value; renderRenders(); };
  $('#r-photo').onchange = (e) => { rstate.photo = e.target.checked; renderRenders(); };
  const instr = $('#r-instr'); if (instr) instr.oninput = (e) => { rstate.instruction = e.target.value; };

  const inputImages = async () => {
    const files = [];
    if (hasPhoto) files.push(await db.getFile(p.photos[0]));
    files.push(await planPNG(p.plan, { title: p.name, subtitle: `${fmtM(p.width)} × ${fmtM(p.length)} m · arriba: fondo · abajo: entrada` }));
    if (rstate.styleRef) files.push(await db.getFile(p.renders.find((r) => r.id === rstate.styleRef).fileId));
    for (const it of productRefs(p).withPhoto) { const b = await db.getFile(it.product.fileId); if (b) files.push(b); }
    return files;
  };
  const names = [hasPhoto && 'foto', 'plano', rstate.styleRef && 'referencia', ...productRefs(p).withPhoto.map((it) => slug(it.label))].filter(Boolean);
  const asFiles = (blobs) => blobs.map((b, i) => new File([b], `${i + 1}-${names[i] || 'imagen'}.${(b.type || '').includes('png') ? 'png' : 'jpg'}`, { type: b.type || 'image/jpeg' }));

  if (!auto) {
    $('#r-copy').onclick = () => copy($('#r-prompt').value);
    $('#r-files').onclick = async () => asFiles(await inputImages()).forEach((f) => download(f, f.name));
    $('#r-share').onclick = async () => {
      const text = $('#r-prompt').value;
      try { await navigator.clipboard.writeText(text); } catch { /* sin permiso */ }
      const ok = await shareFiles(asFiles(await inputImages()), '');
      toast(ok ? 'Prompt copiado: pégalo en Gemini o ChatGPT junto a las imágenes' : 'Tu navegador no permite compartir: descarga las imágenes y copia el prompt', 5000);
    };
  } else {
    $('#r-gen').onclick = async (e) => {
      const b = e.currentTarget; b.disabled = true; b.innerHTML = '<span class="spinner"></span> Generando (20–60 s)…';
      try {
        const blob = await generateImage($('#r-prompt').value, await inputImages(), '16:9');
        await addRender(blob, { source: 'auto', prompt: $('#r-prompt').value, caption: VIEWS[rstate.view] });
        toast('Render listo');
      } catch (err) { toast('Error: ' + err.message, 7000); }
      renderRenders();
    };
  }
  if (selR) {
    const ep = () => editPrompt(rstate.instruction || '(describe aquí el cambio)');
    if (auto) {
      $('#r-edit').onclick = async (e) => {
        if (!rstate.instruction.trim()) return toast('Escribe qué quieres cambiar');
        const b = e.currentTarget; b.disabled = true; b.innerHTML = '<span class="spinner"></span> Aplicando…';
        try {
          const blob = await generateImage(ep(), [await db.getFile(selR.fileId)], '16:9');
          const r = await addRender(blob, { source: 'auto', prompt: ep(), caption: (selR.caption || 'Render') + ' (corregido)' });
          rstate.selected = r.id; rstate.instruction = '';
          toast('Corrección aplicada');
        } catch (err) { toast('Error: ' + err.message, 7000); }
        renderRenders();
      };
    } else {
      $('#r-edit-copy').onclick = () => copy(ep());
      $('#r-edit-share').onclick = async () => {
        try { await navigator.clipboard.writeText(ep()); } catch { /* sin permiso */ }
        const blob = await db.getFile(selR.fileId);
        const ok = await shareFiles([new File([blob], 'render.jpg', { type: blob.type })], '');
        if (!ok) download(blob, 'render.jpg');
        toast('Prompt de corrección copiado', 4000);
      };
    }
  }
  $('#r-upload').onclick = async () => {
    const files = await pickFiles('image/*', true);
    for (const f of files) await addRender(f, { source: 'manual', caption: VIEWS[rstate.view] });
    renderRenders();
  };
  $('#gallery').onclick = async (e) => {
    const t = e.target;
    if (t.dataset.sel) { rstate.selected = rstate.selected === t.dataset.sel ? '' : t.dataset.sel; renderRenders(); }
    else if (t.dataset.dl) { const r = p.renders.find((x) => x.id === t.dataset.dl); download(await db.getFile(r.fileId), `${slug(p.name)}-${slug(r.caption)}.jpg`); }
    else if (t.dataset.rm) {
      if (!(await confirmDlg('¿Borrar este render?', 'Borrar'))) return;
      const r = p.renders.find((x) => x.id === t.dataset.rm); p.renders = p.renders.filter((x) => x !== r);
      await db.deleteFile(r.fileId); await db.saveProject(p); renderRenders();
    } else if (t.dataset.view) {
      const r = p.renders.find((x) => x.id === t.dataset.view);
      dialog(`<img src="${await db.fileURL(r.fileId)}" alt="">`, { cls: 'viewer' });
    }
  };
  $$('[data-caption]').forEach((inp) => inp.onchange = () => { const r = p.renders.find((x) => x.id === inp.dataset.caption); r.caption = inp.value; save(); });
}

async function addRender(blob, meta) {
  const fileId = await db.putFile(blob);
  const r = { id: db.uid(), fileId, createdAt: Date.now(), ...meta };
  current.renders.unshift(r);
  await db.saveProject(current);
  return r;
}

// ---------- vídeo
let vstate = { picked: null, vertical: false, music: true, plan: true, move: 'avance', lastVideo: null, withVideo: true };
async function renderVideo() {
  const p = current;
  if (!vstate.picked) vstate.picked = p.renders.slice(0, 4).map((r) => r.id);
  vstate.picked = vstate.picked.filter((id) => p.renders.some((r) => r.id === id));
  const items = await Promise.all(p.renders.map(async (r) => `<label class="${vstate.picked.includes(r.id) ? 'on' : ''}"><input type="checkbox" data-pick="${r.id}" ${vstate.picked.includes(r.id) ? 'checked' : ''}><img src="${await db.fileURL(r.fileId)}" alt=""></label>`));
  const s = db.getSettings();
  view.innerHTML = `<div class="page"><div class="split">
    <div class="panel">
      <h3 style="margin-top:0">Vídeo de presentación</h3>
      <p class="muted small">Montaje con los renders elegidos, movimiento de cámara suave, rótulos, el plano y música sin derechos. Se crea en el propio iPad.</p>
      ${p.renders.length ? `<div class="checklist" id="picks">${items.join('')}</div>` : '<p>Primero añade renders en la pestaña Renders.</p>'}
      <div class="form" style="margin-top:14px">
        <div class="field"><label>Título</label><input id="v-title" value="${esc(p.name)}"></div>
        <div class="field"><label>Subtítulo</label><input id="v-sub" value="${esc(`Propuesta de reforma · ${fmtM(p.width)} × ${fmtM(p.length)} m`)}"></div>
        <div class="field"><label>Formato</label><select id="v-fmt"><option value="h">Horizontal 16:9</option><option value="v" ${vstate.vertical ? 'selected' : ''}>Vertical 9:16 (WhatsApp, Instagram)</option></select></div>
        <div class="field"><label>Opciones</label><label class="small"><input type="checkbox" id="v-music" ${vstate.music ? 'checked' : ''}> Música</label><label class="small"><input type="checkbox" id="v-plan" ${vstate.plan ? 'checked' : ''}> Incluir plano</label></div>
      </div>
      <div class="row" style="margin-top:14px"><button class="btn" id="v-preview">Vista previa</button><button class="btn primary" id="v-make" ${p.renders.length ? '' : 'disabled'}>Crear vídeo</button></div>
      <div class="progress" style="margin-top:12px"><div id="v-prog"></div></div>
      <div class="row" id="v-out" style="margin-top:12px"></div>
      ${shoppingListHTML(p)}
      <h3>Presentación para el cliente</h3>
      <p class="muted small">Un único archivo con los renders elegidos, el plano y los datos del proyecto. Se abre en cualquier móvil sin instalar nada: envíalo por WhatsApp o email.</p>
      <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="p-video" ${vstate.withVideo ? 'checked' : ''} ${vstate.lastVideo ? '' : 'disabled'}> Incluir el vídeo ${vstate.lastVideo ? `(${(vstate.lastVideo.size / 1e6).toFixed(1)} MB)` : '(crea primero el vídeo)'}</label>
      <div class="row" style="margin-top:10px"><button class="btn dark" id="p-make" ${p.renders.length ? '' : 'disabled'}>Crear presentación</button></div>
    </div>
    <div>
      <canvas id="v-canvas" class="video-stage ${vstate.vertical ? 'vertical' : ''}" width="${vstate.vertical ? 1080 : 1920}" height="${vstate.vertical ? 1920 : 1080}"></canvas>
      <div class="panel" style="margin-top:16px">
        <h3 style="margin-top:0">Recorrido con IA (Veo, Kling)</h3>
        <p class="muted small">Para un vídeo en el que la cámara se mueve dentro del espacio, sube un render a Gemini (Veo) o Kling con este prompt.</p>
        <div class="field"><label>Movimiento de cámara</label><select id="v-move">${Object.entries(CAMERA_MOVES).map(([k, v]) => `<option value="${k}" ${k === vstate.move ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <textarea class="prompt-box" style="min-height:110px" id="v-prompt">${esc(videoPrompt(vstate.move))}</textarea>
        <div class="row" style="margin-top:10px"><button class="btn" id="v-copy">Copiar prompt</button><a class="btn" href="https://gemini.google.com/app" target="_blank" rel="noopener">Abrir Gemini</a><a class="btn" href="https://app.klingai.com/" target="_blank" rel="noopener">Abrir Kling</a></div>
      </div>
    </div></div></div>`;
  const picks = $('#picks');
  if (picks) picks.onchange = (e) => {
    const id = e.target.dataset.pick; if (!id) return;
    vstate.picked = e.target.checked ? [...vstate.picked, id] : vstate.picked.filter((x) => x !== id);
    e.target.closest('label').classList.toggle('on', e.target.checked);
  };
  $('#v-fmt').onchange = (e) => { vstate.vertical = e.target.value === 'v'; renderVideo(); };
  $('#v-music').onchange = (e) => (vstate.music = e.target.checked);
  $('#v-plan').onchange = (e) => (vstate.plan = e.target.checked);
  $('#v-move').onchange = (e) => { vstate.move = e.target.value; $('#v-prompt').value = videoPrompt(vstate.move); };
  $('#v-copy').onclick = () => copy($('#v-prompt').value);
  $('#p-video').onchange = (e) => (vstate.withVideo = e.target.checked);
  fillShoppingThumbs(p);
  const csv = $('#shop-csv'); if (csv) csv.onclick = () => {
    const rows = [['Pieza', 'Producto', 'Tienda', 'Precio (€)', 'Enlace'], ...productItems(p).map((it) => [it.label, it.product.name, storeName(it.product.store), String(it.product.price || '').replace('.', ','), it.product.url])];
    const text = '\ufeff' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    download(new Blob([text], { type: 'text/csv' }), `${slug(p.name)}-lista-de-compra.csv`);
  };
  $('#p-make').onclick = async (e) => {
    if (!vstate.picked.length) return toast('Elige al menos un render');
    const b = e.currentTarget; b.disabled = true; b.innerHTML = '<span class="spinner"></span> Preparando…';
    try {
      const slides = [];
      for (const id of vstate.picked) { const r = p.renders.find((x) => x.id === id); slides.push({ blob: await db.getFile(r.fileId), caption: r.caption }); }
      const html = await buildPresentation({
        project: p, slides, studio: s.studioName, roomLabel: ROOM_TYPES[p.roomType],
        size: `${fmtM(p.width)} × ${fmtM(p.length)} m${p.width && p.length ? ` (${Math.round(p.width * p.length / 1e4)} m²)` : ''}`,
        planBlob: vstate.plan && p.plan ? await planPNG(p.plan, { title: p.name, subtitle: `${fmtM(p.width)} × ${fmtM(p.length)} m` }) : null,
        videoBlob: vstate.withVideo ? vstate.lastVideo : null,
        products: await Promise.all(productItems(p).map(async (it) => ({ label: it.label, ...it.product, storeLabel: storeName(it.product.store), blob: it.product.fileId ? await db.getFile(it.product.fileId) : null }))),
      });
      const file = new File([html], `${slug(p.name)}-propuesta.html`, { type: 'text/html' });
      if (!(await shareFiles([file], p.name))) download(file, file.name);
      toast('Presentación lista');
    } catch (err) { toast('No se pudo crear: ' + err.message, 6000); }
    b.disabled = false; b.textContent = 'Crear presentación';
  };
  const canvas = $('#v-canvas');

  const timeline = async () => {
    const slides = [];
    for (const id of vstate.picked) {
      const r = p.renders.find((x) => x.id === id);
      slides.push({ img: await createImageBitmap(await db.getFile(r.fileId)), caption: r.caption || '' });
    }
    const planImg = vstate.plan && p.plan ? await createImageBitmap(await planPNG(p.plan, { title: p.name, subtitle: `${fmtM(p.width)} × ${fmtM(p.length)} m` })) : null;
    return buildTimeline({ title: $('#v-title').value, subtitle: $('#v-sub').value, slides, planImg, studio: s.studioName, vertical: vstate.vertical });
  };
  const ctx = canvas.getContext('2d');
  if (p.renders.length) timeline().then((tl) => drawFrame(ctx, tl, 1.5));

  $('#v-preview').onclick = async () => {
    if (!vstate.picked.length) return toast('Elige al menos un render');
    const tl = await timeline(); const start = performance.now();
    const tick = () => { const t = (performance.now() - start) / 1000; drawFrame(ctx, tl, Math.min(t, tl.total - 0.01)); $('#v-prog').style.width = `${Math.min(100, t / tl.total * 100)}%`; if (t < tl.total && document.body.contains(canvas)) requestAnimationFrame(tick); };
    tick();
  };
  $('#v-make').onclick = async (e) => {
    if (!vstate.picked.length) return toast('Elige al menos un render');
    const b = e.currentTarget; b.disabled = true; b.innerHTML = '<span class="spinner"></span> Grabando…';
    try {
      const tl = await timeline();
      const blob = await recordVideo(canvas, tl, { music: vstate.music, onProgress: (x) => ($('#v-prog').style.width = `${x * 100}%`) });
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const name = `${slug(p.name)}-presentacion.${ext}`;
      const out = $('#v-out');
      out.innerHTML = `<button class="btn primary" id="v-dl">Descargar vídeo (${(blob.size / 1e6).toFixed(1)} MB)</button><button class="btn" id="v-share">Compartir</button>`;
      vstate.lastVideo = blob;
      const pv = $('#p-video'); pv.disabled = false; pv.checked = true; vstate.withVideo = true; pv.parentElement.lastChild.textContent = ` Incluir el vídeo (${(blob.size / 1e6).toFixed(1)} MB)`;
      $('#v-dl').onclick = () => download(blob, name);
      $('#v-share').onclick = async () => { if (!(await shareFiles([new File([blob], name, { type: blob.type })], p.name))) download(blob, name); };
      toast('Vídeo listo');
    } catch (err) { toast('No se pudo grabar el vídeo: ' + err.message, 6000); }
    b.disabled = false; b.textContent = 'Crear vídeo';
  };
}

// ---------- lista de compra (productos reales vinculados en el plano)
const productItems = (p) => (p.plan?.items || []).filter((it) => it.product);
function shoppingListHTML(p) {
  const items = productItems(p);
  if (!items.length) return '<h3>Lista de compra</h3><p class="muted small">Vincula productos reales a los muebles en el plano (selecciona una pieza → "Producto real") y aquí verás la lista con el total.</p>';
  const total = items.reduce((a, it) => a + (Number(it.product.price) || 0), 0);
  return `<h3>Lista de compra</h3><table class="shop-list"><tbody>${items.map((it) => `<tr><td><img data-thumb="${it.product.fileId || ''}" alt=""></td><td><b>${esc(it.product.name || it.label)}</b><br><span class="muted small">${esc(it.label)} · ${esc(storeName(it.product.store))}</span></td><td class="num">${it.product.price ? fmtEUR(it.product.price) : '—'}</td><td>${it.product.url ? `<a href="${esc(it.product.url)}" target="_blank" rel="noopener">↗</a>` : ''}</td></tr>`).join('')}
    <tr><td></td><td><b>Total</b></td><td class="num"><b>${fmtEUR(total)}</b></td><td></td></tr></tbody></table>
    <div class="row" style="margin-top:8px"><button class="btn" id="shop-csv">Descargar lista (Excel/CSV)</button></div>`;
}
async function fillShoppingThumbs() {
  for (const img of $$('img[data-thumb]')) { if (img.dataset.thumb) img.src = await db.fileURL(img.dataset.thumb); else img.remove(); }
}

// ---------- ajustes
function openSettings() {
  const s = db.getSettings();
  const d = dialog(`<form class="dlg" method="dialog"><h3>Ajustes</h3>
    <div class="field"><label>Modo de render</label>
      <div class="chips"><label class="chip ${s.mode === 'manual' ? 'on' : ''}"><input type="radio" name="mode" value="manual" ${s.mode === 'manual' ? 'checked' : ''} hidden> Manual (Gemini / ChatGPT, sin coste)</label>
      <label class="chip ${s.mode === 'auto' ? 'on' : ''}"><input type="radio" name="mode" value="auto" ${s.mode === 'auto' ? 'checked' : ''} hidden> Automático (Gemini o ChatGPT)</label></div></div>
    <div id="auto-opts" ${s.mode === 'auto' ? '' : 'hidden'}>
      <div class="field"><label>Servicio para los renders</label>
        <div class="chips"><label class="chip ${s.provider !== 'openai' ? 'on' : ''}"><input type="radio" name="provider" value="gemini" ${s.provider !== 'openai' ? 'checked' : ''} hidden> Gemini (Nano Banana)</label>
        <label class="chip ${s.provider === 'openai' ? 'on' : ''}"><input type="radio" name="provider" value="openai" ${s.provider === 'openai' ? 'checked' : ''} hidden> ChatGPT Images (OpenAI)</label></div></div>
      <div id="openai-opts" ${s.provider === 'openai' ? '' : 'hidden'}>
        <div class="field"><label>Clave de API de OpenAI</label><input name="openaiKey" type="password" value="${esc(s.openaiKey)}" placeholder="sk-…" autocomplete="off">
          <span class="muted small">Se crea en platform.openai.com → API keys. Es de pago por uso y va aparte de la suscripción ChatGPT Plus. Se guarda solo en este dispositivo.</span></div>
        <div class="form">
          <div class="field"><label>Modelo</label><input name="openaiModel" value="${esc(s.openaiModel)}"></div>
          <div class="field"><label>Calidad</label><select name="openaiQuality">${[['low', 'Baja (pruebas, muy barata)'], ['medium', 'Media'], ['high', 'Alta (para el cliente)']].map(([k, v]) => `<option value="${k}" ${s.openaiQuality === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        </div>
        <p class="muted small">La propuesta automática de distribución usa Gemini: si quieres esa función, añade también la clave de Gemini.</p>
      </div>
      <div class="field"><label>Clave de API de Gemini</label><input name="apiKey" type="password" value="${esc(s.apiKey)}" placeholder="AIza…" autocomplete="off">
        <span class="muted small">Se guarda solo en este dispositivo. Consíguela en aistudio.google.com. Alternativa más segura: la función de Supabase (abajo).</span></div>
      <div class="form">
        <div class="field"><label>Modelo de imagen</label><input name="imageModel" value="${esc(s.imageModel)}"></div>
        <div class="field"><label>Modelo de texto</label><input name="textModel" value="${esc(s.textModel)}"></div>
        <div class="field"><label>URL función Supabase (opcional)</label><input name="proxyUrl" value="${esc(s.proxyUrl)}" placeholder="https://xxxx.supabase.co/functions/v1/gemini"></div>
        <div class="field"><label>Clave anon de Supabase</label><input name="proxyToken" type="password" value="${esc(s.proxyToken)}"></div>
      </div>
    </div>
    <h3>Sincronización entre dispositivos (Supabase)</h3>
    <div class="form">
      <div class="field"><label>URL del proyecto Supabase</label><input name="supabaseUrl" value="${esc(s.supabaseUrl)}" placeholder="https://xxxx.supabase.co"></div>
      <div class="field"><label>Clave anon</label><input name="supabaseAnon" type="password" value="${esc(s.supabaseAnon)}"></div>
    </div>
    <div id="sync-auth" style="margin-top:10px">${sync.session() ? `<div class="row"><span class="small">Sesión iniciada: <b>${esc(sync.session().email)}</b></span><button type="button" class="btn" id="s-out">Cerrar sesión</button></div>`
      : `<div class="form"><div class="field"><label>Email</label><input name="sEmail" type="email" autocomplete="username"></div><div class="field"><label>Contraseña</label><input name="sPass" type="password" autocomplete="current-password"></div></div>
        <div class="row" style="margin-top:8px"><button type="button" class="btn dark" id="s-in">Entrar</button><button type="button" class="btn" id="s-up">Crear cuenta</button></div>`}</div>
    <div class="field" style="margin-top:12px"><label>Nombre del estudio (sale en el vídeo y la presentación)</label><input name="studioName" value="${esc(s.studioName)}"></div>
    <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn" value="cancel">Cancelar</button><button class="btn primary" value="ok">Guardar</button></div></form>`);
  const f = $('form', d);
  f.onchange = () => {
    $$('.chip', f).forEach((c) => c.classList.toggle('on', $('input', c).checked));
    $('#auto-opts', f).hidden = f.elements.mode.value !== 'auto';
    $('#openai-opts', f).hidden = f.elements.provider.value !== 'openai';
  };
  const keepSync = () => { const n = db.getSettings(); n.supabaseUrl = f.elements.supabaseUrl.value.trim(); n.supabaseAnon = f.elements.supabaseAnon.value.trim(); db.setSettings(n); };
  const authAct = async (fn, okMsg) => {
    keepSync();
    if (!sync.configured()) return toast('Pon primero la URL y la clave anon de Supabase');
    try {
      const r = await fn(f.elements.sEmail.value.trim(), f.elements.sPass.value);
      if (r === false) { toast('Cuenta creada: confirma el email que te ha llegado y luego pulsa Entrar', 7000); return; }
      toast(okMsg); d.close(); openSettings();
      sync.syncNow(setSyncStatus).then((x) => { toast(x.msg); if (!current) renderHome(); }).catch((e) => toast('Sincronización: ' + e.message, 6000));
    } catch (e) { toast(e.message, 6000); }
  };
  const bIn = $('#s-in', f), bUp = $('#s-up', f), bOut = $('#s-out', f);
  if (bIn) bIn.onclick = () => authAct(sync.signIn, 'Sesión iniciada');
  if (bUp) bUp.onclick = () => authAct(sync.signUp, 'Cuenta creada');
  if (bOut) bOut.onclick = () => { sync.signOut(); toast('Sesión cerrada'); d.close(); openSettings(); };
  d.onclose = () => {
    if (d.returnValue !== 'ok') return;
    const n = { ...db.getSettings() };
    ['apiKey', 'imageModel', 'textModel', 'proxyUrl', 'proxyToken', 'studioName', 'supabaseUrl', 'supabaseAnon', 'openaiKey', 'openaiModel', 'openaiQuality'].forEach((k) => (n[k] = f.elements[k].value.trim()));
    n.provider = f.elements.provider.value;
    n.mode = f.elements.mode.value;
    db.setSettings(n);
    const missing = n.mode === 'auto' && (n.provider === 'openai' ? !n.openaiKey : !n.apiKey && !n.proxyUrl);
    toast(missing ? `Modo automático: falta la clave de ${n.provider === 'openai' ? 'OpenAI' : 'Gemini'}` : 'Ajustes guardados');
    route();
  };
}

// ---------- exportar / importar proyecto (con imágenes)
async function exportProject() {
  const p = current;
  const ids = [...p.photos, ...p.renders.map((r) => r.fileId), ...(p.plan?.items || []).map((it) => it.product?.fileId).filter(Boolean)];
  const files = {};
  for (const id of ids) {
    const b = await db.getFile(id); if (!b) continue;
    files[id] = { type: b.type, data: await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(b); }) };
  }
  download(new Blob([JSON.stringify({ app: 'estudiorender', version: 1, project: p, files })], { type: 'application/json' }), `${slug(p.name)}.estudiorender.json`);
}
async function importProject() {
  const [f] = await pickFiles('.json,application/json', false); if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (data.app !== 'estudiorender') throw new Error('No es un proyecto de EstudioRender');
    const map = {};
    for (const [oldId, fd] of Object.entries(data.files || {})) {
      const bin = atob(fd.data); const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      map[oldId] = await db.putFile(new Blob([arr], { type: fd.type }));
    }
    const p = data.project;
    p.id = db.uid();
    p.photos = p.photos.map((id) => map[id]).filter(Boolean);
    p.renders = p.renders.map((r) => ({ ...r, fileId: map[r.fileId] })).filter((r) => r.fileId);
    (p.plan?.items || []).forEach((it) => { if (it.product?.fileId) it.product.fileId = map[it.product.fileId] || ''; });
    await db.saveProject(p);
    toast('Proyecto importado'); renderHome();
  } catch (e) { toast('No se pudo importar: ' + e.message, 5000); }
}

// ---------- arranque
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
route();
if (sync.loggedIn() && navigator.onLine) sync.syncNow(setSyncStatus).then((r) => { if (!current && (r.down || r.del)) renderHome(); }).catch((e) => setSyncStatus('Sin sincronizar: ' + e.message));
