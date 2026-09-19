import { orbitalFacts } from '../layers/satellites/orbital.js'
import { userRecords, userPut, userDelete } from '../storage/db.js'
import { emitSessionEvent } from './sessionEvents.js'
const listeners = new Set()
let state = {
  selectedId: null,
  watchSubset: null,
  watchlist: [],
  observer: null,
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
  const range = ranges[key]
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
export async function initWatchlist() {
  const [watchlist, preferences] = await Promise.all([
    userRecords('watchlist'),
    userRecords('preferences'),
  ])
  updateOrbit({ watchlist, observer: preferences.find(p => p.id === 'observer')?.value || null })
}
export async function saveObserver(observer) {
  await userPut('preferences', { id: 'observer', value: observer })
  updateOrbit({ observer })
}
export async function watchSatellite(record, nickname = '') {
  if (
    state.watchlist.length >= 100 &&
    !state.watchlist.some(w => w.id === String(record.satrec.satnum))
  )
    throw new Error('Watchlist limited to 100 satellites')
  const item = {
    id: String(record.satrec.satnum),
    name: record.name,
    nickname: nickname.slice(0, 100),
    record,
    savedAt: Date.now(),
  }
  await userPut('watchlist', item)
  updateOrbit({
    watchSubset: null,
    watchlist: [...state.watchlist.filter(w => w.id !== item.id), item],
  })
}
export async function unwatchSatellite(id) {
  await userDelete('watchlist', id)
  updateOrbit({ watchlist: state.watchlist.filter(w => w.id !== id) })
}

// Only advance stored elements when the incoming TLE epoch is newer; never stamp
// an old TLE as newly observed just because the panel was opened.
export async function refreshWatchedElements(records) {
  const incoming = new Map(records.map(record => [String(record.satrec.satnum), record]))
  const changed = []
  for (const item of state.watchlist) {
    const record = incoming.get(item.id)
    if (record && orbitalFacts(record)?.epochMs > (orbitalFacts(item.record)?.epochMs || 0)) {
      const next = { ...item, record }
      await userPut('watchlist', next)
      changed.push(next)
    }
  }
  if (changed.length)
    updateOrbit({ watchlist: state.watchlist.map(w => changed.find(c => c.id === w.id) || w) })
}
