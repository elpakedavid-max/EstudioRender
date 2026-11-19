// Modo automático: llamadas a la API de Gemini (directas con clave o a través de la función de Supabase).
import { getSettings } from './db.js';
import { CATALOG } from './catalog.js';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';

export function autoReady() {
  const s = getSettings();
  return s.mode === 'auto' && (s.apiKey || s.proxyUrl);
}

export async function blobToBase64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(s);
}

// Reduce imágenes grandes antes de enviarlas (ahorra tiempo y coste)
export async function shrink(blob, max = 1536) {
  try {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && blob.size < 1.5e6) return blob;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
  } catch { return blob; }
}

async function call(model, body) {
  try { return await callRaw(model, body); }
  catch (e) {
    if (e instanceof TypeError) throw new Error('No hay conexión con Gemini. Revisa internet, la clave o la URL de la función.');
    throw e;
  }
}

async function callRaw(model, body) {
  const s = getSettings();
  let res;
  if (s.proxyUrl) {
    res = await fetch(s.proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(s.proxyToken ? { Authorization: `Bearer ${s.proxyToken}`, apikey: s.proxyToken } : {}) },
      body: JSON.stringify({ model, body }),
    });
  } else if (s.apiKey) {
    res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.apiKey },
      body: JSON.stringify(body),
    });
  } else {
    throw new Error('Falta configurar la clave de Gemini en Ajustes.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function imagePart(blob) {
  const small = await shrink(blob);
  return { inline_data: { mime_type: small.type || 'image/jpeg', data: await blobToBase64(small) } };
}

// Genera o edita una imagen. images: array de Blob en el orden que cita el prompt.
export async function generateImage(prompt, images = [], aspectRatio = '16:9') {
  const s = getSettings();
  const parts = [{ text: prompt }];
  for (const b of images) parts.push(await imagePart(b));
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio } },
  };
  const data = await call(s.imageModel, body);
  const outParts = data?.candidates?.[0]?.content?.parts || [];
  const img = outParts.find((p) => p.inlineData || p.inline_data);
  if (!img) {
    const txt = outParts.map((p) => p.text).filter(Boolean).join(' ');
    throw new Error(txt ? `El modelo no devolvió imagen: ${txt.slice(0, 200)}` : 'El modelo no devolvió ninguna imagen. Prueba de nuevo o cambia el prompt.');
  }
  const inl = img.inlineData || img.inline_data;
  const bin = atob(inl.data);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: inl.mimeType || inl.mime_type || 'image/png' });
}

// Propuesta automática de distribución a partir de la ficha (devuelve piezas para el plano)
export async function proposeLayout(project, planImage, photos = []) {
  const s = getSettings();
  const W = project.width || 500, L = project.length || 700;
  const catalog = CATALOG.map((c) => `${c.type} (${c.label}, ${c.w}x${c.d} cm)`).join('; ');
  const openings = project.plan.openings.map((o) => {
    const w = project.plan.walls.find((x) => x.id === o.wallId);
    return w ? `${o.type} de ${o.w} cm en el muro (${w.x1},${w.y1})-(${w.x2},${w.y2}) al ${Math.round(o.t * 100)}%` : '';
  }).filter(Boolean).join('; ');
  const text = `Eres un arquitecto de interiores. Propón la distribución de mobiliario para este espacio.
Coordenadas en centímetros: x de 0 (pared izquierda) a ${W} (pared derecha); y de 0 (pared del fondo) a ${L} (fachada/entrada). Altura ${project.height || 'desconocida'} cm.
Tipo de estancia: ${project.roomType}. Lo que quiere el cliente: ${project.description || 'sin indicar'}.
Huecos existentes: ${openings || 'ninguno indicado'}.
La primera imagen es el plano actual, que puede tener anotaciones a mano del arquitecto: léelas y respétalas. Las siguientes (si hay) son fotos del espacio.
Usa solo estos tipos: ${catalog}.
Reglas: piezas dentro del espacio, sin solaparse salvo alfombras y zonas, dejando pasos de al menos 70 cm; "rot" solo 0, 90, 180 o 270; x,y es la esquina superior izquierda de la pieza sin girar; "level" es "baja" o "alta" (alta solo para cosas sobre un altillo).
Responde SOLO con JSON: {"items":[{"type":"...","label":"...","x":0,"y":0,"w":0,"d":0,"rot":0,"level":"baja"}],"notes":"explicación breve en español"}`;
  const parts = [{ text }];
  if (planImage) parts.push(await imagePart(planImage));
  for (const p of photos.slice(0, 3)) parts.push(await imagePart(p));
  const data = await call(s.textModel, {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
  });
  const raw = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  const json = JSON.parse(raw.replace(/^```json|```$/g, '').trim());
  return json;
}
