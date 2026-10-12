/** A local simulation clock; never treated as GPS or the travel planning clock. */
export type RaceSession = {
  status: 'READY' | 'RUNNING' | 'PAUSED' | 'FINISHED'
  elapsed: number
  anchor: number
  speed: 1 | 60
}
export const freshRace = (): RaceSession => ({
  status: 'READY',
  elapsed: 0,
  anchor: 0,
  speed: 1,
})
export const elapsedAt = (session: RaceSession, now: number, total: number) =>
  session.status === 'FINISHED'
    ? total
    : Math.min(
        total,
        session.elapsed +
          (session.status === 'RUNNING'
            ? (Math.max(0, now - session.anchor) / 1000) * session.speed
            : 0),
      )
export type RaceAction =
  'START' | 'PAUSE' | 'RESUME' | 'FINISH' | 'FINAL_KM' | 1 | 60
export const advanceRace = (
  session: RaceSession,
  action: RaceAction,
  now: number,
  total: number,
  finalKm: number,
): RaceSession => {
  if (session.status === 'FINISHED') return session
  const elapsed = elapsedAt(session, now, total)
  if (action === 'FINISH' || (session.status !== 'READY' && elapsed >= total))
    return { ...session, status: 'FINISHED', elapsed: total, anchor: now }
  if (action === 'START' && session.status === 'READY')
    return { ...session, status: 'RUNNING', anchor: now }
  if (action === 'PAUSE' && session.status === 'RUNNING')
    return { ...session, status: 'PAUSED', elapsed, anchor: now }
  if (action === 'RESUME' && session.status === 'PAUSED')
    return { ...session, status: 'RUNNING', anchor: now }
  if (session.status === 'READY') return session
  if (action === 1 || action === 60)
    return { ...session, elapsed, anchor: now, speed: action }
  if (action === 'FINAL_KM')
    return {
      ...session,
      elapsed: Math.max(elapsed, total - finalKm),
      anchor: now,
    }
  return session
}
export const restoreRace = (
  raw: string | null,
  now: number,
  total: number,
): RaceSession => {
  try {
    const s = JSON.parse(raw ?? 'null') as RaceSession | null
    if (
      !s ||
      !['READY', 'RUNNING', 'PAUSED', 'FINISHED'].includes(s.status) ||
      !Number.isFinite(s.elapsed) ||
      s.elapsed < 0 ||
      s.elapsed > total ||
      !Number.isFinite(s.anchor) ||
      s.anchor < 0 ||
      s.anchor > now ||
      ![1, 60].includes(s.speed) ||
      (s.status === 'READY' && (s.elapsed !== 0 || s.anchor !== 0)) ||
      (s.status === 'RUNNING' && s.anchor === 0)
    )
      return freshRace()
    return elapsedAt(s, now, total) >= total
      ? { ...s, status: 'FINISHED', elapsed: total }
      : s
  } catch {
    return freshRace()
  }
}
