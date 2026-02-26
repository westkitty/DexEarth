import { useCallback, useEffect, useRef, useState } from 'react'
import * as Cesium from 'cesium'
import * as satellite from 'satellite.js'
import './App.css'
import { parseTLEs, fetchWithRetry } from './utils.js'
import { emitAudit } from './utils/auditLog.js'
import { LAYER_DEFS, SHIPPING_ROUTES } from './config.js'
import * as tickCoordinator from './diagnostics/tickCoordinator.js'
import { initPerfMonitor, stopPerfMonitor } from './diagnostics/perfMonitor.js'
import { viewStore, saveView } from './state/viewStore.js'
import PhaseIIRoot from './ui/PhaseIIRoot.jsx'

// ─── USER CONFIG ──────────────────────────────────────────────────────────────
// Set VITE_FIRMS_MAP_KEY in .env (get a free key at https://firms.modaps.eosdis.nasa.gov/api/map_key/)
// Falls back to placeholder, which gracefully shows THERMAL_FIRES as UNAVAILABLE.
const FIRMS_MAP_KEY = import.meta.env.VITE_FIRMS_MAP_KEY ?? 'YOUR_KEY_HERE'

// ─── CABLE NEON PALETTE ───────────────────────────────────────────────────────
const CABLE_COLORS = [
  Cesium.Color.fromCssColorString('#00FFFF').withAlpha(0.7),
  Cesium.Color.fromCssColorString('#FF00FF').withAlpha(0.6),
  Cesium.Color.fromCssColorString('#00FF88').withAlpha(0.6),
  Cesium.Color.fromCssColorString('#FF6600').withAlpha(0.6),
  Cesium.Color.fromCssColorString('#6600FF').withAlpha(0.6),
  Cesium.Color.fromCssColorString('#FFFF00').withAlpha(0.5),
  Cesium.Color.fromCssColorString('#FF0066').withAlpha(0.6),
  Cesium.Color.fromCssColorString('#00CCFF').withAlpha(0.6),
]

// SHIPPING_ROUTES imported from ./config.js
// parseTLEs and fetchWithRetry imported from ./utils.js

// ─── SEISMIC RING HELPER ──────────────────────────────────────────────────────
function buildRingPositions(lon, lat, radiusMeters, numPts = 48, altitude = 500) {
  const R = Cesium.Ellipsoid.WGS84.maximumRadius
  const angularRadius = radiusMeters / R
  const positions = []
  for (let i = 0; i <= numPts; i++) {
    const angle = (i / numPts) * 2 * Math.PI
    const dLon = (angularRadius / Math.cos((lat * Math.PI) / 180)) * Math.cos(angle)
    const dLat = angularRadius * Math.sin(angle)
    positions.push(
      Cesium.Cartesian3.fromDegrees(
        lon + (dLon * 180) / Math.PI,
        lat + (dLat * 180) / Math.PI,
        altitude
      )
    )
  }
  return positions
}

// ─── LAYER ACTIVATE / DEACTIVATE ─────────────────────────────────────────────

async function activateLayer(viewer, layerDataRef, layerId, setTelemetry, setLayerStatus, vfxRef) {
  const ld = layerDataRef.current
  setLayerStatus(s => ({ ...s, [layerId]: 'loading' }))

  try {
    switch (layerId) {
      // ── AIR_RADAR ──────────────────────────────────────────────────────────
      case 'AIR_RADAR': {
        const points = new Cesium.PointPrimitiveCollection()
        viewer.scene.primitives.add(points)
        ld.AIR_RADAR.points = points

        const refresh = async () => {
          try {
            // /proxy/flights → Vite middleware aggregates 4 airplanes.live regions
            const res = await fetchWithRetry('/proxy/flights')
            const json = await res.json()
            points.removeAll()
            let count = 0
              ; (json.ac || []).forEach(a => {
                const lon = a.lon,
                  lat = a.lat
                const alt = typeof a.alt_baro === 'number' ? a.alt_baro * 0.3048 : 10000 // ft→m
                if (lon == null || lat == null) return
                points.add({
                  position: Cesium.Cartesian3.fromDegrees(lon, lat, Math.max(alt, 1000)),
                  color: Cesium.Color.fromCssColorString('#00FF9F').withAlpha(0.9),
                  pixelSize: 4,
                  outlineColor: Cesium.Color.fromCssColorString('#00FF9F').withAlpha(0.2),
                  outlineWidth: 2,
                })
                count++
              })
            setTelemetry(t => ({ ...t, AIR_RADAR: count }))
            setLayerStatus(s => ({ ...s, AIR_RADAR: 'active' }))
          } catch (err) {
            console.warn('AIR_RADAR fetch failed:', err.message)
            setLayerStatus(s => ({ ...s, AIR_RADAR: 'error' }))
            setTelemetry(t => ({ ...t, AIR_RADAR: 0 }))
          }
        }
        await refresh()
        tickCoordinator.registerSlow('AIR_RADAR', async () => {
          if (!ld.AIR_RADAR._tick) ld.AIR_RADAR._tick = 0
          ld.AIR_RADAR._tick++
          if (ld.AIR_RADAR._tick >= 30) {
            ld.AIR_RADAR._tick = 0
            await refresh()
          }
        })
        break
      }

      // ── ORBITAL_MATH ───────────────────────────────────────────────────────
      case 'ORBITAL_MATH': {
        const points = new Cesium.PointPrimitiveCollection()
        const arcs = new Cesium.PolylineCollection()
        viewer.scene.primitives.add(points)
        viewer.scene.primitives.add(arcs)
        ld.ORBITAL_MATH.points = points
        ld.ORBITAL_MATH.arcs = arcs

        // Fetch TLEs via Vite proxy (CelesTrak blocks direct browser requests)
        const TLE_SOURCES = [
          '/proxy/tle',
          'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle',
          'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle',
        ]
        let tleLoaded = false
        for (const tleUrl of TLE_SOURCES) {
          try {
            const res = await fetchWithRetry(tleUrl, {}, 2, 20_000)
            const text = await res.text()
            const parsed = parseTLEs(text).slice(0, 400)
            if (parsed.length > 0) {
              ld.ORBITAL_MATH.tleData = parsed
              tleLoaded = true
              break
            }
          } catch (err) {
            console.warn('TLE source failed, trying next:', tleUrl, err.message)
          }
        }
        if (!tleLoaded) {
          setLayerStatus(s => ({ ...s, ORBITAL_MATH: 'error' }))
          return
        }

        const history = {}
        ld.ORBITAL_MATH.history = history

        const propagate = () => {
          points.removeAll()
          arcs.removeAll()
          let count = 0
          const now = new Date()

          ld.ORBITAL_MATH.tleData.forEach(({ satrec }, idx) => {
            try {
              const pv = satellite.propagate(satrec, now)
              if (!pv.position) return
              const gmst = satellite.gstime(now)
              const geo = satellite.eciToGeodetic(pv.position, gmst)
              const lon = satellite.degreesLong(geo.longitude)
              const lat = satellite.degreesLat(geo.latitude)
              const alt = geo.height * 1000 // km → m

              if (!isFinite(lon) || !isFinite(lat) || !isFinite(alt)) return

              points.add({
                position: Cesium.Cartesian3.fromDegrees(lon, lat, Math.max(alt, 100_000)),
                color: Cesium.Color.fromCssColorString('#00CFFF').withAlpha(0.85),
                pixelSize: 3,
                outlineColor: Cesium.Color.fromCssColorString('#00CFFF').withAlpha(0.15),
                outlineWidth: 1,
              })
              count++

              // Track arc history
              if (!history[idx]) history[idx] = []
              history[idx].push([lon, lat, Math.max(alt, 100_000)])
              if (history[idx].length > 10) history[idx].shift()

              // Draw fading arc
              if (history[idx].length >= 2) {
                const positions = history[idx].map(([lo, la, al]) =>
                  Cesium.Cartesian3.fromDegrees(lo, la, al)
                )
                arcs.add({
                  positions,
                  width: 1,
                  material: Cesium.Material.fromType('PolylineGlow', {
                    glowPower: 0.15,
                    color: Cesium.Color.fromCssColorString('#00CFFF').withAlpha(0.35),
                  }),
                })
              }
            } catch {
              /* skip bad record */
            }
          })

          setTelemetry(t => ({ ...t, ORBITAL_MATH: count }))
          setLayerStatus(s => ({ ...s, ORBITAL_MATH: 'active' }))
        }

        propagate()
        tickCoordinator.registerSlow('ORBITAL_MATH', () => {
          if (!ld.ORBITAL_MATH._tick) ld.ORBITAL_MATH._tick = 0
          ld.ORBITAL_MATH._tick++
          if (ld.ORBITAL_MATH._tick >= 5) {
            ld.ORBITAL_MATH._tick = 0
            propagate()
          }
        })
        break
      }

      // ── SEISMIC_GRID ───────────────────────────────────────────────────────
      case 'SEISMIC_GRID': {
        const shadows = new Cesium.PolylineCollection()
        const primitives = new Cesium.PolylineCollection()
        viewer.scene.primitives.add(shadows)
        viewer.scene.primitives.add(primitives)
        ld.SEISMIC_GRID.shadows = shadows
        ld.SEISMIC_GRID.primitives = primitives

        const refreshFireAndRings = async () => {
          try {
            const res = await fetchWithRetry(
              'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'
            )
            const json = await res.json()
            primitives.removeAll()
            shadows.removeAll()
            let count = 0
              ; (json.features || []).forEach(f => {
                const [lon, lat] = f.geometry.coordinates
                const mag = f.properties.mag || 1
                if (!isFinite(lon) || !isFinite(lat)) return

                const radius = Math.max(mag * 50_000, 20_000)
                const alpha = Math.min(0.3 + mag * 0.08, 0.9)
                const lineWidth = Math.max(1, mag * 0.7)

                // Shadow ring — dark halo at surface level, slightly wider
                shadows.add({
                  positions: buildRingPositions(lon, lat, radius * 1.04, 48, 800),
                  width: lineWidth + 2,
                  material: Cesium.Material.fromType('Color', {
                    color: Cesium.Color.fromCssColorString('#000000').withAlpha(0.18),
                  }),
                })
                // Main ring — raised for depth, glowing
                primitives.add({
                  positions: buildRingPositions(lon, lat, radius, 48, 12_000),
                  width: lineWidth,
                  material: Cesium.Material.fromType('PolylineGlow', {
                    glowPower: 0.2,
                    color: Cesium.Color.fromCssColorString('#FF4500').withAlpha(alpha),
                  }),
                })
                count++
              })
            setTelemetry(t => ({ ...t, SEISMIC_GRID: count }))
            setLayerStatus(s => ({ ...s, SEISMIC_GRID: 'active' }))
          } catch (err) {
            console.warn('SEISMIC fetch failed:', err.message)
            setLayerStatus(s => ({ ...s, SEISMIC_GRID: 'error' }))
          }
        }
        refreshFireAndRings()
        tickCoordinator.registerSlow('SEISMIC_GRID', () => {
          if (!ld.SEISMIC_GRID._tick) ld.SEISMIC_GRID._tick = 0
          ld.SEISMIC_GRID._tick++
          if (ld.SEISMIC_GRID._tick >= 60) {
            ld.SEISMIC_GRID._tick = 0
            refreshFireAndRings()
          }
        })
        break
      }

      // ── THERMAL_FIRES ──────────────────────────────────────────────────────
      case 'THERMAL_FIRES': {
        const points = new Cesium.PointPrimitiveCollection()
        viewer.scene.primitives.add(points)
        ld.THERMAL_FIRES.points = points

        const refresh = async () => {
          if (FIRMS_MAP_KEY === 'YOUR_KEY_HERE') {
            console.warn('THERMAL_FIRES: Set FIRMS_MAP_KEY at top of App.jsx')
            setLayerStatus(s => ({ ...s, THERMAL_FIRES: 'error' }))
            setTelemetry(t => ({ ...t, THERMAL_FIRES: 0 }))
            return
          }
          try {
            const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/VIIRS_SNPP_NRT/world/1`
            const res = await fetchWithRetry(url)
            const text = await res.text()
            const rows = text.trim().split('\n').slice(1) // skip header
            points.removeAll()
            let count = 0
            rows.forEach(row => {
              const cols = row.split(',')
              const lat = parseFloat(cols[0])
              const lon = parseFloat(cols[1])
              if (!isFinite(lat) || !isFinite(lon)) return
              points.add({
                position: Cesium.Cartesian3.fromDegrees(lon, lat, 500),
                color: Cesium.Color.fromCssColorString('#FF6600').withAlpha(0.85),
                pixelSize: 3,
                outlineColor: Cesium.Color.fromCssColorString('#FF8800').withAlpha(0.2),
                outlineWidth: 1,
              })
              count++
            })
            setTelemetry(t => ({ ...t, THERMAL_FIRES: count }))
            setLayerStatus(s => ({ ...s, THERMAL_FIRES: 'active' }))
          } catch (err) {
            console.warn('THERMAL_FIRES fetch failed:', err.message)
            setLayerStatus(s => ({ ...s, THERMAL_FIRES: 'error' }))
          }
        }
        await refresh()
        tickCoordinator.registerSlow('THERMAL_FIRES', () => {
          if (!ld.THERMAL_FIRES._tick) ld.THERMAL_FIRES._tick = 0
          ld.THERMAL_FIRES._tick++
          if (ld.THERMAL_FIRES._tick >= 120) {
            ld.THERMAL_FIRES._tick = 0
            refresh()
          }
        })
        break
      }

      // ── MARITIME_LANES ─────────────────────────────────────────────────────
      case 'MARITIME_LANES': {
        const shadows = new Cesium.PolylineCollection()
        const lines = new Cesium.PolylineCollection()
        viewer.scene.primitives.add(shadows)
        viewer.scene.primitives.add(lines)
        ld.MARITIME_LANES.shadows = shadows
        ld.MARITIME_LANES.lines = lines

        SHIPPING_ROUTES.forEach(route => {
          const shadowPositions = route.coords.map(([lo, la]) =>
            Cesium.Cartesian3.fromDegrees(lo, la, 800)
          )
          shadows.add({
            positions: shadowPositions,
            width: 3.5,
            material: Cesium.Material.fromType('Color', {
              color: Cesium.Color.fromCssColorString('#000000').withAlpha(0.15),
            }),
          })
          const positions = route.coords.map(([lo, la]) =>
            Cesium.Cartesian3.fromDegrees(lo, la, 20_000)
          )
          lines.add({
            positions,
            width: 1.5,
            material: Cesium.Material.fromType('PolylineGlow', {
              glowPower: 0.18,
              color: Cesium.Color.fromCssColorString('#00CFFF').withAlpha(0.6),
            }),
          })
        })

        setTelemetry(t => ({ ...t, MARITIME_LANES: SHIPPING_ROUTES.length }))
        setLayerStatus(s => ({ ...s, MARITIME_LANES: 'active' }))
        break
      }

      // ── FIBER_CABLES ───────────────────────────────────────────────────────
      case 'FIBER_CABLES': {
        const shadows = new Cesium.PolylineCollection()
        const lines = new Cesium.PolylineCollection()
        viewer.scene.primitives.add(shadows)
        viewer.scene.primitives.add(lines)
        ld.FIBER_CABLES.shadows = shadows
        ld.FIBER_CABLES.lines = lines

        try {
          // /proxy/cables → Vite server-side proxy to www.submarinecablemap.com (bypasses CORS)
          const cableUrls = [
            '/proxy/cables',
            'https://www.submarinecablemap.com/api/v3/cable/cable-geo.json',
          ]
          let res
          for (const cu of cableUrls) {
            try {
              res = await fetchWithRetry(cu, {}, 2, 20_000)
              break
            } catch {
              /* try next */
            }
          }
          if (!res) throw new Error('All cable sources failed')
          const json = await res.json()
          let count = 0
          let colorIdx = 0
            ; (json.features || []).forEach(feature => {
              const geom = feature.geometry
              if (!geom) return
              const color = CABLE_COLORS[colorIdx % CABLE_COLORS.length]
              colorIdx++

              const processLineString = coords => {
                if (!coords || coords.length < 2) return
                const filtered = coords.filter(c => isFinite(c[0]) && isFinite(c[1]))
                if (filtered.length < 2) return

                // Shadow trace — dark, wide, at ocean floor level
                shadows.add({
                  positions: filtered.map(c => Cesium.Cartesian3.fromDegrees(c[0], c[1], 600)),
                  width: 3,
                  material: Cesium.Material.fromType('Color', {
                    color: Cesium.Color.fromCssColorString('#000000').withAlpha(0.16),
                  }),
                })
                // Main cable — raised above surface, glowing
                lines.add({
                  positions: filtered.map(c => Cesium.Cartesian3.fromDegrees(c[0], c[1], 20_000)),
                  width: 1.5,
                  material: Cesium.Material.fromType('PolylineGlow', {
                    glowPower: 0.22,
                    color,
                  }),
                })
                count++
              }

              if (geom.type === 'MultiLineString') {
                geom.coordinates.forEach(processLineString)
              } else if (geom.type === 'LineString') {
                processLineString(geom.coordinates)
              }
            })

          setTelemetry(t => ({ ...t, FIBER_CABLES: count }))
          setLayerStatus(s => ({ ...s, FIBER_CABLES: 'active' }))
        } catch (err) {
          console.warn('FIBER_CABLES fetch failed:', err.message)
          setLayerStatus(s => ({ ...s, FIBER_CABLES: 'error' }))
        }
        break
      }

      // ── TECTONIC_PLATES ────────────────────────────────────────────────────
      case 'TECTONIC_PLATES': {
        const shadows = new Cesium.PolylineCollection()
        const lines = new Cesium.PolylineCollection()
        viewer.scene.primitives.add(shadows)
        viewer.scene.primitives.add(lines)
        ld.TECTONIC_PLATES.shadows = shadows
        ld.TECTONIC_PLATES.lines = lines

        try {
          const res = await fetchWithRetry(
            'https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json'
          )
          const json = await res.json()
          let count = 0
          const glowColor = Cesium.Color.fromCssColorString('#FF8C00').withAlpha(0.55)

          const processLineString = coords => {
            if (!coords || coords.length < 2) return
            const filtered = coords.filter(c => isFinite(c[0]) && isFinite(c[1]))
            if (filtered.length < 2) return

            // Shadow trace — dark amber halo at surface
            shadows.add({
              positions: filtered.map(c => Cesium.Cartesian3.fromDegrees(c[0], c[1], 700)),
              width: 3,
              material: Cesium.Material.fromType('Color', {
                color: Cesium.Color.fromCssColorString('#000000').withAlpha(0.16),
              }),
            })
            // Main boundary — raised, glowing amber
            lines.add({
              positions: filtered.map(c => Cesium.Cartesian3.fromDegrees(c[0], c[1], 18_000)),
              width: 1.5,
              material: Cesium.Material.fromType('PolylineGlow', {
                glowPower: 0.2,
                color: glowColor,
              }),
            })
            count++
          }

            ; (json.features || []).forEach(f => {
              const geom = f.geometry
              if (!geom) return
              if (geom.type === 'MultiLineString') {
                geom.coordinates.forEach(processLineString)
              } else if (geom.type === 'LineString') {
                processLineString(geom.coordinates)
              }
            })

          setTelemetry(t => ({ ...t, TECTONIC_PLATES: count }))
          setLayerStatus(s => ({ ...s, TECTONIC_PLATES: 'active' }))
        } catch (err) {
          console.warn('TECTONIC_PLATES fetch failed:', err.message)
          setLayerStatus(s => ({ ...s, TECTONIC_PLATES: 'error' }))
        }
        break
      }

      // ── CLOUD_SYSTEMS ──────────────────────────────────────────────────────
      case 'CLOUD_SYSTEMS': {
        // Cesium CloudCollection: 3D volumetric cloud sprites raised above the globe.
        // Each CumulusCloud has real depth (maximumSize.z) visible when tilting the view.
        // No tile seams, no satellite swath boundaries — purely procedural coverage.
        const cloudCollection = new Cesium.CloudCollection({
          show: true,
          noiseDetail: 16.0,
          noiseOffset: Cesium.Cartesian3.ZERO,
        })
        viewer.scene.primitives.add(cloudCollection)
        ld.CLOUD_SYSTEMS.cloudCollection = cloudCollection

        // Global cloud bands modeled on actual atmospheric circulation:
        //   ITCZ         — tropical convergence zone, ±10° lat, heavy coverage
        //   Mid-lat N/S  — westerly storm tracks, 35–65° both hemispheres
        //   Subtropical  — marine stratocumulus off west coasts, 10–35°
        //   Polar fronts — 65–85° both hemispheres
        const BANDS = [
          {
            latMin: -10,
            latMax: 10,
            count: 110,
            altMin: 4000,
            altMax: 14000,
            sizeMin: 200000,
            sizeMax: 650000,
          },
          {
            latMin: 35,
            latMax: 65,
            count: 90,
            altMin: 5000,
            altMax: 16000,
            sizeMin: 250000,
            sizeMax: 700000,
          },
          {
            latMin: -65,
            latMax: -35,
            count: 90,
            altMin: 5000,
            altMax: 16000,
            sizeMin: 250000,
            sizeMax: 700000,
          },
          {
            latMin: 10,
            latMax: 35,
            count: 50,
            altMin: 1500,
            altMax: 5000,
            sizeMin: 120000,
            sizeMax: 450000,
          },
          {
            latMin: -35,
            latMax: -10,
            count: 50,
            altMin: 1500,
            altMax: 5000,
            sizeMin: 120000,
            sizeMax: 450000,
          },
          {
            latMin: 65,
            latMax: 85,
            count: 30,
            altMin: 2000,
            altMax: 9000,
            sizeMin: 150000,
            sizeMax: 500000,
          },
          {
            latMin: -85,
            latMax: -65,
            count: 30,
            altMin: 2000,
            altMax: 9000,
            sizeMin: 150000,
            sizeMax: 500000,
          },
        ]

        let totalClouds = 0
        BANDS.forEach(band => {
          for (let i = 0; i < band.count; i++) {
            const lon = Math.random() * 360 - 180
            const lat = band.latMin + Math.random() * (band.latMax - band.latMin)
            const alt = band.altMin + Math.random() * (band.altMax - band.altMin)
            const w = band.sizeMin + Math.random() * (band.sizeMax - band.sizeMin)
            const h = w * (0.12 + Math.random() * 0.18) // height 12–30% of width
            const d = w * (0.25 + Math.random() * 0.3) // depth  25–55% of width

            cloudCollection.add({
              position: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
              scale: new Cesium.Cartesian2(w, h),
              maximumSize: new Cesium.Cartesian3(w, h, d),
              slice: 0.15 + Math.random() * 0.4,
              brightness: 0.82 + Math.random() * 0.18,
            })
            totalClouds++
          }
        })

        setTelemetry(t => ({ ...t, CLOUD_SYSTEMS: totalClouds }))
        setLayerStatus(s => ({ ...s, CLOUD_SYSTEMS: 'active' }))
        break
      }

      // ── SOLAR_SYNC ─────────────────────────────────────────────────────────
      case 'SOLAR_SYNC': {
        viewer.scene.globe.enableLighting = true
        viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date())
        viewer.clock.shouldAnimate = false
        ld.SOLAR_SYNC.enabled = true

        // Keep clock synced to real time
        tickCoordinator.registerSlow('SOLAR_SYNC', () => {
          if (!ld.SOLAR_SYNC._tick) ld.SOLAR_SYNC._tick = 0
          ld.SOLAR_SYNC._tick++
          if (ld.SOLAR_SYNC._tick >= 10) {
            ld.SOLAR_SYNC._tick = 0
            if (ld.SOLAR_SYNC.enabled) {
              viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date())
            }
          }
        })

        const now = new Date()
        const utcStr = now.toUTCString().split(' ').slice(0, 5).join(' ')
        setTelemetry(t => ({ ...t, SOLAR_SYNC: utcStr }))
        setLayerStatus(s => ({ ...s, SOLAR_SYNC: 'active' }))
        break
      }

      // ── VISUAL_FX ──────────────────────────────────────────────────────────
      case 'VISUAL_FX': {
        ld.VISUAL_FX.enabled = true
        if (vfxRef && vfxRef.current) {
          vfxRef.current.classList.add('active')
        }
        setTelemetry(t => ({ ...t, VISUAL_FX: 1 }))
        setLayerStatus(s => ({ ...s, VISUAL_FX: 'active' }))
        break
      }

      default:
        setLayerStatus(s => ({ ...s, [layerId]: 'error' }))
    }
  } catch (err) {
    console.error(`Layer ${layerId} activation error:`, err)
    setLayerStatus(s => ({ ...s, [layerId]: 'error' }))
  }
}

function deactivateLayer(viewer, layerDataRef, layerId, setTelemetry, setLayerStatus, vfxRef) {
  const ld = layerDataRef.current

  switch (layerId) {
    case 'AIR_RADAR': {
      tickCoordinator.unregister('AIR_RADAR')
      if (ld.AIR_RADAR.points) {
        viewer.scene.primitives.remove(ld.AIR_RADAR.points)
        ld.AIR_RADAR.points = null
      }
      break
    }
    case 'ORBITAL_MATH': {
      tickCoordinator.unregister('ORBITAL_MATH')
      if (ld.ORBITAL_MATH.points) {
        viewer.scene.primitives.remove(ld.ORBITAL_MATH.points)
        ld.ORBITAL_MATH.points = null
      }
      if (ld.ORBITAL_MATH.arcs) {
        viewer.scene.primitives.remove(ld.ORBITAL_MATH.arcs)
        ld.ORBITAL_MATH.arcs = null
      }
      ld.ORBITAL_MATH.tleData = []
      ld.ORBITAL_MATH.history = {}
      break
    }
    case 'SEISMIC_GRID': {
      tickCoordinator.unregister('SEISMIC_GRID')
      if (ld.SEISMIC_GRID.shadows) {
        viewer.scene.primitives.remove(ld.SEISMIC_GRID.shadows)
        ld.SEISMIC_GRID.shadows = null
      }
      if (ld.SEISMIC_GRID.primitives) {
        viewer.scene.primitives.remove(ld.SEISMIC_GRID.primitives)
        ld.SEISMIC_GRID.primitives = null
      }
      break
    }
    case 'THERMAL_FIRES': {
      tickCoordinator.unregister('THERMAL_FIRES')
      if (ld.THERMAL_FIRES.points) {
        viewer.scene.primitives.remove(ld.THERMAL_FIRES.points)
        ld.THERMAL_FIRES.points = null
      }
      break
    }
    case 'MARITIME_LANES': {
      if (ld.MARITIME_LANES.shadows) {
        viewer.scene.primitives.remove(ld.MARITIME_LANES.shadows)
        ld.MARITIME_LANES.shadows = null
      }
      if (ld.MARITIME_LANES.lines) {
        viewer.scene.primitives.remove(ld.MARITIME_LANES.lines)
        ld.MARITIME_LANES.lines = null
      }
      break
    }
    case 'FIBER_CABLES': {
      if (ld.FIBER_CABLES.shadows) {
        viewer.scene.primitives.remove(ld.FIBER_CABLES.shadows)
        ld.FIBER_CABLES.shadows = null
      }
      if (ld.FIBER_CABLES.lines) {
        viewer.scene.primitives.remove(ld.FIBER_CABLES.lines)
        ld.FIBER_CABLES.lines = null
      }
      break
    }
    case 'TECTONIC_PLATES': {
      if (ld.TECTONIC_PLATES.shadows) {
        viewer.scene.primitives.remove(ld.TECTONIC_PLATES.shadows)
        ld.TECTONIC_PLATES.shadows = null
      }
      if (ld.TECTONIC_PLATES.lines) {
        viewer.scene.primitives.remove(ld.TECTONIC_PLATES.lines)
        ld.TECTONIC_PLATES.lines = null
      }
      break
    }
    case 'CLOUD_SYSTEMS': {
      if (ld.CLOUD_SYSTEMS.cloudCollection) {
        viewer.scene.primitives.remove(ld.CLOUD_SYSTEMS.cloudCollection)
        ld.CLOUD_SYSTEMS.cloudCollection = null
      }
      break
    }
    case 'SOLAR_SYNC': {
      tickCoordinator.unregister('SOLAR_SYNC')
      ld.SOLAR_SYNC.enabled = false
      viewer.scene.globe.enableLighting = false
      break
    }
    case 'VISUAL_FX': {
      ld.VISUAL_FX.enabled = false
      if (vfxRef && vfxRef.current) {
        vfxRef.current.classList.remove('active')
      }
      break
    }
    default:
      break
  }

  setTelemetry(t => ({ ...t, [layerId]: 0 }))
  setLayerStatus(s => ({ ...s, [layerId]: 'idle' }))
}

// ─── INITIAL STATE HELPERS ────────────────────────────────────────────────────
function buildInitialToggles() {
  return Object.fromEntries(LAYER_DEFS.map(l => [l.id, false]))
}
function buildInitialTelemetry() {
  return Object.fromEntries(LAYER_DEFS.map(l => [l.id, 0]))
}
function buildInitialStatus() {
  return Object.fromEntries(LAYER_DEFS.map(l => [l.id, 'idle']))
}
function buildInitialLayerData() {
  return {
    AIR_RADAR: { points: null, interval: null },
    ORBITAL_MATH: { points: null, arcs: null, interval: null, tleData: [], history: {} },
    SEISMIC_GRID: { primitives: null, shadows: null, interval: null },
    THERMAL_FIRES: { points: null, interval: null },
    MARITIME_LANES: { lines: null, shadows: null },
    FIBER_CABLES: { lines: null, shadows: null },
    TECTONIC_PLATES: { lines: null, shadows: null },
    CLOUD_SYSTEMS: { cloudCollection: null },
    SOLAR_SYNC: { enabled: false, interval: null },
    VISUAL_FX: { enabled: false },
  }
}

// ─── CLOCK HOOK ───────────────────────────────────────────────────────────────
function useUtcClock() {
  const [utc, setUtc] = useState('')
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const pad = n => String(n).padStart(2, '0')
      setUtc(
        `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ` +
        `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return utc
}

// ─── LAYER ROW COMPONENT ──────────────────────────────────────────────────────
function LayerRow({ def, toggled, status, telemetry, onToggle }) {
  const count = telemetry[def.id]
  // String telemetry (e.g. SOLAR_SYNC UTC time) renders as-is; numbers get " pts" suffix
  const countLabel =
    status[def.id] === 'error'
      ? 'UNAVAILABLE'
      : typeof count === 'string' && count.length > 0
        ? count
        : `${(typeof count === 'number' ? count : 0).toLocaleString()} pts`

  return (
    <label className="layer-row">
      <span className={`status-dot ${status[def.id] || 'idle'}`} />
      <div className="layer-info">
        <div className={`layer-name${toggled ? ' active-name' : ''}`}>{def.label}</div>
        <div className="layer-count">{countLabel}</div>
      </div>
      <input
        type="checkbox"
        className="layer-toggle"
        checked={toggled}
        onChange={() => onToggle(def.id)}
      />
    </label>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const cesiumContainerRef = useRef(null)
  const viewerRef = useRef(null)
  const layerDataRef = useRef(buildInitialLayerData())
  const vfxGrainRef = useRef(null)

  const [toggles, setToggles] = useState(buildInitialToggles)
  const [telemetry, setTelemetry] = useState(buildInitialTelemetry)
  const [layerStatus, setLayerStatus] = useState(buildInitialStatus)
  const [viewerState, setViewerState] = useState(null)
  const initErrorRef = useRef(null)

  const utc = useUtcClock()

  const telemetryStateRef = useRef(telemetry)

  // ── Singleton Cesium init ─────────────────────────────────────────────────
  useEffect(() => {
    tickCoordinator.start()
    initPerfMonitor(telemetryStateRef)

    if (viewerRef.current) return
    if (!cesiumContainerRef.current) return

    let viewer
    try {
      viewer = new Cesium.Viewer(cesiumContainerRef.current, {
        baseLayer: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        vrButton: false,
        infoBox: false,
        selectionIndicator: false,
        skyAtmosphere: false, // no blue haze; skyBox left default for starfield
      })

      // Dark globe appearance
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0d1520')
      viewer.scene.globe.showGroundAtmosphere = false
      viewer.scene.fog.enabled = false
      if (viewer.scene.moon) viewer.scene.moon.show = false
      if (viewer.scene.sun) viewer.scene.sun.show = false // no sun glare
      viewer.scene.globe.enableLighting = false

      // Base imagery: ESRI World Imagery tile template (synchronous, no async fromUrl needed)
      // Google Earth-quality global satellite mosaic, no API key required.
      viewer.imageryLayers.removeAll()
      const baseLayer = viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          maximumLevel: 19,
          credit: 'Esri, DigitalGlobe, GeoEye, Earthstar Geographics, USDA NAIP',
        })
      )
      baseLayer.brightness = 0.9
      baseLayer.saturation = 0.9
      baseLayer.contrast = 1.1

      // Bloom post-processing
      try {
        viewer.scene.postProcessStages.bloom.enabled = true
        viewer.scene.postProcessStages.bloom.uniforms.glowOnly = false
        viewer.scene.postProcessStages.bloom.uniforms.contrast = 128
        viewer.scene.postProcessStages.bloom.uniforms.brightness = -0.3
        viewer.scene.postProcessStages.bloom.uniforms.delta = 1.0
        viewer.scene.postProcessStages.bloom.uniforms.sigma = 3.78
        viewer.scene.postProcessStages.bloom.uniforms.stepSize = 5.0
      } catch {
        /* bloom not supported in all environments */
      }

      // Always-on tactical coastlines (loaded async, non-blocking)
      const coastlineLines = new Cesium.PolylineCollection()
      viewer.scene.primitives.add(coastlineLines)
      fetch('/proxy/coastlines')
        .then(r => r.json())
        .then(json => {
          const drawLine = coords => {
            if (!coords || coords.length < 2) return
            const positions = coords
              .filter(c => Array.isArray(c) && isFinite(c[0]) && isFinite(c[1]))
              .map(c => Cesium.Cartesian3.fromDegrees(c[0], c[1], 1000))
            if (positions.length < 2) return
            coastlineLines.add({
              positions,
              width: 1,
              material: Cesium.Material.fromType('Color', {
                color: Cesium.Color.fromCssColorString('#00FF9F').withAlpha(0.18),
              }),
            })
          }
            ; (json.features || []).forEach(f => {
              const g = f.geometry
              if (!g) return
              if (g.type === 'LineString') drawLine(g.coordinates)
              else if (g.type === 'MultiLineString') g.coordinates.forEach(drawLine)
            })
        })
        .catch(() => {
          /* coastlines optional */
        })

      // Full globe view: camera directly above equator, 20,000km up.
      // pitch=-PI/2 (straight down) ensures the entire globe disc is always in frame.
      // Stars fill the space around the globe's edges thanks to the default skyBox.
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(10, 0, 20_000_000),
        orientation: {
          heading: 0.0,
          pitch: -Cesium.Math.PI_OVER_TWO,
          roll: 0.0,
        },
      })

      // Performance: disable MSAA on mobile/tablet
      viewer.scene.msaaSamples = 1

      viewerRef.current = viewer
      setViewerState(viewer)

      // Capture ref value for cleanup
      const layerData = layerDataRef.current

      // ── Saved Views Keyboard Shortcuts
      const handleKeyDown = (e) => {
        // Must hold Alt to trigger saved views
        if (!e.altKey) return

        const match = e.code.match(/^Digit([1-9])$/)
        if (!match) return

        const slot = match[1]
        const v = viewerRef.current
        if (!v || v.isDestroyed()) return

        if (e.shiftKey) {
          // SAVE mode
          e.preventDefault()
          const cam = {
            position: v.camera.positionCartographic.clone(),
            heading: v.camera.heading,
            pitch: v.camera.pitch,
            roll: v.camera.roll
          }

          setToggles(currentToggles => {
            const activeLayers = Object.entries(currentToggles)
              .filter(([, isActive]) => isActive)
              .map(([id]) => id)

            saveView(slot, `View ${slot}`, cam, activeLayers).then(() => {
              emitAudit('ui', 'VIEW_SAVED', `Saved view to slot ${slot}`)
            })

            return currentToggles
          })
        } else {
          // LOAD mode
          e.preventDefault()
          const saved = viewStore.savedViews[slot]
          if (!saved) return

          if (saved.camera && saved.camera.position) {
            const pos = saved.camera.position
            v.camera.flyTo({
              destination: Cesium.Cartesian3.fromRadians(pos.longitude, pos.latitude, pos.height),
              orientation: { heading: saved.camera.heading, pitch: saved.camera.pitch, roll: saved.camera.roll },
              duration: viewStore.flyMode === 'fast' ? 0.5 : (viewStore.flyMode === 'cinematic' ? 4 : 1.5)
            })
          }

          if (saved.layers) {
            setToggles(currentToggles => {
              const newToggles = { ...currentToggles }
              const desired = new Set(saved.layers)

              Object.keys(newToggles).forEach(layerId => {
                if (newToggles[layerId] && !desired.has(layerId)) {
                  newToggles[layerId] = false
                  deactivateLayer(v, layerDataRef, layerId, setTelemetry, setLayerStatus, vfxGrainRef)
                }
              })

              desired.forEach(layerId => {
                if (!newToggles[layerId]) {
                  newToggles[layerId] = true
                  activateLayer(v, layerDataRef, layerId, setTelemetry, setLayerStatus, vfxGrainRef)
                }
              })

              return newToggles
            })
          }
          emitAudit('ui', 'VIEW_LOADED', `Loaded view from slot ${slot}`)
        }
      }

      const handleLoadScenario = (e) => {
        const scenario = e.detail
        if (!scenario) return

        const v = viewerRef.current
        if (!v || v.isDestroyed()) return

        // 1. Restore Camera
        if (scenario.camera && scenario.camera.position) {
          const pos = scenario.camera.position
          v.camera.flyTo({
            destination: Cesium.Cartesian3.fromRadians(pos.longitude, pos.latitude, pos.height),
            orientation: { heading: scenario.camera.heading, pitch: scenario.camera.pitch, roll: scenario.camera.roll },
            duration: viewStore.flyMode === 'fast' ? 0.5 : (viewStore.flyMode === 'cinematic' ? 4 : 1.5)
          })
        }

        // 2. Restore Layers
        if (scenario.layers) {
          setToggles(currentToggles => {
            const newToggles = { ...currentToggles }
            const desired = new Set(scenario.layers)

            Object.keys(newToggles).forEach(layerId => {
              if (newToggles[layerId] && !desired.has(layerId)) {
                newToggles[layerId] = false
                deactivateLayer(v, layerDataRef, layerId, setTelemetry, setLayerStatus, vfxGrainRef)
              }
            })

            desired.forEach(layerId => {
              if (!newToggles[layerId]) {
                newToggles[layerId] = true
                activateLayer(v, layerDataRef, layerId, setTelemetry, setLayerStatus, vfxGrainRef)
              }
            })

            return newToggles
          })
        }
        emitAudit('ui', 'SCENARIO_LOADED', `Loaded scenario: ${scenario.name || 'Unnamed'}`)
      }

      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('dexearth:loadScenario', handleLoadScenario)

      return () => {
        window.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('dexearth:loadScenario', handleLoadScenario)
        tickCoordinator.stop()
        stopPerfMonitor()
        // Clean up all layer intervals
        Object.values(layerData).forEach(layer => {
          if (layer && layer.interval) clearInterval(layer.interval)
        })
        if (viewer && !viewer.isDestroyed()) {
          viewer.destroy()
        }
        viewerRef.current = null
      }
    } catch (err) {
      console.error('Cesium init error:', err)
      // Write error to DOM directly to avoid lint rule against setState-in-effect
      if (initErrorRef.current) {
        initErrorRef.current.textContent = 'CESIUM INIT ERROR: ' + (err.message || String(err))
        initErrorRef.current.style.display = 'block'
      }
    }
  }, [])

  // ── Toggle handler ────────────────────────────────────────────────────────
  const handleToggle = useCallback(layerId => {
    setToggles(prev => {
      const newVal = !prev[layerId]
      const viewer = viewerRef.current
      if (!viewer || viewer.isDestroyed()) return prev

      if (newVal) {
        activateLayer(viewer, layerDataRef, layerId, setTelemetry, setLayerStatus, vfxGrainRef)
      } else {
        deactivateLayer(viewer, layerDataRef, layerId, setTelemetry, setLayerStatus, vfxGrainRef)
      }

      return { ...prev, [layerId]: newVal }
    })
  }, [])

  return (
    <div className="app">
      {/* Cesium Globe */}
      <div ref={cesiumContainerRef} className="globe" />

      {/* Init error display (hidden by default, shown by DOM ref on error) */}
      <div
        ref={initErrorRef}
        style={{
          display: 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          right: '280px',
          zIndex: 999,
          background: '#1a0000',
          color: '#ff6666',
          fontFamily: 'monospace',
          fontSize: '11px',
          padding: '12px 16px',
          borderBottom: '1px solid #ff4444',
          wordBreak: 'break-all',
        }}
      />

      {/* VFX: Film grain (toggled via class) */}
      <div ref={vfxGrainRef} className="vfx-grain" />

      {/* VFX: Persistent vignette */}
      <div className="vfx-vignette" />

      {/* HUD Overlay — Now completely managed by Top Nav Drawers */}
      <PhaseIIRoot
        viewer={viewerState}
        toggles={toggles}
        handleToggle={handleToggle}
        layerStatus={layerStatus}
        telemetry={telemetry}
        utc={utc}
      />
    </div>
  )
}
