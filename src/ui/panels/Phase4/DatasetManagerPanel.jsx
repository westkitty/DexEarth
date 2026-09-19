import { useEffect, useState } from 'react'
import { getRegisteredDatasets } from '../../../data/datasetRegistry.js'
import { datasetState, getActiveDataset } from '../../../data/datasetStatus.js'
import {
  inspectCache,
  deleteCached,
  clearRemoteCache,
  lastFetched,
  fetchedTimestamp,
  pinDataset,
  unpinDataset,
} from '../../../storage/cache.js'
const datasets = [
  {
    id: 'globe',
    name: 'Natural Earth II globe',
    bundledUrl: '/cesium/Assets/Textures/NaturalEarthII',
    cacheTtlMs: Infinity,
  },
  ...getRegisteredDatasets(),
]
export default function DatasetManagerPanel() {
  const [rows, setRows] = useState([]),
    [error, setError] = useState('')
  async function refresh() {
    try {
      setRows(await inspectCache())
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => {
    let alive = true
    const load = () =>
      inspectCache()
        .then(rows => {
          if (alive) setRows(rows)
        })
        .catch(e => {
          if (alive) setError(e.message)
        })
    load()
    const t = setInterval(load, 5000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])
  async function run(fn) {
    try {
      await fn()
      await refresh()
    } catch (e) {
      setError(e.message)
    }
  }
  return (
    <section className="analysis-panel">
      <h3>Offline data catalog</h3>
      <p>
        Remote cache ≤32 MiB / 24 records. Retention pins do not extend freshness and may be evicted
        at the hard limit. Clearing cache never deletes watchlists, markers, saved views,
        observations or replays.
      </p>
      <p>
        Cached: {rows.length} records ·{' '}
        {(rows.reduce((n, r) => n + (r.value.bytes || 0), 0) / 1048576).toFixed(2)} MiB
      </p>
      <button
        onClick={() => {
          if (
            confirm(
              'Clear remote-data cache? User-authored records will remain. Active memory data stays until reload.'
            )
          )
            run(clearRemoteCache)
        }}
      >
        Clear remote-data cache
      </button>
      {datasets.map(ds => {
        const row = rows.find(r => r.key === ds.id),
          active = getActiveDataset(ds.id),
          record = active || row?.value
        return (
          <article key={ds.id}>
            <strong>{ds.name}</strong>
            <p>
              {datasetState(record)} · {active ? 'active origin' : 'stored only / not loaded'}:{' '}
              {record?.origin || record?.source || 'none'}
            </p>
            <p>
              Source: {ds.remoteUrl ? ds.name : 'bundled local assets'}
              <br />
              Fetch: {fetchedTimestamp(record?.fetchedAt)} · Age: {lastFetched(record?.fetchedAt)}
              <br />
              TTL:{' '}
              {Number.isFinite(ds.cacheTtlMs)
                ? `${ds.cacheTtlMs / 3600000} h`
                : 'static / no expiry'}{' '}
              · Bundle fallback: {ds.bundledUrl ? 'yes' : 'no'}
            </p>
            {row && (
              <div className="actions">
                <button onClick={() => run(() => deleteCached(ds.id))}>
                  Clear this dataset cache
                </button>
                <button
                  onClick={() =>
                    run(() => (row.value.pinned ? unpinDataset(ds.id) : pinDataset(ds.id)))
                  }
                >
                  {row.value.pinned ? 'Unpin retention' : 'Prefer retention'}
                </button>
              </div>
            )}
          </article>
        )
      })}
      <p>
        Bundled assets work with a local server without internet. After the production app reports
        “offline assets ready”, a previously visited deployment can also reload without a server
        connection. First-ever disconnected visit cannot download the app.
      </p>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
