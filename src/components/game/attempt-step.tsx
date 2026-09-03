import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Waveform } from '@/components/waveform'
import { PlayerChip } from '@/components/player-chip'
import { RecordButton, type RecordingResult } from '@/components/record-button'
import { useClip } from '@/components/use-clip'
import { ArrowLeft } from 'lucide-react'
import type { Player, Round, Settings } from '@/store/game-store'

interface Props {
  round: Round
  player: Player
  settings: Settings
  solo: boolean
  onBack: () => void
  onRecorded: (result: RecordingResult) => Promise<void>
}

export function AttemptStep({ round, player, settings, solo, onBack, onRecorded }: Props) {
  const { reversedUrl, loading } = useClip(round.audioId)

  return (
    <div className="space-y-5">
      <div className="text-center">
        <PlayerChip player={player} size="xl" showName={false} className="justify-center" />
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
          {solo ? 'Copy the gibberish!' : `Go on ${player.name} — copy the gibberish!`}
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-lg font-bold text-white/60">
          Make the same sounds you just heard. Don&apos;t say the real phrase!
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          {!loading && reversedUrl && (
            <Waveform
              url={reversedUrl}
              colour="var(--color-bubble)"
              height={52}
              label="One more listen?"
            />
          )}
        </CardContent>
      </Card>

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

      <Button variant="ghost" className="w-full" onClick={onBack}>
        <ArrowLeft /> Listen again first
      </Button>
    </div>
  )
}
