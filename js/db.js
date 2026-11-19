// Almacenamiento local en IndexedDB: proyectos e imágenes (blobs).
const DB_NAME = 'estudiorender';
const DB_VERSION = 1;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
  });
}

const req2p = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export async function listProjects() {
  const all = await tx('projects', 'readonly', (s) => req2p(s.getAll()));
  return (all || []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id) {
  return tx('projects', 'readonly', (s) => req2p(s.get(id)));
}

export async function saveProject(p) {
  p.updatedAt = Date.now();
  await tx('projects', 'readwrite', (s) => req2p(s.put(p)));
  try { window.dispatchEvent(new Event('er-saved')); } catch { /* fuera del navegador */ }
  return p;
}

export async function deleteProject(p) {
  const ids = [...(p.photos || []), ...(p.renders || []).map((r) => r.fileId)].map((x) => (typeof x === 'string' ? x : x.fileId));
  await tx('files', 'readwrite', (s) => Promise.all(ids.map((id) => req2p(s.delete(id)))));
  await tx('projects', 'readwrite', (s) => req2p(s.delete(p.id)));
}

export async function putProjectRaw(p) {
  await tx('projects', 'readwrite', (s) => req2p(s.put(p)));
  return p;
}

export async function putFileWithId(id, blob) {
  await tx('files', 'readwrite', (s) => req2p(s.put({ id, blob, type: blob.type })));
  return id;
}

export async function putFile(blob) {
  const id = uid();
  await tx('files', 'readwrite', (s) => req2p(s.put({ id, blob, type: blob.type })));
  return id;
}

export async function getFile(id) {
  const rec = await tx('files', 'readonly', (s) => req2p(s.get(id)));
  return rec ? rec.blob : null;
}

export async function deleteFile(id) {
  await tx('files', 'readwrite', (s) => req2p(s.delete(id)));
}

const urlCache = new Map();
export async function fileURL(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  const blob = await getFile(id);
  if (!blob) return '';
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

// Ajustes (en localStorage, con try/catch por si el navegador lo bloquea)
const SETTINGS_KEY = 'estudiorender.settings';
const DEFAULT_SETTINGS = {
  mode: 'manual',            // 'manual' | 'auto'
  apiKey: '',                // clave de Gemini (modo automático, directo)
  proxyUrl: '',              // URL de la función de Supabase (alternativa segura a la clave)
  proxyToken: '',            // anon key de Supabase
  imageModel: 'gemini-3-pro-image',
  textModel: 'gemini-3-flash-preview',
  studioName: '',
  // Sincronización entre dispositivos (proyecto Supabase "estudiorender").
  // La clave anon es pública por diseño: el acceso está limitado por RLS a los proyectos de cada usuario.
  supabaseUrl: 'https://mbvryfdnrezzbrcjjixl.supabase.co',
  supabaseAnon: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1idnJ5ZmRucmV6emJyY2pqaXhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwNDA3MDksImV4cCI6MjExMDYxNjcwOX0.VJtmyCBB8hGrojMcCXEo4oPGR-XQqQ-TGCsCfaIG9UM',
};
export function getSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const out = { ...DEFAULT_SETTINGS, ...saved };
    if (!out.supabaseUrl) out.supabaseUrl = DEFAULT_SETTINGS.supabaseUrl;
    if (!out.supabaseAnon) out.supabaseAnon = DEFAULT_SETTINGS.supabaseAnon;
    return out;
  } catch { return { ...DEFAULT_SETTINGS }; }
}
export function setSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* sin almacenamiento */ }
}
