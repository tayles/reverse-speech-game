import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Bot, Keyboard, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Waveform } from '@/components/waveform'
import { PlayerChip } from '@/components/player-chip'
import { StarRating } from '@/components/star-rating'
import { useClip } from '@/components/use-clip'
import { robotJudge } from '@/lib/judge'
import { isSpeechRecognitionSupported } from '@/lib/speech'
import { comparePhrases, scoreBand } from '@/lib/similarity'
import { cn, possessive } from '@/lib/utils'
import type { Attempt, Player, Round, Settings } from '@/store/game-store'

interface Props {
  round: Round
  attempt: Attempt
  player: Player
  settings: Settings
  solo: boolean
  isLastAttempt: boolean
  onScore: (patch: Partial<Pick<Attempt, 'stars' | 'autoScore' | 'robotHeard' | 'guess'>>) => void
  onRetry: () => void
  onNext: () => void
}

export function RevealStep({
  round,
  attempt,
  player,
  settings,
  solo,
  isLastAttempt,
  onScore,
  onRetry,
  onNext,
}: Props) {
  const original = useClip(round.audioId)
  const mine = useClip(attempt.audioId)
  const [judging, setJudging] = useState(false)
  const [live, setLive] = useState('')
  const [showGuess, setShowGuess] = useState(false)
  const [guess, setGuess] = useState(attempt.guess ?? '')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const canRobot = settings.robotJudge && isSpeechRecognitionSupported() && !!round.phrase
  const match = attempt.autoScore === undefined ? null : attempt.autoScore
  const band = match === null ? null : scoreBand(match)

  const runRobot = async () => {
    if (!mine.reversedUrl || !round.phrase) return
    setJudging(true)
    setLive('')
    abortRef.current = new AbortController()
    const verdict = await robotJudge(mine.reversedUrl, {
      lang: settings.lang,
      onPartial: setLive,
      signal: abortRef.current.signal,
    })
    setJudging(false)
    const heard = verdict.heard
    const result = comparePhrases(round.phrase, heard)
    onScore({ robotHeard: heard, autoScore: heard ? result.score : 0 })
  }

  const submitGuess = () => {
    const text = guess.trim()
    if (!text || !round.phrase) return
    const result = comparePhrases(round.phrase, text)
    onScore({ guess: text, autoScore: result.score })
  }

  const detail = attempt.robotHeard ?? attempt.guess ?? ''
  const words = round.phrase && detail ? comparePhrases(round.phrase, detail) : null

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

          {(round.phrase || match !== null) && (
            <div className="space-y-3 border-t border-white/10 pt-4">
              {match !== null && band && (
                <div className="animate-pop space-y-2 text-center">
                  <p className={cn('text-3xl font-extrabold', band.tone)}>
                    {band.emoji} {band.label}
                  </p>
                  <Progress
                    value={match}
                    indicatorClassName={match >= 70 ? 'bg-lime' : match >= 40 ? 'bg-sun' : 'bg-tang'}
                  />
                  <p className="text-lg font-extrabold tabular-nums text-white/70">{match}% match</p>
                  {detail && (
                    <p className="text-base font-bold text-white/50">
                      {attempt.robotHeard ? 'Robot heard' : 'You heard'}: “{detail}”
                    </p>
                  )}
                  {words && words.matchedWords.length > 0 && (
                    <p className="text-base font-bold text-lime">
                      Got: {words.matchedWords.join(', ')}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-2">
                {canRobot && (
                  <Button variant="sky" size="sm" onClick={() => void runRobot()} disabled={judging}>
                    {judging ? <Loader2 className="animate-spin" /> : <Bot />}
                    {judging ? 'Listening…' : match === null ? 'Ask the robot' : 'Ask again'}
                  </Button>
                )}
                {round.phrase && !showGuess && (
                  <Button variant="soft" size="sm" onClick={() => setShowGuess(true)}>
                    <Keyboard /> Type what you heard
                  </Button>
                )}
              </div>

              {judging && (
                <p className="text-center text-base font-bold text-white/50">
                  Turn the volume up! {live && `“${live}”`}
                </p>
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
          )}

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
          <RotateCcw className="size-4" /> Add the phrase on the listen screen to unlock auto-scoring.
        </p>
      )}
    </div>
  )
}
