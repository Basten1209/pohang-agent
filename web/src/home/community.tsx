import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { activeCourses } from '#/core/route'
import type { TripConfig } from '#/core/schema'

/**
 * Finishers' notes from their trips. For now a read-only feed of demo posts
 * (marked as such); posting needs storage for photos and moderation.
 */

type Post = {
  id: string
  course: string
  author: string
  ago: string
  text: string
  image: string
}

const posts: Post[] = [
  {
    id: 'p1',
    course: 'guryongpo',
    author: '10km 김○○',
    ago: '12분 전',
    text: '완주하고 바로 구룡포. 항구 앞에서 먹은 모리국수가 오늘의 메달 같았어요.',
    image: '/images/guryongpo-harbor.jpg',
  },
  {
    id: 'p2',
    course: 'guryongpo',
    author: '5km 박○○',
    ago: '35분 전',
    text: '가옥거리 짧게 한 바퀴. 계단은 빼고 평지로만 걸었는데도 사진 충분히 남겼어요.',
    image: '/images/guryongpo-street.jpg',
  },
  {
    id: 'p3',
    course: 'homigot',
    author: '10km 이○○',
    ago: '1시간 전',
    text: '상생의 손 앞에서 완주 메달 인증. 바람이 세서 겉옷 꼭 챙기세요.',
    image: '',
  },
  {
    id: 'p4',
    course: 'yeongildae',
    author: '10km 최○○',
    ago: '1시간 전',
    text: '결승선 바로 옆 해상누각에서 쉬다가 물회 한 그릇. 이동이 짧아 다리가 편했어요.',
    image: '',
  },
  {
    id: 'p5',
    course: 'jukdo',
    author: '5km 정○○',
    ago: '2시간 전',
    text: '죽도시장에서 회 먹고 터미널까지 걸어서 15분. 버스 시간 넉넉했어요.',
    image: '',
  },
  {
    id: 'p6',
    course: 'guryongpo',
    author: '10km 한○○',
    ago: '2시간 전',
    text: '16시 열차라 카페는 빠졌지만 점심이랑 골목 구경은 다 했어요. 역 도착도 여유 있었고요.',
    image: '',
  },
  {
    id: 'p7',
    course: 'homigot',
    author: '10km 윤○○',
    ago: '3시간 전',
    text: '국립등대박물관은 실내라 땀 식히기 좋았어요.',
    image: '',
  },
]

export const CommunityTab = ({ config }: { config: TripConfig }) => {
  const [tag, setTag] = useState('all')
  const courses = activeCourses(config)
  const area = (id: string) => courses.find((c) => c.id === id)?.area ?? id
  const shown = posts.filter((p) => tag === 'all' || p.course === tag)
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
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
      </div>
      <Badge variant="outline" className="self-start">
        시연용 게시물
      </Badge>
      {shown.map((p) => (
        <Card key={p.id} size="sm" className="overflow-hidden">
          {p.image && (
            <img
              src={p.image}
              alt=""
              loading="lazy"
              className="aspect-video w-full object-cover"
            />
          )}
          <CardHeader>
            <CardTitle className="text-sm">{p.author}</CardTitle>
            <CardDescription>
              {area(p.course)} · {p.ago}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">{p.text}</CardContent>
        </Card>
      ))}
    </div>
  )
}
