// Biblioteca de piezas (medidas en cm). "cat" agrupa en el selector.
export const ROOM_TYPES = {
  bano: 'Baño',
  dormitorio: 'Dormitorio',
  cocina: 'Cocina',
  loft: 'Apartamento / loft',
  salon: 'Salón',
  otro: 'Otro',
};

export const CATALOG = [
  // Baño
  { type: 'inodoro', label: 'Inodoro', w: 38, d: 65, cat: 'Baño', rooms: ['bano', 'loft'] },
  { type: 'lavabo', label: 'Lavabo', w: 60, d: 45, cat: 'Baño', rooms: ['bano', 'loft'] },
  { type: 'lavabo2', label: 'Lavabo doble', w: 120, d: 45, cat: 'Baño', rooms: ['bano'] },
  { type: 'ducha', label: 'Plato de ducha', w: 120, d: 80, cat: 'Baño', rooms: ['bano', 'loft'] },
  { type: 'banera', label: 'Bañera', w: 170, d: 75, cat: 'Baño', rooms: ['bano'] },
  { type: 'bide', label: 'Bidé', w: 38, d: 55, cat: 'Baño', rooms: ['bano'] },
  // Dormitorio
  { type: 'cama150', label: 'Cama 150', w: 160, d: 210, cat: 'Dormitorio', rooms: ['dormitorio', 'loft'] },
  { type: 'cama90', label: 'Cama 90', w: 100, d: 200, cat: 'Dormitorio', rooms: ['dormitorio'] },
  { type: 'mesilla', label: 'Mesilla', w: 45, d: 40, cat: 'Dormitorio', rooms: ['dormitorio', 'loft'] },
  { type: 'armario', label: 'Armario', w: 180, d: 60, cat: 'Dormitorio', rooms: ['dormitorio', 'loft'] },
  // Cocina
  { type: 'modulo', label: 'Módulo bajo 60', w: 60, d: 60, cat: 'Cocina', rooms: ['cocina', 'loft'] },
  { type: 'fregadero', label: 'Fregadero', w: 80, d: 60, cat: 'Cocina', rooms: ['cocina', 'loft'] },
  { type: 'placa', label: 'Placa', w: 60, d: 60, cat: 'Cocina', rooms: ['cocina', 'loft'] },
  { type: 'nevera', label: 'Nevera', w: 60, d: 65, cat: 'Cocina', rooms: ['cocina', 'loft'] },
  { type: 'lavadora', label: 'Lavadora', w: 60, d: 60, cat: 'Cocina', rooms: ['cocina', 'loft', 'bano'] },
  { type: 'isla', label: 'Isla', w: 180, d: 90, cat: 'Cocina', rooms: ['cocina', 'loft'] },
  { type: 'encimera', label: 'Encimera', w: 240, d: 60, cat: 'Cocina', rooms: ['cocina', 'loft'] },
  // Salón
  { type: 'sofa', label: 'Sofá', w: 210, d: 90, cat: 'Salón', rooms: ['salon', 'loft'] },
  { type: 'mesacentro', label: 'Mesa de centro', w: 100, d: 55, cat: 'Salón', rooms: ['salon', 'loft'] },
  { type: 'alfombra', label: 'Alfombra', w: 200, d: 140, cat: 'Salón', rooms: ['salon', 'loft', 'dormitorio'] },
  { type: 'muebletv', label: 'Mueble TV', w: 180, d: 40, cat: 'Salón', rooms: ['salon', 'loft'] },
  { type: 'comedor', label: 'Mesa comedor', w: 140, d: 80, cat: 'Salón', rooms: ['salon', 'loft', 'cocina'] },
  { type: 'escritorio', label: 'Escritorio', w: 110, d: 55, cat: 'Salón', rooms: ['salon', 'loft', 'dormitorio'] },
  { type: 'silla', label: 'Silla', w: 45, d: 45, cat: 'Salón', rooms: ['salon', 'loft', 'cocina', 'dormitorio'] },
  // Más baño
  { type: 'muebleLavabo', label: 'Mueble de lavabo', w: 80, d: 46, cat: 'Baño', rooms: ['bano', 'loft'] },
  { type: 'ducha140', label: 'Ducha 140×80', w: 140, d: 80, cat: 'Baño', rooms: ['bano', 'loft'] },
  { type: 'mampara', label: 'Mampara fija', w: 90, d: 4, cat: 'Baño', rooms: ['bano', 'loft'] },
  { type: 'banera_exenta', label: 'Bañera exenta', w: 170, d: 80, cat: 'Baño', rooms: ['bano'] },
  { type: 'toallero', label: 'Toallero / radiador', w: 50, d: 10, cat: 'Baño', rooms: ['bano', 'loft'] },
  { type: 'columnaBano', label: 'Columna de baño', w: 35, d: 30, cat: 'Baño', rooms: ['bano'] },
  // Más dormitorio
  { type: 'cama135', label: 'Cama 135', w: 145, d: 200, cat: 'Dormitorio', rooms: ['dormitorio', 'loft'] },
  { type: 'cama180', label: 'Cama 180', w: 190, d: 210, cat: 'Dormitorio', rooms: ['dormitorio', 'loft'] },
  { type: 'litera', label: 'Litera', w: 100, d: 200, cat: 'Dormitorio', rooms: ['dormitorio'] },
  { type: 'cuna', label: 'Cuna', w: 66, d: 126, cat: 'Dormitorio', rooms: ['dormitorio'] },
  { type: 'comoda', label: 'Cómoda', w: 120, d: 48, cat: 'Dormitorio', rooms: ['dormitorio', 'loft'] },
  { type: 'tocador', label: 'Tocador', w: 100, d: 45, cat: 'Dormitorio', rooms: ['dormitorio'] },
  { type: 'vestidor', label: 'Vestidor (módulo)', w: 100, d: 60, cat: 'Dormitorio', rooms: ['dormitorio', 'loft'] },
  // Más cocina
  { type: 'lavavajillas', label: 'Lavavajillas', w: 60, d: 60, cat: 'Cocina', rooms: ['cocina', 'loft'] },
  { type: 'horno', label: 'Columna horno', w: 60, d: 60, cat: 'Cocina', rooms: ['cocina', 'loft'] },
  { type: 'neveraAmericana', label: 'Nevera americana', w: 91, d: 72, cat: 'Cocina', rooms: ['cocina'] },
  { type: 'campana', label: 'Campana', w: 90, d: 50, cat: 'Cocina', rooms: ['cocina', 'loft'] },
  { type: 'taburete', label: 'Taburete', w: 40, d: 40, cat: 'Cocina', rooms: ['cocina', 'loft'] },
  { type: 'despensa', label: 'Despensa', w: 60, d: 60, cat: 'Cocina', rooms: ['cocina'] },
  // Más salón y comedor
  { type: 'chaise', label: 'Sofá chaise longue', w: 270, d: 160, cat: 'Salón', rooms: ['salon', 'loft'] },
  { type: 'sofa2', label: 'Sofá 2 plazas', w: 160, d: 88, cat: 'Salón', rooms: ['salon', 'loft', 'dormitorio'] },
  { type: 'sillon', label: 'Sillón / butaca', w: 80, d: 80, cat: 'Salón', rooms: ['salon', 'loft', 'dormitorio'] },
  { type: 'mesaRedonda', label: 'Mesa redonda', w: 110, d: 110, cat: 'Salón', rooms: ['salon', 'loft', 'cocina'] },
  { type: 'mesa6', label: 'Mesa 6 personas', w: 180, d: 90, cat: 'Salón', rooms: ['salon', 'loft'] },
  { type: 'estanteria', label: 'Estantería', w: 120, d: 35, cat: 'Salón', rooms: ['salon', 'loft', 'dormitorio'] },
  { type: 'aparador', label: 'Aparador', w: 160, d: 45, cat: 'Salón', rooms: ['salon', 'loft'] },
  { type: 'lampara', label: 'Lámpara de pie', w: 40, d: 40, cat: 'Salón', rooms: ['salon', 'loft', 'dormitorio'] },
  { type: 'planta', label: 'Planta', w: 50, d: 50, cat: 'Salón', rooms: ['salon', 'loft', 'dormitorio', 'bano', 'cocina'] },
  { type: 'chimenea', label: 'Chimenea', w: 120, d: 40, cat: 'Salón', rooms: ['salon', 'loft'] },
  { type: 'piano', label: 'Piano', w: 150, d: 60, cat: 'Salón', rooms: ['salon'] },
  // Exterior
  { type: 'tumbona', label: 'Tumbona', w: 70, d: 190, cat: 'Exterior', rooms: ['otro', 'salon'] },
  { type: 'mesaJardin', label: 'Mesa de jardín', w: 160, d: 90, cat: 'Exterior', rooms: ['otro'] },
  { type: 'piscina', label: 'Piscina', w: 800, d: 400, cat: 'Exterior', rooms: ['otro'] },
  // Estructura
  { type: 'escalera', label: 'Escalera', w: 90, d: 220, cat: 'Estructura', rooms: ['loft', 'otro'] },
  { type: 'escalerademano', label: 'Escalera de mano', w: 50, d: 20, cat: 'Estructura', rooms: ['loft'] },
  { type: 'altillo', label: 'Altillo', w: 500, d: 240, cat: 'Estructura', rooms: ['loft'] },
  { type: 'escalones', label: 'Escalones', w: 100, d: 140, cat: 'Estructura', rooms: ['loft', 'otro'] },
  { type: 'pilar', label: 'Pilar', w: 30, d: 30, cat: 'Estructura', rooms: ['loft', 'otro', 'salon'] },
  { type: 'zona', label: 'Zona / estancia', w: 200, d: 200, cat: 'Estructura', rooms: ['loft', 'otro', 'salon', 'cocina', 'bano', 'dormitorio'] },
];

export const byType = (t) => CATALOG.find((c) => c.type === t);

// Colores por categoría (relleno, borde)
export const CAT_COLORS = {
  'Baño': ['#9FE1CB', '#0F6E56'],
  'Dormitorio': ['#D3D1C7', '#5F5E5A'],
  'Cocina': ['#F5C4B3', '#993C1D'],
  'Salón': ['#E6E2D6', '#5F5E5A'],
  'Estructura': ['#CECBF6', '#534AB7'],
  'Exterior': ['#C0DD97', '#3B6D11'],
};

// Símbolo interior simple (SVG) para cada pieza, en coordenadas locales (0..w, 0..d)
export function symbol(type, w, d) {
  const s = (x) => Math.round(x * 10) / 10;
  switch (type) {
    case 'inodoro': return `<ellipse cx="${s(w / 2)}" cy="${s(d * 0.6)}" rx="${s(w * 0.4)}" ry="${s(d * 0.32)}" class="sym"/><rect x="${s(w * 0.1)}" y="0" width="${s(w * 0.8)}" height="${s(d * 0.2)}" class="sym"/>`;
    case 'lavabo': case 'lavabo2': case 'fregadero': {
      const n = type === 'lavabo2' ? 2 : 1;
      let o = '';
      for (let i = 0; i < n; i++) o += `<ellipse cx="${s(w * (i + 0.5) / n)}" cy="${s(d * 0.55)}" rx="${s(w * 0.3 / n)}" ry="${s(d * 0.28)}" class="sym"/>`;
      return o;
    }
    case 'ducha': return `<line x1="0" y1="0" x2="${w}" y2="${d}" class="sym"/><line x1="${w}" y1="0" x2="0" y2="${d}" class="sym"/><circle cx="${s(w / 2)}" cy="${s(d / 2)}" r="4" class="sym"/>`;
    case 'banera': return `<rect x="${s(w * 0.06)}" y="${s(d * 0.12)}" width="${s(w * 0.88)}" height="${s(d * 0.76)}" rx="${s(d * 0.3)}" class="sym"/>`;
    case 'cama150': case 'cama90': {
      const p = type === 'cama150' ? 2 : 1;
      let o = `<line x1="0" y1="${s(d * 0.22)}" x2="${w}" y2="${s(d * 0.22)}" class="sym"/>`;
      for (let i = 0; i < p; i++) o += `<rect x="${s(w * (0.08 + i * 0.5))}" y="${s(d * 0.04)}" width="${s(w * (p === 2 ? 0.36 : 0.8))}" height="${s(d * 0.13)}" rx="6" class="sym"/>`;
      return o;
    }
    case 'mesaRedonda': case 'planta': case 'lampara':
      return `<ellipse cx="${s(w / 2)}" cy="${s(d / 2)}" rx="${s(w * (type === 'mesaRedonda' ? 0.48 : 0.35))}" ry="${s(d * (type === 'mesaRedonda' ? 0.48 : 0.35))}" class="sym"/>`;
    case 'muebleLavabo': return `<ellipse cx="${s(w / 2)}" cy="${s(d * 0.55)}" rx="${s(w * 0.25)}" ry="${s(d * 0.28)}" class="sym"/>`;
    case 'ducha140': return `<line x1="0" y1="0" x2="${w}" y2="${d}" class="sym"/><line x1="${w}" y1="0" x2="0" y2="${d}" class="sym"/>`;
    case 'banera_exenta': return `<ellipse cx="${s(w / 2)}" cy="${s(d / 2)}" rx="${s(w * 0.46)}" ry="${s(d * 0.4)}" class="sym"/>`;
    case 'cama135': case 'cama180': return `<line x1="0" y1="${s(d * 0.22)}" x2="${w}" y2="${s(d * 0.22)}" class="sym"/><rect x="${s(w * 0.08)}" y="${s(d * 0.04)}" width="${s(w * 0.36)}" height="${s(d * 0.13)}" rx="6" class="sym"/><rect x="${s(w * 0.56)}" y="${s(d * 0.04)}" width="${s(w * 0.36)}" height="${s(d * 0.13)}" rx="6" class="sym"/>`;
    case 'chaise': return `<rect x="0" y="0" width="${w}" height="${s(d * 0.18)}" class="sym"/><rect x="${s(w * 0.62)}" y="0" width="${s(w * 0.38)}" height="${d}" class="sym"/>`;
    case 'sofa2': case 'sillon': return `<rect x="0" y="0" width="${w}" height="${s(d * 0.28)}" class="sym"/><rect x="0" y="0" width="${s(w * 0.14)}" height="${d}" class="sym"/><rect x="${s(w * 0.86)}" y="0" width="${s(w * 0.14)}" height="${d}" class="sym"/>`;
    case 'lavavajillas': return `<line x1="${s(w * 0.2)}" y1="${s(d * 0.85)}" x2="${s(w * 0.8)}" y2="${s(d * 0.85)}" class="sym"/>`;
    case 'tumbona': return `<rect x="0" y="0" width="${w}" height="${s(d * 0.3)}" class="sym"/>`;
    case 'placa': return [0.3, 0.7].flatMap((x) => [0.3, 0.7].map((y) => `<circle cx="${s(w * x)}" cy="${s(d * y)}" r="${s(Math.min(w, d) * 0.15)}" class="sym"/>`)).join('');
    case 'lavadora': return `<circle cx="${s(w / 2)}" cy="${s(d / 2)}" r="${s(Math.min(w, d) * 0.35)}" class="sym"/>`;
    case 'nevera': return `<line x1="0" y1="${s(d * 0.85)}" x2="${w}" y2="${s(d * 0.85)}" class="sym"/>`;
    case 'sofa': return `<rect x="0" y="0" width="${w}" height="${s(d * 0.28)}" class="sym"/><rect x="0" y="0" width="${s(w * 0.1)}" height="${d}" class="sym"/><rect x="${s(w * 0.9)}" y="0" width="${s(w * 0.1)}" height="${d}" class="sym"/>`;
    case 'escalera': case 'escalones': {
      let o = ''; const n = type === 'escalera' ? 12 : 5;
      for (let i = 1; i < n; i++) o += `<line x1="0" y1="${s(d * i / n)}" x2="${w}" y2="${s(d * i / n)}" class="sym"/>`;
      return o + (type === 'escalera' ? `<line x1="${s(w / 2)}" y1="${s(d * 0.95)}" x2="${s(w / 2)}" y2="${s(d * 0.08)}" class="sym arrow"/>` : '');
    }
    case 'escalerademano': return `<line x1="${s(w * 0.15)}" y1="0" x2="${s(w * 0.15)}" y2="${d}" class="sym"/><line x1="${s(w * 0.85)}" y1="0" x2="${s(w * 0.85)}" y2="${d}" class="sym"/>`;
    case 'altillo': return `<line x1="0" y1="0" x2="${w}" y2="${d}" class="sym dashed"/><line x1="${w}" y1="0" x2="0" y2="${d}" class="sym dashed"/>`;
    case 'pilar': return `<line x1="0" y1="0" x2="${w}" y2="${d}" class="sym"/><line x1="${w}" y1="0" x2="0" y2="${d}" class="sym"/>`;
    case 'silla': return `<rect x="0" y="0" width="${w}" height="${s(d * 0.18)}" class="sym"/>`;
    default: return '';
  }
}
