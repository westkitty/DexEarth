import { orbitalFacts } from '../layers/satellites/orbital.js'
export function validWatchedRecord(record) {
  const facts = orbitalFacts(record)
  return (
    !!facts &&
    typeof record.name === 'string' &&
    record.name.length <= 500 &&
    record.satrec.satnum != null &&
    String(record.satrec.satnum).length > 0 &&
    String(record.satrec.satnum).length <= 20 &&
    Number.isFinite(facts.epochMs) &&
    Math.abs(facts.epochMs) <= 8e15 &&
    Number.isFinite(facts.periodMin) &&
    Number.isFinite(facts.apogeeKm) &&
    facts.inclinationDeg >= 0 &&
    facts.inclinationDeg <= 180
  )
}
export function validWatchItem(item) {
  return (
    !!item &&
    typeof item.id === 'string' &&
    validWatchedRecord(item.record) &&
    item.id === String(item.record.satrec.satnum) &&
    typeof item.name === 'string' &&
    item.name.length <= 500 &&
    (item.nickname === undefined ||
      (typeof item.nickname === 'string' && item.nickname.length <= 100))
  )
}
export function validObserver(observer) {
  return (
    !!observer &&
    Number.isFinite(observer.lat) &&
    Math.abs(observer.lat) <= 90 &&
    Number.isFinite(observer.lon) &&
    Math.abs(observer.lon) <= 180 &&
    typeof observer.name === 'string' &&
    observer.name.length <= 500 &&
    (observer.altKm === undefined ||
      (Number.isFinite(observer.altKm) && observer.altKm >= -1 && observer.altKm <= 100))
  )
}
