import { useEffect, useState } from 'react'
import { createRoute } from '@tanstack/react-router'
import { Bot, HardDrive, Mic, Scissors, Sparkles, Vibrate, Trash2, Download, WifiOff } from 'lucide-react'
import { Route as rootRoute } from './__root'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { useGameStore } from '@/store/game-store'
import { estimateUsage } from '@/lib/db'
import { isSpeechRecognitionSupported } from '@/lib/speech'
import { isRecordingSupported } from '@/lib/recorder'
import { cn } from '@/lib/utils'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

function SettingRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
  disabled,
  note,
}: {
  icon: typeof Bot
  title: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  note?: string
}) {
  const id = title.replaceAll(/\s+/g, '-').toLowerCase()
  return (
    <div className={cn('flex items-start gap-4 py-4', disabled && 'opacity-50')}>
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10">
        <Icon className="size-6 text-bubble" />
      </span>
      <div className="min-w-0 flex-1">
        <Label htmlFor={id} className="text-lg font-extrabold text-white">
          {title}
        </Label>
        <p className="text-base font-medium text-white/55">{description}</p>
        {note && <p className="mt-1 text-sm font-bold text-sun">{note}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}

function SettingsPage() {
  const settings = useGameStore((s) => s.settings)
  const updateSettings = useGameStore((s) => s.updateSettings)
  const games = useGameStore((s) => s.games)
  const deleteGame = useGameStore((s) => s.deleteGame)

  const [usage, setUsage] = useState<{ usedMb: number; quotaMb: number } | null>(null)
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)

  const speechOk = isSpeechRecognitionSupported()
  const micOk = isRecordingSupported()

  useEffect(() => {
    void estimateUsage().then(setUsage)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const wipe = async () => {
    await Promise.all(Object.keys(games).map((id) => deleteGame(id)))
    setConfirmWipe(false)
    setUsage(await estimateUsage())
  }

  const gameCount = Object.keys(games).length

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Setup</h1>
        <p className="text-base font-bold text-white/50">
          Everything is stored on this device. Nothing is ever uploaded.
        </p>
      </div>

      <Card>
        <CardContent className="divide-y divide-white/8 p-5">
          <SettingRow
            icon={Scissors}
            title="Tidy up recordings"
            description="Trim silence and stray taps or button presses off the start and end of every clip."
            checked={settings.autoClean}
            onChange={(autoClean) => updateSettings({ autoClean })}
            note={settings.autoClean ? undefined : 'Clips are kept exactly as recorded.'}
          />
          <SettingRow
            icon={Sparkles}
            title="Auto-label phrases"
            description="Use speech recognition to write down what was said, so we can score attempts."
            checked={settings.speechLabels}
            onChange={(speechLabels) => updateSettings({ speechLabels })}
            disabled={!speechOk}
            note={speechOk ? undefined : 'Not available in this browser — you can type phrases instead.'}
          />
          <SettingRow
            icon={Bot}
            title="Robot judge"
            description="Play a flipped-back attempt out loud and let the computer guess what it said."
            checked={settings.robotJudge}
            onChange={(robotJudge) => updateSettings({ robotJudge })}
            disabled={!speechOk}
            note="Experimental — needs the volume up and a quiet room."
          />
          <SettingRow
            icon={Mic}
            title="Phrase master also has a go"
            description="The player who recorded the phrase takes a turn too."
            checked={settings.masterAlsoAttempts}
            onChange={(masterAlsoAttempts) => updateSettings({ masterAlsoAttempts })}
          />
          <SettingRow
            icon={Vibrate}
            title="Buzz on record"
            description="A little vibration when recording starts and stops."
            checked={settings.haptics}
            onChange={(haptics) => updateSettings({ haptics })}
          />

          <div className="flex items-start gap-4 py-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10">
              <Mic className="size-6 text-bubble" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-extrabold">Recording length</p>
              <p className="text-base font-medium text-white/55">
                How long a phrase can be. Shorter is much easier to copy!
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[4, 6, 8, 12].map((secs) => (
                  <button
                    key={secs}
                    type="button"
                    onClick={() => updateSettings({ maxRecordSeconds: secs })}
                    className={cn(
                      'h-12 min-w-16 rounded-2xl px-4 text-lg font-extrabold transition active:scale-95',
                      settings.maxRecordSeconds === secs
                        ? 'bg-grape text-white shadow-lg'
                        : 'bg-white/8 text-white/60 hover:bg-white/16',
                    )}
                  >
                    {secs}s
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <p className="flex items-center gap-2 text-xl font-extrabold">
            <HardDrive className="size-5 text-bubble" /> Storage
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{gameCount} game{gameCount === 1 ? '' : 's'}</Badge>
            {usage && (
              <Badge variant={usage.usedMb / Math.max(1, usage.quotaMb) > 0.8 ? 'hot' : 'default'}>
                {usage.usedMb.toFixed(1)} MB used
              </Badge>
            )}
            <Badge variant={micOk ? 'good' : 'hot'}>
              {micOk ? 'Microphone ready' : 'No microphone'}
            </Badge>
            <Badge variant={speechOk ? 'good' : 'warn'}>
              {speechOk ? 'Speech recognition on' : 'No speech recognition'}
            </Badge>
          </div>
          <Button variant="danger" size="sm" onClick={() => setConfirmWipe(true)} disabled={gameCount === 0}>
            <Trash2 /> Delete all games and clips
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="flex items-center gap-2 text-xl font-extrabold">
            <WifiOff className="size-5 text-lime" /> Works offline
          </p>
          <p className="text-base font-medium text-white/60">
            Install the game and it keeps working on a plane, in the car, or anywhere with no signal.
            Recordings never leave your device.
          </p>
          {installEvent ? (
            <Button
              variant="go"
              onClick={() => {
                void installEvent.prompt()
                setInstallEvent(null)
              }}
            >
              <Download /> Add to home screen
            </Button>
          ) : (
            <p className="text-sm font-bold text-white/40">
              On iPhone or iPad: tap Share, then “Add to Home Screen”.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmWipe} onOpenChange={setConfirmWipe}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete everything?</DialogTitle>
            <DialogDescription>
              This removes every game, recording and score from this device. It cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="soft">Keep them</Button>
            </DialogClose>
            <Button variant="danger" onClick={() => void wipe()}>
              <Trash2 /> Delete everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
})
