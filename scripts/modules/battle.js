// Motor de combate: calcula danyo, resuelve turnos y mantiene el estado
// Independiente de la UI para reutilizarlo en CPU y multijugador

const Battle = {

  NIVEL_FIJO: 50,


  // Construye una unidad de combate desde el detalle del catalogo
  buildUnit(detalle, todosMovs) {
    const nivel = Battle.NIVEL_FIJO;

    const stats = {
      hp:        Battle._calcHP(detalle.hp_base, nivel),
      atk:       Battle._calcStat(detalle.ataque_base, nivel),
      def:       Battle._calcStat(detalle.defensa_base, nivel),
      spAtk:     Battle._calcStat(detalle.ataque_especial_base, nivel),
      spDef:     Battle._calcStat(detalle.defensa_especial_base, nivel),
      spd:       Battle._calcStat(detalle.velocidad_base, nivel),
    };

    const moves = Battle._elegirMovimientos(detalle.movimientos_posibles || [], todosMovs, nivel);

    return {
      numero:  detalle.numero,
      nombre:  detalle.nombre,
      sprite:  detalle.sprite,
      tipos:   [detalle.tipo1, detalle.tipo2].filter(Boolean),
      nivel,
      stats,
      hpMax:   stats.hp,
      hp:      stats.hp,
      moves,
      fainted: false,
    };
  },


  // Resuelve un turno: cambios primero, luego ataques por prioridad/velocidad
  resolverTurno(estado, actionA, actionB) {
    const eventos = [];

    // 1. Cambios
    if (actionA.tipo === 'cambio') {
      Battle._hacerCambio(estado, 'A', actionA.slot, eventos);
    }
    if (actionB.tipo === 'cambio') {
      Battle._hacerCambio(estado, 'B', actionB.slot, eventos);
    }

    const act = {
      A: estado.activoA,
      B: estado.activoB,
    };

    // 2. Orden de ataques
    const turnos = [];

    if (actionA.tipo === 'mov') {
      turnos.push({ lado: 'A', atk: act.A, def: act.B, mov: act.A.moves[actionA.indice] });
    }
    if (actionB.tipo === 'mov') {
      turnos.push({ lado: 'B', atk: act.B, def: act.A, mov: act.B.moves[actionB.indice] });
    }

    turnos.sort((t1, t2) => {
      if (t1.mov.prioridad !== t2.mov.prioridad) {
        return t2.mov.prioridad - t1.mov.prioridad;
      }
      if (t1.atk.stats.spd !== t2.atk.stats.spd) {
        return t2.atk.stats.spd - t1.atk.stats.spd;
      }
      // Empate total: cara o cruz
      return Math.random() < 0.5 ? -1 : 1;
    });


    // 3. Ejecutar
    for (const t of turnos) {
      // Si ya cayo K.O. en el otro ataque, no llega a actuar
      if (t.atk.fainted) continue;

      Battle._ejecutarAtaque(t, eventos);

      if (t.def.hp <= 0) {
        t.def.hp       = 0;
        t.def.fainted  = true;
        eventos.push({ tipo: 'ko', lado: t.lado === 'A' ? 'B' : 'A', unidad: t.def });
      }
    }

    return eventos;
  },


  equipoKO(equipo) {
    return equipo.every(u => u.fainted);
  },


  // Helpers privados (prefijo _ por convencion)

  _calcHP(base, nivel) {
    return Math.floor(((2 * base) * nivel) / 100) + nivel + 10;
  },

  _calcStat(base, nivel) {
    return Math.floor(((2 * base) * nivel) / 100) + 5;
  },


  // 4 movimientos, los aprendidos a mayor nivel <= nivel actual
  _elegirMovimientos(posibles, todosMovs, nivel) {
    const movsDisponibles = posibles
      .filter(m => m.nivel <= nivel)
      .sort((x, y) => y.nivel - x.nivel)
      .slice(0, 4);

    const resultado = movsDisponibles
      .map(m => todosMovs.find(mv => mv.numero === m.numero))
      .filter(Boolean)
      .map(Battle._prepararMov);

    if (resultado.length === 0) {
      resultado.push(Battle._movGenerico());
    }

    return resultado;
  },


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


  // Movimiento de relleno si el Ibermon no tiene ninguno aprendido
  _movGenerico() {
    return {
      numero: 0, nombre: 'Placaje', tipo: 'Normal',
      potencia: 40, precision: 100, pp: 20, ppMax: 20,
      categoria: 'Fisico', objetivo: 'Foe', prioridad: 0, siempreAcierta: false,
    };
  },


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


  _ejecutarAtaque(t, eventos) {
    eventos.push({ tipo: 'ataque', lado: t.lado, atacante: t.atk, mov: t.mov });

    // Sin PP no puede usarlo
    if (t.mov.pp <= 0) {
      eventos.push({ tipo: 'sinPP', lado: t.lado, mov: t.mov });
      return;
    }
    t.mov.pp -= 1;

    // Movimientos de estado: por ahora no implemento efectos
    if (t.mov.potencia === 0) {
      eventos.push({ tipo: 'noEfecto', lado: t.lado });
      return;
    }

    if (!t.mov.siempreAcierta && Math.random() * 100 > t.mov.precision) {
      eventos.push({ tipo: 'falla', lado: t.lado, atacante: t.atk });
      return;
    }

    const { danyo, efect, critico } = Battle._calcularDanyo(t.atk, t.def, t.mov);
    t.def.hp = Math.max(0, t.def.hp - danyo);

    eventos.push({
      tipo: 'impacto',
      lado:    t.lado,
      atacante:t.atk,
      defensor:t.def,
      danyo,
      efect,
      critico,
      hpRestante: t.def.hp,
      hpMax:      t.def.hpMax,
    });
  },


  // Formula de danyo (Pokemon simplificada): base * STAB * tipo * crit * rnd
  _calcularDanyo(atk, def, mov) {
    const esp = mov.categoria === 'Especial';
    const A   = esp ? atk.stats.spAtk : atk.stats.atk;
    const D   = esp ? def.stats.spDef : def.stats.def;
    const N   = atk.nivel;

    let base = Math.floor(((2 * N / 5 + 2) * mov.potencia * A / D) / 50) + 2;

    // STAB: 1.5 si el tipo del mov coincide con uno del atacante
    const stab = atk.tipos.includes(mov.tipo) ? 1.5 : 1;

    let efect = 1;
    for (const tDef of def.tipos) {
      efect *= Battle._efectividad(mov.tipo, tDef);
    }

    // 1 de cada 16 son criticos
    const critico = Math.random() < 1 / 16;
    const critMul = critico ? 1.5 : 1;

    const rnd = 0.85 + Math.random() * 0.15;

    const danyo = Math.max(1, Math.floor(base * stab * efect * critMul * rnd));

    return { danyo, efect, critico };
  },


  _efectividad(tAtaque, tDefensor) {
    const T = Battle._TABLA_TIPOS;
    if (!T[tAtaque]) return 1;
    return T[tAtaque][tDefensor] ?? 1;
  },


  // Tabla reducida de efectividades. Pares no definidos = 1 (neutro)
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


  // IA del bot: prioriza el mov de mayor danyo esperado, a veces cambia si esta a poca vida
  decidirAccionBot(estado, ladoBot) {
    const activo  = ladoBot === 'A' ? estado.activoA : estado.activoB;
    const rival   = ladoBot === 'A' ? estado.activoB : estado.activoA;
    const equipo  = ladoBot === 'A' ? estado.equipoA : estado.equipoB;

    const bajoPS = activo.hp / activo.hpMax < 0.2;
    const reserva = equipo
      .map((u, i) => ({ u, i }))
      .filter(x => !x.u.fainted && x.u !== activo);

    if (bajoPS && reserva.length > 0 && Math.random() < 0.4) {
      const elegido = reserva[Math.floor(Math.random() * reserva.length)];
      return { tipo: 'cambio', slot: elegido.i };
    }

    let mejorIdx = 0;
    let mejorScore = -1;

    for (let i = 0; i < activo.moves.length; i++) {
      const m = activo.moves[i];
      if (m.pp <= 0) continue;

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
