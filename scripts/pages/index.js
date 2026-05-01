// Vista previa del catalogo en la landing (primeros 8 Ibermon)

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('heroIbermonGrid');
  if (!grid) return;

  try {
    const ibermon = await CatalogAPI.ibermon();
    const preview = ibermon.slice(0, 8);

    if (preview.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon">🔌</div>
          <p>API no disponible</p>
        </div>`;
      return;
    }

    // Cada tarjeta linka al catalogo (no abro modal porque estamos en la landing)
    grid.innerHTML = preview.map(ib => `
      <a href="catalogo.html" class="ibermon-card" style="text-decoration:none">
        <div class="card-num">${formatNum(ib.numero)}</div>
        ${imgWithFallback(ib.sprite, ib.nombre, 'card-sprite')}
        <div class="card-name">${ib.nombre}</div>
        <div class="card-types">
          ${tipoBadge(ib.tipo1)}
          ${ib.tipo2 ? tipoBadge(ib.tipo2) : ''}
        </div>
      </a>`).join('');

  } catch {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🔌</div>
        <p>Inicia la API para ver el catálogo</p>
        <small class="text-muted">localhost:8000</small>
      </div>`;
  }
});
