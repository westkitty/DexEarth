// Development-server integration audit. Remote replies below are labeled FIXTURES,
// not evidence of current upstream freshness. No API key is supplied or invented.
import { chromium, expect } from '@playwright/test'
import process from 'node:process'
import { mkdirSync, writeFileSync } from 'node:fs'
const output = process.env.DEXEARTH_EVIDENCE || 'test-results/layer-audit'
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
})
const results = [],
  errors = []
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', msg => {
    if (msg.type() === 'error' && msg.text().includes('rendering has stopped'))
      errors.push(msg.text())
  })
  const line = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'AUDIT FIXTURE' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [143, 37],
            [144, 38],
          ],
        },
      },
    ],
  }
  await context.route('**/proxy/flights', r =>
    r.fulfill({
      json: {
        ac: [{ hex: 'fixture', flight: 'AUDIT FIXTURE', lon: 143, lat: 37, alt_baro: 30000 }],
      },
    })
  )
  await context.route('**/earthquakes/feed/**', r =>
    r.fulfill({
      json: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'audit-fixture',
            properties: { title: 'AUDIT FIXTURE', mag: 6 },
            geometry: { type: 'Point', coordinates: [143, 37, 10] },
          },
        ],
      },
    })
  )
  await context.route('**/proxy/cables', r => r.fulfill({ json: line }))
  await context.route('**/tectonicplates/**', r => r.fulfill({ json: line }))
  await page.goto(process.env.DEXEARTH_DEV_URL || 'http://localhost:3000')
  await page.getByRole('button', { name: 'SKIP', exact: true }).click()
  for (const id of [
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
  ]) {
    await page.getByRole('checkbox', { name: new RegExp(`^${id}`) }).check()
  }
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const reg = await import('/src/state/layerRegistry.js')
        return [
          'AIR_RADAR',
          'SEISMIC_GRID',
          'FIBER_CABLES',
          'TECTONIC_PLATES',
          'MARITIME_LANES',
        ].every(id => {
          const s = reg.getGeometrySnapshot(id)
          return (s?.points?.length || 0) + (s?.lines?.length || 0) > 0
        })
      })
    )
    .toBe(true)
  const optional = await page.evaluate(async () => {
    const d = await import('/src/data/datasetStatus.js')
    return d.datasetState(d.getActiveDataset('firms_active_fires'))
  })
  expect(optional).toBe('OPTIONAL KEY MISSING')
  results.push(
    'All ten primary toggles exercised; aircraft/USGS/cables/tectonic FIXTURE geometry and static maritime geometry reach registry; FIRMS explicitly key-missing'
  )
  await page.locator('#tour-tab-satellites').click()
  await page.getByLabel('Select satellite (or tap globe)').selectOption('25544')
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await import('/src/layers/satellites/layer.js')).satellitesLayer.getRenderStats().lines
      )
    )
    .toBeGreaterThan(0)
  await page.getByLabel('Select satellite (or tap globe)').selectOption('')
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await import('/src/layers/satellites/layer.js')).satellitesLayer.getRenderStats().lines
      )
    )
    .toBe(0)
  results.push(
    'Selected paths rendered in real Cesium collections; deselection removes every selected-path primitive'
  )
  await page.locator('#tour-tab-threat').click()
  await page.getByRole('button', { name: '▶ ACTIVATE', exact: true }).click()
  const score = await page.evaluate(
    async () =>
      (await import('/src/layers/threatIndex/layer.js')).threatIndexLayer.getCellAtLonLat(143, 37)
        ?.score
  )
  expect(score).toBeGreaterThan(0)
  results.push(
    'Threat recomputation consumes registered FIXTURE geometry and produces a nonzero local heuristic score'
  )
  await page.locator('#tour-tab-seismic').click()
  await page.getByRole('button', { name: '▶ ACTIVATE', exact: true }).click()
  await page.getByRole('button', { name: 'Japan', exact: true }).click()
  await page.locator('#tour-tab-tools').click()
  await page
    .getByText('📍 MARKERS', { exact: true })
    .locator('..')
    .getByRole('button', { name: '▶ ACTIVATE', exact: true })
    .click()
  await page
    .getByText('⚠ ALERTS', { exact: true })
    .locator('..')
    .getByRole('button', { name: '▶ ACTIVATE', exact: true })
    .click()
  const local = await page.evaluate(async () => {
    const { markersLayer } = await import('/src/layers/markers/layer.js')
    const { alertsLayer } = await import('/src/layers/alerts/layer.js')
    const { seismicSimLayer } = await import('/src/layers/seismicSim/layer.js')
    const { cascadeModel } = await import('/src/layers/cascade/model.js')
    const { getLayer } = await import('/src/state/layerRegistry.js')
    const { getSessionEvents } = await import('/src/state/sessionEvents.js')
    await markersLayer.addMarker({ lon: 143, lat: 37, title: 'AUDIT LOCAL MARKER' })
    await alertsLayer.addCircleGeofence({
      lon: 143,
      lat: 37,
      radiusKm: 100,
      name: 'AUDIT LOCAL FENCE',
    })
    cascadeModel.triggerEvent('cable_sever')
    const degraded = getLayer('AIR_RADAR').degradation?.refreshInterval
    cascadeModel.reset()
    const seismicEvents = seismicSimLayer.getEvents()
    const simulationCategories = getSessionEvents()
      .filter(e => ['seismic', 'cascade'].includes(e.type))
      .map(e => e.category)
    return {
      markerCount: markersLayer.getMarkers().length,
      fenceCount: alertsLayer.getGeofences().length,
      seismicCount: seismicEvents.length,
      degraded,
      reset: getLayer('AIR_RADAR').degradation,
      simulationCategories,
    }
  })
  expect(local.markerCount).toBe(1)
  expect(local.fenceCount).toBe(1)
  expect(local.seismicCount).toBe(1)
  expect(local.degraded).toBe(120000)
  expect(local.reset).toBeNull()
  expect(local.simulationCategories.every(c => c === 'LOCAL SIMULATION')).toBe(true)
  const correlation = await page.evaluate(async () => {
    const { correlationTool } = await import('/src/layers/correlation/tool.js')
    const reg = await import('/src/state/layerRegistry.js')
    return correlationTool.run({
      snap1: reg.getGeometrySnapshot('MARKERS'),
      snap2: reg.getGeometrySnapshot('SEISMIC_GRID'),
      operation: 'p2p',
      radiusKm: 100,
    }).hitCount
  })
  expect(correlation).toBeGreaterThan(0)
  results.push(
    'Marker/geofence creation, simulated seismic event, cascade degradation/reset, simulation categorization, and cross-layer correlation: PASS'
  )
  // Activate the actual cinematic controller through its existing panel.
  await page.getByRole('button', { name: /Global Fiber Backbone/ }).click()
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await import('/src/layers/cinematic/controller.js')).cinematicController.isPlaying()
      )
    )
    .toBe(true)
  await page.getByRole('button', { name: '⏸ Pause', exact: true }).click()
  results.push('Cinematic tour start/pause: PASS')
  await page.locator('#tour-tab-time').click()
  await page.getByLabel('Multi-tab role').selectOption('follower')
  await page.evaluate(() => {
    const c = new BroadcastChannel('dexearth')
    c.postMessage({ type: 'state', timeMs: 1700000000000 })
    c.close()
  })
  await expect
    .poll(() =>
      page.evaluate(async () => (await import('/src/state/timeController.js')).getTimeMs())
    )
    .toBe(1700000000000)
  await page.getByLabel('Multi-tab role').selectOption('leader')
  results.push(
    'BroadcastChannel follower receives a second same-origin channel clock message; leader/follower controls are present'
  )
  await page.locator('#tour-tab-visuals').click()
  await page
    .getByRole('button', { name: /🌐 Overlays/ })
    .filter({ visible: true })
    .click()
  await page.getByRole('checkbox', { name: 'Country Borders', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Country Borders', exact: true })).toBeChecked()
  await page.getByRole('checkbox', { name: 'Country Labels (Inside)', exact: true }).click()
  await expect(
    page.getByRole('checkbox', { name: 'Country Labels (Inside)', exact: true })
  ).toBeChecked()
  await page.getByRole('checkbox', { name: 'Labels (Follow Borders)', exact: true }).click()
  await expect(
    page.getByRole('checkbox', { name: 'Labels (Follow Borders)', exact: true })
  ).toBeChecked()
  await expect
    .poll(() =>
      page.evaluate(
        async () => (await import('/src/overlays/countries/index.js')).getCountryFeatures().length
      )
    )
    .toBeGreaterThan(0)
  // Use the restored workspace camera API to check LOD below 1,500 km.
  await page.evaluate(async () => {
    const w = await import('/src/state/workspace.js')
    const snap = w.captureWorkspace()
    snap.camera = { ...snap.camera, lon: -84, lat: 44, alt: 1000000 }
    w.applyWorkspace(snap)
  })
  await expect
    .poll(
      () =>
        page.evaluate(async () =>
          (await import('/src/overlays/countries/index.js'))
            .getCountryFeatures()
            .some(f => f.properties.feature_type === 'state')
        ),
      { timeout: 20000 }
    )
    .toBe(true)
  for (const id of ['REALISTIC', 'CEL_SHADED', 'HOLOGRAM', 'WIREFRAME', 'NIGHT_OPS']) {
    await page.evaluate(
      async id => (await import('/src/visuals/styleManager.js')).applyPreset(id),
      id
    )
    await page.waitForTimeout(300)
  }
  results.push(
    'Country borders, inside/follow labels, state/province LOD at 1,000 km, and all five style presets: PASS'
  )
  await page.locator('#tour-tab-data').click()
  await page.getByRole('checkbox', { name: /^AIR_RADAR/ }).uncheck()
  expect(
    await page.evaluate(async () =>
      (await import('/src/state/layerRegistry.js')).getGeometrySnapshot('AIR_RADAR')
    )
  ).toBeNull()
  expect(errors).toEqual([])
} finally {
  writeFileSync(
    `${output}/layer-audit.json`,
    JSON.stringify({ results, pageErrors: errors, externalData: 'FIXTURES ONLY' }, null, 2)
  )
  console.log(results.join('\n'))
  console.log('Page errors:', errors)
  await browser.close()
}
