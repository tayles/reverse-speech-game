import { createRoute, Link } from '@tanstack/react-router'
import { Library, Trash2, ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'

import { PeakStrip } from '@/components/peak-strip'
import { PlayerChip } from '@/components/player-chip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useClip } from '@/components/use-clip'
import { Waveform } from '@/components/waveform'
import { cn, formatDate, formatDuration, isDefined } from '@/lib/utils'
import { useGameStore, type Game, type Round } from '@/store/game-store'

import { Route as rootRoute } from './__root'

function RoundCard({ game, round, index }: { game: Game; round: Round; index: number }) {
  const [open, setOpen] = useState(false)
  const clip = useClip(open ? round.audioId : undefined)
  const master = game.players.find((p) => p.id === round.masterId)
  const deleteRound = useGameStore((s) => s.deleteRound)

  return (
    <Card>
      <CardContent className="p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 rounded-2xl text-left focus-visible:ring-4 focus-visible:ring-white/40 focus-visible:outline-none"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-xl font-extrabold text-white/60">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-extrabold text-sun">
              “{round.phrase || 'unlabelled clip'}”
            </span>
            <span className="block truncate text-sm font-bold text-white/45">
              {master ? `${master.emoji} ${master.name}` : 'unknown'} ·{' '}
              {formatDuration(round.duration)} · {round.attempts.length} attempt
              {round.attempts.length === 1 ? '' : 's'} · {formatDate(round.createdAt)}
            </span>
          </span>
          <ChevronDown
            className={cn(
              'size-6 shrink-0 text-white/40 transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>

        {open && (
          <div className="mt-4 animate-pop space-y-4 border-t border-white/10 pt-4">
            {clip.missing ? (
              <p className="rounded-2xl bg-tang/20 p-3 text-base font-bold text-tang">
                The audio for this clip is no longer on this device.
              </p>
            ) : (
              <>
                {clip.forwardUrl && (
                  <Waveform
                    url={clip.forwardUrl}
                    colour="var(--color-sky)"
                    height={48}
                    label="Original"
                  />
                )}
                {clip.reversedUrl && (
                  <Waveform
                    url={clip.reversedUrl}
                    colour="var(--color-bubble)"
                    height={48}
                    label="Backwards"
                  />
                )}
              </>
            )}

            {round.attempts.map((attempt) => {
              const player = game.players.find((p) => p.id === attempt.playerId)
              if (!player) return null
              return (
                <AttemptCard
                  key={attempt.id}
                  audioId={attempt.audioId}
                  playerName={player.name}
                  colour={player.colour}
                  emoji={player.emoji}
                  points={attempt.points}
                  similarity={attempt.similarity}
                />
              )
            })}

            <Button variant="ghost" size="sm" onClick={() => void deleteRound(game.id, round.id)}>
              <Trash2 /> Delete this clip
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AttemptCard({
  audioId,
  playerName,
  colour,
  emoji,
  points,
  similarity,
}: {
  audioId: string
  playerName: string
  colour: string
  emoji: string
  points: number
  similarity?: number | undefined
}) {
  const { reversedUrl, clip } = useClip(audioId)
  return (
    <div className="space-y-2 rounded-2xl bg-white/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-base font-extrabold">
          <span aria-hidden="true">{emoji}</span> {playerName}{' '}
          <span className="text-white/40">flipped back</span>
        </span>
        <Badge variant={points >= 60 ? 'good' : 'default'}>
          {similarity === undefined ? 'no match' : `${points}%`}
        </Badge>
      </div>
      {reversedUrl ? (
        <Waveform url={reversedUrl} colour={colour} height={40} />
      ) : (
        clip && <PeakStrip peaks={clip.peaks} colour={colour} reversed />
      )}
    </div>
  )
}

function ClipsPage() {
  const games = useGameStore((s) => s.games)
  const gameOrder = useGameStore((s) => s.gameOrder)
  const list = useMemo(() => gameOrder.map((id) => games[id]).filter(isDefined), [gameOrder, games])
  const withRounds = list.filter((g) => g.rounds.length > 0)
  const [tab, setTab] = useState<string>(() => withRounds[0]?.id ?? '')

  const totalClips = withRounds.reduce(
    (sum, g) => sum + g.rounds.length + g.rounds.reduce((n, r) => n + r.attempts.length, 0),
    0,
  )

  if (withRounds.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-6xl" aria-hidden="true">
          📼
        </p>
        <h1 className="mt-3 text-3xl font-extrabold">No clips yet</h1>
        <p className="mt-1 text-lg font-bold text-white/55">
          Record your first phrase and it will show up here.
        </p>
        <Button variant="go" size="lg" className="mt-6" asChild>
          <Link to="/">Start playing</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <Library className="size-7 text-bubble" />
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Your clips</h1>
          <p className="text-base font-bold text-white/50">
            {totalClips} recording{totalClips === 1 ? '' : 's'} saved on this device
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-4 scrollbar-none overflow-x-auto px-4">
          <TabsList className="w-auto min-w-full">
            {withRounds.map((game) => (
              <TabsTrigger key={game.id} value={game.id} className="flex-none px-4">
                {game.mode === 'solo' ? '🧑' : '🎉'} {game.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {withRounds.map((game) => (
          <TabsContent key={game.id} value={game.id} className="space-y-3">
            <div className="flex flex-wrap gap-2 px-1">
              {game.players.map((p) => (
                <PlayerChip key={p.id} player={p} size="sm" />
              ))}
            </div>
            {game.rounds.map((round, i) => (
              <RoundCard key={round.id} game={game} round={round} index={i} />
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/clips',
  component: ClipsPage,
})
