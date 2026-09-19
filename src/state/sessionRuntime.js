import { ReplayController } from './replay.js'
import { captureWorkspace, applyWorkspace } from './workspace.js'
const listeners = new Set()
export const replay = new ReplayController({
  capture: captureWorkspace,
  apply: (w, elapsed, { continuous = false } = {}) =>
    applyWorkspace(w, { replay: true, elapsed, continuous }),
  onChange: () => listeners.forEach(fn => fn()),
})
export function subscribeReplay(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
