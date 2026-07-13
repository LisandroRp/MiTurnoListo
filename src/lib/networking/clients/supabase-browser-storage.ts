"use client";

const sessionPersistenceModeKey = "miturnolisto_session_persistence";
export const supabaseBrowserStorageKey = "miturnolisto-auth";

type SessionPersistenceMode = "local" | "session";

function getLocalStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

function getSessionStorage() {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

function getPersistenceMode(): SessionPersistenceMode | null {
  const storage = getLocalStorage();
  const rawMode = storage?.getItem(sessionPersistenceModeKey);

  return rawMode === "local" || rawMode === "session" ? rawMode : null;
}

function getReadStorages() {
  const mode = getPersistenceMode();
  const localStorage = getLocalStorage();
  const sessionStorage = getSessionStorage();

  if (mode === "session") {
    return [sessionStorage, localStorage];
  }

  return [localStorage, sessionStorage];
}

function getWriteStorage() {
  return getPersistenceMode() === "session" ? getSessionStorage() : getLocalStorage();
}

export const supabaseBrowserStorage = {
  getItem(key: string) {
    for (const storage of getReadStorages()) {
      const value = storage?.getItem(key);

      if (value) {
        return value;
      }
    }

    return null;
  },

  setItem(key: string, value: string) {
    const writeStorage = getWriteStorage();
    writeStorage?.setItem(key, value);

    for (const storage of getReadStorages()) {
      if (storage && storage !== writeStorage) {
        storage.removeItem(key);
      }
    }
  },

  removeItem(key: string) {
    getLocalStorage()?.removeItem(key);
    getSessionStorage()?.removeItem(key);
  }
};

export function hasSupabaseSessionPersistence() {
  return getPersistenceMode() !== null;
}

export function setSupabaseSessionPersistence(rememberSession: boolean) {
  getLocalStorage()?.setItem(sessionPersistenceModeKey, rememberSession ? "local" : "session");
}

export function clearSupabaseSessionPersistence() {
  getLocalStorage()?.removeItem(sessionPersistenceModeKey);
}

export function clearSupabaseBrowserAuthStorage() {
  const keys = [
    supabaseBrowserStorageKey,
    `${supabaseBrowserStorageKey}-code-verifier`,
    `${supabaseBrowserStorageKey}-user`
  ];

  for (const key of keys) {
    supabaseBrowserStorage.removeItem(key);
  }
}
