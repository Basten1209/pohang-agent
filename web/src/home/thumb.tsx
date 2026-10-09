import { PlaceIcon } from '#/app/bits'
import type { Place } from '#/core/schema'

/** A place's photo, or its icon on a muted square when there is none yet. */
export const PlaceThumb = ({
  place,
  className = 'aspect-[4/3] w-full',
}: {
  place: Place
  className?: string
}) =>
  place.attrs.image ? (
    <img
      src={place.attrs.image}
      alt=""
      loading="lazy"
      className={`${className} rounded-md object-cover`}
    />
  ) : (
    <div
      className={`${className} flex items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-6`}
    >
      <PlaceIcon name={place.attrs.icon} />
    </div>
  )
