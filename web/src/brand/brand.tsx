export const Gull = ({ className = 'size-10' }: { className?: string }) => (
  <img
    src="/icons/icon-192.png"
    width="128"
    height="128"
    alt="갈매기 여행 친구"
    className={`rounded-full ${className}`}
  />
)

/** The welcome pose has its own transparent asset so no sprite crop can cut it. */
export const GullPose = ({
  pose = 'wave',
  className = '',
}: {
  pose?: 'wave' | 'think' | 'map' | 'cheer'
  className?: string
}) =>
  pose === 'wave' ? (
    <img
      src="/images/brand/gull-wave-transparent.png"
      width="1254"
      height="1254"
      alt="반겨 주는 갈매기"
      className={`gull-cutout ${className}`}
    />
  ) : (
    <div
      role="img"
      aria-label={
        {
          think: '생각하는 갈매기',
          map: '여행 지도를 보는 갈매기',
          cheer: '완주를 축하하는 갈매기',
        }[pose]
      }
      className={`gull-pose ${className}`}
      style={{
        backgroundPosition: `${{ think: 33.333, map: 66.667, cheer: 100 }[pose]}% 52%`,
      }}
    />
  )

export const BrandHero = () => (
  <div className="brand-hero relative isolate overflow-hidden rounded-2xl bg-primary text-white">
    <img
      src="/images/guryongpo-sea.jpg"
      alt="구룡포 해안의 바다"
      width="960"
      height="540"
      className="absolute inset-0 -z-20 h-full w-full object-cover"
      fetchPriority="high"
    />
    <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#073b50] via-[#073b50]/60 to-[#073b50]/10" />
    <div className="flex min-h-64 flex-col justify-end gap-3 p-6">
      <span className="text-xs font-semibold tracking-[0.2em] text-cyan-100">
        RUN2 GURYONGPO
      </span>
      <h1 className="text-3xl font-semibold leading-tight tracking-tight">
        달린 만큼,
        <br />
        구룡포를 더 가까이.
      </h1>
      <p className="max-w-xs text-sm leading-relaxed text-white/90">
        완주 후의 컨디션부터 돌아갈 시간까지.
        <br />
        당신에게 맞는 바다 여행을 함께 만들어요.
      </p>
    </div>
  </div>
)

export const AssetCredits = () => (
  <details className="px-1 text-[11px] leading-relaxed text-muted-foreground">
    <summary className="cursor-pointer">사진·캐릭터 출처</summary>
    <p>
      영일대·구룡포 바다 사진: Choi2451,{' '}
      <a
        className="underline"
        href="https://creativecommons.org/licenses/by-sa/3.0/"
        target="_blank"
        rel="noreferrer"
      >
        CC BY-SA 3.0
      </a>
      . 화면 비율에 맞춰 표시. 사진 파생물에도 같은 라이선스를 적용합니다.
    </p>
    <p>
      구룡포 가옥거리: Mobius6,{' '}
      <a
        className="underline"
        href="https://creativecommons.org/licenses/by/4.0/"
        target="_blank"
        rel="noreferrer"
      >
        CC BY 4.0
      </a>
      .
    </p>
    <p>
      <a
        className="underline"
        href="/asset-credits.html"
        target="_blank"
        rel="noreferrer"
      >
        원본 사진과 전체 출처
      </a>{' '}
      · 갈매기는 RUN2 자체 캐릭터이며 포항시 공식 캐릭터가 아닙니다.
    </p>
  </details>
)
