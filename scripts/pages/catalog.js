// Catalogo publico: dos modos (tarjetas / visor JSON)

let currentSection = 'ibermon';   // ibermon | movimientos | items | logros
let currentMode    = 'normal';    // normal | api
let currentFilter  = '';
let allData        = {};


// Endpoints disponibles en el modo API
const ENDPOINTS = [
  { method: 'GET', path: '/catalogo/ibermon',              label: 'Listar Ibermon',       section: 'ibermon' },
  { method: 'GET', path: '/catalogo/ibermon/{numero}',     label: 'Detalle Ibermon',      section: 'ibermon',     hasParam: true, paramHint: 'numero (ej: 1)' },
  { method: 'GET', path: '/catalogo/movimientos',          label: 'Listar Movimientos',   section: 'movimientos' },
  { method: 'GET', path: '/catalogo/movimientos/{numero}', label: 'Detalle Movimiento',   section: 'movimientos', hasParam: true, paramHint: 'numero (ej: 1)' },
  { method: 'GET', path: '/catalogo/items',                label: 'Listar Ítems',         section: 'items' },
  { method: 'GET', path: '/catalogo/items/{numero}',       label: 'Detalle Ítem',         section: 'items',       hasParam: true, paramHint: 'numero (ej: 1)' },
  { method: 'GET', path: '/catalogo/logros',               label: 'Listar Logros',        section: 'logros' },
  { method: 'GET', path: '/catalogo/logros/{codigo}',      label: 'Detalle Logro',        section: 'logros',      hasParam: true, paramHint: 'codigo (ej: captura_1)' },
];

let activeEndpointIdx = 0;


document.addEventListener('DOMContentLoaded', () => {
  // ?modo=api activa el modo API directamente
  const params = new URLSearchParams(window.location.search);
  if (params.get('modo') === 'api') currentMode = 'api';

  initModeSwitch();
  initSectionTabs();
  initSearchBar();
  renderAll();
});

function initModeSwitch() {
  document.querySelectorAll('[data-mode]').forEach(btn => {
    if (btn.dataset.mode === currentMode) btn.classList.add('active');
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      renderAll();
    });
  });
}

function initSectionTabs() {
  document.querySelectorAll('[data-section]').forEach(btn => {
    if (btn.dataset.section === currentSection) btn.classList.add('active');
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-section]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSection = btn.dataset.section;
      currentFilter  = '';
      const searchEl = document.getElementById('catalogSearch');
      if (searchEl) searchEl.value = '';
      renderAll();
    });
  });
}

// Solo actua en modo normal
function initSearchBar() {
  const searchEl = document.getElementById('catalogSearch');
  if (!searchEl) return;
  searchEl.addEventListener('input', () => {
    currentFilter = searchEl.value.toLowerCase().trim();
    if (currentMode === 'normal') renderNormal();
  });
}


function renderAll() {
  const normalView = document.getElementById('normalView');
  const apiView    = document.getElementById('apiView');
  const searchWrap = document.getElementById('searchWrap');
  if (!normalView || !apiView) return;

  if (currentMode === 'normal') {
    normalView.style.display = 'block';
    apiView.style.display    = 'none';
    if (searchWrap) searchWrap.style.display = 'flex';
    renderNormal();
  } else {
    normalView.style.display = 'none';
    apiView.style.display    = 'block';
    if (searchWrap) searchWrap.style.display = 'none';
    renderApiMode();
  }
}


// Modo normal: tarjetas

async function renderNormal() {
  const container = document.getElementById('normalView');
  container.innerHTML = loadingHTML();

  try {
    // Pido los datos solo si no estan en cache
    if (!allData[currentSection]) {
      switch (currentSection) {
        case 'ibermon':     allData.ibermon     = await CatalogAPI.ibermon();     break;
        case 'movimientos': allData.movimientos = await CatalogAPI.movimientos(); break;
        case 'items':       allData.items       = await CatalogAPI.items();       break;
        case 'logros':      allData.logros      = await CatalogAPI.logros();      break;
      }
    }
  } catch (e) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>No se pudo conectar con la API.<br>
        <small class="text-muted">${e.message}</small></p>
      </div>`;
    return;
  }

  const data     = allData[currentSection];
  const filtered = filterData(data);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <p>Sin resultados para "<strong>${currentFilter}</strong>"</p>
      </div>`;
    return;
  }

  switch (currentSection) {
    case 'ibermon':     container.innerHTML = renderIbermonGrid(filtered);      break;
    case 'movimientos': container.innerHTML = renderMovimientosTable(filtered); break;
    case 'items':       container.innerHTML = renderItemsGrid(filtered);        break;
    case 'logros':      container.innerHTML = renderLogrosGrid(filtered);       break;
  }

  // Click en tarjeta de Ibermon: abre el modal de detalle
  if (currentSection === 'ibermon') {
    container.querySelectorAll('.ibermon-card').forEach(card => {
      card.addEventListener('click', () => openIbermonModal(parseInt(card.dataset.num)));
    });
  }

  // Anima las barras de stats con un pequenyo delay para que la transicion CSS se vea
  setTimeout(animateStatBars, 50);
}

function filterData(data) {
  if (!currentFilter) return data;
  return data.filter(d => {
    const searchable = (d.nombre || d.codigo || '').toLowerCase();
    return searchable.includes(currentFilter);
  });
}


// Renderizadores por seccion

function renderIbermonGrid(list) {
  return `<div class="ibermon-grid">
    ${list.map(ib => `
      <div class="ibermon-card" data-num="${ib.numero}">
        <div class="card-num">${formatNum(ib.numero)}</div>
        ${imgWithFallback(ib, ib.nombre, 'card-sprite')}
        <div class="card-name">${ib.nombre}</div>
        <div class="card-types">
          ${tipoBadge(ib.tipo1)}
          ${ib.tipo2 ? tipoBadge(ib.tipo2) : ''}
        </div>
      </div>`).join('')}
  </div>`;
}

function renderMovimientosTable(list) {
  return `
  <div class="card" style="overflow:hidden">
    <table style="width:100%;border-collapse:collapse;font-size:.875rem">
      <thead>
        <tr style="background:var(--bg-surface);border-bottom:1px solid var(--border)">
          <th style="padding:.75rem 1rem;text-align:left;font-family:var(--font-pixel);font-size:.5rem;color:var(--text-dim)">#</th>
          <th style="padding:.75rem 1rem;text-align:left;font-family:var(--font-pixel);font-size:.5rem;color:var(--text-dim)">Nombre</th>
          <th style="padding:.75rem 1rem;text-align:center;font-family:var(--font-pixel);font-size:.5rem;color:var(--text-dim)">Tipo</th>
          <th style="padding:.75rem 1rem;text-align:center;font-family:var(--font-pixel);font-size:.5rem;color:var(--text-dim)">Potencia</th>
          <th style="padding:.75rem 1rem;text-align:center;font-family:var(--font-pixel);font-size:.5rem;color:var(--text-dim)">Precisión</th>
          <th style="padding:.75rem 1rem;text-align:center;font-family:var(--font-pixel);font-size:.5rem;color:var(--text-dim)">PP</th>
          <th style="padding:.75rem 1rem;text-align:center;font-family:var(--font-pixel);font-size:.5rem;color:var(--text-dim)">Categoría</th>
        </tr>
      </thead>
      <tbody>
        ${list.map((m, i) => `
          <tr style="border-bottom:1px solid var(--border);${i % 2 === 0 ? 'background:var(--bg-card)' : 'background:var(--bg-surface)'}">
            <td style="padding:.65rem 1rem;color:var(--text-muted);font-family:monospace">${m.numero}</td>
            <td style="padding:.65rem 1rem;font-weight:600;color:var(--text)">${m.nombre}</td>
            <td style="padding:.65rem 1rem;text-align:center">${tipoBadge(m.tipo || 'Normal')}</td>
            <td style="padding:.65rem 1rem;text-align:center;color:var(--yellow);font-weight:700">${m.potencia ?? '—'}</td>
            <td style="padding:.65rem 1rem;text-align:center;color:var(--blue)">${m.precision ?? '—'}${m.precision ? '%' : ''}</td>
            <td style="padding:.65rem 1rem;text-align:center;color:var(--green)">${m.pp ?? '—'}</td>
            <td style="padding:.65rem 1rem;text-align:center">
              <span style="font-size:.7rem;padding:.15rem .5rem;border-radius:99px;
                background:${m.categoria === 'Especial' ? 'var(--blue-glow)' : m.categoria === 'Fisico' ? 'var(--red-glow)' : 'var(--bg-deep)'};
                border:1px solid ${m.categoria === 'Especial' ? 'var(--blue)' : m.categoria === 'Fisico' ? 'var(--red)' : 'var(--border)'};
                color:${m.categoria === 'Especial' ? 'var(--blue)' : m.categoria === 'Fisico' ? 'var(--red)' : 'var(--text-dim)'}">
                ${m.categoria ?? 'Estado'}
              </span>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

function renderItemsGrid(list) {
  return `<div class="grid-3" style="gap:1rem">
    ${list.map(item => `
      <div class="card card-body" style="display:flex;gap:1rem;align-items:center">
        <div style="flex-shrink:0;width:48px;height:48px;display:flex;align-items:center;justify-content:center">
          ${item.sprite_frontal
            ? imgWithFallback(item, item.nombre, 'item-sprite')
            : `<span style="font-size:1.75rem">${item.emoji || getItemEmoji(item.categoria)}</span>`}
        </div>
        <div>
          <div style="font-family:var(--font-pixel);font-size:.6rem;color:var(--text);margin-bottom:.25rem">${item.nombre}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:.5rem">${item.descripcion || ''}</div>
          ${(item.precio_tienda ?? item.precio) !== undefined
            ? `<div style="font-size:.75rem;color:var(--yellow);font-weight:700">💰 ${item.precio_tienda ?? item.precio} monedas</div>`
            : ''}
        </div>
      </div>`).join('')}
  </div>`;
}

function renderLogrosGrid(list) {
  return `<div class="grid-2" style="gap:1rem">
    ${list.map(l => `
      <div class="card card-body" style="display:flex;gap:1rem;align-items:flex-start">
        <div style="font-size:1.5rem;flex-shrink:0">🏆</div>
        <div style="flex:1">
          <div style="font-family:var(--font-pixel);font-size:.58rem;color:var(--yellow);margin-bottom:.25rem">${l.nombre || l.codigo}</div>
          <div style="font-size:.8rem;color:var(--text-dim);margin-bottom:.35rem">${l.descripcion || ''}</div>
          <code style="font-size:.7rem;color:var(--text-muted);font-family:monospace">${l.codigo}</code>
        </div>
      </div>`).join('')}
  </div>`;
}

function getItemEmoji(cat) {
  const map = { Pokeball: '⚾', Curación: '💊', Rareza: '✨', Combate: '⚔️', Revivir: '💚', Otro: '📦' };
  return map[cat] || '🎒';
}


// Modal de detalle de Ibermon

async function openIbermonModal(numero) {
  const overlay = document.getElementById('ibermonModal');
  const body    = document.getElementById('ibermonModalBody');
  overlay.classList.add('open');
  body.innerHTML = loadingHTML();

  try {
    const ib = await CatalogAPI.ibermonById(numero);
    body.innerHTML = renderIbermonDetail(ib);
    animateStatBars();
  } catch (e) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>${e.message}</p>
      </div>`;
  }
}

function renderIbermonDetail(ib) {
  const stats = [
    { label: 'HP',     val: ib.hp_base },
    { label: 'ATK',    val: ib.ataque_base },
    { label: 'DEF',    val: ib.defensa_base },
    { label: 'SP.ATK', val: ib.ataque_especial_base },
    { label: 'SP.DEF', val: ib.defensa_especial_base },
    { label: 'VEL',    val: ib.velocidad_base },
  ];
  const total = stats.reduce((s, x) => s + x.val, 0);

  return `
  <div class="modal-sprite-wrap">
    ${imgWithFallback(ib, ib.nombre, 'modal-sprite')}
    <div class="modal-num">${formatNum(ib.numero)}</div>
    <div class="modal-name">${ib.nombre}</div>
    <div class="modal-types">${tipoBadge(ib.tipo1)}${ib.tipo2 ? tipoBadge(ib.tipo2) : ''}</div>
    ${ib.descripcion ? `<p class="modal-desc">${ib.descripcion}</p>` : ''}
  </div>
  <div style="padding:1.25rem 1.5rem">
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-item-label">Catch Rate</div><div class="detail-item-val">${ib.catch_rate}</div></div>
      <div class="detail-item"><div class="detail-item-label">EXP Yield</div><div class="detail-item-val">${ib.exp_yield}</div></div>
      <div class="detail-item"><div class="detail-item-label">Crecimiento</div><div class="detail-item-val">${ib.growth_rate}</div></div>
      <div class="detail-item"><div class="detail-item-label">Evolución</div><div class="detail-item-val">${ib.evoluciona_a ? `#${String(ib.evoluciona_a).padStart(3,'0')} (Nv.${ib.nivel_evolucion})` : '—'}</div></div>
    </div>
    <div style="margin-bottom:1.25rem">
      <div style="font-family:var(--font-pixel);font-size:.55rem;color:var(--text-dim);margin-bottom:.75rem">
        ESTADÍSTICAS BASE — Total: <span style="color:var(--yellow)">${total}</span>
      </div>
      ${stats.map(s => `
        <div class="stat-row">
          <span class="stat-label">${s.label}</span>
          <span class="stat-val">${s.val}</span>
          <div class="stat-bar-wrap">
            <div class="stat-bar-fill ${statColor(s.val)}" data-target="${Math.min(100, (s.val / 170) * 100).toFixed(1)}" style="width:0%"></div>
          </div>
        </div>`).join('')}
    </div>
    ${ib.movimientos_posibles?.length > 0 ? `
      <div>
        <div style="font-family:var(--font-pixel);font-size:.55rem;color:var(--text-dim);margin-bottom:.75rem">MOVIMIENTOS</div>
        <div class="moves-list">
          ${ib.movimientos_posibles.map(m =>
            `<span class="move-chip">Mov.${m.numero} <span class="move-level">Nv.${m.nivel}</span></span>`
          ).join('')}
        </div>
      </div>` : ''}
  </div>`;
}

// 0% -> valor real con transicion CSS
function animateStatBars() {
  document.querySelectorAll('.stat-bar-fill[data-target]').forEach(bar => {
    bar.style.width = bar.dataset.target + '%';
  });
}


// Modo API: visor de endpoints

function renderApiMode() {
  const container = document.getElementById('apiView');
  if (!container) return;

  container.innerHTML = `
  <div class="catalog-layout">
    <aside class="catalog-sidebar">
      <div class="catalog-sidebar-title">Endpoints Públicos</div>
      <div class="endpoint-list" id="endpointList"></div>
    </aside>
    <main class="catalog-main">
      <div id="apiUrlBar" style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap">
        <code id="apiUrlText" style="flex:1;font-family:monospace;font-size:.82rem;color:var(--blue);background:var(--bg-deep);padding:.5rem .85rem;border-radius:var(--radius);border:1px solid var(--border);overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></code>
        <button class="btn btn-primary btn-sm" id="apiTryBtn">▶ Ejecutar</button>
      </div>
      <div id="apiParamWrap" style="display:none;margin-bottom:1rem">
        <label style="font-family:var(--font-pixel);font-size:.5rem;color:var(--text-dim);display:block;margin-bottom:.35rem">Parámetro</label>
        <div style="display:flex;gap:.5rem;align-items:center">
          <input type="text" id="apiParamInput" class="search-input" style="max-width:220px" placeholder="valor" />
          <span id="apiParamHint" style="font-size:.78rem;color:var(--text-muted)"></span>
        </div>
      </div>
      <div class="json-panel">
        <div class="json-bar">
          <span id="apiStatusText" class="status">—</span>
          <span id="apiTimingText" style="font-family:monospace;font-size:.72rem"></span>
        </div>
        <div class="json-body" id="apiJsonBody">
          <span style="color:var(--text-muted)">← Selecciona un endpoint y pulsa Ejecutar</span>
        </div>
      </div>
    </main>
  </div>`;

  const list = document.getElementById('endpointList');
  ENDPOINTS.forEach((ep, i) => {
    const item = document.createElement('div');
    item.className = `endpoint-item${i === activeEndpointIdx ? ' active' : ''}`;
    item.innerHTML = `<span class="endpoint-method">${ep.method}</span><span class="endpoint-path">${ep.path}</span>`;
    item.addEventListener('click', () => selectEndpoint(i));
    list.appendChild(item);
  });

  document.getElementById('apiTryBtn').addEventListener('click', executeEndpoint);
  selectEndpoint(activeEndpointIdx);
}

function selectEndpoint(i) {
  activeEndpointIdx = i;
  const ep = ENDPOINTS[i];

  document.querySelectorAll('.endpoint-item').forEach((el, j) => el.classList.toggle('active', j === i));

  const urlText   = document.getElementById('apiUrlText');
  const paramWrap = document.getElementById('apiParamWrap');
  if (!urlText) return;

  urlText.textContent = `${CONFIG.API_BASE}${ep.path}`;

  // Si tiene parametro variable ({numero}), muestro el campo
  if (ep.hasParam) {
    paramWrap.style.display = 'block';
    document.getElementById('apiParamHint').textContent  = ep.paramHint || '';
    document.getElementById('apiParamInput').value = '';
  } else {
    paramWrap.style.display = 'none';
  }

  // Reseteo el area de respuesta
  document.getElementById('apiStatusText').textContent = '—';
  document.getElementById('apiStatusText').className   = 'status';
  document.getElementById('apiTimingText').textContent = '';
  document.getElementById('apiJsonBody').innerHTML     = '<span style="color:var(--text-muted)">Pulsa ▶ Ejecutar para ver la respuesta</span>';
}

async function executeEndpoint() {
  const ep = ENDPOINTS[activeEndpointIdx];
  let path = ep.path;

  if (ep.hasParam) {
    const val = document.getElementById('apiParamInput').value.trim();
    if (!val) {
      document.getElementById('apiJsonBody').innerHTML = '<span style="color:var(--red)">⚠ Introduce un valor para el parámetro</span>';
      return;
    }
    path = ep.path.replace(/\{[^}]+\}/, val);
  }

  document.getElementById('apiJsonBody').innerHTML = '<div class="spinner"></div>';
  document.getElementById('apiUrlText').textContent = `${CONFIG.API_BASE}${path}`;

  const { ok, status, data, ms } = await rawFetch(path);

  const statusEl = document.getElementById('apiStatusText');
  statusEl.textContent = `HTTP ${status}`;
  statusEl.className   = `status ${ok ? 'status-200' : 'status-err'}`;
  document.getElementById('apiTimingText').textContent = `${ms}ms`;
  document.getElementById('apiJsonBody').innerHTML     = `<pre style="margin:0">${syntaxHighlight(JSON.stringify(data, null, 2))}</pre>`;
}


function loadingHTML() {
  return `<div class="loading-state"><div class="spinner"></div><div>Cargando datos...</div></div>`;
}


// Cierre de modales
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('ibermonModal');
  if (!overlay) return;

  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });

  document.getElementById('ibermonModalClose')?.addEventListener('click', () => {
    overlay.classList.remove('open');
  });
});
