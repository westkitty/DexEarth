// ─── GeoJSON Loader ───────────────────────────────────────────────────────────
// Loads Natural Earth GeoJSON at 110m or 50m detail.
// Uses a simple in-memory cache keyed by detail level.

const _cache = {}

const PATHS = {
    '110m': '/data/borders/ne_110m_admin_0_countries.geojson',
    '50m': '/data/borders/ne_50m_admin_0_countries.geojson',
    '110m_states': '/data/borders/ne_110m_admin_1_states_provinces.geojson',
    '50m_states': '/data/borders/ne_50m_admin_1_states_provinces.geojson',
}

/**
 * Helper to fetch a single GeoJSON file and mark its feature type
 */
async function fetchGeojson(pathKey, featureType) {
    const path = PATHS[pathKey]
    if (!path) return { features: [] }
    const res = await fetch(path)
    if (!res.ok) throw new Error(`GeoJSON fetch failed: ${res.status} ${path}`)
    const json = await res.json()
    // Inject type so overlays know how to style them
    if (json.features) {
        json.features.forEach(f => {
            if (!f.properties) f.properties = {}
            f.properties.feature_type = featureType
        })
    }
    return json
}

/**
 * Loads combinations of countries and states based on detail level.
 * @param {'110m'|'50m'|'50m_states'} detail
 * @returns {Promise<object>} Combined GeoJSON FeatureCollection
 */
export async function loadCountryGeojson(detail = '110m') {
    if (_cache[detail]) return _cache[detail]

    let features = []

    if (detail === '110m') {
        const c = await fetchGeojson('110m', 'country')
        features = c.features
    } else if (detail === '50m') {
        const c = await fetchGeojson('50m', 'country')
        features = c.features
    } else if (detail === '50m_states') {
        const [c, s] = await Promise.all([
            fetchGeojson('50m', 'country'),
            fetchGeojson('50m_states', 'state')
        ])
        features = [...c.features, ...s.features]
    }

    const combined = { type: 'FeatureCollection', features }
    _cache[detail] = combined
    return combined
}

/**
 * Determine which detail level to use based on camera altitude in metres.
 */
export function detailByAltitude(altMeters) {
    if (altMeters > 3_000_000) return '110m'
    if (altMeters > 1_500_000) return '50m'
    return '50m_states'
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
