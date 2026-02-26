// ─── IndexedDB Wrapper ───────────────────────────────────────────────────────
// Thin promise-based wrapper. Versioned schema with structured stores.

const DB_NAME = 'dexearth'
const DB_VERSION = 1

const STORES = {
    cache: 'cache',       // key-value for TLE cache etc.
    markers: 'markers',
    geofences: 'geofences',
    alertLog: 'alertLog',
}

let _db = null

function _open() {
    if (_db) return Promise.resolve(_db)
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION)
        req.onupgradeneeded = e => {
            const db = e.target.result
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
        }
        req.onsuccess = e => { _db = e.target.result; resolve(_db) }
        req.onerror = e => reject(e.target.error)
    })
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

// ── cache store ──────────────────────────────────────────────────────────────

export async function cacheGet(key) {
    const store = await _tx(STORES.cache)
    return _promisify(store.get(key))
}

export async function cacheSet(key, value) {
    const store = await _tx(STORES.cache, 'readwrite')
    return _promisify(store.put({ key, value }))
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
    const store = await _tx(STORES.markers, 'readwrite')
    return _promisify(store.add({ ...marker, createdAt: Date.now() }))
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
    return _promisify(store.add({ ...entry, timeMs: Date.now() }))
}

export async function alertLogClear() {
    const store = await _tx(STORES.alertLog, 'readwrite')
    return _promisify(store.clear())
}
