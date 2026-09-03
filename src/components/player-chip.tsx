import type { Player } from '@/store/game-store'
import { cn } from '@/lib/utils'

export function PlayerChip({
  player,
  size = 'md',
  className,
  showName = true,
  subtitle,
}: {
  player: Player
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showName?: boolean
  subtitle?: string
}) {
  const avatar = {
    sm: 'size-9 text-xl',
    md: 'size-12 text-2xl',
    lg: 'size-16 text-3xl',
    xl: 'size-24 text-5xl',
  }[size]
  const name = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl',
  }[size]

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span
        className={cn('grid shrink-0 place-items-center rounded-full ring-2 ring-white/25', avatar)}
        style={{ background: `color-mix(in oklab, ${player.colour} 35%, transparent)` }}
        aria-hidden="true"
      >
        {player.emoji}
      </span>
      {showName && (
        <span className="min-w-0">
          <span className={cn('block truncate font-extrabold', name)}>{player.name}</span>
          {subtitle && <span className="block text-sm font-bold text-white/50">{subtitle}</span>}
        </span>
      )}
    </div>
  )
}
