import { useEffect, useRef, useState } from 'react'
import { createRoute, useNavigate } from '@tanstack/react-router'
import { Check, Pencil, Plus, Rocket, Trash2, Users } from 'lucide-react'
import { Route as rootRoute } from './__root'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { useGameStore } from '@/store/game-store'
import { AVATARS, COLOURS, SOLO_PLAYER } from '@/data/players'
import { unlockAudio } from '@/lib/audio'
import { cn } from '@/lib/utils'

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
  /** Which chip has been tapped open to show its edit and remove buttons. */
  const [selected, setSelected] = useState<number | null>(null)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  /** Held in a ref, not state, so arriving in edit mode doesn't re-render twice. */
  const pendingFocus = useRef<number | null>(null)
  /**
   * Names are held for all eight seats, not just the visible ones, so dragging
   * the slider down and back up doesn't throw away what somebody typed.
   */
  const [names, setNames] = useState<string[]>(() => Array.from({ length: MAX_PLAYERS }, () => ''))

  const setName = (index: number, value: string) =>
    setNames((current) => current.map((name, i) => (i === index ? value : name)))

  const nameFor = (index: number) => names[index].trim() || defaultName(index, count)

  /** Open the name fields with the caret already in the one you asked for. */
  const beginEdit = (index: number) => {
    pendingFocus.current = index
    setSelected(null)
    setEditing(true)
  }

  const addPlayer = () => {
    if (count >= MAX_PLAYERS) return
    setSelected(null)
    setCount((c) => Math.min(MAX_PLAYERS, c + 1))
  }

  /** Names follow their owner: dropping a seat shifts the ones after it up. */
  const removePlayer = (index: number) => {
    if (count <= MIN_PLAYERS) return
    setNames((current) => {
      const next = current.filter((_, i) => i !== index)
      next.push('')
      return next
    })
    setSelected(null)
    setCount((c) => Math.max(MIN_PLAYERS, c - 1))
  }

  useEffect(() => {
    if (!editing || pendingFocus.current === null) return
    const input = inputRefs.current[pendingFocus.current]
    pendingFocus.current = null
    input?.focus()
    input?.select()
    // The refs are stable; `editing` flipping true is what actually drives this.
  }, [editing, inputRefs, pendingFocus])

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
        <p className="text-6xl" aria-hidden="true">
          🎉
        </p>
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
            {Array.from({ length: count }, (_, i) => {
              const swatch = { background: `color-mix(in oklab, ${colourFor(i)} 35%, transparent)` }

              if (editing) {
                return (
                  <span
                    key={i}
                    className="flex items-center gap-2 rounded-2xl bg-white/8 p-1.5 ring-1 ring-white/12"
                  >
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-xl text-xl"
                      style={swatch}
                      aria-hidden="true"
                    >
                      {avatarFor(i)}
                    </span>
                    <Input
                      ref={(el) => {
                        inputRefs.current[i] = el
                      }}
                      value={names[i]}
                      maxLength={14}
                      placeholder={defaultName(i, count)}
                      onChange={(e) => setName(i, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
                      aria-label={`Name for player ${i + 1}`}
                      className="h-10 w-32 rounded-xl px-3 text-base"
                    />
                  </span>
                )
              }

              /*
               * The chip cannot be a button, because it now holds two of its
               * own. The name is the button instead, and the actions sit over
               * the top of it — an overlay rather than an expansion, so the
               * chip keeps its size and the row never reflows under the
               * cursor. It opens on hover, on keyboard focus, or on a tap,
               * which is the only one of the three a touchscreen has.
               */
              const open = selected === i

              return (
                <span
                  key={i}
                  className={cn(
                    'group relative flex min-w-28 items-center rounded-2xl py-2 pl-2 pr-3.5 text-base font-extrabold ring-1 transition-colors',
                    open
                      ? 'bg-white/12 ring-white/25'
                      : 'bg-white/8 ring-white/12 hover:bg-white/12',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(open ? null : i)}
                    aria-expanded={open}
                    aria-label={`${nameFor(i)} — rename or remove`}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-lg"
                      style={swatch}
                      aria-hidden="true"
                    >
                      {avatarFor(i)}
                    </span>
                    <span className="max-w-28 truncate">{nameFor(i)}</span>
                  </button>

                  <span
                    className={cn(
                      'absolute inset-0 flex items-center justify-center gap-2 rounded-2xl bg-ink/75 backdrop-blur-sm transition-opacity duration-150',
                      open
                        ? 'opacity-100'
                        : 'pointer-events-none opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100',
                    )}
                  >
                    <Button
                      size="iconSm"
                      className="size-9 rounded-xl"
                      onClick={() => beginEdit(i)}
                      aria-label={`Rename ${nameFor(i)}`}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="danger"
                      size="iconSm"
                      className="size-9 rounded-xl"
                      onClick={() => removePlayer(i)}
                      disabled={count <= MIN_PLAYERS}
                      aria-label={`Remove ${nameFor(i)}`}
                    >
                      <Trash2 />
                    </Button>
                  </span>
                </span>
              )
            })}

            {/* Adding a seat mid-rename would push a blank field into the row. */}
            {!editing && (
              <Button
                size="icon"
                onClick={addPlayer}
                disabled={count >= MAX_PLAYERS}
                aria-label="Add a player"
              >
                <Plus />
              </Button>
            )}

            <Button
              variant={editing ? 'go' : 'default'}
              size="icon"
              onClick={() => (editing ? setEditing(false) : beginEdit(0))}
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
