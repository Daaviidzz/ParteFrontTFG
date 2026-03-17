/**
 * scripts/api/api.js — Módulo central de comunicación con la API
 *
 * Aquí centralizo TODAS las llamadas a la API de Python.
 * La ventaja es que si la API cambia algo (por ejemplo, un endpoint
 * se renombra o el formato de autenticación cambia), solo tengo que
 * tocar este archivo y no andar buscando los fetch() repartidos
 * por todo el proyecto.
 *
 * Estructura:
 * - apiFetch(): función base que añade el token JWT automáticamente
 * - AuthAPI:    login, registro, perfil del usuario
 * - CatalogAPI: endpoints públicos del catálogo (sin autenticación)
 * - PartidaAPI: operaciones sobre partidas (requieren estar logueado)
 * - rawFetch(): para el visor de API del catálogo (devuelve datos crudos)
 */


// Función base de peticiones
// Esta función se llama desde todas las demás.
// Si el usuario está logueado, añade el header de autorización
// automáticamente para no tener que hacerlo en cada llamada.
async function apiFetch(path, options = {}) {
  // Recupero el token del localStorage — lo guardé al hacer login
  const token = localStorage.getItem('ibermon_token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,  // permito sobreescribir headers si hace falta
  };

  // Si hay token (usuario logueado), lo añado en el header Bearer
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${CONFIG.API_BASE}${path}`, { ...options, headers });

  // 204 No Content — la API devuelve esto al eliminar algo, sin cuerpo JSON
  if (res.status === 204) return null;

  // Intento parsear el JSON, pero si falla devuelvo un objeto vacío
  const data = await res.json().catch(() => ({}));

  // Si la respuesta no fue OK (4xx, 5xx), lanzo el error para manejarlo
  if (!res.ok) {
    const msg = data.detail || `Error ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  return data;
}


// AuthAPI: login, registro y datos del usuario logueado.
const AuthAPI = {

  /**
   * Inicia sesión con usuario y contraseña.
   * IMPORTANTE: FastAPI espera los datos como form-data (URLSearchParams),
   * NO como JSON. Por eso no uso apiFetch() aquí — necesito un Content-Type distinto.
   * Devuelve: { access_token, token_type }
   */
  async login(username, password) {
    const body = new URLSearchParams({ username, password });

    const res = await fetch(`${CONFIG.API_BASE}/auth/login`, {
      method: 'POST',
      body,  // URLSearchParams → Content-Type: application/x-www-form-urlencoded
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.detail || 'Error al iniciar sesión');
    }

    return data;  // { access_token, token_type }
  },

  /**
   * Registra un nuevo usuario.
   * Devuelve los datos del usuario creado (sin contraseña, por supuesto).
   */
  async registro(username, email, password) {
    return apiFetch('/auth/registro', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  },

  /**
   * Obtiene los datos del usuario actualmente logueado.
   * Necesita el token JWT (lo añade apiFetch() automáticamente).
   * Lo uso justo después del login para guardar el perfil en localStorage.
   */
  async yo() {
    return apiFetch('/auth/yo');
  },
};


// CatalogAPI: endpoints públicos, sin autenticación.
// Se usan en el catálogo y en la landing para la vista previa.
const CatalogAPI = {
  // Listas completas de cada categoría
  ibermon:     ()  => apiFetch('/catalogo/ibermon'),
  movimientos: ()  => apiFetch('/catalogo/movimientos'),
  items:       ()  => apiFetch('/catalogo/items'),
  logros:      ()  => apiFetch('/catalogo/logros'),

  // Detalle de un elemento específico por su ID
  ibermonById: (n) => apiFetch(`/catalogo/ibermon/${n}`),
  movById:     (n) => apiFetch(`/catalogo/movimientos/${n}`),
  itemById:    (n) => apiFetch(`/catalogo/items/${n}`),
  logroById:   (c) => apiFetch(`/catalogo/logros/${c}`),
};


// PartidaAPI: operaciones sobre partidas, requieren token JWT.
// Se usan en el dashboard para mostrar y gestionar las partidas.
const PartidaAPI = {
  /** Lista todas las partidas del usuario logueado */
  listar:   ()   => apiFetch('/partidas/'),

  /** Obtiene el detalle completo de una partida por su ID */
  obtener:  (id) => apiFetch(`/partidas/${id}`),

  /** Elimina una partida por su ID (devuelve null porque es 204 No Content) */
  eliminar: (id) => apiFetch(`/partidas/${id}`, { method: 'DELETE' }),
};


// rawFetch: para el visor de la API del catálogo.
// Ejecuta endpoints y devuelve la respuesta en crudo con el tiempo de respuesta.
// No usa apiFetch() porque aquí los errores se manejan de otra forma,
// devolviendo un objeto de error en vez de lanzar excepciones.
async function rawFetch(path) {
  const start = Date.now();

  try {
    const res  = await fetch(`${CONFIG.API_BASE}${path}`);
    const data = await res.json();
    return {
      ok:     res.ok,
      status: res.status,
      data,
      ms:     Date.now() - start,
    };
  } catch (e) {
    // Si falla la conexión, devuelvo un objeto de error en vez de lanzar excepción
    return {
      ok:     false,
      status: 0,
      data:   { error: e.message },
      ms:     Date.now() - start,
    };
  }
}
