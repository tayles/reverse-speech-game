import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Square, Loader2, MicOff } from 'lucide-react'
import { cn, clamp } from '@/lib/utils'
import { isRecordingSupported, startRecording, type RecorderHandle } from '@/lib/recorder'
import { isSpeechRecognitionSupported, startSpeechSession, type SpeechSession } from '@/lib/speech'
import { processRecording, type ProcessedClip } from '@/lib/audio'

export interface RecordingResult extends ProcessedClip {
  transcript: string
}

interface RecordButtonProps {
  maxSeconds: number
  onComplete: (result: RecordingResult) => void | Promise<void>
  speechLabels?: boolean
  lang?: string
  colour?: string
  idleLabel?: string
  className?: string
  haptics?: boolean
  /** Show the live speech-to-text caption underneath. */
  showCaption?: boolean
  /** Trim silence and edge transients off the recording before storing it. */
  autoClean?: boolean
  disabled?: boolean
}

type Phase = 'idle' | 'starting' | 'recording' | 'processing' | 'denied' | 'unsupported' | 'error'

function buzz(enabled: boolean, pattern: number | number[]) {
  if (enabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern)
    } catch {
      /* not supported */
    }
  }
}

export function RecordButton({
  maxSeconds,
  onComplete,
  speechLabels = true,
  lang,
  colour = 'var(--color-bubble)',
  idleLabel = 'Tap to record',
  className,
  haptics = true,
  showCaption = true,
  autoClean = true,
  disabled = false,
}: RecordButtonProps) {
  const [phase, setPhase] = useState<Phase>(() => (isRecordingSupported() ? 'idle' : 'unsupported'))
  const [level, setLevel] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [caption, setCaption] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleRef = useRef<RecorderHandle | null>(null)
  const speechRef = useRef<SpeechSession | null>(null)
  const rafRef = useRef<number>(0)
  const startedAtRef = useRef(0)
  const stoppingRef = useRef(false)

  const cleanupLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
  }, [])

  const stop = useCallback(async () => {
    if (stoppingRef.current) return
    const handle = handleRef.current
    if (!handle) return
    stoppingRef.current = true
    cleanupLoop()
    setPhase('processing')
    setLevel(0)
    buzz(haptics, 20)

    try {
      const [blob, transcript] = await Promise.all([
        handle.stop(),
        speechLabels && speechRef.current ? speechRef.current.finish() : Promise.resolve(''),
      ])
      handleRef.current = null
      speechRef.current = null

      if (blob.size < 512) {
        setError('That was too quiet — have another go!')
        setPhase('error')
        return
      }
      const processed = await processRecording(blob, { autoClean })
      if (processed.duration < 0.25) {
        setError('Too short! Hold on a bit longer.')
        setPhase('error')
        return
      }
      await onComplete({ ...processed, transcript: transcript.trim() })
      setPhase('idle')
      setCaption('')
      setElapsed(0)
    } catch {
      setError("Something went wrong with that recording. Let's try again.")
      setPhase('error')
    } finally {
      stoppingRef.current = false
    }
  }, [autoClean, cleanupLoop, haptics, onComplete, speechLabels])

  const start = useCallback(async () => {
    if (disabled || phase === 'starting' || phase === 'recording' || phase === 'processing') return
    setError(null)
    setCaption('')
    setElapsed(0)
    setPhase('starting')
    try {
      const handle = await startRecording()
      handleRef.current = handle
      startedAtRef.current = performance.now()
      setPhase('recording')
      buzz(haptics, 30)

      if (speechLabels && isSpeechRecognitionSupported()) {
        speechRef.current = startSpeechSession({ lang, onPartial: setCaption })
      }

      const tick = () => {
        const secs = (performance.now() - startedAtRef.current) / 1000
        setElapsed(secs)
        setLevel(handleRef.current?.level() ?? 0)
        if (secs >= maxSeconds) {
          void stop()
          return
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      setPhase(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error')
      if (name !== 'NotAllowedError' && name !== 'SecurityError') {
        setError('No microphone found. Plug one in or try another device.')
      }
    }
  }, [disabled, haptics, lang, maxSeconds, phase, speechLabels, stop])

  useEffect(
    () => () => {
      cleanupLoop()
      handleRef.current?.cancel()
      speechRef.current?.abort()
    },
    [cleanupLoop],
  )

  const recording = phase === 'recording'
  const busy = phase === 'starting' || phase === 'processing'
  const remaining = Math.max(0, maxSeconds - elapsed)
  const ringProgress = clamp(elapsed / maxSeconds, 0, 1)
  const scale = recording ? 1 + clamp(level, 0, 1) * 0.14 : 1

  if (phase === 'unsupported') {
    return (
      <div
        className={cn('rounded-blob bg-white/8 p-6 text-center ring-1 ring-white/12', className)}
      >
        <MicOff className="mx-auto mb-3 size-10 text-tang" />
        <p className="text-lg font-bold">This browser can&apos;t record audio.</p>
        <p className="mt-1 text-base text-white/60">Try Chrome, Edge or Safari.</p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div className="relative grid place-items-center">
        {/* countdown ring */}
        <svg
          className="pointer-events-none absolute size-[13.5rem] -rotate-90"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="4"
          />
          {recording && (
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke={colour}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 46}
              strokeDashoffset={2 * Math.PI * 46 * (1 - ringProgress)}
              className="transition-[stroke-dashoffset] duration-100 ease-linear"
            />
          )}
        </svg>

        <button
          type="button"
          onClick={recording ? () => void stop() : () => void start()}
          disabled={busy || disabled}
          aria-label={recording ? 'Stop recording' : 'Start recording'}
          className={cn(
            'relative grid size-44 place-items-center rounded-full text-ink',
            'transition-[scale,box-shadow,filter] duration-150',
            /*
             * The mic neither travels on hover nor on click, unlike the other
             * buttons: its countdown ring is a separate element behind it, so
             * any vertical movement slides the button out of its own ring.
             * A round key presses convincingly by shrinking instead — which
             * keeps it concentric — lighting up on hover and sinking on click.
             */
            'shadow-[0_10px_0_0_rgba(0,0,0,0.35)] hover:brightness-110 hover:ring-8 hover:ring-white/25',
            'active:scale-95 active:shadow-[0_5px_0_0_rgba(0,0,0,0.35)]',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60',
            recording && 'animate-pulse-ring',
            (busy || disabled) && 'opacity-60',
          )}
          style={{
            background: recording ? 'var(--color-tang)' : colour,
            transform: `scale(${scale})`,
          }}
        >
          {busy ? (
            <Loader2 className="size-20 animate-spin" />
          ) : recording ? (
            <Square className="size-16" fill="currentColor" />
          ) : (
            <Mic className="size-20" strokeWidth={2.5} />
          )}
        </button>
      </div>

      <div className="min-h-[3.5rem] text-center">
        {recording ? (
          <p className="text-2xl font-extrabold tabular-nums text-tang">
            {remaining.toFixed(1)}s left — tap to stop
          </p>
        ) : phase === 'processing' ? (
          <p className="text-2xl font-extrabold text-white/80">Flipping it round…</p>
        ) : phase === 'denied' ? (
          <p className="max-w-xs text-lg font-bold text-tang">
            The microphone is blocked. Allow it in your browser settings, then tap again.
          </p>
        ) : error ? (
          <p className="max-w-xs text-lg font-bold text-sun">{error}</p>
        ) : (
          <p className="text-2xl font-extrabold text-white/80">{idleLabel}</p>
        )}

        {showCaption && caption && (
          <p className="mx-auto mt-2 max-w-md animate-pop text-lg font-bold text-white/55">
            “{caption}”
          </p>
        )}
      </div>
    </div>
  )
}
