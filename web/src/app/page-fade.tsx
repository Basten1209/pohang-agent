import { useEffect, useState } from 'react'

/**
 * scroll-fade for the page itself (the shadcn utility needs its own scroll
 * container): the bottom edge dissolves while more lies below, and clears
 * once the end is reached.
 */
export const PageFade = () => {
  const [more, setMore] = useState(false)
  useEffect(() => {
    const sync = () => {
      const { scrollHeight } = document.documentElement
      setMore(window.scrollY + window.innerHeight < scrollHeight - 24)
    }
    sync()
    window.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync)
    // Content arrives after mount (photos, posts); re-check as the page grows.
    const observer = new ResizeObserver(sync)
    observer.observe(document.body)
    return () => {
      window.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
      observer.disconnect()
    }
  }, [])
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-20 h-20 bg-linear-to-t from-background to-transparent transition-opacity duration-300 ${more ? 'opacity-100' : 'opacity-0'}`}
    />
  )
}
