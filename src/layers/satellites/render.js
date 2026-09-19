import * as Cesium from 'cesium'
import { orbitalFacts, propagateRecord, samplePath, splitDateline } from './orbital.js'
const colors = {
  LEO: '#00cfff',
  MEO: '#aaffaa',
  GEO: '#ff9900',
  OTHER: '#d7aaff',
  UNKNOWN: '#aaaaaa',
}
export function propagateSatellites(points, records, timeMs, cap, state) {
  points.removeAll()
  const result = []
  const watched = new Set(state.watchSubset || state.watchlist.map(w => w.id))
  const f = state.filters
  const ordered = [...records].sort((a, b) => priority(b) - priority(a))
  function priority(r) {
    return String(r.satrec.satnum) === state.selectedId
      ? 2
      : watched.has(String(r.satrec.satnum))
        ? 1
        : 0
  }
  for (const record of ordered) {
    if (result.length >= cap) break
    const facts = orbitalFacts(record, timeMs)
    const p = propagateRecord(record, timeMs)
    if (!facts || !p) continue
    const selected = facts.id === state.selectedId
    if (
      !selected &&
      ((f.search &&
        !record.name.toLowerCase().includes(f.search.toLowerCase()) &&
        !facts.id.includes(f.search)) ||
        (f.orbit !== 'ALL' && facts.orbit !== f.orbit) ||
        (f.watchedOnly && !watched.has(facts.id)) ||
        p.altKm < f.minAlt ||
        p.altKm > f.maxAlt ||
        facts.inclinationDeg < f.minInclination ||
        facts.inclinationDeg > f.maxInclination)
    )
      continue
    points.add({
      position: Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.altKm * 1000),
      color: Cesium.Color.fromCssColorString(selected ? '#ffffff' : colors[facts.orbit]),
      pixelSize: selected ? 12 : watched.has(facts.id) ? 8 : 6,
      outlineWidth: 2,
      outlineColor: Cesium.Color.BLACK,
      id: { dexSatellite: facts.id },
    })
    result.push({ ...facts, ...p, alt: p.altKm * 1000 })
  }
  return result
}
export function buildSelectedPaths(lines, record, timeMs, state, safeMode) {
  lines.removeAll()
  if (!record) return
  const draw = (samples, ground, color) => {
    for (const segment of splitDateline(samples))
      lines.add({
        positions: segment.map(p =>
          Cesium.Cartesian3.fromDegrees(p.lon, p.lat, ground ? 1000 : p.altKm * 1000)
        ),
        width: ground ? 2 : 3,
        material: Cesium.Material.fromType('Color', {
          color: Cesium.Color.fromCssColorString(color),
        }),
      })
  }
  const options = { minutes: state.minutes, safeMode }
  const past = samplePath(record, timeMs, { ...options, direction: -1 })
  if (state.showPath) draw(past, false, '#8098b8')
  if (!safeMode) {
    const future = samplePath(record, timeMs, options)
    if (state.showPath) draw(future, false, '#00ffbc')
    if (state.showGround) draw([...past].reverse().concat(future.slice(1)), true, '#ffd166')
  }
  const current = propagateRecord(record, timeMs)
  if (current && state.showGround) {
    // Small surface cross marks the selected object's sub-satellite position.
    draw(
      [
        { ...current, lon: current.lon - 0.15 },
        { ...current, lon: current.lon + 0.15 },
      ],
      true,
      '#ffffff'
    )
    draw(
      [
        { ...current, lat: current.lat - 0.15 },
        { ...current, lat: current.lat + 0.15 },
      ],
      true,
      '#ffffff'
    )
  }
}
