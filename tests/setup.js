import { afterEach, beforeEach, vi } from 'vitest';

class FakeBroadcastChannel {
  static channels = new Map();
  static sent = [];

  constructor(name) {
    this.name = name;
    this.closed = false;
    this.listeners = new Set();
    if (!FakeBroadcastChannel.channels.has(name)) {
      FakeBroadcastChannel.channels.set(name, new Set());
    }
    FakeBroadcastChannel.channels.get(name).add(this);
  }

  addEventListener(type, listener) {
    if (type === 'message') this.listeners.add(listener);
  }

  removeEventListener(type, listener) {
    if (type === 'message') this.listeners.delete(listener);
  }

  postMessage(data) {
    FakeBroadcastChannel.sent.push({ channel: this.name, data });
    const peers = FakeBroadcastChannel.channels.get(this.name) || new Set();
    for (const peer of peers) {
      if (peer !== this && !peer.closed) {
        for (const listener of peer.listeners) {
          listener({ data });
        }
      }
    }
  }

  close() {
    this.closed = true;
    FakeBroadcastChannel.channels.get(this.name)?.delete(this);
  }

  static reset() {
    for (const peers of FakeBroadcastChannel.channels.values()) {
      for (const peer of peers) peer.close();
    }
    FakeBroadcastChannel.channels.clear();
    FakeBroadcastChannel.sent = [];
  }
}

globalThis.BroadcastChannel = FakeBroadcastChannel;
globalThis.__FakeBroadcastChannel = FakeBroadcastChannel;

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/index.html');
  vi.restoreAllMocks();
  FakeBroadcastChannel.reset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  FakeBroadcastChannel.reset();
});
