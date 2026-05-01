// Pagina de combate: conecta UI, motor (Battle) y matchmaking

const Combate = {
  // Datos del catalogo
  catalogoIbermon:    [],
  catalogoMovimientos:[],

  // Seleccion del jugador
  seleccionNumeros:   [],

  // Equipos en combate
  equipoYo:           [],
  equipoFoe:          [],

  // Estado
  activoYo:           null,
  activoFoe:          null,
  turno:              0,
  modoBot:            false,
  esperandoAccion:    false,
  accionPendiente:    null,
  accionRival:        null,
  combateTerminado:   false,
};


// Arranque

document.addEventListener('DOMContentLoaded', async () => {
  const usuario = Auth.getUser?.();
  const nombre  = usuario?.username || 'Entrenador';

  Matchmaking.init(nombre);

  // Cargo el catalogo en paralelo. Sin catalogo no hay combate
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

  // Pantalla 1
  document.getElementById('btnTeamRandom').addEventListener('click', seleccionAleatoria);
  document.getElementById('btnTeamReady').addEventListener('click',  comenzarBusqueda);

  document.getElementById('combatSearch').addEventListener('input', e => {
    renderPickerGrid(e.target.value.trim().toLowerCase());
  });

  // Pantalla 2 (cola)
  document.getElementById('btnFightBot').addEventListener('click', lanzarContraBot);
  document.getElementById('btnQueueCancel').addEventListener('click', cancelarBusqueda);

  // Pantalla 3 (combate)
  document.getElementById('btnSwitch').addEventListener('click',  abrirModalCambio);
  document.getElementById('btnForfeit').addEventListener('click', rendirse);
  document.getElementById('switchCancel').addEventListener('click', cerrarModalCambio);

  // Pantalla 4 (resultado)
  document.getElementById('btnRematch').addEventListener('click', () => location.reload());

  registrarListenersMatchmaking();

  // Aviso al rival si cierro la pestanya
  window.addEventListener('beforeunload', () => {
    try { Matchmaking.rendirse(); } catch (_) {}
    Matchmaking.cerrar();
  });
});


// Pantalla 1: seleccion de equipo

function renderPickerGrid(filtro = '') {
  const cont = document.getElementById('ibermonPickerGrid');
  const q = filtro.toLowerCase();

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

  cont.querySelectorAll('[data-num]').forEach(c => {
    c.addEventListener('click', () => togglePicker(parseInt(c.dataset.num)));
  });
}


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


// Anyade/quita un Ibermon (max 6)
function togglePicker(numero) {
  const idx = Combate.seleccionNumeros.indexOf(numero);
  if (idx >= 0) {
    Combate.seleccionNumeros.splice(idx, 1);
  } else {
    if (Combate.seleccionNumeros.length >= 6) {
      // Aviso visual con shake en vez de un alert feo
      parpadearSlots();
      return;
    }
    Combate.seleccionNumeros.push(numero);
  }
  actualizarSlotsEquipo();
  renderPickerGrid(document.getElementById('combatSearch').value.trim().toLowerCase());
}


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

  btn.disabled = Combate.seleccionNumeros.length !== 6;
}


// 6 al azar sin repetir
function seleccionAleatoria() {
  const copia = [...Combate.catalogoIbermon];
  Combate.seleccionNumeros = [];
  for (let i = 0; i < 6 && copia.length > 0; i++) {
    const idx = Math.floor(Math.random() * copia.length);
    Combate.seleccionNumeros.push(copia[idx].numero);
    copia.splice(idx, 1);
  }
  actualizarSlotsEquipo();
  renderPickerGrid(document.getElementById('combatSearch').value.trim().toLowerCase());
}


function parpadearSlots() {
  const slots = document.getElementById('teamSlots');
  slots.classList.remove('shake');
  // Force reflow para relanzar la animacion
  void slots.offsetWidth;
  slots.classList.add('shake');
}


// Pantalla 2: cola de matchmaking

let _queueTimerId   = null;
let _queueToken     = null;
let _queueSegundos  = 0;


async function comenzarBusqueda() {
  // Construyo el equipo ya, asi al emparejar solo lo envio
  try {
    Combate.equipoYo = await construirEquipoDesdeCatalogo(Combate.seleccionNumeros);
  } catch (e) {
    alert('Error al preparar el equipo: ' + e.message);
    return;
  }

  mostrarPantalla('screen-queue');
  Combate.modoBot = false;

  // Timer estetico
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


function cancelarBusqueda() {
  if (_queueToken) _queueToken.cancelar();
  if (_queueTimerId) clearInterval(_queueTimerId);
  _queueToken = null;
  _queueTimerId = null;
  mostrarPantalla('screen-select');
}


// Modo CPU
async function lanzarContraBot() {
  if (_queueToken) _queueToken.cancelar();
  if (_queueTimerId) clearInterval(_queueTimerId);

  Combate.modoBot = true;

  // El bot tiene un equipo aleatorio distinto al mio
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

  // En modo bot yo soy siempre el HOST
  arrancarCombate('CPU', true);
}


// Listeners del matchmaking

function registrarListenersMatchmaking() {

  Matchmaking.on('buscandoEstado', (txt) => {
    const el = document.getElementById('queueStatus');
    if (el) el.textContent = txt;
  });


  Matchmaking.on('emparejado', async (peer) => {
    if (_queueTimerId) clearInterval(_queueTimerId);

    // Envio mi equipo aplanado (sin funciones, solo datos)
    const planos = Combate.equipoYo.map(aplanarUnidad);
    Matchmaking.enviarEquipo(planos);

    Combate._nombreRival = peer.nombre;
  });


  Matchmaking.on('equipoRecibido', (equipoPlano) => {
    // Reconstruyo a partir de los datos recibidos
    Combate.equipoFoe = equipoPlano.map(rehidratarUnidad);

    if (Combate.equipoYo.length && Combate.equipoFoe.length) {
      arrancarCombate(Combate._nombreRival || 'Rival', Matchmaking.soyHost());
    }
  });


  Matchmaking.on('accionRecibida', (accion) => {
    Combate.accionRival = accion;
    resolverTurnoSiProcede();
  });


  // Soy GUEST: el HOST me manda los eventos resueltos
  Matchmaking.on('resultadoRecibido', ({ eventos, estado }) => {
    aplicarSnapshot(estado);
    // Invierto el lado para que "A" siga siendo MI equipo en mi pantalla
    const invertidos = eventos.map(invertirLadoEvento);
    reproducirEventos(invertidos);
  });


  Matchmaking.on('rivalSeFue', ({ motivo }) => {
    if (Combate.combateTerminado) return;
    Combate.combateTerminado = true;
    const msg = motivo === 'rendicion'
      ? 'Tu rival se ha rendido.'
      : 'Tu rival se ha desconectado.';
    mostrarResultado(true, msg);
  });
}


// Pantalla 3: combate

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


function pintarActivos() {
  const y = Combate.activoYo;
  const f = Combate.activoFoe;

  document.getElementById('youName').textContent    = y.nombre;
  document.getElementById('youLvl').textContent     = `Nv.${y.nivel}`;
  document.getElementById('youSprite').src          = y.sprite;
  document.getElementById('youTypes').innerHTML     = y.tipos.map(tipoBadge).join('');
  document.getElementById('youHpNum').textContent   = `${y.hp}/${y.hpMax}`;
  pintarHP('youHp', y.hp, y.hpMax);

  document.getElementById('foeName').textContent    = f.nombre;
  document.getElementById('foeLvl').textContent     = `Nv.${f.nivel}`;
  document.getElementById('foeSprite').src          = f.sprite;
  document.getElementById('foeTypes').innerHTML     = f.tipos.map(tipoBadge).join('');
  pintarHP('foeHp', f.hp, f.hpMax);
}


// Color por % de PS: verde >50, amarillo 20-50, rojo <20
function pintarHP(id, actual, max) {
  const pct = Math.max(0, (actual / max) * 100);
  const el  = document.getElementById(id);
  el.style.width = pct + '%';

  el.classList.remove('hp-green', 'hp-yellow', 'hp-red');
  if      (pct > 50) el.classList.add('hp-green');
  else if (pct > 20) el.classList.add('hp-yellow');
  else                el.classList.add('hp-red');
}


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


function elegirMovimiento(idx) {
  if (Combate.esperandoAccion || Combate.combateTerminado) return;

  // Bloqueo para que no pulsen dos veces
  Combate.esperandoAccion = true;
  Combate.accionPendiente = { tipo: 'mov', indice: idx };
  setDialog(`${Combate.activoYo.nombre} usa ${Combate.activoYo.moves[idx].nombre}...`);
  bloquearBotones(true);

  if (Combate.modoBot) {
    Combate.accionRival = Battle.decidirAccionBot(estadoBattle(), 'B');
    resolverTurnoSiProcede();
    return;
  }

  Matchmaking.enviarAccion(Combate.accionPendiente);
  resolverTurnoSiProcede();
}


// Si tengo mi accion y la del rival, resuelvo (solo HOST/CPU)
function resolverTurnoSiProcede() {
  if (!Combate.accionPendiente || !Combate.accionRival) return;

  // GUEST espera el resultado del HOST (la autoridad)
  if (!Combate._soyHost && !Combate.modoBot) {
    return;
  }

  // HOST o modo bot: resuelvo con el motor
  const estado = estadoBattle();
  const eventos = Battle.resolverTurno(estado, Combate.accionPendiente, Combate.accionRival);

  // En multijugador mando el resultado antes de reproducir, asi el rival empieza casi a la vez
  if (!Combate.modoBot) {
    Matchmaking.enviarResultado(eventos, snapshotEstado());
  }

  reproducirEventos(eventos);
}


// Reproduce los eventos del turno con delays para que parezca un combate
async function reproducirEventos(eventos) {
  for (const ev of eventos) {
    await reproducirEvento(ev);
  }

  // Fin del combate?
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

  // Relevo forzado si cae el activo
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


async function reproducirEvento(ev) {
  switch (ev.tipo) {

    case 'cambio': {
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
      const cajaDef = ev.lado === 'A' ? 'foe-sprite' : 'you-sprite';
      flashDanyo(cajaDef);
      mostrarDanyoFlotante(cajaDef, ev.danyo, ev.critico);

      if (ev.lado === 'A') {
        Combate.activoFoe.hp = ev.hpRestante;
        pintarHP('foeHp', ev.hpRestante, ev.hpMax);
      } else {
        Combate.activoYo.hp = ev.hpRestante;
        pintarHP('youHp', ev.hpRestante, ev.hpMax);
        document.getElementById('youHpNum').textContent = `${ev.hpRestante}/${ev.hpMax}`;
      }

      // Texto de efectividad
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
      const cls = ev.lado === 'A' ? 'you-sprite' : 'foe-sprite';
      document.querySelector('.' + cls).classList.add('fainted');
      await delay(1100);
      document.querySelector('.' + cls).classList.remove('fainted');
      break;
    }
  }
}


// Relevo forzado

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


// Cambio voluntario

function abrirModalCambio(forzado = false, callback = null) {
  const lista = document.getElementById('switchList');
  const modal = document.getElementById('switchModal');
  const cerrarBtn = document.getElementById('switchCancel');

  // Si es forzado, no se puede cancelar
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

  lista.querySelectorAll('.switch-item:not(.disabled)').forEach(it => {
    it.addEventListener('click', () => {
      const slot = parseInt(it.dataset.slot);
      modal.classList.remove('open');

      if (callback) {
        callback(slot);
      } else {
        // Cambio voluntario: cuenta como accion del turno
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


function rendirse() {
  if (Combate.combateTerminado) return;
  if (!confirm('¿Seguro que quieres rendirte? Perderás el combate.')) return;

  Combate.combateTerminado = true;
  if (!Combate.modoBot) Matchmaking.rendirse();
  mostrarResultado(false, 'Te has rendido.');
}


// Pantalla 4: resultado

function mostrarResultado(ganado, texto) {
  document.getElementById('resultIcon').textContent  = ganado ? '🏆' : '💀';
  document.getElementById('resultTitle').textContent = ganado ? '¡Victoria!' : 'Derrota';
  document.getElementById('resultText').textContent  = texto;
  mostrarPantalla('screen-result');
}


// Construccion de equipos

async function construirEquipoDesdeCatalogo(nums) {
  // Promise.all para pedir los 6 detalles en paralelo
  const detalles = await Promise.all(nums.map(n => CatalogAPI.ibermonById(n)));
  return detalles.map(d => Battle.buildUnit(d, Combate.catalogoMovimientos));
}


// Helpers de UI

function mostrarPantalla(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('screen-active'));
  document.getElementById(id).classList.add('screen-active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


function setDialog(txt) {
  document.getElementById('battleDialog').textContent = txt;
}


function addLog(msg) {
  const log = document.getElementById('battleLog');
  const line = document.createElement('div');
  line.className   = 'log-line';
  line.textContent = `[T${Combate.turno}] ${msg}`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
  // Limito a 80 lineas para no llenarlo de texto
  while (log.children.length > 80) log.removeChild(log.firstChild);
}


function sacudirSprite(cls) {
  const el = document.querySelector('.' + cls);
  if (!el) return;
  el.classList.remove('shake-sprite');
  void el.offsetWidth;
  el.classList.add('shake-sprite');
}


function flashDanyo(cls) {
  const el = document.querySelector('.' + cls);
  if (!el) return;
  el.classList.remove('hit-flash');
  void el.offsetWidth;
  el.classList.add('hit-flash');
}


// Numero de danyo flotante encima del defensor
function mostrarDanyoFlotante(cls, danyo, critico) {
  const arena   = document.getElementById('arenaOverlay');
  const destino = document.querySelector('.' + cls);
  if (!arena || !destino) return;

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

  setTimeout(() => el.remove(), 900);
}


function bloquearBotones(bloquear) {
  document.querySelectorAll('#actionMoves button, #btnSwitch, #btnForfeit').forEach(b => {
    b.disabled = bloquear;
  });
}


function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// Serializacion para mandar los equipos por el canal

function aplanarUnidad(u) {
  // Copia limpia para no mandar referencias raras
  return JSON.parse(JSON.stringify(u));
}

function rehidratarUnidad(o) {
  return o;
}


// Snapshot del estado para que el GUEST se sincronice
function snapshotEstado() {
  return {
    equipoA: Combate.equipoYo.map(u  => ({ hp: u.hp, fainted: u.fainted, moves: u.moves.map(m => ({ pp: m.pp })) })),
    equipoB: Combate.equipoFoe.map(u => ({ hp: u.hp, fainted: u.fainted, moves: u.moves.map(m => ({ pp: m.pp })) })),
    activoA: Combate.equipoYo.indexOf(Combate.activoYo),
    activoB: Combate.equipoFoe.indexOf(Combate.activoFoe),
  };
}


// El HOST etiqueta sus eventos con A=el / B=yo. Los invierto y enlazo a mis instancias locales
function invertirLadoEvento(ev) {
  const copia = { ...ev };
  if (copia.lado === 'A')      copia.lado = 'B';
  else if (copia.lado === 'B') copia.lado = 'A';

  const miEquipo = copia.lado === 'A' ? Combate.equipoYo  : Combate.equipoFoe;
  const suEquipo = copia.lado === 'A' ? Combate.equipoFoe : Combate.equipoYo;

  if (copia.atacante) copia.atacante = buscarLocal(miEquipo, copia.atacante.numero) || copia.atacante;
  if (copia.defensor) copia.defensor = buscarLocal(suEquipo, copia.defensor.numero) || copia.defensor;
  if (copia.sale)     copia.sale     = buscarLocal(miEquipo, copia.sale.numero)     || copia.sale;
  if (copia.entra)    copia.entra    = buscarLocal(miEquipo, copia.entra.numero)    || copia.entra;
  if (copia.unidad)   copia.unidad   = buscarLocal(miEquipo, copia.unidad.numero)   || copia.unidad;

  return copia;
}

function buscarLocal(equipo, numero) {
  return equipo.find(u => u.numero === numero);
}


// Aplica el snapshot del HOST al estado local (yo soy GUEST)
function aplicarSnapshot(s) {
  if (!s) return;
  // Para el HOST: A=su equipo, B=el mio. Para mi (GUEST) esta invertido
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
  Combate.activoYo  = Combate.equipoYo[s.activoB ?? 0]  || Combate.equipoYo[0];
  Combate.activoFoe = Combate.equipoFoe[s.activoA ?? 0] || Combate.equipoFoe[0];
}


// Estado en formato A/B para el motor
function estadoBattle() {
  return {
    equipoA: Combate.equipoYo,
    equipoB: Combate.equipoFoe,
    activoA: Combate.activoYo,
    activoB: Combate.activoFoe,
  };
}


// Error fatal al cargar (sin catalogo no hay nada que hacer)
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
