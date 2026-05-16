import { describe, expect, test, vi } from 'vitest';
import { loadMatchmaking } from './helpers/loadModules.js';

function pair() {
  vi.useFakeTimers();
  const a = loadMatchmaking();
  const b = loadMatchmaking();
  a.init('David');
  b.init('Rival');
  a._miId = 'a_host';
  b._miId = 'b_guest';
  return { a, b };
}

describe('PR-04 - matchmaking.js', () => {
  test('PR-04.1 - Matchmaking.init("David") no lanza y deja _canal distinto de null', () => {
    const Matchmaking = loadMatchmaking();
    expect(() => Matchmaking.init('David')).not.toThrow();
    expect(Matchmaking._canal).not.toBeNull();
  });

  test('PR-04.2 - Matchmaking.buscar() emite al menos 3 mensajes presencia en 6 segundos', () => {
    vi.useFakeTimers();
    const Matchmaking = loadMatchmaking();
    Matchmaking.init('David');
    Matchmaking.buscar();

    vi.advanceTimersByTime(6000);

    const presencias = globalThis.__FakeBroadcastChannel.sent.filter(x => x.data.tipo === 'presencia');
    expect(presencias.length).toBeGreaterThanOrEqual(3);
  });

  test('PR-04.3 - Dos instancias en pestañas simuladas se emparejan: la segunda recibe emparejado', () => {
    const { a, b } = pair();
    const handler = vi.fn();
    b.on('emparejado', handler);

    a.buscar();
    b.buscar();

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'a_host' }));
  });

  test('PR-04.4 - La instancia con id alfabeticamente menor tiene soyHost() === true', () => {
    const { a, b } = pair();
    a.buscar();
    b.buscar();
    expect(a.soyHost()).toBe(true);
    expect(b.soyHost()).toBe(false);
  });

  test('PR-04.5 - enviarEquipo(eq) provoca que el peer reciba equipoRecibido con el mismo array', () => {
    const { a, b } = pair();
    const handler = vi.fn();
    b.on('equipoRecibido', handler);
    a.buscar();
    b.buscar();
    const eq = [{ numero: 1 }, { numero: 2 }];

    a.enviarEquipo(eq);

    expect(handler).toHaveBeenCalledWith(eq);
  });

  test('PR-04.6 - enviarAccion provoca evento accionRecibida en el peer', () => {
    const { a, b } = pair();
    const handler = vi.fn();
    b.on('accionRecibida', handler);
    a.buscar();
    b.buscar();
    const accion = { tipo: 'mov', indice: 0 };

    a.enviarAccion(accion);

    expect(handler).toHaveBeenCalledWith(accion);
  });

  test('PR-04.7 - Heartbeat: tras 8s sin pings se emite rivalSeFue con motivo desconexion', () => {
    const { a, b } = pair();
    const handler = vi.fn();
    a.on('rivalSeFue', handler);
    a.buscar();
    b.buscar();
    b.cerrar();

    vi.advanceTimersByTime(9000);

    expect(handler).toHaveBeenCalledWith({ motivo: 'desconexion' });
  });

  test('PR-04.8 - rendirse() provoca evento rivalSeFue con motivo rendicion en el peer', () => {
    const { a, b } = pair();
    const handler = vi.fn();
    b.on('rivalSeFue', handler);
    a.buscar();
    b.buscar();

    a.rendirse();

    expect(handler).toHaveBeenCalledWith({ motivo: 'rendicion' });
  });

  test('PR-04.9 - Con una sola pestaña no se emite emparejado aunque pasen 10s', () => {
    vi.useFakeTimers();
    const Matchmaking = loadMatchmaking();
    const handler = vi.fn();
    Matchmaking.init('David');
    Matchmaking.on('emparejado', handler);
    Matchmaking.buscar();

    vi.advanceTimersByTime(10000);

    expect(handler).not.toHaveBeenCalled();
  });
});
