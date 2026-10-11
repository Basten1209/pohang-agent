export type ForecastReading = {
  date: string
  time: string
  tempC: number | null
  sky: string
  precip: string
  popPct: number | null
  windMs: number | null
  issuedAt?: string
  fetchedAt?: string
  provenance?: 'LIVE' | 'SNAPSHOT'
}

/** Keep earlier hours that disappear from the provider's latest forecast.
 * Each saved hour retains its own issue time; it never becomes a current observation. */
export const mergeForecastHours = (
  day: string,
  saved: ForecastReading[],
  live: ForecastReading[],
) => {
  const hours = new Map<string, ForecastReading>()
  for (const h of saved.filter((h) => h.date === day))
    hours.set(h.time, { ...h, provenance: 'SNAPSHOT' })
  for (const h of live.filter((h) => h.date === day))
    hours.set(h.time, { ...h, provenance: 'LIVE' })
  return [...hours.values()].sort((a, b) => a.time.localeCompare(b.time))
}
