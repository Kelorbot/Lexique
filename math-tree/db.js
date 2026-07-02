// Petite couche IndexedDB : trois magasins — branches, entries, images.
// Pas de dépendance externe, juste des promesses autour de l'API native.

const DB_NAME = 'math-tree-db';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('branches')) {
        db.createObjectStore('branches', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('entries')) {
        db.createObjectStore('entries', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('images')) {
        db.createObjectStore('images', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, storeNames, mode) {
  return db.transaction(storeNames, mode);
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const MathTreeDB = {
  _dbPromise: null,

  get db() {
    if (!this._dbPromise) this._dbPromise = openDB();
    return this._dbPromise;
  },

  async getAll(store) {
    const db = await this.db;
    const t = tx(db, [store], 'readonly');
    return reqToPromise(t.objectStore(store).getAll());
  },

  async get(store, id) {
    const db = await this.db;
    const t = tx(db, [store], 'readonly');
    return reqToPromise(t.objectStore(store).get(id));
  },

  async put(store, value) {
    const db = await this.db;
    const t = tx(db, [store], 'readwrite');
    t.objectStore(store).put(value);
    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve(value);
      t.onerror = () => reject(t.error);
    });
  },

  async delete(store, id) {
    const db = await this.db;
    const t = tx(db, [store], 'readwrite');
    t.objectStore(store).delete(id);
    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  },

  async clearAll() {
    const db = await this.db;
    const t = tx(db, ['branches', 'entries', 'images'], 'readwrite');
    t.objectStore('branches').clear();
    t.objectStore('entries').clear();
    t.objectStore('images').clear();
    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  },
};
