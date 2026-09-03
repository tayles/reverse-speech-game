import { useState } from 'react'
import { ArrowRight, Pencil, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Waveform } from '@/components/waveform'
import { PlayerChip } from '@/components/player-chip'
import { useClip } from '@/components/use-clip'
import type { Player, Round } from '@/store/game-store'
import { possessive } from '@/lib/utils'

interface Props {
  round: Round
  roundNumber: number
  master: Player
  nextPlayer: Player | undefined
  attemptsDone: number
  attemptsTotal: number
  solo: boolean
  onPhraseChange: (phrase: string) => void
  onReady: () => void
}

export function ListenStep({
  round,
  roundNumber,
  master,
  nextPlayer,
  attemptsDone,
  attemptsTotal,
  solo,
  onPhraseChange,
  onReady,
}: Props) {
  const { forwardUrl, reversedUrl, loading, missing } = useClip(round.audioId)
  const [editing, setEditing] = useState(!round.phrase)
  const [draft, setDraft] = useState(round.phrase)

  const savePhrase = () => {
    onPhraseChange(draft.trim())
    setEditing(false)
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-sm font-extrabold uppercase tracking-widest text-white/40">
          Round {roundNumber}
          {attemptsTotal > 1 &&
            ` · go ${Math.min(attemptsDone + 1, attemptsTotal)} of ${attemptsTotal}`}
        </p>
        <h2 className="mt-1 text-3xl font-extrabold tracking-tight">Listen carefully!</h2>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <PlayerChip player={master} size="sm" subtitle="recorded this" showName={!solo} />
            <Badge>The phrase</Badge>
          </div>

          {editing ? (
            <div className="flex gap-2">
              <Input
                value={draft}
                maxLength={80}
                placeholder="What was said?"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && savePhrase()}
                aria-label="The phrase that was said"
              />
              <Button variant="go" size="icon" onClick={savePhrase} aria-label="Save phrase">
                <Check />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(round.phrase)
                setEditing(true)
              }}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white/6 px-4 py-3 text-center transition hover:bg-white/12 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
            >
              <span className="text-2xl font-extrabold text-sun sm:text-3xl">
                “{round.phrase || 'tap to add the phrase'}”
              </span>
              <Pencil className="size-5 shrink-0 text-white/40" />
            </button>
          )}

          {round.phraseSource === 'speech' && round.phrase && (
            <p className="text-center text-sm font-bold text-white/40">
              🤖 heard automatically — tap it to fix
            </p>
          )}

          {missing && (
            <p className="rounded-2xl bg-tang/20 p-3 text-center text-base font-bold text-tang">
              That recording has gone missing from this device.
            </p>
          )}

          {!loading && forwardUrl && (
            <Waveform url={forwardUrl} colour="var(--color-sky)" label="The real phrase" height={56} />
          )}
        </CardContent>
      </Card>

      <Card className="ring-2 ring-bubble/50">
        <CardContent className="space-y-4 p-5">
          <div>
            <p className="text-2xl font-extrabold">🔁 Backwards!</p>
            <p className="text-base font-bold text-white/55">
              This is the sound to copy. Tap the snail to hear it slowly.
            </p>
          </div>

          {!loading && reversedUrl && (
            <Waveform
              url={reversedUrl}
              colour="var(--color-bubble)"
              height={80}
              label="Play it as many times as you like"
            />
          )}
        </CardContent>
      </Card>

      {nextPlayer && (
        <Button variant="go" size="xl" className="w-full" onClick={onReady}>
          <span className="mr-1 text-3xl" aria-hidden="true">{nextPlayer.emoji}</span>
          {solo ? 'My turn!' : `${possessive(nextPlayer.name)} turn`} <ArrowRight />
        </Button>
      )}
    </div>
  )
}
