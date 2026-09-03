import { createRoute, useNavigate, Link } from '@tanstack/react-router'
import { Play, Users, User, Trash2, Trophy } from 'lucide-react'
import { Route as rootRoute } from './__root'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useGameStore, leaderboard } from '@/store/game-store'
import { SOLO_PLAYER } from '@/data/players'
import { formatDate } from '@/lib/utils'
import { unlockAudio } from '@/lib/audio'

const STEPS = [
  { emoji: '🎤', title: 'Say a phrase', body: 'Record anything — “wobbly jelly”, your name, a tongue twister.' },
  { emoji: '🔁', title: 'Hear it backwards', body: 'The app flips your voice around. It sounds like alien gibberish!' },
  { emoji: '🗣️', title: 'Copy the gibberish', body: 'Record yourself copying it, then we flip yours back.' },
  { emoji: '🏆', title: 'Did it work?', body: 'If you nailed it, your backwards voice says the phrase!' },
]

function HomePage() {
  const navigate = useNavigate()
  const games = useGameStore((s) => s.games)
  const gameOrder = useGameStore((s) => s.gameOrder)
  const createGame = useGameStore((s) => s.createGame)
  const deleteGame = useGameStore((s) => s.deleteGame)

  const recent = gameOrder.map((id) => games[id]).filter(Boolean).slice(0, 6)
  const active = recent.find((g) => g.status === 'active' && g.rounds.length > 0)

  const startSolo = async () => {
    await unlockAudio()
    const id = createGame('solo', [SOLO_PLAYER])
    void navigate({ to: '/game/$gameId', params: { gameId: id } })
  }

  return (
    <div className="space-y-6 pb-10">
      <section className="animate-pop rounded-blob bg-gradient-to-br from-grape/50 via-bubble/25 to-sky/25 p-6 text-center ring-1 ring-white/15 sm:p-8">
        <p className="animate-float text-6xl sm:text-7xl" aria-hidden="true">🗣️🔁</p>
        <h1 className="mt-3 text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">
          Can you talk backwards?
        </h1>
        <p className="mx-auto mt-3 max-w-md text-lg font-bold text-white/70">
          Record a phrase, listen to it in reverse, then try to copy the reversed sound.
          Flip your voice back and see if it matches!
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button size="lg" variant="go" onClick={() => void startSolo()} className="w-full">
            <User /> Just me
          </Button>
          <Button size="lg" variant="fun" asChild className="w-full">
            <Link to="/new">
              <Users /> Play with friends
            </Link>
          </Button>
        </div>
      </section>

      {active && (
        <Card className="animate-pop ring-2 ring-lime/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <Badge variant="good">Game in progress</Badge>
              <p className="mt-2 truncate text-xl font-extrabold">
                {active.name} · round {active.rounds.length}
              </p>
              <p className="text-base font-bold text-white/55">
                {active.players.map((p) => `${p.emoji} ${p.name}`).join('  ')}
              </p>
            </div>
            <Button variant="go" asChild>
              <Link to="/game/$gameId" params={{ gameId: active.id }}>
                <Play fill="currentColor" /> Carry on
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="mb-3 px-1 text-2xl font-extrabold">How it works</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((step, i) => (
            <Card key={step.title}>
              <CardContent className="flex items-start gap-4 p-5">
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-3xl" aria-hidden="true">
                  {step.emoji}
                </span>
                <div>
                  <p className="text-lg font-extrabold">
                    <span className="text-white/40">{i + 1}.</span> {step.title}
                  </p>
                  <p className="text-base font-medium text-white/60">{step.body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="mb-3 px-1 text-2xl font-extrabold">Your games</h2>
          <div className="space-y-3">
            {recent.map((game) => {
              const board = leaderboard(game)
              const winner = board[0]
              return (
                <Card key={game.id}>
                  <CardContent className="flex flex-wrap items-center gap-4 p-4">
                    <Link
                      to="/game/$gameId"
                      params={{ gameId: game.id }}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
                    >
                      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-2xl" aria-hidden="true">
                        {game.mode === 'solo' ? '🧑' : '🎉'}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-lg font-extrabold">
                          {game.name}
                          {game.status === 'finished' && (
                            <span className="ml-2 align-middle text-sm font-bold text-white/40">finished</span>
                          )}
                        </span>
                        <span className="block truncate text-sm font-bold text-white/50">
                          {game.rounds.length} round{game.rounds.length === 1 ? '' : 's'} · {formatDate(game.updatedAt)}
                          {winner && winner.points > 0 && (
                            <>
                              {' · '}
                              <Trophy className="inline size-3.5 -translate-y-px text-sun" />{' '}
                              {winner.player.name} {winner.points}
                            </>
                          )}
                        </span>
                      </span>
                    </Link>
                    <Button
                      variant="ghost"
                      size="iconSm"
                      aria-label={`Delete ${game.name}`}
                      onClick={() => void deleteGame(game.id)}
                    >
                      <Trash2 />
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})
