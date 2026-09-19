import { describe, it, expect, vi } from 'vitest'
import { toggleDrawer, subscribeUiStore, setPanelOpen } from '../state/uiStore.js'
import { subscribeOrbit, updateOrbit, getOrbitState } from '../state/orbitStore.js'
import {
  subscribeSessionEvents,
  emitSessionEvent,
  withoutRecording,
} from '../state/sessionEvents.js'
describe('mobile and selection state subscriptions', () => {
  it('uses one drawer and closes a repeated selection', () => {
    expect(toggleDrawer({ data: true }, 'satellites')).toEqual({ satellites: true })
    expect(toggleDrawer({ satellites: true }, 'satellites')).toEqual({})
  })
  it('does not duplicate subscribers across remount/unsubscribe', () => {
    const fn = vi.fn()
    const a = subscribeUiStore(fn),
      b = subscribeUiStore(fn)
    setPanelOpen('test', true)
    expect(fn).toHaveBeenCalledTimes(1)
    a()
    b()
    setPanelOpen('test', false)
    expect(fn).toHaveBeenCalledTimes(1)
    const select = vi.fn(),
      unsub = subscribeOrbit(select)
    updateOrbit({ selectedId: '25544' })
    expect(getOrbitState().selectedId).toBe('25544')
    unsub()
    updateOrbit({ selectedId: null })
    expect(select).toHaveBeenCalledTimes(1)
  })
  it('suppresses replay-generated events instead of recording itself', () => {
    const fn = vi.fn(),
      unsub = subscribeSessionEvents(fn)
    withoutRecording(() => emitSessionEvent('camera', {}))
    expect(fn).not.toHaveBeenCalled()
    emitSessionEvent('seismic', {}, 'LOCAL SIMULATION')
    expect(fn.mock.calls[0][0].category).toBe('LOCAL SIMULATION')
    unsub()
  })
})
