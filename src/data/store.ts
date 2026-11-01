import { useSyncExternalStore } from 'react';
import type { DB } from './types';
import { createSeed, DB_VERSION } from './seed';

/**
 * Хранилище демо-версии. Все чтения идут через useDB(), все изменения через api.ts.
 * Чтобы подключить настоящий бэкенд, заменяется только реализация в api.ts и загрузка здесь.
 */
const KEY = 'otp-mania-db';

let state: DB | null = null;
const listeners = new Set<() => void>();
let persistOk = true;

export function storageAvailable() { return persistOk; }

function persist() {
  if (!state) return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { persistOk = false; }
}

export function loadState(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed && parsed.version === DB_VERSION && Array.isArray(parsed.users)) {
        state = parsed;
        return state;
      }
    }
  } catch { persistOk = false; }
  state = createSeed();
  persist();
  return state;
}

export function getState(): DB {
  if (!state) throw new Error('Данные ещё не загружены');
  return state;
}

/** Применяет изменение к копии состояния и уведомляет подписчиков. */
export function commit(mutator: (draft: DB) => void) {
  const draft = structuredClone(getState());
  mutator(draft);
  state = draft;
  persist();
  listeners.forEach((l) => l());
}

export function resetState() {
  state = createSeed();
  persist();
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, getState, getState);
}
