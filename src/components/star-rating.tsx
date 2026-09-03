import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  value: number
  onChange?: (value: number) => void
  size?: 'sm' | 'lg'
  className?: string
  label?: string
}

/** Five fat, tappable stars — the main way humans score an attempt. */
export function StarRating({ value, onChange, size = 'lg', className, label }: StarRatingProps) {
  const readOnly = !onChange
  const starSize = size === 'lg' ? 'size-12 sm:size-14' : 'size-6'
  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      {label && <span className="text-lg font-extrabold text-white/70">{label}</span>}
      <div className="flex items-center gap-1" role={readOnly ? 'img' : 'radiogroup'} aria-label={label ?? 'Rating'}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= value
          const Wrapper = readOnly ? 'span' : 'button'
          return (
            <Wrapper
              key={n}
              {...(readOnly
                ? {}
                : {
                    type: 'button' as const,
                    onClick: () => onChange(value === n ? 0 : n),
                    'aria-label': `${n} star${n > 1 ? 's' : ''}`,
                    'aria-pressed': filled,
                  })}
              className={cn(
                'rounded-2xl p-1 transition',
                !readOnly && 'hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50',
              )}
            >
              <Star
                className={cn(
                  starSize,
                  'transition-all duration-200',
                  filled ? 'text-sun drop-shadow-[0_0_10px_oklch(0.85_0.17_85/0.6)]' : 'text-white/20',
                )}
                fill={filled ? 'currentColor' : 'none'}
                strokeWidth={2.5}
              />
            </Wrapper>
          )
        })}
      </div>
    </div>
  )
}
