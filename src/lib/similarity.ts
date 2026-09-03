/** Fuzzy text comparison used to score an attempt against the original phrase. */

export function normaliseText(input: string): string {
  return input
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s']/gu, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr: number[] = Array.from({ length: b.length + 1 }, () => 0)

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

function charRatio(a: string, b: string): number {
  const longest = Math.max(a.length, b.length)
  if (longest === 0) return 1
  return 1 - levenshtein(a, b) / longest
}

/** How many of the target's words show up (fuzzily) in the guess. */
function wordRecall(target: string[], guess: string[]): number {
  if (target.length === 0) return guess.length === 0 ? 1 : 0
  const pool = [...guess]
  let hits = 0
  for (const word of target) {
    let bestIndex = -1
    let bestScore = 0
    for (const [i, candidate] of pool.entries()) {
      const score = charRatio(word, candidate)
      if (score > bestScore) {
        bestScore = score
        bestIndex = i
      }
    }
    if (bestScore >= 0.7 && bestIndex >= 0) {
      hits += bestScore
      pool.splice(bestIndex, 1)
    }
  }
  return hits / target.length
}

export interface MatchResult {
  /** 0..100 */
  score: number
  /** Which words of the original were recognised in the attempt. */
  matchedWords: string[]
  missedWords: string[]
}

/**
 * Compare what the player produced against the original phrase.
 * Blends whole-string edit distance with per-word recall so that getting
 * *some* of the words right still scores points — important for kids.
 */
export function comparePhrases(original: string, attempt: string): MatchResult {
  const a = normaliseText(original)
  const b = normaliseText(attempt)
  if (!a || !b) return { score: 0, matchedWords: [], missedWords: a ? a.split(' ') : [] }

  const aWords = a.split(' ')
  const bWords = b.split(' ')

  const matched: string[] = []
  const missed: string[] = []
  const pool = [...bWords]
  for (const word of aWords) {
    let bestIndex = -1
    let bestScore = 0
    for (const [i, candidate] of pool.entries()) {
      const score = charRatio(word, candidate)
      if (score > bestScore) {
        bestScore = score
        bestIndex = i
      }
    }
    if (bestScore >= 0.7 && bestIndex >= 0) {
      matched.push(word)
      pool.splice(bestIndex, 1)
    } else {
      missed.push(word)
    }
  }

  const blended = 0.45 * charRatio(a, b) + 0.55 * wordRecall(aWords, bWords)
  return {
    score: Math.round(Math.max(0, Math.min(1, blended)) * 100),
    matchedWords: matched,
    missedWords: missed,
  }
}

export function scoreBand(score: number): { label: string; emoji: string; tone: string } {
  if (score >= 90) return { label: 'Mind blown!', emoji: '🤯', tone: 'text-lime' }
  if (score >= 70) return { label: 'Brilliant!', emoji: '🌟', tone: 'text-lime' }
  if (score >= 50) return { label: 'Pretty close!', emoji: '😃', tone: 'text-sun' }
  if (score >= 30) return { label: 'Getting there', emoji: '🙂', tone: 'text-sun' }
  if (score > 0) return { label: 'Nice try!', emoji: '😅', tone: 'text-tang' }
  return { label: 'Have another go', emoji: '🎈', tone: 'text-tang' }
}
