import type { ReactNode } from 'react'
import { useI18n } from '#/i18n/react'

/** In-app avatars use the complete cutout; the square logo is for PWA icons. */
export const Gull = ({ className = 'size-10' }: { className?: string }) => (
  <GullPose className={className} />
)

const gullPoses = {
  wave: { label: 'journey.gullWave', size: 1254 },
  think: { label: 'journey.gullThink', size: 1254 },
  map: { label: 'journey.gullMap', size: 1254 },
  cheer: { label: 'journey.gullCheer', size: 1254 },
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
}) => {
  const { t } = useI18n()
  return (
    <span className={`gull-cutout ${className}`} data-gull-pose={pose}>
      <img
        src={`/images/brand/gull-${pose}-transparent.png`}
        width={gullPoses[pose].size}
        height={gullPoses[pose].size}
        alt={decorative ? '' : t(gullPoses[pose].label)}
        className="gull-cutout-image"
        decoding="async"
      />
    </span>
  )
}

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

export const BrandHero = () => {
  const { t } = useI18n()
  return (
    <div className="brand-hero relative isolate overflow-hidden rounded-2xl bg-primary text-primary-foreground">
      <img
        src="/images/guryongpo-sea.jpg"
        alt={t('journey.heroAlt')}
        width="960"
        height="540"
        className="absolute inset-0 -z-20 h-full w-full object-cover"
        fetchPriority="high"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-deep via-brand-deep/60 to-brand-deep/10" />
      <div className="flex min-h-64 flex-col justify-end gap-3 p-6">
        <span className="text-xs font-semibold tracking-[0.2em] text-primary-foreground/80">
          RUN2 GURYONGPO
        </span>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">
          {t('journey.heroTitle1')}
          <br />
          {t('journey.heroTitle2')}
        </h1>
        <p className="max-w-xs text-sm leading-relaxed text-primary-foreground/90">
          {t('journey.heroLead1')}
          <br />
          {t('journey.heroLead2')}
        </p>
      </div>
    </div>
  )
}

export const AssetCredits = () => {
  const { t } = useI18n()
  return (
    <footer className="px-1 py-4 text-center text-xs text-muted-foreground">
      <a
        href="/asset-credits.html"
        target="_blank"
        rel="noreferrer"
        className="rounded hover:text-primary focus-visible:outline-2"
        aria-label={t('journey.credits')}
      >
        © 2026 RUN2구룡포
      </a>
    </footer>
  )
}
