import { useCallback, useMemo, useState } from 'react'
import { createRoute, useNavigate, Link } from '@tanstack/react-router'
import { X, Trophy, ChevronLeft } from 'lucide-react'
import { Route as rootRoute } from './__root'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { RecordPhraseStep } from '@/components/game/record-phrase-step'
import { ListenStep } from '@/components/game/listen-step'
import { AttemptStep } from '@/components/game/attempt-step'
import { RevealStep } from '@/components/game/reveal-step'
import { RoundSummary } from '@/components/game/round-summary'
import { Scoreboard } from '@/components/game/scoreboard'
import { useGameStore, roundTurn, nextMaster, type Game, type Round } from '@/store/game-store'
import { saveClip } from '@/lib/clips'
import type { RecordingResult } from '@/components/record-button'

type Phase =
  | { kind: 'record-phrase' }
  | { kind: 'listen'; roundId: string }
  | { kind: 'attempt'; roundId: string; playerId: string }
  | { kind: 'reveal'; roundId: string; attemptId: string }
  | { kind: 'summary'; roundId: string }

/** Work out where a returning player should land, from the saved game alone. */
function derivePhase(game: Game, masterAlsoAttempts: boolean): Phase {
  const round = game.rounds.at(-1)
  if (!round) return { kind: 'record-phrase' }
  const { complete } = roundTurn(game, round, masterAlsoAttempts)
  return complete ? { kind: 'summary', roundId: round.id } : { kind: 'listen', roundId: round.id }
}

function GamePage() {
  const { gameId } = Route.useParams()
  const navigate = useNavigate()

  const game = useGameStore((s) => s.games[gameId])
  const settings = useGameStore((s) => s.settings)
  const addRound = useGameStore((s) => s.addRound)
  const updateRoundPhrase = useGameStore((s) => s.updateRoundPhrase)
  const addAttempt = useGameStore((s) => s.addAttempt)
  const scoreAttempt = useGameStore((s) => s.scoreAttempt)
  const deleteAttempt = useGameStore((s) => s.deleteAttempt)
  const finishGame = useGameStore((s) => s.finishGame)
  const reopenGame = useGameStore((s) => s.reopenGame)

  const [phase, setPhase] = useState<Phase>(() =>
    game ? derivePhase(game, settings.masterAlsoAttempts) : { kind: 'record-phrase' },
  )
  const [showScores, setShowScores] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)

  const round: Round | undefined = useMemo(() => {
    if (!game || phase.kind === 'record-phrase') return undefined
    return game.rounds.find((r) => r.id === phase.roundId)
  }, [game, phase])

  const roundNumber = round ? game.rounds.findIndex((r) => r.id === round.id) + 1 : (game?.rounds.length ?? 0) + 1

  const master = useMemo(() => {
    if (!game) return undefined
    if (round) return game.players.find((p) => p.id === round.masterId)
    return nextMaster(game)
  }, [game, round])

  const turn = useMemo(
    () => (game && round ? roundTurn(game, round, settings.masterAlsoAttempts) : undefined),
    [game, round, settings.masterAlsoAttempts],
  )

  const handlePhraseRecorded = useCallback(
    async (result: RecordingResult, suggestion: string | null) => {
      if (!game || !master) return
      const clip = await saveClip(result)
      const phrase = result.transcript || suggestion || ''
      const roundId = addRound(game.id, {
        masterId: master.id,
        audioId: clip.id,
        phrase,
        phraseSource: result.transcript ? 'speech' : suggestion ? 'pack' : 'manual',
        duration: result.duration,
      })
      setPhase({ kind: 'listen', roundId })
    },
    [addRound, game, master],
  )

  const handleAttemptRecorded = useCallback(
    async (result: RecordingResult, playerId: string, roundId: string) => {
      if (!game) return
      const clip = await saveClip(result)
      const attemptId = addAttempt(game.id, roundId, {
        playerId,
        audioId: clip.id,
        duration: result.duration,
      })
      setPhase({ kind: 'reveal', roundId, attemptId })
    },
    [addAttempt, game],
  )

  if (!game) {
    return (
      <div className="py-20 text-center">
        <p className="text-6xl">🫥</p>
        <h1 className="mt-4 text-3xl font-extrabold">That game has gone</h1>
        <Button variant="go" className="mt-6" asChild>
          <Link to="/">Start a new one</Link>
        </Button>
      </div>
    )
  }

  const solo = game.mode === 'solo'
  const attempt =
    phase.kind === 'reveal' ? round?.attempts.find((a) => a.id === phase.attemptId) : undefined
  const attemptPlayer = attempt ? game.players.find((p) => p.id === attempt.playerId) : undefined

  const advanceFromReveal = () => {
    if (!round) return
    const { complete, current } = roundTurn(game, round, settings.masterAlsoAttempts)
    setPhase(
      complete
        ? { kind: 'summary', roundId: round.id }
        : current
          ? { kind: 'listen', roundId: round.id }
          : { kind: 'summary', roundId: round.id },
    )
  }

  return (
    <div className="pb-12">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button variant="ghost" size="iconSm" aria-label="Leave game" onClick={() => setConfirmExit(true)}>
          <X />
        </Button>
        <div className="text-center">
          <p className="text-sm font-extrabold uppercase tracking-widest text-white/40">
            {game.name}
          </p>
          <p className="text-base font-bold text-white/60">
            {game.players.map((p) => p.emoji).join(' ')}
          </p>
        </div>
        <Button variant="ghost" size="iconSm" aria-label="Scores" onClick={() => setShowScores(true)}>
          <Trophy />
        </Button>
      </div>

      {phase.kind === 'record-phrase' && master && (
        <RecordPhraseStep
          master={master}
          roundNumber={roundNumber}
          settings={settings}
          solo={solo}
          onRecorded={handlePhraseRecorded}
        />
      )}

      {phase.kind === 'listen' && round && master && turn && (
        <ListenStep
          round={round}
          roundNumber={roundNumber}
          master={master}
          nextPlayer={turn.current}
          attemptsDone={round.attempts.length}
          attemptsTotal={turn.eligible.length}
          solo={solo}
          onPhraseChange={(phrase) => updateRoundPhrase(game.id, round.id, phrase)}
          onReady={() =>
            turn.current && setPhase({ kind: 'attempt', roundId: round.id, playerId: turn.current.id })
          }
        />
      )}

      {phase.kind === 'attempt' && round && (
        <AttemptStep
          round={round}
          player={game.players.find((p) => p.id === phase.playerId)!}
          settings={settings}
          solo={solo}
          onBack={() => setPhase({ kind: 'listen', roundId: round.id })}
          onRecorded={(result) => handleAttemptRecorded(result, phase.playerId, round.id)}
        />
      )}

      {phase.kind === 'reveal' && round && attempt && attemptPlayer && turn && (
        <RevealStep
          round={round}
          attempt={attempt}
          player={attemptPlayer}
          settings={settings}
          solo={solo}
          isLastAttempt={turn.remaining.length === 0}
          onScore={(patch) => scoreAttempt(game.id, round.id, attempt.id, patch)}
          onRetry={() => {
            void deleteAttempt(game.id, round.id, attempt.id)
            setPhase({ kind: 'attempt', roundId: round.id, playerId: attempt.playerId })
          }}
          onNext={advanceFromReveal}
        />
      )}

      {phase.kind === 'summary' && round && (
        <RoundSummary
          game={game}
          round={round}
          roundNumber={roundNumber}
          onNextRound={() => {
            reopenGame(game.id)
            setPhase({ kind: 'record-phrase' })
          }}
          onFinish={() => {
            finishGame(game.id)
            void navigate({ to: '/clips' })
          }}
        />
      )}

      <Dialog open={showScores} onOpenChange={setShowScores}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scores</DialogTitle>
            <DialogDescription>
              20 points per star, plus bonus points for auto-matched phrases and 10 for hosting a round.
            </DialogDescription>
          </DialogHeader>
          <Scoreboard game={game} compact />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmExit} onOpenChange={setConfirmExit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave the game?</DialogTitle>
            <DialogDescription>
              Everything is saved on this device — you can carry on later from the home screen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="soft">
                <ChevronLeft /> Keep playing
              </Button>
            </DialogClose>
            <Button variant="danger" onClick={() => void navigate({ to: '/' })}>
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/game/$gameId',
  component: GamePage,
})
