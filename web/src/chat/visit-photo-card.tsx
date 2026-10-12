import { Camera } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { photoEligiblePlaces } from '#/core/community'
import { PhotoComposer } from '#/home/finish'
import type { PartOf } from './context'
import { useChatContext } from './context'

const noChange = async () => undefined

export function VisitPhotoCard({
  part,
  interactive,
}: {
  part: PartOf<'prepare_visit_photo'>
  interactive: boolean
}) {
  const { config, view, tripId, send, photoShared, showCommunity } =
    useChatContext()
  const [picked, setPicked] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [closed, setClosed] = useState(false)
  if (part.state !== 'output-available') return null
  const offer = part.output
  const places = photoEligiblePlaces(config, view.state).filter((p) =>
    offer.placeIds.includes(p.id),
  )
  const place = places.find(
    (p) => p.id === (picked === undefined ? offer.selectedId : picked),
  )
  if (view.stage === 'SAFETY') return null

  return (
    <div className="space-y-3 rounded-2xl border border-primary/15 bg-background p-3">
      <p className="text-sm leading-relaxed">{offer.message}</p>
      {places.length > 0 && (!interactive || closed) ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => send('여행 사진을 커뮤니티에 올릴래요')}
        >
          <Camera /> 여행 사진 공유 열기
        </Button>
      ) : interactive && places.length > 0 ? (
        place ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setPicked(null)}
            >
              다른 장소 선택
            </Button>
            <PhotoComposer
              onBusy={setBusy}
              key={`${tripId}:${place.id}`}
              tripId={tripId}
              course={place.attrs.course}
              place={place}
              finish={noChange}
              onShared={() => photoShared?.()}
              onCommunity={showCommunity}
              continueLabel="대화 계속하기"
              onContinue={() => {
                setClosed(true)
                send('다음 일정 알려줘')
              }}
            />
          </>
        ) : (
          <div className="flex flex-col gap-2">
            {places.map((p) => (
              <Button
                key={p.id}
                variant="outline"
                className="h-auto min-h-10 justify-start whitespace-normal text-left"
                onClick={() => setPicked(p.id)}
              >
                <Camera className="shrink-0" />
                {p.attrs.short}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setClosed(true)}>
              나중에 할게요
            </Button>
          </div>
        )
      ) : null}
    </div>
  )
}
