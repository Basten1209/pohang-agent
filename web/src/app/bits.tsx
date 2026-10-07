import {
  Coffee,
  Footprints,
  Landmark,
  MapPin,
  ShoppingBag,
  Utensils,
  Waves,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

/** Place icons are named in config (`attrs.icon`); unknown names fall back to a pin. */
const icons: Record<string, LucideIcon> = {
  utensils: Utensils,
  footprints: Footprints,
  coffee: Coffee,
  landmark: Landmark,
  shopping: ShoppingBag,
  waves: Waves,
}
export const PlaceIcon = ({
  name,
  className,
}: {
  name: string
  className?: string
}) => {
  const Icon = icons[name] ?? MapPin
  return <Icon className={cn('size-4', className)} aria-hidden />
}

export const Eyebrow = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => (
  <p
    className={cn(
      'text-[11px] font-bold uppercase tracking-[0.14em] text-harbor',
      className,
    )}
  >
    {children}
  </p>
)

export const PageHeading = ({
  eyebrow,
  title,
  lead,
  aside,
}: {
  eyebrow: string
  title: ReactNode
  lead?: ReactNode
  aside?: ReactNode
}) => (
  <header className="flex items-start justify-between gap-4">
    <div className="space-y-2">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="text-[1.65rem] font-extrabold leading-tight tracking-tight text-primary sm:text-3xl">
        {title}
      </h1>
      {lead && (
        <p className="text-sm leading-relaxed text-muted-foreground">{lead}</p>
      )}
    </div>
    {aside}
  </header>
)

export const Dot = () => <span className="text-harbor">.</span>

export const SectionTitle = ({
  title,
  meta,
}: {
  title: string
  meta?: ReactNode
}) => (
  <div className="flex items-baseline justify-between gap-3">
    <h2 className="text-base font-bold text-primary">{title}</h2>
    {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
  </div>
)
