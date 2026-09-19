import { validWatchedRecord, validWatchItem, validObserver } from './watchlistValidation.js'
import { orbitalFacts } from '../layers/satellites/orbital.js'
import { userRecords, userPut, userUpdate, userDelete } from '../storage/db.js'
import { emitSessionEvent } from './sessionEvents.js'
const listeners = new Set()
let state = {
  selectedId: null,
  watchSubset: null,
  watchlist: [],
  observer: null,
  storageWarning: '',
  filters: {
    search: '',
    orbit: 'ALL',
    minAlt: 0,
    maxAlt: 100000,
    minInclination: 0,
    maxInclination: 180,
    watchedOnly: false,
  },
  minutes: 90,
  showPath: true,
  showGround: true,
}
export function getOrbitState() {
  return state
}
export function subscribeOrbit(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export function updateOrbit(patch) {
  state = { ...state, ...patch }
  listeners.forEach(fn => fn(state))
  emitSessionEvent('orbit', {
    selectedId: state.selectedId,
    filters: state.filters,
    minutes: state.minutes,
    showPath: state.showPath,
    showGround: state.showGround,
  })
}
// UI edits must remain a valid workspace between keystrokes: replay captures
// each emitted state, not only the final range after both endpoints are edited.
export function updateOrbitFilter(key, value) {
  const filters = { ...state.filters }
  const ranges = {
    minAlt: [0, 100000, 'maxAlt'],
    maxAlt: [0, 100000, 'minAlt'],
    minInclination: [0, 180, 'maxInclination'],
    maxInclination: [0, 180, 'minInclination'],
  }
  const range = Object.hasOwn(ranges, key) ? ranges[key] : null
  if (range) {
    if (!Number.isFinite(value)) return
    const [min, max, other] = range
    filters[key] = Math.max(min, Math.min(max, value))
    filters[other] = key.startsWith('min')
      ? Math.max(filters[other], filters[key])
      : Math.min(filters[other], filters[key])
  } else if (key === 'search' && typeof value === 'string') filters.search = value.slice(0, 100)
  else if (key === 'orbit' && ['ALL', 'LEO', 'MEO', 'GEO', 'OTHER'].includes(value))
    filters.orbit = value
  else if (key === 'watchedOnly' && typeof value === 'boolean') filters.watchedOnly = value
  else return
  updateOrbit({ filters })
}
let watchQueue = Promise.resolve()
function queueWatch(task) {
  const pending = watchQueue.then(task)
  watchQueue = pending.catch(() => {})
  return pending
}
async function reloadWatchlist() {
  const [rows, preferences] = await Promise.all([
    userRecords('watchlist'),
    userRecords('preferences'),
  ])
  const watchlist = rows.filter(validWatchItem).slice(0, 100)
  const savedObserver = preferences.find(p => p.id === 'observer')?.value
  const observer = validObserver(savedObserver) ? savedObserver : null
  const omitted = rows.length - watchlist.length + (savedObserver != null && !observer ? 1 : 0)
  updateOrbit({
    watchlist,
    observer,
    storageWarning: omitted
      ? `${omitted} saved watchlist/observer record(s) not loaded: invalid or over the display limit. Original records remain in local storage.`
      : '',
  })
}
export function initWatchlist() {
  return queueWatch(reloadWatchlist)
}
export async function saveObserver(observer) {
  if (!validObserver(observer)) throw new Error('Invalid observer coordinates or name')
  const value = structuredClone(observer)
  return queueWatch(async () => {
    await userPut('preferences', { id: 'observer', value })
    await reloadWatchlist()
  })
}
export async function watchSatellite(record, nickname = '') {
  if (!validWatchedRecord(record) || typeof nickname !== 'string')
    throw new Error('Invalid satellite or nickname')
  const incoming = structuredClone(record),
    id = String(record.satrec.satnum)
  return queueWatch(async () => {
    await userUpdate('watchlist', id, previous => {
      const chosen =
        validWatchedRecord(previous?.record) &&
        orbitalFacts(previous.record).epochMs > orbitalFacts(incoming).epochMs
          ? previous.record
          : incoming
      return {
        id,
        name: chosen.name,
        nickname: nickname.slice(0, 100),
        record: chosen,
        savedAt: Number.isFinite(previous?.savedAt) ? previous.savedAt : Date.now(),
      }
    })
    updateOrbit({ watchSubset: null })
    await reloadWatchlist()
  })
}
export function unwatchSatellite(id) {
  return queueWatch(async () => {
    await userDelete('watchlist', id)
    await reloadWatchlist()
  })
}

// Compare against the persisted row inside the write transaction, not a stale
// UI copy. Preserve concurrent nickname changes and never recreate deletions.
export function refreshWatchedElements(records) {
  const incoming = new Map()
  for (const record of records) {
    if (!validWatchedRecord(record)) continue
    const id = String(record.satrec.satnum),
      previous = incoming.get(id)
    if (!previous || orbitalFacts(record).epochMs > orbitalFacts(previous).epochMs)
      incoming.set(id, structuredClone(record))
  }
  return queueWatch(async () => {
    for (const item of await userRecords('watchlist')) {
      const record = incoming.get(item.id)
      if (!record) continue
      await userUpdate('watchlist', item.id, previous => {
        if (
          !previous ||
          !validWatchItem(previous) ||
          orbitalFacts(record).epochMs <= orbitalFacts(previous.record).epochMs
        )
          return undefined
        return { ...previous, record }
      })
    }
    await reloadWatchlist()
  })
}
