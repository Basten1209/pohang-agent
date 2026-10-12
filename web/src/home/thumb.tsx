import { useState } from 'react'
import type { Place } from '#/core/schema'
import { visitDemoImages } from '#/core/demo-images'

export const PlaceThumb = ({
  place,
  className = 'aspect-[4/3] w-full',
}: {
  place: Place
  className?: string
}) => {
  const [failed, setFailed] = useState(false)
  const fallback = visitDemoImages[place.id] ?? '/images/guryongpo-harbor.jpg'
  return (
    <img
      src={failed ? fallback : place.attrs.image || fallback}
      alt={place.attrs.short}
      loading="lazy"
      width={320}
      height={240}
      onError={(e) => {
        if (!failed) setFailed(true)
        else if (!e.currentTarget.src.endsWith('/images/guryongpo-harbor.jpg'))
          e.currentTarget.src = '/images/guryongpo-harbor.jpg'
      }}
      className={`${className} rounded-lg object-cover`}
    />
  )
}
