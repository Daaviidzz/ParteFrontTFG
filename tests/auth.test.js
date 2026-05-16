import { describe, expect, test } from 'vitest';
import { loadAuth } from './helpers/loadModules.js';

describe('PR-01 - auth.js', () => {
  test('PR-01.1 - Auth.isLoggedIn() devuelve false cuando localStorage esta vacio', () => {
    const Auth = loadAuth();
    expect(Auth.isLoggedIn()).toBe(false);
  });

  test('PR-01.2 - Auth.save deja ibermon_token e ibermon_user en localStorage', () => {
    const Auth = loadAuth();
    Auth.save('tok123', { username: 'david' });
    expect(localStorage.getItem('ibermon_token')).toBe('tok123');
    expect(JSON.parse(localStorage.getItem('ibermon_user'))).toEqual({ username: 'david' });
  });

  test('PR-01.3 - Auth.isLoggedIn() devuelve true despues de un save', () => {
    const Auth = loadAuth();
    Auth.save('tok123', { username: 'david' });
    expect(Auth.isLoggedIn()).toBe(true);
  });

  test('PR-01.4 - Auth.getUser() devuelve el objeto correctamente deserializado', () => {
    const Auth = loadAuth();
    Auth.save('tok123', { username: 'david' });
    expect(Auth.getUser()).toEqual({ username: 'david' });
  });

  test('PR-01.5 - Auth.logout() borra ambas claves del localStorage', () => {
    const Auth = loadAuth();
    Auth.save('tok123', { username: 'david' });
    Auth.logout();
    expect(localStorage.getItem('ibermon_token')).toBeNull();
    expect(localStorage.getItem('ibermon_user')).toBeNull();
  });

  test('PR-01.6 - Auth.requireAuth() redirige a login.html?next=... cuando no hay token', () => {
    const Auth = loadAuth();
    window.history.replaceState({}, '', '/dashboard.html');
    expect(Auth.requireAuth()).toBe(false);
    expect(window.location.href).toContain('login.html?next=%2Fdashboard.html');
  });

  test('PR-01.7 - Auth.redirectIfLogged() redirige a dashboard.html cuando si hay sesion', () => {
    const Auth = loadAuth();
    Auth.save('tok123', { username: 'david' });
    Auth.redirectIfLogged();
    expect(window.location.href).toContain('dashboard.html');
  });
});
