// Emparejamiento entre pestanyas via BroadcastChannel (sin tocar la API)

const Matchmaking = {

  CHANNEL: 'ibermon-matchmaking',


  // Estado interno
  _canal:      null,
  _miId:       null,
  _miNombre:   'Rival',
  _peerId:     null,
  _esHost:     false,
  _handlers:   {},
  _pingTimer:  null,


  // Crea el canal y enlaza el listener (llamar una vez al cargar)
  init(nombre) {
    if (Matchmaking._canal) return;

    Matchmaking._miId    = 'p_' + Math.random().toString(36).slice(2, 10);
    Matchmaking._miNombre = nombre || 'Rival';

    try {
      Matchmaking._canal = new BroadcastChannel(Matchmaking.CHANNEL);
      Matchmaking._canal.addEventListener('message', Matchmaking._alRecibir);
    } catch (e) {
      console.warn('BroadcastChannel no disponible:', e.message);
    }
  },


  // Registra un handler de evento (emparejado, equipoRecibido, accionRecibida, resultadoRecibido, rivalSeFue)
  on(evento, fn) {
    Matchmaking._handlers[evento] = fn;
  },


  // Anuncia presencia cada 2s hasta que alguien me empareje
  buscar() {
    if (!Matchmaking._canal) {
      Matchmaking._emitir('buscandoEstado', 'Modo multijugador no disponible');
      return { cancelar: () => {} };
    }

    Matchmaking._emitir('buscandoEstado', 'Anunciando presencia...');
    Matchmaking._peerId = null;
    Matchmaking._esHost = false;

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

    Matchmaking._buscarTimer = tId;

    return {
      cancelar: () => {
        clearInterval(tId);
        Matchmaking._buscarTimer = null;
        Matchmaking._publicar({ tipo: 'cancelar', de: Matchmaking._miId });
      },
    };
  },


  enviarEquipo(equipoPlano) {
    Matchmaking._publicar({
      tipo:   'equipo',
      de:     Matchmaking._miId,
      para:   Matchmaking._peerId,
      equipo: equipoPlano,
    });
  },


  enviarAccion(accion) {
    Matchmaking._publicar({
      tipo:   'accion',
      de:     Matchmaking._miId,
      para:   Matchmaking._peerId,
      accion,
    });
  },


  // El HOST manda los eventos resueltos al GUEST
  enviarResultado(eventos, estadoNuevo) {
    Matchmaking._publicar({
      tipo:     'resultado',
      de:       Matchmaking._miId,
      para:     Matchmaking._peerId,
      eventos,
      estado:   estadoNuevo,
    });
  },


  rendirse() {
    Matchmaking._publicar({ tipo: 'rendicion', de: Matchmaking._miId, para: Matchmaking._peerId });
  },


  cerrar() {
    if (Matchmaking._buscarTimer) clearInterval(Matchmaking._buscarTimer);
    if (Matchmaking._pingTimer)   clearInterval(Matchmaking._pingTimer);
    Matchmaking._peerId = null;
    if (Matchmaking._canal) {
      try { Matchmaking._canal.close(); } catch (_) {}
      Matchmaking._canal = null;
    }
  },


  soyHost() { return Matchmaking._esHost; },


  // Implementacion interna

  _publicar(msg) {
    if (!Matchmaking._canal) return;
    Matchmaking._canal.postMessage(msg);
  },


  _emitir(evento, datos) {
    const fn = Matchmaking._handlers[evento];
    if (typeof fn === 'function') fn(datos);
  },


  _alRecibir(ev) {
    const m = ev.data || {};

    // Ignoro mis propios mensajes
    if (m.de === Matchmaking._miId) return;

    if (m.para && m.para !== Matchmaking._miId) return;

    switch (m.tipo) {

      case 'presencia':
        // El id alfabeticamente menor hace de HOST (evita doble emparejamiento)
        if (Matchmaking._buscarTimer && !Matchmaking._peerId) {
          const soyMenor = Matchmaking._miId < m.de;
          Matchmaking._peerId = m.de;
          Matchmaking._esHost = soyMenor;

          clearInterval(Matchmaking._buscarTimer);
          Matchmaking._buscarTimer = null;

          Matchmaking._publicar({
            tipo:   'emparejar',
            de:     Matchmaking._miId,
            para:   Matchmaking._peerId,
            nombre: Matchmaking._miNombre,
            host:   !soyMenor,
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


      case 'equipo':
        if (m.de === Matchmaking._peerId) {
          Matchmaking._emitir('equipoRecibido', m.equipo);
        }
        break;


      case 'accion':
        if (m.de === Matchmaking._peerId) {
          Matchmaking._emitir('accionRecibida', m.accion);
        }
        break;


      case 'resultado':
        if (m.de === Matchmaking._peerId) {
          Matchmaking._emitir('resultadoRecibido', { eventos: m.eventos, estado: m.estado });
        }
        break;


      case 'rendicion':
        if (m.de === Matchmaking._peerId) {
          Matchmaking._emitir('rivalSeFue', { motivo: 'rendicion' });
        }
        break;


      case 'cancelar':
        break;


      case 'ping':
        if (m.de === Matchmaking._peerId) {
          Matchmaking._ultimoPing = Date.now();
        }
        break;
    }
  },


  // Ping cada 3s; si no recibo en 8s, supongo que se fue
  _iniciarHeartbeat() {
    Matchmaking._ultimoPing = Date.now();

    Matchmaking._pingTimer = setInterval(() => {
      Matchmaking._publicar({ tipo: 'ping', de: Matchmaking._miId, para: Matchmaking._peerId });

      if (Date.now() - Matchmaking._ultimoPing > 8000) {
        clearInterval(Matchmaking._pingTimer);
        Matchmaking._pingTimer = null;
        Matchmaking._emitir('rivalSeFue', { motivo: 'desconexion' });
      }
    }, 3000);
  },

};
