/**
 * Web Audio helpers: decoding, reversing, trimming, normalising and
 * encoding audio entirely in the browser. No network, works offline.
 */

let ctx: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new Ctor()
  }
  return ctx
}

/** iOS/Safari require a user gesture before audio will play. Call from a tap handler. */
export async function unlockAudio(): Promise<void> {
  const ac = getAudioContext()
  if (ac.state === 'suspended') {
    try {
      await ac.resume()
    } catch {
      /* ignore — will retry on next gesture */
    }
  }
}

export async function decodeBlob(blob: Blob): Promise<AudioBuffer> {
  const buf = await blob.arrayBuffer()
  return await getAudioContext().decodeAudioData(buf)
}

function copyBuffer(source: AudioBuffer, length: number): AudioBuffer {
  return getAudioContext().createBuffer(source.numberOfChannels, length, source.sampleRate)
}

/** Reverse every channel of an AudioBuffer (the heart of the game). */
export function reverseBuffer(input: AudioBuffer): AudioBuffer {
  const out = copyBuffer(input, input.length)
  for (let c = 0; c < input.numberOfChannels; c++) {
    const src = input.getChannelData(c)
    const dst = out.getChannelData(c)
    const n = src.length
    for (let i = 0; i < n; i++) dst[i] = src[n - 1 - i]!
  }
  return out
}

export interface CleanOptions {
  /** Runs shorter than this at the very edges are taps, not words. */
  minSegmentSeconds?: number
  /** Quiet gaps shorter than this don't split a run — stop consonants need this. */
  maxGapSeconds?: number
  /** Breathing room kept either side of the speech. */
  padSeconds?: number
  /** Fade applied at each cut so trimming doesn't itself introduce a click. */
  fadeSeconds?: number
}

const CLEAN_DEFAULTS: Required<CleanOptions> = {
  minSegmentSeconds: 0.09,
  maxGapSeconds: 0.12,
  padSeconds: 0.06,
  fadeSeconds: 0.008,
}

/**
 * One-pole high-pass. Used only to build the *detection* signal: handling
 * rumble and mains hum carry real energy and would otherwise read as speech,
 * so we look for content in a version of the signal with the low end removed.
 * The audio we actually keep is never filtered.
 */
function highPass(data: Float32Array, sampleRate: number, cutoff = 100): Float32Array {
  const rc = 1 / (2 * Math.PI * cutoff)
  const dt = 1 / sampleRate
  const alpha = rc / (rc + dt)
  const out = new Float32Array(data.length)
  let previousIn = data[0] ?? 0
  let previousOut = 0
  for (let i = 1; i < data.length; i++) {
    previousOut = alpha * (previousOut + data[i]! - previousIn)
    previousIn = data[i]!
    out[i] = previousOut
  }
  return out
}

interface Segment {
  /** Inclusive frame index. */
  from: number
  /** Exclusive frame index. */
  to: number
  seconds: number
  /** Mean zero-crossing rate: high for clicks and hiss, lower for voiced speech. */
  zcr: number
}

export interface ContentBounds {
  start: number
  end: number
}

/**
 * Find where the actual content of a recording starts and ends, ignoring
 * silence *and* short transients at the edges — the tap that starts the
 * recording, the click that stops it, a chair creak before the first word.
 *
 * Pure and sample-rate aware so it can be unit tested without Web Audio.
 * Returns null when nothing looks like content, meaning "leave it alone".
 */
export function findContentBounds(
  samples: Float32Array,
  sampleRate: number,
  options: CleanOptions = {},
): ContentBounds | null {
  const { minSegmentSeconds, maxGapSeconds, padSeconds } = { ...CLEAN_DEFAULTS, ...options }
  const n = samples.length
  const frame = Math.max(1, Math.round(sampleRate * 0.02))
  const hop = Math.max(1, Math.round(sampleRate * 0.01))
  if (n < frame * 3) return null

  const detect = highPass(samples, sampleRate)
  const frameCount = Math.max(1, Math.floor((n - frame) / hop) + 1)
  const rms = new Float32Array(frameCount)
  const zcr = new Float32Array(frameCount)

  for (let f = 0; f < frameCount; f++) {
    const start = f * hop
    const end = Math.min(n, start + frame)
    let sum = 0
    let crossings = 0
    for (let i = start; i < end; i++) {
      sum += detect[i]! * detect[i]!
      if (i > start && detect[i]! < 0 !== detect[i - 1]! < 0) crossings++
    }
    const width = Math.max(1, end - start)
    rms[f] = Math.sqrt(sum / width)
    zcr[f] = crossings / width
  }

  // Adaptive threshold: sit above this recording's own noise floor, but also
  // demand a sensible fraction of its loudest frame so hiss never counts.
  const sorted = rms.toSorted()
  const loudest = sorted[sorted.length - 1]!
  if (loudest < 1e-4) return null
  // Cap the floor estimate: in a clip that is almost entirely speech the tenth
  // percentile is itself speech, and an uncapped floor would mask the lot.
  const floor = Math.min(sorted[Math.floor(sorted.length * 0.1)]!, loudest * 0.1)
  const threshold = Math.max(floor * 3 + 0.0015, loudest * 0.08)

  const maxGapFrames = Math.max(1, Math.round(maxGapSeconds / (hop / sampleRate)))
  const segments: Segment[] = []
  let index = 0
  while (index < frameCount) {
    if (rms[index]! <= threshold) {
      index++
      continue
    }
    let end = index
    let gap = 0
    for (let f = index + 1; f < frameCount; f++) {
      if (rms[f]! > threshold) {
        end = f
        gap = 0
      } else if (++gap > maxGapFrames) {
        break
      }
    }
    let zcrSum = 0
    for (let f = index; f <= end; f++) zcrSum += zcr[f]!
    segments.push({
      from: index,
      to: end + 1,
      seconds: ((end + 1 - index) * hop) / sampleRate,
      zcr: zcrSum / (end + 1 - index),
    })
    index = end + maxGapFrames + 1
  }

  if (segments.length === 0) return null

  // Only ever discard from the ends: cutting inside the clip would chop words.
  // A short burst is a tap; a slightly longer one with a high zero-crossing
  // rate is a clack or a knock rather than a voice.
  const isNoise = (seg: Segment) =>
    seg.seconds < minSegmentSeconds || (seg.seconds < minSegmentSeconds * 2.5 && seg.zcr > 0.25)

  let first = 0
  let last = segments.length - 1
  while (first < last && isNoise(segments[first]!)) first++
  while (last > first && isNoise(segments[last]!)) last--
  if (first > last) return null

  const pad = Math.round(sampleRate * padSeconds)
  const start = Math.max(0, segments[first]!.from * hop - pad)
  const end = Math.min(n, (segments[last]!.to - 1) * hop + frame + pad)
  return end > start ? { start, end } : null
}

/**
 * Trim a recording down to its content, fading each cut so the edit itself is
 * inaudible. Falls back to the untouched buffer whenever detection is unsure.
 */
export function cleanEdges(input: AudioBuffer, options: CleanOptions = {}): AudioBuffer {
  const bounds = findContentBounds(input.getChannelData(0), input.sampleRate, options)
  if (!bounds) return input

  const { start, end } = bounds
  const length = end - start
  if (length < input.sampleRate * 0.1 || length === input.length) return input

  const { fadeSeconds } = { ...CLEAN_DEFAULTS, ...options }
  const fade = Math.min(Math.floor(length / 2), Math.round(input.sampleRate * fadeSeconds))
  const out = copyBuffer(input, length)

  for (let c = 0; c < input.numberOfChannels; c++) {
    const dst = out.getChannelData(c)
    dst.set(input.getChannelData(c).subarray(start, end))
    for (let i = 0; i < fade; i++) {
      const gain = i / fade
      dst[i]! *= gain
      dst[length - 1 - i]! *= gain
    }
  }
  return out
}

/** Bring quiet recordings up to a consistent level (peak normalise with headroom). */
export function normalise(input: AudioBuffer, target = 0.92): AudioBuffer {
  let peak = 0
  for (let c = 0; c < input.numberOfChannels; c++) {
    const data = input.getChannelData(c)
    for (let i = 0; i < data.length; i++) {
      const a = Math.abs(data[i]!)
      if (a > peak) peak = a
    }
  }
  if (peak < 1e-4 || Math.abs(peak - target) < 0.02) return input
  const gain = Math.min(8, target / peak)
  const out = copyBuffer(input, input.length)
  for (let c = 0; c < input.numberOfChannels; c++) {
    const src = input.getChannelData(c)
    const dst = out.getChannelData(c)
    for (let i = 0; i < src.length; i++) dst[i] = src[i]! * gain
  }
  return out
}

/** Down-mix to mono — halves storage and every browser plays it fine. */
export function toMono(input: AudioBuffer): AudioBuffer {
  if (input.numberOfChannels === 1) return input
  const out = getAudioContext().createBuffer(1, input.length, input.sampleRate)
  const dst = out.getChannelData(0)
  for (let c = 0; c < input.numberOfChannels; c++) {
    const src = input.getChannelData(c)
    for (let i = 0; i < src.length; i++) dst[i]! += src[i]! / input.numberOfChannels
  }
  return out
}

/**
 * Encode an AudioBuffer as a 16-bit PCM WAV blob.
 * WAV is the one format every browser can both decode *and* play back reliably,
 * which matters because we re-decode clips after they come out of IndexedDB.
 */
export function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels
  const frames = buffer.length
  const bytesPerSample = 2
  const blockAlign = channels * bytesPerSample
  const dataSize = frames * blockAlign
  const view = new DataView(new ArrayBuffer(44 + dataSize))

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, channels, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 8 * bytesPerSample, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  const data: Float32Array[] = []
  for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c))

  let offset = 44
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c]![i]!))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      offset += 2
    }
  }
  return new Blob([view.buffer], { type: 'audio/wav' })
}

/** Resample to a lower rate to keep stored clips small (kids' voices, 22.05kHz is plenty). */
export async function resample(input: AudioBuffer, sampleRate = 22050): Promise<AudioBuffer> {
  if (input.sampleRate <= sampleRate) return input
  const frames = Math.ceil((input.length * sampleRate) / input.sampleRate)
  const offline = new OfflineAudioContext(input.numberOfChannels, frames, sampleRate)
  const src = offline.createBufferSource()
  src.buffer = input
  src.connect(offline.destination)
  src.start()
  return await offline.startRendering()
}

export interface ProcessedClip {
  wav: Blob
  reversedWav: Blob
  duration: number
  peaks: number[]
  reversedPeaks: number[]
}

export interface ProcessOptions {
  /**
   * Trim silence and edge transients (button presses, taps) off both ends.
   * Off means the recording is kept exactly as captured.
   */
  autoClean?: boolean
}

/**
 * Full pipeline for one recording: tidy it up, reverse it, and produce
 * both WAV blobs plus pre-computed waveform peaks for instant drawing.
 */
export async function processRecording(
  raw: Blob,
  options: ProcessOptions = {},
): Promise<ProcessedClip> {
  const decoded = await decodeBlob(raw)
  const mono = toMono(decoded)
  const small = await resample(mono)
  const trimmed = options.autoClean === false ? small : cleanEdges(small)
  const clean = normalise(trimmed)
  const reversed = reverseBuffer(clean)
  const peaks = extractPeaks(clean)
  return {
    wav: encodeWav(clean),
    reversedWav: encodeWav(reversed),
    duration: clean.duration,
    peaks,
    reversedPeaks: peaks.toReversed(),
  }
}

/** Summarise a buffer into N normalised amplitude buckets for the waveform bars. */
export function extractPeaks(buffer: AudioBuffer, buckets = 220): number[] {
  const data = buffer.getChannelData(0)
  const size = Math.max(1, Math.floor(data.length / buckets))
  const out: number[] = []
  let max = 0
  for (let b = 0; b < buckets; b++) {
    let sum = 0
    const start = b * size
    const end = Math.min(data.length, start + size)
    for (let i = start; i < end; i++) sum += data[i]! * data[i]!
    const rms = Math.sqrt(sum / Math.max(1, end - start))
    if (rms > max) max = rms
    out.push(rms)
  }
  return max > 0 ? out.map((v) => Math.min(1, v / max)) : out
}
