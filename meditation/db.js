// Petite couche IndexedDB : stocke les pistes audio (blobs) et les presets de session.
// Aucun backend : tout reste dans le navigateur de l'utilisateur.

const DB_NAME = 'meditation-studio';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains('tracks')) {
        const store = idb.createObjectStore('tracks', { keyPath: 'id' });
        store.createIndex('addedAt', 'addedAt');
      }
      if (!idb.objectStoreNames.contains('presets')) {
        idb.createObjectStore('presets', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise = null;
function getDb() {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

function tx(storeName, mode) {
  return getDb().then((idb) => idb.transaction(storeName, mode).objectStore(storeName));
}

function wrapReq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const db = {
  async addTrack(track) {
    const store = await tx('tracks', 'readwrite');
    await wrapReq(store.add(track));
    return track;
  },
  async updateTrack(id, patch) {
    const store = await tx('tracks', 'readwrite');
    const existing = await wrapReq(store.get(id));
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    await wrapReq(store.put(updated));
    return updated;
  },
  async deleteTrack(id) {
    const store = await tx('tracks', 'readwrite');
    await wrapReq(store.delete(id));
  },
  async getAllTracks() {
    const store = await tx('tracks', 'readonly');
    const all = await wrapReq(store.getAll());
    return all.sort((a, b) => a.addedAt - b.addedAt);
  },
  async getTrack(id) {
    const store = await tx('tracks', 'readonly');
    return wrapReq(store.get(id));
  },
  async addPreset(preset) {
    const store = await tx('presets', 'readwrite');
    await wrapReq(store.add(preset));
    return preset;
  },
  async updatePreset(id, patch) {
    const store = await tx('presets', 'readwrite');
    const existing = await wrapReq(store.get(id));
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    await wrapReq(store.put(updated));
    return updated;
  },
  async deletePreset(id) {
    const store = await tx('presets', 'readwrite');
    await wrapReq(store.delete(id));
  },
  async getAllPresets() {
    const store = await tx('presets', 'readonly');
    const all = await wrapReq(store.getAll());
    return all.sort((a, b) => b.createdAt - a.createdAt);
  },
  async storageEstimate() {
    if (navigator.storage && navigator.storage.estimate) {
      try { return await navigator.storage.estimate(); } catch { return null; }
    }
    return null;
  },
};

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
