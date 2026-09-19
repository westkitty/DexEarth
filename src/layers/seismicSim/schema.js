const inRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max
export function isValidSimulation(event) {
  return (
    !!event &&
    inRange(event.lon, -180, 180) &&
    inRange(event.lat, -90, 90) &&
    inRange(event.mag, 0, 12) &&
    inRange(event.depthKm, 0, 1000) &&
    inRange(event.originMs, -8e15, 8e15)
  )
}
export function isValidSimulations(events) {
  return Array.isArray(events) && events.length <= 100 && events.every(isValidSimulation)
}
