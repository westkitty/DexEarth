// ─── GeoJSON Loader ───────────────────────────────────────────────────────────
// Loads Natural Earth GeoJSON at 110m or 50m detail.
// Uses a simple in-memory cache keyed by detail level.

const _cache = {}

const PATHS = {
    '110m': '/data/borders/ne_110m_admin_0_countries.geojson',
    '50m': '/data/borders/ne_50m_admin_0_countries.geojson',
}

/**
 * @param {'110m'|'50m'} detail
 * @returns {Promise<object>} GeoJSON FeatureCollection
 */
export async function loadCountryGeojson(detail = '110m') {
    if (_cache[detail]) return _cache[detail]
    const path = PATHS[detail] || PATHS['110m']
    const res = await fetch(path)
    if (!res.ok) throw new Error(`GeoJSON fetch failed: ${res.status} ${path}`)
    const json = await res.json()
    _cache[detail] = json
    return json
}

/**
 * Determine which detail level to use based on camera altitude in metres.
 */
export function detailByAltitude(altMeters) {
    if (altMeters > 3_000_000) return '110m'
    return '50m'
}

/**
 * Get the pre-built country index (fast search / fly-to).
 */
let _indexCache = null
export async function loadCountryIndex() {
    if (_indexCache) return _indexCache
    const res = await fetch('/data/borders/country_index.json')
    if (!res.ok) return []
    _indexCache = await res.json()
    return _indexCache
}
