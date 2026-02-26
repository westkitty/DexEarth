// ─── Pure Utilities — no Cesium dependency ────────────────────────────────────
// Extracted so they can be imported independently and tested in isolation.

import * as satellite from 'satellite.js'

// ─── TLE PARSER ───────────────────────────────────────────────────────────────
// Parses raw TLE text (name / line1 / line2 triplets) into satellite.js satrec
// objects. Silently skips malformed records.
export function parseTLEs(rawText) {
  const lines = rawText
    .trim()
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
  const records = []
  for (let i = 0; i < lines.length - 2; i++) {
    const name = lines[i]
    const line1 = lines[i + 1]
    const line2 = lines[i + 2]
    if (line1.startsWith('1 ') && line2.startsWith('2 ')) {
      try {
        const satrec = satellite.twoline2satrec(line1, line2)
        records.push({ name, satrec })
        i += 2
      } catch {
        /* skip invalid */
      }
    }
  }
  return records
}

// ─── FETCH WITH RETRY ─────────────────────────────────────────────────────────
// Retries failed fetches with exponential back-off. Aborts requests that exceed
// timeoutMs so slow upstreams don't block indefinitely.
export async function fetchWithRetry(url, opts = {}, maxRetries = 3, timeoutMs = 20_000) {
  const merged = {
    mode: 'cors',
    ...opts,
    headers: {
      Accept: 'application/json, text/plain, */*',
      ...(opts.headers || {}),
    },
  }
  for (let i = 0; i < maxRetries; i++) {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...merged, signal: controller.signal })
      clearTimeout(tid)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res
    } catch (err) {
      clearTimeout(tid)
      if (i === maxRetries - 1) throw err
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)))
    }
  }
}
