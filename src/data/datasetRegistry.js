// ─── Dataset Registry ────────────────────────────────────────────────────────
// Central truth for all external or bundled data sources.

export const DATASETS = {
    // ── Global Overlays ──
    'ne_110m_countries': {
        id: 'ne_110m_countries',
        name: 'Natural Earth 1:110m Countries',
        category: 'geometry',
        bundledUrl: '/data/ne_110m_admin_0_countries.geojson',
        format: 'geojson',
        cacheTtlMs: Infinity, // Static
        sizeEstimate: '750 KB',
        safeModeImpact: 'low',
    },
    'ne_50m_countries': {
        id: 'ne_50m_countries',
        name: 'Natural Earth 1:50m Countries',
        category: 'geometry',
        bundledUrl: '/data/ne_50m_admin_0_countries.geojson',
        format: 'geojson',
        cacheTtlMs: Infinity,
        sizeEstimate: '2.5 MB',
        safeModeImpact: 'medium',
    },

    // ── Intelligence Suite ──
    'celestrak_tle_visual': {
        id: 'celestrak_tle_visual',
        name: 'CelesTrak: Visual TLEs',
        category: 'telemetry',
        remoteUrl: '/proxy/tle',
        fallbackUrls: [
            'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle'
        ],
        format: 'text/tle',
        cacheTtlMs: 24 * 60 * 60 * 1000, // 24 hours
        sizeEstimate: '300 KB',
        safeModeImpact: 'high',
    },
    'firms_active_fires': {
        id: 'firms_active_fires',
        name: 'NASA FIRMS: Active Fires (24h)',
        category: 'events',
        remoteUrl: '/proxy/firms',
        format: 'csv',
        cacheTtlMs: 2 * 60 * 60 * 1000, // 2 hours
        sizeEstimate: '5 MB',
        safeModeImpact: 'high',
    },
    'usgs_earthquakes_1mo': {
        id: 'usgs_earthquakes_1mo',
        name: 'USGS: Earthquakes (M2.5+ 30d)',
        category: 'events',
        remoteUrl: '/proxy/usgs',
        fallbackUrls: [
            'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson'
        ],
        format: 'geojson',
        cacheTtlMs: 15 * 60 * 1000, // 15 mins
        sizeEstimate: '1.2 MB',
        safeModeImpact: 'medium',
    },
    'pb2002_plates': {
        id: 'pb2002_plates',
        name: 'PB2002 Tectonic Plates',
        category: 'geometry',
        remoteUrl: 'https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json',
        format: 'geojson',
        cacheTtlMs: 30 * 24 * 60 * 60 * 1000, // 30 days
        sizeEstimate: '1 MB',
        safeModeImpact: 'low',
    },
    'submarine_cables': {
        id: 'submarine_cables',
        name: 'Submarine Cable Map',
        category: 'infrastructure',
        remoteUrl: '/proxy/cables',
        fallbackUrls: [
            'https://www.submarinecablemap.com/api/v3/cable/cable-geo.json'
        ],
        format: 'geojson',
        cacheTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
        sizeEstimate: '18 MB',
        safeModeImpact: 'high',
    }
}

export function getRegisteredDatasets() {
    return Object.values(DATASETS)
}

export function getDatasetConfig(id) {
    return DATASETS[id]
}
