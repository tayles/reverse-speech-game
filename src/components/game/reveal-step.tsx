import { useEffect, useRef, useState } from 'react'
import { ArrowRight, AudioLines, Loader2, RefreshCw, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Waveform } from '@/components/waveform'
import { PlayerChip } from '@/components/player-chip'
import { useClip } from '@/components/use-clip'
import { compareSignals } from '@/lib/acoustic'
import { decodeBlob } from '@/lib/audio'
import { scoreBand } from '@/lib/score-band'
import { cn, possessive } from '@/lib/utils'
import { attemptsBy, type Attempt, type Player, type Round } from '@/store/game-store'

interface Props {
  round: Round
  attempt: Attempt
  player: Player
  solo: boolean
  isLastAttempt: boolean
  onScore: (patch: Partial<Pick<Attempt, 'similarity'>>) => void
  onRetry: () => void
  onNext: () => void
}

export function RevealStep({
  round,
  attempt,
  player,
  solo,
  isLastAttempt,
  onScore,
  onRetry,
  onNext,
}: Props) {
  const original = useClip(round.audioId)
  const mine = useClip(attempt.audioId)
  const [unusable, setUnusable] = useState(false)
  const scoreRef = useRef(onScore)
  useEffect(() => {
    scoreRef.current = onScore
  })

  const similarity = attempt.similarity
  const band = similarity === undefined ? null : scoreBand(similarity)
  const ready = !!original.clip && !!mine.clip
  const comparing = similarity === undefined && !unusable && ready

  const previous = attemptsBy(round, player.id)
  const tryNumber = previous.findIndex((a) => a.id === attempt.id) + 1
  const best = previous.reduce((top, a) => Math.max(top, a.points), 0)
  const isPersonalBest = similarity !== undefined && similarity >= best && previous.length > 1

  /**
   * Score the attempt by comparing how it *sounds* to the original phrase.
   * Nothing to press: the answer is already in the two clips, and a stored
   * clip cannot be transcribed in the browser anyway.
   */
  useEffect(() => {
    if (similarity !== undefined || !original.clip || !mine.clip) return
    let live = true

    // Yield first, so the reveal audio starts playing before we block on maths.
    const timer = setTimeout(async () => {
      try {
        const [phrase, flipped] = await Promise.all([
          decodeBlob(original.clip!.wav),
          decodeBlob(mine.clip!.reversedWav),
        ])
        if (!live) return
        const result = compareSignals(
          phrase.getChannelData(0),
          flipped.getChannelData(0),
          phrase.sampleRate,
        )
        if (!live) return
        if (result.usable) scoreRef.current({ similarity: result.score })
        else setUnusable(true)
      } catch {
        if (live) setUnusable(true)
      }
    }, 400)

    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [similarity, original.clip, mine.clip])

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-5xl" aria-hidden="true">🔍</p>
        <h2 className="mt-1 text-3xl font-extrabold tracking-tight">
          {solo ? 'Now flip it back around…' : `Now let's flip ${possessive(player.name)} go around…`}
        </h2>
        <p className="mt-1 text-lg font-bold text-white/60">
          If it worked, you&apos;ll hear “{round.phrase || 'the phrase'}”
        </p>
      </div>

      <Card className="ring-2 ring-lime/40">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <PlayerChip player={player} size="sm" subtitle="backwards" showName={!solo} />
            <Badge variant="good">
              {previous.length > 1 ? `Go ${tryNumber} of ${previous.length}` : 'The big reveal'}
            </Badge>
          </div>
          {!mine.loading && mine.reversedUrl && (
            <Waveform
              url={mine.reversedUrl}
              colour="var(--color-lime)"
              height={80}
              autoPlay
              label="Tap to hear it again"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 p-5">
          {comparing && (
            <p className="flex items-center justify-center gap-2 text-lg font-extrabold text-white/55">
              <Loader2 className="size-5 animate-spin" /> Comparing the sounds…
            </p>
          )}

          {similarity !== undefined && band && (
            <div className="animate-pop space-y-2 text-center">
              <p className="flex items-center justify-center gap-1.5 text-sm font-extrabold uppercase tracking-widest text-white/35">
                <AudioLines className="size-4" /> Sound match
              </p>
              <p className={cn('text-4xl font-extrabold', band.tone)}>
                {band.emoji} {band.label}
              </p>
              <Progress
                value={similarity}
                indicatorClassName={
                  similarity >= 70 ? 'bg-lime' : similarity >= 40 ? 'bg-sun' : 'bg-tang'
                }
              />
              <p className="text-2xl font-extrabold tabular-nums text-white/80">
                {similarity}% like the original
              </p>
              {isPersonalBest && (
                <p className="flex items-center justify-center gap-1.5 text-base font-extrabold text-sun">
                  <Trophy className="size-4" /> Your best go yet!
                </p>
              )}
            </div>
          )}

          {unusable && (
            <p className="text-center text-lg font-bold text-sun">
              That one was too quiet to compare — have another go!
            </p>
          )}

          {previous.length > 1 && (
            <div className="space-y-2 border-t border-white/10 pt-4">
              <p className="text-base font-extrabold text-white/50">
                {solo ? 'Your goes' : `${possessive(player.name)} goes`} — best one counts
              </p>
              <div className="flex flex-wrap gap-2">
                {previous.map((a, i) => (
                  <span
                    key={a.id}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-base font-extrabold tabular-nums ring-1',
                      a.points === best
                        ? 'bg-lime/25 text-lime ring-lime/40'
                        : 'bg-white/8 text-white/50 ring-white/12',
                      a.id === attempt.id && 'ring-2 ring-white/60',
                    )}
                  >
                    {i + 1}: {a.similarity === undefined ? '—' : `${a.points}%`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="sun" size="xl" className="w-full" onClick={onRetry}>
        <RefreshCw /> Try again
      </Button>

      <Button variant="go" size="xl" className="w-full" onClick={onNext}>
        {isLastAttempt ? 'See the round results' : 'Next player'} <ArrowRight />
      </Button>
    </div>
  )
}
