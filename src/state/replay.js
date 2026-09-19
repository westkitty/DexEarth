import { validateWorkspace, MAX_IMPORT_BYTES } from '../storage/observations.js'
export const MAX_REPLAY_EVENTS = 600
export const MAX_REPLAY_MS = 30 * 60 * 1000
export const EXTERNAL_LIMITATION =
  'Historical remote state unavailable. Dataset references are not retained snapshots. Orbital positions use currently loaded or locally watchlisted TLEs, not historical telemetry.'
export function validateReplay(s) {
  if (
    s?.format !== 'DexEarth.Replay' ||
    s.version !== 1 ||
    typeof s.id !== 'string' ||
    !s.id ||
    s.id.length > 100 ||
    typeof s.name !== 'string' ||
    s.name.length > 160 ||
    !Number.isFinite(s.startedAt) ||
    !Number.isFinite(s.duration) ||
    s.duration < 0 ||
    s.duration > MAX_REPLAY_MS ||
    s.externalData !== 'references-only' ||
    !Array.isArray(s.events) ||
    !s.events.length ||
    s.events.length > MAX_REPLAY_EVENTS
  )
    throw new Error('Invalid replay format or bounds')
  let last = -1
  s.events.forEach((e, i) => {
    if (
      !e ||
      e.seq !== i ||
      !Number.isFinite(e.offset) ||
      e.offset < last ||
      e.offset > s.duration ||
      typeof e.type !== 'string' ||
      ![
        'LOCAL INTERACTION',
        'LOCAL SIMULATION',
        'REMOTE OBSERVATION',
        'DATA PROVENANCE',
        'LOCAL PREDICTION',
      ].includes(e.category)
    )
      throw new Error('Invalid replay event ordering')
    validateWorkspace(e.workspace)
    last = e.offset
  })
  if (s.events[0].offset !== 0 || new Blob([JSON.stringify(s)]).size > MAX_IMPORT_BYTES)
    throw new Error('Replay exceeds size limit or has no initial state')
  return s
}
export function parseReplay(text) {
  if (new Blob([text]).size > MAX_IMPORT_BYTES) throw new Error('Import exceeds 8 MiB')
  return validateReplay(JSON.parse(text))
}
// Full local key states make backwards scrub idempotent (no duplicate actions).
export class ReplayController {
  constructor({ capture, apply, now = () => Date.now(), onChange = () => {} }) {
    Object.assign(this, {
      capture,
      apply,
      now,
      onChange,
      session: null,
      recording: false,
      playing: false,
      position: 0,
      cursor: -1,
      speed: 1,
      bytes: 0,
    })
  }
  start(name = 'Local session') {
    this.pause()
    this.recording = true
    this.position = 0
    this.cursor = -1
    this.bytes = 0
    this.session = {
      format: 'DexEarth.Replay',
      version: 1,
      id: crypto.randomUUID(),
      name,
      startedAt: this.now(),
      duration: 0,
      externalData: 'references-only',
      events: [],
    }
    try {
      this.record({ type: 'start', category: 'LOCAL INTERACTION' })
      if (!this.session.events.length)
        throw new Error('Initial workspace exceeds the replay size limit')
    } catch (error) {
      this.recording = false
      this.session = null
      this.onChange()
      throw error
    }
  }
  record(event) {
    if (!this.recording) return
    const offset =
      this.session.events.length === 0
        ? 0
        : Math.max(this.session.events.at(-1).offset, this.now() - this.session.startedAt)
    const workspace = structuredClone(this.capture())
    validateWorkspace(workspace)
    const entry = {
      seq: this.session.events.length,
      offset,
      type: event.type,
      category: event.category,
      workspace,
    }
    const bytes = new Blob([JSON.stringify(entry)]).size
    if (
      offset > MAX_REPLAY_MS ||
      this.session.events.length >= MAX_REPLAY_EVENTS ||
      this.bytes + bytes > MAX_IMPORT_BYTES - 4096
    ) {
      this.stop()
      return
    }
    this.bytes += bytes
    this.session.events.push(entry)
    this.session.duration = offset
    this.onChange()
  }
  stop() {
    if (this.recording)
      this.session.duration = Math.min(
        MAX_REPLAY_MS,
        Math.max(this.session.duration, this.now() - this.session.startedAt)
      )
    this.recording = false
    this.onChange()
    return this.session
  }
  load(s) {
    const validated = validateReplay(structuredClone(s))
    this.pause()
    this.recording = false
    this.session = validated
    this.scrub(0)
  }
  scrub(ms, continuous = false) {
    if (!this.session || this.recording || !Number.isFinite(ms)) return
    this.position = Math.max(0, Math.min(this.session.duration, ms))
    const e = this.session.events.findLast(e => e.offset <= this.position)
    this.cursor = e?.seq ?? -1
    if (e) {
      if (continuous)
        this.apply(structuredClone(e.workspace), this.position - e.offset, { continuous: true })
      else this.apply(structuredClone(e.workspace), this.position - e.offset)
    }
    this.onChange()
  }
  step(direction = 1) {
    this.pause()
    if (!this.session || this.recording) return
    const events = this.session.events
    const index = Math.max(0, Math.min(events.length - 1, this.cursor + (direction > 0 ? 1 : -1)))
    const event = events[index]
    this.cursor = index
    this.position = event.offset
    this.apply(structuredClone(event.workspace), 0)
    this.onChange()
  }

  play() {
    if (!this.session || this.recording) return
    this.playing = true
    this.lastWall = this.now()
    this.onChange()
  }
  pause() {
    this.playing = false
    this.onChange()
  }
  tick() {
    if (this.recording && this.now() - this.session.startedAt >= MAX_REPLAY_MS) this.stop()
    if (!this.playing) return
    const wall = this.now(),
      next = this.position + Math.max(0, wall - this.lastWall) * this.speed
    this.lastWall = wall
    this.scrub(next, true)
    if (this.position >= this.session.duration) this.pause()
  }
  setSpeed(n) {
    this.speed = Math.max(0.25, Math.min(16, Number(n) || 1))
    this.onChange()
  }
  reset() {
    this.pause()
    if (!this.session || this.recording) return
    this.cursor = -1
    this.step(1)
  }
}
