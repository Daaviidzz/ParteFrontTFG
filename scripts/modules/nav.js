/**
 * scripts/modules/nav.js — Navbar y footer dinámicos
 *
 * En vez de copiar el HTML del navbar en cada página (que sería
 * una pesadilla de mantener si hay que cambiar algo), lo genero
 * dinámicamente desde JavaScript y lo inyecto en el div #navbar
 * que tiene cada HTML.
 *
 * La función detecta en qué página estamos para marcar el link
 * activo, y si el usuario está logueado muestra su nombre o los
 * botones de login/registro.
 */


// buildNav() construye e inyecta el navbar y el footer en cada página
function buildNav() {
  // Saco el nombre del archivo actual de la URL para marcar el link activo
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const isLogged    = Auth.isLoggedIn();
  const user        = Auth.getUser();

  // Los links de navegación — "Mis Partidas" solo aparece si estás logueado.
  // "Combate" lo meto aquí para que esté accesible desde cualquier página.
  const links = [
    { href: 'index.html',     label: 'Inicio' },
    { href: 'catalogo.html',  label: 'Catálogo' },
    { href: 'combate.html',   label: 'Combate' },
    { href: 'dashboard.html', label: 'Mis Partidas', requiresAuth: true },
    { href: 'descarga.html',  label: 'Descarga' },
  ];

  // Filtro los links según si requieren autenticación y genero el HTML
  const navLinks = links
    .filter(l => !l.requiresAuth || isLogged)
    .map(l => {
      const active = currentPage === l.href ? 'active' : '';
      return `<a href="${l.href}" class="nav-link ${active}">${l.label}</a>`;
    })
    .join('');

  // La parte derecha del navbar: nombre de usuario o botones de login/registro
  const authHtml = isLogged
    ? `<div class="nav-user">
         <span>Hola, <strong>${user?.username || 'Entrenador'}</strong></span>
         <button class="btn btn-ghost btn-sm" onclick="Auth.logout()">Salir</button>
       </div>`
    : `<a href="login.html"    class="btn btn-ghost btn-sm">Entrar</a>
       <a href="registro.html" class="btn btn-primary btn-sm">Registrarse</a>`;

  // Los mismos links para el menú móvil (sin el "activo" porque en móvil
  // no hay suficiente espacio visual para destacarlo bien)
  const mobileLinks = links
    .filter(l => !l.requiresAuth || isLogged)
    .map(l => `<a href="${l.href}" class="nav-link">${l.label}</a>`)
    .join('');

  const mobileAuth = isLogged
    ? `<button class="btn btn-ghost btn-sm" onclick="Auth.logout()">Cerrar sesión</button>`
    : `<a href="login.html"    class="btn btn-ghost btn-sm">Entrar</a>
       <a href="registro.html" class="btn btn-primary btn-sm">Registrarse</a>`;

  // El HTML completo del navbar
  const navHTML = `
<nav class="navbar">
  <div class="container">
    <div class="nav-inner">
      <a href="index.html" class="nav-logo">
        <div class="logo-ball"></div>
        IBERMON
      </a>
      <div class="nav-links">${navLinks}</div>
      <div class="nav-auth">${authHtml}</div>
      <button class="nav-hamburger" id="navToggle" aria-label="Menú">
        <span></span><span></span><span></span>
      </button>
    </div>
    <div class="mobile-menu" id="mobileMenu">
      ${mobileLinks}
      <div style="height:1px;background:var(--border);margin:.25rem 0"></div>
      ${mobileAuth}
    </div>
  </div>
</nav>`;

  // El HTML del footer — con links a recursos y al GitHub de la API
  const footerHTML = `
<footer class="footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="footer-logo">⬡ IBERMON</div>
        <p class="footer-desc">RPG inspirado en Pokémon ambientado en la Península Ibérica. Captura, entrena y combate con tus Ibermon.</p>
      </div>
      <div>
        <div class="footer-col-title">Navegar</div>
        <div class="footer-links">
          <a href="index.html"     class="footer-link">Inicio</a>
          <a href="catalogo.html"  class="footer-link">Catálogo</a>
          <a href="combate.html"   class="footer-link">Combate</a>
          <a href="descarga.html"  class="footer-link">Descarga</a>
          <a href="dashboard.html" class="footer-link">Mis Partidas</a>
        </div>
      </div>
      <div>
        <div class="footer-col-title">Recursos</div>
        <div class="footer-links">
          <a href="${CONFIG.GITHUB_URL}" target="_blank" rel="noopener" class="footer-link">GitHub</a>
          <a href="${CONFIG.API_BASE}/docs" target="_blank" rel="noopener" class="footer-link">API Docs</a>
          <a href="catalogo.html?modo=api" class="footer-link">Explorar API</a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 Ibermon — Proyecto TFG</span>
      <span>Hecho con ♥ en España</span>
    </div>
  </div>
</footer>`;

  // Inyecto el navbar y el footer en sus respectivos placeholders del HTML
  const navPlaceholder    = document.getElementById('navbar');
  const footerPlaceholder = document.getElementById('footer');
  if (navPlaceholder)    navPlaceholder.outerHTML    = navHTML;
  if (footerPlaceholder) footerPlaceholder.outerHTML = footerHTML;

  // Conecto el botón hamburguesa con el menú móvil
  // Uso setTimeout(0) porque el elemento acaba de ser inyectado y necesito
  // que el DOM lo procese antes de buscar el elemento
  setTimeout(() => {
    const toggle = document.getElementById('navToggle');
    const menu   = document.getElementById('mobileMenu');
    if (toggle && menu) {
      toggle.addEventListener('click', () => menu.classList.toggle('open'));
    }
  }, 0);
}

// Ejecuto buildNav cuando el DOM está listo — todas las páginas lo necesitan
document.addEventListener('DOMContentLoaded', buildNav);
