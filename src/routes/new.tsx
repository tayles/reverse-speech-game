import { useState } from 'react'
import { createRoute, useNavigate } from '@tanstack/react-router'
import { Rocket, Users } from 'lucide-react'
import { Route as rootRoute } from './__root'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { useGameStore } from '@/store/game-store'
import { AVATARS, COLOURS, SOLO_PLAYER } from '@/data/players'
import { unlockAudio } from '@/lib/audio'

const MIN_PLAYERS = 1
const MAX_PLAYERS = 8

/** Names, avatars and colours all come from the seat — there is nothing to set up. */
const seat = (index: number) => ({
  name: `Player ${index + 1}`,
  emoji: AVATARS[index % AVATARS.length],
  colour: COLOURS[index % COLOURS.length],
})

function NewGamePage() {
  const navigate = useNavigate()
  const createGame = useGameStore((s) => s.createGame)
  const [count, setCount] = useState(2)

  const start = async () => {
    await unlockAudio()
    /*
     * One player is a solo game, not a party of one: in a party the phrase
     * master doesn't copy their own clip, so a single player would leave
     * nobody able to take a turn.
     */
    const solo = count === 1
    const id = createGame(
      solo ? 'solo' : 'party',
      solo ? [SOLO_PLAYER] : Array.from({ length: count }, (_, i) => seat(i)),
    )
    void navigate({ to: '/game/$gameId', params: { gameId: id } })
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="text-center">
        <p className="text-6xl" aria-hidden="true">🎉</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">How many players?</h1>
        <p className="mt-1 text-lg font-bold text-white/60">
          {count === 1
            ? 'Just you — record a phrase and copy it yourself.'
            : 'Everyone takes turns recording a phrase for the others.'}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="flex items-center justify-center gap-3">
            <Users className="size-8 text-bubble" />
            <span className="text-7xl font-extrabold tabular-nums">{count}</span>
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
        </CardContent>
      </Card>

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
