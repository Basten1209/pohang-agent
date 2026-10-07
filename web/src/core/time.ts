/** Clock arithmetic in minutes since local midnight. */

export const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

export const clock = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

export const duration = (min: number) =>
  min >= 60
    ? `${Math.floor(min / 60)}시간${min % 60 ? ` ${min % 60}분` : ''}`
    : `${min}분`

export type Window = { from: string; to: string }

export const within = (window: Window) => (min: number) =>
  min >= minutes(window.from) && min <= minutes(window.to)
