import { Camera, Medal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MascotBanner } from '#/brand/brand'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Card } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { CommunityPost } from '#/core/community'
import { activeCourses } from '#/core/route'
import type { TripConfig } from '#/core/schema'
import { htmlLang } from '#/i18n'
import { useI18n } from '#/i18n/react'

/** Photos arrive in one shape; varied crops give the board its rhythm. */
const shapes = [
  'aspect-[3/4]',
  'aspect-square',
  'aspect-[4/5]',
  'aspect-[4/3]',
  'aspect-[3/4]',
  'aspect-[5/4]',
]

/** Categories read as text; the chosen one is bold in the brand colour. */
const textOn =
  'text-muted-foreground hover:bg-transparent data-[state=on]:bg-transparent data-[state=on]:font-semibold data-[state=on]:text-primary'

export const CommunityTab = ({
  config,
  revision = 0,
  onFinish,
  onPhoto,
}: {
  config: TripConfig
  revision?: number
  onFinish?: () => void
  onPhoto?: () => void
}) => {
  const { t, d, locale } = useI18n()
  const [tag, setTag] = useState('all')
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    fetch('/api/community', { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error('load')
        return r.json() as Promise<{ posts: CommunityPost[] }>
      })
      .then(({ posts }) => {
        setPosts(posts)
        setStatus('ready')
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error')
      })
    return () => controller.abort()
  }, [revision, retry])
  const courses = activeCourses(config)
  const area = (id: string) => {
    const area = courses.find((c) => c.id === id)?.area
    return area ? d(`area.${id}`, area) : id
  }
  const visible = (p: { course: string }) =>
    courses.some((c) => c.id === p.course) &&
    (tag === 'all' || p.course === tag)
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <MascotBanner
        pose="cheer"
        eyebrow="FINISH & SHARE"
        title={
          <>
            {t('journey.bannerTitle1')}
            <br />
            {t('journey.bannerTitle2')}
          </>
        }
        description={t('journey.bannerDescription')}
      />
      {(onFinish || onPhoto) && (
        <ButtonGroup className="w-full">
          {onFinish && (
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={onFinish}
            >
              <Medal />
              {t('journey.finishShare')}
            </Button>
          )}
          {onPhoto && (
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={onPhoto}
            >
              <Camera />
              {t('journey.sharePhoto')}
            </Button>
          )}
        </ButtonGroup>
      )}
      <ToggleGroup
        type="single"
        size="sm"
        className="w-full flex-wrap justify-center"
        value={tag}
        onValueChange={(v) => v && setTag(v)}
      >
        <ToggleGroupItem className={textOn} value="all">
          {t('journey.all')}
        </ToggleGroupItem>
        {courses.map((c) => (
          <ToggleGroupItem className={textOn} key={c.id} value={c.id}>
            {d(`area.${c.id}`, c.area)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {status === 'loading' && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('journey.loading')}
        </p>
      )}
      {status === 'error' && (
        <div role="alert" className="text-sm">
          {t('journey.loadError')}{' '}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRetry((v) => v + 1)}
          >
            {t('journey.reload')}
          </Button>
        </div>
      )}
      <div className="columns-2 gap-3 sm:columns-3">
        {posts.filter(visible).map((p, i) => (
          <Card
            key={p.id}
            tabIndex={0}
            className="group relative mb-3 break-inside-avoid gap-0 overflow-hidden py-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <img
              src={p.image}
              alt={
                p.placeName
                  ? t('journey.postAltVisit', {
                      author: p.author,
                      place: p.placeName,
                    })
                  : t('journey.postAltFinish', { author: p.author })
              }
              loading="lazy"
              width="1200"
              height="800"
              onError={(e) => {
                if (
                  !e.currentTarget.src.endsWith('/images/guryongpo-harbor.jpg')
                )
                  e.currentTarget.src = '/images/guryongpo-harbor.jpg'
              }}
              className={`w-full bg-muted/30 object-cover ${shapes[i % shapes.length]}`}
            />
            {p.photoKind === 'DEMO' && (
              <Badge
                variant="secondary"
                className="absolute top-2 left-2"
                title={
                  p.kind === 'VISIT'
                    ? t('journey.demoVisit')
                    : t('journey.demoFinish')
                }
              >
                {t('journey.demoTag')}
                <span className="sr-only">
                  {p.kind === 'VISIT'
                    ? t('journey.demoVisit')
                    : t('journey.demoFinish')}
                </span>
              </Badge>
            )}
            {/* Title and date: on hover or focus, always on touch screens. */}
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-3 pt-8 pb-2.5 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
              <p className="line-clamp-2 text-sm font-medium">
                {p.kind === 'VISIT'
                  ? p.placeName
                  : t('journey.finishMeta', { area: area(p.course) })}
              </p>
              <p className="text-xs text-white/80">
                {new Date(p.createdAt).toLocaleDateString(
                  locale === 'ko' ? 'ko-KR' : htmlLang[locale],
                  { timeZone: 'Asia/Seoul' },
                )}
              </p>
            </div>
          </Card>
        ))}
      </div>
      {status === 'ready' && posts.filter(visible).length === 0 && (
        <p className="text-sm text-muted-foreground">{t('journey.empty')}</p>
      )}
    </div>
  )
}
