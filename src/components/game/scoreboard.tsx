import { Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { PlayerChip } from '@/components/player-chip'
import { Progress } from '@/components/ui/progress'
import { leaderboard, type Game } from '@/store/game-store'
import { cn, plural } from '@/lib/utils'

const MEDALS = ['🥇', '🥈', '🥉']

export function Scoreboard({ game, compact = false }: { game: Game; compact?: boolean }) {
  const rows = leaderboard(game)
  const top = Math.max(1, rows[0]?.points ?? 1)

  if (game.players.length === 1) {
    const row = rows[0]
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <PlayerChip
            player={row.player}
            size="lg"
            subtitle={plural(row.attempts, 'try', 'tries')}
          />
          <div className="text-right">
            <p className="text-4xl font-extrabold tabular-nums text-sun">{row.points}</p>
            <p className="text-sm font-bold text-white/45">points</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className={cn('space-y-3', compact ? 'p-4' : 'p-5')}>
        {!compact && (
          <p className="flex items-center gap-2 text-xl font-extrabold">
            <Trophy className="size-5 text-sun" /> Scores
          </p>
        )}
        {rows.map((row, i) => (
          <div key={row.player.id} className="flex items-center gap-3">
            <span className="w-7 shrink-0 text-center text-2xl" aria-hidden="true">
              {MEDALS[i] ?? <span className="text-base font-extrabold text-white/30">{i + 1}</span>}
            </span>
            <PlayerChip player={row.player} size="sm" showName={false} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-base font-extrabold">{row.player.name}</span>
                <span className="shrink-0 text-lg font-extrabold tabular-nums text-sun">
                  {row.points}
                </span>
              </div>
              <Progress
                value={(row.points / top) * 100}
                className="h-2.5"
                indicatorClassName={i === 0 ? 'bg-sun' : 'bg-grape'}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
