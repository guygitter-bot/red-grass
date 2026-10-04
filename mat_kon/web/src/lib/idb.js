// אחסון גדול במכשיר (IndexedDB) – ל-localStorage יש רק כ-5MB, ומתכונים עם תמונות ממלאים אותו
const DB = 'matkon';
const STORE = 'kv';

let db;
function open() {
  if (db) return db;
  db = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      db = null;
      reject(req.error);
    };
  });
  return db;
}

async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const idbGet = (key) => run('readonly', (s) => s.get(key));
export const idbSet = (key, value) => run('readwrite', (s) => s.put(value, key));
export const idbDel = (key) => run('readwrite', (s) => s.delete(key));
