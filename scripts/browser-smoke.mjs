import { Buffer } from 'node:buffer'
// Browser-emulated validation; run against a production preview for offline checks.
import { chromium, expect } from '@playwright/test'
import process from 'node:process'
import { mkdirSync, writeFileSync } from 'node:fs'
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
  await page.getByRole('button', { name: 'Add to watchlist', exact: true }).click()
  results.push(
    'Bundled startup, selected inspector, pass prediction and watchlist add: PASS (not proof of remote freshness)'
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
  await page.getByLabel('Import observation JSON').setInputFiles(observationPath)
  await expect(page.getByRole('button', { name: 'Load', exact: true })).toHaveCount(3)
  results.push('Observation save, duplicate, load, export and validated re-import: PASS')
  await page.locator('#tour-tab-sessions').click()
  await page.getByRole('button', { name: 'Start recording', exact: true }).click()
  await page.locator('#tour-tab-satellites').click()
  await page.getByLabel('Select satellite (or tap globe)').selectOption('20580')
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
  await page.getByLabel('Import replay JSON').setInputFiles(replayPath)
  await page.getByRole('button', { name: 'Exit replay / restore view', exact: true }).click()
  results.push(
    'Replay recording, selection sequence, play/pause/reset/step, export and import: PASS'
  )
  await page.locator('#tour-tab-views').click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
  await expect(page.getByRole('button', { name: 'Load', exact: true })).toHaveCount(2)
  results.push('Observation rename, corrupt import refusal and confirmed deletion: PASS')
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
