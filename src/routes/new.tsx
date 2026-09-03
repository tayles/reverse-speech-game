import { useState } from 'react'
import { createRoute, useNavigate } from '@tanstack/react-router'
import { Plus, X, Shuffle, Rocket } from 'lucide-react'
import { Route as rootRoute } from './__root'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useGameStore, type Player } from '@/store/game-store'
import { AVATARS, COLOURS, NAME_IDEAS } from '@/data/players'
import { cn, pickRandom, uid } from '@/lib/utils'
import { unlockAudio } from '@/lib/audio'

type Draft = Omit<Player, 'id'> & { key: string }

function makeDraft(index: number, name = ''): Draft {
  return {
    key: uid('draft'),
    name,
    emoji: AVATARS[index % AVATARS.length],
    colour: COLOURS[index % COLOURS.length],
  }
}

function NewGamePage() {
  const navigate = useNavigate()
  const createGame = useGameStore((s) => s.createGame)
  const [drafts, setDrafts] = useState<Draft[]>(() => [makeDraft(0), makeDraft(1)])
  const [editingAvatar, setEditingAvatar] = useState<string | null>(null)

  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((d) => d.map((p) => (p.key === key ? { ...p, ...patch } : p)))

  const addPlayer = () => setDrafts((d) => (d.length >= 8 ? d : [...d, makeDraft(d.length)]))
  const removePlayer = (key: string) =>
    setDrafts((d) => (d.length <= 2 ? d : d.filter((p) => p.key !== key)))

  const named = drafts.map((d, i) => ({ ...d, name: d.name.trim() || `Player ${i + 1}` }))

  const start = async () => {
    await unlockAudio()
    const id = createGame(
      'party',
      named.map(({ name, emoji, colour }) => ({ name, emoji, colour })),
    )
    void navigate({ to: '/game/$gameId', params: { gameId: id } })
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="text-center">
        <p className="text-6xl" aria-hidden="true">🎉</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Who&apos;s playing?</h1>
        <p className="mt-1 text-lg font-bold text-white/60">
          Two to eight players. Everyone takes turns recording a phrase for the others.
        </p>
      </div>

      <div className="space-y-3">
        {drafts.map((draft, i) => (
          <Card key={draft.key}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingAvatar(editingAvatar === draft.key ? null : draft.key)}
                  aria-label={`Change ${draft.name || `player ${i + 1}`} avatar`}
                  className="grid size-16 shrink-0 place-items-center rounded-2xl text-3xl ring-2 ring-white/20 transition active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
                  style={{ background: `color-mix(in oklab, ${draft.colour} 35%, transparent)` }}
                >
                  {draft.emoji}
                </button>

                <Input
                  value={draft.name}
                  maxLength={14}
                  placeholder={`Player ${i + 1}`}
                  onChange={(e) => update(draft.key, { name: e.target.value })}
                  aria-label={`Name for player ${i + 1}`}
                />

                <Button
                  variant="soft"
                  size="icon"
                  aria-label="Random name"
                  onClick={() => update(draft.key, { name: pickRandom(NAME_IDEAS) })}
                >
                  <Shuffle />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove player ${i + 1}`}
                  disabled={drafts.length <= 2}
                  onClick={() => removePlayer(draft.key)}
                >
                  <X />
                </Button>
              </div>

              {editingAvatar === draft.key && (
                <div className="mt-4 animate-pop space-y-3 border-t border-white/10 pt-4">
                  <div className="grid grid-cols-8 gap-2">
                    {AVATARS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => update(draft.key, { emoji })}
                        aria-label={`Choose ${emoji}`}
                        className={cn(
                          'grid aspect-square place-items-center rounded-xl text-2xl transition active:scale-90',
                          draft.emoji === emoji ? 'bg-white/25 ring-2 ring-white' : 'bg-white/8 hover:bg-white/15',
                        )}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    {COLOURS.map((colour) => (
                      <button
                        key={colour}
                        type="button"
                        onClick={() => update(draft.key, { colour })}
                        aria-label="Choose colour"
                        className={cn(
                          'h-10 flex-1 rounded-xl transition active:scale-95',
                          draft.colour === colour && 'ring-4 ring-white',
                        )}
                        style={{ background: colour }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="soft" size="lg" className="w-full" onClick={addPlayer} disabled={drafts.length >= 8}>
        <Plus /> Add another player
      </Button>

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
