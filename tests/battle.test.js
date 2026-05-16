import { describe, expect, test, vi } from 'vitest';
import { loadBattle } from './helpers/loadModules.js';

const baseDetalle = {
  numero: 1,
  nombre: 'Testmon',
  hp_base: 100,
  ataque_base: 80,
  defensa_base: 70,
  ataque_especial_base: 70,
  defensa_especial_base: 70,
  velocidad_base: 70,
  tipo1: 'Normal',
  movimientos_posibles: [],
};

function unit(overrides = {}) {
  return {
    nombre: 'U',
    nivel: 50,
    tipos: ['Normal'],
    stats: { hp: 160, atk: 85, def: 75, spAtk: 75, spDef: 75, spd: 70 },
    hpMax: 160,
    hp: 160,
    fainted: false,
    moves: [],
    ...overrides,
  };
}

function move(overrides = {}) {
  return {
    nombre: 'Placaje',
    tipo: 'Normal',
    potencia: 40,
    precision: 100,
    pp: 10,
    ppMax: 10,
    categoria: 'Fisico',
    prioridad: 0,
    siempreAcierta: false,
    ...overrides,
  };
}

function estado(a, b) {
  return { activoA: a, activoB: b, equipoA: [a], equipoB: [b] };
}

describe('PR-03 - battle.js', () => {
  test('PR-03.1 - buildUnit con hp_base=100 produce hpMax=160', () => {
    const Battle = loadBattle();
    const u = Battle.buildUnit(baseDetalle, []);
    expect(u.hpMax).toBe(160);
  });

  test('PR-03.2 - buildUnit con ataque_base=80 produce stats.atk=85', () => {
    const Battle = loadBattle();
    const u = Battle.buildUnit(baseDetalle, []);
    expect(u.stats.atk).toBe(85);
  });

  test('PR-03.3 - Daño con atacante Fuego + mov Fuego: el factor STAB es 1.5', () => {
    const Battle = loadBattle();
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const atacanteStab = unit({ tipos: ['Fuego'] });
    const atacanteSinStab = unit({ tipos: ['Agua'] });
    const defensor = unit({ tipos: ['Normal'] });
    const mov = move({ tipo: 'Fuego', potencia: 60 });

    const conStab = Battle._calcularDanyo(atacanteStab, defensor, mov).danyo;
    const sinStab = Battle._calcularDanyo(atacanteSinStab, defensor, mov).danyo;

    expect(conStab / sinStab).toBeCloseTo(1.5, 1);
  });

  test('PR-03.4 - _efectividad("Fuego","Planta") devuelve 2', () => {
    expect(loadBattle()._efectividad('Fuego', 'Planta')).toBe(2);
  });

  test('PR-03.5 - _efectividad("Fuego","Agua") devuelve 0.5', () => {
    expect(loadBattle()._efectividad('Fuego', 'Agua')).toBe(0.5);
  });

  test('PR-03.6 - _efectividad("Normal","Fantasma") devuelve 0', () => {
    expect(loadBattle()._efectividad('Normal', 'Fantasma')).toBe(0);
  });

  test('PR-03.7 - _calcularDanyo nunca devuelve menos de 1', () => {
    const Battle = loadBattle();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = Battle._calcularDanyo(unit(), unit({ tipos: ['Fantasma'] }), move({ tipo: 'Normal', potencia: 1 }));
    expect(result.danyo).toBeGreaterThanOrEqual(1);
  });

  test('PR-03.8 - Orden de turno: A vel=100 ataca antes que B vel=80 con el mismo movimiento', () => {
    const Battle = loadBattle();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const a = unit({ nombre: 'A', stats: { ...unit().stats, spd: 100 }, moves: [move()] });
    const b = unit({ nombre: 'B', stats: { ...unit().stats, spd: 80 }, moves: [move()] });
    const eventos = Battle.resolverTurno(estado(a, b), { tipo: 'mov', indice: 0 }, { tipo: 'mov', indice: 0 });
    expect(eventos.filter(e => e.tipo === 'ataque')[0].lado).toBe('A');
  });

  test('PR-03.9 - Orden de turno: B con prioridad +1 ataca antes que A aunque A sea mas rapido', () => {
    const Battle = loadBattle();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const a = unit({ nombre: 'A', stats: { ...unit().stats, spd: 100 }, moves: [move({ prioridad: 0 })] });
    const b = unit({ nombre: 'B', stats: { ...unit().stats, spd: 80 }, moves: [move({ prioridad: 1 })] });
    const eventos = Battle.resolverTurno(estado(a, b), { tipo: 'mov', indice: 0 }, { tipo: 'mov', indice: 0 });
    expect(eventos.filter(e => e.tipo === 'ataque')[0].lado).toBe('B');
  });

  test('PR-03.10 - Movimiento con precision=0 produce eventos tipo falla siempre', () => {
    const Battle = loadBattle();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const a = unit({ moves: [move({ precision: 0 })] });
    const b = unit({ moves: [move()] });
    const eventos = Battle.resolverTurno(estado(a, b), { tipo: 'mov', indice: 0 }, { tipo: 'cambio', slot: 0 });
    expect(eventos.some(e => e.tipo === 'falla')).toBe(true);
  });

  test('PR-03.11 - Criticos: tras 1000 ejecuciones la tasa esta entre 4% y 9%', () => {
    const Battle = loadBattle();
    let calls = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      calls += 1;
      if (calls % 2 === 1) return calls <= 124 ? 0.01 : 0.5;
      return 0.5;
    });
    let criticos = 0;
    for (let i = 0; i < 1000; i++) {
      if (Battle._calcularDanyo(unit(), unit(), move()).critico) criticos += 1;
    }
    const tasa = criticos / 1000;
    expect(tasa).toBeGreaterThanOrEqual(0.04);
    expect(tasa).toBeLessThanOrEqual(0.09);
  });

  test('PR-03.12 - PP descontado tras uso: si mov.pp=10, tras un turno queda 9', () => {
    const Battle = loadBattle();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const mov = move({ pp: 10 });
    const a = unit({ moves: [mov] });
    const b = unit({ moves: [move()] });
    Battle.resolverTurno(estado(a, b), { tipo: 'mov', indice: 0 }, { tipo: 'cambio', slot: 0 });
    expect(mov.pp).toBe(9);
  });

  test('PR-03.13 - Sin PP emite evento tipo sinPP', () => {
    const Battle = loadBattle();
    const a = unit({ moves: [move({ pp: 0 })] });
    const b = unit({ moves: [move()] });
    const eventos = Battle.resolverTurno(estado(a, b), { tipo: 'mov', indice: 0 }, { tipo: 'cambio', slot: 0 });
    expect(eventos.some(e => e.tipo === 'sinPP')).toBe(true);
  });

  test('PR-03.14 - equipoKO devuelve true cuando todos los miembros estan fainted', () => {
    const Battle = loadBattle();
    expect(Battle.equipoKO([unit({ fainted: true }), unit({ fainted: true })])).toBe(true);
  });

  test('PR-03.15 - decidirAccionBot elige el movimiento con mayor potencia * STAB * efectividad', () => {
    const Battle = loadBattle();
    const bot = unit({
      tipos: ['Fuego'],
      moves: [
        move({ tipo: 'Normal', potencia: 100 }),
        move({ tipo: 'Fuego', potencia: 60 }),
        move({ tipo: 'Agua', potencia: 80 }),
      ],
    });
    const rival = unit({ tipos: ['Planta'] });
    expect(Battle.decidirAccionBot(estado(rival, bot), 'B')).toEqual({ tipo: 'mov', indice: 1 });
  });

  test('PR-03.16 - decidirAccionBot con activo al 15% PS cambia aproximadamente un 40%', () => {
    const Battle = loadBattle();
    let calls = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      calls += 1;
      if (calls <= 800 && calls % 2 === 0) return 0;
      return calls <= 799 ? 0.2 : 0.8;
    });
    const bot = unit({ hp: 15, hpMax: 100, moves: [move()] });
    const reserva = unit({ nombre: 'Reserva', moves: [move()] });
    const rival = unit({ moves: [move()] });
    const st = { activoA: rival, activoB: bot, equipoA: [rival], equipoB: [bot, reserva] };
    let cambios = 0;
    for (let i = 0; i < 1000; i++) {
      if (Battle.decidirAccionBot(st, 'B').tipo === 'cambio') cambios += 1;
    }
    expect(cambios / 1000).toBeGreaterThanOrEqual(0.35);
    expect(cambios / 1000).toBeLessThanOrEqual(0.45);
  });
});
