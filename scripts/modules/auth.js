/**
 * scripts/modules/auth.js — Gestión de sesión de usuario (JWT)
 *
 * Este módulo se encarga de todo lo relacionado con la sesión:
 * guardar el token en localStorage, comprobar si el usuario
 * está logueado, y manejar los formularios de login y registro.
 *
 * Lo separé de api.js porque el manejo de sesión es lógica de
 * negocio del frontend, no comunicación con la API. Son cosas
 * distintas y así es más fácil de entender cada parte.
 */


// Objeto Auth: agrupa todo lo relacionado con la sesión
// bajo el mismo espacio de nombres, al estilo de un módulo en Python.
const Auth = {
  // Las claves de localStorage — las defino aquí para no escribirlas a mano
  // en cada sitio y evitar errores de tipeo
  KEY_TOKEN: 'ibermon_token',
  KEY_USER:  'ibermon_user',

  /** Recupera el token JWT guardado, o null si no hay sesión */
  getToken() {
    return localStorage.getItem(this.KEY_TOKEN);
  },

  /** Recupera el objeto de usuario guardado, o null si no hay sesión */
  getUser() {
    const u = localStorage.getItem(this.KEY_USER);
    return u ? JSON.parse(u) : null;
  },

  /** Comprueba si hay una sesión activa (simplemente si existe el token) */
  isLoggedIn() {
    return !!this.getToken();
  },

  /**
   * Guarda el token y los datos del usuario tras el login.
   * Llamo a esto justo después de hacer login exitoso.
   */
  save(token, user) {
    localStorage.setItem(this.KEY_TOKEN, token);
    localStorage.setItem(this.KEY_USER, JSON.stringify(user));
  },

  /**
   * Cierra la sesión eliminando los datos del localStorage
   * y redirigiendo a la página principal.
   */
  logout() {
    localStorage.removeItem(this.KEY_TOKEN);
    localStorage.removeItem(this.KEY_USER);
    window.location.href = 'index.html';
  },

  /**
   * Guard de páginas protegidas.
   * Si el usuario no está logueado, lo mando al login con el parámetro
   * "next" para que después del login vuelva a donde estaba.
   * Lo llamo al inicio de dashboard.html.
   */
  requireAuth() {
    if (!this.isLoggedIn()) {
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = `login.html?next=${next}`;
      return false;
    }
    return true;
  },

  /**
   * Si el usuario ya está logueado e intenta ir a login o registro,
   * lo mando directamente al dashboard para no confundirle.
   */
  redirectIfLogged() {
    if (this.isLoggedIn()) {
      window.location.href = 'dashboard.html';
    }
  },
};


// Formulario de login: guarda el token y redirige si todo va bien,
// o muestra el error en el formulario si algo falla.
function initLoginForm() {
  // Si ya está logueado no tiene sentido estar en el login
  Auth.redirectIfLogged();

  const form  = document.getElementById('loginForm');
  const errEl = document.getElementById('loginError');
  const btn   = document.getElementById('loginBtn');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();  // evito que el formulario recargue la página
    errEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Entrando...';

    const username = form.username.value.trim();
    const password = form.password.value;

    try {
      // Primero hago login para obtener el token
      const { access_token } = await AuthAPI.login(username, password);

      // Necesito guardar el token temporalmente para poder hacer la siguiente llamada
      localStorage.setItem(Auth.KEY_TOKEN, access_token);

      // Con el token ya guardado, pido los datos del usuario
      const user = await AuthAPI.yo();

      // Ahora sí guardo todo junto de forma oficial
      Auth.save(access_token, user);

      // Redirijo a donde quería ir el usuario (si vino de una página protegida)
      // o al dashboard por defecto
      const params = new URLSearchParams(window.location.search);
      window.location.href = params.get('next') || 'dashboard.html';

    } catch (err) {
      errEl.textContent = err.message;
      btn.disabled  = false;
      btn.textContent = 'Iniciar Sesión';
    }
  });
}


// Formulario de registro: crea la cuenta y hace login automático
// para que el usuario no tenga que introducir los datos dos veces.
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

    // Validaciones del lado del cliente — antes de hacer la petición
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
      // 1. Creo la cuenta
      await AuthAPI.registro(username, email, password);

      // 2. Hago login automático con las mismas credenciales
      const { access_token } = await AuthAPI.login(username, password);
      localStorage.setItem(Auth.KEY_TOKEN, access_token);
      const user = await AuthAPI.yo();
      Auth.save(access_token, user);

      // 3. Muestro mensaje de éxito y redirijo después de 1.2 segundos
      okEl.textContent = '¡Registro completado! Redirigiendo...';
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);

    } catch (err) {
      errEl.textContent = err.message;
      btn.disabled    = false;
      btn.textContent = 'Crear cuenta';
    }
  });
}


// Helper para los divs de alerta: se muestran u ocultan según si tienen texto.
// Se llama desde los HTML de login y registro.
function initAlertToggle(...ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    // Sobreescribo el setter de textContent para que controle display
    Object.defineProperty(el, 'textContent', {
      set(v) {
        this.innerText = v;
        this.style.display = v ? 'block' : 'none';
      },
    });
    el.textContent = '';  // oculto el div al inicio
  });
}
