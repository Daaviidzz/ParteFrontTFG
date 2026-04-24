# Ibermon — Frontend Web

Interfaz web del videojuego **Ibermon**, un RPG 2D tipo Pokémon ambientado en la Península Ibérica. Desarrollado como parte del TFG con HTML, CSS y JavaScript puro. Consume la API REST de `ApiIbermon`.

---

## Índice

1. [Descripción](#descripción)
2. [Estructura del proyecto](#estructura-del-proyecto)
3. [Páginas](#páginas)
4. [Módulos JavaScript](#módulos-javascript)
5. [Sistema de estilos CSS](#sistema-de-estilos-css)
6. [Puesta en marcha](#puesta-en-marcha)
   - [Local (sin Docker)](#local-sin-docker)
   - [Con Docker](#con-docker)
7. [Configuración](#configuración)
8. [Conexión con la API](#conexión-con-la-api)
9. [Autenticación](#autenticación)
10. [Catálogo público](#catálogo-público)
11. [Dashboard de partidas](#dashboard-de-partidas)
12. [Combate Online (6vs6)](#combate-online-6vs6)
13. [IberBot (chatbot)](#iberbot-chatbot)
14. [Variables CSS](#variables-css)

---

## Descripción

Portal web estático multi-página para el ecosistema Ibermon:

| Sección | Ruta | Acceso |
|---|---|---|
| Landing page | `index.html` | Público |
| Catálogo público (tarjetas + API viewer) | `catalogo.html` | Público |
| Inicio de sesión | `login.html` | Público |
| Registro de cuenta | `registro.html` | Público |
| Panel de partidas | `dashboard.html` | Requiere cuenta |
| Guía de descarga | `descarga.html` | Público |
| Combate Online 6vs6 (PvP entre pestañas + CPU) | `combate.html` | Público |
| Chatbot IberBot | Todas las páginas | Público |

**Stack:** HTML5 · CSS3 (custom properties) · JavaScript ES6+ vanilla · nginx (Docker)

---

## Estructura del proyecto

```
ParteFrontTFG/
│
├── index.html          # Landing page con hero animado y preview del catálogo
├── catalogo.html       # Catálogo público: tarjetas visuales o JSON viewer tipo PokeAPI
├── login.html          # Formulario de inicio de sesión (JWT)
├── registro.html       # Formulario de registro + auto-login
├── dashboard.html      # Panel de partidas del usuario autenticado
├── descarga.html       # Guía de descarga paso a paso + FAQ
├── combate.html        # Combate online 6vs6 (PvP entre pestañas o CPU)
│
├── styles/                       # CSS dividido por responsabilidad (entrada: main.css)
│   ├── main.css                  # Solo @imports — orden de carga
│   ├── variables.css             # CSS custom properties (colores, fuentes, radios)
│   ├── components.css            # Componentes reutilizables (botones, cards, badges...)
│   ├── chatbot.css               # Estilos del chatbot flotante
│   └── pages/
│       ├── index.css             # Hero animado y feature cards
│       ├── catalogo.css          # Grid + JSON viewer
│       ├── dashboard.css         # Tarjetas de partida
│       ├── descarga.css          # Pasos de instalación + FAQ
│       └── combate.css           # Arena, HP bars, dialog box, animaciones
│
├── scripts/
│   ├── api/
│   │   └── api.js                # AuthAPI, CatalogAPI, PartidaAPI, rawFetch()
│   ├── modules/                  # Lógica reutilizada entre páginas
│   │   ├── config.js             # CONFIG.API_BASE + helpers de formato
│   │   ├── auth.js               # Gestión de sesión JWT (localStorage)
│   │   ├── nav.js                # Navbar y footer compartidos
│   │   ├── chatbot.js            # IberBot con fuzzy matching (Levenshtein)
│   │   ├── battle.js             # Motor de combate (fórmula daño + IA bot)
│   │   └── matchmaking.js        # Emparejamiento PvP por BroadcastChannel
│   └── pages/                    # Lógica específica de cada página
│       ├── index.js              # Preview de catálogo en la landing
│       ├── catalog.js            # Modo normal + modo API + modal de detalle
│       ├── dashboard.js          # Listar/renombrar/eliminar partidas
│       └── combate.js            # Orquestación UI del combate
│
├── docs/
│   └── documentacion_tecnica.md  # Documentación técnica completa del TFG
│
├── Dockerfile          # nginx:alpine sirviendo el frontend
├── nginx.conf          # Sirve estáticos + proxy /api/ → FastAPI
└── docker-compose.yml  # Stack completo: frontend + api + mongodb
```

> **Nota sobre la organización:** el proyecto se reorganizó separando los CSS por
> responsabilidad y dividiendo los scripts en `api/`, `modules/` y `pages/`. Las
> carpetas antiguas `css/` y `js/` ya no se usan.

---

## Páginas

### `index.html` — Landing page

- **Hero animado:** título en pixel font, fondo de cuadrícula animado y elemento decorativo circular giratorio
- **Stats banner:** Unity 6, REST API, JWT, multiplataforma
- **6 feature cards:** sistema de combate, captura, guardado en la nube, mundo abierto, multiplataforma, API pública
- **Preview del catálogo:** primeros 8 Ibermon cargados en tiempo real desde la API; muestra un placeholder si la API no está disponible
- **CTA de registro**

---

### `catalogo.html` — Catálogo público

Dos modos de visualización seleccionables mediante pestañas en la barra superior sticky:

#### Modo Normal (tarjetas)

Cuatro secciones: **Ibermon · Movimientos · Ítems · Logros**

- **Ibermon:** grid de tarjetas con sprite BW animado, número formateado (`#001`), nombre y badges de tipo coloreados. Click → modal con detalle completo:
  - Sprite flotante animado
  - Descripción del Pokédex
  - 4 stats en grid: catch rate, EXP yield, curva de crecimiento, evolución
  - 6 barras de estadísticas animadas (width va de 0% al valor real con CSS transition)
  - Colores de barra: rojo (<50), amarillo (50–80), verde (80–110), azul (>110)
  - Lista de movimientos aprendibles con nivel

- **Movimientos:** tabla con número, nombre, tipo (badge), potencia, precisión, PP y categoría. La categoría usa colores: azul = Especial, rojo = Fisico, gris = Estado.

- **Ítems:** grid de tarjetas con emoji según categoría, nombre, descripción y precio.

- **Logros:** grid de tarjetas con nombre, descripción y código identificador.

Todos los datos se cachean en memoria la primera vez que se cargan. La **búsqueda** por nombre filtra en tiempo real sin nueva petición.

#### Modo API (JSON viewer)

Replica la experiencia de [pokeapi.co](https://pokeapi.co):

- Panel lateral con los 8 endpoints públicos disponibles
- Click en un endpoint → muestra la URL completa en la barra superior
- Si el endpoint tiene parámetro (`{numero}`, `{codigo}`) aparece un campo de entrada
- Botón **▶ Ejecutar** → llama a la API real y muestra:
  - Código de estado HTTP (verde OK / rojo error)
  - Tiempo de respuesta en milisegundos
  - JSON con syntax highlighting: claves en azul, strings en verde, números en amarillo, booleanos/null en rojo

**Endpoints disponibles en el viewer:**

| Endpoint | Parámetro |
|---|---|
| `GET /catalogo/ibermon` | — |
| `GET /catalogo/ibermon/{numero}` | numero (ej: 1) |
| `GET /catalogo/movimientos` | — |
| `GET /catalogo/movimientos/{numero}` | numero (ej: 1) |
| `GET /catalogo/items` | — |
| `GET /catalogo/items/{numero}` | numero (ej: 1) |
| `GET /catalogo/logros` | — |
| `GET /catalogo/logros/{codigo}` | codigo (ej: primer_combate) |

---

### `login.html` — Inicio de sesión

- Formulario con usuario y contraseña
- Muestra error inline si las credenciales son incorrectas
- Tras login exitoso redirige al dashboard (o a la ruta indicada en `?next=`)
- Si ya hay sesión activa, redirige automáticamente al dashboard

---

### `registro.html` — Registro

- Campos: nombre de entrenador, email, contraseña, confirmación
- Validaciones locales: longitud mínima de contraseña (6), coincidencia de contraseñas
- Auto-login tras registro exitoso → redirige al dashboard

---

### `dashboard.html` — Panel de partidas

> Requiere autenticación. Sin sesión activa redirige a `login.html?next=dashboard.html`.

**Cabecera de usuario:** avatar, nombre de entrenador y email.

**Estadísticas globales (4 cards):**
- Partidas activas
- Medallas totales (suma de todas las partidas)
- Batallas ganadas (suma)
- Ibermon capturados (suma de pokedex_capturado)

**Tarjetas de partida:** cada partida muestra:
- Alias personalizado (o `personaje_elegido` si no tiene alias) + ID abreviado
- Mapa actual, tiempo jugado formateado (Xh XXm)
- Batallas ganadas, win rate con color (verde ≥50%, rojo <50%)
- Ibermon vistos y capturados
- Medallas como badges amarillos

**Acciones por partida:**
- **✏️ Renombrar:** sustituye el texto por un `<input>` inline; al pulsar Enter o perder el foco guarda el alias en `localStorage`
- **🗑 Eliminar:** abre un modal de confirmación; al confirmar hace `DELETE /partidas/{id}` y anima la salida de la tarjeta

---

### `descarga.html` — Guía de descarga

- 5 pasos de instalación en tarjetas secuenciales numeradas
- Tabla de requisitos mínimos y recomendados
- Botón principal de enlace a GitHub (URL configurada en `scripts/modules/config.js`)
- FAQ con acordeón nativo (`<details>/<summary>`)
- CTA de registro al final

---

### `combate.html` — Combate Online (6vs6)

Página de combate por turnos al estilo Pokémon Showdown, con cuatro pantallas
en el mismo HTML (se intercambian con la clase `.screen-active`):

1. **Selección de equipo** — Grid del catálogo con buscador. El jugador elige
   exactamente **6 Ibermon** (o pulsa "🎲 Aleatorio").
2. **Cola de matchmaking** — Anuncia presencia por `BroadcastChannel` y espera
   rival en otra pestaña. Timer visual + opción de "🤖 Jugar contra la CPU".
3. **Arena de combate** — Sprites animados, barras de PS coloreadas por %,
   caja de diálogo estilo Game Boy, log scrollable, daño flotante y animación
   de "shake" al impacto.
4. **Resultado final** — Pantalla de victoria/derrota con opción de revancha.

Detalles funcionales clave:

- **Nivel fijo 50** para todos los Ibermon — balance estable sin sistema de
  experiencia.
- **HOST/GUEST automático** — el jugador con id alfabéticamente menor calcula
  el turno (autoridad) y envía un snapshot al otro. Evita desincronizaciones.
- **Heartbeat cada 3 s** — detecta desconexión del rival tras 8 s sin ping.
- **Modo CPU** — IA básica que prioriza el movimiento de mayor daño esperado
  (potencia × STAB × efectividad). Cambia de Ibermon si baja del 20% PS.
- **Sin tocar la API** — todo el multijugador es 100% frontend con
  `BroadcastChannel`. La API solo se usa para leer el catálogo de Ibermon
  y movimientos.

> **Limitación:** `BroadcastChannel` solo funciona entre pestañas del **mismo
> navegador y mismo equipo**. Para multi-máquina se necesitaría un endpoint
> de signaling en la API (WebSocket).

---

## Módulos JavaScript

### `scripts/modules/config.js`

Configuración global y funciones utilitarias disponibles en todas las páginas (cargado primero en cada HTML).

```js
// ── Configuración ──────────────────────────────────────────────
const CONFIG = {
  API_BASE: 'http://localhost:8000',  // cambiar a '/api' con Docker
  GITHUB_URL: 'https://github.com/ibermon',
};

// ── Funciones de formato ───────────────────────────────────────
tipoBadge(tipo)               // → HTML <span class="badge-tipo tipo-Fuego">Fuego</span>
formatTime(segundos)          // → "2h 34m"  /  "45m 12s"
formatNum(numero)             // → "#001"
statColor(valor)              // → 'low' | 'mid' | 'high' | 'vhigh'
syntaxHighlight(jsonString)   // → HTML con coloreado de sintaxis JSON
imgWithFallback(src, alt, cls)// → <img> con SVG placeholder si falla la carga
```

---

### `scripts/api/api.js`

Módulo de comunicación con la API REST. Adjunta automáticamente el token JWT (si existe) en el header `Authorization`.

```js
// ── Auth ───────────────────────────────────────────────────────
AuthAPI.login(username, password)
  // POST /auth/login (form-data)
  // → { access_token, token_type }

AuthAPI.registro(username, email, password)
  // POST /auth/registro (JSON)
  // → UsuarioPublicoSchema

AuthAPI.yo()
  // GET /auth/yo  (JWT requerido)
  // → { id, username, email, fecha_registro, partidas }

// ── Catálogo (sin auth) ────────────────────────────────────────
CatalogAPI.ibermon()           // GET /catalogo/ibermon
CatalogAPI.ibermonById(n)      // GET /catalogo/ibermon/{n}
CatalogAPI.movimientos()       // GET /catalogo/movimientos
CatalogAPI.movById(n)          // GET /catalogo/movimientos/{n}
CatalogAPI.items()             // GET /catalogo/items
CatalogAPI.itemById(n)         // GET /catalogo/items/{n}
CatalogAPI.logros()            // GET /catalogo/logros
CatalogAPI.logroById(codigo)   // GET /catalogo/logros/{codigo}

// ── Partidas (JWT requerido) ───────────────────────────────────
PartidaAPI.listar()            // GET    /partidas/
PartidaAPI.obtener(id)         // GET    /partidas/{id}
PartidaAPI.eliminar(id)        // DELETE /partidas/{id}

// ── Fetch crudo para el JSON viewer ───────────────────────────
rawFetch(path)                 // → { ok, status, data, ms }
```

La función interna `apiFetch(path, options)` maneja:
- Inyección automática del JWT
- Deserialización de JSON
- Propagación de errores con el mensaje de la API (`detail`)

---

### `scripts/modules/auth.js`

Gestiona el ciclo de vida de la sesión del usuario.

```js
// ── Estado de sesión ───────────────────────────────────────────
Auth.isLoggedIn()     // → boolean
Auth.getToken()       // → string JWT | null
Auth.getUser()        // → { username, email, … } | null

// ── Acciones ───────────────────────────────────────────────────
Auth.save(token, user)   // guarda token + user en localStorage
Auth.logout()            // limpia localStorage y redirige a index.html
Auth.requireAuth()       // si no hay sesión → redirige a login.html?next=…
Auth.redirectIfLogged()  // si hay sesión → redirige a dashboard.html

// ── Inicializadores de formulario ──────────────────────────────
initLoginForm()          // enlaza el formulario de login.html
initRegisterForm()       // enlaza el formulario de registro.html
```

**Claves de `localStorage`:**

| Clave | Contenido |
|---|---|
| `ibermon_token` | JWT de acceso |
| `ibermon_user` | Objeto usuario (JSON) |
| `ibermon_aliases` | `{ "partida_id": "alias" }` — nombres personalizados |

---

### `scripts/modules/nav.js`

Inyecta el navbar y el footer en el `<div id="navbar">` y `<div id="footer">` de cada página. Se ejecuta en `DOMContentLoaded`.

**Navbar dinámico:**
- Marca como `.active` el enlace de la página actual
- Muestra "Mis Partidas" solo si hay sesión activa
- Área de auth: `Login / Registrarse` sin sesión; nombre de usuario + botón Salir con sesión
- Hamburger menu colapsable en móvil

**Footer:**
- Logo, descripción corta
- Columnas: Navegar / Recursos (enlace a GitHub y a la documentación Swagger de la API)

---

### `scripts/modules/chatbot.js`

Chatbot flotante **IberBot** con base de conocimiento por reglas + búsqueda
difusa (algoritmo de Levenshtein con umbral adaptativo por longitud, así
"toriverd" se resuelve a "Toriverde" y avisa al usuario con "¿Quisiste decir...?").

**Activación:** botón rojo pulsante en la esquina inferior derecha → abre/cierra el panel de chat.

**Motor de respuesta:**
1. El texto del usuario se normaliza: minúsculas, sin tildes, sin puntuación
2. Se compara con los patrones de cada entrada en `CHATBOT_KB`
3. Se devuelve la primera respuesta cuyo patrón coincida
4. Si no hay coincidencia, se elige aleatoriamente un mensaje de fallback

**Categorías de conocimiento:**

| Categoría | Palabras clave detectadas | Respuesta enlaza a |
|---|---|---|
| Saludo | hola, buenas, hey | — |
| Registro | registrar, cuenta, signup | `registro.html` |
| Login | login, iniciar sesion, acceder | `login.html` |
| Partidas | partida, save, dashboard | `dashboard.html` |
| Eliminar partida | borrar partida, eliminar partida | `dashboard.html` |
| Renombrar | renombrar, alias, cambiar nombre | `dashboard.html` |
| Ibermon | ibermon, pokemon, pokedex | `catalogo.html` |
| Movimientos | movimiento, ataque, habilidad | `catalogo.html` |
| Ítems | item, objeto, pocion | `catalogo.html` |
| Logros | logro, achievement | `catalogo.html` |
| API | api, endpoint, json | `catalogo.html` |
| Descarga | descargar, juego, download | `descarga.html` |
| GitHub | github, codigo, repositorio | `descarga.html` |
| Batallas | batalla, combate, luchar | `descarga.html` |
| Ayuda | ayuda, help, opciones | Respuesta multi-enlace |
| Despedida | adios, bye, hasta luego | — |

**Respuestas rápidas preconfiguradas:**
- ¿Cómo me registro? · Ver Ibermon · Mis partidas · Descargar el juego

**Añadir nuevas respuestas** → editar el array `CHATBOT_KB` en `chatbot.js`:
```js
{
  p: ['palabra_clave1', 'palabra_clave2'],
  r: 'Respuesta con <a href="pagina.html">enlace</a>.'
},
```

---

### `scripts/pages/catalog.js`

Toda la lógica de `catalogo.html`. Mantiene estado con variables de módulo.

**Estado interno:**

| Variable | Valores | Descripción |
|---|---|---|
| `currentSection` | `'ibermon'` `'movimientos'` `'items'` `'logros'` | Sección activa |
| `currentMode` | `'normal'` `'api'` | Modo de visualización |
| `currentFilter` | `string` | Texto de búsqueda actual |
| `allData` | `{ ibermon: [], … }` | Caché de datos por sección |

**Flujo modo normal:**
1. `renderNormal()` muestra spinner
2. Si `allData[section]` está vacío → llama a la API y guarda la respuesta
3. Aplica `currentFilter` sobre el campo `nombre`/`codigo`
4. Llama al renderizador específico de la sección (`renderIbermonGrid`, `renderMovimientosTable`, etc.)
5. Para Ibermon, adjunta listeners que abren el modal de detalle

**Flujo modo API:**
1. `renderApiMode()` construye el layout de dos columnas
2. `selectEndpoint(i)` muestra la URL y el campo de parámetro si aplica
3. `executeEndpoint()` → `rawFetch()` → muestra estado HTTP + tiempo + JSON formateado

**Modal de detalle Ibermon:**
- `openIbermonModal(numero)` → `GET /catalogo/ibermon/{numero}`
- Barras de stats: `width: 0%` → `width: X%` via CSS transition (activada 50ms después del render)

---

### `scripts/pages/dashboard.js`

Lógica de `dashboard.html`.

**Inicialización:**
1. `Auth.requireAuth()` — redirige si no hay sesión
2. Rellena nombre y email del usuario en la cabecera
3. `loadPartidas()` → `PartidaAPI.listar()` → `renderPartidas(partidas)`
4. `updateStats(partidas)` calcula los totales de las 4 cards superiores

**Renombrar:**
- El alias se guarda en `localStorage['ibermon_aliases']` como `{ id: alias }`
- La API no tiene endpoint de renombrado; el alias es solo visible en esta web
- Al editar: el `<div class="partida-char">` se sustituye por `<input class="rename-input">`; al pulsar Enter o perder foco se guarda

**Eliminar:**
- `confirmDelete(id)` abre el modal con dos listeners (`doDelete` / `cancelar`)
- `executeDelete(id)` → anima opacity+scale a 0 → `DELETE /partidas/{id}` → elimina el DOM
- Si era la última tarjeta, recarga la vista mostrando el estado vacío

---

### `scripts/modules/battle.js`

Motor de combate **independiente de la UI**. Calcula daño, resuelve turnos y
mantiene el estado de los dos equipos. Lo separé del resto para poder
reutilizarlo tanto en el modo CPU como en el multijugador.

```js
Battle.NIVEL_FIJO              // 50 (todos los Ibermon a Nv.50 para balance)
Battle.buildUnit(detalle, movs)// Construye una unidad de combate desde el catálogo
Battle.resolverTurno(estado, accionA, accionB)
                               // Devuelve un array de eventos (la UI los reproduce)
Battle.equipoKO(equipo)        // true si todos los Ibermon están K.O.
Battle.decidirAccionBot(estado, lado)
                               // IA del bot: prioriza mejor daño esperado
```

**Fórmula de daño** (basada en Pokémon, simplificada):

```
daño = ((2*N/5 + 2) * POT * A/D / 50 + 2) * STAB * TIPO * CRIT * RND
```

Donde STAB = 1.5 si tipo del movimiento coincide con tipo del Ibermon, TIPO
es la tabla de efectividades reducida (×0, ×0.5, ×1, ×2, ×4), CRIT 1/16 con
×1.5, y RND aleatorio entre 0.85 y 1.00. La tabla de tipos cubre los
emparejamientos más relevantes; los pares no definidos devuelven 1 (neutro).

**Selección de movimientos:** se eligen los 4 movimientos de mayor nivel
aprendido (≤ Nv.50) del array `movimientos_posibles` del catálogo. Si el
Ibermon no tiene ninguno, recibe un "Placaje" genérico.

---

### `scripts/modules/matchmaking.js`

Emparejamiento **100% frontend** vía `BroadcastChannel`. No requiere endpoints
nuevos en la API.

```js
Matchmaking.init(nombre)       // Una vez al cargar la página
Matchmaking.buscar()           // Anuncia presencia y empareja con otra pestaña
Matchmaking.enviarEquipo(eq)   // Envía el equipo al rival
Matchmaking.enviarAccion(acc)  // Envía la acción del turno
Matchmaking.enviarResultado(eventos, snapshot)
                               // (HOST) envía eventos resueltos al GUEST
Matchmaking.rendirse()         // Notifica al rival
Matchmaking.soyHost()          // true si actúo como autoridad
Matchmaking.on('emparejado',     fn)
Matchmaking.on('equipoRecibido', fn)
Matchmaking.on('accionRecibida', fn)
Matchmaking.on('resultadoRecibido', fn)
Matchmaking.on('rivalSeFue',     fn)
```

**Protocolo de mensajes** (sobre el canal `ibermon-matchmaking`):

| Tipo | Descripción |
|---|---|
| `presencia` | "Estoy buscando partida" — se publica cada 2 s |
| `emparejar` | Confirma el emparejamiento al peer encontrado |
| `equipo` | Datos planos del equipo (sprites, stats, movs, PS, etc.) |
| `accion` | Acción del turno: `{ tipo: 'mov', indice }` o `{ tipo: 'cambio', slot }` |
| `resultado` | (HOST→GUEST) Eventos del turno resueltos + snapshot del estado |
| `rendicion` | El rival se rinde |
| `ping` | Heartbeat cada 3 s, timeout de 8 s |

**HOST/GUEST:** el id alfabéticamente menor hace de HOST. El HOST resuelve el
turno y envía un snapshot al GUEST, que rehidrata su estado y reproduce los
mismos eventos. Cuando el GUEST muestra los eventos, invierte `lado` A↔B para
que "A" siempre sea su propio equipo en su pantalla.

---

### `scripts/pages/combate.js`

Orquestación de la página de combate. Conecta tres piezas:

1. **UI** — pantallas, botones, sprites, barras de PS, log, modales.
2. **Motor** (`Battle`) — calcula qué pasa cada turno.
3. **Matchmaking** (`Matchmaking`) — conecta con rival humano (o entra en modo CPU).

**Flujo de un turno multijugador:**

```
1. Jugador pulsa un movimiento → Combate.accionPendiente
                              → Matchmaking.enviarAccion()
2. Llega la acción del rival   → Combate.accionRival
3. Si soy HOST: Battle.resolverTurno() → eventos
                              → Matchmaking.enviarResultado(eventos, snapshot)
                              → reproducirEventos(eventos)
4. Si soy GUEST: espero `resultadoRecibido`
              → aplicarSnapshot(estado)
              → reproducirEventos(invertirLadoEvento(eventos))
```

**Animaciones:** sprites con shake al atacar, flash rojo al impacto, daño
flotante (`-25!` con clase `.crit` para críticos), barras de PS coloreadas
por % (verde >50%, amarillo 20-50%, rojo <20%), caja de diálogo con texto
escalonado para que parezca un combate real y no un log vomitando texto.

---

## Sistema de estilos CSS

El CSS está dividido en `styles/` por responsabilidad. El punto de entrada es
`styles/main.css`, que solo hace `@import` de los demás. Cada HTML solo
necesita incluir `styles/main.css`.

| Archivo | Contenido |
|---|---|
| `variables.css` | CSS custom properties (colores, fuentes, radios, sombras) y reset base |
| `components.css` | Botones, cards, badges, modales, alertas, formularios — reutilizables |
| `chatbot.css` | Burbuja flotante, panel, animación de typing, fuzzy note |
| `pages/index.css` | Hero animado, anillos orbitales, feature cards |
| `pages/catalogo.css` | Grid + JSON viewer + modal de detalle de Ibermon |
| `pages/dashboard.css` | Tarjetas de partida con stats y acciones |
| `pages/descarga.css` | Pasos de instalación numerados, FAQ |
| `pages/combate.css` | Arena, HP bars, dialog box GB, log scrollable, animaciones |

`components.css` contiene las secciones:

| Sección | Contenido |
|---|---|
| Reset y base | box-sizing, body, links, imágenes |
| Tipografía | Helpers de color y fuente |
| Layout | `.container`, `.grid-2/3/4`, `.flex-*`, spacing |
| Navbar | Sticky, blur backdrop, logo animado, hamburger |
| Botones | `.btn`, variantes: primary/secondary/ghost/danger/pixel |
| Cards | `.card`, `.ibermon-card`, `.partida-card` |
| Badges de tipo | `.badge-tipo` + clase específica por tipo (`tipo-Fuego`, etc.) |
| Barras de stats | `.stat-row`, `.stat-bar-fill` (animadas por CSS transition) |
| Pestañas | `.tabs`, `.tab-btn` |
| Formularios | `.form-group`, `.form-control`, alertas |
| Modal | Overlay + box + animación `modal-in` |
| JSON viewer | `.json-panel`, colores de sintaxis |
| Endpoint list | `.endpoint-item`, `.endpoint-method` |
| Búsqueda y filtros | `.search-bar`, `.filter-btn` |
| Footer | Grid 3 columnas, links |
| Animaciones | `spin`, `fade-up`, `float`, `pulse-glow`, `slide-up`, `modal-in` |
| Responsive | Breakpoints 1024px, 768px y 480px |

---

## Variables CSS

Definidas en `:root` de `styles/variables.css` y disponibles en toda la app:

```css
/* ── Fondos ──────────────────────── */
--bg-deep:    #060610   /* más oscuro, fondos de inputs y code */
--bg-primary: #0d0d1a   /* fondo base del body */
--bg-surface: #131326   /* superficie ligeramente elevada */
--bg-card:    #1a1a2e   /* tarjetas */
--bg-card-h:  #21213f   /* hover de tarjeta */

/* ── Bordes ──────────────────────── */
--border:     #2a2a4a   /* borde sutil */
--border-b:   #4444aa   /* borde destacado (azul) */

/* ── Colores ─────────────────────── */
--red:        #e63946   /* primario (Pokeball, botones, error) */
--red-dark:   #c1121f
--blue:       #4cc9f0   /* secundario (stats, links) */
--blue-dark:  #3a86ff
--yellow:     #f9c74f   /* medallas, highlights */
--green:      #06d6a0   /* éxito, stats altos */
--purple:     #9d4edd   /* acento extra */

/* ── Glows (box-shadow) ──────────── */
--red-glow:    rgba(230,57,70,.35)
--blue-glow:   rgba(76,201,240,.25)
--yellow-glow: rgba(249,199,79,.25)

/* ── Texto ───────────────────────── */
--text:       #f1faee   /* texto principal */
--text-dim:   #8da9c4   /* texto secundario */
--text-muted: #4d5d80   /* texto deshabilitado */

/* ── Tipografía ──────────────────── */
--font-pixel: 'Press Start 2P', monospace   /* títulos y labels */
--font-main:  'Inter', sans-serif           /* texto general */
```

---

## Puesta en marcha

### Local (sin Docker)

**Requisito previo:** la API de Ibermon corriendo en `http://localhost:8000` con CORS habilitado.

**Opción A — VS Code Live Server (recomendado)**

1. Instala la extensión **Live Server** en VS Code
2. Abre la carpeta `ParteFrontTFG` en VS Code
3. Click derecho en `index.html` → *Open with Live Server*
4. Se abre en `http://127.0.0.1:5500`

**Opción B — Python HTTP server**

```bash
cd ParteFrontTFG
python -m http.server 3000
# Abre: http://localhost:3000
```

> **CORS:** la API debe tener habilitados los orígenes `localhost:5500` y/o `localhost:3000`.
> Ver sección [Configuración CORS](#configuración-cors) en el README de la API.

---

### Con Docker

El `docker-compose.yml` levanta el stack completo:

| Contenedor | Puerto local | Descripción |
|---|---|---|
| `ibermon_frontend` | `3000` | nginx sirviendo el frontend |
| `ibermon_api` | `8000` | FastAPI (imagen `ibermon_api:latest`) |
| `ibermon_mongodb` | `27017` | MongoDB 7.0 |

**Pasos:**

```bash
# 1. Construir la imagen de la API desde su carpeta
cd C:\Users\david\IdeaProjects\ApiIbermon
docker build -t ibermon_api:latest .

# 2. Cambiar API_BASE en scripts/modules/config.js para usar el proxy nginx
#    API_BASE: '/api'   ← en lugar de 'http://localhost:8000'

# 3. Levantar el stack
cd C:\Users\david\Desktop\ParteFrontTFG
docker-compose up -d

# 4. Poblar la BD (dentro del contenedor de la API)
docker-compose exec ibermon_api python -m app.utils.seed_pokeapi

# 5. Abrir http://localhost:3000
```

```bash
# Comandos útiles
docker-compose logs -f frontend   # logs del nginx
docker-compose logs -f api        # logs de la API
docker-compose down               # parar todo
docker-compose up -d --build      # reconstruir y levantar
```

Nginx actúa como proxy: las peticiones a `/api/*` se redirigen internamente a `http://ibermon_api:8000/*`, eliminando problemas de CORS.

---

## Configuración

Todas las opciones ajustables están en `scripts/modules/config.js`:

```js
const CONFIG = {
  // URL base de la API REST
  // ┌─ Desarrollo local sin Docker:
  API_BASE: 'http://localhost:8000',
  // └─ Con Docker nginx (proxy /api/):
  //    API_BASE: '/api',

  // URL del repositorio GitHub del juego
  // Actualiza esto con la URL real del repositorio
  GITHUB_URL: 'https://github.com/ibermon',
};
```

---

## Conexión con la API

El frontend consume la API de Ibermon (`ApiIbermon`).

### Endpoints públicos (sin autenticación)

Usados en `catalogo.html` — accesibles sin cuenta de usuario.

| Método | Ruta | Schema de respuesta |
|---|---|---|
| `GET` | `/catalogo/ibermon` | `List[IbermonCatalogoResumenSchema]` |
| `GET` | `/catalogo/ibermon/{numero}` | `IbermonCatalogoDetalleSchema` |
| `GET` | `/catalogo/movimientos` | `List[MovimientoCatalogoResumenSchema]` |
| `GET` | `/catalogo/movimientos/{numero}` | `MovimientoCatalogoDetalleSchema` |
| `GET` | `/catalogo/items` | `List[ItemCatalogoResumenSchema]` |
| `GET` | `/catalogo/items/{numero}` | `ItemCatalogoDetalleSchema` |
| `GET` | `/catalogo/logros` | `List[LogroCatalogoSchema]` |
| `GET` | `/catalogo/logros/{codigo}` | `LogroCatalogoSchema` |

### Endpoints de autenticación

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| `POST` | `/auth/registro` | JSON `{username, email, password}` | `UsuarioPublicoSchema` |
| `POST` | `/auth/login` | form-data `username & password` | `{access_token, token_type}` |
| `GET` | `/auth/yo` | *(JWT header)* | `UsuarioPublicoSchema` |

### Endpoints de partidas (requieren JWT)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/partidas/` | Listar partidas del usuario |
| `GET` | `/partidas/{id}` | Detalle completo |
| `DELETE` | `/partidas/{id}` | Eliminar partida |

El JWT se envía en todas las peticiones autenticadas:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5...
```

---

## Autenticación

**Flujo de login:**

```
login.html
  → POST /auth/login (form-data: username + password)
  ← { access_token: "eyJ..." }
  → GET /auth/yo (con el token recién obtenido)
  ← { id, username, email, ... }
  → Auth.save(token, user)   ← guarda en localStorage
  → window.location.href = 'dashboard.html'
```

**Protección de rutas:** `dashboard.html` llama a `Auth.requireAuth()` al iniciar. Si no hay token válido, redirige a `login.html?next=dashboard.html` para volver tras el login.

**Cierre de sesión:** `Auth.logout()` elimina `ibermon_token` e `ibermon_user` de localStorage y redirige a `index.html`.

---

## Catálogo público

### Caché de datos

Los datos se cargan una sola vez por sección y se guardan en el objeto `allData`:

```js
allData = {
  ibermon:     [...],   // cargado la primera vez que se abre la sección
  movimientos: [...],
  items:       [...],
  logros:      [...],
}
```

Al cambiar de sección, si ya hay datos cacheados se reutilizan sin nueva petición de red.

### Barras de estadísticas animadas

La animación usa CSS `transition: width 1s ease-out`. El proceso:

1. Se renderiza la barra con `width: 0%`
2. Tras 50ms, JS asigna `style.width = (valor / 170 * 100).toFixed(1) + '%'`
3. CSS hace la transición suavemente

El denominador `170` es empírico para que stats altos (>150) muestren barras casi llenas sin truncar.

### Sprites de Ibermon

Si el seed se hizo con `seed_pokeapi.py`, los sprites son URLs de GitHub Raw:
```
https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/
  versions/generation-v/black-white/animated/{id}.gif   ← prioridad 1
  versions/generation-v/black-white/{id}.png            ← prioridad 2
other/official-artwork/{id}.png                         ← prioridad 3
{id}.png                                                ← fallback
```

Si la URL del sprite falla (evento `onerror`), `imgWithFallback()` muestra automáticamente un SVG placeholder con `?`.

---

## Dashboard de partidas

### Acciones disponibles

| Acción | Mecanismo |
|---|---|
| Ver partidas | `GET /partidas/` al cargar la página |
| Renombrar | Alias guardado en `localStorage` (no en la API) |
| Eliminar | Modal de confirmación → `DELETE /partidas/{id}` |

### Lo que NO puede hacer el usuario desde la web

- Crear partidas (solo desde el juego Unity)
- Modificar el equipo de Ibermon, el inventario o el mapa
- La API no expone endpoint de renombrado de partida

### Alias de partida (localStorage)

```js
// Estructura en localStorage['ibermon_aliases']:
{
  "64a1b2c3d4e5f6a7b8c9d0e1": "Mi partida principal",
  "64a1b2c3d4e5f6a7b8c9d0e2": "Run shiny"
}
```

Si el usuario borra el localStorage o accede desde otro navegador/dispositivo, los alias se pierden (son locales al navegador).

---

## Combate Online (6vs6)

La página `combate.html` permite jugar partidas 6vs6 entre pestañas o contra
la CPU. **No requiere backend nuevo**: todo el matchmaking y la resolución se
hacen en el frontend.

### Arquitectura

| Pieza | Archivo | Responsabilidad |
|---|---|---|
| Motor | `scripts/modules/battle.js` | Cálculo de daño, orden de turno, IA bot |
| Matchmaking | `scripts/modules/matchmaking.js` | Emparejamiento por `BroadcastChannel` |
| Página | `scripts/pages/combate.js` | UI, animaciones, ciclo de turno |
| Estilos | `styles/pages/combate.css` | Arena, sprites, HP bars, dialog box |

### Probar el combate multijugador (entre pestañas)

1. Abre `combate.html` en una **pestaña** del navegador.
2. Selecciona **6 Ibermon** y pulsa "▶ Buscar rival".
3. Abre `combate.html` en **otra pestaña** del mismo navegador.
4. Selecciona otros 6 Ibermon y pulsa "▶ Buscar rival".
5. Las dos pestañas se emparejan automáticamente y el combate empieza.

> Si solo abres una pestaña, después de unos segundos puedes pulsar
> "🤖 Jugar contra la CPU" para enfrentarte a un equipo aleatorio.

### Reglas del combate

- **Nivel 50** fijo para todos los Ibermon (balance estable).
- **6 Ibermon por equipo** — el HTML tiene 6 slots y los JS validan el límite.
- **4 movimientos por Ibermon** — los aprendidos al nivel más alto ≤ 50.
- **Orden de turno**: primero los cambios, luego los ataques ordenados por
  prioridad del movimiento, y en caso de empate por velocidad. Empate total =
  cara o cruz.
- **Crítico**: 1/16 con multiplicador ×1.5.
- **Aleatoriedad**: factor 0.85–1.00 sobre el daño base.
- **STAB**: ×1.5 si el tipo del movimiento coincide con el tipo del Ibermon.

### Limitaciones conocidas

- `BroadcastChannel` solo enlaza pestañas del **mismo equipo**. Para multi-máquina
  haría falta un endpoint de signaling (WebSocket) en la API.
- Los **estados** (paralizado, dormido, etc.) no están implementados — los
  movimientos de potencia 0 simplemente se muestran como "sin efecto aparente".
  El TFG se centra en el combate básico, no en clonar Pokémon entero.
- No hay **objetos en combate** ni **habilidades** — la fórmula de daño es
  pura (Ataque/Defensa, STAB, tipo, crítico, RNG).

---

## IberBot (chatbot)

**IberBot** es un chatbot de ayuda basado en coincidencia de palabras clave +
fuzzy matching (algoritmo de Levenshtein). No usa IA ni llamadas externas; toda
la lógica es local en `scripts/modules/chatbot.js`.

### Motor de respuesta

```
texto_usuario
  → normalizar (minúsculas + quitar tildes + quitar puntuación)
  → comparar con cada entrada de CHATBOT_KB
  → primera coincidencia → devuelve respuesta (puede incluir HTML con enlaces)
  → sin coincidencia → mensaje aleatorio de CHATBOT_DEFAULTS
```

### Añadir respuestas al chatbot

Editar el array `CHATBOT_KB` en `scripts/modules/chatbot.js`:

```js
const CHATBOT_KB = [
  // ...
  {
    p: ['palabra_clave1', 'otra_clave'],   // al menos una debe estar en el texto
    r: 'Respuesta. Puedes incluir <a href="pagina.html">enlaces</a>.',
  },
];
```

### Añadir botones de respuesta rápida

Editar el array `QUICK_REPLIES`:

```js
const QUICK_REPLIES = [
  { label: '¿Cómo me registro?', msg: 'registrar' },
  // añadir aquí:
  { label: 'Mi pregunta', msg: 'palabra_clave' },
];
```

---

## Notas de desarrollo

- **Sin frameworks ni build step:** todo es HTML/CSS/JS puro. Basta con servir los archivos estáticos.
- **Fuentes externas:** `Press Start 2P` e `Inter` se cargan desde Google Fonts vía `@import` en el CSS. Sin conexión a internet el sitio funciona pero con fuentes del sistema.
- **CORS:** imprescindible configurar el middleware de CORS en la API. Ver `app/main.py` en `ApiIbermon`. Los orígenes permitidos por defecto son `localhost:3000`, `localhost:5500`, `localhost:5501` y `localhost:8080`.
- **Sin paginación:** el catálogo carga todos los datos de golpe. Funciona bien para cientos de Ibermon, pero si el catálogo creciera mucho habría que añadir paginación tanto en la API como en el frontend.
- **Categoría de movimientos:** el modelo almacena `"Fisico"` (sin tilde) para la categoría física. El frontend compara con `'Fisico'` (sin tilde). No usar `'Físico'` con tilde o el coloreado no funcionará.
