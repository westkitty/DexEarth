import { ReplayController } from './replay.js'
import { captureWorkspace, applyWorkspace } from './workspace.js'
const listeners = new Set()
export const replay = new ReplayController({
  capture: captureWorkspace,
  apply: (w, elapsed) => applyWorkspace(w, { replay: true, elapsed }),
  onChange: () => listeners.forEach(fn => fn()),
})
export function subscribeReplay(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
