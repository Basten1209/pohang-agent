// Each layer blurs a little more and starts a little lower: a soft
// progressive blur instead of a hard edge.
const layers = [
  { px: 1, from: 0 },
  { px: 2, from: 20 },
  { px: 4, from: 40 },
  { px: 8, from: 60 },
]

/** Blur that grows toward the bottom of its (positioned) parent. */
export const ProgressiveBlur = () => (
  <>
    {layers.map(({ px, from }) => (
      <div
        key={px}
        className="pointer-events-none absolute inset-0"
        style={{
          backdropFilter: `blur(${px}px)`,
          WebkitBackdropFilter: `blur(${px}px)`,
          maskImage: `linear-gradient(to bottom, transparent ${from}%, black ${from + 25}%)`,
          WebkitMaskImage: `linear-gradient(to bottom, transparent ${from}%, black ${from + 25}%)`,
        }}
      />
    ))}
  </>
)
