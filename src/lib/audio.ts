/**
 * Web Audio helpers: decoding, reversing, trimming, normalising and
 * encoding audio entirely in the browser. No network, works offline.
 */

let ctx: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
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
    for (let i = 0; i < n; i++) dst[i] = src[n - 1 - i]
  }
  return out
}

/**
 * Chop off leading/trailing silence so the reversed clip starts immediately.
 * Keeps a short pad either side so words are not clipped.
 */
export function trimSilence(input: AudioBuffer, threshold = 0.012, padSeconds = 0.06): AudioBuffer {
  const ch0 = input.getChannelData(0)
  const n = ch0.length
  const win = Math.max(1, Math.floor(input.sampleRate * 0.01))

  const loud = (i: number) => {
    let sum = 0
    const end = Math.min(n, i + win)
    for (let k = i; k < end; k++) sum += ch0[k] * ch0[k]
    return Math.sqrt(sum / Math.max(1, end - i)) > threshold
  }

  let start = 0
  while (start < n && !loud(start)) start += win
  let end = n - win
  while (end > start && !loud(end)) end -= win

  if (start >= end) return input // all quiet — leave it alone

  const pad = Math.floor(input.sampleRate * padSeconds)
  start = Math.max(0, start - pad)
  end = Math.min(n, end + win + pad)

  const out = copyBuffer(input, end - start)
  for (let c = 0; c < input.numberOfChannels; c++) {
    out.getChannelData(c).set(input.getChannelData(c).subarray(start, end))
  }
  return out
}

/** Bring quiet recordings up to a consistent level (peak normalise with headroom). */
export function normalise(input: AudioBuffer, target = 0.92): AudioBuffer {
  let peak = 0
  for (let c = 0; c < input.numberOfChannels; c++) {
    const data = input.getChannelData(c)
    for (let i = 0; i < data.length; i++) {
      const a = Math.abs(data[i])
      if (a > peak) peak = a
    }
  }
  if (peak < 1e-4 || Math.abs(peak - target) < 0.02) return input
  const gain = Math.min(8, target / peak)
  const out = copyBuffer(input, input.length)
  for (let c = 0; c < input.numberOfChannels; c++) {
    const src = input.getChannelData(c)
    const dst = out.getChannelData(c)
    for (let i = 0; i < src.length; i++) dst[i] = src[i] * gain
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
    for (let i = 0; i < src.length; i++) dst[i] += src[i] / input.numberOfChannels
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
      const s = Math.max(-1, Math.min(1, data[c][i]))
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

/**
 * Full pipeline for one recording: clean it up, reverse it, and produce
 * both WAV blobs plus pre-computed waveform peaks for instant drawing.
 */
export async function processRecording(raw: Blob): Promise<ProcessedClip> {
  const decoded = await decodeBlob(raw)
  const mono = toMono(decoded)
  const small = await resample(mono)
  const clean = normalise(trimSilence(small))
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
    for (let i = start; i < end; i++) sum += data[i] * data[i]
    const rms = Math.sqrt(sum / Math.max(1, end - start))
    if (rms > max) max = rms
    out.push(rms)
  }
  return max > 0 ? out.map((v) => Math.min(1, v / max)) : out
}
