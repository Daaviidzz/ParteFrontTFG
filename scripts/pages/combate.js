/**
 * scripts/pages/combate.js — Controlador de la página de combate
 *
 * Esta es la "orquesta" que conecta tres cosas:
 *   1. La UI (pantallas, botones, barras de PS, log, modales...)
 *   2. El motor de combate (Battle) — quien calcula qué pasa cada turno.
 *   3. El matchmaking (Matchmaking) — quien conecta con el rival humano.
 *
 * El código está dividido en secciones para que sea fácil de seguir:
 *   - Constantes y estado global de la página
 *   - Arranque (DOMContentLoaded)
 *   - Pantalla 1: selección de equipo
 *   - Pantalla 2: matchmaking (cola)
 *   - Pantalla 3: combate en vivo
 *   - Pantalla 4: resultado final
 *   - Helpers de UI (pantallas, dialog, log, sprites...)
 *
 * He dejado muchos comentarios porque hay cosas NO obvias (como por qué
 * el HOST envía resultados o por qué animo las barras de PS con delay).
 */


// ══════════════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// Lo pongo fuera de las funciones porque varias de ellas necesitan
// leer/escribir el mismo estado y pasárselo como parámetro sería un lío.
// En un proyecto grande lo metería en una clase, pero aquí así queda claro.
// ══════════════════════════════════════════════════════════════════════

const Combate = {
  // Datos cargados de la API (se cachean al entrar a la página)
  catalogoIbermon:    [],     // lista reducida para el selector
  catalogoMovimientos:[],     // lista de movs completa (se usa al construir unidad)

  // Selección del jugador
  seleccionNumeros:   [],     // ids de Ibermon elegidos (máx 6)

  // Equipos construidos (cuando empieza el combate)
  equipoYo:           [],     // array de unidades Battle.buildUnit()
  equipoFoe:          [],

  // Estado del combate
  activoYo:           null,   // referencia a la unidad activa
  activoFoe:          null,
  turno:              0,
  modoBot:            false,  // true si el rival es CPU (y no otra pestaña)
  esperandoAccion:    false,  // bloqueo de botones mientras se resuelve turno
  accionPendiente:    null,   // acción que el jugador ya eligió en este turno
  accionRival:        null,   // acción del rival humano cuando llegue
  combateTerminado:   false,
};


// ══════════════════════════════════════════════════════════════════════
// ARRANQUE
// Al cargar la página, pido el catálogo y monto la selección de equipo.
// Además inicializo el canal de matchmaking por si el usuario decide
// buscar rival humano.
// ══════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  // Muestro el nombre del usuario si está logueado, si no "Entrenador"
  const usuario = Auth.getUser?.();
  const nombre  = usuario?.username || 'Entrenador';

  Matchmaking.init(nombre);

  // Cargo los datos del catálogo en paralelo (más rápido que uno tras otro).
  // Si la API falla, muestro un mensaje y paro aquí — sin catálogo no hay combate.
  try {
    const [ibermon, movs] = await Promise.all([
      CatalogAPI.ibermon(),
      CatalogAPI.movimientos(),
    ]);
    Combate.catalogoIbermon     = ibermon;
    Combate.catalogoMovimientos = movs;
  } catch (e) {
    mostrarErrorFatal('No se pudo cargar el catálogo: ' + e.message);
    return;
  }

  renderPickerGrid();

  // Conexiones de botones de la pantalla 1
  document.getElementById('btnTeamRandom').addEventListener('click', seleccionAleatoria);
  document.getElementById('btnTeamReady').addEventListener('click',  comenzarBusqueda);

  // Buscador
  document.getElementById('combatSearch').addEventListener('input', e => {
    renderPickerGrid(e.target.value.trim().toLowerCase());
  });

  // Botones de la cola
  document.getElementById('btnFightBot').addEventListener('click', lanzarContraBot);
  document.getElementById('btnQueueCancel').addEventListener('click', cancelarBusqueda);

  // Botones del combate
  document.getElementById('btnSwitch').addEventListener('click',  abrirModalCambio);
  document.getElementById('btnForfeit').addEventListener('click', rendirse);
  document.getElementById('switchCancel').addEventListener('click', cerrarModalCambio);

  // Botones de resultado
  document.getElementById('btnRematch').addEventListener('click', () => location.reload());

  // Listeners del emparejamiento — los registro desde el principio.
  // Si luego el usuario juega contra la CPU, estos callbacks no se disparan
  // y tampoco molestan.
  registrarListenersMatchmaking();

  // Al cerrar la pestaña aviso al rival por si estamos emparejados,
  // para que no se quede esperando eternamente.
  window.addEventListener('beforeunload', () => {
    try { Matchmaking.rendirse(); } catch (_) {}
    Matchmaking.cerrar();
  });
});


// ══════════════════════════════════════════════════════════════════════
// PANTALLA 1: SELECCIÓN DE EQUIPO
// El usuario elige 6 Ibermon del catálogo.
// ══════════════════════════════════════════════════════════════════════

/** Renderiza el grid de selección. El filtro es opcional (texto a buscar). */
function renderPickerGrid(filtro = '') {
  const cont = document.getElementById('ibermonPickerGrid');
  const q = filtro.toLowerCase();

  // Filtro por nombre (igual que en el catálogo). Sin filtro, muestra todo.
  const lista = q
    ? Combate.catalogoIbermon.filter(i => i.nombre.toLowerCase().includes(q))
    : Combate.catalogoIbermon;

  if (lista.length === 0) {
    cont.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <p>Ningún Ibermon coincide con "<strong>${filtro}</strong>"</p>
      </div>`;
    return;
  }

  cont.innerHTML = `
    <div class="ibermon-grid">
      ${lista.map(i => renderPickerCard(i)).join('')}
    </div>`;

  // Click en cada tarjeta para añadir/quitar del equipo
  cont.querySelectorAll('[data-num]').forEach(c => {
    c.addEventListener('click', () => togglePicker(parseInt(c.dataset.num)));
  });
}


/** Una tarjeta del selector. Le pongo un check visual si está seleccionada. */
function renderPickerCard(i) {
  const marcada = Combate.seleccionNumeros.includes(i.numero);
  return `
    <div class="ibermon-card picker-card ${marcada ? 'picked' : ''}" data-num="${i.numero}">
      ${marcada ? '<div class="picker-check">✓</div>' : ''}
      <div class="card-num">${formatNum(i.numero)}</div>
      ${imgWithFallback(i.sprite, i.nombre, 'card-sprite')}
      <div class="card-name">${i.nombre}</div>
      <div class="card-types">
        ${tipoBadge(i.tipo1)}
        ${i.tipo2 ? tipoBadge(i.tipo2) : ''}
      </div>
    </div>`;
}


/** Añade/quita un Ibermon al equipo. Máx 6. */
function togglePicker(numero) {
  const idx = Combate.seleccionNumeros.indexOf(numero);
  if (idx >= 0) {
    // Ya estaba — lo quito
    Combate.seleccionNumeros.splice(idx, 1);
  } else {
    // No estaba — lo añado solo si aún no tiene 6
    if (Combate.seleccionNumeros.length >= 6) {
      // Si ya hay 6, aviso con un pequeño flash. En vez de un alert(),
      // que queda feo, animo la barra superior.
      parpadearSlots();
      return;
    }
    Combate.seleccionNumeros.push(numero);
  }
  actualizarSlotsEquipo();
  renderPickerGrid(document.getElementById('combatSearch').value.trim().toLowerCase());
}


/** Refresca la barra de slots y el botón "Buscar rival". */
function actualizarSlotsEquipo() {
  const slots = document.getElementById('teamSlots');
  const els   = slots.querySelectorAll('.team-slot');
  const btn   = document.getElementById('btnTeamReady');

  for (let i = 0; i < 6; i++) {
    const num = Combate.seleccionNumeros[i];
    const el  = els[i];
    if (num === undefined) {
      el.className   = 'team-slot empty';
      el.textContent = 'Vacío';
    } else {
      const ib = Combate.catalogoIbermon.find(x => x.numero === num);
      el.className = 'team-slot';
      el.innerHTML = `
        ${imgWithFallback(ib.sprite, ib.nombre, 'slot-sprite')}
        <span class="slot-name">${ib.nombre}</span>`;
    }
  }

  // El botón se activa solo cuando hay 6 Ibermon
  btn.disabled = Combate.seleccionNumeros.length !== 6;
}


/** Elige 6 Ibermon al azar — útil para no tener que elegir cada vez al probar. */
function seleccionAleatoria() {
  const copia = [...Combate.catalogoIbermon];
  Combate.seleccionNumeros = [];
  // Saco 6 elementos al azar sin repetir (algoritmo Fisher-Yates parcial)
  for (let i = 0; i < 6 && copia.length > 0; i++) {
    const idx = Math.floor(Math.random() * copia.length);
    Combate.seleccionNumeros.push(copia[idx].numero);
    copia.splice(idx, 1);
  }
  actualizarSlotsEquipo();
  renderPickerGrid(document.getElementById('combatSearch').value.trim().toLowerCase());
}


/** Efecto visual cuando intentan añadir un 7º Ibermon. */
function parpadearSlots() {
  const slots = document.getElementById('teamSlots');
  slots.classList.remove('shake');
  // Force reflow para que la animación se vuelva a disparar — truco habitual.
  void slots.offsetWidth;
  slots.classList.add('shake');
}


// ══════════════════════════════════════════════════════════════════════
// PANTALLA 2: MATCHMAKING
// Al pulsar "Buscar rival", paso a la pantalla de cola y publico mi
// presencia. Cuenta un timer para ver que hay actividad.
// ══════════════════════════════════════════════════════════════════════

let _queueTimerId   = null;   // intervalo que va incrementando el contador
let _queueToken     = null;   // retorno de Matchmaking.buscar() para cancelar
let _queueSegundos  = 0;


/** Al pulsar "Buscar rival" */
async function comenzarBusqueda() {
  // Construyo mi equipo YA (así si me emparejan, solo tengo que enviarlo).
  // Uso el detalle completo porque necesito stats base y movimientos.
  try {
    Combate.equipoYo = await construirEquipoDesdeCatalogo(Combate.seleccionNumeros);
  } catch (e) {
    alert('Error al preparar el equipo: ' + e.message);
    return;
  }

  mostrarPantalla('screen-queue');
  Combate.modoBot = false;

  // Timer de segundos — puramente estético, pero ayuda a no pensar que
  // la página se ha quedado pillada.
  _queueSegundos = 0;
  document.getElementById('queueTimer').textContent = '00:00';
  _queueTimerId = setInterval(() => {
    _queueSegundos++;
    const mm = String(Math.floor(_queueSegundos / 60)).padStart(2, '0');
    const ss = String(_queueSegundos % 60).padStart(2, '0');
    document.getElementById('queueTimer').textContent = `${mm}:${ss}`;
  }, 1000);

  _queueToken = Matchmaking.buscar();
}


/** Al pulsar "Cancelar" en la cola */
function cancelarBusqueda() {
  if (_queueToken) _queueToken.cancelar();
  if (_queueTimerId) clearInterval(_queueTimerId);
  _queueToken = null;
  _queueTimerId = null;
  mostrarPantalla('screen-select');
}


/** Al pulsar "Jugar contra la CPU" */
async function lanzarContraBot() {
  // Paro la cola de buscar si estaba activa
  if (_queueToken) _queueToken.cancelar();
  if (_queueTimerId) clearInterval(_queueTimerId);

  Combate.modoBot = true;

  // El bot tiene un equipo aleatorio de 6 Ibermon distintos al mío
  // (sería raro enfrentarme a seis copias exactas de los míos).
  const ajenos = Combate.catalogoIbermon
    .filter(i => !Combate.seleccionNumeros.includes(i.numero))
    .map(i => i.numero);

  const equipoBotNums = [];
  while (equipoBotNums.length < 6 && ajenos.length > 0) {
    const idx = Math.floor(Math.random() * ajenos.length);
    equipoBotNums.push(ajenos[idx]);
    ajenos.splice(idx, 1);
  }

  try {
    if (Combate.equipoYo.length === 0) {
      Combate.equipoYo = await construirEquipoDesdeCatalogo(Combate.seleccionNumeros);
    }
    Combate.equipoFoe = await construirEquipoDesdeCatalogo(equipoBotNums);
  } catch (e) {
    alert('Error preparando el combate: ' + e.message);
    return;
  }

  // En modo bot yo siempre soy el "HOST" (nadie más calcula nada)
  arrancarCombate('CPU', true);
}


// ══════════════════════════════════════════════════════════════════════
// LISTENERS DE MATCHMAKING
// Aquí respondo a lo que llega del otro jugador a través del canal.
// ══════════════════════════════════════════════════════════════════════

function registrarListenersMatchmaking() {

  // --- Cuando se actualiza el estado de la cola ---
  Matchmaking.on('buscandoEstado', (txt) => {
    const el = document.getElementById('queueStatus');
    if (el) el.textContent = txt;
  });


  // --- Cuando encontramos rival ---
  Matchmaking.on('emparejado', async (peer) => {
    if (_queueTimerId) clearInterval(_queueTimerId);

    // Envío mi equipo "aplanado" (sin funciones, solo datos)
    const planos = Combate.equipoYo.map(aplanarUnidad);
    Matchmaking.enviarEquipo(planos);

    // Me guardo el nombre del rival para la UI
    Combate._nombreRival = peer.nombre;
    // (Si el rival envía el suyo antes que yo, ya lo procesará el handler de abajo)
  });


  // --- El rival manda su equipo (los datos planos) ---
  Matchmaking.on('equipoRecibido', (equipoPlano) => {
    // Reconstruyo las unidades a partir de los datos recibidos.
    // No me fío de que el otro use los mismos nombres de variables que
    // yo si hay versiones distintas del código, por eso aplano/desaplano.
    Combate.equipoFoe = equipoPlano.map(rehidratarUnidad);

    // Cuando tengo ambos equipos listos, arranco el combate
    if (Combate.equipoYo.length && Combate.equipoFoe.length) {
      arrancarCombate(Combate._nombreRival || 'Rival', Matchmaking.soyHost());
    }
  });


  // --- Acción del rival en el turno ---
  Matchmaking.on('accionRecibida', (accion) => {
    Combate.accionRival = accion;
    resolverTurnoSiProcede();
  });


  // --- El HOST me manda el resultado ya calculado (yo soy GUEST) ---
  Matchmaking.on('resultadoRecibido', ({ eventos, estado }) => {
    // Aplico el snapshot sobre mi estado local para que coincida
    aplicarSnapshot(estado);
    // Los eventos vienen con el "lado" desde el punto de vista del HOST
    // (A = su equipo, B = el mío). Los invierto para que, al replayar,
    // "A" siga siendo MI equipo en MI pantalla y todo encaje visualmente.
    const invertidos = eventos.map(invertirLadoEvento);
    reproducirEventos(invertidos);
  });


  // --- El rival se ha rendido o cerrado la pestaña ---
  Matchmaking.on('rivalSeFue', ({ motivo }) => {
    if (Combate.combateTerminado) return;
    Combate.combateTerminado = true;
    const msg = motivo === 'rendicion'
      ? 'Tu rival se ha rendido.'
      : 'Tu rival se ha desconectado.';
    mostrarResultado(true, msg);
  });
}


// ══════════════════════════════════════════════════════════════════════
// PANTALLA 3: COMBATE
// Una vez tengo ambos equipos montados, arranco el combate.
// ══════════════════════════════════════════════════════════════════════

/** Lanza la pantalla de combate. */
function arrancarCombate(nombreRival, esHost) {
  Combate.activoYo  = Combate.equipoYo[0];
  Combate.activoFoe = Combate.equipoFoe[0];
  Combate.turno     = 1;
  Combate.combateTerminado = false;
  Combate._soyHost  = esHost;

  document.getElementById('battleYouName').textContent = Auth.getUser?.()?.username || 'Tú';
  document.getElementById('battleFoeName').textContent = nombreRival;

  mostrarPantalla('screen-battle');
  pintarActivos();
  actualizarBotonesMovimientos();
  addLog(`¡${Combate.activoYo.nombre}, yo te elijo!`);
  addLog(`${nombreRival} envía a ${Combate.activoFoe.nombre}.`);
  setDialog(`¿Qué hará ${Combate.activoYo.nombre}?`);
}


/** Repinta las barras de PS, sprites y nombres. */
function pintarActivos() {
  const y = Combate.activoYo;
  const f = Combate.activoFoe;

  // Lado jugador
  document.getElementById('youName').textContent    = y.nombre;
  document.getElementById('youLvl').textContent     = `Nv.${y.nivel}`;
  document.getElementById('youSprite').src          = y.sprite;
  document.getElementById('youTypes').innerHTML     = y.tipos.map(tipoBadge).join('');
  document.getElementById('youHpNum').textContent   = `${y.hp}/${y.hpMax}`;
  pintarHP('youHp', y.hp, y.hpMax);

  // Lado rival
  document.getElementById('foeName').textContent    = f.nombre;
  document.getElementById('foeLvl').textContent     = `Nv.${f.nivel}`;
  document.getElementById('foeSprite').src          = f.sprite;
  document.getElementById('foeTypes').innerHTML     = f.tipos.map(tipoBadge).join('');
  pintarHP('foeHp', f.hp, f.hpMax);
}


/** Actualiza una barra de PS con color según el % restante. */
function pintarHP(id, actual, max) {
  const pct = Math.max(0, (actual / max) * 100);
  const el  = document.getElementById(id);
  el.style.width = pct + '%';

  // Colores como en Pokémon: verde >50%, amarillo 20-50%, rojo <20%
  el.classList.remove('hp-green', 'hp-yellow', 'hp-red');
  if      (pct > 50) el.classList.add('hp-green');
  else if (pct > 20) el.classList.add('hp-yellow');
  else                el.classList.add('hp-red');
}


/** Pinta los 4 botones de movimiento de la unidad activa. */
function actualizarBotonesMovimientos() {
  const cont = document.getElementById('actionMoves');
  const u    = Combate.activoYo;

  cont.innerHTML = u.moves.map((m, i) => `
    <button class="move-btn tipo-${m.tipo.replace('é','e').replace('ó','o').replace('í','i')}"
            data-mov="${i}" ${m.pp <= 0 ? 'disabled' : ''}>
      <span class="move-name">${m.nombre}</span>
      <span class="move-info">
        <span class="move-type">${m.tipo}</span>
        <span class="move-pp">${m.pp}/${m.ppMax} PP</span>
      </span>
    </button>`).join('');

  cont.querySelectorAll('[data-mov]').forEach(btn => {
    btn.addEventListener('click', () => elegirMovimiento(parseInt(btn.dataset.mov)));
  });
}


/** El jugador pulsa un movimiento */
function elegirMovimiento(idx) {
  if (Combate.esperandoAccion || Combate.combateTerminado) return;

  // Bloqueo la interacción para que no pulsen dos veces
  Combate.esperandoAccion = true;
  Combate.accionPendiente = { tipo: 'mov', indice: idx };
  setDialog(`${Combate.activoYo.nombre} usa ${Combate.activoYo.moves[idx].nombre}...`);
  bloquearBotones(true);

  // Si es modo bot, el bot decide al momento y resolvemos.
  if (Combate.modoBot) {
    Combate.accionRival = Battle.decidirAccionBot(estadoBattle(), 'B');
    resolverTurnoSiProcede();
    return;
  }

  // Si es multijugador, mando mi acción y espero la suya
  Matchmaking.enviarAccion(Combate.accionPendiente);
  resolverTurnoSiProcede();
}


/**
 * Si tengo mi acción Y la del rival, resuelvo el turno.
 * El HOST calcula el resultado y se lo envía al GUEST. El GUEST espera.
 */
function resolverTurnoSiProcede() {
  if (!Combate.accionPendiente || !Combate.accionRival) return;

  // Si soy GUEST (no HOST) en modo multijugador, NO calculo yo el turno:
  // espero a que me llegue el resultado del HOST (que es la autoridad).
  // Es como en los juegos online: un jugador es servidor para evitar
  // desincronizaciones.
  if (!Combate._soyHost && !Combate.modoBot) {
    // Dejo las acciones guardadas hasta que el HOST mande el resultado
    return;
  }

  // Yo soy HOST (o modo bot) → resuelvo con el motor
  const estado = estadoBattle();
  const eventos = Battle.resolverTurno(estado, Combate.accionPendiente, Combate.accionRival);

  // Si es multijugador, mando el resultado al rival ANTES de reproducir
  // los eventos en pantalla (así él empieza a verlos más o menos a la vez).
  if (!Combate.modoBot) {
    Matchmaking.enviarResultado(eventos, snapshotEstado());
  }

  reproducirEventos(eventos);
}


/**
 * Reproduce los eventos de un turno en la UI, uno por uno con delay
 * para que parezca un combate y no un log vomitando texto.
 */
async function reproducirEventos(eventos) {
  for (const ev of eventos) {
    await reproducirEvento(ev);
  }

  // Tras reproducir todo, compruebo fin del combate
  if (Battle.equipoKO(Combate.equipoYo)) {
    Combate.combateTerminado = true;
    mostrarResultado(false, 'Has perdido el combate.');
    return;
  }
  if (Battle.equipoKO(Combate.equipoFoe)) {
    Combate.combateTerminado = true;
    mostrarResultado(true,  '¡Has ganado el combate!');
    return;
  }

  // Si uno de los activos está K.O., hay que elegir relevo forzado
  if (Combate.activoYo.fainted)  await forzarRelevoYo();
  if (Combate.activoFoe.fainted) await forzarRelevoFoe();

  // Limpio acciones y abro el siguiente turno
  Combate.accionPendiente = null;
  Combate.accionRival     = null;
  Combate.esperandoAccion = false;
  Combate.turno++;
  bloquearBotones(false);
  setDialog(`¿Qué hará ${Combate.activoYo.nombre}?`);
  actualizarBotonesMovimientos();
}


/** Maneja un evento del motor y lo convierte en UI + texto. */
async function reproducirEvento(ev) {
  switch (ev.tipo) {

    case 'cambio': {
      // Actualizo el activo en el estado según el lado
      if (ev.lado === 'A') Combate.activoYo  = ev.entra;
      else                  Combate.activoFoe = ev.entra;
      const nombreLado = ev.lado === 'A' ? 'Tú' : (Combate._nombreRival || 'El rival');
      addLog(`${nombreLado} retira a ${ev.sale.nombre} y saca a ${ev.entra.nombre}.`);
      setDialog(`${nombreLado} cambia a ${ev.entra.nombre}.`);
      pintarActivos();
      await delay(800);
      break;
    }

    case 'ataque':
      setDialog(`${ev.atacante.nombre} usa ${ev.mov.nombre}.`);
      addLog(`${ev.atacante.nombre} usa ${ev.mov.nombre}.`);
      // Pequeña animación de "temblor" del sprite atacante
      sacudirSprite(ev.lado === 'A' ? 'you-sprite' : 'foe-sprite');
      await delay(600);
      break;

    case 'falla':
      setDialog('¡Pero falló!');
      addLog(`${ev.atacante.nombre} falla el ataque.`);
      await delay(700);
      break;

    case 'sinPP':
      setDialog('¡Sin PP!');
      await delay(500);
      break;

    case 'noEfecto':
      setDialog('El movimiento no tuvo efecto aparente.');
      await delay(500);
      break;

    case 'impacto': {
      // Animación de daño sobre el defensor
      const cajaDef = ev.lado === 'A' ? 'foe-sprite' : 'you-sprite';
      flashDanyo(cajaDef);
      mostrarDanyoFlotante(cajaDef, ev.danyo, ev.critico);

      // Actualizo la barra de PS con una pequeña pausa para que se vea
      // la animación de la transición CSS (width).
      if (ev.lado === 'A') {
        Combate.activoFoe.hp = ev.hpRestante;
        pintarHP('foeHp', ev.hpRestante, ev.hpMax);
      } else {
        Combate.activoYo.hp = ev.hpRestante;
        pintarHP('youHp', ev.hpRestante, ev.hpMax);
        document.getElementById('youHpNum').textContent = `${ev.hpRestante}/${ev.hpMax}`;
      }

      // Texto de efectividad — igual que en los juegos
      if (ev.efect === 0)        { setDialog('No afecta...');           addLog('Sin efecto.'); }
      else if (ev.efect >= 2)    { setDialog('¡Es súper eficaz!');      addLog('Súper eficaz.'); }
      else if (ev.efect <= 0.5)  { setDialog('No es muy eficaz...');    addLog('Poco eficaz.'); }

      if (ev.critico) {
        addLog('¡Un golpe crítico!');
        setDialog('¡Golpe crítico!');
      }
      await delay(900);
      break;
    }

    case 'ko': {
      const unidad = ev.unidad;
      addLog(`¡${unidad.nombre} cae K.O.!`);
      setDialog(`¡${unidad.nombre} no puede continuar!`);
      // Animación de sprite cayendo
      const cls = ev.lado === 'A' ? 'you-sprite' : 'foe-sprite';
      document.querySelector('.' + cls).classList.add('fainted');
      await delay(1100);
      document.querySelector('.' + cls).classList.remove('fainted');
      break;
    }
  }
}


// ══════ SELECCIÓN DE RELEVO ══════
// Cuando un Ibermon cae, hay que sacar otro.

/** Muestra el modal y espera a que el jugador elija un relevo. */
function forzarRelevoYo() {
  return new Promise(resolve => {
    abrirModalCambio(true, (slot) => {
      Combate.activoYo = Combate.equipoYo[slot];
      addLog(`¡Adelante, ${Combate.activoYo.nombre}!`);
      pintarActivos();
      actualizarBotonesMovimientos();
      resolve();
    });
  });
}


/** Selección automática para el rival cuando cae su activo. */
function forzarRelevoFoe() {
  return new Promise(resolve => {
    const idx = Combate.equipoFoe.findIndex(u => !u.fainted);
    if (idx < 0) return resolve();
    Combate.activoFoe = Combate.equipoFoe[idx];
    const nombreLado = Combate._nombreRival || 'El rival';
    addLog(`${nombreLado} saca a ${Combate.activoFoe.nombre}.`);
    pintarActivos();
    setTimeout(resolve, 600);
  });
}


// ══════ CAMBIO VOLUNTARIO ══════

/**
 * Abre el modal para elegir qué Ibermon sacar.
 * Si "forzado" es true, es porque el activo ha caído (no se puede cancelar).
 */
function abrirModalCambio(forzado = false, callback = null) {
  const lista = document.getElementById('switchList');
  const modal = document.getElementById('switchModal');
  const cerrarBtn = document.getElementById('switchCancel');

  // Si es forzado, oculto el botón de cerrar
  cerrarBtn.style.display = forzado ? 'none' : '';

  lista.innerHTML = Combate.equipoYo.map((u, i) => {
    const activo = (u === Combate.activoYo);
    const disabled = u.fainted || activo;
    const etiqueta = u.fainted ? '(K.O.)' : activo ? '(activo)' : '';
    return `
      <div class="switch-item ${disabled ? 'disabled' : ''}" data-slot="${i}">
        ${imgWithFallback(u.sprite, u.nombre, 'switch-sprite')}
        <div class="switch-info">
          <div class="switch-name">${u.nombre} ${etiqueta}</div>
          <div class="switch-hp">PS: ${u.hp}/${u.hpMax}</div>
          <div class="switch-bar"><div class="switch-bar-fill" style="width:${(u.hp / u.hpMax) * 100}%"></div></div>
        </div>
      </div>`;
  }).join('');

  // Conecto el click de cada item
  lista.querySelectorAll('.switch-item:not(.disabled)').forEach(it => {
    it.addEventListener('click', () => {
      const slot = parseInt(it.dataset.slot);
      modal.classList.remove('open');

      if (callback) {
        callback(slot);
      } else {
        // Cambio voluntario — cuenta como acción del turno
        Combate.esperandoAccion = true;
        Combate.accionPendiente = { tipo: 'cambio', slot };
        bloquearBotones(true);
        setDialog('Cambiando de Ibermon...');
        if (Combate.modoBot) {
          Combate.accionRival = Battle.decidirAccionBot(estadoBattle(), 'B');
          resolverTurnoSiProcede();
        } else {
          Matchmaking.enviarAccion(Combate.accionPendiente);
          resolverTurnoSiProcede();
        }
      }
    });
  });

  modal.classList.add('open');
}


function cerrarModalCambio() {
  document.getElementById('switchModal').classList.remove('open');
}


// ══════ RENDICIÓN ══════

function rendirse() {
  if (Combate.combateTerminado) return;
  // Pequeña confirmación — es una acción irreversible
  if (!confirm('¿Seguro que quieres rendirte? Perderás el combate.')) return;

  Combate.combateTerminado = true;
  if (!Combate.modoBot) Matchmaking.rendirse();
  mostrarResultado(false, 'Te has rendido.');
}


// ══════════════════════════════════════════════════════════════════════
// PANTALLA 4: RESULTADO
// ══════════════════════════════════════════════════════════════════════

function mostrarResultado(ganado, texto) {
  document.getElementById('resultIcon').textContent  = ganado ? '🏆' : '💀';
  document.getElementById('resultTitle').textContent = ganado ? '¡Victoria!' : 'Derrota';
  document.getElementById('resultText').textContent  = texto;
  mostrarPantalla('screen-result');
}


// ══════════════════════════════════════════════════════════════════════
// CONSTRUCCIÓN DE EQUIPO
// Pide el detalle de cada Ibermon y monta las unidades de combate.
// ══════════════════════════════════════════════════════════════════════

async function construirEquipoDesdeCatalogo(nums) {
  // Promise.all para pedir los 6 detalles en paralelo.
  // El catálogo de movimientos ya está cargado en Combate.catalogoMovimientos.
  const detalles = await Promise.all(nums.map(n => CatalogAPI.ibermonById(n)));
  return detalles.map(d => Battle.buildUnit(d, Combate.catalogoMovimientos));
}


// ══════════════════════════════════════════════════════════════════════
// HELPERS DE UI (cambios de pantalla, diálogo, log, animaciones, etc.)
// ══════════════════════════════════════════════════════════════════════

/** Cambia la pantalla activa ocultando las demás. */
function mostrarPantalla(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('screen-active'));
  document.getElementById(id).classList.add('screen-active');
  // Scroll arriba para que no quede una pantalla anterior mostrándose a medias
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


/** Pone un mensaje grande en la caja de diálogo estilo GB. */
function setDialog(txt) {
  document.getElementById('battleDialog').textContent = txt;
}


/** Añade una línea al log del combate. Limita a las últimas 80 líneas. */
function addLog(msg) {
  const log = document.getElementById('battleLog');
  const line = document.createElement('div');
  line.className   = 'log-line';
  line.textContent = `[T${Combate.turno}] ${msg}`;
  log.appendChild(line);
  // Scroll automático al final
  log.scrollTop = log.scrollHeight;
  // Recorto si hay demasiado texto para que no se convierta en una biblia
  while (log.children.length > 80) log.removeChild(log.firstChild);
}


/** Pequeña sacudida del sprite al atacar. */
function sacudirSprite(cls) {
  const el = document.querySelector('.' + cls);
  if (!el) return;
  el.classList.remove('shake-sprite');
  void el.offsetWidth;  // reflow para relanzar animación
  el.classList.add('shake-sprite');
}


/** Flash rojo cuando recibe daño. */
function flashDanyo(cls) {
  const el = document.querySelector('.' + cls);
  if (!el) return;
  el.classList.remove('hit-flash');
  void el.offsetWidth;
  el.classList.add('hit-flash');
}


/** Número de daño flotante estilo juegos arcade. */
function mostrarDanyoFlotante(cls, danyo, critico) {
  const arena   = document.getElementById('arenaOverlay');
  const destino = document.querySelector('.' + cls);
  if (!arena || !destino) return;

  // Posición relativa al overlay
  const rect  = destino.getBoundingClientRect();
  const aRect = arena.getBoundingClientRect();
  const x = rect.left - aRect.left + rect.width / 2;
  const y = rect.top  - aRect.top  + rect.height / 3;

  const el = document.createElement('div');
  el.className = 'damage-float' + (critico ? ' crit' : '');
  el.textContent = '-' + danyo + (critico ? '!' : '');
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  arena.appendChild(el);

  // Lo elimino tras la animación para no ensuciar el DOM
  setTimeout(() => el.remove(), 900);
}


/** Habilita o deshabilita los botones de acción del combate. */
function bloquearBotones(bloquear) {
  document.querySelectorAll('#actionMoves button, #btnSwitch, #btnForfeit').forEach(b => {
    b.disabled = bloquear;
  });
}


/** Promesa que espera n milisegundos. Uso esto en vez de callbacks anidados. */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// ══════════════════════════════════════════════════════════════════════
// SERIALIZACIÓN (para pasar los equipos por el canal)
// Al enviar una unidad por BroadcastChannel hay que mandar SOLO datos
// serializables. Estos helpers aplanan/rehidratan el objeto.
// ══════════════════════════════════════════════════════════════════════

function aplanarUnidad(u) {
  // BroadcastChannel ya usa structured clone, así que en la práctica puedo
  // mandar el objeto tal cual. Pero hago una copia "limpia" para no mandar
  // referencias a cosas raras (funciones, elementos del DOM...).
  return JSON.parse(JSON.stringify(u));
}

function rehidratarUnidad(o) {
  // Ya es un objeto plano — no necesito reconstruir nada, pero dejo este
  // punto por si en el futuro hay que re-enlazar algo (por ejemplo, una
  // referencia al catálogo del rival).
  return o;
}


/** Genera un "snapshot" del estado del combate para mandar al GUEST. */
function snapshotEstado() {
  return {
    equipoA: Combate.equipoYo.map(u  => ({ hp: u.hp, fainted: u.fainted, moves: u.moves.map(m => ({ pp: m.pp })) })),
    equipoB: Combate.equipoFoe.map(u => ({ hp: u.hp, fainted: u.fainted, moves: u.moves.map(m => ({ pp: m.pp })) })),
    activoA: Combate.equipoYo.indexOf(Combate.activoYo),
    activoB: Combate.equipoFoe.indexOf(Combate.activoFoe),
  };
}


/**
 * Invierte el campo `lado` de un evento recibido del HOST.
 * El HOST etiqueta sus eventos con "A" = él y "B" = yo (GUEST).
 * Desde mi ventana, yo soy "A" y él es "B". Con este cambio, toda la
 * UI que mira ev.lado sigue funcionando sin saber si soy HOST o GUEST.
 *
 * También reemplazo las referencias a unidades (atacante, defensor,
 * sale, entra) por las unidades locales equivalentes, buscándolas por
 * "numero" (el id del Ibermon) en mis propios arrays. Sin esto, al
 * replayar, los sprites y nombres apuntarían a objetos del HOST y la
 * UI podría mostrar datos desincronizados.
 */
function invertirLadoEvento(ev) {
  const copia = { ...ev };
  if (copia.lado === 'A')      copia.lado = 'B';
  else if (copia.lado === 'B') copia.lado = 'A';

  // Tras invertir, "A" = mi equipo, "B" = equipo del rival.
  // Las unidades referenciadas las sustituyo por mis instancias locales.
  const miEquipo = copia.lado === 'A' ? Combate.equipoYo  : Combate.equipoFoe;
  const suEquipo = copia.lado === 'A' ? Combate.equipoFoe : Combate.equipoYo;

  if (copia.atacante) copia.atacante = buscarLocal(miEquipo, copia.atacante.numero) || copia.atacante;
  if (copia.defensor) copia.defensor = buscarLocal(suEquipo, copia.defensor.numero) || copia.defensor;
  if (copia.sale)     copia.sale     = buscarLocal(miEquipo, copia.sale.numero)     || copia.sale;
  if (copia.entra)    copia.entra    = buscarLocal(miEquipo, copia.entra.numero)    || copia.entra;
  if (copia.unidad)   copia.unidad   = buscarLocal(miEquipo, copia.unidad.numero)   || copia.unidad;

  return copia;
}

/** Busca una unidad por número en un array local. */
function buscarLocal(equipo, numero) {
  return equipo.find(u => u.numero === numero);
}


/** Aplica un snapshot recibido del HOST al estado local (yo soy GUEST). */
function aplicarSnapshot(s) {
  if (!s) return;
  // OJO: el HOST envía "A" = su equipo, "B" = equipo del rival.
  // Desde el punto de vista del GUEST, el orden está invertido.
  s.equipoB.forEach((data, i) => {
    const u = Combate.equipoYo[i];
    if (!u) return;
    u.hp      = data.hp;
    u.fainted = data.fainted;
    data.moves.forEach((mv, j) => { if (u.moves[j]) u.moves[j].pp = mv.pp; });
  });
  s.equipoA.forEach((data, i) => {
    const u = Combate.equipoFoe[i];
    if (!u) return;
    u.hp      = data.hp;
    u.fainted = data.fainted;
    data.moves.forEach((mv, j) => { if (u.moves[j]) u.moves[j].pp = mv.pp; });
  });
  // HOST guarda sus índices con las claves "A/B" donde "A" es el propio HOST.
  // Para mí (GUEST) eso se invierte: lo que él llama "B" soy yo, y viceversa.
  Combate.activoYo  = Combate.equipoYo[s.activoB ?? 0]  || Combate.equipoYo[0];
  Combate.activoFoe = Combate.equipoFoe[s.activoA ?? 0] || Combate.equipoFoe[0];
}


/** Genera el objeto estado que espera el motor Battle (claves A/B). */
function estadoBattle() {
  return {
    equipoA: Combate.equipoYo,
    equipoB: Combate.equipoFoe,
    activoA: Combate.activoYo,
    activoB: Combate.activoFoe,
  };
}


// ══════════════════════════════════════════════════════════════════════
// ERRORES FATALES — muestra un mensaje grande si algo falla al cargar.
// ══════════════════════════════════════════════════════════════════════

function mostrarErrorFatal(msg) {
  const cont = document.querySelector('#screen-select');
  if (!cont) return;
  cont.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⚠️</div>
      <p>${msg}</p>
      <p class="text-muted" style="font-size:.85rem">
        Comprueba que la API esté corriendo en <code>${CONFIG.API_BASE}</code>.
      </p>
    </div>`;
}
