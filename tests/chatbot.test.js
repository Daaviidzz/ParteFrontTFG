import { describe, expect, test, vi } from 'vitest';
import { loadChatbot } from './helpers/loadModules.js';

const ibermonList = [
  { numero: 1, nombre: 'Bulbasaur' },
  { numero: 4, nombre: 'Charmander' },
];

function mockCatalogFetch() {
  globalThis.fetch = vi.fn(async url => {
    if (String(url).endsWith('/catalogo/ibermon')) {
      return { ok: true, status: 200, json: vi.fn().mockResolvedValue(ibermonList) };
    }
    if (String(url).endsWith('/catalogo/movimientos')) {
      return { ok: true, status: 200, json: vi.fn().mockResolvedValue([]) };
    }
    if (String(url).endsWith('/catalogo/items')) {
      return { ok: true, status: 200, json: vi.fn().mockResolvedValue([]) };
    }
    return { ok: true, status: 200, json: vi.fn().mockResolvedValue({ respuesta: 'ok' }) };
  });
}

async function waitForExpectation(fn) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < 1000) {
    try {
      fn();
      return;
    } catch (err) {
      lastError = err;
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  throw lastError;
}

describe('PR-05 - chatbot.js', () => {
  test('PR-05.1 - detectAPIIntent("ibermon #001") devuelve intent ibermon y query 1', () => {
    const { detectAPIIntent } = loadChatbot();
    expect(detectAPIIntent('ibermon #001')).toEqual({ intent: 'ibermon', query: 1 });
  });

  test('PR-05.2 - detectAPIIntent("lista de movimientos") devuelve intent lista_movimientos', () => {
    const { detectAPIIntent } = loadChatbot();
    expect(detectAPIIntent('lista de movimientos')).toEqual({ intent: 'lista_movimientos' });
  });

  test('PR-05.3 - tryNameSearch("Bulbasaur") devuelve intent ibermon y query 1', async () => {
    mockCatalogFetch();
    const { tryNameSearch } = loadChatbot();
    await expect(tryNameSearch('Bulbasaur')).resolves.toEqual({ intent: 'ibermon', query: 1 });
  });

  test('PR-05.4 - tryNameSearch("Bulbasor") devuelve fuzzyName igual a Bulbasaur', async () => {
    mockCatalogFetch();
    const { tryNameSearch } = loadChatbot();
    await expect(tryNameSearch('Bulbasor')).resolves.toMatchObject({
      intent: 'ibermon',
      query: 1,
      fuzzyName: 'Bulbasaur',
    });
  });

  test('PR-05.5 - tryNameSearch("Charmonder") encuentra Charmander', async () => {
    mockCatalogFetch();
    const { tryNameSearch } = loadChatbot();
    await expect(tryNameSearch('Charmonder')).resolves.toMatchObject({
      intent: 'ibermon',
      query: 4,
      fuzzyName: 'Charmander',
    });
  });

  test('PR-05.6 - tryNameSearch("hola") devuelve null por stop word', async () => {
    mockCatalogFetch();
    const { tryNameSearch } = loadChatbot();
    await expect(tryNameSearch('hola')).resolves.toBeNull();
  });

  test('PR-05.7 - Si ni regex ni nombre matchean, handleSend() llama a POST /chatbot/mensaje', async () => {
    globalThis.fetch = vi.fn(async url => {
      if (String(url).includes('/catalogo/')) {
        return { ok: true, status: 200, json: vi.fn().mockResolvedValue([]) };
      }
      return { ok: true, status: 200, json: vi.fn().mockResolvedValue({ respuesta: 'respuesta backend' }) };
    });
    const { initChatbot } = loadChatbot();
    initChatbot();

    document.getElementById('chatbot-input').value = 'pregunta sin coincidencia concreta';
    document.getElementById('chatbot-send').click();
    await waitForExpectation(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/chatbot/mensaje',
        expect.objectContaining({ method: 'POST' })
      );
    });

    expect(document.getElementById('chatbot-msgs').textContent).toContain('respuesta backend');
  });

  test('PR-05.8 - Cuando fetch rechaza con NetworkError, el chatbot muestra mensaje de error sin crash', async () => {
    globalThis.fetch = vi.fn(async url => {
      if (String(url).includes('/catalogo/')) {
        return { ok: true, status: 200, json: vi.fn().mockResolvedValue([]) };
      }
      throw new Error('NetworkError');
    });
    const { initChatbot } = loadChatbot();
    initChatbot();

    document.getElementById('chatbot-input').value = 'pregunta sin coincidencia concreta';
    document.getElementById('chatbot-send').click();
    await waitForExpectation(() => {
      expect(document.getElementById('chatbot-msgs').textContent).toContain('No puedo conectar');
    });

    expect(document.getElementById('chatbot-msgs').textContent).toContain('No puedo conectar');
  });

  test('PR-05.9 - getIbermonList() llamada tres veces seguidas resulta en una sola llamada de red', async () => {
    mockCatalogFetch();
    const { getIbermonList } = loadChatbot();

    await getIbermonList();
    await getIbermonList();
    await getIbermonList();

    const ibermonCalls = fetch.mock.calls.filter(([url]) => String(url).endsWith('/catalogo/ibermon'));
    expect(ibermonCalls).toHaveLength(1);
  });
});
