import { useEffect, useRef, useState } from 'react'
import { ArrowRight, AudioLines, Keyboard, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Waveform } from '@/components/waveform'
import { PlayerChip } from '@/components/player-chip'
import { StarRating } from '@/components/star-rating'
import { useClip } from '@/components/use-clip'
import { compareSignals } from '@/lib/acoustic'
import { decodeBlob } from '@/lib/audio'
import { comparePhrases, scoreBand } from '@/lib/similarity'
import { cn, possessive } from '@/lib/utils'
import type { Attempt, Player, Round } from '@/store/game-store'

interface Props {
  round: Round
  attempt: Attempt
  player: Player
  solo: boolean
  isLastAttempt: boolean
  onScore: (patch: Partial<Pick<Attempt, 'stars' | 'similarity' | 'guess' | 'guessScore'>>) => void
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
  const [showGuess, setShowGuess] = useState(false)
  const [guess, setGuess] = useState(attempt.guess ?? '')
  const scoreRef = useRef(onScore)
  useEffect(() => {
    scoreRef.current = onScore
  })

  const similarity = attempt.similarity
  const band = similarity === undefined ? null : scoreBand(similarity)
  const ready = !!original.clip && !!mine.clip
  const comparing = similarity === undefined && !unusable && ready

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

  const submitGuess = () => {
    const text = guess.trim()
    if (!text || !round.phrase) return
    onScore({ guess: text, guessScore: comparePhrases(round.phrase, text).score })
  }

  const words =
    round.phrase && attempt.guess ? comparePhrases(round.phrase, attempt.guess) : null

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
            <Badge variant="good">The big reveal</Badge>
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
        <CardContent className="space-y-4 p-5">
          <p className="text-lg font-extrabold text-white/70">Compare with the original</p>
          {!original.loading && original.forwardUrl && (
            <Waveform
              url={original.forwardUrl}
              colour="var(--color-sky)"
              height={48}
              label={`“${round.phrase || 'original phrase'}”`}
            />
          )}
          {!mine.loading && mine.forwardUrl && (
            <Waveform
              url={mine.forwardUrl}
              colour="var(--color-grape)"
              height={48}
              label={solo ? 'Your gibberish (forwards)' : `${possessive(player.name)} gibberish (forwards)`}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 p-5">
          <StarRating
            label="How close was it?"
            value={attempt.stars}
            onChange={(stars) => onScore({ stars })}
          />

          <div className="space-y-3 border-t border-white/10 pt-4">
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
                <p className={cn('text-3xl font-extrabold', band.tone)}>
                  {band.emoji} {band.label}
                </p>
                <Progress
                  value={similarity}
                  indicatorClassName={
                    similarity >= 70 ? 'bg-lime' : similarity >= 40 ? 'bg-sun' : 'bg-tang'
                  }
                />
                <p className="text-lg font-extrabold tabular-nums text-white/70">
                  {similarity}% like the original
                </p>
              </div>
            )}

            {unusable && (
              <p className="text-center text-base font-bold text-sun">
                That one was too quiet to compare — the stars are all yours to give.
              </p>
            )}

            {attempt.guess && (
              <div className="space-y-1 text-center">
                <p className="text-base font-bold text-white/50">
                  You heard: “{attempt.guess}” ({attempt.guessScore}% of the words)
                </p>
                {words && words.matchedWords.length > 0 && (
                  <p className="text-base font-bold text-lime">
                    Got: {words.matchedWords.join(', ')}
                  </p>
                )}
              </div>
            )}

            {round.phrase && !showGuess && (
              <div className="flex justify-center">
                <Button variant="soft" size="sm" onClick={() => setShowGuess(true)}>
                  <Keyboard /> Type what you heard
                </Button>
              </div>
            )}

              {showGuess && round.phrase && (
                <div className="flex gap-2">
                  <Input
                    value={guess}
                    maxLength={80}
                    placeholder="What did the backwards clip say?"
                    onChange={(e) => setGuess(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitGuess()}
                    aria-label="What you heard"
                  />
                  <Button variant="go" onClick={submitGuess}>
                    Check
                  </Button>
                </div>
              )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
            <span className="text-lg font-extrabold text-white/60">
              Points: <span className="text-sun tabular-nums">{attempt.points}</span>
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onRetry}>
                <Trash2 /> Redo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button variant="go" size="xl" className="w-full" onClick={onNext}>
        {isLastAttempt ? 'See the round results' : 'Next player'} <ArrowRight />
      </Button>

      {!round.phrase && (
        <p className="flex items-center justify-center gap-2 text-center text-base font-bold text-white/40">
          <RotateCcw className="size-4" /> Add the phrase on the listen screen to also guess it in words.
        </p>
      )}
    </div>
  )
}
