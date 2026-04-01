/**
 * scripts/pages/dashboard.js — Panel de partidas del usuario
 *
 * Esta página es exclusiva para usuarios autenticados.
 * Muestra las partidas guardadas con sus estadísticas y permite
 * renombrarlas (alias local en localStorage) o eliminarlas.
 *
 * La lógica de renombrar no llama a la API porque el alias es
 * solo visual — el nombre real de la partida sigue siendo el
 * personaje elegido. El alias se guarda en el navegador del usuario.
 */

// Clave de localStorage donde guardo los alias de partidas
const ALIAS_KEY = 'ibermon_aliases';


// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  // Si el usuario no está logueado, lo mando al login
  // (Auth.requireAuth() se encarga de la redirección)
  if (!Auth.requireAuth()) return;

  // Muestro el nombre y email del usuario en el hero del dashboard
  const user = Auth.getUser();
  if (user) {
    document.getElementById('dashUser').textContent  = user.username || 'Entrenador';
    document.getElementById('dashEmail').textContent = user.email    || '';
  }

  await loadPartidas();
});


// Cargar y renderizar partidas

/**
 * Pide las partidas a la API y las renderiza.
 * Si falla, muestra un mensaje de error con opción de reintentar.
 */
async function loadPartidas() {
  const container = document.getElementById('partidasContainer');
  container.innerHTML = loadingHTML('Cargando partidas...');

  try {
    const partidas = await PartidaAPI.listar();
    renderPartidas(partidas);
    updateStats(partidas);
  } catch (e) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>No se pudieron cargar las partidas.</p>
        <small class="text-muted">${e.message}</small>
        <div class="mt-3">
          <button class="btn btn-ghost btn-sm" onclick="loadPartidas()">Reintentar</button>
        </div>
      </div>`;
  }
}

/** Genera el HTML de la lista de tarjetas de partida */
function renderPartidas(partidas) {
  const container = document.getElementById('partidasContainer');
  const aliases   = getAliases();

  if (partidas.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎮</div>
        <p style="margin-bottom:.5rem">No tienes partidas activas.</p>
        <small class="text-muted">Crea una partida desde el juego para verla aquí.</small>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="grid-2 gap-2" id="partidasGrid">
      ${partidas.map(p => renderPartidaCard(p, aliases[p.id])).join('')}
    </div>`;

  // Conecto los botones de acción (renombrar/eliminar) usando delegación de eventos
  // para no tener que añadir listeners a cada botón individualmente
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () =>
      handlePartidaAction(btn.dataset.action, btn.dataset.id, btn.dataset.char)
    );
  });
}

/** Genera el HTML de una tarjeta de partida */
function renderPartidaCard(p, alias) {
  // El alias tiene prioridad sobre el nombre del personaje elegido
  const displayName = alias || p.personaje_elegido || 'Partida';
  const tiempo      = formatTime(p.tiempo_jugado || 0);
  const totalBatallas = p.combates_ganados + p.combates_perdidos;
  const winRate     = totalBatallas > 0
    ? Math.round((p.combates_ganados / totalBatallas) * 100)
    : 0;

  return `
  <div class="partida-card" id="card-${p.id}">
    <div class="partida-header">
      <div>
        <div class="partida-char" id="name-${p.id}">${displayName}</div>
        <div class="partida-id">${p.id.slice(-8).toUpperCase()}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:.7rem;color:var(--text-muted)">Medallas</div>
        <div style="font-family:var(--font-pixel);font-size:.6rem;color:var(--green)">
          ${p.medallas?.length || 0} 🏅
        </div>
      </div>
    </div>

    <div class="partida-stats">
      <div class="partida-stat">
        <span class="partida-stat-label">Mapa actual</span>
        <span class="partida-stat-val" title="${p.mapa_actual}">${truncateMap(p.mapa_actual)}</span>
      </div>
      <div class="partida-stat">
        <span class="partida-stat-label">Tiempo jugado</span>
        <span class="partida-stat-val">${tiempo}</span>
      </div>
      <div class="partida-stat">
        <span class="partida-stat-label">Batallas ganadas</span>
        <span class="partida-stat-val" style="color:var(--green)">${p.combates_ganados || 0}</span>
      </div>
      <div class="partida-stat">
        <span class="partida-stat-label">Win Rate</span>
        <span class="partida-stat-val" style="color:${winRate >= 50 ? 'var(--green)' : 'var(--red)'}">
          ${winRate}%
        </span>
      </div>
      <div class="partida-stat">
        <span class="partida-stat-label">Ibermon vistos</span>
        <span class="partida-stat-val">${p.pokedex_visto?.length || 0}</span>
      </div>
      <div class="partida-stat">
        <span class="partida-stat-label">Capturados</span>
        <span class="partida-stat-val" style="color:var(--blue)">${p.pokedex_capturado?.length || 0}</span>
      </div>
    </div>

    ${p.medallas?.length > 0 ? `
    <div style="padding:.5rem 1.5rem;display:flex;flex-wrap:wrap;gap:.35rem">
      ${p.medallas.map(m =>
        `<span style="font-size:.72rem;padding:.2rem .5rem;background:var(--yellow-glow);border:1px solid var(--yellow);border-radius:99px;color:var(--yellow)">🏅 ${m}</span>`
      ).join('')}
    </div>` : ''}

    <div class="partida-actions">
      <button class="btn btn-ghost btn-sm" data-action="rename" data-id="${p.id}" data-char="${displayName}"
              style="display:flex;align-items:center;gap:.3rem">
        ✏️ Renombrar
      </button>
      <button class="btn btn-danger btn-sm" data-action="delete" data-id="${p.id}" style="margin-left:auto">
        🗑 Eliminar
      </button>
    </div>
  </div>`;
}


// Acciones sobre partidas

/** Enruta la acción al handler correspondiente */
function handlePartidaAction(action, id, currentName) {
  if (action === 'rename') startRename(id, currentName);
  if (action === 'delete') confirmDelete(id);
}

/**
 * Activa el modo edición inline del nombre de la partida.
 * Reemplaza el div con el nombre por un input de texto.
 * Al salir del input (blur) o presionar Enter, guarda el alias.
 */
function startRename(id, currentName) {
  const nameEl = document.getElementById(`name-${id}`);
  if (!nameEl) return;

  const input     = document.createElement('input');
  input.type      = 'text';
  input.value     = currentName;
  input.className = 'rename-input';
  input.maxLength = 32;

  nameEl.replaceWith(input);
  input.focus();
  input.select();

  function saveAlias() {
    const newAlias = input.value.trim() || currentName;
    saveAliasToStorage(id, newAlias);
    const nameSpan       = document.createElement('div');
    nameSpan.className   = 'partida-char';
    nameSpan.id          = `name-${id}`;
    nameSpan.textContent = newAlias;
    input.replaceWith(nameSpan);
  }

  input.addEventListener('blur', saveAlias);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') {
      // Si cancela con Escape, restauro el nombre original
      const nameSpan       = document.createElement('div');
      nameSpan.className   = 'partida-char';
      nameSpan.id          = `name-${id}`;
      nameSpan.textContent = currentName;
      input.replaceWith(nameSpan);
    }
  });
}

/**
 * Muestra el modal de confirmación antes de eliminar.
 * No elimino directamente porque es una acción irreversible
 * y quiero que el usuario confirme explícitamente.
 */
function confirmDelete(id) {
  const modal      = document.getElementById('deleteModal');
  const confirmBtn = document.getElementById('deleteConfirmBtn');
  modal.classList.add('open');

  function doDelete() {
    confirmBtn.removeEventListener('click', doDelete);
    executeDelete(id);
    modal.classList.remove('open');
  }

  confirmBtn.addEventListener('click', doDelete);

  document.getElementById('deleteCancelBtn').addEventListener('click', () => {
    confirmBtn.removeEventListener('click', doDelete);
    modal.classList.remove('open');
  }, { once: true });
}

/**
 * Llama a la API para eliminar la partida.
 * Animo la tarjeta antes de eliminarla para que la transición sea suave.
 */
async function executeDelete(id) {
  const card = document.getElementById(`card-${id}`);

  // Animación de fade out antes de eliminar del DOM
  if (card) {
    card.style.transition = 'all .3s ease';
    card.style.opacity    = '0';
    card.style.transform  = 'scale(.95)';
  }

  try {
    await PartidaAPI.eliminar(id);
    removeAliasFromStorage(id);

    setTimeout(() => {
      card?.remove();
      // Si ya no quedan tarjetas, recargo para mostrar el estado vacío
      const grid = document.getElementById('partidasGrid');
      if (grid && grid.children.length === 0) loadPartidas();
    }, 300);

  } catch (e) {
    // Si falla, revierto la animación y muestro el error
    if (card) { card.style.opacity = '1'; card.style.transform = ''; }
    alert('Error al eliminar la partida: ' + e.message);
  }
}


// Estadísticas del resumen

/** Actualiza los 4 contadores de la cabecera del dashboard */
function updateStats(partidas) {
  document.getElementById('statCount').textContent =
    partidas.length;

  document.getElementById('statMedallas').textContent =
    partidas.reduce((s, p) => s + (p.medallas?.length || 0), 0);

  document.getElementById('statBatallas').textContent =
    partidas.reduce((s, p) => s + (p.combates_ganados || 0), 0);

  document.getElementById('statCapturados').textContent =
    partidas.reduce((s, p) => s + (p.pokedex_capturado?.length || 0), 0);
}


// Alias en localStorage
// Son los nombres personalizados que el usuario da a sus partidas.
// No se guardan en el servidor, solo en el navegador.

function getAliases() {
  try { return JSON.parse(localStorage.getItem(ALIAS_KEY)) || {}; }
  catch { return {}; }
}

function saveAliasToStorage(id, alias) {
  const aliases = getAliases();
  aliases[id]   = alias;
  localStorage.setItem(ALIAS_KEY, JSON.stringify(aliases));
}

function removeAliasFromStorage(id) {
  const aliases = getAliases();
  delete aliases[id];
  localStorage.setItem(ALIAS_KEY, JSON.stringify(aliases));
}


// Helpers

/** Recorta el nombre del mapa si es demasiado largo */
function truncateMap(map) {
  if (!map) return '—';
  return map.length > 18 ? map.slice(0, 16) + '…' : map;
}

/** HTML del spinner de carga con mensaje opcional */
function loadingHTML(msg = '') {
  return `<div class="loading-state"><div class="spinner"></div><div>${msg}</div></div>`;
}


// Modal de confirmación de borrado
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('deleteModal');
  if (!overlay) return;
  // Cerrar el modal al hacer clic fuera de él
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});
