/**
 * scripts/modules/matchmaking.js — Emparejamiento de combates entre pestañas
 *
 * Como la API actual no tiene endpoints para matchmaking (y no quiero
 * tocarla para que siga siendo la que usa el juego de Unity), el
 * emparejamiento lo hago 100% en el frontend usando BroadcastChannel.
 *
 * BroadcastChannel es un API del navegador que permite que distintas
 * PESTAÑAS (o ventanas) del mismo origen se pasen mensajes entre sí.
 * Lo descubrí mirando cómo hacía Showdown el modo local y me pareció
 * la solución más limpia sin tener que montar un WebSocket aparte.
 *
 * Limitación obvia: solo funciona entre pestañas del MISMO equipo.
 * Para jugar con alguien de otra máquina hace falta un servidor de
 * señalización, y eso sí pediría tocar la API. Como fallback, si no
 * aparece nadie en unos segundos se puede jugar contra la CPU, así
 * la web siempre es usable aunque estés solo.
 *
 * Mensajes del protocolo:
 *   - presencia:    alguien anuncia que está buscando partida
 *   - emparejar:    un peer propone a otro jugar
 *   - aceptado:     el otro acepta la propuesta
 *   - equipo:       se intercambian los datos de los equipos
 *   - accion:       cada jugador envía su acción del turno
 *   - resultado:    el HOST envía los eventos resueltos
 *   - rendicion:    alguien se rinde
 *   - ping:         heartbeat para saber si el otro sigue ahí
 */


const Matchmaking = {

  // Nombre del canal. Tiene que ser el mismo en ambas pestañas para que
  // los mensajes viajen. Si lo cambio solo en un sitio, nadie escucha.
  CHANNEL: 'ibermon-matchmaking',


  // ══════ ESTADO INTERNO ══════
  // Lo mantengo encapsulado. Desde fuera solo se usan las funciones
  // públicas (buscar, cancelar, enviarAccion, etc).

  _canal:      null,       // instancia de BroadcastChannel
  _miId:       null,       // id único aleatorio de esta pestaña
  _miNombre:   'Rival',    // username si está logueado, "Rival" si no
  _peerId:     null,       // id del rival cuando ya estamos emparejados
  _esHost:     false,      // si actúo como HOST (autoridad) en el combate
  _handlers:   {},         // callbacks que registra la página (on('evento', fn))
  _pingTimer:  null,       // intervalo de heartbeat


  // ══════ API PÚBLICA ══════

  /**
   * Inicializa el canal y registra los callbacks de la página.
   * Hay que llamarlo UNA vez al cargar la página, antes de buscar.
   */
  init(nombre) {
    // Si ya estaba iniciado, no hago nada (evita duplicar listeners
    // si el usuario navega y vuelve a la página).
    if (Matchmaking._canal) return;

    // Id único y corto — vale para distinguir entre pestañas
    Matchmaking._miId    = 'p_' + Math.random().toString(36).slice(2, 10);
    Matchmaking._miNombre = nombre || 'Rival';

    try {
      Matchmaking._canal = new BroadcastChannel(Matchmaking.CHANNEL);
      Matchmaking._canal.addEventListener('message', Matchmaking._alRecibir);
    } catch (e) {
      // Navegadores muy antiguos no tienen BroadcastChannel.
      // Aviso por consola — la página seguirá funcionando contra el bot.
      console.warn('BroadcastChannel no disponible:', e.message);
    }
  },


  /**
   * Registra un handler para un tipo de evento.
   * Ejemplo:
   *   Matchmaking.on('emparejado', (peer) => { ... });
   *
   * Eventos disponibles (los que la UI debe escuchar):
   *   - buscandoEstado(texto)    → actualización del estado de cola
   *   - emparejado(peer)         → hemos encontrado rival
   *   - equipoRecibido(equipo)   → el rival nos manda su equipo
   *   - accionRecibida(accion)   → el rival nos manda su acción del turno
   *   - resultadoRecibido(evts)  → (guest) HOST envía eventos resueltos
   *   - rivalSeFue()             → el rival ha cerrado pestaña / rendido
   */
  on(evento, fn) {
    Matchmaking._handlers[evento] = fn;
  },


  /**
   * Entra a la cola: anuncia a todas las pestañas que este jugador
   * está buscando partida. Si otra pestaña también está buscando,
   * se empareja automáticamente.
   *
   * Devuelve un objeto con { cancelar() } para poder abortar.
   */
  buscar() {
    if (!Matchmaking._canal) {
      // Sin canal no hay emparejamiento posible. Aviso a la UI.
      Matchmaking._emitir('buscandoEstado', 'Modo multijugador no disponible');
      return { cancelar: () => {} };
    }

    Matchmaking._emitir('buscandoEstado', 'Anunciando presencia...');
    Matchmaking._peerId = null;
    Matchmaking._esHost = false;

    // Anuncio mi presencia cada 2 segundos hasta que alguien me empareje.
    // Así los que entren después de mí también me ven.
    const enviar = () => {
      Matchmaking._publicar({
        tipo:   'presencia',
        de:     Matchmaking._miId,
        nombre: Matchmaking._miNombre,
        ts:     Date.now(),
      });
    };

    enviar();
    const tId = setInterval(enviar, 2000);

    // Guardo el intervalo para poder pararlo al cancelar / al emparejar
    Matchmaking._buscarTimer = tId;

    return {
      cancelar: () => {
        clearInterval(tId);
        Matchmaking._buscarTimer = null;
        Matchmaking._publicar({ tipo: 'cancelar', de: Matchmaking._miId });
      },
    };
  },


  /** Envía el equipo ya construido al rival. */
  enviarEquipo(equipoPlano) {
    Matchmaking._publicar({
      tipo:   'equipo',
      de:     Matchmaking._miId,
      para:   Matchmaking._peerId,
      equipo: equipoPlano,
    });
  },


  /** Envía la acción elegida este turno (por el jugador humano local). */
  enviarAccion(accion) {
    Matchmaking._publicar({
      tipo:   'accion',
      de:     Matchmaking._miId,
      para:   Matchmaking._peerId,
      accion,
    });
  },


  /**
   * El HOST manda al GUEST la lista de eventos resueltos del turno.
   * El GUEST los reproduce igual que el HOST, así ambos ven lo mismo.
   */
  enviarResultado(eventos, estadoNuevo) {
    Matchmaking._publicar({
      tipo:     'resultado',
      de:       Matchmaking._miId,
      para:     Matchmaking._peerId,
      eventos,
      estado:   estadoNuevo,   // snapshot mínimo (PS actuales, activos...)
    });
  },


  /** Anuncia rendición. */
  rendirse() {
    Matchmaking._publicar({ tipo: 'rendicion', de: Matchmaking._miId, para: Matchmaking._peerId });
  },


  /** Cierra el canal y limpia. Se llama al salir de la página. */
  cerrar() {
    if (Matchmaking._buscarTimer) clearInterval(Matchmaking._buscarTimer);
    if (Matchmaking._pingTimer)   clearInterval(Matchmaking._pingTimer);
    Matchmaking._peerId = null;
    if (Matchmaking._canal) {
      try { Matchmaking._canal.close(); } catch (_) {}
      Matchmaking._canal = null;
    }
  },


  /** Devuelve true si este jugador es el HOST (autoridad del combate). */
  soyHost() { return Matchmaking._esHost; },


  // ══════ IMPLEMENTACIÓN INTERNA ══════

  /** Envía un mensaje por el canal (añade un "de" por seguridad). */
  _publicar(msg) {
    if (!Matchmaking._canal) return;
    Matchmaking._canal.postMessage(msg);
  },


  /** Dispara un handler si la página lo ha registrado. */
  _emitir(evento, datos) {
    const fn = Matchmaking._handlers[evento];
    if (typeof fn === 'function') fn(datos);
  },


  /**
   * Manejador de mensajes entrantes. La lógica de emparejamiento
   * vive casi entera aquí dentro, con un switch por tipo.
   */
  _alRecibir(ev) {
    const m = ev.data || {};

    // Ignoro mis propios mensajes — BroadcastChannel NO los reenvía al
    // emisor en la mayoría de navegadores, pero por si acaso.
    if (m.de === Matchmaking._miId) return;

    // Si el mensaje va dirigido a alguien concreto que no soy yo, lo ignoro.
    if (m.para && m.para !== Matchmaking._miId) return;

    switch (m.tipo) {

      // --- Alguien está buscando partida ---
      case 'presencia':
        // Si yo también estoy buscando y aún no estoy emparejado,
        // le propongo emparejar. Para que no se dupliquen los emparejados
        // uso el id alfabéticamente: el id "menor" hace de HOST.
        if (Matchmaking._buscarTimer && !Matchmaking._peerId) {
          const soyMenor = Matchmaking._miId < m.de;
          Matchmaking._peerId = m.de;
          Matchmaking._esHost = soyMenor;

          // Dejo de anunciarme ya que tengo rival
          clearInterval(Matchmaking._buscarTimer);
          Matchmaking._buscarTimer = null;

          // Le confirmo que somos pareja
          Matchmaking._publicar({
            tipo:   'emparejar',
            de:     Matchmaking._miId,
            para:   Matchmaking._peerId,
            nombre: Matchmaking._miNombre,
            host:   !soyMenor,   // él es host si yo NO lo soy
          });

          Matchmaking._emitir('buscandoEstado', 'Rival encontrado, sincronizando...');
          Matchmaking._emitir('emparejado', {
            id:     Matchmaking._peerId,
            nombre: m.nombre || 'Rival',
            soyHost: soyMenor,
          });

          Matchmaking._iniciarHeartbeat();
        }
        break;


      // --- El otro confirma el emparejamiento ---
      case 'emparejar':
        if (!Matchmaking._peerId) {
          Matchmaking._peerId = m.de;
          Matchmaking._esHost = !!m.host;

          if (Matchmaking._buscarTimer) {
            clearInterval(Matchmaking._buscarTimer);
            Matchmaking._buscarTimer = null;
          }

          Matchmaking._emitir('buscandoEstado', 'Rival encontrado, sincronizando...');
          Matchmaking._emitir('emparejado', {
            id:     Matchmaking._peerId,
            nombre: m.nombre || 'Rival',
            soyHost: Matchmaking._esHost,
          });

          Matchmaking._iniciarHeartbeat();
        }
        break;


      // --- Equipo del rival ---
      case 'equipo':
        if (m.de === Matchmaking._peerId) {
          Matchmaking._emitir('equipoRecibido', m.equipo);
        }
        break;


      // --- Acción del rival en este turno ---
      case 'accion':
        if (m.de === Matchmaking._peerId) {
          Matchmaking._emitir('accionRecibida', m.accion);
        }
        break;


      // --- Resultado del turno enviado por el HOST ---
      case 'resultado':
        if (m.de === Matchmaking._peerId) {
          Matchmaking._emitir('resultadoRecibido', { eventos: m.eventos, estado: m.estado });
        }
        break;


      // --- El rival se rinde ---
      case 'rendicion':
        if (m.de === Matchmaking._peerId) {
          Matchmaking._emitir('rivalSeFue', { motivo: 'rendicion' });
        }
        break;


      // --- Cancelación de cola (antes de emparejar) ---
      case 'cancelar':
        // No hago nada especial — solo era alguien que dejó de buscar.
        break;


      // --- Heartbeat. Si dejo de recibirlos, supongo que cerró la pestaña. ---
      case 'ping':
        if (m.de === Matchmaking._peerId) {
          Matchmaking._ultimoPing = Date.now();
        }
        break;
    }
  },


  /**
   * Lanza un ping periódico al rival para detectar si cierra la pestaña.
   * Si llevamos más de 8 segundos sin recibir ninguno, se considera que
   * se ha ido y aviso a la UI para que termine el combate.
   */
  _iniciarHeartbeat() {
    Matchmaking._ultimoPing = Date.now();

    Matchmaking._pingTimer = setInterval(() => {
      // Mando el mío
      Matchmaking._publicar({ tipo: 'ping', de: Matchmaking._miId, para: Matchmaking._peerId });

      // Compruebo los suyos
      if (Date.now() - Matchmaking._ultimoPing > 8000) {
        clearInterval(Matchmaking._pingTimer);
        Matchmaking._pingTimer = null;
        Matchmaking._emitir('rivalSeFue', { motivo: 'desconexion' });
      }
    }, 3000);
  },

};
