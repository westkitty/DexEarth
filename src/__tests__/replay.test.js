import { describe, it, expect, vi } from 'vitest'
import {
  ReplayController,
  parseReplay,
  MAX_REPLAY_EVENTS,
  EXTERNAL_LIMITATION,
} from '../state/replay.js'
import { workspace } from './fixtures/workspace.js'
describe('local replay', () => {
  function setup() {
    let now = 1000
    const apply = vi.fn()
    const r = new ReplayController({ capture: workspace, apply, now: () => now })
    return {
      r,
      apply,
      advance: n => {
        now += n
      },
    }
  }
  it('records stable order even with identical offsets; scrub resolves the last key state', () => {
    const { r, advance, apply } = setup()
    r.start()
    advance(100)
    r.record({ type: 'camera', category: 'LOCAL INTERACTION' })
    r.record({ type: 'seismic', category: 'LOCAL SIMULATION' })
    r.stop()
    expect(r.session.events.map(e => e.seq)).toEqual([0, 1, 2])
    expect(parseReplay(JSON.stringify(r.session))).toEqual(r.session)
    r.scrub(100)
    expect(apply).toHaveBeenLastCalledWith(workspace(), 0)
    expect(r.session.externalData).toBe('references-only')
    expect(EXTERNAL_LIMITATION).toContain('unavailable')
  })
  it('pause, step, speed, reset and backwards scrub do not accumulate actions', () => {
    const { r, advance, apply } = setup()
    r.start()
    advance(1000)
    r.record({ type: 'camera', category: 'LOCAL INTERACTION' })
    advance(1000)
    r.stop()
    r.play()
    advance(500)
    r.tick()
    expect(r.position).toBe(500)
    r.pause()
    advance(500)
    r.tick()
    expect(r.position).toBe(500)
    r.step()
    expect(r.position).toBe(1000)
    r.step(-1)
    expect(r.position).toBe(0)
    r.setSpeed(2)
    r.play()
    advance(500)
    r.tick()
    expect(r.position).toBe(1000)
    r.reset()
    expect(r.position).toBe(0)
    expect(apply).toHaveBeenLastCalledWith(workspace(), 0)
  })
  it('stops recording at time and event bounds', () => {
    const { r, advance } = setup()
    r.start()
    for (let n = 0; n < MAX_REPLAY_EVENTS + 5; n++)
      r.record({ type: 'camera', category: 'LOCAL INTERACTION' })
    expect(r.session.events).toHaveLength(MAX_REPLAY_EVENTS)
    expect(r.recording).toBe(false)
    r.start()
    advance(31 * 60000)
    r.tick()
    expect(r.recording).toBe(false)
    expect(r.session.duration).toBe(30 * 60000)
  })
  it('refuses invalid ordering and forged historical data modes', () => {
    const { r } = setup()
    r.start()
    r.stop()
    const s = structuredClone(r.session)
    s.events[0].seq = 9
    expect(() => parseReplay(JSON.stringify(s))).toThrow()
    s.events[0].seq = 0
    s.externalData = 'live-history'
    expect(() => parseReplay(JSON.stringify(s))).toThrow()
  })
})
