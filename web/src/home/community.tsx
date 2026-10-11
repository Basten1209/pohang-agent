import { useEffect, useState } from 'react'
import { MascotBanner } from '#/brand/brand'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { CommunityPost } from '#/core/community'
import { activeCourses } from '#/core/route'
import type { TripConfig } from '#/core/schema'

const examples = [
  {
    id: 'example-gp',
    course: 'guryongpo',
    author: '구룡포 러너',
    caption:
      '완주하고 구룡포에서 한 끼, 가옥거리에서 한 장. 달리기 뒤에 여행이 있으니 더 즐거워요.',
    image: '/images/guryongpo-street-2024.jpg',
  },
  {
    id: 'example-hm',
    course: 'homigot',
    author: '바다 러너',
    caption:
      '상생의 손 앞에서 메달 인증. 구룡포에서 호미곶까지, 바다를 보며 쉬어가요.',
    image: '',
  },
]

export const CommunityTab = ({
  config,
  revision = 0,
  onFinish,
}: {
  config: TripConfig
  revision?: number
  onFinish?: () => void
}) => {
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
  const area = (id: string) => courses.find((c) => c.id === id)?.area ?? id
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
            완주의 기쁨,
            <br />
            함께 나눠요
          </>
        }
        description="메달 한 장에서 시작되는 구룡포 여행."
      />
      {onFinish && (
        <Button variant="outline" onClick={onFinish}>
          완주 사진 공유 · 여행 준비하기
        </Button>
      )}
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        className="flex-wrap"
        value={tag}
        onValueChange={(v) => v && setTag(v)}
      >
        <ToggleGroupItem value="all">전체</ToggleGroupItem>
        {courses.map((c) => (
          <ToggleGroupItem key={c.id} value={c.id}>
            {c.area}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {status === 'loading' && (
        <p role="status" className="text-sm text-muted-foreground">
          완주 사진을 불러오고 있어요…
        </p>
      )}
      {status === 'error' && (
        <div role="alert" className="text-sm">
          사진을 불러오지 못했어요.{' '}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRetry((v) => v + 1)}
          >
            다시 불러오기
          </Button>
        </div>
      )}
      {posts.filter(visible).map((p) => (
        <Card key={p.id} size="sm" className="overflow-hidden">
          <img
            src={p.image}
            alt={`${p.author}님의 완주 사진`}
            loading="lazy"
            className="aspect-[3/2] w-full object-cover"
          />
          <CardHeader>
            <CardTitle className="text-sm">{p.author}</CardTitle>
            <CardDescription>
              {area(p.course)} ·{' '}
              {new Date(p.createdAt).toLocaleDateString('ko-KR', {
                timeZone: 'Asia/Seoul',
              })}
            </CardDescription>
            {p.photoKind === 'DEMO' && (
              <Badge variant="secondary" className="mt-1">
                AI 생성 시연 사진 · 실제 참가자 아님
              </Badge>
            )}
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">
            {p.caption}
          </CardContent>
        </Card>
      ))}
      {status === 'ready' && posts.filter(visible).length === 0 && (
        <p className="text-sm text-muted-foreground">
          첫 완주 사진을 기다리고 있어요.
        </p>
      )}
      {examples.filter(visible).map((p) => (
        <Card key={p.id} size="sm" className="overflow-hidden">
          {p.image && (
            <img
              src={p.image}
              alt="구룡포 일본인 가옥거리 풍경"
              loading="lazy"
              className="aspect-video w-full object-cover"
            />
          )}
          <CardHeader>
            <Badge variant="outline">시연용 예시 글</Badge>
            <CardTitle className="text-sm">{p.author}</CardTitle>
            <CardDescription>{area(p.course)}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">{p.caption}</CardContent>
        </Card>
      ))}
    </div>
  )
}
