import {
  Coffee,
  Footprints,
  Landmark,
  MapPin,
  Palette,
  Ship,
  ShoppingBag,
  Utensils,
  Waves,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field'
import { RadioGroupItem } from '@/components/ui/radio-group'

/** Place icons are named in config (`attrs.icon`); unknown names fall back to a pin. */
const icons: Record<string, LucideIcon> = {
  utensils: Utensils,
  footprints: Footprints,
  coffee: Coffee,
  landmark: Landmark,
  shopping: ShoppingBag,
  waves: Waves,
  ship: Ship,
  palette: Palette,
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

/** One option of a RadioGroup, as a full-width choice card. */
export const Choice = ({
  id,
  value,
  title,
  description,
}: {
  id: string
  value: string
  title: string
  description?: string
}) => (
  <FieldLabel htmlFor={id}>
    <Field orientation="horizontal">
      <FieldContent>
        <FieldTitle>{title}</FieldTitle>
        {description && <FieldDescription>{description}</FieldDescription>}
      </FieldContent>
      <RadioGroupItem value={value} id={id} />
    </Field>
  </FieldLabel>
)

/** A selected chip in a ToggleGroup, in brand colours (tokens, not a global override). */
export const chipOn =
  'data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground'
