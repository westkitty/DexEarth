import { Buffer } from 'node:buffer'
// Browser-emulated validation; run against a production preview for offline checks.
import { chromium, expect } from '@playwright/test'
import process from 'node:process'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
const base = process.env.DEXEARTH_URL || 'http://localhost:4173'
const output = process.env.DEXEARTH_EVIDENCE || 'test-results/browser'
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
const errors = [],
  results = []
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    hasTouch: true,
  })
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(base)
  await page.getByRole('button', { name: 'SKIP', exact: true }).click()
  await page.locator('#tour-tab-satellites').click()
  await page.getByRole('button', { name: 'Activate satellites', exact: true }).click()
  await expect(
    page.getByLabel('Select satellite (or tap globe)').locator('option[value="25544"]')
  ).toHaveCount(1)
  await page.getByLabel('Select satellite (or tap globe)').selectOption('25544')
  await expect(page.getByText('STALE ELEMENTS', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Save observer locally', exact: true }).click()
  await page.getByRole('button', { name: 'Predict next 24h passes', exact: true }).click()
  await expect(page.getByText('Rise/start:', { exact: false }).first()).toBeVisible()
  await expect(page.getByText(/Max: .*° at .* UTC/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Add to watchlist', exact: true }).click()
  results.push(
    'Bundled startup, selected inspector, pass prediction and watchlist add: PASS (not proof of remote freshness)'
  )
  await page.locator('#tour-tab-tools').click()
  const markerPanel = page.getByText('📍 MARKERS', { exact: true }).locator('..')
  await markerPanel.getByRole('button', { name: '▶ ACTIVATE', exact: true }).click()
  await markerPanel.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.getByLabel('Marker title', { exact: true }).fill('Validated local marker')
  for (const invalid of ['181', '12junk', '']) {
    await page.getByLabel('Marker longitude', { exact: true }).fill(invalid)
    await markerPanel.getByRole('button', { name: '✓ Save Marker', exact: true }).click()
    await expect(markerPanel.getByRole('alert')).toBeVisible()
    await expect(page.getByLabel('Marker title', { exact: true })).toHaveValue(
      'Validated local marker'
    )
  }
  await page.getByLabel('Marker longitude', { exact: true }).fill('12')
  await markerPanel.getByRole('button', { name: '✓ Save Marker', exact: true }).click()
  await expect(markerPanel.getByText('Validated local marker', { exact: true })).toBeVisible()
  await expect(markerPanel.getByRole('alert')).toHaveCount(0)
  results.push(
    'Invalid marker coordinates refused with recoverable inline errors; corrected marker saved: PASS'
  )
  await page.locator('#tour-tab-views').click()
  await page.getByRole('button', { name: 'Save Observation', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Load', exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Load', exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Load', exact: true }).first().click()
  page.once('dialog', dialog => dialog.accept('Renamed observation'))
  await page.getByRole('button', { name: 'Rename', exact: true }).first().click()
  await expect(page.getByText('Renamed observation', { exact: true })).toBeVisible()
  await page.getByLabel('Import observation JSON').setInputFiles({
    name: 'corrupt.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":99}'),
  })
  await expect(page.locator('[aria-label="Observation sets"] [role="alert"]')).toBeVisible()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON', exact: true }).first().click()
  const observationPath = `${output}/observation.json`
  await (await downloaded).saveAs(observationPath)
  const collision = JSON.parse(readFileSync(observationPath, 'utf8'))
  collision.workspace.markers = [
    { id: 1, title: 'numeric ID', lon: 0, lat: 0 },
    { id: '1', title: 'string ID', lon: 1, lat: 1 },
  ]
  await page.getByLabel('Import observation JSON').setInputFiles({
    name: 'colliding-markers.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(collision)),
  })
  await expect(page.locator('[aria-label="Observation sets"] [role="alert"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Load', exact: true })).toHaveCount(2)
  collision.workspace.markers = [{ id: 1, title: 'Bad metadata', lon: 0, lat: 0, tags: [null] }]
  await page.getByLabel('Import observation JSON').setInputFiles({
    name: 'invalid-marker-metadata.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(collision)),
  })
  await expect(page.locator('[aria-label="Observation sets"] [role="alert"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Load', exact: true })).toHaveCount(2)
  await page.getByLabel('Import observation JSON').setInputFiles(observationPath)
  await expect(page.getByRole('button', { name: 'Load', exact: true })).toHaveCount(3)
  results.push('Observation save, duplicate, load, export and validated re-import: PASS')
  await page.locator('#tour-tab-sessions').click()
  await page.getByRole('button', { name: 'Start recording', exact: true }).click()
  await page.locator('#tour-tab-satellites').click()
  await page.getByLabel('Select satellite (or tap globe)').selectOption('20580')
  await page.getByText('Satellite filters / display cap', { exact: true }).click()
  await page.getByLabel('Min altitude km', { exact: true }).fill('400')
  await page.getByLabel('Max altitude km', { exact: true }).fill('100')
  await expect(page.getByLabel('Min altitude km', { exact: true })).toHaveValue('100')
  await page.getByLabel('Min inclination °', { exact: true }).fill('100')
  await page.getByLabel('Max inclination °', { exact: true }).fill('40')
  await expect(page.getByLabel('Min inclination °', { exact: true })).toHaveValue('40')
  await page.getByLabel('Min altitude km', { exact: true }).fill('0')
  await page.getByLabel('Max altitude km', { exact: true }).fill('100000')
  await page.getByLabel('Min inclination °', { exact: true }).fill('0')
  await page.getByLabel('Max inclination °', { exact: true }).fill('180')
  await page.locator('#tour-tab-sessions').click()
  await page.getByRole('button', { name: 'Stop & save', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await page.getByRole('button', { name: 'Step', exact: true }).click()
  const replayDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export replay', exact: true }).click()
  const replayPath = `${output}/replay.json`
  await (await replayDownload).saveAs(replayPath)
  const recorded = JSON.parse(readFileSync(replayPath, 'utf8'))
  expect(recorded.events.some(e => e.workspace.orbit.filters.maxAlt === 100)).toBe(true)
  expect(recorded.events.some(e => e.workspace.orbit.filters.maxInclination === 40)).toBe(true)
  for (const e of recorded.events) {
    const f = e.workspace.orbit.filters
    expect(f.minAlt).toBeLessThanOrEqual(f.maxAlt)
    expect(f.minInclination).toBeLessThanOrEqual(f.maxInclination)
  }
  await page.getByLabel('Import replay JSON').setInputFiles(replayPath)
  await page.getByRole('button', { name: 'Exit replay / restore view', exact: true }).click()
  results.push(
    'Replay recording, selection sequence, play/pause/reset/step, export and import: PASS'
  )
  await page.locator('#tour-tab-views').click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
  await expect(page.getByRole('button', { name: 'Load', exact: true })).toHaveCount(2)
  results.push(
    'Observation rename, corrupt/colliding-marker/invalid-metadata import refusal and confirmed deletion: PASS'
  )
  results.push(
    'Crossed altitude/inclination edits recorded as valid ranges; peak pass UTC displayed: PASS'
  )
  // Reach production worker readiness before disconnecting everything.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 60000 })
  await context.setOffline(true)
  await page.reload()
  const skip = page.getByRole('button', { name: 'SKIP', exact: true })
  await skip.waitFor({ state: 'visible', timeout: 30000 })
  await skip.click()
  await page.locator('#tour-tab-satellites').click()
  await page.getByRole('button', { name: 'Activate satellites', exact: true }).click()
  await page.getByLabel('Select satellite (or tap globe)').selectOption('25544')
  await expect(
    page.getByRole('button', { name: 'Remove from watchlist', exact: true })
  ).toBeVisible()
  await page.locator('#tour-tab-views').click()
  await expect(page.getByRole('button', { name: 'Load', exact: true })).toHaveCount(2)
  results.push(
    'Fully offline production reload, bundled globe/TLE and durable watchlist/observations: PASS'
  )
  await context.setOffline(false)
  for (const [width, height] of [
    [1440, 1000],
    [768, 1024],
    [1024, 1366],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height })
    if (width < 768) {
      await page.getByRole('button', { name: 'Open Panels', exact: true }).click()
      await page.getByRole('button', { name: /🛰 Satellites.*Open/ }).click()
    } else await page.locator('#tour-tab-satellites').click()
    await page.getByLabel('Select satellite (or tap globe)').selectOption('25544')
    await page.locator('.drawer-pane').evaluate(el => {
      el.scrollTop = 0
    })
    const layout = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      drawer: document.querySelector('.drawer-pane').getBoundingClientRect().toJSON(),
    }))
    expect(layout.scroll).toBeLessThanOrEqual(width)
    expect(layout.drawer.height).toBeLessThan(height * 0.55)
    await page.screenshot({
      path: `${output}/${width}x${height}.png`,
      animations: 'disabled',
      timeout: 90000,
    })
    results.push(
      `${width}x${height}: no horizontal page overflow; bounded drawer; satellite controls visible (browser emulation): PASS`
    )
    // Close current sheet so the next iteration opens it rather than toggling it shut.
    if (width >= 768) await page.locator('#tour-tab-satellites').click()
  }
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.locator('#tour-tab-perf').click()
  await page.getByText('📊 Performance', { exact: false }).last().click()
  const force = page.getByRole('button', { name: 'Force Safe Mode', exact: true })
  if (await force.isVisible()) await force.click()
  await expect(page.getByRole('button', { name: 'OVERRIDE SAFE MODE', exact: true })).toBeVisible()
  results.push('Safe Mode control active: PASS; no FPS guarantee')
  expect(errors).toEqual([])
} finally {
  writeFileSync(
    `${output}/browser-results.json`,
    JSON.stringify({ results, pageErrors: errors }, null, 2)
  )
  console.log(results.join('\n'))
  console.log('Page errors:', errors)
  await browser.close()
}
