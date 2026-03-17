/**
 * scripts/modules/config.js — Configuración global y funciones de utilidad
 *
 * Aquí centralizo todo lo que es "configuración" del frontend:
 * la URL de la API, la URL de GitHub, y las funciones de utilidad
 * que se usan en múltiples páginas (formatear números, colores, etc.)
 *
 * Si en algún momento cambio la URL de la API (por ejemplo, de
 * localhost a un servidor en producción), solo toco este archivo.
 * Es como tener las constantes en un solo sitio en Java o Python.
 */


// Configuración principal
// API_BASE es la URL base de la API de Python.
//   - En desarrollo local: 'http://localhost:8000'
//   - Con Docker + nginx: '/api' (el proxy redirige internamente)
const CONFIG = {
  API_BASE:   'http://localhost:8000',
  GITHUB_URL: 'https://github.com/ibermon',  // Actualiza con la URL real del repo
};


// Lista de tipos de Ibermon, los mismos que en los juegos Pokémon
// pero adaptados al universo de Ibermon. Array para poder iterar en la UI.
const TIPOS = [
  'Fuego', 'Agua', 'Planta', 'Eléctrico', 'Normal', 'Psíquico',
  'Roca', 'Tierra', 'Hielo', 'Siniestro', 'Volador', 'Veneno',
  'Dragón', 'Acero', 'Bicho', 'Lucha', 'Fantasma',
];


// Funciones de utilidad
// Las centralizo aquí para que si cambia el formato de algo,
// solo haya que tocarlo en un sitio.

/**
 * Genera el HTML de un badge de tipo para un Ibermon.
 * Ejemplo: tipoBadge('Fuego') → <span class="badge-tipo tipo-Fuego">Fuego</span>
 * Lo uso en el catálogo, el chatbot y la landing.
 */
function tipoBadge(tipo) {
  // El mapa relaciona el nombre del tipo con su clase CSS
  // (algunas tienen variantes con/sin tilde para que funcione en ambos casos)
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

/**
 * Convierte segundos en formato "Xh YYm" o "Xm YYs".
 * Lo uso en las tarjetas de partida del dashboard.
 * Ejemplo: formatTime(3725) → "1h 02m"
 */
function formatTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

/**
 * Formatea un número de Ibermon con el formato de Pokédex (#001).
 * Ejemplo: formatNum(1) → "#001", formatNum(25) → "#025"
 */
function formatNum(n) {
  return '#' + String(n).padStart(3, '0');
}

/**
 * Devuelve la clase CSS de color para una barra de estadística.
 * El color va de rojo (bajo) a azul (muy alto), como en los juegos.
 * Ejemplo: statColor(45) → 'low', statColor(100) → 'high'
 */
function statColor(val) {
  if (val < 50)  return 'low';
  if (val < 80)  return 'mid';
  if (val < 110) return 'high';
  return 'vhigh';
}

/**
 * Aplica syntax highlighting a una cadena JSON para mostrarla
 * con colores en el visor de la API. Usa expresiones regulares
 * para detectar claves, strings, números, booleanos y null.
 *
 * El resultado es HTML con spans de diferentes clases CSS.
 */
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

/**
 * Genera una imagen con fallback SVG si el sprite no carga.
 * El SVG es una bola con un "?" que indica que el sprite no está disponible.
 * Evito errores 404 molestos en la consola usando onerror inline.
 */
function imgWithFallback(src, alt, className = '') {
  // El SVG está codificado en base64 para que funcione como src de img sin servidor
  const fallbackSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Ccircle cx='48' cy='48' r='44' fill='%231a1a2e' stroke='%232a2a4a' stroke-width='2'/%3E%3Ctext x='48' y='55' text-anchor='middle' font-size='24' fill='%234d5d80'%3E?%3C/text%3E%3C/svg%3E`;
  return `<img src="${src}" alt="${alt}" class="${className}" onerror="this.src='${fallbackSvg}'">`;
}
