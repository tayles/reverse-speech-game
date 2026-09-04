/**
 * Acoustic similarity: how alike do two recordings *sound*?
 *
 * Used to score an attempt automatically. The flipped-back attempt should say
 * the same thing as the original phrase, so we compare the two as audio —
 * there is no way to transcribe a stored clip in the browser (the Web Speech
 * API only ever listens to the live microphone), and comparing sound sidesteps
 * transcription entirely.
 *
 * The pipeline is the standard one for this job: MFCC feature frames, mean and
 * variance normalised so a different voice or microphone doesn't dominate,
 * aligned with dynamic time warping so saying it slower still matches.
 *
 * Everything here is pure maths over Float32Arrays, so it runs the same in a
 * test as it does in the browser.
 */

/* ------------------------------------------------------------------ *
 * FFT
 * ------------------------------------------------------------------ */

/** In-place iterative radix-2 Cooley-Tukey FFT. `size` must be a power of two. */
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length

  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const swapRe = re[i]!
      const swapIm = im[i]!
      re[i] = re[j]!
      im[i] = im[j]!
      re[j] = swapRe
      im[j] = swapIm
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len
    const wRe = Math.cos(angle)
    const wIm = Math.sin(angle)
    for (let i = 0; i < n; i += len) {
      let curRe = 1
      let curIm = 0
      for (let k = 0; k < len / 2; k++) {
        const aRe = re[i + k]!
        const aIm = im[i + k]!
        const bRe = re[i + k + len / 2]! * curRe - im[i + k + len / 2]! * curIm
        const bIm = re[i + k + len / 2]! * curIm + im[i + k + len / 2]! * curRe
        re[i + k] = aRe + bRe
        im[i + k] = aIm + bIm
        re[i + k + len / 2] = aRe - bRe
        im[i + k + len / 2] = aIm - bIm
        const nextRe = curRe * wRe - curIm * wIm
        curIm = curRe * wIm + curIm * wRe
        curRe = nextRe
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * MFCC
 * ------------------------------------------------------------------ */

const hzToMel = (hz: number) => 2595 * Math.log10(1 + hz / 700)
const melToHz = (mel: number) => 700 * (10 ** (mel / 2595) - 1)

/** Triangular mel filters, as [startBin, endBin, weights] triples. */
function melFilterbank(
  sampleRate: number,
  fftSize: number,
  bands: number,
  fMin: number,
  fMax: number,
) {
  const bins = fftSize / 2 + 1
  const top = Math.min(fMax, sampleRate / 2)
  const melMin = hzToMel(fMin)
  const melMax = hzToMel(top)
  const points: number[] = []
  for (let i = 0; i < bands + 2; i++) {
    const mel = melMin + ((melMax - melMin) * i) / (bands + 1)
    points.push(Math.floor(((fftSize + 1) * melToHz(mel)) / sampleRate))
  }

  const filters: { start: number; weights: Float32Array }[] = []
  for (let b = 1; b <= bands; b++) {
    const left = points[b - 1]!
    const centre = points[b]!
    const right = Math.min(points[b + 1]!, bins - 1)
    const width = Math.max(1, right - left)
    const weights = new Float32Array(width)
    for (let k = 0; k < width; k++) {
      const bin = left + k
      weights[k] =
        bin <= centre
          ? (bin - left) / Math.max(1, centre - left)
          : (right - bin) / Math.max(1, right - centre)
    }
    filters.push({ start: left, weights })
  }
  return filters
}

export interface MfccOptions {
  fftSize?: number
  hopSize?: number
  bands?: number
  coefficients?: number
  fMin?: number
  fMax?: number
  /** Frames this far below the loudest frame (in dB) are dropped as silence. */
  silenceFloorDb?: number
}

const MFCC_DEFAULTS: Omit<Required<MfccOptions>, 'fftSize' | 'hopSize'> = {
  bands: 26,
  coefficients: 12,
  fMin: 80,
  fMax: 7000,
  silenceFloorDb: 35,
}

/**
 * A ~25 ms analysis window with 50% overlap, rounded to a power of two.
 * Derived from the sample rate rather than fixed, because `decodeAudioData`
 * hands back whatever rate the AudioContext runs at, not the rate we stored.
 */
export function frameSizesFor(sampleRate: number): { fftSize: number; hopSize: number } {
  const ideal = sampleRate * 0.025
  const fftSize = Math.min(2048, Math.max(256, 2 ** Math.round(Math.log2(ideal))))
  return { fftSize, hopSize: fftSize / 2 }
}

/**
 * Turn a signal into a sequence of MFCC frames, dropping near-silent frames so
 * padding and room tone don't get aligned against real speech.
 */
export function mfccSequence(
  samples: Float32Array,
  sampleRate: number,
  options: MfccOptions = {},
): Float32Array[] {
  const sizes = frameSizesFor(sampleRate)
  const { fftSize, hopSize, bands, coefficients, fMin, fMax, silenceFloorDb } = {
    ...MFCC_DEFAULTS,
    ...sizes,
    ...options,
  }
  if (samples.length < fftSize) return []

  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const magnitude = Math.abs(samples[i]!)
    if (magnitude > peak) peak = magnitude
  }
  if (peak < 1e-4) return [] // silence carries no spectral shape to compare

  const window = new Float32Array(fftSize)
  for (let i = 0; i < fftSize; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1))
  }
  const filters = melFilterbank(sampleRate, fftSize, bands, fMin, fMax)
  const frameCount = Math.floor((samples.length - fftSize) / hopSize) + 1

  const frames: Float32Array[] = []
  const energies: number[] = []
  const re = new Float32Array(fftSize)
  const im = new Float32Array(fftSize)

  for (let f = 0; f < frameCount; f++) {
    const offset = f * hopSize
    im.fill(0)
    for (let i = 0; i < fftSize; i++) re[i] = samples[offset + i]! * window[i]!
    fft(re, im)

    const melEnergies = new Float32Array(bands)
    let total = 0
    for (let b = 0; b < bands; b++) {
      const { start, weights } = filters[b]!
      let sum = 0
      for (let k = 0; k < weights.length; k++) {
        const bin = start + k
        sum += (re[bin]! * re[bin]! + im[bin]! * im[bin]!) * weights[k]!
      }
      melEnergies[b] = Math.log(sum + 1e-10)
      total += sum
    }
    energies.push(10 * Math.log10(total + 1e-10))

    // DCT-II, dropping coefficient 0 (overall loudness) — we care about the
    // shape of the spectrum, not how loudly it was said.
    const cepstrum = new Float32Array(coefficients)
    for (let c = 0; c < coefficients; c++) {
      let sum = 0
      for (let b = 0; b < bands; b++) {
        sum += melEnergies[b]! * Math.cos((Math.PI * (c + 1) * (b + 0.5)) / bands)
      }
      cepstrum[c] = sum
    }
    frames.push(cepstrum)
  }

  if (frames.length === 0) return frames
  const loudest = Math.max(...energies)
  const kept = frames.filter((_, i) => energies[i]! >= loudest - silenceFloorDb)
  return kept.length >= 3 ? kept : frames
}

/**
 * Cepstral mean and variance normalisation, in place.
 * This is what lets two different voices be compared at all: it removes each
 * recording's own channel and speaker colouring, leaving the trajectory.
 */
export function normaliseFrames(frames: Float32Array[]): Float32Array[] {
  if (frames.length === 0) return frames
  const dims = frames[0]!.length
  const mean = new Float32Array(dims)
  const variance = new Float32Array(dims)

  for (const frame of frames) for (let d = 0; d < dims; d++) mean[d]! += frame[d]!
  for (let d = 0; d < dims; d++) mean[d]! /= frames.length
  for (const frame of frames) {
    for (let d = 0; d < dims; d++) variance[d]! += (frame[d]! - mean[d]!) ** 2
  }
  for (let d = 0; d < dims; d++) variance[d] = Math.sqrt(variance[d]! / frames.length) || 1

  return frames.map((frame) => {
    const out = new Float32Array(dims)
    for (let d = 0; d < dims; d++) out[d] = (frame[d]! - mean[d]!) / variance[d]!
    return out
  })
}

/* ------------------------------------------------------------------ *
 * Alignment
 * ------------------------------------------------------------------ */

function cosineDistance(a: Float32Array, b: Float32Array): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  const denominator = Math.sqrt(na) * Math.sqrt(nb)
  return denominator < 1e-9 ? 1 : 1 - dot / denominator
}

/**
 * Dynamic time warping distance: the mean cost per step along the best
 * alignment. A Sakoe-Chiba band keeps the cost bounded and rules out wildly
 * implausible alignments.
 *
 * Normalising by the *actual* path length rather than by `n + m` matters. The
 * path is typically about max(n, m) steps, so dividing by n + m would roughly
 * halve every distance and let two clips with nothing in common still look
 * like a decent match.
 */
export function dtwDistance(a: Float32Array[], b: Float32Array[]): number {
  const n = a.length
  const m = b.length
  if (n === 0 || m === 0) return Number.POSITIVE_INFINITY

  const band = Math.max(Math.abs(n - m) + 1, Math.ceil(Math.max(n, m) * 0.2))
  const INF = Number.POSITIVE_INFINITY
  let prevCost = new Float64Array(m + 1).fill(INF)
  let currCost = new Float64Array(m + 1).fill(INF)
  let prevSteps = new Float64Array(m + 1)
  let currSteps = new Float64Array(m + 1)
  prevCost[0] = 0

  for (let i = 1; i <= n; i++) {
    currCost.fill(INF)
    currSteps.fill(0)
    const from = Math.max(1, i - band)
    const to = Math.min(m, i + band)
    for (let j = from; j <= to; j++) {
      const cost = cosineDistance(a[i - 1]!, b[j - 1]!)
      let best = prevCost[j - 1]!
      let steps = prevSteps[j - 1]!
      if (prevCost[j]! < best) {
        best = prevCost[j]!
        steps = prevSteps[j]!
      }
      if (currCost[j - 1]! < best) {
        best = currCost[j - 1]!
        steps = currSteps[j - 1]!
      }
      if (best === INF) continue
      currCost[j] = cost + best
      currSteps[j] = steps + 1
    }
    ;[prevCost, currCost] = [currCost, prevCost]
    ;[prevSteps, currSteps] = [currSteps, prevSteps]
  }

  const total = prevCost[m]!
  const steps = prevSteps[m]!
  return Number.isFinite(total) && steps > 0 ? total / steps : INF
}

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

/**
 * Distance at or below which a match is considered perfect, and the distance
 * at which it is considered unrelated; between the two the score falls off
 * linearly. Calibrated against the synthetic vowel fixtures in the tests —
 * exported so they can be retuned against real voices without hunting for them.
 */
export const PERFECT_DISTANCE = 0.08
export const UNRELATED_DISTANCE = 0.95

export function scoreFromDistance(distance: number): number {
  if (!Number.isFinite(distance)) return 0
  const span = UNRELATED_DISTANCE - PERFECT_DISTANCE
  const ratio = (UNRELATED_DISTANCE - distance) / span
  return Math.round(Math.max(0, Math.min(1, ratio)) * 100)
}

export interface AcousticComparison {
  /** 0-100, higher is more alike. */
  score: number
  distance: number
  /** False when a clip was too short or too quiet to say anything useful. */
  usable: boolean
}

/** Compare two signals and score how alike they sound. */
export function compareSignals(
  a: Float32Array,
  b: Float32Array,
  sampleRate: number,
  options: MfccOptions = {},
): AcousticComparison {
  const framesA = normaliseFrames(mfccSequence(a, sampleRate, options))
  const framesB = normaliseFrames(mfccSequence(b, sampleRate, options))
  if (framesA.length < 3 || framesB.length < 3) {
    return { score: 0, distance: Number.POSITIVE_INFINITY, usable: false }
  }
  const distance = dtwDistance(framesA, framesB)
  return { score: scoreFromDistance(distance), distance, usable: true }
}
