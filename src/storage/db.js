// ─── IndexedDB Wrapper ───────────────────────────────────────────────────────
// Thin promise-based wrapper. Versioned schema with structured stores.

const DB_NAME = 'dexearth'
export const DB_VERSION = 3

const STORES = {
  cache: 'cache', // key-value for TLE cache etc.
  markers: 'markers',
  geofences: 'geofences',
  alertLog: 'alertLog',
  audit: 'audit', // System audit log
  savedViews: 'savedViews', // Saved camera/layer states
  observations: 'observations',
  watchlist: 'watchlist',
  replays: 'replays',
  preferences: 'preferences',
  scenarios: 'scenarios', // Saved operational snapshots
}

let _db = null
let _opening = null

function _open() {
  if (_db) return Promise.resolve(_db)
  if (_opening) return _opening
  _opening = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const db = e.target.result
      for (const name of ['observations', 'watchlist', 'replays', 'preferences']) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
      }
      // v2 saved views were incorrectly stored alongside disposable remote cache.
      if (e.oldVersion > 0 && e.oldVersion < 3 && db.objectStoreNames.contains('cache')) {
        const cache = e.target.transaction.objectStore('cache')
        const prefs = e.target.transaction.objectStore('preferences')
        for (const key of ['viewStore:home', 'viewStore:savedViews']) {
          const request = cache.get(key)
          request.onsuccess = () => {
            if (request.result) {
              prefs.put({ id: key, value: request.result.value })
              cache.delete(key)
            }
          }
        }
      }
      if (!db.objectStoreNames.contains(STORES.cache)) {
        db.createObjectStore(STORES.cache, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORES.markers)) {
        db.createObjectStore(STORES.markers, { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains(STORES.geofences)) {
        db.createObjectStore(STORES.geofences, { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains(STORES.alertLog)) {
        db.createObjectStore(STORES.alertLog, { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains(STORES.audit)) {
        db.createObjectStore(STORES.audit, { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains(STORES.savedViews)) {
        db.createObjectStore(STORES.savedViews, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.scenarios)) {
        db.createObjectStore(STORES.scenarios, { keyPath: 'id' })
      }
    }
    req.onsuccess = e => {
      _db = e.target.result
      _db.onversionchange = () => {
        _db.close()
        _db = null
        _opening = null
      }
      resolve(_db)
    }
    req.onerror = e => {
      _opening = null
      reject(e.target.error)
    }
  })
  return _opening
}

function _tx(storeName, mode = 'readonly') {
  return _open().then(db => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    return store
  })
}

function _promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = e => reject(e.target.error)
  })
}

// Read count/existence and write in ONE readwrite transaction. IndexedDB
// serializes overlapping transactions, including those from other tabs.
async function writeBounded(storeName, record, limit, addOnly = false) {
  const snapshot = structuredClone(record)
  const objectStore = await _tx(storeName, 'readwrite')
  return new Promise((resolve, reject) => {
    const tx = objectStore.transaction
    let failure, result
    tx.oncomplete = () => resolve(addOnly ? result : snapshot)
    tx.onerror = tx.onabort = () =>
      reject(failure || tx.error || new Error('Storage transaction aborted'))
    const write = () => {
      const request = addOnly ? objectStore.add(snapshot) : objectStore.put(snapshot)
      request.onsuccess = () => {
        result = request.result
      }
    }
    const checkCount = () => {
      const count = objectStore.count()
      count.onsuccess = () => {
        if (count.result >= limit) {
          failure = new Error(
            `Limit: ${limit} ${storeName} records; delete a record before adding another`
          )
          tx.abort()
        } else write()
      }
    }
    if (!Number.isFinite(limit)) write()
    else if (addOnly) checkCount()
    else {
      const existing = objectStore.get(snapshot.id)
      existing.onsuccess = () => {
        if (existing.result !== undefined) write()
        else checkCount()
      }
    }
  })
}

// ── cache store ──────────────────────────────────────────────────────────────

export async function cacheGet(key) {
  const store = await _tx(STORES.cache)
  return _promisify(store.get(key))
}

export async function cacheSet(key, value) {
  const store = await _tx(STORES.cache, 'readwrite')
  return _promisify(store.put({ key, value }))
}

export async function cacheDelete(key) {
  const store = await _tx(STORES.cache, 'readwrite')
  return _promisify(store.delete(key))
}

export async function cacheDel(key) {
  const store = await _tx(STORES.cache, 'readwrite')
  return _promisify(store.delete(key))
}

// ── markers store ─────────────────────────────────────────────────────────────

export async function markersGetAll() {
  const store = await _tx(STORES.markers)
  return _promisify(store.getAll())
}

export async function markerAdd(marker) {
  return writeBounded(STORES.markers, { ...marker, createdAt: Date.now() }, 500, true)
}

export async function markerUpdate(marker) {
  const store = await _tx(STORES.markers, 'readwrite')
  return _promisify(store.put(marker))
}

export async function markerDelete(id) {
  const store = await _tx(STORES.markers, 'readwrite')
  return _promisify(store.delete(id))
}

// ── geofences store ───────────────────────────────────────────────────────────

export async function geofencesGetAll() {
  const store = await _tx(STORES.geofences)
  return _promisify(store.getAll())
}

export async function geofenceAdd(gf) {
  const store = await _tx(STORES.geofences, 'readwrite')
  return _promisify(store.add({ ...gf, createdAt: Date.now() }))
}

export async function geofenceDelete(id) {
  const store = await _tx(STORES.geofences, 'readwrite')
  return _promisify(store.delete(id))
}

// ── alertLog store ────────────────────────────────────────────────────────────

export async function alertLogGetAll() {
  const store = await _tx(STORES.alertLog)
  return _promisify(store.getAll())
}

export async function alertLogAdd(entry) {
  const store = await _tx(STORES.alertLog, 'readwrite')
  // Preserve caller-provided timeMs; fall back to now
  const record = { ...entry, timeMs: entry.timeMs ?? Date.now() }
  return _promisify(store.add(record))
}

export async function alertLogClear() {
  const store = await _tx(STORES.alertLog, 'readwrite')
  return _promisify(store.clear())
}

// ── audit store ───────────────────────────────────────────────────────────────

export async function auditGetAll() {
  const store = await _tx(STORES.audit)
  return _promisify(store.getAll())
}

export async function auditAdd(entry) {
  const store = await _tx(STORES.audit, 'readwrite')
  return _promisify(store.add(entry))
}

export async function auditClear() {
  const store = await _tx(STORES.audit, 'readwrite')
  return _promisify(store.clear())
}

// ── savedViews store ─────────────────────────────────────────────────────────

export async function viewSave(view) {
  const store = await _tx(STORES.savedViews, 'readwrite')
  return _promisify(store.put(view))
}

export async function viewsGetAll() {
  const store = await _tx(STORES.savedViews)
  return _promisify(store.getAll())
}

export async function viewDelete(id) {
  const store = await _tx(STORES.savedViews, 'readwrite')
  return _promisify(store.delete(id))
}

// User-authored stores can never be passed through remote-cache eviction APIs.
const USER_STORES = new Set(['observations', 'watchlist', 'replays', 'preferences'])
export async function userRecords(store) {
  if (!USER_STORES.has(store)) throw new Error('Not a user store')
  return _promisify((await _tx(store)).getAll())
}
export async function userPut(store, record) {
  if (!USER_STORES.has(store)) throw new Error('Not a user store')
  const limits = { observations: 100, watchlist: 100, replays: 20 }
  return writeBounded(store, record, limits[store] ?? Infinity)
}
export async function userDelete(store, id) {
  if (!USER_STORES.has(store)) throw new Error('Not a user store')
  return _promisify((await _tx(store, 'readwrite')).delete(id))
}
export async function cacheGetAll() {
  return _promisify((await _tx(STORES.cache)).getAll())
}
