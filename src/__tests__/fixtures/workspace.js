export function workspace() {
  return {
    camera: { lon: 10, lat: 0, alt: 20000000, heading: 0, pitch: -1.57, roll: 0 },
    layers: ['ORBITAL_MATH'],
    satelliteActive: true,
    time: { mode: 'MANUAL', timeMs: 1700000000000, speed: 1 },
    orbit: {
      selectedId: '25544',
      filters: {
        search: '',
        orbit: 'ALL',
        minAlt: 0,
        maxAlt: 100000,
        minInclination: 0,
        maxInclination: 180,
        watchedOnly: false,
      },
      watchIds: ['25544'],
      minutes: 90,
      showPath: true,
      showGround: true,
    },
    markers: [],
    datasets: [
      {
        id: 'tle_data',
        source: 'bundled',
        fetchedAt: null,
        expiresAt: null,
        historicalSnapshot: false,
      },
    ],
    style: 'REALISTIC',
    overlays: { borders: false, labels: false, followLabels: false },
    simulations: [],
    cascades: [],
  }
}
