/**
 * scripts/pages/index.js — Lógica específica de la landing (index.html)
 *
 * Lo único que hace este archivo es cargar la vista previa del catálogo
 * en la landing. Son los primeros 8 Ibermon de la API mostrados como
 * tarjetas enlazadas al catálogo completo.
 *
 * Separé esto de nav.js y auth.js porque es lógica específica de index.html
 * y no tiene sentido mezclarla con los módulos genéricos.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('heroIbermonGrid');
  if (!grid) return;  // por si acaso no estamos en la landing

  try {
    // Pido los ibermon a la API — uso CatalogAPI que ya está definido en api.js
    const ibermon = await CatalogAPI.ibermon();

    // Solo muestro los primeros 8 como vista previa
    const preview = ibermon.slice(0, 8);

    if (preview.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon">🔌</div>
          <p>API no disponible</p>
        </div>`;
      return;
    }

    // Cada tarjeta es un enlace al catálogo completo
    // (no abro el modal porque estamos en la landing, no en el catálogo)
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
    // Si la API no está levantada, muestro un mensaje amigable en vez de un error raro
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🔌</div>
        <p>Inicia la API para ver el catálogo</p>
        <small class="text-muted">localhost:8000</small>
      </div>`;
  }
});
