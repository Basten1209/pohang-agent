import { Camera, Medal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MascotBanner } from '#/brand/brand'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { useIsMobile } from '@/hooks/use-mobile'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { CommunityPost } from '#/core/community'
import { activeCourses } from '#/core/route'
import type { TripConfig } from '#/core/schema'
import { htmlLang } from '#/i18n'
import { useI18n } from '#/i18n/react'
import type { PostText } from './community-post'
import { PostDetail, PostTile } from './community-post'

/**
 * Photos arrive in one shape; varied crops give the board its rhythm.
 * Neighbours in a row never share a shape, so the columns stagger.
 */
const shapes = [
  'aspect-[3/4]',
  'aspect-square',
  'aspect-[4/3]',
  'aspect-[4/5]',
  'aspect-[5/4]',
  'aspect-[2/3]',
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
  const [open, setOpen] = useState<CommunityPost | null>(null)
  const columns = useIsMobile() ? 2 : 3
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
  const shown = posts.filter(visible)
  const textOf = (p: CommunityPost): PostText => ({
    title:
      p.kind === 'VISIT' && p.placeName
        ? p.placeName
        : t('journey.finishMeta', { area: area(p.course) }),
    date: new Date(p.createdAt).toLocaleDateString(
      locale === 'ko' ? 'ko-KR' : htmlLang[locale],
      { timeZone: 'Asia/Seoul' },
    ),
    alt: p.placeName
      ? t('journey.postAltVisit', { author: p.author, place: p.placeName })
      : t('journey.postAltFinish', { author: p.author }),
    note:
      p.photoKind === 'DEMO'
        ? p.kind === 'VISIT'
          ? t('journey.demoVisit')
          : t('journey.demoFinish')
        : undefined,
  })
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
      <Separator />
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
      {/* Masonry: posts go left to right, each column stacks its own. */}
      <div className="flex items-start gap-3">
        {Array.from({ length: columns }, (_, col) => (
          <div key={col} className="flex min-w-0 flex-1 flex-col gap-3">
            {shown
              .filter((_, i) => i % columns === col)
              .map((p) => (
                <PostTile
                  key={p.id}
                  post={p}
                  text={textOf(p)}
                  shape={shapes[shown.indexOf(p) % shapes.length]!}
                  onOpen={() => setOpen(p)}
                />
              ))}
          </div>
        ))}
      </div>
      <PostDetail
        post={open}
        text={open && textOf(open)}
        onClose={() => setOpen(null)}
      />
      {status === 'ready' && posts.filter(visible).length === 0 && (
        <p className="text-sm text-muted-foreground">{t('journey.empty')}</p>
      )}
    </div>
  )
}
