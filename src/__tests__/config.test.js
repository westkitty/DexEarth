import { describe, it, expect } from 'vitest'
import { LAYER_DEFS, SHIPPING_ROUTES } from '../config.js'

// ─── LAYER_DEFS ───────────────────────────────────────────────────────────────

const EXPECTED_IDS = [
  'AIR_RADAR',
  'ORBITAL_MATH',
  'SEISMIC_GRID',
  'THERMAL_FIRES',
  'MARITIME_LANES',
  'FIBER_CABLES',
  'TECTONIC_PLATES',
  'CLOUD_SYSTEMS',
  'SOLAR_SYNC',
  'VISUAL_FX',
]

describe('LAYER_DEFS', () => {
  it('exports exactly 10 layers', () => {
    expect(LAYER_DEFS).toHaveLength(10)
  })

  it('contains all expected layer IDs in order', () => {
    const ids = LAYER_DEFS.map(l => l.id)
    expect(ids).toEqual(EXPECTED_IDS)
  })

  it('every layer has id, label, and desc strings', () => {
    for (const def of LAYER_DEFS) {
      expect(typeof def.id).toBe('string')
      expect(typeof def.label).toBe('string')
      expect(typeof def.desc).toBe('string')
      expect(def.id.length).toBeGreaterThan(0)
      expect(def.label.length).toBeGreaterThan(0)
      expect(def.desc.length).toBeGreaterThan(0)
    }
  })

  it('all IDs are unique', () => {
    const ids = LAYER_DEFS.map(l => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ─── SHIPPING_ROUTES ──────────────────────────────────────────────────────────

describe('SHIPPING_ROUTES', () => {
  it('exports at least 10 routes', () => {
    expect(SHIPPING_ROUTES.length).toBeGreaterThanOrEqual(10)
  })

  it('every route has a name and coords array', () => {
    for (const route of SHIPPING_ROUTES) {
      expect(typeof route.name).toBe('string')
      expect(route.name.length).toBeGreaterThan(0)
      expect(Array.isArray(route.coords)).toBe(true)
    }
  })

  it('every coord pair is [lon, lat] within valid WGS-84 bounds', () => {
    for (const route of SHIPPING_ROUTES) {
      for (const [lon, lat] of route.coords) {
        expect(lon).toBeGreaterThanOrEqual(-180)
        expect(lon).toBeLessThanOrEqual(180)
        expect(lat).toBeGreaterThanOrEqual(-90)
        expect(lat).toBeLessThanOrEqual(90)
      }
    }
  })

  it('every route has at least 2 waypoints', () => {
    for (const route of SHIPPING_ROUTES) {
      expect(route.coords.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('all route names are unique', () => {
    const names = SHIPPING_ROUTES.map(r => r.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
