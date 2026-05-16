import { describe, expect, test, vi } from 'vitest';
import { loadApi } from './helpers/loadModules.js';

function response({ ok = true, status = 200, data = {} } = {}) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
  };
}

describe('PR-02 - api.js', () => {
  test('PR-02.1 - apiFetch inyecta Authorization si hay token en localStorage', async () => {
    localStorage.setItem('ibermon_token', 'tok123');
    globalThis.fetch = vi.fn().mockResolvedValue(response({ data: { ok: true } }));
    const { apiFetch } = loadApi();

    await apiFetch('/auth/yo');

    expect(fetch.mock.calls[0][0]).toBe('/api/auth/yo');
    expect(fetch.mock.calls[0][1].headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer tok123',
    });
  });

  test('PR-02.2 - apiFetch no añade Authorization si no hay token', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(response({ data: { ok: true } }));
    const { apiFetch } = loadApi();

    await apiFetch('/catalogo/ibermon');

    expect(fetch.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' });
  });

  test('PR-02.3 - apiFetch maneja status 204 devolviendo null sin parsear JSON', async () => {
    const json = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204, json });
    const { apiFetch } = loadApi();

    await expect(apiFetch('/partidas/1', { method: 'DELETE' })).resolves.toBeNull();
    expect(json).not.toHaveBeenCalled();
  });

  test('PR-02.4 - apiFetch lanza Error con message igual al campo detail de la respuesta', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(response({
      ok: false,
      status: 401,
      data: { detail: 'Credenciales incorrectas' },
    }));
    const { apiFetch } = loadApi();

    await expect(apiFetch('/auth/yo')).rejects.toThrow('Credenciales incorrectas');
  });

  test('PR-02.5 - rawFetch devuelve un objeto con ms numerico > 0', async () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValueOnce(106);
    globalThis.fetch = vi.fn().mockResolvedValue(response({ data: { total: 1 } }));
    const { rawFetch } = loadApi();

    const result = await rawFetch('/catalogo/ibermon');

    expect(result).toMatchObject({ ok: true, status: 200, data: { total: 1 } });
    expect(result.ms).toBeGreaterThan(0);
  });

  test('PR-02.6 - rawFetch no lanza cuando la red falla: devuelve ok false y status 0', async () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValueOnce(105);
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('NetworkError'));
    const { rawFetch } = loadApi();

    const result = await rawFetch('/catalogo/ibermon');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.data.error).toBe('NetworkError');
  });
});
