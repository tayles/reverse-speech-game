import { Mic, Repeat, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Waveform } from '@/components/waveform'
import { PlayerChip } from '@/components/player-chip'
import { StarRating } from '@/components/star-rating'
import { Scoreboard } from './scoreboard'
import { useClip } from '@/components/use-clip'
import type { Attempt, Game, Round } from '@/store/game-store'

function AttemptRow({ attempt, game }: { attempt: Attempt; game: Game }) {
  const player = game.players.find((p) => p.id === attempt.playerId)
  const { reversedUrl, loading } = useClip(attempt.audioId)
  if (!player) return null

  return (
    <div className="space-y-2 rounded-2xl bg-white/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <PlayerChip player={player} size="sm" />
        <div className="flex items-center gap-2">
          <StarRating value={attempt.stars} size="sm" />
          <Badge variant={attempt.points >= 60 ? 'good' : attempt.points >= 30 ? 'warn' : 'default'}>
            {attempt.points} pts
          </Badge>
        </div>
      </div>
      {!loading && reversedUrl && (
        <Waveform url={reversedUrl} colour={player.colour} height={40} showPlayButton />
      )}
      {attempt.similarity !== undefined && (
        <p className="text-sm font-bold text-white/45">
          {attempt.similarity}% sound match
          {attempt.guess ? ` · heard “${attempt.guess}”` : ''}
        </p>
      )}
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
            round.attempts.map((attempt) => (
              <AttemptRow key={attempt.id} attempt={attempt} game={game} />
            ))
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
