// Construcción de prompts para renders (Gemini / ChatGPT) a partir de la ficha y el plano.
import { roomBounds as bounds, fmtM } from './plan.js';
import { ROOM_TYPES } from './catalog.js';

export const VIEWS = {
  fondo: 'Desde la entrada mirando al fondo',
  entrada: 'Desde el fondo mirando hacia la entrada',
  izquierda: 'Desde la pared derecha mirando a la izquierda',
  derecha: 'Desde la pared izquierda mirando a la derecha',
  aerea: 'Vista aérea 3D sin techo',
  libre: 'Otra (la describo yo)',
};

export const STYLES = [
  'Minimalista moderno, loft industrial',
  'Nórdico, luminoso y cálido',
  'Mediterráneo, materiales naturales',
  'Contemporáneo elegante',
  'Industrial con ladrillo visto',
  'Japandi, madera clara y tonos neutros',
  'Clásico renovado',
];

export const LIGHTS = {
  dia: 'luz natural suave de día entrando por las ventanas, mezclada con luz cálida de 3000 K',
  tarde: 'luz cálida de atardecer, ambiente acogedor con lámparas encendidas',
  noche: 'escena nocturna con iluminación artificial cálida, tiras LED indirectas y focos',
};

function side(plan) {
  const b = bounds(plan);
  const W = b.maxX - b.minX || 1, L = b.maxY - b.minY || 1;
  const horiz = (x) => (x < b.minX + W / 3 ? 'izquierda' : x > b.maxX - W / 3 ? 'derecha' : 'centro');
  const depth = (y) => (y < b.minY + L / 3 ? 'fondo' : y > b.maxY - L / 3 ? 'frente (zona de la entrada)' : 'zona media');
  return { b, W, L, horiz, depth };
}

function wallName(w, b) {
  const tol = 25;
  if (Math.abs(w.y1 - b.minY) < tol && Math.abs(w.y2 - b.minY) < tol) return 'la pared del fondo';
  if (Math.abs(w.y1 - b.maxY) < tol && Math.abs(w.y2 - b.maxY) < tol) return 'la fachada / pared de la entrada';
  if (Math.abs(w.x1 - b.minX) < tol && Math.abs(w.x2 - b.minX) < tol) return 'la pared izquierda';
  if (Math.abs(w.x1 - b.maxX) < tol && Math.abs(w.x2 - b.maxX) < tol) return 'la pared derecha';
  return 'un tabique interior';
}

const OPEN_NAMES = { puerta: 'una puerta', ventana: 'una ventana', corredera: 'una puerta corredera', entrada: 'la puerta de entrada' };

// Descripción en palabras de la distribución (vista desde la entrada mirando al fondo)
export function describePlan(plan) {
  const { b, W, L, horiz, depth } = side(plan);
  const lines = [];
  for (const it of plan.items) {
    const rot = it.rot || 0;
    const w = rot % 180 ? it.d : it.w, d = rot % 180 ? it.w : it.d;
    const cx = it.x + w / 2, cy = it.y + d / 2;
    const near = [];
    if (it.x - b.minX < 40) near.push('contra la pared izquierda');
    if (b.maxX - (it.x + w) < 40) near.push('contra la pared derecha');
    if (it.y - b.minY < 40) near.push('contra la pared del fondo');
    if (b.maxY - (it.y + d) < 40) near.push('contra la fachada');
    const pos = near.length ? near.join(' y ') : `en la ${depth(cy)}, ${horiz(cx) === 'centro' ? 'centrado' : 'hacia la ' + horiz(cx)}`;
    const lvl = it.level === 'alta' ? ' (en el altillo, a nivel superior)' : '';
    lines.push(`- ${it.label}${it.type === it.label ? '' : ''} de ${fmtM(w)} × ${fmtM(d)} m, ${pos}${lvl}.`);
  }
  for (const o of plan.openings) {
    const w = plan.walls.find((x) => x.id === o.wallId); if (!w) continue;
    const px = w.x1 + (w.x2 - w.x1) * o.t, py = w.y1 + (w.y2 - w.y1) * o.t;
    const wn = wallName(w, b);
    const where = wn.includes('fondo') || wn.includes('fachada') ? horiz(px) : depth(py);
    lines.push(`- ${OPEN_NAMES[o.type] || 'un hueco'} de ${fmtM(o.w)} m en ${wn}, ${where === 'centro' ? 'centrada' : 'hacia la ' + where}.`);
  }
  const texts = plan.notes.filter((n) => n.kind === 'text').map((n) => `- Nota del arquitecto en la ${depth(n.y)} ${horiz(n.x)}: "${n.text}".`);
  return { size: `${fmtM(W)} m de ancho × ${fmtM(L)} m de fondo`, lines, texts, hasInk: plan.notes.some((n) => n.kind === 'ink') };
}

// Piezas con producto real; las que tienen foto van como imagen de referencia (máximo 6)
export function productRefs(project, max = 6) {
  const items = (project.plan?.items || []).filter((it) => it.product && (it.product.name || it.product.fileId));
  const withPhoto = items.filter((it) => it.product.fileId).slice(0, max);
  const named = items.filter((it) => !withPhoto.includes(it));
  return { withPhoto, named };
}

export function renderPrompt(project, { view = 'fondo', customView = '', hasPhoto = true, hasStyleRef = false, useProducts = true } = {}) {
  const f = project;
  const d = describePlan(f.plan);
  const room = ROOM_TYPES[f.roomType] || 'espacio';
  const imgs = [];
  let n = 1;
  if (hasPhoto) imgs.push(`la imagen ${n++} (foto real del espacio actual) como base de perspectiva, proporciones y elementos fijos`);
  imgs.push(`la imagen ${n++} (plano a escala visto desde arriba; arriba es el fondo y abajo la entrada) como distribución obligatoria`);
  if (hasStyleRef) imgs.push(`la imagen ${n++} (render anterior del mismo proyecto) como referencia exacta de estilo, materiales, iluminación y mobiliario`);
  const refs = useProducts ? productRefs(f) : { withPhoto: [], named: [] };
  const prodLines = [];
  for (const it of refs.withPhoto) prodLines.push(`- ${it.label}: debe ser exactamente el producto de la imagen ${n++}${it.product.name ? ` (${it.product.name})` : ''}, con su forma, color y material.`);
  for (const it of refs.named) prodLines.push(`- ${it.label}: ${it.product.name}.`);
  if (refs.withPhoto.length) imgs.push(`las imágenes de productos reales como referencia del mobiliario elegido`);

  let viewTxt = '';
  if (view === 'fondo') viewTxt = 'Cámara situada en la entrada, a la altura de los ojos, mirando hacia el fondo. En la imagen, la pared izquierda del plano queda a la izquierda y la derecha a la derecha.' + (hasPhoto ? ' Mantén el mismo encuadre que la foto.' : '');
  else if (view === 'entrada') viewTxt = 'Cámara situada al fondo, a la altura de los ojos, mirando hacia la entrada. Al ser la vista contraria, la pared DERECHA del plano aparece a la IZQUIERDA de la imagen y la pared IZQUIERDA del plano aparece a la DERECHA de la imagen.';
  else if (view === 'izquierda') viewTxt = 'Cámara situada junto a la pared derecha, a la altura de los ojos, mirando hacia la pared izquierda; el fondo queda a la derecha de la imagen y la entrada a la izquierda.';
  else if (view === 'derecha') viewTxt = 'Cámara situada junto a la pared izquierda, a la altura de los ojos, mirando hacia la pared derecha; el fondo queda a la izquierda de la imagen y la entrada a la derecha.';
  else if (view === 'aerea') viewTxt = 'Vista aérea en 3D a vista de pájaro, en perspectiva isométrica, sin techo, mostrando toda la distribución como una maqueta fotorrealista.';
  else viewTxt = customView || 'Vista libre a la altura de los ojos.';

  const parts = [];
  parts.push(`Usando ${imgs.join(', y ')}, genera un render fotorrealista de interiorismo profesional de ${room.toLowerCase()} reformado.`);
  parts.push(`Medidas: ${d.size}${f.height ? `, altura libre de ${fmtM(f.height)} m` : ''}.`);
  parts.push(viewTxt);
  if (f.description) parts.push(`Lo que quiere el cliente: ${f.description.trim()}`);
  if (d.lines.length) parts.push(`Distribución según el plano (vista desde la entrada mirando al fondo):\n${d.lines.join('\n')}`);
  if (d.texts.length) parts.push(`Indicaciones escritas:\n${d.texts.join('\n')}`);
  if (prodLines.length) parts.push(`Mobiliario real elegido por el cliente:\n${prodLines.join('\n')}`);
  if (d.hasInk) parts.push('El plano incluye anotaciones a mano del arquitecto: tenlas en cuenta.');
  if (f.materials) parts.push(`Materiales y acabados: ${f.materials.trim()}.`);
  parts.push(`Techo: ${f.ceiling?.trim() || 'plano, liso y pintado en blanco'}. No inventes bóvedas, vigas de madera ni elementos que no estén en el plano.`);
  parts.push(`Estilo: ${f.style || STYLES[0]}. Iluminación: ${LIGHTS[f.light] || LIGHTS.dia}.`);
  parts.push('Respeta exactamente la posición y el tamaño de cada elemento del plano. Fotografía de arquitectura, lente 24 mm, alta resolución, sin texto, sin marcas de agua y sin personas.');
  return parts.join('\n\n');
}

export function editPrompt(instruction) {
  return `Edita esta imagen manteniendo exactamente igual la cámara, el encuadre, la iluminación, los materiales y todo el mobiliario. Cambia solo lo siguiente:\n\n${instruction.trim()}\n\nNo cambies nada más de la imagen. Fotografía de arquitectura, alta resolución, sin texto ni personas.`;
}

export const CAMERA_MOVES = {
  avance: 'la cámara avanza lentamente hacia el fondo del espacio',
  barrido: 'la cámara hace un barrido lateral lento de izquierda a derecha',
  subida: 'la cámara avanza y sube la mirada lentamente hacia la parte alta (altillo o techo)',
  orbita: 'la cámara hace un pequeño giro orbital alrededor del centro de la estancia',
};

export function videoPrompt(move = 'avance', seconds = 8) {
  return `Crea un vídeo de ${seconds} segundos a partir de esta imagen: ${CAMERA_MOVES[move] || CAMERA_MOVES.avance}. Movimiento suave y continuo como un gimbal profesional, iluminación estable, sin cambios en el mobiliario ni en los materiales, sin personas y sin texto.`;
}
