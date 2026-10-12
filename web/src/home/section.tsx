import type { ReactNode } from 'react'
import { Separator } from '@/components/ui/separator'

/** A home section: a separator above, a heading, then its content. No card. */
export const Section = ({
  title,
  description,
  action,
  children,
}: {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  children?: ReactNode
}) => (
  <section className="flex flex-col gap-3">
    <Separator />
    {title && (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-base leading-snug font-medium">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
    )}
    {children}
  </section>
)
