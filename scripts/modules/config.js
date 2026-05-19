// Configuracion global y helpers de formato

const CONFIG = {
  // Ruta relativa: nginx hace proxy a la API y evita problemas de CORS
  API_BASE:   '/api',
  GITHUB_URL: 'https://github.com/Daaviidzz/ParteFrontTFG',
};


const TIPOS = [
  'Fuego', 'Agua', 'Planta', 'Eléctrico', 'Normal', 'Psíquico',
  'Roca', 'Tierra', 'Hielo', 'Siniestro', 'Volador', 'Veneno',
  'Dragón', 'Acero', 'Bicho', 'Lucha', 'Fantasma',
];


// Devuelve el HTML del badge de tipo
function tipoBadge(tipo) {
  const map = {
    Fuego:      'tipo-Fuego',
    Agua:       'tipo-Agua',
    Planta:     'tipo-Planta',
    'Eléctrico':'tipo-Electrico',
    Normal:     'tipo-Normal',
    'Psíquico': 'tipo-Psiquico',
    Roca:       'tipo-Roca',
    Tierra:     'tipo-Tierra',
    Hielo:      'tipo-Hielo',
    Siniestro:  'tipo-Siniestro',
    Volador:    'tipo-Volador',
    Veneno:     'tipo-Veneno',
    'Dragón':   'tipo-Dragon',
    Acero:      'tipo-Acero',
    Bicho:      'tipo-Bicho',
    Lucha:      'tipo-Lucha',
    Fantasma:   'tipo-Fantasma',
  };
  return `<span class="badge-tipo ${map[tipo] || 'tipo-default'}">${tipo}</span>`;
}

// Segundos a "Xh YYm" o "Xm YYs"
function formatTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

// Formato Pokedex: 1 -> #001
function formatNum(n) {
  return '#' + String(n).padStart(3, '0');
}

// Clase CSS para la barra segun valor
function statColor(val) {
  if (val < 50)  return 'low';
  if (val < 80)  return 'mid';
  if (val < 110) return 'high';
  return 'vhigh';
}

// Colorea un JSON para el visor de la API
function syntaxHighlight(json) {
  if (typeof json !== 'string') json = JSON.stringify(json, null, 2);

  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    match => {
      let cls = 'json-num';
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'json-key' : 'json-str';
      } else if (/true|false/.test(match)) {
        cls = 'json-bool';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

// Img con fallback SVG si la url falla
function imgWithFallback(src, alt, className = '') {
  const fallbackSvg = 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r="44" fill="#1a1a2e" stroke="#2a2a4a" stroke-width="2"/><text x="48" y="55" text-anchor="middle" font-size="24" fill="#4d5d80">?</text></svg>`
  );
  const url = spriteUrl(src);
  return `<img src="${url || fallbackSvg}" alt="${alt}" class="${className}" onerror="this.onerror=null;this.src='${fallbackSvg}'">`;
}

// La API manda sprite_frontal; dejo tambien sprite por compatibilidad
function spriteUrl(ib, back = false) {
  if (!ib) return '';

  // Si ya es un string, lo trato como URL directa
  const raw = typeof ib === 'string'
    ? ib
    : (back
        ? (ib.sprite_trasero || ib.sprite || ib.sprite_frontal || '')
        : (ib.sprite_frontal || ib.sprite || ''));

  if (!raw) return '';

  // Rutas absolutas (PokeAPI CDN, etc.) se devuelven tal cual
  if (/^https?:\/\//i.test(raw)) return raw;

  // Sprites canonicos de PokeAPI: uso la version animada BW para recuperar movimiento.
  if (/^\d+\.png$/i.test(raw)) {
    const id = raw.replace(/\.png$/i, '');
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`;
  }

  if (/^back\/\d+\.png$/i.test(raw)) {
    const id = raw.replace(/^back\//i, '').replace(/\.png$/i, '');
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/back/${id}.gif`;
  }

  // Rutas relativas (sprites de iniciales en la API): /api/sprites/...
  return `${CONFIG.API_BASE}/sprites/${raw}`;
}
