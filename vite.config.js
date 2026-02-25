import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

// Aggregates global flight data from airplanes.live (no CORS headers on their API)
// by querying 4 regional endpoints in parallel and deduplicating by ICAO hex.
const flightsAggregatorPlugin = {
  name: 'flights-aggregator',
  configureServer(server) {
    server.middlewares.use('/proxy/flights', async (_req, res) => {
      const POINTS = [[45, -95], [50, 10], [30, 100], [-20, 30]]
      const RADIUS = 4000 // nautical miles
      const byHex = new Map()
      await Promise.all(
        POINTS.map(async ([lat, lon]) => {
          try {
            const r = await fetch(`https://api.airplanes.live/v2/point/${lat}/${lon}/${RADIUS}`)
            if (!r.ok) return
            const d = await r.json()
            ;(d.ac || []).forEach(a => { if (a.hex) byHex.set(a.hex, a) })
          } catch { /* regional failure is non-fatal */ }
        })
      )
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.end(JSON.stringify({ ac: [...byHex.values()] }))
    })
  },
}

export default defineConfig({
  plugins: [react(), cesium(), flightsAggregatorPlugin],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/proxy/cables': {
        target: 'https://www.submarinecablemap.com',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/api/v3/cable/cable-geo.json',
      },
      '/proxy/coastlines': {
        target: 'https://raw.githubusercontent.com',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/nvkelso/natural-earth-vector/master/geojson/ne_110m_coastline.geojson',
      },
      // TLE data — CelesTrak blocks direct browser requests; proxy goes server-side
      '/proxy/tle': {
        target: 'https://celestrak.org',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle',
      },
    },
  },
});
