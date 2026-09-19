import { userPut } from './db.js'
import { validateReplay } from '../state/replay.js'

// Acknowledges only committed writes. One pending write, bounded retry cadence;
// a failed full/quota-limited store can recover after the user frees space.
export function createReplayAutosave({
  write = session => userPut('replays', session),
  now = () => Date.now(),
  onError = () => {},
  onSaved = () => {},
} = {}) {
  let savedId = null,
    pending = false,
    failedId = null,
    retryAt = 0
  return async function autosave(session, recording = false) {
    if (!session || recording || pending || session.id === savedId) return
    if (session.id === failedId && now() < retryAt) return
    pending = true
    const id = session.id
    try {
      const snapshot = validateReplay(structuredClone(session))
      await write(snapshot)
      savedId = id
      failedId = null
      onSaved(id)
    } catch (error) {
      failedId = id
      retryAt = now() + 5000
      onError(error)
    } finally {
      pending = false
    }
  }
}
