/**
 * scripts/modules/chatbot.js — IberBot: asistente del juego
 *
 * Funciona en dos capas:
 * 1. Detección de intención local: si el usuario busca un Ibermon, movimiento
 *    o ítem por nombre o número, fetchea la API directamente y pinta una tarjeta.
 *    Es instantáneo y no consume cuota de Gemini.
 * 2. Gemini (backend Python): para cualquier pregunta de lenguaje natural que
 *    no sea una búsqueda directa del catálogo.
 */


// Botones de acceso rápido
const QUICK_REPLIES = [
  { label: '🔍 Buscar Ibermon #001',    msg: 'ibermon #001' },
  { label: '⚔️ Movimiento Llamarada',   msg: 'movimiento Llamarada' },
  { label: '🎮 ¿Cómo funciona?',        msg: '¿Cómo funciona el juego Ibermon?' },
  { label: '⬇️ Descargar el juego',     msg: '¿Cómo descargo el juego?' },
];


// Caché de catálogos para búsquedas instantáneas sin repetir llamadas a la API
const _cache = { ibermon: null, movimientos: null, items: null };

async function _fetchCatalog(endpoint) {
  const res = await fetch(`${CONFIG.API_BASE}/catalogo/${endpoint}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getIbermonList()     { return (_cache.ibermon     ||= await _fetchCatalog('ibermon'));      }
async function getMovimientosList() { return (_cache.movimientos ||= await _fetchCatalog('movimientos'));  }
async function getItemsList()       { return (_cache.items       ||= await _fetchCatalog('items'));        }

function preloadCatalogs() {
  getIbermonList().catch(() => {});
  getMovimientosList().catch(() => {});
  getItemsList().catch(() => {});
}


// Detección de intención

function normalize(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s#]/g, '')
    .trim();
}

function detectAPIIntent(raw) {
  const t = normalize(raw);

  // Listas completas
  if (/lista\s*(de\s*)?(ibermon|pokemon|criaturas)/.test(t) || /todos\s*(los\s*)?(ibermon|pokemon)/.test(t))
    return { intent: 'lista_ibermon' };
  if (/lista\s*(de\s*)?(movimientos?|ataques?)/.test(t) || /todos\s*(los\s*)?(movimientos?|ataques?)/.test(t))
    return { intent: 'lista_movimientos' };
  if (/lista\s*(de\s*)?(items?|objetos?)/.test(t) || /todos\s*(los\s*)?(items?|objetos?)/.test(t))
    return { intent: 'lista_items' };

  // Ibermon por número (#001, nº1, numero 1)
  const numMatch = t.match(/(?:ibermon\s*)?(?:#|numero\s*|n[oº]\s*|num\s*)(\d{1,3})/);
  if (numMatch) return { intent: 'ibermon', query: parseInt(numMatch[1], 10) };

  // Solo un número → asume Ibermon
  if (/^\s*\d{1,3}\s*$/.test(t)) return { intent: 'ibermon', query: parseInt(t.trim(), 10) };

  // Movimiento por nombre
  const movMatch = t.match(/(?:movimiento|move|ataque|tecnica|habilidad)\s+([a-z0-9\s]{2,})/);
  if (movMatch) return { intent: 'movimiento', query: movMatch[1].trim() };

  // Ítem por nombre
  const itemMatch = t.match(/(?:item|objeto|pocion|capturadora|pokeball|iberball)\s+([a-z0-9\s]{2,})/);
  if (itemMatch) return { intent: 'item', query: itemMatch[1].trim() };

  // Ibermon por nombre con palabra clave
  const ibMatch = t.match(/(?:busca|buscar|muestra|info|que es|quien es|dime|dame|stats?\s+de|datos\s+de|detalle)\s+(?:el\s+|la\s+|ibermon\s*)?([a-z]{3,})/);
  if (ibMatch) return { intent: 'ibermon', query: ibMatch[1].trim() };

  // "ibermon <nombre>" directo
  const ibNomMatch = t.match(/^ibermon\s+([a-z]{3,})/);
  if (ibNomMatch) return { intent: 'ibermon', query: ibNomMatch[1].trim() };

  return null;
}

// Último recurso antes de Gemini: busca el texto directamente contra los catálogos.
// Cubre el caso de escribir solo el nombre ("Bulbasaur", "Llamarada") sin palabras clave.
async function tryNameSearch(text) {
  const t = normalize(text);
  if (t.length < 3 || t.split(' ').length > 4) return null;

  const stopWords = ['hola','ayuda','help','gracias','adios','bye','juego','web','como','puedo','quiero','tengo','tienes','que','cual','donde'];
  if (stopWords.some(w => t === w)) return null;

  try {
    const ibermonList = await getIbermonList().catch(() => []);
    const foundIb = ibermonList.find(ib => normalize(ib.nombre) === t)
      || ibermonList.find(ib => normalize(ib.nombre).includes(t) || t.includes(normalize(ib.nombre)));
    if (foundIb) return { intent: 'ibermon', query: foundIb.numero };


    const movList = await getMovimientosList().catch(() => []);
    const foundMov = movList.find(m => normalize(m.nombre) === t)
      || movList.find(m => normalize(m.nombre).includes(t) || t.includes(normalize(m.nombre)));
    if (foundMov) return { intent: 'movimiento', query: foundMov.nombre };


    const itemList = await getItemsList().catch(() => []);
    const foundItem = itemList.find(i => normalize(i.nombre) === t)
      || itemList.find(i => normalize(i.nombre).includes(t) || t.includes(normalize(i.nombre)));
    if (foundItem) return { intent: 'item', query: foundItem.nombre };


  } catch { /* si falla la carga del catálogo simplemente no hay coincidencia */ }

  return null;
}


// Formateo de respuestas de la API
// Estas funciones convierten los datos JSON en HTML
// para mostrar dentro de los mensajes del chatbot.

function renderIbermonCard(ib) {
  const tipos = tipoBadge(ib.tipo1) + (ib.tipo2 ? ' ' + tipoBadge(ib.tipo2) : '');
  const evolInfo = ib.evoluciona_a
    ? `<div class="ibot-row"><span class="ibot-label">Evoluciona a</span><span>#${String(ib.evoluciona_a).padStart(3,'0')} (nv. ${ib.nivel_evolucion ?? '?'})</span></div>`
    : '';
  const statBar = (label, val) => {
    const pct = Math.min(100, Math.round(val / 255 * 100));
    const cls = val < 50 ? 'low' : val < 80 ? 'mid' : val < 110 ? 'high' : 'vhigh';
    return `<div class="ibot-stat-row">
      <span class="ibot-stat-label">${label}</span>
      <span class="ibot-stat-val">${val}</span>
      <div class="ibot-stat-bar"><div class="ibot-stat-fill stat-${cls}" style="width:${pct}%"></div></div>
    </div>`;
  };
  return `
  <div class="ibot-card">
    <div class="ibot-card-header">
      <span class="ibot-num">${formatNum(ib.numero)}</span>
      <strong class="ibot-name">${ib.nombre}</strong>
    </div>
    <div class="ibot-tipos">${tipos}</div>
    ${ib.descripcion ? `<p class="ibot-desc">${ib.descripcion}</p>` : ''}
    <div class="ibot-stats">
      ${statBar('HP',  ib.hp_base)}
      ${statBar('ATQ', ib.ataque_base)}
      ${statBar('DEF', ib.defensa_base)}
      ${statBar('ATE', ib.ataque_especial_base)}
      ${statBar('DFE', ib.defensa_especial_base)}
      ${statBar('VEL', ib.velocidad_base)}
    </div>
    <div class="ibot-extra">
      <div class="ibot-row"><span class="ibot-label">Tasa captura</span><span>${ib.catch_rate}/255</span></div>
      <div class="ibot-row"><span class="ibot-label">EXP base</span><span>${ib.exp_yield}</span></div>
      <div class="ibot-row"><span class="ibot-label">Crecimiento</span><span>${ib.growth_rate}</span></div>
      ${evolInfo}
    </div>
    <a href="catalogo.html" class="ibot-link">Ver en catálogo →</a>
  </div>`;
}

function renderMovimientoCard(mv) {
  const catIcon = { Fisico: '⚔️', Especial: '✨', Estado: '🔄' };
  return `
  <div class="ibot-card">
    <div class="ibot-card-header">
      <span class="ibot-num">${formatNum(mv.numero)}</span>
      <strong class="ibot-name">${mv.nombre}</strong>
    </div>
    <div class="ibot-tipos">${tipoBadge(mv.tipo)}</div>
    ${mv.descripcion ? `<p class="ibot-desc">${mv.descripcion}</p>` : ''}
    <div class="ibot-extra">
      <div class="ibot-row"><span class="ibot-label">Categoría</span><span>${catIcon[mv.categoria] || ''} ${mv.categoria}</span></div>
      <div class="ibot-row"><span class="ibot-label">Potencia</span><span>${mv.potencia || '—'}</span></div>
      <div class="ibot-row"><span class="ibot-label">Precisión</span><span>${mv.precision}%</span></div>
      <div class="ibot-row"><span class="ibot-label">PP</span><span>${mv.pp}</span></div>
      <div class="ibot-row"><span class="ibot-label">Prioridad</span><span>${mv.prioridad >= 0 ? '+' : ''}${mv.prioridad}</span></div>
      ${mv.efecto ? `<div class="ibot-row"><span class="ibot-label">Efecto</span><span>${mv.efecto}</span></div>` : ''}
    </div>
    <a href="catalogo.html" class="ibot-link">Ver en catálogo →</a>
  </div>`;
}

function renderItemCard(item) {
  const tipoIcon = { curacion: '💊', captura: '🎣', batalla: '⚔️', clave: '🔑' };
  return `
  <div class="ibot-card">
    <div class="ibot-card-header">
      <span class="ibot-num">${formatNum(item.numero)}</span>
      <strong class="ibot-name">${item.nombre}</strong>
    </div>
    <div class="ibot-tipos"><span class="badge-tipo tipo-Normal">${tipoIcon[item.tipo] || '📦'} ${item.tipo}</span></div>
    ${item.descripcion ? `<p class="ibot-desc">${item.descripcion}</p>` : ''}
    <div class="ibot-extra">
      <div class="ibot-row"><span class="ibot-label">Precio</span><span>💰 ${item.precio} monedas</span></div>
      ${item.efecto ? `<div class="ibot-row"><span class="ibot-label">Efecto</span><span>${item.efecto.tipo_efecto}${item.efecto.valor != null ? ': ' + item.efecto.valor : ''}</span></div>` : ''}
    </div>
    <a href="catalogo.html" class="ibot-link">Ver en catálogo →</a>
  </div>`;
}

function renderResumenLista(items, tipo) {
  if (!items.length) return `No hay ${tipo} registrados aún.`;
  const MAX = 8;
  const visibles = items.slice(0, MAX);
  const resto    = items.length - MAX;
  let html = `<strong>${items.length} ${tipo} registrados:</strong><br>`;
  html += visibles.map(i => {
    const num    = formatNum(i.numero);
    const nombre = i.nombre;
    if (tipo === 'Ibermon')     return `${num} ${nombre} — ${tipoBadge(i.tipo1)}${i.tipo2 ? ' ' + tipoBadge(i.tipo2) : ''}`;
    if (tipo === 'movimientos') return `${num} <strong>${nombre}</strong> (${tipoBadge(i.tipo)})`;
    return `${num} <strong>${nombre}</strong> — ${i.tipo}`;
  }).join('<br>');
  if (resto > 0) html += `<br><em>...y ${resto} más. <a href="catalogo.html">Ver todos →</a></em>`;
  else           html += `<br><a href="catalogo.html">Ver catálogo completo →</a>`;
  return html;
}


// Lógica principal de resolución

async function resolveAPIIntent(intent, query) {
  // Listas completas
  if (intent === 'lista_ibermon')     return renderResumenLista(await getIbermonList(),     'Ibermon');
  if (intent === 'lista_movimientos') return renderResumenLista(await getMovimientosList(), 'movimientos');
  if (intent === 'lista_items')       return renderResumenLista(await getItemsList(),        'ítems');

  // Ibermon por número o nombre
  if (intent === 'ibermon') {
    let url;
    if (typeof query === 'number') {
      url = `${CONFIG.API_BASE}/catalogo/ibermon/${query}`;
    } else {
      const list = await getIbermonList();
      const q    = normalize(query);
      let found  = list.find(ib => normalize(ib.nombre) === q) || list.find(ib => normalize(ib.nombre).includes(q));
      if (!found) {
        const fuzzy = fuzzyFindByName(q, list);
        if (fuzzy) { found = fuzzy.item; fuzzyName = fuzzy.item.nombre; }
      }
      if (!found) return `No encontré ningún Ibermon llamado <strong>"${query}"</strong>. Prueba con el nombre exacto o su número (#001).`;
      url = `${CONFIG.API_BASE}/catalogo/ibermon/${found.numero}`;
    }
    const res = await fetch(url);
    if (res.status === 404) return `No encontré el Ibermon con ese número. ¿Seguro que existe?`;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const card = renderIbermonCard(await res.json());
    return card;
  }

  // Movimiento por nombre
  if (intent === 'movimiento') {
    const list = await getMovimientosList();
    const q    = normalize(query);
    let found  = list.find(m => normalize(m.nombre) === q) || list.find(m => normalize(m.nombre).includes(q));
    if (!found) return `No encontré ningún movimiento llamado <strong>"${query}"</strong>. Consulta el <a href="catalogo.html">catálogo</a>.`;
    const res  = await fetch(`${CONFIG.API_BASE}/catalogo/movimientos/${found.numero}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const card = renderMovimientoCard(await res.json());
    return card;
  }

  // Ítem por nombre
  if (intent === 'item') {
    const list = await getItemsList();
    const q    = normalize(query);
    let found  = list.find(i => normalize(i.nombre) === q) || list.find(i => normalize(i.nombre).includes(q));
    if (!found) return `No encontré ningún ítem llamado <strong>"${query}"</strong>. Consulta el <a href="catalogo.html">catálogo</a>.`;
    const res  = await fetch(`${CONFIG.API_BASE}/catalogo/items/${found.numero}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const card = renderItemCard(await res.json());
    return card;
  }

  return null;
}

// Llama al backend Python para preguntas de lenguaje natural
async function preguntarAIberBot(mensaje) {
  const res = await fetch(`${CONFIG.API_BASE}/chatbot/mensaje`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensaje }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return (await res.json()).respuesta;
}


// Componente de interfaz
// Creo el chatbot dinámicamente con JS para no meter 60 líneas
// de HTML en cada página. Solo necesito que el body exista.

function initChatbot() {
  const toggleBtn     = document.createElement('button');
  toggleBtn.id        = 'chatbot-toggle';
  toggleBtn.title     = 'Ayuda de IberBot';
  toggleBtn.innerHTML = '🤖';
  document.body.appendChild(toggleBtn);

  const panel   = document.createElement('div');
  panel.id      = 'chatbot-panel';
  panel.innerHTML = `
    <div class="chatbot-head">
      <div class="chatbot-avatar">🤖</div>
      <div>
        <div class="chatbot-name">IBERBOT</div>
        <div class="chatbot-status">● En línea</div>
      </div>
      <button id="chatbot-close" title="Cerrar">✕</button>
    </div>
    <div class="chatbot-messages" id="chatbot-msgs"></div>
    <div class="chatbot-quick" id="chatbot-quick">
      ${QUICK_REPLIES.map(q => `<button class="quick-btn" data-msg="${q.msg}">${q.label}</button>`).join('')}
    </div>
    <div class="chatbot-input">
      <input type="text" id="chatbot-input" placeholder="Pregunta o busca un Ibermon..." autocomplete="off" />
      <button id="chatbot-send" title="Enviar">➤</button>
    </div>`;
  document.body.appendChild(panel);

  const msgs    = document.getElementById('chatbot-msgs');
  const input   = document.getElementById('chatbot-input');
  const sendBtn = document.getElementById('chatbot-send');

  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open') && msgs.children.length === 0) {
      addBotMsg('¡Hola entrenador! 👋 Soy <strong>IberBot</strong>. Puedo buscar Ibermon, movimientos e ítems con tarjeta detallada, o responder cualquier pregunta sobre el juego. ¡Escribe o pulsa un botón!');
      preloadCatalogs();
    }
  });

  document.getElementById('chatbot-close').addEventListener('click', () => panel.classList.remove('open'));

  sendBtn.addEventListener('click', () => handleSend());
  input.addEventListener('keydown', e => { if (e.key === 'Enter') handleSend(); });
  document.getElementById('chatbot-quick').addEventListener('click', e => {
    if (e.target.classList.contains('quick-btn')) handleSend(e.target.dataset.msg);
  });

  async function handleSend(override) {
    const text = (override ?? input.value).trim();
    if (!text) return;
    input.value = '';
    addUserMsg(text);

    const loadingEl = addLoadingMsg();

    try {
      // Primero intenta resolver como búsqueda del catálogo (instantáneo, sin Gemini)
      const intent = detectAPIIntent(text);
      if (intent) {
        const result = await resolveAPIIntent(intent.intent, intent.query);
        loadingEl.remove();
        addBotMsg(result ?? '⚠️ No encontré resultados.');
        return;
      }

      // Intenta buscar el texto como nombre directo contra los catálogos
      const nameIntent = await tryNameSearch(text);
      if (nameIntent) {
        const result = await resolveAPIIntent(nameIntent.intent, nameIntent.query);
        loadingEl.remove();
        addBotMsg(result ?? '⚠️ No encontré resultados.');
        return;
      }

      // Si no coincide con nada del catálogo, pregunta a Gemini
      const respuesta = await preguntarAIberBot(text);
      loadingEl.remove();
      addBotMsg(respuesta);

    } catch (err) {
      loadingEl.remove();
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        addBotMsg('⚠️ No puedo conectar con el servidor. Asegúrate de que la API está corriendo en <code>localhost:8000</code>.');
      } else {
        addBotMsg(`⚠️ ${err.message}`);
      }
    }
  }

  function addBotMsg(html) {
    const el = document.createElement('div');
    el.className = 'chat-msg bot';
    el.innerHTML = html;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  function addUserMsg(text) {
    const el = document.createElement('div');
    el.className   = 'chat-msg user';
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  // Los tres puntos animados mientras se espera la respuesta
  function addLoadingMsg() {
    const el = document.createElement('div');
    el.className = 'chat-msg bot chat-loading';
    el.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }
}

document.addEventListener('DOMContentLoaded', initChatbot);
