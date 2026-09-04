import { describe, expect, test } from 'bun:test'

import { compareSignals, dtwDistance, mfccSequence, normaliseFrames } from './acoustic'

const RATE = 22_050

/**
 * A crude vowel: a buzzing glottal source shaped by two formants. Different
 * formant pairs sound like different vowels, which is enough to check that the
 * comparison responds to *what* was said rather than to loudness or length.
 */
function vowel(seconds: number, f1: number, f2: number, pitch = 120, gain = 0.5): Float32Array {
  const n = Math.round(seconds * RATE)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / RATE
    const source = ((t * pitch) % 1) * 2 - 1 // sawtooth glottal pulse
    const shaped = Math.sin(2 * Math.PI * f1 * t) * 0.6 + Math.sin(2 * Math.PI * f2 * t) * 0.4
    out[i] = source * 0.3 * shaped * gain
  }
  return out
}

/** Glue chunks into one utterance. */
function utterance(...parts: Float32Array[]): Float32Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Float32Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/**
 * Vowels are generated at whatever length is asked for, so "said more slowly"
 * means genuinely longer. Resampling would have shifted the formants, which is
 * a different vowel, not a slower one.
 */
const AH = (seconds = 0.35) => vowel(seconds, 700, 1100)
const EE = (seconds = 0.35) => vowel(seconds, 300, 2300)
const OO = (seconds = 0.35) => vowel(seconds, 320, 800)

describe('mfccSequence', () => {
  test('produces frames of the requested width', () => {
    const frames = mfccSequence(AH(), RATE)
    expect(frames.length).toBeGreaterThan(5)
    expect(frames[0].length).toBe(12)
  })

  test('returns nothing for a signal shorter than one frame', () => {
    expect(mfccSequence(new Float32Array(64), RATE)).toEqual([])
  })
})

describe('dtwDistance', () => {
  test('is zero for a sequence against itself', () => {
    const frames = normaliseFrames(mfccSequence(utterance(AH(), EE()), RATE))
    expect(dtwDistance(frames, frames)).toBeCloseTo(0, 5)
  })

  test('is infinite when one side is empty', () => {
    const frames = normaliseFrames(mfccSequence(AH(), RATE))
    expect(dtwDistance(frames, [])).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('compareSignals', () => {
  test('scores an identical recording 100', () => {
    const a = utterance(AH(), EE(), OO())
    expect(compareSignals(a, a, RATE).score).toBe(100)
  })

  test('is unmoved by how loudly it was said', () => {
    const loud = utterance(AH(), EE(), OO())
    const quiet = utterance(
      vowel(0.35, 700, 1100, 120, 0.05),
      vowel(0.35, 300, 2300, 120, 0.05),
      vowel(0.35, 320, 800, 120, 0.05),
    )
    expect(compareSignals(loud, quiet, RATE).score).toBeGreaterThan(85)
  })

  test('still matches the same words said more slowly', () => {
    const said = utterance(AH(), EE(), OO())
    const slower = utterance(AH(0.5), EE(0.5), OO(0.5))
    expect(compareSignals(said, slower, RATE).score).toBeGreaterThan(85)
  })

  test('scores different vowels lower than the same vowels', () => {
    const said = utterance(AH(), EE(), OO())
    const same = utterance(AH(), EE(), OO())
    const different = utterance(EE(), OO(), AH())
    const matched = compareSignals(said, same, RATE).score
    const mismatched = compareSignals(said, different, RATE).score
    expect(matched).toBeGreaterThan(mismatched)
    expect(mismatched).toBeLessThan(matched - 15)
  })

  test('puts a partly-right attempt between perfect and unrelated', () => {
    const target = utterance(AH(), EE(), OO())
    const close = utterance(AH(), EE(), vowel(0.35, 360, 900)) // last vowel off
    const unrelated = utterance(EE(), AH(), EE())
    const perfect = compareSignals(target, target, RATE).score
    const closeScore = compareSignals(target, close, RATE).score
    const unrelatedScore = compareSignals(target, unrelated, RATE).score
    expect(perfect).toBe(100)
    expect(closeScore).toBeLessThan(perfect)
    expect(closeScore).toBeGreaterThan(unrelatedScore + 20)
    expect(unrelatedScore).toBeLessThan(25)
  })

  test('reports silence as unusable rather than guessing a score', () => {
    const result = compareSignals(new Float32Array(RATE), AH(), RATE)
    expect(result.usable).toBe(false)
    expect(result.score).toBe(0)
  })

  test('is symmetric', () => {
    const a = utterance(AH(), EE())
    const b = utterance(AH(), OO())
    expect(compareSignals(a, b, RATE).score).toBe(compareSignals(b, a, RATE).score)
  })
})
