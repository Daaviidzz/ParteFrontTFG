// Configuracion global y helpers de formato

const CONFIG = {
  API_BASE:   'http://localhost:8000',
  GITHUB_URL: 'https://github.com/ibermon',
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
  const fallbackSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Ccircle cx='48' cy='48' r='44' fill='%231a1a2e' stroke='%232a2a4a' stroke-width='2'/%3E%3Ctext x='48' y='55' text-anchor='middle' font-size='24' fill='%234d5d80'%3E?%3C/text%3E%3C/svg%3E`;
  return `<img src="${src}" alt="${alt}" class="${className}" onerror="this.src='${fallbackSvg}'">`;
}
