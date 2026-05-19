// Inyecta el navbar y el footer en cada pagina

function buildNav() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const isLogged    = Auth.isLoggedIn();
  const user        = Auth.getUser();

  const links = [
    { href: 'index.html',     label: 'Inicio' },
    { href: 'catalogo.html',  label: 'Catálogo' },
    { href: 'combate.html',   label: 'Combate' },
    { href: 'dashboard.html', label: 'Mis Partidas', requiresAuth: true },
    { href: 'descarga.html',  label: 'Descarga' },
  ];

  const navLinks = links
    .filter(l => !l.requiresAuth || isLogged)
    .map(l => {
      const active = currentPage === l.href ? 'active' : '';
      return `<a href="${l.href}" class="nav-link ${active}">${l.label}</a>`;
    })
    .join('');

  const authHtml = isLogged
    ? `<div class="nav-user">
         <span>Hola, <strong>${user?.username || 'Entrenador'}</strong></span>
         <button class="btn btn-ghost btn-sm" onclick="Auth.logout()">Salir</button>
       </div>`
    : `<a href="login.html"    class="btn btn-ghost btn-sm">Entrar</a>
       <a href="registro.html" class="btn btn-primary btn-sm">Registrarse</a>`;

  const mobileLinks = links
    .filter(l => !l.requiresAuth || isLogged)
    .map(l => `<a href="${l.href}" class="nav-link">${l.label}</a>`)
    .join('');

  const mobileAuth = isLogged
    ? `<button class="btn btn-ghost btn-sm" onclick="Auth.logout()">Cerrar sesión</button>`
    : `<a href="login.html"    class="btn btn-ghost btn-sm">Entrar</a>
       <a href="registro.html" class="btn btn-primary btn-sm">Registrarse</a>`;

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
          <a href="${CONFIG.API_BASE}/docs" target="_blank" rel="noopener" class="footer-link">API Docs</a>
          <a href="catalogo.html?modo=api" class="footer-link">Explorar API</a>
          <a href="descarga.html#estado-descarga" class="footer-link">Estado del juego</a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 Ibermon — Proyecto TFG</span>
      <span>Hecho con ♥ en España</span>
    </div>
  </div>
</footer>`;

  const navPlaceholder    = document.getElementById('navbar');
  const footerPlaceholder = document.getElementById('footer');
  if (navPlaceholder)    navPlaceholder.outerHTML    = navHTML;
  if (footerPlaceholder) footerPlaceholder.outerHTML = footerHTML;

  // El elemento se acaba de inyectar, espero al siguiente tick para enlazar el toggle
  setTimeout(() => {
    const toggle = document.getElementById('navToggle');
    const menu   = document.getElementById('mobileMenu');
    if (toggle && menu) {
      toggle.addEventListener('click', () => menu.classList.toggle('open'));
    }
  }, 0);
}

document.addEventListener('DOMContentLoaded', buildNav);
