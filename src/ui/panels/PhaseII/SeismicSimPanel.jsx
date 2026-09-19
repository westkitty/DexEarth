import { useState, useEffect, useCallback } from 'react'
import { seismicSimLayer, PRESETS } from '../../../layers/seismicSim/layer.js'
import * as tc from '../../../state/timeController.js'

const S = {
  panel: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#FF8C00',
    padding: '8px 0',
    borderTop: '1px solid #FF8C0022',
    marginTop: '6px',
  },
  label: { color: '#FFBB88', fontSize: '10px', marginBottom: '2px' },
  row: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' },
  btn: {
    background: '#0d1520',
    border: '1px solid #FF8C0055',
    color: '#FF8C00',
    fontFamily: 'monospace',
    fontSize: '10px',
    cursor: 'pointer',
    padding: '2px 7px',
    borderRadius: '2px',
  },
  input: {
    background: '#0d1520',
    border: '1px solid #FF8C0044',
    color: '#FF8C00',
    fontFamily: 'monospace',
    fontSize: '10px',
    padding: '2px 5px',
    width: '70px',
    borderRadius: '2px',
  },
}

export default function SeismicSimPanel({ viewer }) {
  const [isActive, setIsActive] = useState(seismicSimLayer.isActive)
  const [error, setError] = useState('')
  const [events, setEvents] = useState(seismicSimLayer.getEvents)
  const [lon, setLon] = useState('143.0')
  const [lat, setLat] = useState('37.5')
  const [mag, setMag] = useState('7.5')
  const [depth, setDepth] = useState('30')
  const [tel, setTel] = useState({ events: 0, rings: 0 })

  useEffect(() => {
    return seismicSimLayer.onTelemetry(t => setTel(t))
  }, [])

  const activate = useCallback(async () => {
    if (!viewer || isActive) return
    seismicSimLayer.activate({ viewer })
    setIsActive(true)
  }, [viewer, isActive])

  const deactivate = useCallback(() => {
    seismicSimLayer.deactivate()
    setIsActive(false)
    setEvents([])
  }, [])

  const addEvent = useCallback(
    preset => {
      setError('')
      if (!preset && [lon, lat, mag, depth].some(value => !value.trim())) {
        setError('All simulation fields are required.')
        return
      }
      const params = preset
        ? typeof PRESETS[preset] === 'function'
          ? PRESETS[preset]()
          : PRESETS[preset]
        : {
            lon: Number(lon),
            lat: Number(lat),
            mag: Number(mag),
            depthKm: Number(depth),
            originMs: tc.getTimeMs(),
          }
      if (!isActive) return
      const ev = seismicSimLayer.addEvent({
        ...params,
        originMs: params.originMs ?? tc.getTimeMs(),
      })
      if (!ev)
        setError(
          'Invalid simulation or 100-event limit reached. Use longitude ±180°, latitude ±90°, magnitude 0–12, depth 0–1000 km.'
        )
      setEvents(seismicSimLayer.getEvents())
      return ev
    },
    [isActive, lon, lat, mag, depth]
  )

  const removeEvent = useCallback(id => {
    seismicSimLayer.removeEvent(id)
    setEvents(seismicSimLayer.getEvents())
  }, [])

  return (
    <div style={{ ...S.panel, position: 'relative' }}>
      {error && <p role="alert">{error}</p>}
      <div
        style={{
          ...S.label,
          fontWeight: 'bold',
          marginBottom: '6px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        ⚡ SEISMIC SIM
      </div>

      <div style={S.row}>
        <button
          style={{
            ...S.btn,
            ...(isActive ? { background: '#FF8C0022', border: '1px solid #FF8C00' } : {}),
          }}
          onClick={isActive ? deactivate : activate}
        >
          {isActive ? '■ DEACTIVATE' : '▶ ACTIVATE'}
        </button>
        {isActive && (
          <span style={{ color: '#FFBB88', fontSize: '10px' }}>
            Events: {tel.events} | Rings: {tel.rings}
          </span>
        )}
      </div>

      {isActive && (
        <>
          {/* Presets */}
          <div style={S.row}>
            {Object.entries(PRESETS).map(([key, val]) => (
              <button key={key} style={S.btn} onClick={() => addEvent(key)}>
                {typeof val === 'function' ? '🎲 Random' : val.label.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Manual entry */}
          <div style={{ ...S.row, flexWrap: 'wrap', gap: '4px' }}>
            <div>
              <div style={S.label}>Lon</div>
              <input
                aria-label="Simulation longitude"
                style={S.input}
                value={lon}
                onChange={e => setLon(e.target.value)}
              />
            </div>
            <div>
              <div style={S.label}>Lat</div>
              <input
                aria-label="Simulation latitude"
                style={S.input}
                value={lat}
                onChange={e => setLat(e.target.value)}
              />
            </div>
            <div>
              <div style={S.label}>M</div>
              <input
                style={{ ...S.input, width: '40px' }}
                aria-label="Simulation magnitude"
                value={mag}
                onChange={e => setMag(e.target.value)}
              />
            </div>
            <div>
              <div style={S.label}>Depth(km)</div>
              <input
                style={{ ...S.input, width: '50px' }}
                aria-label="Simulation depth km"
                value={depth}
                onChange={e => setDepth(e.target.value)}
              />
            </div>
          </div>
          <div style={S.row}>
            <button style={S.btn} onClick={() => addEvent(null)}>
              + Add Event (now)
            </button>
            <button
              style={{ ...S.btn, color: '#FF4444' }}
              onClick={() => {
                seismicSimLayer.clearEvents()
                setEvents([])
              }}
            >
              Clear All
            </button>
          </div>

          {/* Event list */}
          {events.map(ev => (
            <div
              key={ev.id}
              style={{
                ...S.row,
                color: '#FFBB88',
                fontSize: '10px',
                borderBottom: '1px solid #FF8C0011',
                paddingBottom: '3px',
              }}
            >
              <span>
                M{ev.mag} @ {ev.lon.toFixed(1)},{ev.lat.toFixed(1)}
              </span>
              <button
                style={{ ...S.btn, padding: '1px 5px', fontSize: '9px' }}
                onClick={() => removeEvent(ev.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
