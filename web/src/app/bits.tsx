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

/** Place icons are named in config (`attrs.icon`); unknown names fall back to a pin. */
const icons: Record<string, LucideIcon> = {
  utensils: Utensils,
  footprints: Footprints,
  coffee: Coffee,
  landmark: Landmark,
  shopping: ShoppingBag,
  waves: Waves,
}

export const PlaceIcon = ({ name }: { name: string }) => {
  const Icon = icons[name] ?? MapPin
  return <Icon aria-hidden />
}

export const PageHeader = ({
  title,
  description,
  action,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) => (
  <div className="flex items-start justify-between gap-4">
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
    {action}
  </div>
)
