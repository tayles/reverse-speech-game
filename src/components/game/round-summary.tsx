import { Mic, Repeat, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Waveform } from '@/components/waveform'
import { PlayerChip } from '@/components/player-chip'
import { Scoreboard } from './scoreboard'
import { useClip } from '@/components/use-clip'
import { cn } from '@/lib/utils'
import { attemptsBy, bestAttempt, type Attempt, type Game, type Player, type Round } from '@/store/game-store'

function AttemptRow({
  attempt,
  player,
  goNumber,
  goCount,
  counts,
}: {
  attempt: Attempt
  player: Player
  goNumber: number
  goCount: number
  counts: boolean
}) {
  const { reversedUrl, loading } = useClip(attempt.audioId)

  return (
    <div
      className={cn(
        'space-y-2 rounded-2xl p-3',
        counts ? 'bg-lime/10 ring-1 ring-lime/30' : 'bg-white/5',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-base font-extrabold text-white/70">
          {goCount > 1 ? `Go ${goNumber}` : 'Their go'}
          {counts && goCount > 1 && <span className="ml-2 text-sm text-lime">best</span>}
        </span>
        <Badge variant={attempt.points >= 60 ? 'good' : attempt.points >= 30 ? 'warn' : 'default'}>
          {attempt.similarity === undefined ? 'no match' : `${attempt.points}%`}
        </Badge>
      </div>
      {!loading && reversedUrl && (
        <Waveform url={reversedUrl} colour={player.colour} height={40} showPlayButton />
      )}
    </div>
  )
}

/** All of one player's goes at this round, with the scoring one highlighted. */
function PlayerAttempts({ game, round, player }: { game: Game; round: Round; player: Player }) {
  const goes = attemptsBy(round, player.id)
  const best = bestAttempt(round, player.id)
  if (goes.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <PlayerChip player={player} size="sm" showName={game.mode !== 'solo'} />
        <Badge variant={(best?.points ?? 0) >= 60 ? 'good' : 'default'}>
          {best?.points ?? 0} pts
        </Badge>
      </div>
      {goes.map((attempt, i) => (
        <AttemptRow
          key={attempt.id}
          attempt={attempt}
          player={player}
          goNumber={i + 1}
          goCount={goes.length}
          counts={attempt.id === best?.id}
        />
      ))}
    </div>
  )
}

interface Props {
  game: Game
  round: Round
  roundNumber: number
  onNextRound: () => void
  onFinish: () => void
}

export function RoundSummary({ game, round, roundNumber, onNextRound, onFinish }: Props) {
  const solo = game.mode === 'solo'
  const master = game.players.find((p) => p.id === round.masterId)
  const original = useClip(round.audioId)
  const best = round.attempts.toSorted((a, b) => b.points - a.points)[0]
  const bestPlayer = best ? game.players.find((p) => p.id === best.playerId) : undefined

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-6xl" aria-hidden="true">🎊</p>
        <h2 className="mt-1 text-3xl font-extrabold tracking-tight">Round {roundNumber} done!</h2>
        {bestPlayer && best.points > 0 && (
          <p className="mt-1 text-lg font-bold text-white/60">
            {solo ? (
              <>
                You scored <span className="text-sun">{best.points}</span> points.
              </>
            ) : (
              <>
                {bestPlayer.emoji} <span className="text-sun">{bestPlayer.name}</span> nailed it best
                with {best.points} points.
              </>
            )}
          </p>
        )}
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-2xl font-extrabold text-sun">
              {round.phrase ? `“${round.phrase}”` : 'Unlabelled clip'}
            </p>
            {master && !solo && <PlayerChip player={master} size="sm" showName={false} />}
          </div>
          {!original.loading && original.forwardUrl && (
            <Waveform url={original.forwardUrl} colour="var(--color-sky)" height={44} label="Original" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="flex items-center gap-2 text-xl font-extrabold">
            <Mic className="size-5" /> {solo ? 'Your go, flipped back' : "Everyone's go, flipped back"}
          </p>
          {round.attempts.length === 0 ? (
            <p className="text-base font-bold text-white/45">Nobody had a turn this round.</p>
          ) : (
            game.players
              .filter((p) => attemptsBy(round, p.id).length > 0)
              .map((p) => <PlayerAttempts key={p.id} game={game} round={round} player={p} />)
          )}
        </CardContent>
      </Card>

      <Scoreboard game={game} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Button variant="go" size="lg" onClick={onNextRound}>
          <Repeat /> Next round
        </Button>
        <Button variant="soft" size="lg" onClick={onFinish}>
          <Flag /> Finish game
        </Button>
      </div>
    </div>
  )
}
