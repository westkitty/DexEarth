import { useEffect, useState } from 'react'
import * as Cesium from 'cesium'
import { satellitesLayer } from '../../../layers/satellites/layer.js'
import { orbitalFacts, propagateRecord, predictPasses } from '../../../layers/satellites/orbital.js'
import {
  getOrbitState,
  subscribeOrbit,
  updateOrbit,
  updateOrbitFilter,
  watchSatellite,
  unwatchSatellite,
  saveObserver,
} from '../../../state/orbitStore.js'
import { markersGetAll } from '../../../storage/db.js'
import { getTimeMs } from '../../../state/timeController.js'
import * as settings from '../../../state/settingsStore.js'
import { emitSessionEvent } from '../../../state/sessionEvents.js'
const fmt = ms => new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
export default function SatellitesPanel({ viewer, toggleLayer }) {
  const [state, setState] = useState(getOrbitState),
    [, tick] = useState(0),
    [error, setError] = useState('')
  const [markers, setMarkers] = useState([]),
    [passes, setPasses] = useState([]),
    [busy, setBusy] = useState(false)
  const [lat, setLat] = useState(() => String(getOrbitState().observer?.lat ?? 40.7)),
    [lon, setLon] = useState(() => String(getOrbitState().observer?.lon ?? -74))
  const [nickname, setNickname] = useState(''),
    [remote, setRemote] = useState(!settings.get('satelliteUseBundled'))
  useEffect(() => {
    const a = subscribeOrbit(s => {
        setState(s)
        setPasses([])
      }),
      b = satellitesLayer.onTelemetry(() => tick(n => n + 1))
    markersGetAll()
      .then(setMarkers)
      .catch(e => setError(e.message))
    const timer = setInterval(() => tick(n => n + 1), 1000)
    return () => {
      a()
      b()
      clearInterval(timer)
    }
  }, [])
  const record = satellitesLayer.getSelected(),
    facts = orbitalFacts(record),
    p = record ? propagateRecord(record, getTimeMs()) : null
  const info = satellitesLayer.getCacheInfo(),
    active = satellitesLayer.isActive()
  const watched = state.watchlist.some(w => w.id === state.selectedId)
  const records = satellitesLayer
    .getRecords()
    .filter(
      r =>
        !state.filters.search ||
        `${r.name} ${r.satrec.satnum}`.toLowerCase().includes(state.filters.search.toLowerCase())
    )
  function filter(key, value) {
    updateOrbitFilter(key, value)
  }
  async function run(fn) {
    try {
      setError('')
      await fn()
    } catch (e) {
      setError(e.message)
    }
  }
  function predict(r = record) {
    if (!r || !state.observer) return
    setBusy(true)
    setTimeout(() => {
      try {
        const result = predictPasses(r, state.observer, getTimeMs())
        setPasses(result)
        if (!result.length)
          setError('No pass above 10° in the next 24 hours (or propagation unavailable).')
        result
          .slice(0, 3)
          .forEach(pass =>
            emitSessionEvent('orbital-pass', { ...pass, name: pass.name }, 'LOCAL PREDICTION')
          )
      } finally {
        setBusy(false)
      }
    }, 0)
  }
  return (
    <section className="analysis-panel" aria-label="Satellite inspector">
      <div className="actions">
        <button
          onClick={() =>
            run(() =>
              toggleLayer
                ? toggleLayer('ORBITAL_MATH')
                : active
                  ? satellitesLayer.deactivate()
                  : satellitesLayer.activate({ viewer })
            )
          }
        >
          {active ? 'Deactivate satellites' : 'Activate satellites'}
        </button>
        <button disabled={!active} onClick={() => run(() => satellitesLayer.refresh())}>
          Refresh TLE
        </button>
      </div>
      <p>
        <strong>{info.state}</strong> · Origin: {info.source || 'none'} · fetched:{' '}
        {info.lastFetchedStr} · expiry: {info.expiresInStr}
      </p>
      <p>
        SGP4-derived positions, not live telemetry. Bundled starter elements are unverified
        historical fallback data.
      </p>
      <label>
        <input
          type="checkbox"
          checked={remote}
          onChange={e => {
            setRemote(e.target.checked)
            settings.set('satelliteUseBundled', !e.target.checked)
          }}
        />
        Attempt remote TLE on next refresh (optional)
      </label>
      <details>
        <summary>Satellite filters / display cap</summary>
        <label>
          Search name / catalog ID
          <input
            value={state.filters.search}
            maxLength={100}
            onChange={e => filter('search', e.target.value)}
          />
        </label>
        <div className="actions">
          <label>
            Shell
            <select value={state.filters.orbit} onChange={e => filter('orbit', e.target.value)}>
              {['ALL', 'LEO', 'MEO', 'GEO', 'OTHER'].map(o => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={state.filters.watchedOnly}
              onChange={e => filter('watchedOnly', e.target.checked)}
            />
            Watchlisted only
          </label>
        </div>
        <div className="filter-grid">
          {[
            ['minAlt', 'Min altitude km', 0, 100000],
            ['maxAlt', 'Max altitude km', 0, 100000],
            ['minInclination', 'Min inclination °', 0, 180],
            ['maxInclination', 'Max inclination °', 0, 180],
          ].map(([key, label, min, max]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                min={min}
                max={max}
                value={state.filters[key]}
                onChange={e => filter(key, Math.max(min, Math.min(max, +e.target.value)))}
              />
            </label>
          ))}
        </div>
        <p>
          Editing a range endpoint adjusts its paired bound when needed to keep minimum ≤ maximum.
        </p>
        <label>
          Satellite cap
          <input
            type="range"
            min="10"
            max="500"
            defaultValue={settings.get('satelliteCap') || 250}
            onChange={e => satellitesLayer.setSatCap(+e.target.value)}
          />
        </label>
      </details>
      <label>
        Select satellite (or tap globe)
        <select
          value={state.selectedId || ''}
          onChange={e => {
            updateOrbit({ selectedId: e.target.value || null })
            setNickname('')
          }}
        >
          <option value="">None — clear paths</option>
          {records.slice(0, 1000).map(r => (
            <option key={r.satrec.satnum} value={String(r.satrec.satnum)}>
              {r.name} · {r.satrec.satnum}
            </option>
          ))}
        </select>
      </label>
      {facts && (
        <article>
          <h3>
            {facts.name} · {facts.id}
          </h3>
          <dl>
            <dt>Orbit</dt>
            <dd>{facts.orbit} (GEO = near-geosynchronous, not necessarily stationary)</dd>
            <dt>Selected element origin</dt>
            <dd>{satellitesLayer.getSelectedProvenance()}</dd>
            <dt>TLE epoch</dt>
            <dd>{fmt(facts.epochMs)}</dd>
            <dt>Element age (wall clock)</dt>
            <dd>
              {facts.ageDays.toFixed(1)} days{' '}
              {facts.stale ? '— STALE ELEMENTS: predictions may be unreliable' : ''}
            </dd>
            <dt>Period / inclination</dt>
            <dd>
              {facts.periodMin.toFixed(2)} min / {facts.inclinationDeg.toFixed(2)}°
            </dd>
            <dt>Perigee / apogee</dt>
            <dd>
              {facts.perigeeKm.toFixed(1)} / {facts.apogeeKm.toFixed(1)} km (mean-element estimate)
            </dd>
            <dt>Propagated at</dt>
            <dd>{fmt(getTimeMs())}</dd>
            <dt>Position / speed</dt>
            <dd>
              {p
                ? `${p.lat.toFixed(3)}°, ${p.lon.toFixed(3)}° · ${p.altKm.toFixed(1)} km · ${p.velocityKmS.toFixed(3)} km/s`
                : 'Propagation unavailable / decayed orbit'}
            </dd>
          </dl>
          <div className="actions">
            <button
              onClick={() => {
                if (p && viewer)
                  viewer.camera.flyTo({
                    destination: Cesium.Cartesian3.fromDegrees(
                      p.lon,
                      p.lat,
                      p.altKm * 1000 + 800000
                    ),
                  })
              }}
            >
              Jump to satellite
            </button>
            <input
              aria-label="Local nickname"
              placeholder="Optional local nickname"
              value={nickname}
              maxLength={100}
              onChange={e => setNickname(e.target.value)}
            />
            <button
              onClick={() =>
                run(() => (watched ? unwatchSatellite(facts.id) : watchSatellite(record, nickname)))
              }
            >
              {watched ? 'Remove from watchlist' : 'Add to watchlist'}
            </button>
            {watched && (
              <button onClick={() => run(() => watchSatellite(record, nickname))}>
                Save nickname / cached elements
              </button>
            )}
          </div>
          <label>
            Arc duration, each direction: {state.minutes} min
            <input
              type="range"
              min="5"
              max="180"
              step="5"
              value={state.minutes}
              onChange={e => updateOrbit({ minutes: +e.target.value })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={state.showPath}
              onChange={e => updateOrbit({ showPath: e.target.checked })}
            />
            Selected orbit · past gray / future green
          </label>
          <label>
            <input
              type="checkbox"
              checked={state.showGround}
              onChange={e => updateOrbit({ showGround: e.target.checked })}
            />
            Selected ground track · gold / current white cross
          </label>
          <p>
            Selected object only. Safe Mode caps points at 80 and past arc at 31 samples; future
            arcs and ground tracks are suspended.
          </p>
        </article>
      )}
      <h3>Saved observer / pass predictions</h3>
      <label>
        Use saved marker
        <select
          defaultValue=""
          onChange={e => {
            const m = markers.find(m => String(m.id) === e.target.value)
            if (m) {
              setLat(String(m.lat))
              setLon(String(m.lon))
              run(() => saveObserver({ lat: m.lat, lon: m.lon, name: m.title }))
            }
          }}
        >
          <option value="">Choose marker</option>
          {markers.map(m => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </label>
      <div className="filter-grid">
        <label>
          Observer latitude
          <input
            type="number"
            min="-90"
            max="90"
            value={lat}
            onChange={e => setLat(e.target.value)}
          />
        </label>
        <label>
          Observer longitude
          <input
            type="number"
            min="-180"
            max="180"
            value={lon}
            onChange={e => setLon(e.target.value)}
          />
        </label>
      </div>
      <button
        onClick={() =>
          run(() => {
            if (
              !lat.trim() ||
              !lon.trim() ||
              !Number.isFinite(+lat) ||
              !Number.isFinite(+lon) ||
              Math.abs(+lat) > 90 ||
              Math.abs(+lon) > 180
            )
              throw new Error('Invalid observer coordinates')
            return saveObserver({ lat: +lat, lon: +lon, name: 'Saved observer' })
          })
        }
      >
        Save observer locally
      </button>
      <p>
        Observer:{' '}
        {state.observer
          ? `${state.observer.name}: ${state.observer.lat}°, ${state.observer.lon}°`
          : 'not saved'}
        . Predictions from current TLE at controller time. 10° horizon, 30-second sampling, no
        refraction, terrain, weather or visibility model; not official tracking precision.
      </p>
      <button disabled={!record || !state.observer || busy} onClick={() => predict()}>
        {busy ? 'Computing…' : 'Predict next 24h passes'}
      </button>
      {passes.slice(0, 10).map(pass => (
        <article key={pass.startMs}>
          {pass.name}
          <br />
          Rise/start: {fmt(pass.startMs)}
          {pass.clippedStart ? ' (already above horizon)' : ''}
          <br />
          Max: {pass.maxElevation.toFixed(1)}° at {fmt(pass.maxTimeMs)}
          <br />
          Set/end: {fmt(pass.endMs)}
          {pass.clippedEnd ? ' (window clipped)' : ''}
          <br />
          Duration: {(pass.durationSeconds / 60).toFixed(1)} min
        </article>
      ))}
      <h3>Watchlist · device only</h3>
      {state.watchlist.map(w => {
        const f = orbitalFacts(w.record)
        const cached = propagateRecord(w.record, getTimeMs())
        return (
          <article key={w.id}>
            <strong>{w.nickname || w.name}</strong> · {w.id}
            <p>
              Saved elements: {f?.ageDays.toFixed(1)} days old ·{' '}
              {cached
                ? `${cached.lat.toFixed(2)}°, ${cached.lon.toFixed(2)}° / ${cached.altKm.toFixed(0)} km`
                : 'Propagation unavailable'}{' '}
              · derived from saved TLE, not telemetry
            </p>
            <div className="actions">
              <button onClick={() => satellitesLayer.jumpTo(w.id)}>Select / jump</button>
              <button disabled={!state.observer || busy} onClick={() => predict(w.record)}>
                Next passes (saved TLE)
              </button>
              <button onClick={() => run(() => unwatchSatellite(w.id))}>Remove</button>
            </div>
          </article>
        )
      })}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
