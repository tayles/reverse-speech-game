import { getAudioContext, unlockAudio } from './audio'

export type RecorderState =
  | 'idle'
  | 'arming'
  | 'recording'
  | 'processing'
  | 'denied'
  | 'unsupported'

export interface RecorderHandle {
  stop: () => Promise<Blob>
  cancel: () => void
  /** 0..1 live input level, for the pulsing mic button. */
  level: () => number
}

function pickMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/mpeg',
  ]
  if (typeof MediaRecorder === 'undefined') return undefined
  return candidates.find((t) => MediaRecorder.isTypeSupported(t))
}

export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  )
}

/**
 * Start recording. Resolves with a handle once the mic is live.
 * Rejects with a `DOMException` if the user blocks microphone access.
 */
export async function startRecording(): Promise<RecorderHandle> {
  await unlockAudio()

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  })

  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  // Live level meter
  const ac = getAudioContext()
  const source = ac.createMediaStreamSource(stream)
  const analyser = ac.createAnalyser()
  analyser.fftSize = 512
  analyser.smoothingTimeConstant = 0.75
  source.connect(analyser)
  const bins = new Uint8Array(analyser.frequencyBinCount)

  let stopped = false
  const teardown = () => {
    if (stopped) return
    stopped = true
    try {
      source.disconnect()
    } catch {
      /* noop */
    }
    for (const track of stream.getTracks()) track.stop()
  }

  recorder.start(100)

  return {
    level() {
      if (stopped) return 0
      analyser.getByteTimeDomainData(bins)
      let peak = 0
      for (let i = 0; i < bins.length; i++) {
        const v = Math.abs((bins[i] ?? 128) - 128) / 128
        if (v > peak) peak = v
      }
      return Math.min(1, peak * 2.2)
    },
    stop() {
      return new Promise<Blob>((resolve, reject) => {
        if (stopped) {
          reject(new Error('Recorder already stopped'))
          return
        }
        recorder.onstop = () => {
          teardown()
          resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
        }
        recorder.onerror = () => {
          teardown()
          reject(new Error('Recording failed'))
        }
        if (recorder.state === 'inactive') recorder.onstop?.(new Event('stop'))
        else recorder.stop()
      })
    },
    cancel: teardown,
  }
}
