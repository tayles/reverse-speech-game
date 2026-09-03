import { describe, expect, test } from 'bun:test'
import { findContentBounds } from './audio'

const RATE = 22_050

interface Part {
  seconds: number
  kind: 'silence' | 'tone' | 'click' | 'hiss'
  amplitude?: number
}

/** Build a mono signal out of labelled chunks so tests read like a timeline. */
function signal(parts: Part[]): Float32Array {
  const total = parts.reduce((n, p) => n + Math.round(p.seconds * RATE), 0)
  const out = new Float32Array(total)
  let offset = 0
  let phase = 0
  for (const part of parts) {
    const length = Math.round(part.seconds * RATE)
    const amplitude = part.amplitude ?? 0.5
    for (let i = 0; i < length; i++) {
      switch (part.kind) {
        case 'silence': {
          // A touch of dither, so the noise floor is realistic rather than zero.
          out[offset + i] = (Math.random() - 0.5) * 0.0008
          break
        }
        case 'tone': {
          // 200 Hz carrier: firmly voiced, low zero-crossing rate.
          phase += (2 * Math.PI * 200) / RATE
          out[offset + i] = Math.sin(phase) * amplitude
          break
        }
        case 'click':
        case 'hiss': {
          out[offset + i] = (Math.random() - 0.5) * 2 * amplitude
          break
        }
      }
    }
    offset += length
  }
  return out
}

const asSeconds = (bounds: { start: number; end: number }) => ({
  start: bounds.start / RATE,
  end: bounds.end / RATE,
})

describe('findContentBounds', () => {
  test('returns null for a clip that is silent throughout', () => {
    expect(findContentBounds(signal([{ seconds: 1.5, kind: 'silence' }]), RATE)).toBeNull()
  })

  test('returns null for a clip too short to analyse', () => {
    expect(findContentBounds(new Float32Array(16), RATE)).toBeNull()
  })

  test('trims leading and trailing silence around speech', () => {
    const bounds = findContentBounds(
      signal([
        { seconds: 0.8, kind: 'silence' },
        { seconds: 0.7, kind: 'tone' },
        { seconds: 0.9, kind: 'silence' },
      ]),
      RATE,
    )
    expect(bounds).not.toBeNull()
    const { start, end } = asSeconds(bounds!)
    // Padding means we keep a little of the silence, but not most of it.
    expect(start).toBeGreaterThan(0.6)
    expect(start).toBeLessThan(0.85)
    expect(end).toBeGreaterThan(1.45)
    expect(end).toBeLessThan(1.75)
  })

  test('drops a button press before the speech starts', () => {
    const bounds = findContentBounds(
      signal([
        { seconds: 0.1, kind: 'silence' },
        { seconds: 0.02, kind: 'click', amplitude: 0.9 },
        { seconds: 0.4, kind: 'silence' },
        { seconds: 0.7, kind: 'tone' },
        { seconds: 0.3, kind: 'silence' },
      ]),
      RATE,
    )
    expect(bounds).not.toBeNull()
    // The click sits at 0.10-0.12s; content must start after the gap, not at it.
    expect(asSeconds(bounds!).start).toBeGreaterThan(0.35)
  })

  test('drops a button press after the speech ends', () => {
    const bounds = findContentBounds(
      signal([
        { seconds: 0.2, kind: 'silence' },
        { seconds: 0.7, kind: 'tone' },
        { seconds: 0.4, kind: 'silence' },
        { seconds: 0.02, kind: 'click', amplitude: 0.9 },
        { seconds: 0.2, kind: 'silence' },
      ]),
      RATE,
    )
    expect(bounds).not.toBeNull()
    // The trailing click starts at 1.30s; we must stop well before it.
    expect(asSeconds(bounds!).end).toBeLessThan(1.2)
  })

  test('drops taps at both ends at once', () => {
    const bounds = findContentBounds(
      signal([
        { seconds: 0.02, kind: 'click', amplitude: 0.8 },
        { seconds: 0.35, kind: 'silence' },
        { seconds: 0.6, kind: 'tone' },
        { seconds: 0.35, kind: 'silence' },
        { seconds: 0.02, kind: 'click', amplitude: 0.8 },
      ]),
      RATE,
    )
    expect(bounds).not.toBeNull()
    const { start, end } = asSeconds(bounds!)
    expect(start).toBeGreaterThan(0.25)
    expect(end).toBeLessThan(1.15)
  })

  test('keeps speech that begins immediately, with no silence to trim', () => {
    const bounds = findContentBounds(
      signal([
        { seconds: 1, kind: 'tone' },
        { seconds: 0.05, kind: 'silence' },
      ]),
      RATE,
    )
    expect(bounds).not.toBeNull()
    expect(asSeconds(bounds!).start).toBe(0)
  })

  test('never discards the only segment, however short', () => {
    const bounds = findContentBounds(
      signal([
        { seconds: 0.4, kind: 'silence' },
        { seconds: 0.05, kind: 'tone' },
        { seconds: 0.4, kind: 'silence' },
      ]),
      RATE,
    )
    expect(bounds).not.toBeNull()
    const { start, end } = asSeconds(bounds!)
    expect(end).toBeGreaterThan(start)
    expect(start).toBeLessThan(0.45)
  })

  test('treats a quiet recording on its own terms rather than by a fixed level', () => {
    const bounds = findContentBounds(
      signal([
        { seconds: 0.5, kind: 'silence' },
        { seconds: 0.6, kind: 'tone', amplitude: 0.03 },
        { seconds: 0.5, kind: 'silence' },
      ]),
      RATE,
    )
    expect(bounds).not.toBeNull()
    expect(asSeconds(bounds!).start).toBeGreaterThan(0.3)
  })
})
