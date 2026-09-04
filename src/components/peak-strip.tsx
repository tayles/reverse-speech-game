import { cn } from '@/lib/utils'

interface PeakStripProps {
  peaks: number[]
  /** 0..1 playback position — bars before this point light up. */
  progress?: number
  className?: string
  colour?: string
  bars?: number
  reversed?: boolean
}

/**
 * A cheap, dependency-free waveform. Used for lists and thumbnails where
 * spinning up a full WaveSurfer instance per row would be wasteful.
 */
export function PeakStrip({
  peaks,
  progress = 0,
  className,
  colour = 'var(--color-bubble)',
  bars = 48,
  reversed = false,
}: PeakStripProps) {
  const source = reversed ? peaks.toReversed() : peaks
  const step = Math.max(1, Math.floor(source.length / bars))
  const buckets: number[] = []
  for (let i = 0; i < source.length && buckets.length < bars; i += step) {
    let max = 0
    for (let k = i; k < Math.min(source.length, i + step); k++) max = Math.max(max, source[k] ?? 0)
    buckets.push(max)
  }
  if (buckets.length === 0) buckets.push(0)

  return (
    <div className={cn('flex h-10 items-center gap-[2px]', className)} aria-hidden="true">
      {buckets.map((v, i) => {
        const lit = i / buckets.length <= progress
        return (
          <span
            key={i}
            className="flex-1 rounded-full transition-[background-color,opacity] duration-150"
            style={{
              height: `${Math.max(9, v * 100)}%`,
              background: lit ? colour : 'rgba(255,255,255,0.22)',
              opacity: lit ? 1 : 0.75,
            }}
          />
        )
      })}
    </div>
  )
}
