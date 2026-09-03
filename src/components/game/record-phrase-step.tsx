import { useState } from 'react'
import { Lightbulb, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PlayerChip } from '@/components/player-chip'
import { RecordButton, type RecordingResult } from '@/components/record-button'
import { PHRASE_PACKS } from '@/data/phrases'
import { pickRandom } from '@/lib/utils'
import type { Player, Settings } from '@/store/game-store'

interface Props {
  master: Player
  roundNumber: number
  settings: Settings
  solo: boolean
  onRecorded: (result: RecordingResult, suggestion: string | null) => Promise<void>
}

export function RecordPhraseStep({ master, roundNumber, settings, solo, onRecorded }: Props) {
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [pack, setPack] = useState(PHRASE_PACKS[0])

  const suggest = (packIndex?: number) => {
    const chosen = packIndex === undefined ? pack : PHRASE_PACKS[packIndex]
    setPack(chosen)
    setSuggestion(pickRandom(chosen.phrases))
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-sm font-extrabold uppercase tracking-widest text-white/40">
          Round {roundNumber}
        </p>
        <div className="mt-3 flex flex-col items-center gap-2">
          <PlayerChip player={master} size="xl" showName={false} className="animate-float" />
          <h2 className="text-3xl font-extrabold tracking-tight">
            {solo ? 'Say a phrase!' : `${master.name}, say a phrase!`}
          </h2>
          <p className="max-w-sm text-lg font-bold text-white/60">
            {solo
              ? "Speak clearly, then you'll hear it backwards."
              : 'Speak clearly, then everyone will hear it backwards.'}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          {suggestion ? (
            <div className="animate-pop text-center">
              <p className="text-sm font-extrabold uppercase tracking-widest text-white/40">
                {pack.emoji} {pack.name}
              </p>
              <p className="mt-1 text-3xl font-extrabold text-sun">“{suggestion}”</p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => suggest()}>
                <RefreshCw /> Another one
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <Button variant="soft" size="sm" onClick={() => suggest(0)}>
                <Lightbulb /> Need an idea?
              </Button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {PHRASE_PACKS.map((p, i) => (
              <button
                key={p.name}
                type="button"
                onClick={() => suggest(i)}
                className="rounded-full bg-white/8 px-3 py-1.5 text-sm font-extrabold text-white/70 ring-1 ring-white/12 transition hover:bg-white/16 active:scale-95"
              >
                {p.emoji} {p.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <RecordButton
        maxSeconds={settings.maxRecordSeconds}
        speechLabels={settings.speechLabels}
        lang={settings.lang}
        haptics={settings.haptics}
        colour={master.colour}
        idleLabel="Tap the mic and speak"
        onComplete={(result) => onRecorded(result, suggestion)}
      />
    </div>
  )
}
