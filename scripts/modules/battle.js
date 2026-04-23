/**
 * scripts/modules/battle.js — Motor de combate (reglas del juego)
 *
 * Este archivo es el "cerebro" del combate. NO sabe nada sobre la UI
 * ni sobre si el rival es humano o CPU. Solo calcula daño, resuelve
 * un turno y mantiene el estado de los dos equipos.
 *
 * Lo dejo independiente para poder usar el mismo motor tanto en el
 * modo contra bot como en el modo multijugador. Si en el futuro
 * quiero moverlo a Node para hacer tests, solo tendría que exportar
 * estas funciones.
 *
 * Es una versión muy simplificada de la fórmula original de Pokémon:
 * no uso efectos de estado complicados ni habilidades, porque con
 * los datos que tengo en el catálogo no me dan para tanto y el TFG
 * tiene una fecha de entrega...
 */


// ══════ CONSTRUCCIÓN DE EQUIPOS ══════
// Convierto los datos que vienen de la API en "unidades de combate"
// con PS actuales, nivel, movimientos listos para usar, etc.

const Battle = {

  /**
   * Nivel por defecto de los Ibermon en combate.
   * Lo fijo para que todas las partidas sean justas — si cada uno
   * subiera sus Ibermon por su cuenta sería un caos y no se podría
   * balancear.
   */
  NIVEL_FIJO: 50,


  /**
   * Construye una "unidad de combate" a partir del detalle de un Ibermon
   * (lo que devuelve /catalogo/ibermon/{id}) y la lista completa de
   * movimientos (lo que devuelve /catalogo/movimientos).
   *
   * Para elegir los 4 movimientos miro los que el Ibermon PUEDE aprender
   * (movimientos_posibles) y les doy prioridad a los que aprende al nivel
   * más alto — normalmente son los más fuertes.
   */
  buildUnit(detalle, todosMovs) {
    const nivel = Battle.NIVEL_FIJO;

    // Calculo las stats reales a partir de las base y el nivel.
    // Uso una fórmula inspirada en Pokémon pero sin IVs/EVs (demasiado lío).
    const stats = {
      hp:        Battle._calcHP(detalle.hp_base, nivel),
      atk:       Battle._calcStat(detalle.ataque_base, nivel),
      def:       Battle._calcStat(detalle.defensa_base, nivel),
      spAtk:     Battle._calcStat(detalle.ataque_especial_base, nivel),
      spDef:     Battle._calcStat(detalle.defensa_especial_base, nivel),
      spd:       Battle._calcStat(detalle.velocidad_base, nivel),
    };

    // Elijo 4 movimientos: los de mayor nivel (≤ nivel actual).
    // Si el Ibermon no tiene 4 movimientos posibles, relleno con "Placaje"
    // (movimiento normal básico de toda la vida, el primero del catálogo).
    const moves = Battle._elegirMovimientos(detalle.movimientos_posibles || [], todosMovs, nivel);

    return {
      numero:  detalle.numero,
      nombre:  detalle.nombre,
      sprite:  detalle.sprite,
      tipos:   [detalle.tipo1, detalle.tipo2].filter(Boolean),  // .filter(Boolean) quita los null/undefined
      nivel,
      stats,
      hpMax:   stats.hp,
      hp:      stats.hp,  // empieza a PS máximo
      moves,              // array de movimientos con pp y todo
      fainted: false,     // cuando PS llega a 0 esto pasa a true
    };
  },


  // ══════ RESOLUCIÓN DE UN TURNO ══════
  // Lo más importante de todo. Recibe qué ha elegido cada jugador
  // y devuelve una lista de "eventos" que la UI tiene que mostrar
  // en orden (ataque de A, daño, ataque de B, daño, etc.).

  /**
   * Resuelve un turno completo entre dos Ibermon activos.
   *
   * actionA y actionB son objetos:
   *   - { tipo: 'mov', indice: 0..3 }    → usar movimiento
   *   - { tipo: 'cambio', slot: N }      → cambiar al Ibermon en el slot N
   *
   * Devuelve un array de eventos: cada uno es { tipo, ...datos }.
   * La UI los reproduce uno por uno con delay para que se vea bonito.
   *
   * El orden se decide así:
   *   1. Los cambios van PRIMERO (como en Pokémon).
   *   2. Entre dos ataques, va primero el de mayor prioridad del movimiento.
   *   3. Si empatan en prioridad, el de mayor Velocidad.
   *   4. Si también empata, se decide al azar (flip coin).
   */
  resolverTurno(estado, actionA, actionB) {
    const eventos = [];
    const a = estado.activoA;
    const b = estado.activoB;

    // --- 1. Cambios de Ibermon ---
    // Procesan antes que los ataques y no gastan prioridad.
    if (actionA.tipo === 'cambio') {
      Battle._hacerCambio(estado, 'A', actionA.slot, eventos);
    }
    if (actionB.tipo === 'cambio') {
      Battle._hacerCambio(estado, 'B', actionB.slot, eventos);
    }

    // Después de los cambios, actualizo las referencias de activos
    // porque el activo puede haber cambiado.
    const act = {
      A: estado.activoA,
      B: estado.activoB,
    };

    // --- 2. Determinar orden de ataques ---
    // Si uno hizo cambio y el otro ataque, el que atacó ataca ahora;
    // si ambos atacan, comparo prioridad y velocidad.
    const turnos = [];

    if (actionA.tipo === 'mov') {
      turnos.push({ lado: 'A', atk: act.A, def: act.B, mov: act.A.moves[actionA.indice] });
    }
    if (actionB.tipo === 'mov') {
      turnos.push({ lado: 'B', atk: act.B, def: act.A, mov: act.B.moves[actionB.indice] });
    }

    turnos.sort((t1, t2) => {
      // Mayor prioridad del movimiento → actúa antes
      if (t1.mov.prioridad !== t2.mov.prioridad) {
        return t2.mov.prioridad - t1.mov.prioridad;
      }
      // Si empatan, el más rápido
      if (t1.atk.stats.spd !== t2.atk.stats.spd) {
        return t2.atk.stats.spd - t1.atk.stats.spd;
      }
      // Empate total → cara o cruz
      return Math.random() < 0.5 ? -1 : 1;
    });


    // --- 3. Ejecutar cada ataque en orden ---
    for (const t of turnos) {
      // Si el atacante ha caído K.O. durante el turno (por el otro ataque),
      // no llega a atacar — esto pasa cuando el defensor del primer golpe
      // remata al atacante en su turno.
      if (t.atk.fainted) continue;

      Battle._ejecutarAtaque(t, eventos);

      // ¿Ha caído K.O. el defensor? Lo marco en el evento y paro la cadena.
      if (t.def.hp <= 0) {
        t.def.hp       = 0;
        t.def.fainted  = true;
        eventos.push({ tipo: 'ko', lado: t.lado === 'A' ? 'B' : 'A', unidad: t.def });
      }
    }

    return eventos;
  },


  /**
   * Comprueba si al jugador de un lado le queda algún Ibermon vivo.
   * Si no, el combate ha acabado.
   */
  equipoKO(equipo) {
    return equipo.every(u => u.fainted);
  },


  // ══════════════════════════════════════════════════════════
  // A partir de aquí van los helpers privados (con guion bajo
  // por convención — en JS no hay "private" real, pero al menos
  // así queda claro que no se usan fuera de este módulo).
  // ══════════════════════════════════════════════════════════


  /** Fórmula simplificada para calcular PS a un nivel dado. */
  _calcHP(base, nivel) {
    // En Pokémon real la fórmula lleva IVs/EVs y es más larga:
    //   ((2 * base + 31) * nivel / 100) + nivel + 10
    // La dejo así de simple, queda en el rango razonable (100-300 PS a Nv.50).
    return Math.floor(((2 * base) * nivel) / 100) + nivel + 10;
  },


  /** Fórmula simplificada para calcular stats (ataque, defensa, etc.) */
  _calcStat(base, nivel) {
    return Math.floor(((2 * base) * nivel) / 100) + 5;
  },


  /**
   * Escoge 4 movimientos para un Ibermon.
   * Primero coge los que aprende a nivel ≤ nivel actual, ordenados por
   * nivel descendente (los que aprende más tarde suelen ser mejores).
   * Si no le llegan, completa con un movimiento genérico.
   */
  _elegirMovimientos(posibles, todosMovs, nivel) {
    // movsDisponibles = los que ya sabe a este nivel
    const movsDisponibles = posibles
      .filter(m => m.nivel <= nivel)
      .sort((x, y) => y.nivel - x.nivel)   // los aprendidos más tarde primero
      .slice(0, 4);

    // Busco el detalle de cada movimiento en la lista completa
    const resultado = movsDisponibles
      .map(m => todosMovs.find(mv => mv.numero === m.numero))
      .filter(Boolean)                      // por si algún número no casa
      .map(Battle._prepararMov);

    // Si al final no tiene ningún movimiento, le meto uno por defecto
    // para que el combate no se atasque.
    if (resultado.length === 0) {
      resultado.push(Battle._movGenerico());
    }

    return resultado;
  },


  /** Convierte un movimiento del catálogo en uno "listo para usar" en combate. */
  _prepararMov(m) {
    return {
      numero:         m.numero,
      nombre:         m.nombre,
      tipo:           m.tipo,
      potencia:       m.potencia || 0,
      precision:      m.precision || 100,
      pp:             m.pp || 10,
      ppMax:          m.pp || 10,
      categoria:      m.categoria || 'Fisico',
      objetivo:       m.objetivo || 'Foe',
      prioridad:      m.prioridad || 0,
      siempreAcierta: m.siempre_acierta || false,
    };
  },


  /** Movimiento de relleno: un "Placaje" genérico tipo Normal. */
  _movGenerico() {
    return {
      numero: 0, nombre: 'Placaje', tipo: 'Normal',
      potencia: 40, precision: 100, pp: 20, ppMax: 20,
      categoria: 'Fisico', objetivo: 'Foe', prioridad: 0, siempreAcierta: false,
    };
  },


  /**
   * Procesa un cambio de Ibermon. Si el slot es inválido o el Ibermon
   * ya está K.O., lo ignora (defensivo — para evitar bugs).
   */
  _hacerCambio(estado, lado, slot, eventos) {
    const equipo = lado === 'A' ? estado.equipoA : estado.equipoB;
    const objetivo = equipo[slot];
    if (!objetivo || objetivo.fainted) return;

    const antiguo = lado === 'A' ? estado.activoA : estado.activoB;
    if (objetivo === antiguo) return;

    if (lado === 'A') estado.activoA = objetivo;
    else              estado.activoB = objetivo;

    eventos.push({ tipo: 'cambio', lado, sale: antiguo, entra: objetivo });
  },


  /**
   * Ejecuta un ataque y calcula el daño.
   * Mete eventos en el array para que la UI pueda mostrarlos.
   */
  _ejecutarAtaque(t, eventos) {
    // Anuncio del movimiento
    eventos.push({ tipo: 'ataque', lado: t.lado, atacante: t.atk, mov: t.mov });

    // PP a 0 = no puede usarlo. En ese caso le meto "forcejeo" (poco daño).
    if (t.mov.pp <= 0) {
      eventos.push({ tipo: 'sinPP', lado: t.lado, mov: t.mov });
      return;
    }
    t.mov.pp -= 1;

    // Movimientos de estado (potencia 0) por ahora simplemente no hacen nada
    // visible. Lo dejo así porque implementar todos los efectos de estado
    // me llevaría semanas — el objetivo del TFG es el combate básico, no
    // clonar Pokémon entero.
    if (t.mov.potencia === 0) {
      eventos.push({ tipo: 'noEfecto', lado: t.lado });
      return;
    }

    // ¿Acierta? Tiro de precisión.
    if (!t.mov.siempreAcierta && Math.random() * 100 > t.mov.precision) {
      eventos.push({ tipo: 'falla', lado: t.lado, atacante: t.atk });
      return;
    }

    // Cálculo de daño
    const { danyo, efect, critico } = Battle._calcularDanyo(t.atk, t.def, t.mov);
    t.def.hp = Math.max(0, t.def.hp - danyo);

    eventos.push({
      tipo: 'impacto',
      lado:    t.lado,
      atacante:t.atk,
      defensor:t.def,
      danyo,
      efect,                           // multiplicador de tipo (0, 0.5, 1, 2...)
      critico,
      hpRestante: t.def.hp,
      hpMax:      t.def.hpMax,
    });
  },


  /**
   * Fórmula de daño. Basada en la de Pokémon pero recortada:
   *
   *   daño = ( ( (2*N/5 + 2) * POT * A/D ) / 50 + 2 ) * STAB * TIPO * CRIT * RND
   *
   *   N     = nivel del atacante
   *   POT   = potencia del movimiento
   *   A/D   = ataque del atacante / defensa del defensor
   *           (si el mov es "Especial", uso spAtk/spDef)
   *   STAB  = 1.5 si el tipo del mov coincide con un tipo del atacante, 1 si no
   *   TIPO  = efectividad según tabla de tipos (0, 0.5, 1, 2, 4)
   *   CRIT  = 1.5 si hay crítico (1/16 de probabilidad), 1 si no
   *   RND   = valor aleatorio entre 0.85 y 1.00 para que no sea todo determinista
   */
  _calcularDanyo(atk, def, mov) {
    const esp = mov.categoria === 'Especial';
    const A   = esp ? atk.stats.spAtk : atk.stats.atk;
    const D   = esp ? def.stats.spDef : def.stats.def;
    const N   = atk.nivel;

    // Componente base de la fórmula
    let base = Math.floor(((2 * N / 5 + 2) * mov.potencia * A / D) / 50) + 2;

    // STAB — bonus por usar un movimiento del tipo propio
    const stab = atk.tipos.includes(mov.tipo) ? 1.5 : 1;

    // Efectividad del tipo contra el defensor (producto de ambos tipos)
    let efect = 1;
    for (const tDef of def.tipos) {
      efect *= Battle._efectividad(mov.tipo, tDef);
    }

    // Crítico — 1 de cada 16 golpes (probabilidad real de Pokémon)
    const critico = Math.random() < 1 / 16;
    const critMul = critico ? 1.5 : 1;

    // Aleatoriedad — da variedad a los números de daño
    const rnd = 0.85 + Math.random() * 0.15;

    const danyo = Math.max(1, Math.floor(base * stab * efect * critMul * rnd));

    return { danyo, efect, critico };
  },


  /**
   * Tabla de efectividades entre tipos.
   * Es una versión REDUCIDA — solo los emparejamientos más importantes.
   * Para los pares no definidos devuelvo 1 (neutro), así la tabla no se
   * hace infinita. Para un TFG es más que suficiente.
   */
  _efectividad(tAtaque, tDefensor) {
    const T = Battle._TABLA_TIPOS;
    if (!T[tAtaque]) return 1;
    // 2 = super eficaz, 0.5 = poco eficaz, 0 = inmune
    return T[tAtaque][tDefensor] ?? 1;
  },


  // Tabla reducida de efectividades. Nombres iguales a los del catálogo.
  // La pongo como constante dentro del objeto Battle para que quede
  // en un solo sitio.
  _TABLA_TIPOS: {
    Fuego:      { Planta: 2,   Agua: 0.5, Hielo: 2,    Bicho: 2,    Roca: 0.5, Acero: 2,   Fuego: 0.5, Dragón: 0.5 },
    Agua:       { Fuego: 2,    Planta: 0.5, Tierra: 2, Roca: 2,     Dragón: 0.5, Agua: 0.5 },
    Planta:     { Agua: 2,     Tierra: 2,  Roca: 2,    Fuego: 0.5,  Planta: 0.5, Veneno: 0.5, Volador: 0.5, Bicho: 0.5, Acero: 0.5, Dragón: 0.5 },
    'Eléctrico':{ Agua: 2,     Volador: 2, Planta: 0.5, 'Eléctrico': 0.5, Tierra: 0, Dragón: 0.5 },
    Normal:     { Roca: 0.5,   Acero: 0.5, Fantasma: 0 },
    'Psíquico': { Lucha: 2,    Veneno: 2,  'Psíquico': 0.5, Acero: 0.5, Siniestro: 0 },
    Roca:       { Fuego: 2,    Hielo: 2,   Volador: 2,  Bicho: 2,   Lucha: 0.5, Tierra: 0.5, Acero: 0.5 },
    Tierra:     { Fuego: 2,    'Eléctrico': 2, Veneno: 2, Roca: 2, Acero: 2,   Planta: 0.5, Bicho: 0.5, Volador: 0 },
    Hielo:      { Planta: 2,   Tierra: 2,  Volador: 2,  Dragón: 2,  Fuego: 0.5, Agua: 0.5,  Hielo: 0.5, Acero: 0.5 },
    Siniestro:  { 'Psíquico': 2, Fantasma: 2, Lucha: 0.5, Siniestro: 0.5 },
    Volador:    { Planta: 2,   Lucha: 2,   Bicho: 2,    'Eléctrico': 0.5, Roca: 0.5, Acero: 0.5 },
    Veneno:     { Planta: 2,   Veneno: 0.5, Tierra: 0.5, Roca: 0.5, Fantasma: 0.5, Acero: 0 },
    'Dragón':   { Dragón: 2,   Acero: 0.5 },
    Acero:      { Hielo: 2,    Roca: 2,    Fuego: 0.5,  Agua: 0.5,  'Eléctrico': 0.5, Acero: 0.5 },
    Bicho:      { Planta: 2,   'Psíquico': 2, Siniestro: 2, Fuego: 0.5, Lucha: 0.5, Veneno: 0.5, Volador: 0.5, Fantasma: 0.5, Acero: 0.5 },
    Lucha:      { Normal: 2,   Hielo: 2,   Roca: 2,     Siniestro: 2, Acero: 2, Veneno: 0.5, Volador: 0.5, 'Psíquico': 0.5, Bicho: 0.5, Fantasma: 0 },
    Fantasma:   { 'Psíquico': 2, Fantasma: 2, Siniestro: 0.5, Normal: 0 },
  },


  // ══════ IA DEL BOT ══════
  // La pongo aquí porque el bot también es "parte del motor" — aplica
  // las mismas reglas, solo cambia quien decide la acción.

  /**
   * Elige una acción para el bot. No es una IA sofisticada: intenta
   * pegar con el movimiento que haga más daño esperado, y si su Ibermon
   * está muy bajo de PS, a veces cambia.
   *
   * Como está en el motor (no en la UI), devuelve la misma estructura
   * que una acción humana, así arriba todo encaja igual.
   */
  decidirAccionBot(estado, ladoBot) {
    const activo  = ladoBot === 'A' ? estado.activoA : estado.activoB;
    const rival   = ladoBot === 'A' ? estado.activoB : estado.activoA;
    const equipo  = ladoBot === 'A' ? estado.equipoA : estado.equipoB;

    // Si está con menos del 20% de PS y tiene otro Ibermon en reserva,
    // hay un 40% de probabilidad de que cambie (suerte para el jugador).
    const bajoPS = activo.hp / activo.hpMax < 0.2;
    const reserva = equipo
      .map((u, i) => ({ u, i }))
      .filter(x => !x.u.fainted && x.u !== activo);

    if (bajoPS && reserva.length > 0 && Math.random() < 0.4) {
      const elegido = reserva[Math.floor(Math.random() * reserva.length)];
      return { tipo: 'cambio', slot: elegido.i };
    }

    // Si no, busco el movimiento con mayor daño esperado
    // (potencia * STAB * efectividad — sin cuentas completas, para
    // que el bot no sea sobrehumano).
    let mejorIdx = 0;
    let mejorScore = -1;

    for (let i = 0; i < activo.moves.length; i++) {
      const m = activo.moves[i];
      if (m.pp <= 0) continue;                  // sin PP, no cuenta

      const stab = activo.tipos.includes(m.tipo) ? 1.5 : 1;
      let efect = 1;
      for (const t of rival.tipos) efect *= Battle._efectividad(m.tipo, t);

      const score = m.potencia * stab * efect;
      if (score > mejorScore) {
        mejorScore = score;
        mejorIdx   = i;
      }
    }

    return { tipo: 'mov', indice: mejorIdx };
  },

};
