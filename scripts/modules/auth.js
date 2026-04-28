// Sesion de usuario: token JWT en localStorage + formularios de login/registro

const Auth = {
  KEY_TOKEN: 'ibermon_token',
  KEY_USER:  'ibermon_user',

  getToken() {
    return localStorage.getItem(this.KEY_TOKEN);
  },

  getUser() {
    const u = localStorage.getItem(this.KEY_USER);
    return u ? JSON.parse(u) : null;
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  save(token, user) {
    localStorage.setItem(this.KEY_TOKEN, token);
    localStorage.setItem(this.KEY_USER, JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem(this.KEY_TOKEN);
    localStorage.removeItem(this.KEY_USER);
    window.location.href = 'index.html';
  },

  // Sin sesion: redirige al login con ?next= para volver despues
  requireAuth() {
    if (!this.isLoggedIn()) {
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = `login.html?next=${next}`;
      return false;
    }
    return true;
  },

  // Si ya hay sesion y entra en login/registro, lo manda al dashboard
  redirectIfLogged() {
    if (this.isLoggedIn()) {
      window.location.href = 'dashboard.html';
    }
  },
};


function initLoginForm() {
  Auth.redirectIfLogged();

  const form  = document.getElementById('loginForm');
  const errEl = document.getElementById('loginError');
  const btn   = document.getElementById('loginBtn');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    errEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Entrando...';

    const username = form.username.value.trim();
    const password = form.password.value;

    try {
      const { access_token } = await AuthAPI.login(username, password);

      // Guardo el token antes de pedir /auth/yo
      localStorage.setItem(Auth.KEY_TOKEN, access_token);

      const user = await AuthAPI.yo();
      Auth.save(access_token, user);

      const params = new URLSearchParams(window.location.search);
      window.location.href = params.get('next') || 'dashboard.html';

    } catch (err) {
      errEl.textContent = err.message;
      btn.disabled  = false;
      btn.textContent = 'Iniciar Sesión';
    }
  });
}


function initRegisterForm() {
  Auth.redirectIfLogged();

  const form  = document.getElementById('registerForm');
  const errEl = document.getElementById('registerError');
  const okEl  = document.getElementById('registerOk');
  const btn   = document.getElementById('registerBtn');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    errEl.textContent = '';
    okEl.textContent  = '';

    const username = form.username.value.trim();
    const email    = form.email.value.trim();
    const password = form.password.value;
    const confirm  = form.confirm.value;

    if (password !== confirm) {
      errEl.textContent = 'Las contraseñas no coinciden.';
      return;
    }
    if (password.length < 6) {
      errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }

    btn.disabled    = true;
    btn.textContent = 'Registrando...';

    try {
      await AuthAPI.registro(username, email, password);

      // Login automatico con las mismas credenciales
      const { access_token } = await AuthAPI.login(username, password);
      localStorage.setItem(Auth.KEY_TOKEN, access_token);
      const user = await AuthAPI.yo();
      Auth.save(access_token, user);

      okEl.textContent = '¡Registro completado! Redirigiendo...';
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);

    } catch (err) {
      errEl.textContent = err.message;
      btn.disabled    = false;
      btn.textContent = 'Crear cuenta';
    }
  });
}


// Oculta el div de alerta cuando su textContent esta vacio
function initAlertToggle(...ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    Object.defineProperty(el, 'textContent', {
      set(v) {
        this.innerText = v;
        this.style.display = v ? 'block' : 'none';
      },
    });
    el.textContent = '';
  });
}
