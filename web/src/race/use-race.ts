import { useEffect, useState } from 'react'
import {
  advanceRace,
  elapsedAt,
  freshRace,
  restoreRace,
} from '#/core/race-session'
import type { RaceAction } from '#/core/race-session'
import { timeAt } from '#/core/race'
import { race } from './mock'

export const useRace = (tripId: string, finished: boolean) => {
  const total = timeAt(race.me.paces, race.distance)
  const key = `run2-race-v1:${tripId}`
  const [session, setSession] = useState(() => {
    try {
      return restoreRace(localStorage.getItem(key), Date.now(), total)
    } catch {
      return freshRace()
    }
  })
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(session))
    } catch {
      /* private browsing */
    }
  }, [session, key])
  useEffect(() => {
    if (finished || session.status !== 'RUNNING') return
    const tick = () => {
      const at = Date.now()
      setNow(at)
      if (elapsedAt(session, at, total) >= total)
        setSession((s) =>
          advanceRace(s, 'FINISH', at, total, race.me.paces.at(-1)!),
        )
    }
    const timer = setInterval(tick, 500)
    window.addEventListener('focus', tick)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', tick)
    }
  }, [session, total, finished])
  const act = (action: RaceAction) => {
    const at = Date.now()
    setNow(at)
    setSession((s) => advanceRace(s, action, at, total, race.me.paces.at(-1)!))
  }
  return { session, elapsed: elapsedAt(session, now, total), total, act }
}
