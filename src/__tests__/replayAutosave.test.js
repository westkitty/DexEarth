import { describe, it, expect, vi } from 'vitest'
import { createReplayAutosave } from '../storage/replayAutosave.js'
import { ReplayController } from '../state/replay.js'
import { workspace } from './fixtures/workspace.js'
function session() {
  const r = new ReplayController({ capture: workspace, apply: vi.fn() })
  r.start()
  return r.stop()
}
describe('replay autosave acknowledgement and retry', () => {
  it('retries failed persistence after backoff, then skips already committed data', async () => {
    let time = 0
    const write = vi.fn().mockRejectedValueOnce(new Error('Quota')).mockResolvedValueOnce(),
      onError = vi.fn(),
      onSaved = vi.fn(),
      s = session()
    const save = createReplayAutosave({ write, now: () => time, onError, onSaved })
    await save(s)
    expect(onError).toHaveBeenCalledOnce()
    expect(onSaved).not.toHaveBeenCalled()
    time = 4999
    await save(s)
    expect(write).toHaveBeenCalledTimes(1)
    time = 5000
    await save(s)
    expect(write).toHaveBeenCalledTimes(2)
    expect(onSaved).toHaveBeenCalledWith(s.id)
    await save(s)
    expect(write).toHaveBeenCalledTimes(2)
  })
  it('coalesces timer ticks, snapshots input and acknowledges the actual pending session', async () => {
    let finish
    const write = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise(r => {
              finish = r
            })
        )
        .mockResolvedValue(),
      onSaved = vi.fn(),
      a = session(),
      b = session(),
      originalName = a.name
    const save = createReplayAutosave({ write, onSaved })
    const pending = save(a)
    a.name = 'Changed after the write started'
    await save(a)
    await save(b)
    expect(write).toHaveBeenCalledTimes(1)
    expect(write.mock.calls[0][0].name).toBe(originalName)
    finish()
    await pending
    expect(onSaved).toHaveBeenLastCalledWith(a.id)
    await save(b)
    expect(write).toHaveBeenCalledTimes(2)
    expect(onSaved).toHaveBeenLastCalledWith(b.id)
  })
  it('does not persist an active recording or invalid session', async () => {
    const write = vi.fn(),
      onError = vi.fn(),
      save = createReplayAutosave({ write, onError })
    await save(session(), true)
    await save(null)
    await save({ id: 'broken' })
    expect(write).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledOnce()
  })
})
