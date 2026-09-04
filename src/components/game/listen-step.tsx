import { Pencil, Check, RotateCcw } from 'lucide-react'
import { useState } from 'react'

import { PlayerChip } from '@/components/player-chip'
import { RecordButton, type RecordingResult } from '@/components/record-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useClip } from '@/components/use-clip'
import { Waveform } from '@/components/waveform'
import type { Player, Round, Settings } from '@/store/game-store'

interface Props {
  round: Round
  roundNumber: number
  master: Player
  /** Whoever is up next to copy the sound. */
  player: Player
  attemptsDone: number
  attemptsTotal: number
  /** This player already had a go and is having another. */
  retry: boolean
  solo: boolean
  settings: Settings
  /** Re-recording the phrase is only offered while it would spoil nobody's go. */
  canRerecord: boolean
  onPhraseChange: (phrase: string) => void
  onRerecord: () => void
  onRecorded: (result: RecordingResult) => Promise<void>
}

/**
 * Listening and copying live on one page. They were two screens with a "my
 * turn" button between them, which meant a tap and a page change between
 * hearing the sound and copying it — exactly when you most want it fresh.
 */
export function ListenStep({
  round,
  roundNumber,
  master,
  player,
  attemptsDone,
  attemptsTotal,
  retry,
  solo,
  settings,
  canRerecord,
  onPhraseChange,
  onRerecord,
  onRecorded,
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
        <p className="text-sm font-extrabold tracking-widest text-white/40 uppercase">
          Round {roundNumber}
          {attemptsTotal > 1 &&
            ` · go ${Math.min(attemptsDone + 1, attemptsTotal)} of ${attemptsTotal}`}
        </p>
        <h2 className="mt-1 text-3xl font-extrabold tracking-tight">
          {retry ? 'Have another go!' : 'Listen carefully!'}
        </h2>
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
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white/6 px-4 py-3 text-center transition hover:bg-white/12 focus-visible:ring-4 focus-visible:ring-white/40 focus-visible:outline-none"
            >
              <span className="text-2xl font-extrabold text-sun sm:text-3xl">
                “{round.phrase || 'tap to add the phrase'}”
              </span>
              <Pencil className="size-5 shrink-0 text-white/40" />
            </button>
          )}

          {round.phrase && round.phraseSource !== 'manual' && (
            <p className="text-center text-sm font-bold text-white/40">
              {round.phraseSource === 'speech'
                ? '🤖 heard automatically — tap it to fix'
                : '💡 from the idea list — tap it to fix'}
            </p>
          )}

          {!loading && forwardUrl && (
            <Waveform
              url={forwardUrl}
              colour="var(--color-sky)"
              label="The real phrase"
              height={56}
            />
          )}
        </CardContent>
      </Card>

      {canRerecord && (
        <Button variant="sun" size="xl" className="w-full" onClick={onRerecord}>
          <RotateCcw /> Re-record the phrase
        </Button>
      )}

      <Card className="ring-2 ring-bubble/50">
        <CardContent className="space-y-4 p-5">
          <div>
            <p className="text-2xl font-extrabold">🔁 Backwards!</p>
            <p className="text-base font-bold text-white/55">
              This is the sound to copy. Tap the snail to hear it slowly, or tap anywhere on the
              wave to start from there.
            </p>
          </div>

          {missing && (
            <p className="rounded-2xl bg-tang/20 p-3 text-center text-base font-bold text-tang">
              That recording has gone missing from this device.
            </p>
          )}

          {!loading && reversedUrl && (
            <Waveform
              url={reversedUrl}
              colour="var(--color-bubble)"
              height={80}
              autoPlay
              label="Play it as many times as you like"
            />
          )}
        </CardContent>
      </Card>

      <div className="text-center">
        <PlayerChip player={player} size="lg" showName={false} className="justify-center" />
        <h3 className="mt-2 text-3xl font-extrabold tracking-tight">
          {solo ? 'Copy the gibberish!' : `Go on ${player.name} — copy the gibberish!`}
        </h3>
        <p className="mx-auto mt-1 max-w-sm text-lg font-bold text-white/60">
          Make the same sounds you just heard. Don&apos;t say the real phrase!
        </p>
      </div>

      <RecordButton
        maxSeconds={settings.maxRecordSeconds + 3}
        /* The attempt is deliberate gibberish, so auto-labelling would be noise. */
        speechLabels={false}
        haptics={settings.haptics}
        autoClean={settings.autoClean}
        colour={player.colour}
        idleLabel="Tap and make the sound"
        showCaption={false}
        onComplete={onRecorded}
      />
    </div>
  )
}
