import { Camera, Check, Upload } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { GullPose } from '#/brand/brand'
import { visitDemoImages } from '#/core/demo-images'
import type { Place } from '#/core/schema'
import type { CommunityPost, CommunityPostInput } from '#/core/community'
import { useI18n } from '#/i18n/react'

type T = ReturnType<typeof useI18n>['t']

/** Decode and re-encode locally: bounded uploads, consistent orientation, no EXIF. */
async function preparePhoto(file: File, t: T) {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 5_000_000
  )
    throw new Error(t('journey.errFileType'))
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')!
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const data = canvas.toDataURL('image/jpeg', 0.82)
    if (data.length > 1_000_000) throw new Error(t('journey.errTooLarge'))
    return data
  } finally {
    bitmap.close()
  }
}

type PhotoComposerProps = {
  tripId: string
  course: string
  place?: Place
  finish: () => Promise<void>
  onShared: () => void
  onContinue: () => void
  onCommunity?: () => void
  continueLabel?: string
}

export function FinishSheet({
  open,
  onOpenChange,
  ...props
}: PhotoComposerProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const { t } = useI18n()
  return (
    <Sheet open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-2xl overflow-y-auto rounded-t-3xl data-[side=bottom]:max-h-[94dvh]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>
            {props.place ? t('journey.sheetTitlePlace') : t('journey.congrats')}
          </SheetTitle>
          <SheetDescription>{t('journey.sheetDescription')}</SheetDescription>
        </SheetHeader>
        {open && (
          <PhotoComposer
            {...props}
            onBusy={setBusy}
            onContinue={() => {
              onOpenChange(false)
              props.onContinue()
            }}
            onCommunity={
              props.onCommunity &&
              (() => {
                onOpenChange(false)
                props.onCommunity?.()
              })
            }
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

/** Shared by the finish sheet and chat card. Caption images use a separate AI request. */
export function PhotoComposer({
  tripId,
  course,
  place,
  finish,
  onShared,
  onContinue,
  onCommunity,
  continueLabel,
  onBusy,
}: PhotoComposerProps & { onBusy?: (busy: boolean) => void }) {
  const captionId = useId()
  const { t } = useI18n()
  const [photo, setPhoto] = useState<CommunityPostInput['photo'] | null>(null)
  const [caption, setCaption] = useState(
    place
      ? t('journey.captionPlace', { place: place.attrs.short })
      : t('journey.captionFinish'),
  )
  const [drafting, setDrafting] = useState(false)
  const [draftError, setDraftError] = useState('')
  const draftController = useRef<AbortController | null>(null)
  const editVersion = useRef(0)
  const generation = useRef(0)
  const demoImage = place
    ? visitDemoImages[place.id]
    : '/images/finisher-demo.png'
  useEffect(
    () => () => {
      generation.current++
      draftController.current?.abort()
    },
    [],
  )
  const draft = async (selected: CommunityPostInput['photo']) => {
    draftController.current?.abort()
    const controller = new AbortController()
    draftController.current = controller
    const sequence = ++generation.current
    const version = editVersion.current
    setDrafting(true)
    setDraftError('')
    try {
      let photoForAI = selected
      if (selected.kind === 'DEMO') {
        const response = await fetch(demoImage, { signal: controller.signal })
        if (!response.ok) throw new Error('image')
        const blob = await response.blob()
        photoForAI = {
          kind: 'UPLOAD',
          data: await preparePhoto(
            new File([blob], 'sample.webp', { type: blob.type }),
            t,
          ),
        }
      }
      if (controller.signal.aborted) return
      const response = await fetch('/api/community/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(25000),
        ]),
        body: JSON.stringify({
          tripId,
          ...(place && { placeId: place.id }),
          photo: photoForAI,
        }),
      })
      if (!response.ok) throw new Error('caption')
      const result = (await response.json()) as { caption: string }
      if (
        typeof result.caption !== 'string' ||
        !result.caption.trim() ||
        result.caption.length > 300
      )
        throw new Error('caption')
      if (sequence === generation.current && version === editVersion.current)
        setCaption(result.caption)
    } catch {
      if (!controller.signal.aborted && sequence === generation.current)
        setDraftError(t('journey.errDraft'))
    } finally {
      if (sequence === generation.current) setDrafting(false)
    }
  }
  const choosePhoto = (selected: CommunityPostInput['photo']) => {
    setPhoto(selected)
    setError('')
    void draft(selected)
  }
  const [post, setPost] = useState<CommunityPost | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    onBusy?.(busy)
  }, [busy, onBusy])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetch(
      `/api/community?tripId=${tripId}${place ? `&placeId=${place.id}` : ''}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        if (!r.ok) throw new Error('load')
        return r.json() as Promise<{ post: CommunityPost | null }>
      })
      .then(({ post }) => setPost(post))
      .catch(() => {
        /* A failed lookup never discards the selected photo; sharing is idempotent. */
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [tripId, place?.id])
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const running = useRef(false)
  const run = async (action: () => Promise<void>) => {
    if (busy || loading || running.current) return
    running.current = true
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('journey.errGeneric'))
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  const share = () =>
    run(async () => {
      if (!photo) return
      await finish()
      const response = await fetch('/api/community', {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          course: course === 'homigot' ? 'homigot' : 'guryongpo',
          caption,
          ...(place && { placeId: place.id }),
          photo,
        }),
      })
      if (!response.ok) throw new Error(t('journey.errShare'))
      const result = (await response.json()) as { post: CommunityPost }
      setPost(result.post)
      onShared()
    })
  const travel = () =>
    run(async () => {
      draftController.current?.abort()
      generation.current++
      setDrafting(false)
      await finish()
      onContinue()
    })
  const preview =
    post?.image ?? (photo?.kind === 'DEMO' ? demoImage : photo?.data)
  return (
    <section
      aria-label={
        place
          ? t('journey.sectionPlace', { place: place.attrs.short })
          : t('journey.sectionFinish')
      }
      className="flex min-h-0 flex-col gap-4"
    >
      <div className="mascot-panel mascot-message gap-3 rounded-2xl p-4">
        <GullPose pose="cheer" className="w-full" decorative />
        <div className="min-w-0 space-y-2">
          <h3 className="text-xl font-bold">
            {place ? t('journey.headingPlace') : t('journey.congrats')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {place
              ? t('journey.leadPlace', { place: place.attrs.short })
              : t('journey.leadFinish')}
          </p>
        </div>
      </div>
      <div className="flex min-h-0 flex-col gap-4 px-4 pb-4">
        {preview ? (
          <div className="relative overflow-hidden rounded-2xl">
            <img
              src={preview}
              alt={
                place
                  ? t('journey.previewAltPlace', { place: place.attrs.short })
                  : t('journey.previewAltFinish')
              }
              className="max-h-64 w-full bg-primary/5 object-contain"
            />
            {(post?.photoKind === 'DEMO' ||
              (!post && photo?.kind === 'DEMO')) && (
              <Badge className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] whitespace-normal">
                {place ? t('journey.demoBadgePlace') : t('journey.demoBadge')}
              </Badge>
            )}
          </div>
        ) : (
          <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-primary/5 text-primary">
            <Camera className="size-8" />
            <p className="text-sm">
              {place ? t('journey.emptyPlace') : t('journey.emptyFinish')}
            </p>
          </div>
        )}
        {post ? (
          <>
            <p
              role="status"
              className="flex items-center gap-2 text-sm font-medium text-primary"
            >
              <Check className="size-4" />
              {place
                ? t('journey.sharedPlace', { place: place.attrs.short })
                : t('journey.sharedFinish')}
            </p>
            <p className="whitespace-pre-wrap text-sm">{post.caption}</p>
            {onCommunity && (
              <Button variant="outline" onClick={onCommunity}>
                {place ? t('journey.viewPlace') : t('journey.viewFinish')}
              </Button>
            )}
            <Button disabled={busy || loading} onClick={travel}>
              {continueLabel ??
                (place ? t('journey.backToPlan') : t('journey.prepTravel'))}
            </Button>
          </>
        ) : (
          <>
            <input
              ref={input}
              type="file"
              tabIndex={-1}
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label={
                place
                  ? t('journey.fileLabelPlace')
                  : t('journey.fileLabelFinish')
              }
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file)
                  void run(async () =>
                    choosePhoto({
                      kind: 'UPLOAD',
                      data: await preparePhoto(file, t),
                    }),
                  )
              }}
            />
            <p className="text-xs text-muted-foreground">
              {t('journey.privacy')}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                disabled={busy || loading}
                onClick={() => input.current?.click()}
              >
                <Upload />
                {t('journey.choosePhoto')}
              </Button>
              {demoImage && (
                <Button
                  variant="outline"
                  disabled={busy || loading}
                  onClick={() => {
                    choosePhoto({ kind: 'DEMO' })
                    setError('')
                  }}
                >
                  {place ? t('journey.useSample') : t('journey.useDemo')}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('journey.fileLimits')} ·{' '}
              {place
                ? t('journey.sampleNotePlace')
                : t('journey.sampleNoteFinish')}
            </p>
            {drafting && (
              <p role="status" className="text-sm text-primary">
                {t('journey.drafting')}
              </p>
            )}
            {draftError && (
              <p role="status" className="text-sm text-muted-foreground">
                {draftError}
              </p>
            )}
            {photo && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy || drafting}
                onClick={() => void draft(photo)}
              >
                {t('journey.redraft')}
              </Button>
            )}
            <label htmlFor={captionId} className="text-sm font-medium">
              {place
                ? t('journey.captionLabelPlace')
                : t('journey.captionLabelFinish')}
            </label>
            <Textarea
              id={captionId}
              value={caption}
              maxLength={300}
              rows={2}
              disabled={busy || loading}
              onChange={(e) => {
                editVersion.current++
                setCaption(e.target.value)
              }}
            />
            <p className="text-xs text-muted-foreground">
              {place ? t('journey.publicPlace') : t('journey.publicFinish')}{' '}
              {place ? t('journey.oncePlace') : t('journey.onceFinish')}
            </p>
            <Button
              disabled={
                busy || loading || drafting || !photo || !caption.trim()
              }
              onClick={share}
            >
              {busy
                ? t('journey.sharing')
                : loading
                  ? t('journey.checking')
                  : t('journey.share')}
            </Button>
            <Button variant="ghost" disabled={busy || loading} onClick={travel}>
              {place ? t('journey.later') : t('journey.skipPhoto')}
            </Button>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
