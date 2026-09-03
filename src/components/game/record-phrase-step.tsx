import { useState } from 'react'
import { Lightbulb, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlayerChip } from '@/components/player-chip'
import { RecordButton, type RecordingResult } from '@/components/record-button'
import { PHRASE_IDEAS } from '@/data/phrases'
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
  /**
   * Stays null until it is asked for. A suggestion on screen doubles as the
   * phrase label when speech recognition comes back empty, so offering one
   * unprompted would put words in the player's mouth.
   */
  const [suggestion, setSuggestion] = useState<string | null>(null)

  const suggest = () =>
    setSuggestion((current) => {
      let next = pickRandom(PHRASE_IDEAS)
      while (PHRASE_IDEAS.length > 1 && next === current) next = pickRandom(PHRASE_IDEAS)
      return next
    })

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

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-blob bg-white/8 px-4 py-3 text-center ring-1 ring-white/12">
        <span className="text-lg font-bold text-white/55">Need an idea?</span>
        {suggestion && (
          <span key={suggestion} className="animate-pop text-xl font-extrabold text-sun">
            Try “{suggestion}”
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={suggest}>
          {suggestion ? <RefreshCw /> : <Lightbulb />}
          {suggestion ? 'Another one' : 'Give me one'}
        </Button>
      </div>

      <RecordButton
        maxSeconds={settings.maxRecordSeconds}
        speechLabels={settings.speechLabels}
        lang={settings.lang}
        haptics={settings.haptics}
        autoClean={settings.autoClean}
        colour={master.colour}
        idleLabel="Tap the mic and speak"
        onComplete={(result) => onRecorded(result, suggestion)}
      />
    </div>
  )
}
