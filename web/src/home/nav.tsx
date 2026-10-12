import type { LucideIcon } from 'lucide-react'
import { Flag, House, Map as MapIcon, Menu, Users } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useI18n } from '#/i18n/react'

export type Tab = 'home' | 'race' | 'tour' | 'community'

export const tabs: ReadonlyArray<{ id: Tab; Icon: LucideIcon }> = [
  { id: 'home', Icon: House },
  { id: 'race', Icon: Flag },
  { id: 'tour', Icon: MapIcon },
  { id: 'community', Icon: Users },
]

/** The sections inline in the header, for wide screens. */
export const NavTabs = ({
  tab,
  onTab,
}: {
  tab: Tab
  onTab: (tab: Tab) => void
}) => {
  const { t } = useI18n()
  return (
    <Tabs value={tab} onValueChange={(v) => onTab(v as Tab)}>
      <TabsList variant="line" aria-label={t('nav.label')}>
        {tabs.map(({ id }) => (
          <TabsTrigger key={id} value={id} className="px-3">
            {t(`nav.${id}`)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

/** Phones: sections and the menu behind one ☰ button, dropping down from the top. */
export const MobileMenu = ({
  tab,
  onTab,
  actions,
  onNewTrip,
}: {
  tab: Tab
  onTab: (tab: Tab) => void
  actions: ReadonlyArray<{ label: string; onSelect: () => void }>
  onNewTrip: () => void
}) => {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  // Every choice closes the sheet before it acts.
  const then = (act: () => void) => () => {
    setOpen(false)
    act()
  }
  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="shrink-0"
        aria-label={t('menu.label')}
        onClick={() => setOpen(true)}
      >
        <Menu />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="top"
          className="max-h-[85dvh] gap-0 overflow-y-auto pb-safe"
        >
          <SheetHeader>
            <SheetTitle>{t('menu.label')}</SheetTitle>
          </SheetHeader>
          <nav aria-label={t('nav.label')} className="flex flex-col px-2">
            {tabs.map(({ id, Icon }) => (
              <Button
                key={id}
                variant="ghost"
                aria-current={tab === id ? 'page' : undefined}
                className="h-11 justify-start gap-3 aria-[current=page]:bg-muted aria-[current=page]:font-semibold"
                onClick={then(() => onTab(id))}
              >
                <Icon />
                {t(`nav.${id}`)}
              </Button>
            ))}
          </nav>
          <Separator className="my-3" />
          <div className="flex flex-col px-2">
            {actions.map((a) => (
              <Button
                key={a.label}
                variant="ghost"
                className="h-10 justify-start"
                onClick={then(a.onSelect)}
              >
                {a.label}
              </Button>
            ))}
          </div>
          <Separator className="my-3" />
          <div className="px-2 pb-6">
            <Button
              variant="ghost"
              className="h-10 w-full justify-start text-destructive"
              onClick={then(onNewTrip)}
            >
              {t('menu.newTrip')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
