// Pure, bounded SGP4 calculations. All distances km; angles degrees unless noted.
import * as satellite from 'satellite.js'

export const MAX_PATH_SAMPLES = 181
const R = 6378.135
const degrees = r => (r * 180) / Math.PI
const bound = (n, min, max, fallback) =>
  Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback

export function orbitalFacts(record, nowMs = Date.now()) {
  const s = record?.satrec
  if (
    !s ||
    !Number.isFinite(s.no) ||
    s.no <= 0 ||
    !Number.isFinite(s.ecco) ||
    s.ecco < 0 ||
    s.ecco >= 1 ||
    !Number.isFinite(s.jdsatepoch) ||
    !Number.isFinite(s.inclo)
  )
    return null
  const periodMin = (2 * Math.PI) / s.no
  const a = Math.cbrt(398600.8 * ((periodMin * 60) / (2 * Math.PI)) ** 2)
  const perigeeKm = a * (1 - s.ecco) - R
  const apogeeKm = a * (1 + s.ecco) - R
  const epochMs = (s.jdsatepoch - 2440587.5) * 86400000
  return {
    id: String(s.satnum),
    name: record.name,
    periodMin,
    inclinationDeg: degrees(s.inclo),
    perigeeKm,
    apogeeKm,
    epochMs,
    ageDays: (nowMs - epochMs) / 86400000,
    stale: Math.abs(nowMs - epochMs) > 14 * 86400000,
    orbit: classifyOrbit({ periodMin, apogeeKm, perigeeKm, eccentricity: s.ecco }),
  }
}

export function classifyOrbit({ periodMin, apogeeKm, perigeeKm, eccentricity = 0 }) {
  if (![periodMin, apogeeKm, perigeeKm].every(Number.isFinite) || periodMin <= 0) return 'UNKNOWN'
  // GEO here means near-geosynchronous, NOT necessarily geostationary.
  if (Math.abs(periodMin - 1436.07) < 30 && eccentricity < 0.05) return 'GEO'
  if (apogeeKm < 2000) return 'LEO'
  if (perigeeKm >= 2000 && apogeeKm < 35786) return 'MEO'
  return 'OTHER'
}

export function propagateRecord(record, timeMs) {
  if (!Number.isFinite(timeMs) || !orbitalFacts(record, timeMs)) return null
  try {
    // satellite.js can mutate deep-space integration state; isolate each calculation.
    const pv = satellite.propagate({ ...record.satrec }, new Date(timeMs))
    if (!pv?.position || !pv.velocity) return null
    const geo = satellite.eciToGeodetic(pv.position, satellite.gstime(new Date(timeMs)))
    const state = {
      timeMs,
      lon: degrees(geo.longitude),
      lat: degrees(geo.latitude),
      altKm: geo.height,
      velocityKmS: Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z),
    }
    return Object.values(state).every(Number.isFinite) && state.altKm >= 0 ? state : null
  } catch {
    return null
  }
}

export function splitDateline(points) {
  const segments = []
  let segment = []
  for (const p of points) {
    if (!p || (segment.length && Math.abs(p.lon - segment.at(-1).lon) > 180)) {
      if (segment.length > 1) segments.push(segment)
      segment = []
    }
    if (p) segment.push(p)
  }
  if (segment.length > 1) segments.push(segment)
  return segments
}

export function samplePath(
  record,
  timeMs,
  { minutes = 90, samples = 121, direction = 1, safeMode = false } = {}
) {
  const count = Math.round(bound(samples, 2, safeMode ? 31 : MAX_PATH_SAMPLES, 121))
  const duration = bound(minutes, 5, 180, 90) * 60000
  return Array.from({ length: count }, (_, i) =>
    propagateRecord(record, timeMs + ((direction < 0 ? -1 : 1) * duration * i) / (count - 1))
  )
}

export function elevationAt(record, observer, timeMs) {
  try {
    const pv = satellite.propagate({ ...record.satrec }, new Date(timeMs))
    if (!pv?.position) return null
    const ecf = satellite.eciToEcf(pv.position, satellite.gstime(new Date(timeMs)))
    const elevation = degrees(
      satellite.ecfToLookAngles(
        {
          longitude: (observer.lon * Math.PI) / 180,
          latitude: (observer.lat * Math.PI) / 180,
          height: observer.altKm || 0,
        },
        ecf
      ).elevation
    )
    return Number.isFinite(elevation) ? elevation : null
  } catch {
    return null
  }
}

export function predictPasses(
  record,
  observer,
  startMs,
  { hours = 24, minElevation = 10, stepSeconds = 30 } = {}
) {
  if (
    !orbitalFacts(record, startMs) ||
    !Number.isFinite(startMs) ||
    !Number.isFinite(observer?.lon) ||
    !Number.isFinite(observer?.lat) ||
    Math.abs(observer.lon) > 180 ||
    Math.abs(observer.lat) > 90
  )
    return []
  const end = startMs + bound(hours, 1, 48, 24) * 3600000
  const step = bound(stepSeconds, 20, 120, 30) * 1000
  const threshold = bound(minElevation, 0, 89, 10)
  const passes = []
  let pass = null
  for (let t = startMs; t <= end; t += step) {
    const elevation = elevationAt(record, observer, t)
    if (elevation !== null && elevation >= threshold) {
      if (!pass)
        pass = {
          startMs: t,
          maxElevation: elevation,
          maxTimeMs: t,
          clippedStart: t === startMs,
          satelliteId: String(record.satrec.satnum),
          name: record.name,
          observer: { ...observer },
          minElevation: threshold,
        }
      if (elevation > pass.maxElevation) {
        pass.maxElevation = elevation
        pass.maxTimeMs = t
      }
    } else if (pass) {
      passes.push({
        ...pass,
        endMs: t,
        durationSeconds: (t - pass.startMs) / 1000,
        clippedEnd: false,
      })
      pass = null
      if (passes.length >= 32) break
    }
  }
  if (pass)
    passes.push({
      ...pass,
      endMs: end,
      durationSeconds: (end - pass.startMs) / 1000,
      clippedEnd: true,
    })
  return passes
}
