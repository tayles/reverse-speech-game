import { useState } from 'react'
import { createRoute, useNavigate } from '@tanstack/react-router'
import { Check, Pencil, Rocket, Users } from 'lucide-react'
import { Route as rootRoute } from './__root'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { useGameStore } from '@/store/game-store'
import { AVATARS, COLOURS, SOLO_PLAYER } from '@/data/players'
import { unlockAudio } from '@/lib/audio'

const MIN_PLAYERS = 1
const MAX_PLAYERS = 8

/** Avatars and colours come from the seat; only the name is anybody's business. */
const avatarFor = (index: number) => AVATARS[index % AVATARS.length]
const colourFor = (index: number) => COLOURS[index % COLOURS.length]

/** A lone player is "Me", matching the solo game the home screen makes. */
const defaultName = (index: number, count: number) =>
  count === 1 ? SOLO_PLAYER.name : `Player ${index + 1}`

function NewGamePage() {
  const navigate = useNavigate()
  const createGame = useGameStore((s) => s.createGame)
  const [count, setCount] = useState(2)
  const [editing, setEditing] = useState(false)
  /**
   * Names are held for all eight seats, not just the visible ones, so dragging
   * the slider down and back up doesn't throw away what somebody typed.
   */
  const [names, setNames] = useState<string[]>(() => Array.from({ length: MAX_PLAYERS }, () => ''))

  const setName = (index: number, value: string) =>
    setNames((current) => current.map((name, i) => (i === index ? value : name)))

  const nameFor = (index: number) => names[index].trim() || defaultName(index, count)

  const start = async () => {
    await unlockAudio()
    /*
     * One player is a solo game, not a party of one: in a party the phrase
     * master doesn't copy their own clip, so a single player would leave
     * nobody able to take a turn.
     */
    const solo = count === 1
    const players = Array.from({ length: count }, (_, i) => ({
      name: nameFor(i),
      emoji: avatarFor(i),
      colour: colourFor(i),
    }))
    const id = createGame(solo ? 'solo' : 'party', players)
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

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {Array.from({ length: count }, (_, i) =>
              editing ? (
                <span
                  key={i}
                  className="flex items-center gap-2 rounded-2xl bg-white/8 p-1.5 ring-1 ring-white/12"
                >
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-xl text-xl"
                    style={{ background: `color-mix(in oklab, ${colourFor(i)} 35%, transparent)` }}
                    aria-hidden="true"
                  >
                    {avatarFor(i)}
                  </span>
                  <Input
                    value={names[i]}
                    maxLength={14}
                    placeholder={defaultName(i, count)}
                    onChange={(e) => setName(i, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
                    aria-label={`Name for player ${i + 1}`}
                    className="h-10 w-32 rounded-xl px-3 text-base"
                  />
                </span>
              ) : (
                <span
                  key={i}
                  className="flex items-center gap-2 rounded-2xl bg-white/8 py-2 pl-2 pr-3.5 text-base font-extrabold ring-1 ring-white/12"
                >
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-lg"
                    style={{ background: `color-mix(in oklab, ${colourFor(i)} 35%, transparent)` }}
                    aria-hidden="true"
                  >
                    {avatarFor(i)}
                  </span>
                  {nameFor(i)}
                </span>
              ),
            )}

            <Button
              variant={editing ? 'go' : 'soft'}
              size="icon"
              onClick={() => setEditing((v) => !v)}
              aria-label={editing ? 'Done editing names' : 'Edit names'}
            >
              {editing ? <Check /> : <Pencil />}
            </Button>
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
