import type { ReactNode } from 'react'

/** In-app avatars use the complete cutout; the square logo is for PWA icons. */
export const Gull = ({ className = 'size-10' }: { className?: string }) => (
  <GullPose className={className} />
)

const gullPoses = {
  wave: { label: '반겨 주는 갈매기', size: 1254 },
  think: { label: '생각하는 갈매기', size: 1254 },
  map: { label: '여행 지도를 보는 갈매기', size: 1254 },
  cheer: { label: '완주를 축하하는 갈매기', size: 1254 },
} as const
type GullPoseName = keyof typeof gullPoses

/** Reserve a square independently of the image's intrinsic size or loading.
 * Parent flex/grid rules size the frame; they cannot stretch or crop the art.
 */
export const GullPose = ({
  pose = 'wave',
  className = '',
  decorative = false,
}: {
  pose?: GullPoseName
  className?: string
  decorative?: boolean
}) => (
  <span className={`gull-cutout ${className}`} data-gull-pose={pose}>
    <img
      src={`/images/brand/gull-${pose}-transparent.png`}
      width={gullPoses[pose].size}
      height={gullPoses[pose].size}
      alt={decorative ? '' : gullPoses[pose].label}
      className="gull-cutout-image"
      decoding="async"
    />
  </span>
)

/** A shared, responsive introduction for the app's three main destinations. */
export const MascotBanner = ({
  pose,
  eyebrow,
  title,
  description,
}: {
  pose: GullPoseName
  eyebrow: string
  title: ReactNode
  description: string
}) => (
  <section className="mascot-panel grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-2 rounded-3xl border border-primary/10 px-5 py-5 min-[380px]:grid-cols-[minmax(0,1fr)_8rem] sm:grid-cols-[minmax(0,1fr)_12rem] sm:gap-5 sm:px-7">
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-[0.625rem] font-bold tracking-[0.14em] text-primary sm:text-xs">
        {eyebrow}
      </p>
      <h1 className="brand-heading text-xl leading-snug sm:text-3xl">
        {title}
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
    <GullPose pose={pose} className="w-full" decorative />
  </section>
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
      <span className="text-xs font-semibold tracking-[0.2em] text-blue-100">
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
  <footer className="px-1 py-4 text-center text-xs text-muted-foreground">
    <a
      href="/asset-credits.html"
      target="_blank"
      rel="noreferrer"
      className="rounded hover:text-primary focus-visible:outline-2"
      aria-label="Copyright 및 이미지 라이선스"
    >
      © 2026 RUN2구룡포
    </a>
  </footer>
)
