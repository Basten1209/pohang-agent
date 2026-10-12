import type { ComponentProps } from 'react'
import { NavigationMenu as Primitive } from '@base-ui/react/navigation-menu'
import { cn } from '@/lib/utils'

export function NavigationMenu({
  className,
  ...props
}: ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      data-slot="navigation-menu"
      className={cn('relative w-full', className)}
      {...props}
    />
  )
}
export function NavigationMenuList({
  className,
  ...props
}: ComponentProps<typeof Primitive.List>) {
  return (
    <Primitive.List
      className={cn('flex w-full list-none items-center gap-1', className)}
      {...props}
    />
  )
}
export const NavigationMenuItem = Primitive.Item
export function NavigationMenuLink({
  className,
  ...props
}: ComponentProps<typeof Primitive.Link>) {
  return (
    <Primitive.Link
      className={cn(
        'flex min-h-11 items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-xs whitespace-nowrap font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[active]:bg-primary data-[active]:text-white sm:gap-2 sm:px-3 sm:text-sm [&_svg]:size-4 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    />
  )
}
