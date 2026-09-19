import { useEffect, useState } from 'react'
import { captureWorkspace, loadObservationView } from '../../../state/workspace.js'
import {
  createObservation,
  saveObservation,
  listObservations,
  deleteObservation,
  parseObservation,
  downloadJson,
  MAX_IMPORT_BYTES,
} from '../../../storage/observations.js'
import { markersGetAll } from '../../../storage/db.js'
export default function ObservationsPanel() {
  const [rows, setRows] = useState([]),
    [name, setName] = useState('Observation'),
    [notes, setNotes] = useState(''),
    [error, setError] = useState('')
  const refresh = () => listObservations().then(setRows)
  useEffect(() => {
    refresh().catch(e => setError(e.message))
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
  return (
    <section className="analysis-panel" aria-label="Observation sets">
      <h3>Local observation sets</h3>
      <p>
        Restores a view and configuration, not external reality. Data timestamps remain unchanged.
        Marker snapshots are displayed without deleting your saved markers.
      </p>
      <label>
        Name <input value={name} maxLength={160} onChange={e => setName(e.target.value)} />
      </label>
      <label>
        Notes <textarea value={notes} maxLength={10000} onChange={e => setNotes(e.target.value)} />
      </label>
      <button
        onClick={() =>
          run(async () => {
            const w = captureWorkspace()
            w.markers = await markersGetAll()
            await saveObservation(createObservation(name, w, notes))
          })
        }
      >
        Save Observation
      </button>
      <label className="file-control">
        Import observation JSON
        <input
          type="file"
          accept=".json"
          onChange={e => {
            const file = e.target.files[0]
            if (file)
              run(async () => {
                if (file.size > MAX_IMPORT_BYTES) throw new Error('Import exceeds 8 MiB')
                const o = parseObservation(await file.text())
                await saveObservation({ ...o, id: crypto.randomUUID() })
              })
            e.target.value = ''
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {rows.map(row => (
        <article key={row.id}>
          <strong>{row.name}</strong>
          <p>{row.notes}</p>
          <small>{new Date(row.updatedAt).toLocaleString()}</small>
          <div className="actions">
            <button onClick={() => run(() => loadObservationView(row))}>Load</button>
            <button
              onClick={() =>
                run(() =>
                  saveObservation(
                    createObservation(`${row.name.slice(0, 150)} copy`, row.workspace, row.notes)
                  )
                )
              }
            >
              Duplicate
            </button>
            <button
              onClick={() => {
                const value = prompt('Rename observation', row.name)
                if (value)
                  run(() => saveObservation({ ...row, name: value, updatedAt: Date.now() }))
              }}
            >
              Rename
            </button>
            <button onClick={() => downloadJson(row, 'dexearth-observation.json')}>
              Export JSON
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete observation “${row.name}”?`))
                  run(() => deleteObservation(row.id))
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
