import { Camera, Check, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
import type { Place } from '#/core/schema'
import type { CommunityPost, CommunityPostInput } from '#/core/community'

/** Decode and re-encode locally: bounded uploads, consistent orientation, no EXIF. */
async function preparePhoto(file: File) {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 5_000_000
  )
    throw new Error('JPG·PNG·WebP 사진을 5MB 이하로 선택해 주세요.')
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
    if (data.length > 1_000_000)
      throw new Error('사진 크기가 커요. 더 작은 사진을 선택해 주세요.')
    return data
  } finally {
    bitmap.close()
  }
}

export function FinishSheet({
  open,
  onOpenChange,
  tripId,
  course,
  place,
  finish,
  onShared,
  onContinue,
  onCommunity,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tripId: string
  course: string
  place?: Place
  finish: () => Promise<void>
  onShared: () => void
  onContinue: () => void
  onCommunity: () => void
}) {
  const [photo, setPhoto] = useState<CommunityPostInput['photo'] | null>(null)
  const [caption, setCaption] = useState(
    place
      ? `${place.attrs.short}에서 남긴 오늘의 한 장 📷`
      : '마라톤 완주! 메달의 기쁨을 안고 구룡포 여행으로 떠나요 🏅',
  )
  const [post, setPost] = useState<CommunityPost | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!open) return
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
  }, [open, tripId, place?.id])
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const run = async (action: () => Promise<void>) => {
    if (busy || loading) return
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : '처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
      )
    } finally {
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
      if (!response.ok)
        throw new Error(
          '사진을 공유하지 못했어요. 선택한 사진은 그대로 있으니 다시 시도해 주세요.',
        )
      const result = (await response.json()) as { post: CommunityPost }
      setPost(result.post)
      onShared()
    })
  const travel = () =>
    run(async () => {
      await finish()
      onOpenChange(false)
      onContinue()
    })
  const preview =
    post?.image ??
    (photo?.kind === 'DEMO'
      ? place?.attrs.image || '/images/finisher-demo.png'
      : photo?.data)
  return (
    <Sheet open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-2xl rounded-t-3xl data-[side=bottom]:max-h-[94dvh]"
      >
        <SheetHeader className="mascot-panel flex-row items-center gap-3 rounded-t-3xl pr-10">
          <GullPose pose="cheer" className="w-24 sm:w-28" decorative />
          <div className="min-w-0 space-y-2">
            <SheetTitle className="text-2xl">
              {place ? '여행의 한 장을 남겨요' : '완주 축하해요!'}
            </SheetTitle>
            <SheetDescription>
              {place
                ? `${place.attrs.short}에서의 순간을 커뮤니티에 나눠요.`
                : '메달의 순간을 남기고, 구룡포에서 오늘의 기쁨을 이어가요.'}
            </SheetDescription>
          </div>
        </SheetHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-6">
          {preview ? (
            <div className="relative overflow-hidden rounded-2xl">
              <img
                src={preview}
                alt={
                  place
                    ? `${place.attrs.short} 공유 사진 미리보기`
                    : '공유할 마라톤 완주 사진'
                }
                className="max-h-64 w-full bg-primary/5 object-contain"
              />
              {(post?.photoKind === 'DEMO' ||
                (!post && photo?.kind === 'DEMO')) && (
                <Badge className="absolute bottom-3 left-3">
                  {place
                    ? '장소 예시 사진 · 직접 촬영 아님'
                    : 'AI 생성 시연 사진'}
                </Badge>
              )}
            </div>
          ) : (
            <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-primary/5 text-primary">
              <Camera className="size-8" />
              <p className="text-sm">
                {place
                  ? '여행에서 기억하고 싶은 한 장'
                  : '오늘 가장 자랑스러운 한 장'}
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
                  ? `${place.attrs.short} 사진이 커뮤니티에 공유됐어요.`
                  : '완주의 순간이 커뮤니티에 공유됐어요.'}
              </p>
              <p className="whitespace-pre-wrap text-sm">{post.caption}</p>
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  onCommunity()
                }}
              >
                {place ? '공유한 여행 사진 보기' : '내 완주 사진 보기'}
              </Button>
              <Button disabled={busy || loading} onClick={travel}>
                {place ? '일정으로 돌아가기' : '구룡포 여행 준비하기'}
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
                aria-label={place ? '관광지 사진 파일' : '완주 사진 파일'}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file)
                    void run(async () =>
                      setPhoto({
                        kind: 'UPLOAD',
                        data: await preparePhoto(file),
                      }),
                    )
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  disabled={busy || loading}
                  onClick={() => input.current?.click()}
                >
                  <Upload />
                  사진 선택
                </Button>
                {(!place || place.attrs.image) && (
                  <Button
                    variant="outline"
                    disabled={busy || loading}
                    onClick={() => {
                      setPhoto({ kind: 'DEMO' })
                      setError('')
                    }}
                  >
                    {place ? '장소 예시 사진 사용' : '시연 사진 사용'}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                JPG·PNG·WebP, 최대 5MB ·{' '}
                {place
                  ? '예시 사진은 해당 장소의 소개 사진이며 직접 촬영한 방문 사진이 아니에요.'
                  : '시연 사진은 AI로 만든 가상 러너예요.'}
              </p>
              <label
                htmlFor={place ? 'visit-caption' : 'finish-caption'}
                className="text-sm font-medium"
              >
                {place ? '여행 한마디' : '완주 한마디'}
              </label>
              <Textarea
                id={place ? 'visit-caption' : 'finish-caption'}
                value={caption}
                maxLength={300}
                rows={2}
                disabled={busy || loading}
                onChange={(e) => setCaption(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                공유하면 사진과 닉네임, {place ? '장소명, ' : ''}한마디가
                커뮤니티에 공개돼요.{' '}
                {place
                  ? '같은 여정에서 장소마다 한 번 공유할 수 있어요.'
                  : '여정당 한 번 공유할 수 있어요.'}
              </p>
              <Button
                disabled={busy || loading || !photo || !caption.trim()}
                onClick={share}
              >
                {busy || loading ? '처리 중…' : '사진 공유하기'}
              </Button>
              <Button
                variant="ghost"
                disabled={busy || loading}
                onClick={travel}
              >
                {place ? '나중에 할게요' : '사진 없이 여행 준비하기'}
              </Button>
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
