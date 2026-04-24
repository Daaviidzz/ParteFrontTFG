# Documentación Técnica — Ibermon Web Frontend
## Trabajo de Fin de Grado

---

## Índice

1. [Descripción del Proyecto](#1-descripción-del-proyecto)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Estructura de Ficheros del Frontend](#4-estructura-de-ficheros-del-frontend)
5. [Módulos JavaScript](#5-módulos-javascript)
6. [Páginas de la Aplicación](#6-páginas-de-la-aplicación)
7. [Sistema de Estilos (CSS)](#7-sistema-de-estilos-css)
8. [API REST — Backend](#8-api-rest--backend)
9. [Autenticación con JWT](#9-autenticación-con-jwt)
10. [Chatbot IberBot](#10-chatbot-iberbot)
11. [Combate Online 6vs6](#11-combate-online-6vs6)
12. [Despliegue con Docker](#12-despliegue-con-docker)
13. [Seguridad](#13-seguridad)
14. [Decisiones de Diseño](#14-decisiones-de-diseño)

---

## 1. Descripción del Proyecto

**Ibermon** es un videojuego RPG 2D por turnos de temática ibérica, desarrollado con Unity 6 como Trabajo de Fin de Grado. Este documento describe la capa web del proyecto: una aplicación frontend estática que actúa como portal público del juego, exponiendo el catálogo de criaturas, el sistema de autenticación de jugadores y el seguimiento de partidas guardadas.

### Objetivos del portal web

- Ofrecer una **Pokédex pública** con todos los Ibermon, movimientos, ítems y logros del juego, accesible sin necesidad de cuenta.
- Permitir a los jugadores **iniciar sesión y consultar el estado de sus partidas** guardadas desde el juego.
- Servir como **escaparate** del proyecto, con información de descarga y acceso al repositorio.
- Proporcionar un **explorador interactivo de la API REST**, similar a Swagger pero integrado en el diseño del juego.
- Ofrecer un **asistente conversacional (IberBot)** capaz de responder preguntas sobre el juego y consultar la base de datos en tiempo real.
- Habilitar un **modo de combate online 6vs6** por turnos al estilo Pokémon Showdown, jugable entre pestañas del navegador o contra una CPU, sin necesidad de servidor adicional.

---

## 2. Arquitectura del Sistema

El sistema completo sigue una arquitectura de tres capas desacopladas que se comunican entre sí mediante HTTP.

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTE (navegador)                    │
│                                                             │
│   HTML5 + CSS3 + JavaScript Vanilla                         │
│   (Sin frameworks — ficheros estáticos servidos por nginx)  │
└───────────────────────┬─────────────────────────────────────┘
                        │  HTTP / REST  (puerto 80 → proxy /api/)
┌───────────────────────▼─────────────────────────────────────┐
│                   NGINX  (Docker)                           │
│                                                             │
│   - Sirve los ficheros estáticos del frontend               │
│   - Actúa como reverse proxy hacia la API FastAPI           │
│   - Elimina la necesidad de configurar CORS en producción   │
└───────────────────────┬─────────────────────────────────────┘
                        │  HTTP  (puerto 8000, red interna Docker)
┌───────────────────────▼─────────────────────────────────────┐
│              API REST — FastAPI  (Python)                    │
│                                                             │
│   - Endpoints públicos: catálogo de Ibermon, movimientos,   │
│     ítems y logros                                          │
│   - Endpoints privados (JWT): partidas del jugador          │
│   - Autenticación OAuth2 con tokens JWT                     │
└───────────────────────┬─────────────────────────────────────┘
                        │  Motor Beanie / Motor Async
┌───────────────────────▼─────────────────────────────────────┐
│                   MongoDB  (Docker)                         │
│                                                             │
│   Colecciones: ibermon_catalogo, movimiento_catalogo,       │
│   item_catalogo, logro_catalogo, usuarios, partidas,        │
│   ibermon_jugador                                           │
└─────────────────────────────────────────────────────────────┘
```

### Comunicación en desarrollo local vs. Docker

| Entorno | `CONFIG.API_BASE` | Gestión de CORS |
|---|---|---|
| Desarrollo local | `http://localhost:8000` | CORS habilitado en FastAPI |
| Docker (producción) | `/api` | Nginx actúa como proxy, sin CORS |

---

## 3. Stack Tecnológico

### Frontend

| Tecnología | Versión | Uso |
|---|---|---|
| HTML5 | — | Estructura semántica de las páginas |
| CSS3 | — | Estilos, animaciones, diseño responsivo |
| JavaScript | ES2022 (Vanilla) | Toda la lógica de la interfaz |
| Press Start 2P | Google Fonts | Fuente pixel-art para títulos |
| Inter | Google Fonts | Fuente de cuerpo (legibilidad) |

> No se utiliza ningún framework de JavaScript (ni React, Vue, Angular, ni jQuery). Esta decisión reduce la complejidad de build, elimina la necesidad de un paso de compilación y produce ficheros estáticos listos para servir directamente.

### Backend

| Tecnología | Versión | Uso |
|---|---|---|
| Python | 3.11+ | Lenguaje del servidor |
| FastAPI | 0.110+ | Framework web asíncrono |
| Beanie | 1.x | ODM (Object Document Mapper) para MongoDB |
| Motor | — | Driver asíncrono de MongoDB |
| python-jose | — | Creación y verificación de JWT |
| passlib + bcrypt | — | Hashing de contraseñas |
| Pydantic v2 | — | Validación y serialización de datos |

### Infraestructura

| Tecnología | Uso |
|---|---|
| Docker | Contenerización de los tres servicios |
| Docker Compose | Orquestación del stack completo |
| nginx:alpine | Servidor web del frontend + reverse proxy |
| mongo:7.0 | Base de datos documental |

---

## 4. Estructura de Ficheros del Frontend

```
ParteFrontTFG/
│
├── index.html          Landing page principal con hero animado
├── catalogo.html       Catálogo público de datos del juego
├── login.html          Formulario de inicio de sesión
├── registro.html       Formulario de registro de cuenta
├── dashboard.html      Panel de partidas del jugador autenticado
├── descarga.html       Página de descarga del juego y FAQ
├── combate.html        Combate online 6vs6 (PvP entre pestañas o vs CPU)
│
├── styles/                       CSS dividido por responsabilidad
│   ├── main.css                  Punto de entrada, solo @imports
│   ├── variables.css             CSS custom properties + reset base
│   ├── components.css            Componentes reutilizables (botones, cards, badges)
│   ├── chatbot.css               Estilos del chatbot flotante
│   └── pages/
│       ├── index.css             Hero animado, anillos, feature cards
│       ├── catalogo.css          Grid + JSON viewer + modal de detalle
│       ├── dashboard.css         Tarjetas de partida con stats
│       ├── descarga.css          Pasos de instalación numerados
│       └── combate.css           Arena, HP bars, dialog box, animaciones
│
├── scripts/
│   ├── api/
│   │   └── api.js                Módulo de llamadas HTTP (Auth/Catalog/Partida API)
│   ├── modules/                  Lógica reutilizable entre páginas
│   │   ├── config.js             Configuración global (API_BASE, helpers)
│   │   ├── auth.js               Gestión de sesión JWT + formularios
│   │   ├── nav.js                Generación dinámica de navbar y footer
│   │   ├── chatbot.js            IberBot con fuzzy matching (Levenshtein)
│   │   ├── battle.js             Motor de combate (fórmula de daño + IA bot)
│   │   └── matchmaking.js        Emparejamiento PvP por BroadcastChannel
│   └── pages/                    Lógica específica de cada página
│       ├── index.js              Preview de catálogo en la landing
│       ├── catalog.js            Modo normal + modo API + modal detalle
│       ├── dashboard.js          Listar/renombrar/eliminar partidas
│       └── combate.js            Orquestación UI del combate 6vs6
│
├── docs/
│   └── documentacion_tecnica.md   Este documento
│
├── Dockerfile          Imagen Docker del frontend (nginx:alpine)
├── nginx.conf          Configuración de nginx (proxy + caché)
└── docker-compose.yml  Stack completo: frontend + API + MongoDB
```

> **Reorganización:** El proyecto se separó en módulos en lugar de mantener
> dos carpetas planas (`css/` y `js/`). Esto facilita encontrar el código:
> los scripts de página están en `scripts/pages/`, los reutilizables en
> `scripts/modules/`, y la API en su propia carpeta `scripts/api/`. Los CSS
> se dividieron en variables, componentes reutilizables y una hoja por página.

### Orden de carga de scripts en cada página

Todos los ficheros HTML cargan los scripts en el siguiente orden, respetando las dependencias:

```html
<script src="scripts/modules/config.js"></script>      <!-- 1. Variables globales y helpers -->
<script src="scripts/api/api.js"></script>             <!-- 2. Funciones de red (usa CONFIG) -->
<script src="scripts/modules/auth.js"></script>        <!-- 3. Auth (usa AuthAPI de api.js) -->
<script src="scripts/modules/nav.js"></script>         <!-- 4. Navbar (usa Auth) -->
<script src="scripts/modules/chatbot.js"></script>     <!-- 5. IberBot (usa CONFIG y CatalogAPI) -->
<script src="scripts/pages/[pagina].js"></script>      <!-- 6. Lógica específica de la página -->
```

`combate.html` añade además dos módulos antes de su script de página:

```html
<script src="scripts/modules/battle.js"></script>      <!-- Motor de combate -->
<script src="scripts/modules/matchmaking.js"></script> <!-- Emparejamiento PvP -->
<script src="scripts/pages/combate.js"></script>
```

---

## 5. Módulos JavaScript

### 5.1 `config.js` — Configuración global

Expone el objeto `CONFIG` con la URL base de la API y la URL del repositorio. También define funciones de utilidad globales reutilizadas por todos los demás módulos.

```javascript
const CONFIG = {
  API_BASE: 'http://localhost:8000',  // Cambiar a '/api' con Docker
  GITHUB_URL: 'https://github.com/ibermon',
};
```

**Funciones de utilidad exportadas:**

| Función | Descripción |
|---|---|
| `tipoBadge(tipo)` | Devuelve HTML con un badge coloreado para un tipo de Ibermon |
| `formatNum(n)` | Formatea un número al estilo Pokédex: `1` → `#001` |
| `formatTime(secs)` | Convierte segundos a formato legible: `3661` → `1h 01m` |
| `statColor(val)` | Devuelve clase CSS según el rango del stat (`low`, `mid`, `high`, `vhigh`) |
| `syntaxHighlight(json)` | Colorea JSON para el visor de API |
| `imgWithFallback(src, alt, class)` | Imagen con SVG de sustitución si falla la carga |

---

### 5.2 `api.js` — Capa de red

Centraliza todas las peticiones HTTP. La función base `apiFetch` añade automáticamente el token JWT de `localStorage` a la cabecera `Authorization` si existe.

```javascript
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('ibermon_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // ...
}
```

**Objetos de API disponibles:**

**`AuthAPI`** — Endpoints de autenticación

| Método | Endpoint | Descripción |
|---|---|---|
| `AuthAPI.login(user, pass)` | `POST /auth/login` | Devuelve `{ access_token, token_type }` |
| `AuthAPI.registro(user, email, pass)` | `POST /auth/registro` | Crea un nuevo usuario |
| `AuthAPI.yo()` | `GET /auth/yo` | Devuelve el perfil del usuario autenticado |

**`CatalogAPI`** — Endpoints públicos del catálogo

| Método | Endpoint | Descripción |
|---|---|---|
| `CatalogAPI.ibermon()` | `GET /catalogo/ibermon` | Lista todos los Ibermon (resumen) |
| `CatalogAPI.ibermonById(n)` | `GET /catalogo/ibermon/{n}` | Detalle de un Ibermon por número |
| `CatalogAPI.movimientos()` | `GET /catalogo/movimientos` | Lista todos los movimientos |
| `CatalogAPI.movById(n)` | `GET /catalogo/movimientos/{n}` | Detalle de un movimiento |
| `CatalogAPI.items()` | `GET /catalogo/items` | Lista todos los ítems |
| `CatalogAPI.itemById(n)` | `GET /catalogo/items/{n}` | Detalle de un ítem |
| `CatalogAPI.logros()` | `GET /catalogo/logros` | Lista todos los logros |
| `CatalogAPI.logroById(c)` | `GET /catalogo/logros/{c}` | Detalle de un logro |

**`PartidaAPI`** — Endpoints privados (requieren JWT)

| Método | Endpoint | Descripción |
|---|---|---|
| `PartidaAPI.listar()` | `GET /partidas/` | Lista las partidas del usuario |
| `PartidaAPI.obtener(id)` | `GET /partidas/{id}` | Detalle de una partida |
| `PartidaAPI.eliminar(id)` | `DELETE /partidas/{id}` | Elimina una partida |

**`rawFetch(path)`** — Devuelve la respuesta sin procesar (objeto, status, tiempo en ms), utilizado por el visor de API del catálogo.

---

### 5.3 `auth.js` — Gestión de sesión

Implementa el objeto global `Auth`, que gestiona el ciclo de vida del token JWT en `localStorage`, y las funciones de inicialización de los formularios de login y registro.

**Claves utilizadas en `localStorage`:**

| Clave | Contenido |
|---|---|
| `ibermon_token` | String del JWT (Bearer token) |
| `ibermon_user` | JSON con `{ id, username, email, partidas, fecha_registro }` |

**Métodos del objeto `Auth`:**

| Método | Descripción |
|---|---|
| `Auth.isLoggedIn()` | `true` si existe un token almacenado |
| `Auth.getToken()` | Devuelve el token JWT o `null` |
| `Auth.getUser()` | Devuelve el objeto usuario parseado o `null` |
| `Auth.save(token, user)` | Persiste token y usuario en localStorage |
| `Auth.logout()` | Limpia localStorage y redirige a `index.html` |
| `Auth.requireAuth()` | Redirige a `login.html` si no hay sesión activa |
| `Auth.redirectIfLogged()` | Redirige a `dashboard.html` si ya hay sesión |

**Flujo de login:**

```
Usuario envía formulario
  → POST /auth/login (OAuth2 form-data)
  → Recibe { access_token }
  → GET /auth/yo (con el token provisional)
  → Auth.save(token, usuario)
  → Redirección a dashboard.html (o a ?next=)
```

**Flujo de registro:**

```
Usuario envía formulario
  → Validación local (contraseñas coinciden, mínimo 6 chars)
  → POST /auth/registro
  → Auto-login: POST /auth/login + GET /auth/yo
  → Auth.save(token, usuario)
  → Redirección a dashboard.html (tras 1.2 s)
```

---

### 5.4 `nav.js` — Navegación global

La función `buildNav()` se ejecuta en el evento `DOMContentLoaded` de todas las páginas. Genera el HTML del navbar y del footer de forma dinámica, y los inyecta en los `<div id="navbar">` y `<div id="footer">` que actúan de marcadores de posición.

**Comportamiento dinámico:**

- El enlace **Mis Partidas** solo se renderiza si `Auth.isLoggedIn()` es `true`.
- La sección de autenticación muestra **Entrar / Registrarse** o el nombre del usuario con botón **Salir**, según el estado de sesión.
- El enlace activo se marca con la clase CSS `active` comparando la URL actual.
- El botón hamburguesa (menú móvil) se inicializa con un listener de `click`.

---

### 5.5 `catalog.js` — Catálogo público

Gestiona la página `catalogo.html` con dos modos de visualización: **Normal** (tarjetas visuales) y **API** (JSON viewer interactivo).

**Estado global del módulo:**

| Variable | Valores | Descripción |
|---|---|---|
| `currentSection` | `ibermon`, `movimientos`, `items`, `logros` | Pestaña activa |
| `currentMode` | `normal`, `api` | Modo de visualización activo |
| `currentFilter` | string | Texto del buscador en tiempo real |
| `allData` | objeto caché | Resultados de la API (evita refetch) |

**Modo Normal — Renderers:**

| Función | Sección | Descripción |
|---|---|---|
| `renderIbermonGrid(list)` | ibermon | Grid de tarjetas con sprite, nombre y tipos |
| `renderMovimientosTable(list)` | movimientos | Tabla con nombre, tipo, potencia, precisión, PP y categoría |
| `renderItemsGrid(list)` | items | Grid de tarjetas con icono, nombre, descripción y precio |
| `renderLogrosGrid(list)` | logros | Grid con icono, nombre y código del logro |

**Modal de detalle de Ibermon** (`openIbermonModal(numero)`):

Cuando el usuario pulsa una tarjeta de Ibermon, se abre un modal que realiza `GET /catalogo/ibermon/{numero}` para obtener los datos completos y renderiza:

- Sprite del Ibermon (con animación flotante)
- Número, nombre, tipos y descripción
- Grid de metadatos (catch rate, EXP yield, crecimiento, evolución)
- Barras de estadísticas base animadas (se expanden mediante CSS `transition`)
- Chips de movimientos aprendibles con el nivel requerido

**Modo API — JSON Viewer:**

Presenta una lista lateral de endpoints públicos. El usuario selecciona un endpoint, opcionalmente introduce un parámetro (número o código), pulsa **▶ Ejecutar** y ve la respuesta JSON formateada con syntax highlight, el código HTTP de respuesta y el tiempo de respuesta en milisegundos.

Los endpoints disponibles en el visor son:

```
GET /catalogo/ibermon
GET /catalogo/ibermon/{numero}
GET /catalogo/movimientos
GET /catalogo/movimientos/{numero}
GET /catalogo/items
GET /catalogo/items/{numero}
GET /catalogo/logros
GET /catalogo/logros/{codigo}
```

---

### 5.6 `dashboard.js` — Panel de partidas

La página `dashboard.html` requiere autenticación. Si el usuario no está logueado, `Auth.requireAuth()` redirige automáticamente a `login.html`.

**Funcionalidades:**

- **Listado de partidas** — Llama a `PartidaAPI.listar()` y renderiza una tarjeta por partida con: nombre del personaje, mapa actual, tiempo jugado, batallas ganadas, win rate, Ibermon vistos y capturados, y medallas.
- **Renombrar partida** — Sustituye inline el nombre por un `<input>` editable. Al perder el foco o pulsar Intro, el alias se persiste en `localStorage` bajo la clave `ibermon_aliases` (objeto `{ [id]: string }`). El alias es local al navegador y no modifica la API.
- **Eliminar partida** — Muestra un modal de confirmación. Si el usuario confirma, llama a `PartidaAPI.eliminar(id)` y anima la desaparición de la tarjeta con una transición CSS antes de eliminarla del DOM.
- **Estadísticas de resumen** — Cabecera con totales: número de partidas, total de medallas, total de batallas ganadas y total de Ibermon capturados.

---

### 5.7 `chatbot.js` — IberBot

Documentado en detalle en la sección [10. Chatbot IberBot](#10-chatbot-iberbot).

---

### 5.8 `battle.js` — Motor de combate

Implementa todas las **reglas del combate** de forma independiente de la UI.
Lo separé del módulo de página para poder usar el mismo motor tanto contra
una CPU como contra otro jugador humano.

**API pública del objeto `Battle`:**

| Método | Descripción |
|---|---|
| `Battle.NIVEL_FIJO` | Constante `50` — todos los Ibermon a Nv.50 para balance |
| `Battle.buildUnit(detalle, todosMovs)` | Construye una unidad de combate desde el detalle del catálogo |
| `Battle.resolverTurno(estado, accionA, accionB)` | Resuelve un turno y devuelve un array de **eventos** que la UI reproduce |
| `Battle.equipoKO(equipo)` | `true` si todos los Ibermon del equipo están K.O. |
| `Battle.decidirAccionBot(estado, ladoBot)` | IA básica: prioriza el movimiento de mayor daño esperado |

**Tipos de eventos generados** (la UI los recibe en orden):

| Evento | Datos | UI |
|---|---|---|
| `cambio` | `{ lado, sale, entra }` | Animación de retirada + entrada |
| `ataque` | `{ lado, atacante, mov }` | Mensaje en dialog box, shake del sprite |
| `falla` | `{ lado, atacante }` | "¡Pero falló!" |
| `sinPP` | `{ lado, mov }` | "¡Sin PP!" |
| `noEfecto` | `{ lado }` | Movimiento de potencia 0 |
| `impacto` | `{ lado, atacante, defensor, danyo, efect, critico, hpRestante, hpMax }` | Flash rojo + daño flotante + barra de PS |
| `ko` | `{ lado, unidad }` | Sprite cae, mensaje de K.O. |

**Fórmula de daño** (Pokémon-like, simplificada):

```
daño = ((2*N/5 + 2) * POT * A/D / 50 + 2) * STAB * TIPO * CRIT * RND
```

| Variable | Significado |
|---|---|
| `N` | Nivel del atacante (siempre 50) |
| `POT` | Potencia del movimiento |
| `A/D` | Ataque / Defensa (Especial si `categoria === 'Especial'`) |
| `STAB` | 1.5 si el tipo del movimiento coincide con un tipo del atacante, 1 si no |
| `TIPO` | Producto de efectividades contra los tipos del defensor (0, 0.5, 1, 2, 4) |
| `CRIT` | 1.5 con probabilidad 1/16 |
| `RND` | Aleatorio entre 0.85 y 1.00 |

**Tabla de efectividades** — Reducida (solo emparejamientos significativos).
Para los pares no definidos devuelve 1 (neutro).

**Orden de resolución del turno:**

1. **Cambios primero** (no consumen prioridad).
2. **Ataques ordenados** por prioridad del movimiento (descendente).
3. Si empatan en prioridad, gana el de **mayor velocidad**.
4. Si todo empata, **al azar**.

**IA del bot** (`decidirAccionBot`):

- Si está bajo el 20% de PS y queda reserva: 40% de probabilidad de cambiar.
- Si no, elige el movimiento con mayor `potencia × STAB × efectividad`. No
  hace lookahead — para que sea jugable y no sobrehumano.

---

### 5.9 `matchmaking.js` — Emparejamiento PvP

Permite el **multijugador entre pestañas** sin necesidad de servidor adicional,
usando la API `BroadcastChannel` del navegador. Cualquier número de pestañas
del mismo origen pueden enviarse mensajes entre sí; este módulo construye
un protocolo de matchmaking encima.

**API pública del objeto `Matchmaking`:**

| Método | Descripción |
|---|---|
| `Matchmaking.init(nombre)` | Inicializa el canal `ibermon-matchmaking` y el id propio |
| `Matchmaking.buscar()` | Anuncia presencia y empareja al recibir otro anuncio |
| `Matchmaking.enviarEquipo(eq)` | Envía el equipo al rival (datos planos) |
| `Matchmaking.enviarAccion(acc)` | Envía la acción del turno |
| `Matchmaking.enviarResultado(eventos, snapshot)` | (HOST→GUEST) eventos resueltos + snapshot |
| `Matchmaking.rendirse()` | Notifica rendición |
| `Matchmaking.cerrar()` | Cierra el canal al salir |
| `Matchmaking.soyHost()` | `true` si actúo como autoridad del combate |
| `Matchmaking.on(evento, fn)` | Registra un callback |

**Eventos a los que la UI se suscribe:**

| Evento | Cuándo se emite |
|---|---|
| `buscandoEstado(txt)` | Actualización de estado de cola |
| `emparejado(peer)` | Encontrado rival |
| `equipoRecibido(equipo)` | El rival mandó su equipo |
| `accionRecibida(accion)` | El rival mandó su acción del turno |
| `resultadoRecibido({ eventos, estado })` | (Solo GUEST) HOST mandó eventos resueltos |
| `rivalSeFue({ motivo })` | El rival cerró pestaña o se rindió |

**Protocolo (mensajes sobre el canal):**

| Tipo | Origen | Datos |
|---|---|---|
| `presencia` | Cualquiera buscando | `{ de, nombre, ts }` cada 2 s |
| `emparejar` | El que recibió presencia | `{ de, para, nombre, host }` |
| `equipo` | Tras emparejarse | `{ de, para, equipo }` |
| `accion` | Cada turno | `{ de, para, accion }` |
| `resultado` | HOST tras resolver turno | `{ de, para, eventos, estado }` |
| `rendicion` | Al rendirse | `{ de, para }` |
| `ping` | Heartbeat cada 3 s | `{ de, para }` |

**HOST/GUEST:** El id alfabéticamente menor actúa como HOST. El HOST resuelve
el turno con el motor `Battle` y envía un snapshot al GUEST. Si los dos
calcularan independientemente, el RNG del crítico/daño los desincronizaría.

**Heartbeat:** Cada 3 s se manda un `ping`. Si pasan 8 s sin recibir uno del
rival, se asume desconexión y se notifica con `rivalSeFue({ motivo: 'desconexion' })`.

---

### 5.10 `combate.js` — Orquestación de la página de combate

Conecta tres piezas de forma ordenada:

1. **UI** — pantallas (selección, cola, arena, resultado), botones, sprites,
   barras de PS, log scrollable, modales.
2. **Motor** (`Battle`) — calcula qué pasa cada turno.
3. **Matchmaking** (`Matchmaking`) — conecta con rival humano (o entra en
   modo CPU si el jugador lo elige).

**Estado global** (`Combate`):

| Campo | Descripción |
|---|---|
| `catalogoIbermon`, `catalogoMovimientos` | Cacheados de la API al cargar |
| `seleccionNumeros` | Array de hasta 6 ids de Ibermon elegidos |
| `equipoYo`, `equipoFoe` | Unidades construidas con `Battle.buildUnit()` |
| `activoYo`, `activoFoe` | Referencias al Ibermon activo de cada lado |
| `modoBot` | `true` si el rival es CPU |
| `_soyHost` | `true` si actúo como HOST en multijugador |
| `accionPendiente`, `accionRival` | Acciones del turno (esperando ambas) |
| `combateTerminado` | Bandera para evitar acciones tras KO total |

**Inversión de eventos en GUEST** — Cuando llega un evento del HOST con
`lado: 'A'` (su equipo), el GUEST lo invierte a `lado: 'B'` para que en su
pantalla "A" siga siendo su propio equipo. Las referencias a unidades se
sustituyen por instancias locales buscadas por `numero`. Sin esta lógica,
los sprites y nombres se mostrarían cruzados.

**Snapshot** — El HOST envía con cada turno un snapshot mínimo:

```js
{
  equipoA: [{ hp, fainted, moves: [{ pp }] }, ...],
  equipoB: [{ hp, fainted, moves: [{ pp }] }, ...],
  activoA: índice,
  activoB: índice,
}
```

El GUEST aplica este snapshot **antes** de reproducir los eventos, para que
cualquier divergencia por RNG quede corregida.

---

## 6. Páginas de la Aplicación

### 6.1 `index.html` — Página de inicio

La landing page es el punto de entrada principal al portal. Presenta el juego visualmente y orienta al usuario hacia las secciones clave.

**Componentes de la página:**

- **Hero** con animaciones CSS (anillos orbitales rotatorios, pokéball decorativa, texto con efecto glitch). Incluye dos llamadas a la acción: *Ver Catálogo* y *Descargar el juego*.
- **Preview del catálogo** — Carga dinámicamente los primeros Ibermon desde la API y los muestra como tarjetas de presentación.
- **Sección de características** — Tres bloques visuales que describen los pilares del juego: combate por turnos, exploración del mapa y colección de Ibermon.
- **Footer** con enlaces de navegación y créditos del proyecto.

> 📷 **Figura 1 — Insertar captura de pantalla: vista completa de `index.html`, mostrando el hero con el título "IBERMON", la pokéball animada y los botones de llamada a la acción.**

> 📷 **Figura 2 — Insertar captura de pantalla: sección de preview del catálogo en `index.html`, con las tarjetas de Ibermon cargadas desde la API y la sección de características del juego.**

---

### 6.2 `catalogo.html` — Catálogo público

Punto central de datos del juego. Accesible sin cuenta. Permite explorar todos los datos del juego en dos modos distintos y con buscador en tiempo real.

**Modo Normal — Vista de tarjetas:**

La sección Ibermon muestra un grid de tarjetas, una por criatura, con sprite, número de Pokédex, nombre y badges de tipo coloreados. Al pulsar una tarjeta se abre un modal con la ficha completa.

> 📷 **Figura 3 — Insertar captura de pantalla: catálogo en modo Normal, pestaña Ibermon, mostrando el grid de tarjetas con sprites, números y badges de tipo.**

**Modal de detalle de Ibermon:**

Al pulsar una tarjeta se abre el modal de detalle, que incluye el sprite con animación flotante, descripción, estadísticas base con barras animadas y movimientos aprendibles.

> 📷 **Figura 4 — Insertar captura de pantalla: modal de detalle de un Ibermon abierto, con el sprite, los tipos, las barras de estadísticas y los chips de movimientos.**

**Tabla de movimientos:**

La pestaña Movimientos presenta todos los ataques en formato tabla con columnas de nombre, tipo (badge coloreado), potencia, precisión, PP y categoría (Físico / Especial / Estado).

> 📷 **Figura 5 — Insertar captura de pantalla: catálogo en modo Normal, pestaña Movimientos, mostrando la tabla con varios movimientos listados.**

**Modo API — JSON Viewer:**

Muestra los endpoints de la API en una barra lateral. Al seleccionar uno y pulsar Ejecutar, la respuesta JSON aparece formateada con syntax highlight, junto al código HTTP y el tiempo de respuesta.

> 📷 **Figura 6 — Insertar captura de pantalla: catálogo en modo API (Formato API), con un endpoint seleccionado en la barra lateral y la respuesta JSON visible a la derecha.**

---

### 6.3 `login.html` — Inicio de sesión

Formulario de autenticación con validación de errores en tiempo real. Si el usuario intentaba acceder a una página protegida, el parámetro `?next=` en la URL guarda la ruta de destino y redirige allí tras el login exitoso.

> 📷 **Figura 7 — Insertar captura de pantalla: página de login con el formulario de usuario y contraseña. Si es posible, mostrar también el estado con un mensaje de error de credenciales incorrectas.**

---

### 6.4 `registro.html` — Registro de cuenta

Formulario de creación de cuenta con campos de usuario, email, contraseña y confirmación de contraseña. La validación es local (sin petición de red) antes de enviar. Tras el registro, hace auto-login y redirige al dashboard automáticamente.

> 📷 **Figura 8 — Insertar captura de pantalla: página de registro con el formulario completo de creación de cuenta.**

---

### 6.5 `dashboard.html` — Panel de partidas

Área privada del jugador. Muestra las partidas guardadas sincronizadas desde el juego, con estadísticas detalladas de cada una.

**Cabecera de estadísticas:**

Cuatro contadores globales: número de partidas activas, total de medallas conseguidas, total de batallas ganadas y total de Ibermon capturados.

**Tarjetas de partida:**

Cada partida ocupa una tarjeta con: nombre (editable inline), mapa actual, tiempo jugado, win rate, Ibermon vistos y capturados, y lista de medallas obtenidas. Incluye botones de renombrar y eliminar.

> 📷 **Figura 9 — Insertar captura de pantalla: dashboard con al menos una partida cargada, mostrando la cabecera de estadísticas y la tarjeta de partida con sus datos.**

**Modal de confirmación de borrado:**

Antes de eliminar una partida, se muestra un modal de confirmación centrado en pantalla para evitar borrados accidentales.

> 📷 **Figura 10 — Insertar captura de pantalla: modal de confirmación de borrado de partida abierto sobre el dashboard.**

---

### 6.6 `descarga.html` — Descarga del juego

Página informativa con los pasos de instalación, requisitos del sistema, preguntas frecuentes (FAQ) y el enlace al repositorio de GitHub.

> 📷 **Figura 11 — Insertar captura de pantalla: página de descarga mostrando los pasos de instalación y la sección de FAQ.**

---

### 6.7 `combate.html` — Combate Online (6vs6)

Página de combate por turnos al estilo Pokémon Showdown. **Cuatro pantallas
distintas** conviven en el mismo HTML; el JavaScript intercambia la clase
`.screen-active` entre los `<section>` correspondientes:

1. **`screen-select`** — Selección de equipo. Grid del catálogo con buscador
   en tiempo real. Slots de los 6 Ibermon elegidos arriba. Botón "🎲 Aleatorio"
   para selección rápida y "▶ Buscar rival" para entrar a la cola.

2. **`screen-queue`** — Pantalla de matchmaking. Una pokeball animada gira
   mientras se busca rival. Timer visible para que se note actividad. Botón
   "🤖 Jugar contra la CPU" como fallback si no aparece nadie.

3. **`screen-battle`** — Arena de combate. Sprites animados, cajas con nombre
   y nivel, **barras de PS coloreadas según el porcentaje** (verde >50%,
   amarillo 20-50%, rojo <20%), caja de diálogo estilo Game Boy y log lateral.
   Panel inferior con los 4 movimientos y botones de cambio/rendición.

4. **`screen-result`** — Pantalla final con icono de victoria (🏆) o derrota (💀),
   botón de revancha y enlace al inicio.

**Animaciones de combate:**

| Animación | Disparador |
|---|---|
| Shake del sprite atacante | Cuando una unidad usa un movimiento |
| Flash rojo del sprite defensor | Al recibir daño |
| Daño flotante con rebote | Al impacto, con clase `.crit` para críticos |
| Sprite cayendo (fainted) | Al llegar a 0 PS |
| Transición de barra de PS | CSS `transition: width 0.6s ease` |

> 📷 **Figura 11b — Insertar captura: pantalla de selección con 6 Ibermon elegidos en los slots y el grid debajo.**

> 📷 **Figura 11c — Insertar captura: arena de combate con dos Ibermon activos, barras de PS, dialog box y los 4 botones de movimiento.**

> 📷 **Figura 11d — Insertar captura: pantalla de resultado con el icono de victoria.**

---

## 7. Sistema de Estilos (CSS)

La interfaz se define en la carpeta `styles/`, dividida por responsabilidad
para que el CSS no crezca en un único archivo monolítico difícil de auditar.
El punto de entrada es `styles/main.css`, que solamente importa los demás
con `@import`. Cada HTML solo necesita incluir `styles/main.css`.

| Archivo | Contenido |
|---|---|
| `variables.css` | CSS custom properties (colores, fuentes, radios, sombras) y reset base |
| `components.css` | Componentes reutilizables: botones, cards, badges, modales, alertas, formularios, navbar, footer |
| `chatbot.css` | Estilos del chatbot flotante (panel, burbujas, fuzzy note) |
| `pages/index.css` | Hero animado, anillos orbitales, feature cards |
| `pages/catalogo.css` | Grid del catálogo, JSON viewer, modal de detalle |
| `pages/dashboard.css` | Tarjetas de partida con stats y acciones |
| `pages/descarga.css` | Pasos de instalación numerados, FAQ |
| `pages/combate.css` | Arena, HP bars, dialog box estilo Game Boy, log, animaciones |

### 7.1 Variables CSS (Design Tokens)

El diseño oscuro de estética pixel-art se controla íntegramente mediante variables CSS definidas en `:root` en `variables.css`. Esto permite cambiar la paleta completa modificando un único bloque.

```css
:root {
  /* Paleta de colores */
  --bg-deep:    #060610;   /* Fondo más oscuro */
  --bg-primary: #0d0d1a;   /* Fondo principal */
  --bg-surface: #131326;   /* Superficies elevadas */
  --bg-card:    #1a1a2e;   /* Tarjetas */

  --red:        #e63946;   /* Acción principal / peligro */
  --blue:       #4cc9f0;   /* Información / enlaces */
  --yellow:     #f9c74f;   /* Advertencia / estadísticas */
  --green:      #06d6a0;   /* Éxito / estado online */
  --purple:     #9d4edd;   /* Acento secundario */

  --text:       #f1faee;   /* Texto principal */
  --text-dim:   #8da9c4;   /* Texto secundario */
  --text-muted: #4d5d80;   /* Texto apagado */

  /* Tipografía */
  --font-pixel: 'Press Start 2P', monospace;
  --font-main:  'Inter', sans-serif;
}
```

> 📷 **Figura 12 — Insertar captura de pantalla: fragmento de la interfaz que muestre la paleta de colores en uso — por ejemplo, el navbar con el rojo corporativo, un badge azul y un stat amarillo.**

### 7.2 Sistema de layout

La hoja utiliza helpers de grid reutilizables:

- `.grid-2` — Grid de 2 columnas (`repeat(2, 1fr)`)
- `.grid-3` — Grid de 3 columnas (`repeat(3, 1fr)`)
- `.grid-4` — Grid de 4 columnas (`repeat(4, 1fr)`)

Todos colapsan a una columna en móvil mediante media queries.

### 7.3 Sistema de colores por tipo de Ibermon

Los tipos tienen clases CSS del formato `.tipo-{Nombre}`. Cada clase define un color de fondo semitransparente y un color de texto que sigue la convención visual de juegos de rol de criaturas:

| Tipo | Color de fondo | Color de texto |
|---|---|---|
| Fuego | `rgba(230,57,70,.2)` | `#e63946` |
| Agua | `rgba(76,201,240,.2)` | `#4cc9f0` |
| Planta | `rgba(6,214,160,.2)` | `#06d6a0` |
| Eléctrico | `rgba(249,199,79,.2)` | `#f9c74f` |
| Psíquico | `rgba(157,78,221,.2)` | `#9d4edd` |
| Normal | `rgba(141,169,196,.15)` | `#8da9c4` |
| ... | ... | ... |

> 📷 **Figura 13 — Insertar captura de pantalla: detalle de los badges de tipo en el catálogo o en una tarjeta de Ibermon, donde se aprecien varios colores de tipo diferentes.**

### 7.4 Animaciones CSS destacadas

| Nombre | Uso |
|---|---|
| `pulse-glow` | Pulsación del botón del chatbot flotante |
| `float` | Levitación del sprite en el modal de Ibermon |
| `spin-slow` | Rotación de los anillos decorativos del hero |
| `fade-in` | Aparición de los mensajes del chat |
| `slide-up` | Apertura del panel del chatbot |
| `dot-bounce` | Indicador de carga del chatbot (tres puntos) |
| `glitch` | Efecto de glitch en el título del hero |

---

## 8. API REST — Backend

La API está implementada con **FastAPI** y **Beanie** (ODM asíncrono para MongoDB). La documentación interactiva generada automáticamente por FastAPI está disponible en `http://localhost:8000/docs`.

> 📷 **Figura 14 — Insertar captura de pantalla: interfaz de Swagger UI en `http://localhost:8000/docs`, mostrando los grupos de endpoints (Catálogos Públicos, Auth, Partidas).**

### 8.1 Modelos de datos

#### IbermonCatalogo

Representa una criatura del juego en el catálogo. Se almacena en la colección `ibermon_catalogo`.

| Campo | Tipo | Descripción |
|---|---|---|
| `numero` | `int` | Identificador único (PK), estilo Pokédex |
| `nombre` | `str` | Nombre de la criatura |
| `tipo1` | `str` | Tipo primario |
| `tipo2` | `str?` | Tipo secundario (opcional) |
| `descripcion` | `str` | Texto descriptivo del Pokédex |
| `stats_base` | `StatsBase` | HP, Ataque, Defensa, Atq. Esp., Def. Esp., Velocidad |
| `movimientos_posibles` | `list[MovimientoPosible]` | Lista de `{ numero, nivel }` |
| `evoluciona_a` | `int?` | Número del Ibermon al que evoluciona |
| `nivel_evolucion` | `int?` | Nivel mínimo para evolucionar |
| `sprite` | `str` | Nombre del asset de sprite en Unity |
| `catch_rate` | `int` | Tasa de captura (0–255). Por defecto: 255 |
| `exp_yield` | `int` | EXP base ganada al derrotarlo. Por defecto: 100 |
| `growth_rate` | `str` | Curva de crecimiento: `"Medio"` o `"Rapido"` |

#### MovimientoCatalogo

Representa un movimiento del juego. Colección `movimiento_catalogo`.

| Campo | Tipo | Descripción |
|---|---|---|
| `numero` | `int` | Identificador único |
| `nombre` | `str` | Nombre del movimiento |
| `tipo` | `str` | Tipo del movimiento |
| `potencia` | `int` | Daño base (0 = movimiento de estado) |
| `precision` | `int` | Porcentaje de acierto |
| `pp` | `int` | Puntos de poder (usos) |
| `descripcion` | `str` | Texto descriptivo |
| `efecto` | `str?` | Descripción del efecto secundario |
| `categoria` | `str` | `"Fisico"`, `"Especial"` o `"Estado"` |
| `objetivo` | `str` | `"Foe"` (enemigo) o `"Self"` (propio) |
| `siempre_acierta` | `bool` | Si ignora la precisión |
| `prioridad` | `int` | Modificador de orden en el turno |

#### ItemCatalogo

Colección `item_catalogo`.

| Campo | Tipo | Descripción |
|---|---|---|
| `numero` | `int` | Identificador único |
| `nombre` | `str` | Nombre del ítem |
| `descripcion` | `str` | Descripción de uso |
| `tipo` | `str` | `"curacion"`, `"captura"`, `"batalla"` o `"clave"` |
| `efecto` | `EfectoItem` | `{ tipo_efecto: str, valor: any }` |
| `precio` | `int` | Precio en tienda (monedas del juego) |

#### Partida

Representa el estado de una partida guardada. Colección `partidas`.

| Campo | Tipo | Descripción |
|---|---|---|
| `usuario_id` | `ObjectId` | Referencia al usuario propietario |
| `personaje_elegido` | `str` | Nombre del personaje |
| `starter_elegido` | `int` | Número del Ibermon inicial |
| `mapa_actual` | `str` | Nombre del mapa donde está el jugador |
| `posicion` | `Posicion` | `{ x: float, y: float }` |
| `dinero` | `int` | Monedas actuales |
| `tiempo_jugado` | `int` | Segundos de juego acumulados |
| `equipo` | `list[ObjectId]` | IDs de IbermonJugador en el equipo (máx. 6) |
| `centro_ibermon` | `list[ObjectId]` | IDs en el PC/caja |
| `pokedex_visto` | `list[int]` | Números de Ibermon avistados |
| `pokedex_capturado` | `list[int]` | Números de Ibermon capturados |
| `medallas` | `list[str]` | Códigos de medallas obtenidas |
| `logros` | `list[str]` | Códigos de logros desbloqueados |
| `combates_ganados` | `int` | Total de batallas ganadas |
| `combates_perdidos` | `int` | Total de batallas perdidas |
| `flags` | `dict[str, bool]` | Flags de progreso del mundo |

### 8.2 Endpoints del catálogo (públicos)

| Método | Ruta | Respuesta | Descripción |
|---|---|---|---|
| GET | `/catalogo/ibermon` | `list[IbermonResumen]` | Lista todos los Ibermon |
| GET | `/catalogo/ibermon/{numero}` | `IbermonDetalle` | Detalle de un Ibermon |
| GET | `/catalogo/movimientos` | `list[MovimientoResumen]` | Lista todos los movimientos |
| GET | `/catalogo/movimientos/{numero}` | `MovimientoDetalle` | Detalle de un movimiento |
| GET | `/catalogo/items` | `list[ItemResumen]` | Lista todos los ítems |
| GET | `/catalogo/items/{numero}` | `ItemDetalle` | Detalle de un ítem |
| GET | `/catalogo/logros` | `list[LogroSchema]` | Lista todos los logros |
| GET | `/catalogo/logros/{codigo}` | `LogroSchema` | Detalle de un logro |

**Schemas de respuesta resumen vs. detalle:**

La API sigue el patrón resumen/detalle: los endpoints de lista devuelven un subconjunto de campos para reducir el volumen de datos, mientras que el endpoint de detalle devuelve el documento completo.

| Endpoint | Campos devueltos |
|---|---|
| `GET /catalogo/ibermon` | `numero, nombre, tipo1, tipo2, sprite` |
| `GET /catalogo/ibermon/{n}` | Todos los campos incluyendo stats, movimientos, evolución |
| `GET /catalogo/movimientos` | `numero, nombre, tipo, potencia, pp` |
| `GET /catalogo/movimientos/{n}` | Todos los campos incluyendo precisión, categoría, efecto |

### 8.3 Endpoints de autenticación

| Método | Ruta | Body | Respuesta | Descripción |
|---|---|---|---|---|
| POST | `/auth/registro` | `{ username, email, password }` | `UsuarioPublico` | Crea cuenta nueva |
| POST | `/auth/login` | Form-data: `username, password` | `{ access_token, token_type }` | Devuelve JWT |
| GET | `/auth/yo` | Header: `Authorization: Bearer <token>` | `UsuarioPublico` | Perfil del usuario |

### 8.4 Endpoints de partidas (requieren JWT)

| Método | Ruta | Respuesta | Descripción |
|---|---|---|---|
| GET | `/partidas/` | `list[Partida]` | Lista las partidas del usuario autenticado |
| GET | `/partidas/{id}` | `Partida` | Detalle de una partida |
| DELETE | `/partidas/{id}` | `204 No Content` | Elimina una partida |

---

## 9. Autenticación con JWT

### 9.1 Generación del token

La API utiliza **JWT (JSON Web Token)** con el algoritmo **HS256**. Al hacer login, FastAPI recibe las credenciales como `application/x-www-form-urlencoded` (estándar OAuth2 `password` grant), verifica la contraseña con `bcrypt` y emite un token firmado con la clave secreta del servidor.

```
Header:  { "alg": "HS256", "typ": "JWT" }
Payload: { "sub": "username", "exp": <timestamp> }
```

La expiración por defecto es de **60 minutos** (configurable vía variable de entorno `ACCESS_TOKEN_EXPIRE_MINUTES`).

### 9.2 Uso del token en el frontend

El token se almacena en `localStorage` tras el login y se incluye automáticamente en todas las peticiones que requieren autenticación mediante la cabecera:

```
Authorization: Bearer <token>
```

Esta lógica está centralizada en `apiFetch()` dentro de `api.js`, por lo que los módulos de nivel superior no necesitan gestionar la cabecera manualmente.

### 9.3 Expiración de sesión

Cuando el token expira, la API devuelve un error `401 Unauthorized`. El módulo `apiFetch` propaga el error como excepción, que es capturada por el módulo que realizó la llamada (por ejemplo, `dashboard.js`). El usuario ve el mensaje de error y debe volver a iniciar sesión.

> En una iteración futura, se podría implementar un interceptor que detecte el 401 y redirija automáticamente a `login.html`.

---

### 9.4 Base de datos de usuarios — única y compartida

Un aspecto fundamental del diseño es que **existe una única base de datos de usuarios**, alojada en MongoDB y gestionada exclusivamente por la API. La web no tiene su propia base de datos ni su propio sistema de cuentas: es un cliente más de la misma API, al igual que el juego en Unity.

Esto significa que el usuario que se registra en cualquiera de los dos puntos de entrada (la web o el propio juego) queda almacenado en el mismo sitio:

```python
# auth_service.py — el mismo código atiende tanto a Unity como a la web
nuevo_usuario = Usuario(
    username=datos.username,
    email=datos.email,
    hashed_password=hash_password(datos.password),
)
await nuevo_usuario.insert()  # colección "usuarios" en MongoDB
```

---

### 9.5 Flujo completo: del juego a la web

El escenario más habitual es que el jugador se registre y juegue desde Unity, y consulte sus datos desde el navegador. El flujo es el siguiente:

```
PASO 1 — En Unity (el juego)
  → El jugador se registra
  → POST /auth/registro  →  se crea su cuenta en MongoDB
  → Juega y guarda partidas
  → PUT /partidas/{id}/guardar  →  se persisten en MongoDB bajo su usuario_id

PASO 2 — En el navegador (la web)
  → El jugador va a login.html e introduce las mismas credenciales
  → POST /auth/login  →  la API verifica contra MongoDB y devuelve un JWT
  → La web almacena el JWT en localStorage
  → El jugador entra al Dashboard
  → GET /partidas/  →  la API filtra las partidas por usuario_id y las devuelve
  → Se muestran exactamente las mismas partidas que tiene en el juego
```

No es necesario registrarse de nuevo en la web. Si la cuenta ya existe en MongoDB (creada desde Unity o desde la web), el login funciona directamente.

---

### 9.6 Cómo la API sabe qué partidas mostrar

Cuando el Dashboard solicita `GET /partidas/`, la API ejecuta el siguiente proceso:

**1. Extrae el usuario del token**

```python
# security.py — get_current_user
username = verificar_token(token)          # lee "sub" del JWT → "david"
usuario  = await Usuario.find_one(         # busca en MongoDB
    Usuario.username == username
)
# usuario.id = ObjectId("6615a2f3...")
```

**2. Filtra las partidas de ese usuario**

```python
# partida_service.py — obtener_partidas_usuario
return await Partida.find(
    Partida.usuario_id == usuario.id       # solo las suyas
).to_list()
```

**3. Protege el acceso a partidas individuales**

Si alguien intentara acceder a la partida de otro usuario conociendo su ID, la API lo bloquea:

```python
if partida.usuario_id != usuario.id:
    raise HTTPException(403, "No tienes acceso a esta partida")
```

El campo `usuario_id` en cada documento `Partida` es la clave que une al jugador con sus datos:

```
MongoDB — colección "partidas"
┌─────────────────────────────────────────────────┐
│  _id:             ObjectId("abc123...")         │
│  usuario_id:      ObjectId("6615a2f3...")  ──┐  │
│  personaje_elegido: "Héroe"                  │  │
│  mapa_actual:     "bosque_sur"               │  │
│  tiempo_jugado:   3661                       │  │
│  ...                                         │  │
└──────────────────────────────────────────────│──┘
                                               │ referencia
MongoDB — colección "usuarios"                 │
┌─────────────────────────────────────────────┐│  │
│  _id:      ObjectId("6615a2f3...")  ◄────────┘  │
│  username: "david"                              │
│  email:    "david@ejemplo.com"                  │
│  partidas: [ObjectId("abc123..."), ...]         │
└─────────────────────────────────────────────────┘
```

---

### 9.7 Unity y la web como clientes equivalentes de la misma API

Desde el punto de vista de la API, una petición de Unity y una petición de la web son indistinguibles. Ambas incluyen el mismo token JWT en la cabecera `Authorization`, y la API responde igual a las dos:

```
                 ┌──────────────────────────────────────┐
                 │             MongoDB                  │
                 │  usuarios, partidas, ibermon...      │
                 └─────────────────┬────────────────────┘
                                   │
                 ┌─────────────────▼────────────────────┐
                 │           FastAPI (API REST)          │
                 │  JWT → usuario → partidas del usuario │
                 └──────────┬────────────────┬──────────┘
              Authorization │ Bearer <token> │ Authorization: Bearer <token>
                 ┌──────────▼──────┐  ┌──────▼──────────────┐
                 │  Navegador web  │  │   Unity (el juego)  │
                 │  dashboard.js   │  │   C# MonoBehaviour  │
                 │  GET /partidas/ │  │   GET /partidas/    │
                 └─────────────────┘  └─────────────────────┘
```

La única condición para que esto funcione es que tanto Unity como la web apunten a **la misma instancia de la API** (y por tanto a la misma MongoDB). En desarrollo ambos usan `http://localhost:8000`; en producción ambos deben apuntar al mismo servidor desplegado.

> 📷 **Figura 19 — Insertar diagrama o captura ilustrativa del flujo: registro en Unity → login en la web → dashboard mostrando las partidas del juego.**

---

## 10. Chatbot IberBot

### 10.1 Arquitectura del chatbot

IberBot es un asistente conversacional flotante implementado íntegramente en `chatbot.js`. Combina dos fuentes de respuesta:

1. **Base de conocimiento estática (KB)** — Reglas predefinidas para preguntas sobre navegación, registro, partidas y descarga. Respuesta instantánea, sin llamadas de red.
2. **Consultas en tiempo real a la API** — Detecta peticiones sobre Ibermon, movimientos e ítems, realiza `fetch` a la API REST y formatea la respuesta como una tarjeta visual.

```
Mensaje del usuario
        │
        ▼
 getStaticResponse(text)
        │
   ¿Coincide KB?
        │
       SÍ ──→ Respuesta inmediata (300 ms)
        │
        NO
        │
        ▼
 detectAPIIntent(text)   ←── patrones regex
        │
   ¿Hay intención?
        │
       SÍ ──→ [loading] ──→ resolveAPIIntent() ──→ tarjeta HTML
        │
        NO
        │
        ▼
 tryNameSearch(text)   ←── búsqueda directa en catálogos cacheados
        │
   ¿Hay coincidencia?
        │
       SÍ ──→ [loading] ──→ resolveAPIIntent() ──→ tarjeta HTML
        │
        NO ──→ Respuesta por defecto (aleatoria)
```

> 📷 **Figura 15 — Insertar captura de pantalla: botón flotante del chatbot (esquina inferior derecha de la página) y el panel del chatbot abierto con el mensaje de bienvenida y los botones de respuesta rápida.**

### 10.2 Detección de intención

La función `detectAPIIntent(raw)` normaliza el texto (minúsculas, sin tildes, sin puntuación) y aplica una serie de expresiones regulares para clasificar la petición.

**Intenciones soportadas:**

| Intent | Ejemplos de entrada | Acción |
|---|---|---|
| `ibermon` (por número) | `#001`, `ibermon #3`, `numero 25` | `GET /catalogo/ibermon/{n}` |
| `ibermon` (por nombre con keyword) | `busca Toriverde`, `info Aguabrava` | Búsqueda en caché + `GET /catalogo/ibermon/{n}` |
| `ibermon` (nombre directo) | `Toriverde`, `Aguabrava` | `tryNameSearch` → caché → API |
| `movimiento` | `movimiento Llamarada`, `ataque Hidrocañón` | Caché + `GET /catalogo/movimientos/{n}` |
| `item` | `item Poción`, `objeto Iberball` | Caché + `GET /catalogo/items/{n}` |
| `lista_ibermon` | `lista ibermon`, `todos los ibermon` | `GET /catalogo/ibermon` → resumen |
| `lista_movimientos` | `lista movimientos`, `todos los ataques` | `GET /catalogo/movimientos` → resumen |
| `lista_items` | `lista items`, `todos los objetos` | `GET /catalogo/items` → resumen |

### 10.3 Caché de catálogos y precarga

Para evitar peticiones redundantes, el chatbot mantiene un caché en memoria de los tres catálogos. Además, en cuanto el usuario abre el panel del chatbot por primera vez, se lanzan en background tres peticiones silenciosas (`preloadCatalogs()`) para que el caché esté listo antes de que el usuario escriba su primera consulta.

```javascript
const _cache = { ibermon: null, movimientos: null, items: null };

async function getIbermonList() {
  return (_cache.ibermon ||= await _fetchJSON('ibermon'));
}
```

La búsqueda por nombre admite coincidencia exacta y coincidencia parcial.

### 10.4 Tarjetas de respuesta

Cuando la API devuelve datos, el chatbot los renderiza como HTML dentro de la burbuja de mensaje bot.

**Tarjeta de Ibermon** — Incluye número, nombre, tipos, descripción, barras de stats coloreadas por rango y metadatos (catch rate, EXP, evolución).

**Tarjeta de Movimiento** — Incluye tipo, categoría, potencia, precisión, PP y efecto.

**Tarjeta de Ítem** — Incluye tipo, descripción, precio y efecto.

> 📷 **Figura 16 — Insertar captura de pantalla: chatbot con una tarjeta de Ibermon visible en el historial de conversación, mostrando las barras de estadísticas y los badges de tipo.**

> 📷 **Figura 17 — Insertar captura de pantalla: chatbot mostrando el resultado de buscar un movimiento o un ítem directamente por nombre (sin palabras clave previas).**

### 10.5 Indicador de carga

Mientras espera la respuesta de la API, el chatbot inserta una burbuja especial con tres puntos animados (clase `.chat-loading`). Este elemento se elimina del DOM en cuanto llega la respuesta.

### 10.6 Quick replies

El panel del chatbot incluye cuatro botones de respuesta rápida predefinidos:

| Botón | Mensaje enviado |
|---|---|
| 🔍 Buscar Ibermon | `busca ibermon #001` |
| ⚔️ Ver movimientos | `lista movimientos` |
| 🎒 Ver ítems | `lista items` |
| 📖 Catálogo completo | `catalogo` |

### 10.7 Fuzzy matching (Levenshtein)

El chatbot incorpora **búsqueda difusa** con un umbral adaptativo según la
longitud del texto, para tolerar errores de tipeo en los nombres de Ibermon,
movimientos e ítems.

```js
levenshtein(a, b)         // Distancia de edición (DP clásico)
fuzzyThreshold(len)       // Umbral por longitud:
                          //   ≤4 chars → 1 error,  ≤7 → 2,  ≤11 → 3,  más → 4
fuzzyFindByName(query, list)  // Mejor coincidencia bajo umbral
```

Cuando hay una corrección, el chatbot muestra una nota visual con la clase
`.ibot-fuzzy-note` ("¿Quisiste decir...?") para que el usuario sepa que se
ha aplicado una sugerencia y no que se ha obtenido un resultado exacto.

---

## 11. Combate Online 6vs6

El portal incluye un **modo de combate por turnos** jugable entre pestañas
del navegador (PvP) o contra una CPU. Es funcionalmente similar a Pokémon
Showdown, pero **no requiere un servidor adicional** — se construye sobre
la API `BroadcastChannel` del navegador.

### 11.1 Arquitectura general

```
┌────────────────────────────────────────────────────────────┐
│             scripts/pages/combate.js (UI)                  │
│   - Pantallas, botones, sprites, barras de PS, log         │
│   - Recibe acción del jugador y la del rival               │
│   - Reproduce los eventos del turno con animaciones        │
└──────────┬───────────────────────────────────┬─────────────┘
           │                                   │
           ▼                                   ▼
┌──────────────────────┐         ┌────────────────────────────┐
│  modules/battle.js   │         │  modules/matchmaking.js     │
│  Motor de combate    │         │  Emparejamiento PvP         │
│                      │         │                             │
│  - Fórmula de daño   │         │  - BroadcastChannel         │
│  - Tabla de tipos    │         │  - Protocolo de mensajes    │
│  - Orden de turno    │         │  - HOST/GUEST + heartbeat   │
│  - IA del bot        │         │                             │
└──────────────────────┘         └────────────────────────────┘
```

### 11.2 Pantallas y flujo de UI

La página tiene 4 secciones (`<section class="screen">`) y un sistema de
clases CSS que muestra solo una a la vez (`.screen-active`):

```
[ select-screen ] → [ queue-screen ] → [ battle-screen ] → [ result-screen ]
       │                  │                   │                   │
       │                  └─→ "Jugar contra CPU" ─→ ───────────┘  │
       │                                                          │
       └────────────── Aleatorio + Buscar rival ──────────────────┘
                                  │
                       Otra pestaña hace lo mismo
                                  │
                            (matchmaking)
```

### 11.3 Fórmula de daño

El motor implementa una versión simplificada de la fórmula de Pokémon:

```
daño = ((2*N/5 + 2) * POT * A/D / 50 + 2) * STAB * TIPO * CRIT * RND
```

| Variable | Significado | Origen |
|---|---|---|
| `N` | Nivel del atacante | Constante 50 (`Battle.NIVEL_FIJO`) |
| `POT` | Potencia del movimiento | Catálogo |
| `A`, `D` | Ataque/Defensa (Especial si la categoría lo es) | Stats del Ibermon |
| `STAB` | 1.5 si tipo del movimiento ∈ tipos del atacante | Calculado |
| `TIPO` | Producto de efectividades contra los tipos del defensor | Tabla reducida |
| `CRIT` | 1.5 con probabilidad 1/16 | RNG |
| `RND` | Aleatorio entre 0.85 y 1.00 | RNG |

### 11.4 Emparejamiento por BroadcastChannel

`BroadcastChannel` es una API nativa del navegador que permite intercambiar
mensajes entre **distintas pestañas o ventanas del mismo origen**. Todas las
pestañas que escuchen el canal `ibermon-matchmaking` reciben los mismos
mensajes.

**Flujo de emparejamiento:**

```
PESTAÑA A (busca rival)              PESTAÑA B (busca rival)
        │                                     │
        │ ─→ presencia (cada 2 s) ────────────→
        │                                     │
        │ ←──────── presencia (cada 2 s) ───  │
        │                                     │
   (compara ids: A < B → A es HOST)           │
        │                                     │
        │ ─→ emparejar({ host: false }) ──────→
        │                                     │
        │ ←──────── (acepta tácitamente) ───  │
        │                                     │
        │     emitir 'emparejado' a la UI     │
        │                                     │
        │ ─→ equipo (datos planos) ───────────→
        │ ←──────── equipo (datos planos) ──  │
        │                                     │
        │     ───── COMBATE ─────             │
```

**Ciclo de un turno** (desde la UI):

```
1. Cada jugador elige movimiento → enviarAccion(accion)
2. Llegan ambas acciones (la propia y la del rival)
3. SI soy HOST: Battle.resolverTurno() → eventos
              → enviarResultado(eventos, snapshot)
              → reproducirEventos(eventos)
4. SI soy GUEST: espero 'resultadoRecibido'
              → aplicarSnapshot(estado)
              → reproducirEventos(invertirLadoEvento(eventos))
```

### 11.5 Sincronización HOST/GUEST

Si las dos pestañas calcularan el turno por separado, el RNG del crítico,
el RNG del daño y la probabilidad de fallo divergirían y los dos jugadores
verían combates distintos. Para evitarlo, el HOST es la **autoridad** y
envía al GUEST un snapshot con el estado tras cada turno:

```js
{
  equipoA: [{ hp, fainted, moves: [{ pp }, ...] }, ...],
  equipoB: [{ hp, fainted, moves: [{ pp }, ...] }, ...],
  activoA: índice,
  activoB: índice,
}
```

El GUEST aplica este snapshot **antes** de reproducir los eventos visualmente,
lo que corrige cualquier divergencia.

### 11.6 Modo CPU

Si el usuario pulsa "Jugar contra la CPU" desde la pantalla de cola, el
combate se ejecuta enteramente en local. La función `Battle.decidirAccionBot`
elige acción para el bot:

- Si está bajo el 20% de PS y queda reserva, hay un **40% de probabilidad
  de cambiar** a otro Ibermon.
- Si no, elige el movimiento con mayor `potencia × STAB × efectividad`.

Es una IA deliberadamente simple — no hace lookahead de turnos, no calcula
expected damage exacto y no usa las stats del rival al elegir cambio. Eso
mantiene el combate jugable contra el bot sin que sea sobrehumano.

### 11.7 Limitaciones

- **`BroadcastChannel` solo enlaza pestañas del mismo equipo.** Para multi-máquina
  haría falta un endpoint de signaling (WebSocket) en la API. Esto se
  documentó como decisión consciente: el TFG se centraba en el cliente y
  no se quería tocar la API que ya usaba el juego de Unity.
- **Sin estados** (paralizado, dormido, envenenado, etc.). Los movimientos
  con potencia 0 se muestran como "sin efecto aparente".
- **Sin objetos en combate** ni habilidades.

---

## 12. Despliegue con Docker

### 12.1 Imagen del frontend (`Dockerfile`)

```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

La imagen base `nginx:alpine` es extremadamente ligera (~5 MB). Los ficheros estáticos se copian directamente en el directorio raíz de nginx.

### 12.2 Configuración de nginx (`nginx.conf`)

nginx cumple dos funciones simultáneas:

1. **Servidor de ficheros estáticos** con caché de 7 días para assets (CSS, JS, imágenes, fuentes).
2. **Reverse proxy** para la API: cualquier petición a `/api/...` se redirige al contenedor `ibermon_api:8000`, eliminando los problemas de CORS en producción.

```nginx
location /api/ {
    proxy_pass http://ibermon_api:8000/;
    # ...
}
```

### 12.3 Stack completo (`docker-compose.yml`)

El fichero `docker-compose.yml` define tres servicios interconectados en una red privada `ibermon_network`:

| Servicio | Imagen | Puerto expuesto | Descripción |
|---|---|---|---|
| `frontend` | Construida desde `Dockerfile` | `3000:80` | Frontend nginx |
| `api` | `ibermon_api:latest` | `8000:8000` | FastAPI |
| `mongodb` | `mongo:7.0` | `27017:27017` | Base de datos |

**Variables de entorno de la API:**

| Variable | Valor por defecto (dev) | Descripción |
|---|---|---|
| `MONGO_URI` | `mongodb://admin:admin123@mongodb:27017/ibermon_db` | URI de conexión |
| `MONGO_DB_NAME` | `ibermon_db` | Nombre de la base de datos |
| `SECRET_KEY` | `dev_secret_key_de_prueba` | Clave para firmar JWT (**cambiar en producción**) |
| `ALGORITHM` | `HS256` | Algoritmo de firma JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Expiración del token |

MongoDB incluye un **healthcheck** que impide que la API arranque hasta que la base de datos esté lista, evitando errores de conexión en el inicio.

### 12.4 Comandos de uso

```bash
# Construir y arrancar el stack completo
docker-compose up --build -d

# Ver logs en tiempo real
docker-compose logs -f

# Detener y eliminar contenedores
docker-compose down

# Detener y eliminar contenedores + volúmenes (borra datos de MongoDB)
docker-compose down -v
```

El frontend queda disponible en `http://localhost:3000` y la API en `http://localhost:8000`.

> 📷 **Figura 18 — Insertar captura de pantalla: terminal con la salida de `docker-compose up`, mostrando los tres contenedores arrancados correctamente (`ibermon_frontend`, `ibermon_api`, `ibermon_mongodb`).**

### 12.5 Cambio de API_BASE para Docker

Para que el frontend use el proxy de nginx en lugar del puerto directo, hay que cambiar una línea en `scripts/modules/config.js`:

```javascript
// Desarrollo local
API_BASE: 'http://localhost:8000'

// Con Docker (nginx actúa de proxy)
API_BASE: '/api'
```

---

## 13. Seguridad

### 13.1 Contraseñas

Las contraseñas nunca se almacenan en texto plano. La API utiliza **bcrypt** (a través de `passlib`) para el hashing. bcrypt incluye un salt aleatorio por hash, lo que hace que dos contraseñas idénticas generen hashes diferentes.

### 13.2 Tokens JWT

- Los tokens están firmados con HMAC-SHA256 (`HS256`) usando una clave secreta configurable.
- Tienen expiración de 60 minutos. Un token expirado es rechazado con un `401`.
- Solo se transmiten a través de la cabecera HTTP `Authorization`, no como parámetros de URL.
- Se almacenan en `localStorage` en el cliente. Para aplicaciones de mayor sensibilidad se podría considerar `httpOnly cookies`, pero para un portal de videojuego el nivel es adecuado.

### 13.3 CORS

- En **desarrollo local**, la API tiene CORS habilitado para permitir peticiones desde el navegador directamente a `localhost:8000`.
- En **producción con Docker**, el proxy de nginx elimina la necesidad de CORS: el navegador habla con nginx (mismo origen), y nginx redirige las peticiones a la API en la red interna de Docker.

### 13.4 Autorización en endpoints privados

Los endpoints de partidas verifican que el token pertenece al mismo usuario que posee la partida solicitada. Esto se gestiona mediante la dependencia `get_current_user` de FastAPI, que extrae el usuario del token y lo compara con el `usuario_id` de la partida.

### 13.5 Validación de datos

FastAPI + Pydantic v2 validan automáticamente el tipo, formato y restricciones de todos los campos de entrada en los endpoints. Los errores de validación devuelven un `422 Unprocessable Entity` con detalle de los campos incorrectos, sin exponer información interna del servidor.

---

## 14. Decisiones de Diseño

### ¿Por qué JavaScript Vanilla en lugar de un framework?

El frontend de Ibermon no requiere gestión de estado compleja ni renderizado del lado del servidor. Usar HTML + CSS + JS puro permite:

- **Cero tiempo de compilación** — Los ficheros se sirven directamente.
- **Sin dependencias de `node_modules`** — El Dockerfile es trivial.
- **Control total del DOM** — No hay capa de abstracción que oculte el comportamiento real.
- **Curva de aprendizaje cero** — Todos los conceptos son estándar y portables.

### ¿Por qué un solo `main.css`?

Con la escala del proyecto (seis páginas, sin componentes reutilizables complejos), dividir el CSS en múltiples archivos añadiría overhead de red sin beneficio real. Para el ámbito del TFG la solución única es más manejable y fácil de auditar.

### ¿Por qué MongoDB para un juego?

El modelo de datos de un RPG es naturalmente variable: distintos Ibermon tienen distintos atributos, las partidas acumulan flags de mundo que crecen dinámicamente, los ítems tienen efectos heterogéneos. MongoDB permite guardar estos documentos sin necesidad de migraciones de esquema al añadir nuevos campos, lo que agiliza la iteración durante el desarrollo del juego.

### ¿Por qué Beanie como ODM?

Beanie es el ODM asíncrono más maduro para FastAPI + MongoDB. Integra Pydantic v2 de forma nativa, lo que permite definir los modelos una sola vez y usarlos tanto como documentos de MongoDB como como schemas de validación de la API.

### ¿Por qué nginx como reverse proxy en lugar de habilitar CORS en la API?

Habilitar CORS en FastAPI añade cabeceras `Access-Control-Allow-Origin` a todas las respuestas, lo que es correcto pero expone la URL real de la API. Con nginx como proxy, el navegador solo conoce la URL del frontend; la API es completamente invisible desde el exterior, lo que reduce la superficie de ataque.

---

*Documentación generada el 14 de abril de 2026 para el Trabajo de Fin de Grado — Ibermon.*
