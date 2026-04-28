// Cliente de la API: anyade el JWT, parsea la respuesta y propaga errores

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('ibermon_token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${CONFIG.API_BASE}${path}`, { ...options, headers });

  // 204: la API no devuelve cuerpo al eliminar
  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.detail || `Error ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  return data;
}


const AuthAPI = {

  // FastAPI espera form-data en /auth/login, por eso no uso apiFetch
  async login(username, password) {
    const body = new URLSearchParams({ username, password });

    const res = await fetch(`${CONFIG.API_BASE}/auth/login`, {
      method: 'POST',
      body,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.detail || 'Error al iniciar sesión');
    }

    return data;
  },

  async registro(username, email, password) {
    return apiFetch('/auth/registro', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  },

  async yo() {
    return apiFetch('/auth/yo');
  },
};


const CatalogAPI = {
  ibermon:     ()  => apiFetch('/catalogo/ibermon'),
  movimientos: ()  => apiFetch('/catalogo/movimientos'),
  items:       ()  => apiFetch('/catalogo/items'),
  logros:      ()  => apiFetch('/catalogo/logros'),

  ibermonById: (n) => apiFetch(`/catalogo/ibermon/${n}`),
  movById:     (n) => apiFetch(`/catalogo/movimientos/${n}`),
  itemById:    (n) => apiFetch(`/catalogo/items/${n}`),
  logroById:   (c) => apiFetch(`/catalogo/logros/${c}`),
};


const PartidaAPI = {
  listar:   ()   => apiFetch('/partidas/'),
  obtener:  (id) => apiFetch(`/partidas/${id}`),
  eliminar: (id) => apiFetch(`/partidas/${id}`, { method: 'DELETE' }),
};


// Para el visor de la API: devuelve datos crudos con tiempo de respuesta
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
    return {
      ok:     false,
      status: 0,
      data:   { error: e.message },
      ms:     Date.now() - start,
    };
  }
}
