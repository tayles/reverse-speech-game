import { RefreshCw } from 'lucide-react'
import { useState } from 'react'

import { PlayerChip } from '@/components/player-chip'
import { RecordButton, type RecordingResult } from '@/components/record-button'
import { Button } from '@/components/ui/button'
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
  const [suggestion, setSuggestion] = useState(() => pickRandom(PHRASE_IDEAS))

  /** Never hand back the phrase already on screen. */
  const suggest = () =>
    setSuggestion((current) => {
      let next = pickRandom(PHRASE_IDEAS)
      while (PHRASE_IDEAS.length > 1 && next === current) next = pickRandom(PHRASE_IDEAS)
      return next
    })

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-sm font-extrabold tracking-widest text-white/40 uppercase">
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

      <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-blob bg-white/8 px-5 py-4 ring-1 ring-white/12">
        <p className="text-lg font-bold text-white/55">
          Need an idea? Try {/* Quotes ride along inside, so a wrap never strands one. */}
          <span
            key={suggestion}
            className="inline-block animate-pop text-xl font-extrabold whitespace-nowrap text-sun"
          >
            “{suggestion}”
          </span>
        </p>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={suggest}>
          <RefreshCw /> Another one
        </Button>
      </div>
    </div>
  )
}
