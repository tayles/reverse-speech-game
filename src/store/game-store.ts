import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { uid } from '@/lib/utils'
import { AVATARS, COLOURS } from '@/data/players'
import { deleteAudio, pruneAudio } from '@/lib/db'

export type GameMode = 'solo' | 'party'

export interface Player {
  id: string
  name: string
  emoji: string
  colour: string
}

export interface Attempt {
  id: string
  playerId: string
  /** Key into IndexedDB — holds both the attempt and its reversed version. */
  audioId: string
  duration: number
  /**
   * 0-100 acoustic similarity between the original phrase and this attempt
   * played backwards. Computed automatically, with no transcription involved.
   */
  similarity?: number
  /** The attempt's score: its similarity, or 0 when the clip was unusable. */
  points: number
  createdAt: number
}

export interface Round {
  id: string
  /** Whoever recorded the phrase for this round. */
  masterId: string
  audioId: string
  phrase: string
  phraseSource: 'speech' | 'manual' | 'pack'
  duration: number
  attempts: Attempt[]
  createdAt: number
}

export interface Game {
  id: string
  name: string
  mode: GameMode
  players: Player[]
  rounds: Round[]
  /** Round currently being set up but not yet saved (no audio). */
  status: 'active' | 'finished'
  createdAt: number
  updatedAt: number
}

export interface Settings {
  /**
   * Trim silence and stray transients — button presses, taps, knocks — off the
   * start and end of every recording before it is stored.
   */
  autoClean: boolean
  /** Try to auto-label recordings with the Web Speech API. */
  speechLabels: boolean
  /** Everyone including the phrase master takes a turn. */
  masterAlsoAttempts: boolean
  maxRecordSeconds: number
  lang: string
  haptics: boolean
}

interface GameState {
  games: Record<string, Game>
  gameOrder: string[]
  activeGameId: string | null
  settings: Settings

  createGame: (mode: GameMode, players: Omit<Player, 'id'>[]) => string
  deleteGame: (gameId: string) => Promise<void>
  finishGame: (gameId: string) => void
  reopenGame: (gameId: string) => void
  setActiveGame: (gameId: string | null) => void

  addPlayer: (gameId: string, player: Omit<Player, 'id'>) => void
  removePlayer: (gameId: string, playerId: string) => void
  renamePlayer: (gameId: string, playerId: string, name: string) => void

  addRound: (gameId: string, round: Omit<Round, 'id' | 'attempts' | 'createdAt'>) => string
  updateRoundPhrase: (gameId: string, roundId: string, phrase: string) => void
  deleteRound: (gameId: string, roundId: string) => Promise<void>

  addAttempt: (
    gameId: string,
    roundId: string,
    attempt: Omit<Attempt, 'id' | 'createdAt' | 'points'>,
  ) => string
  scoreAttempt: (
    gameId: string,
    roundId: string,
    attemptId: string,
    patch: Partial<Pick<Attempt, 'similarity'>>,
  ) => void

  updateSettings: (patch: Partial<Settings>) => void
  cleanupOrphanAudio: () => Promise<number>
}

/**
 * An attempt scores exactly what it sounded like. A clip too quiet or short to
 * compare has no similarity yet, and counts as nothing rather than blocking the
 * round.
 */
export function computePoints(attempt: Pick<Attempt, 'similarity'>): number {
  return attempt.similarity ?? 0
}

const MASTER_BONUS = 10

export const DEFAULT_SETTINGS: Settings = {
  autoClean: true,
  speechLabels: true,
  masterAlsoAttempts: false,
  maxRecordSeconds: 8,
  lang: typeof navigator === 'undefined' ? 'en-GB' : navigator.language || 'en-GB',
  haptics: true,
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      games: {},
      gameOrder: [],
      activeGameId: null,
      settings: DEFAULT_SETTINGS,

      createGame(mode, players) {
        const id = uid('game')
        const now = Date.now()
        const game: Game = {
          id,
          name: mode === 'solo' ? 'Solo practice' : 'Party game',
          mode,
          players: players.map((p, i) => ({
            ...p,
            id: uid('p'),
            emoji: p.emoji || AVATARS[i % AVATARS.length],
            colour: p.colour || COLOURS[i % COLOURS.length],
          })),
          rounds: [],
          status: 'active',
          createdAt: now,
          updatedAt: now,
        }
        set((s) => ({
          games: { ...s.games, [id]: game },
          gameOrder: [id, ...s.gameOrder],
          activeGameId: id,
        }))
        return id
      },

      async deleteGame(gameId) {
        const game = get().games[gameId]
        if (!game) return
        const audioIds = game.rounds.flatMap((r) => [r.audioId, ...r.attempts.map((a) => a.audioId)])
        set((s) => {
          const games = { ...s.games }
          delete games[gameId]
          return {
            games,
            gameOrder: s.gameOrder.filter((id) => id !== gameId),
            activeGameId: s.activeGameId === gameId ? null : s.activeGameId,
          }
        })
        await deleteAudio(audioIds)
      },

      finishGame(gameId) {
        set((s) => {
          const game = s.games[gameId]
          if (!game) return s
          return {
            games: { ...s.games, [gameId]: { ...game, status: 'finished', updatedAt: Date.now() } },
          }
        })
      },

      reopenGame(gameId) {
        set((s) => {
          const game = s.games[gameId]
          if (!game) return s
          return {
            games: { ...s.games, [gameId]: { ...game, status: 'active', updatedAt: Date.now() } },
            activeGameId: gameId,
          }
        })
      },

      setActiveGame(gameId) {
        set({ activeGameId: gameId })
      },

      addPlayer(gameId, player) {
        set((s) => {
          const game = s.games[gameId]
          if (!game) return s
          const index = game.players.length
          const next: Player = {
            ...player,
            id: uid('p'),
            emoji: player.emoji || AVATARS[index % AVATARS.length],
            colour: player.colour || COLOURS[index % COLOURS.length],
          }
          return {
            games: {
              ...s.games,
              [gameId]: { ...game, players: [...game.players, next], updatedAt: Date.now() },
            },
          }
        })
      },

      removePlayer(gameId, playerId) {
        set((s) => {
          const game = s.games[gameId]
          if (!game || game.players.length <= 1) return s
          return {
            games: {
              ...s.games,
              [gameId]: {
                ...game,
                players: game.players.filter((p) => p.id !== playerId),
                updatedAt: Date.now(),
              },
            },
          }
        })
      },

      renamePlayer(gameId, playerId, name) {
        set((s) => {
          const game = s.games[gameId]
          if (!game) return s
          return {
            games: {
              ...s.games,
              [gameId]: {
                ...game,
                players: game.players.map((p) => (p.id === playerId ? { ...p, name } : p)),
                updatedAt: Date.now(),
              },
            },
          }
        })
      },

      addRound(gameId, round) {
        const id = uid('round')
        set((s) => {
          const game = s.games[gameId]
          if (!game) return s
          const next: Round = { ...round, id, attempts: [], createdAt: Date.now() }
          return {
            games: {
              ...s.games,
              [gameId]: { ...game, rounds: [...game.rounds, next], updatedAt: Date.now() },
            },
          }
        })
        return id
      },

      updateRoundPhrase(gameId, roundId, phrase) {
        set((s) => {
          const game = s.games[gameId]
          if (!game) return s
          return {
            games: {
              ...s.games,
              [gameId]: {
                ...game,
                rounds: game.rounds.map((r) =>
                  r.id === roundId ? { ...r, phrase, phraseSource: 'manual' } : r,
                ),
                updatedAt: Date.now(),
              },
            },
          }
        })
      },

      async deleteRound(gameId, roundId) {
        const round = get().games[gameId]?.rounds.find((r) => r.id === roundId)
        set((s) => {
          const game = s.games[gameId]
          if (!game) return s
          return {
            games: {
              ...s.games,
              [gameId]: {
                ...game,
                rounds: game.rounds.filter((r) => r.id !== roundId),
                updatedAt: Date.now(),
              },
            },
          }
        })
        if (round) await deleteAudio([round.audioId, ...round.attempts.map((a) => a.audioId)])
      },

      addAttempt(gameId, roundId, attempt) {
        const id = uid('att')
        set((s) => {
          const game = s.games[gameId]
          if (!game) return s
          const next: Attempt = {
            ...attempt,
            id,
            points: computePoints(attempt),
            createdAt: Date.now(),
          }
          return {
            games: {
              ...s.games,
              [gameId]: {
                ...game,
                rounds: game.rounds.map((r) =>
                  r.id === roundId ? { ...r, attempts: [...r.attempts, next] } : r,
                ),
                updatedAt: Date.now(),
              },
            },
          }
        })
        return id
      },

      scoreAttempt(gameId, roundId, attemptId, patch) {
        set((s) => {
          const game = s.games[gameId]
          if (!game) return s
          return {
            games: {
              ...s.games,
              [gameId]: {
                ...game,
                rounds: game.rounds.map((r) => {
                  if (r.id !== roundId) return r
                  return {
                    ...r,
                    attempts: r.attempts.map((a) => {
                      if (a.id !== attemptId) return a
                      const merged = { ...a, ...patch }
                      return { ...merged, points: computePoints(merged) }
                    }),
                  }
                }),
                updatedAt: Date.now(),
              },
            },
          }
        })
      },

      updateSettings(patch) {
        set((s) => ({ settings: { ...s.settings, ...patch } }))
      },

      async cleanupOrphanAudio() {
        const keep = new Set<string>()
        for (const game of Object.values(get().games)) {
          for (const round of game.rounds) {
            keep.add(round.audioId)
            for (const attempt of round.attempts) keep.add(attempt.audioId)
          }
        }
        return await pruneAudio(keep)
      },
    }),
    {
      name: 'backwards-brain/v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        games: s.games,
        gameOrder: s.gameOrder,
        activeGameId: s.activeGameId,
        settings: s.settings,
      }),
      /**
       * Settings saved before a new option existed would otherwise come back
       * with that key missing, so layer them over the current defaults.
       */
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<GameState>
        return {
          ...current,
          ...saved,
          settings: { ...DEFAULT_SETTINGS, ...saved.settings },
        }
      },
    },
  ),
)

/* ---------- selectors ---------- */

export function selectGame(gameId: string | undefined) {
  return (s: GameState): Game | undefined => (gameId ? s.games[gameId] : undefined)
}

export interface ScoreRow {
  player: Player
  points: number
  attempts: number
  bestScore: number
  roundsHosted: number
}

export function leaderboard(game: Game): ScoreRow[] {
  const rows = new Map<string, ScoreRow>()
  for (const player of game.players) {
    rows.set(player.id, { player, points: 0, attempts: 0, bestScore: 0, roundsHosted: 0 })
  }
  for (const round of game.rounds) {
    const host = rows.get(round.masterId)
    if (host) {
      host.roundsHosted += 1
      host.points += MASTER_BONUS
    }
    // Players can have several goes at a round; only their best one counts,
    // so trying again can never lose you points.
    const bestThisRound = new Map<string, number>()
    for (const attempt of round.attempts) {
      const row = rows.get(attempt.playerId)
      if (!row) continue
      row.attempts += 1
      bestThisRound.set(
        attempt.playerId,
        Math.max(bestThisRound.get(attempt.playerId) ?? 0, attempt.points),
      )
    }
    for (const [playerId, best] of bestThisRound) {
      const row = rows.get(playerId)
      if (!row) continue
      row.points += best
      row.bestScore = Math.max(row.bestScore, best)
    }
  }
  return [...rows.values()].toSorted((a, b) => b.points - a.points || b.bestScore - a.bestScore)
}

/** Whose turn is it to attempt this round, and is the round complete? */
export function roundTurn(game: Game, round: Round, masterAlsoAttempts: boolean) {
  const eligible = game.players.filter(
    (p) => masterAlsoAttempts || game.mode === 'solo' || p.id !== round.masterId,
  )
  const done = new Set(round.attempts.map((a) => a.playerId))
  const remaining = eligible.filter((p) => !done.has(p.id))
  return { eligible, remaining, current: remaining[0], complete: remaining.length === 0 }
}

/** The player who should host the next round — rotates through everyone. */
export function nextMaster(game: Game): Player {
  if (game.players.length === 0) throw new Error('Game has no players')
  const lastMaster = game.rounds.at(-1)?.masterId
  if (!lastMaster) return game.players[0]
  const index = game.players.findIndex((p) => p.id === lastMaster)
  return game.players[(index + 1) % game.players.length]
}

/** Every attempt a player made at a round, newest last. */
export function attemptsBy(round: Round, playerId: string): Attempt[] {
  return round.attempts.filter((a) => a.playerId === playerId)
}

/** The attempt that actually counts for a player in a round — their best. */
export function bestAttempt(round: Round, playerId: string): Attempt | undefined {
  return attemptsBy(round, playerId).reduce<Attempt | undefined>(
    (best, a) => (!best || a.points > best.points ? a : best),
    undefined,
  )
}
