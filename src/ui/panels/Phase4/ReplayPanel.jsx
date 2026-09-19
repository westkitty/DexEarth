import { useEffect, useState } from 'react'
import { replay, subscribeReplay } from '../../../state/sessionRuntime.js'
import { parseReplay, EXTERNAL_LIMITATION } from '../../../state/replay.js'
import { downloadJson, MAX_IMPORT_BYTES } from '../../../storage/observations.js'
import { userRecords, userDelete, userPut } from '../../../storage/db.js'
import { captureWorkspace, applyWorkspace } from '../../../state/workspace.js'
let beforeReplay = null
export default function ReplayPanel() {
  const [, update] = useState(0),
    [rows, setRows] = useState([]),
    [error, setError] = useState('')
  const refresh = () => userRecords('replays').then(setRows)
  useEffect(() => {
    refresh().catch(e => setError(e.message))
    return subscribeReplay(() => update(n => n + 1))
  }, [])
  async function run(fn) {
    try {
      setError('')
      await fn()
      await refresh()
    } catch (e) {
      setError(e.message)
    }
  }
  function load(s) {
    if (!beforeReplay) beforeReplay = captureWorkspace()
    replay.load(s)
  }
  function enterReplay() {
    if (!beforeReplay) beforeReplay = captureWorkspace()
  }
  const s = replay.session
  return (
    <section className="analysis-panel" aria-label="Local replay">
      <h3>Local interaction replay</h3>
      <p className="truth-warning">
        {EXTERNAL_LIMITATION} Remote aircraft, seismic and fire layers are hidden during replay.
      </p>
      <p>
        Bounded to 30 minutes, 600 key states, 8 MiB; at most 20 saved sessions. Camera positions
        are recorded at gesture end. Scrub restores local state, not camera animation.
      </p>
      <div className="actions">
        <button
          disabled={replay.recording}
          onClick={() =>
            run(() => {
              replay.start()
              beforeReplay = null
            })
          }
        >
          Start recording
        </button>
        <button
          disabled={!replay.recording}
          onClick={() =>
            run(async () => {
              const session = replay.stop()
              const stored = await userRecords('replays')
              if (stored.length >= 20 && !stored.some(r => r.id === session.id))
                throw new Error('20 replay limit: export/delete first')
              await userPut('replays', session)
            })
          }
        >
          Stop & save
        </button>
        <button
          disabled={!s || replay.recording}
          onClick={() =>
            run(() => {
              if (!beforeReplay) beforeReplay = captureWorkspace()
              replay.scrub(replay.position)
              replay.play()
            })
          }
        >
          Play
        </button>
        <button disabled={!replay.playing} onClick={() => replay.pause()}>
          Pause
        </button>
        <button
          disabled={!s || replay.recording}
          onClick={() =>
            run(() => {
              enterReplay()
              replay.step(-1)
            })
          }
        >
          Previous
        </button>
        <button
          disabled={!s || replay.recording}
          onClick={() =>
            run(() => {
              enterReplay()
              replay.step(1)
            })
          }
        >
          Step
        </button>
        <button
          disabled={!s || replay.recording}
          onClick={() =>
            run(() => {
              enterReplay()
              replay.reset()
            })
          }
        >
          Reset
        </button>
        <button
          disabled={!beforeReplay}
          onClick={() =>
            run(() => {
              replay.pause()
              applyWorkspace(beforeReplay)
              beforeReplay = null
            })
          }
        >
          Exit replay / restore view
        </button>
      </div>
      <label>
        Speed
        <select value={replay.speed} onChange={e => replay.setSpeed(+e.target.value)}>
          {[0.25, 0.5, 1, 2, 4, 8, 16].map(n => (
            <option key={n} value={n}>
              {n}×
            </option>
          ))}
        </select>
      </label>
      {s && (
        <>
          <p>
            {replay.recording ? 'RECORDING' : replay.playing ? 'PLAYING' : 'PAUSED'} ·{' '}
            {s.events.length} states · {(replay.position / 1000).toFixed(1)} /{' '}
            {(s.duration / 1000).toFixed(1)}s
          </p>
          <input
            aria-label="Replay scrub"
            type="range"
            min="0"
            max={s.duration || 1}
            value={replay.position}
            disabled={replay.recording}
            onChange={e => {
              if (!beforeReplay) beforeReplay = captureWorkspace()
              replay.pause()
              replay.scrub(+e.target.value)
            }}
          />
          <button onClick={() => downloadJson(s, 'dexearth-replay.json')}>Export replay</button>
        </>
      )}
      <label className="file-control">
        Import replay JSON
        <input
          type="file"
          accept=".json"
          disabled={replay.recording}
          onChange={e => {
            const file = e.target.files[0]
            if (file)
              run(async () => {
                if (file.size > MAX_IMPORT_BYTES) throw new Error('Import exceeds 8 MiB')
                load({ ...parseReplay(await file.text()), id: crypto.randomUUID() })
              })
            e.target.value = ''
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button onClick={() => run(refresh)}>Refresh saved sessions</button>
      {rows.map(row => (
        <article key={row.id}>
          <strong>{row.name}</strong> · {new Date(row.startedAt).toLocaleString()}
          <div className="actions">
            <button disabled={replay.recording} onClick={() => run(() => load(row))}>
              Load replay
            </button>
            <button onClick={() => downloadJson(row, 'dexearth-replay.json')}>Export</button>
            <button
              onClick={() => {
                if (confirm('Delete saved replay?')) run(() => userDelete('replays', row.id))
              }}
            >
              Delete
            </button>
          </div>
        </article>
      ))}
    </section>
  )
}
