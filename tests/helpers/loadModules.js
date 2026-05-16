import { loadClassicScript, loadClassicScriptInContext } from './loadScript.js';

export function loadAuth() {
  return loadClassicScript(['scripts/modules/auth.js'], 'Auth', {
    window,
    document,
    localStorage,
    URLSearchParams,
    setTimeout,
  });
}

export function loadApi() {
  return loadClassicScript(
    ['scripts/modules/config.js', 'scripts/api/api.js'],
    '({ apiFetch, rawFetch, AuthAPI, CatalogAPI, PartidaAPI })',
    {
      window,
      document,
      localStorage,
      fetch: (...args) => globalThis.fetch(...args),
    }
  );
}

export function loadBattle() {
  return loadClassicScript(['scripts/modules/config.js', 'scripts/modules/battle.js'], 'Battle', {
    spriteUrl: input => (typeof input === 'string' ? input : input?.sprite_frontal || input?.sprite || ''),
  });
}

export function loadChatbot() {
  return loadClassicScript(
    ['scripts/modules/config.js', 'scripts/modules/chatbot.js'],
    '({ detectAPIIntent, tryNameSearch, getIbermonList, initChatbot, preguntarAIberBot })',
    {
      window,
      document,
      localStorage,
      fetch: (...args) => globalThis.fetch(...args),
    }
  );
}

export function loadMatchmaking() {
  return loadClassicScriptInContext(['scripts/modules/matchmaking.js'], 'Matchmaking;');
}
