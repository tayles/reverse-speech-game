import { useState } from 'react'
import { createRoute, useNavigate } from '@tanstack/react-router'
import { Rocket, Users } from 'lucide-react'
import { Route as rootRoute } from './__root'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { useGameStore } from '@/store/game-store'
import { AVATARS, COLOURS } from '@/data/players'
import { unlockAudio } from '@/lib/audio'

const MIN_PLAYERS = 2
const MAX_PLAYERS = 8

/** Everyone gets an avatar and colour by position — one less thing to fiddle with. */
const avatarFor = (index: number) => AVATARS[index % AVATARS.length]
const colourFor = (index: number) => COLOURS[index % COLOURS.length]
const defaultName = (index: number) => `Player ${index + 1}`

function NewGamePage() {
  const navigate = useNavigate()
  const createGame = useGameStore((s) => s.createGame)
  const [count, setCount] = useState(MIN_PLAYERS)
  /**
   * Names are held for all eight slots, not just the visible ones, so dragging
   * the slider down and back up doesn't throw away what somebody typed.
   */
  const [names, setNames] = useState<string[]>(() => Array.from({ length: MAX_PLAYERS }, () => ''))

  const setName = (index: number, value: string) =>
    setNames((current) => current.map((name, i) => (i === index ? value : name)))

  const start = async () => {
    await unlockAudio()
    const players = Array.from({ length: count }, (_, i) => ({
      name: names[i].trim() || defaultName(i),
      emoji: avatarFor(i),
      colour: colourFor(i),
    }))
    const id = createGame('party', players)
    void navigate({ to: '/game/$gameId', params: { gameId: id } })
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="text-center">
        <p className="text-6xl" aria-hidden="true">🎉</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">How many players?</h1>
        <p className="mt-1 text-lg font-bold text-white/60">
          Everyone takes turns recording a phrase for the others.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="flex items-center justify-center gap-3">
            <Users className="size-8 text-bubble" />
            <span className="text-6xl font-extrabold tabular-nums">{count}</span>
          </div>

          <Slider
            value={[count]}
            min={MIN_PLAYERS}
            max={MAX_PLAYERS}
            step={1}
            onValueChange={([next]) => setCount(next)}
          />

          <div className="flex justify-between px-1 text-base font-extrabold text-white/35">
            <span>{MIN_PLAYERS}</span>
            <span>{MAX_PLAYERS}</span>
          </div>

          <div className="flex flex-wrap justify-center gap-2" aria-hidden="true">
            {Array.from({ length: count }, (_, i) => (
              <span
                key={i}
                className="grid size-12 animate-pop place-items-center rounded-2xl text-2xl ring-2 ring-white/20"
                style={{ background: `color-mix(in oklab, ${colourFor(i)} 35%, transparent)` }}
              >
                {avatarFor(i)}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <p className="px-1 text-lg font-extrabold text-white/70">
          Names <span className="font-bold text-white/40">— leave blank if you like</span>
        </p>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <span
              className="grid size-14 shrink-0 place-items-center rounded-2xl text-2xl ring-2 ring-white/20"
              style={{ background: `color-mix(in oklab, ${colourFor(i)} 35%, transparent)` }}
              aria-hidden="true"
            >
              {avatarFor(i)}
            </span>
            <Input
              value={names[i]}
              maxLength={14}
              placeholder={defaultName(i)}
              onChange={(e) => setName(i, e.target.value)}
              aria-label={`Name for player ${i + 1}`}
            />
          </div>
        ))}
      </div>

      <Button variant="go" size="xl" className="w-full" onClick={() => void start()}>
        <Rocket /> Let&apos;s go!
      </Button>
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/new',
  component: NewGamePage,
})
