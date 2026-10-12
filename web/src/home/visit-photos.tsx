import { Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GullPose } from '#/brand/brand'
import { agentName } from '#/core/identity'
import type { Place } from '#/core/schema'
import { useI18n } from '#/i18n/react'

export function VisitPhotoPrompt({
  place,
  share,
  dismiss,
}: {
  place: Place
  share: () => void
  dismiss: () => void
}) {
  const { t } = useI18n()
  return (
    <section
      aria-label={t('journey.promptLabel')}
      className="mascot-panel mascot-message gap-3 rounded-2xl border border-primary/15 p-4"
    >
      <GullPose pose="cheer" className="w-full self-start" decorative />
      <div className="min-w-0">
        <p className="text-xs font-medium text-primary">{agentName}</p>
        <p className="mt-1 text-sm font-semibold">
          {t('journey.promptQuestion', { place: place.attrs.short })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('journey.promptNote')}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={share}>
            <Camera />
            {t('journey.promptShare')}
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            {t('journey.promptLater')}
          </Button>
        </div>
      </div>
    </section>
  )
}
