// Sincronización con Supabase (sin SDK): sesión por email, tabla "projects" y bucket "estudiorender".
import * as db from './db.js';

const SESSION_KEY = 'estudiorender.session';
const UPLOADED_KEY = 'estudiorender.uploaded';
const BUCKET = 'estudiorender';

const ls = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* nada */ } },
};

function cfg() {
  const s = db.getSettings();
  return { url: (s.supabaseUrl || '').replace(/\/+$/, ''), anon: s.supabaseAnon || '' };
}
export const configured = () => { const c = cfg(); return !!(c.url && c.anon); };
export const session = () => ls.get(SESSION_KEY, null);
export const loggedIn = () => configured() && !!session();

async function authCall(path, body) {
  const c = cfg();
  const r = await fetch(`${c.url}/auth/v1/${path}`, { method: 'POST', headers: { apikey: c.anon, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.msg || data.error_description || data.message || `Error ${r.status}`);
  return data;
}

function store(data) {
  if (!data.access_token) throw new Error('Revisa tu email para confirmar la cuenta y vuelve a entrar.');
  ls.set(SESSION_KEY, { access: data.access_token, refresh: data.refresh_token, exp: Date.now() + (data.expires_in || 3600) * 1000, email: data.user?.email, uid: data.user?.id });
}

export async function signIn(email, password) { store(await authCall('token?grant_type=password', { email, password })); }
export async function signUp(email, password) {
  const d = await authCall('signup', { email, password });
  if (d.access_token) store(d);
  return !!d.access_token;
}
export function signOut() { ls.del(SESSION_KEY); ls.del(UPLOADED_KEY); }

async function token() {
  const s = session(); if (!s) throw new Error('No has iniciado sesión');
  if (Date.now() > s.exp - 60000) {
    try { store(await authCall('token?grant_type=refresh_token', { refresh_token: s.refresh })); }
    catch (e) { signOut(); throw new Error('La sesión ha caducado: vuelve a entrar.'); }
  }
  return session().access;
}

async function api(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const c = cfg();
  const r = await fetch(`${c.url}${path}`, {
    method,
    headers: { apikey: c.anon, Authorization: `Bearer ${await token()}`, ...(body && !(body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body instanceof Blob ? body : body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`${r.status} ${t.slice(0, 160)}`);
  }
  if (raw) return r;
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

const fileIds = (p) => [...(p.photos || []), ...(p.renders || []).map((r) => r.fileId)];

async function uploadFiles(p, uploaded) {
  const uid = session().uid;
  for (const id of fileIds(p)) {
    if (uploaded[id]) continue;
    const blob = await db.getFile(id); if (!blob) continue;
    await api(`/storage/v1/object/${BUCKET}/${uid}/${id}`, { method: 'POST', body: blob, headers: { 'x-upsert': 'true', 'Content-Type': blob.type || 'application/octet-stream' } });
    uploaded[id] = 1; ls.set(UPLOADED_KEY, uploaded);
  }
}

async function downloadFiles(p, uploaded) {
  const uid = session().uid;
  for (const id of fileIds(p)) {
    if (await db.getFile(id)) continue;
    const r = await api(`/storage/v1/object/authenticated/${BUCKET}/${uid}/${id}`, { raw: true });
    await db.putFileWithId(id, await r.blob());
    uploaded[id] = 1;
  }
  ls.set(UPLOADED_KEY, uploaded);
}

let running = null;
export function syncNow(onStatus = () => {}) {
  if (running) return running;
  running = (async () => {
    if (!loggedIn()) throw new Error('Configura Supabase e inicia sesión en Ajustes');
    onStatus('Sincronizando…');
    const uploaded = ls.get(UPLOADED_KEY, {});
    const remote = await api('/rest/v1/projects?select=id,updated_at,deleted');
    const rmap = new Map(remote.map((r) => [r.id, r]));
    const local = await db.listProjects();
    const lmap = new Map(local.map((p) => [p.id, p]));
    let up = 0, down = 0, del = 0;
    for (const p of local) {
      const r = rmap.get(p.id);
      if (r?.deleted) { await db.deleteProject(p); del++; continue; }
      if (!r || p.updatedAt > Number(r.updated_at)) {
        await uploadFiles(p, uploaded);
        await api('/rest/v1/projects?on_conflict=id', { method: 'POST', body: [{ id: p.id, data: p, updated_at: p.updatedAt, deleted: false }], headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
        up++;
      }
    }
    for (const r of remote) {
      if (r.deleted) continue;
      const l = lmap.get(r.id);
      if (!l || Number(r.updated_at) > l.updatedAt) {
        const [row] = await api(`/rest/v1/projects?id=eq.${encodeURIComponent(r.id)}&select=data`);
        await downloadFiles(row.data, uploaded);
        await db.putProjectRaw(row.data);
        down++;
      }
    }
    const msg = `Sincronizado: ${up} subidos, ${down} descargados${del ? `, ${del} borrados` : ''}`;
    onStatus(msg);
    return { up, down, del, msg };
  })().finally(() => { running = null; });
  return running;
}

export async function markDeleted(id) {
  if (!loggedIn()) return;
  try { await api(`/rest/v1/projects?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: { deleted: true, updated_at: Date.now() }, headers: { Prefer: 'return=minimal' } }); }
  catch { /* se reintentará al sincronizar */ }
}

// Sincronización automática tras cambios (con espera para agrupar ediciones)
let autoTimer = null;
export function scheduleAutoSync(onStatus) {
  if (!loggedIn()) return;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => { if (navigator.onLine) syncNow(onStatus).catch((e) => onStatus('Sin sincronizar: ' + e.message)); }, 8000);
}
