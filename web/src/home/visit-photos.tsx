import { Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GullPose } from '#/brand/brand'
import { agentName } from '#/core/identity'
import type { Place } from '#/core/schema'

export function VisitPhotoPrompt({
  place,
  share,
  dismiss,
}: {
  place: Place
  share: () => void
  dismiss: () => void
}) {
  return (
    <section
      aria-label="여행 친구의 사진 제안"
      className="mascot-panel mascot-message gap-3 rounded-2xl border border-primary/15 p-4"
    >
      <GullPose pose="cheer" className="w-full self-start" decorative />
      <div className="min-w-0">
        <p className="text-xs font-medium text-primary">{agentName}</p>
        <p className="mt-1 text-sm font-semibold">
          {place.attrs.short}에서의 순간, 사진으로 남겨볼까요?
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          공유는 선택이에요. 사진과 공개 내용을 확인한 뒤 게시해요.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={share}>
            <Camera />
            사진 남기기
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            나중에
          </Button>
        </div>
      </div>
    </section>
  )
}
