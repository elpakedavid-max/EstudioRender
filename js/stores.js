// Tiendas de muebles y equipamiento (España). La búsqueda usa Google limitado a la web de cada tienda,
// así funciona aunque la tienda cambie su buscador.
export const STORES = [
  { id: 'ikea', name: 'IKEA', domain: 'ikea.com/es' },
  { id: 'leroy', name: 'Leroy Merlin', domain: 'leroymerlin.es' },
  { id: 'kave', name: 'Kave Home', domain: 'kavehome.com' },
  { id: 'mdm', name: 'Maisons du Monde', domain: 'maisonsdumonde.com' },
  { id: 'zarahome', name: 'Zara Home', domain: 'zarahome.com' },
  { id: 'eci', name: 'El Corte Inglés', domain: 'elcorteingles.es' },
  { id: 'conforama', name: 'Conforama', domain: 'conforama.es' },
  { id: 'sklum', name: 'Sklum', domain: 'sklum.com' },
  { id: 'bauhaus', name: 'Bauhaus', domain: 'bauhaus.es' },
  { id: 'roca', name: 'Roca (baño)', domain: 'roca.es' },
  { id: 'porcelanosa', name: 'Porcelanosa', domain: 'porcelanosa.com' },
  { id: 'amazon', name: 'Amazon', url: (q) => `https://www.amazon.es/s?k=${encodeURIComponent(q)}` },
  { id: 'google', name: 'Google Shopping', url: (q) => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}` },
];

export function storeSearchURL(store, query) {
  if (store.url) return store.url(query);
  return `https://www.google.com/search?q=${encodeURIComponent(`${query} site:${store.domain}`)}`;
}

export const storeName = (id) => STORES.find((s) => s.id === id)?.name || id || '';

export function guessStore(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    const s = STORES.find((x) => x.domain && h.includes(x.domain.split('/')[0]));
    if (s) return s.id;
    if (h.includes('amazon.')) return 'amazon';
  } catch { /* enlace no válido */ }
  return '';
}

export const fmtEUR = (n) => (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
