import { Play, Pause, Loader2, Snail } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'

import { unlockAudio } from '@/lib/audio'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/utils'

/**
 * Slow playback speed. Fast enough to still sound like a voice, slow enough
 * that the syllables of a reversed clip come apart.
 */
export const SLOW_RATE = 0.6
const NORMAL_RATE = 1

interface WaveformProps {
  url: string | null
  colour?: string
  height?: number
  className?: string
  label?: string
  sublabel?: string
  /** Big round play button on the left; set false for a bare waveform. */
  showPlayButton?: boolean
  /** Snail button for slow playback, alongside the play button. */
  showSlowButton?: boolean
  autoPlay?: boolean
  onFinish?: () => void
  onPlay?: () => void
}

/**
 * Interactive waveform + transport, backed by wavesurfer.js.
 * Tapping the waveform seeks, which kids love for scrubbing back and forth.
 *
 * Two transport buttons rather than a speed toggle: play always means normal
 * speed and the snail always means slow, so neither button's meaning depends
 * on state you have to notice first.
 */
export function Waveform({
  url,
  colour = 'var(--color-bubble)',
  height = 64,
  className,
  label,
  sublabel,
  showPlayButton = true,
  showSlowButton = true,
  autoPlay = false,
  onFinish,
  onPlay,
}: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(NORMAL_RATE)
  const [duration, setDuration] = useState(0)
  const finishRef = useRef(onFinish)
  const playRef = useRef(onPlay)
  /** Read by the seek handler, which is registered once when the wave is built. */
  const rateRef = useRef(NORMAL_RATE)
  finishRef.current = onFinish
  playRef.current = onPlay

  useEffect(() => {
    const container = containerRef.current
    if (!container || !url) return
    setReady(false)
    setPlaying(false)
    setRate(NORMAL_RATE)
    rateRef.current = NORMAL_RATE

    const ws = WaveSurfer.create({
      container,
      url,
      height,
      waveColor: 'rgba(255,255,255,0.28)',
      progressColor: colour,
      cursorColor: 'rgba(255,255,255,0.85)',
      cursorWidth: 2,
      barWidth: 4,
      barGap: 3,
      barRadius: 4,
      normalize: true,
      dragToSeek: true,
      autoScroll: false,
    })
    wsRef.current = ws

    ws.on('ready', () => {
      setReady(true)
      setDuration(ws.getDuration())
      if (autoPlay) {
        void unlockAudio().then(() => ws.play().catch(() => {}))
      }
    })
    ws.on('play', () => {
      setPlaying(true)
      playRef.current?.()
    })
    ws.on('pause', () => setPlaying(false))
    // Tapping the wave should start it from there, not just move the cursor.
    ws.on('interaction', () => {
      if (ws.isPlaying()) return
      void (async () => {
        await unlockAudio()
        ws.setPlaybackRate(rateRef.current, true)
        try {
          await ws.play()
        } catch {
          /* autoplay blocked — the user can tap again */
        }
      })()
    })
    ws.on('finish', () => {
      setPlaying(false)
      finishRef.current?.()
    })
    ws.on('error', () => setReady(false))

    return () => {
      wsRef.current = null
      ws.destroy()
    }
    // Recreating on url change is intentional; other props are read at create time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, height, colour])

  /**
   * Play at the given speed, or pause if that speed is already playing.
   * Pitch is preserved explicitly rather than left to the browser default, so
   * a slowed clip sounds like the same voice on every platform.
   */
  const playAt = async (target: number) => {
    const ws = wsRef.current
    if (!ws || !ready) return
    await unlockAudio()

    if (playing && rate === target) {
      ws.pause()
      return
    }
    setRate(target)
    rateRef.current = target
    ws.setPlaybackRate(target, true)
    if (!playing) {
      try {
        await ws.play()
      } catch {
        /* autoplay blocked — the user can tap again */
      }
    }
  }

  const buttonBase =
    'grid shrink-0 place-items-center rounded-full text-ink transition duration-100 active:scale-95 disabled:opacity-50 shadow-[0_6px_0_0_rgba(0,0,0,0.35)] hover:translate-y-[2px] hover:shadow-[0_4px_0_0_rgba(0,0,0,0.35)] active:translate-y-[4px] active:shadow-[0_2px_0_0_rgba(0,0,0,0.35)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50'

  const playingAt = (target: number) => playing && rate === target

  return (
    <div className={cn('flex items-center gap-3 sm:gap-4', className)}>
      {showPlayButton && (
        <button
          type="button"
          onClick={() => void playAt(NORMAL_RATE)}
          disabled={!ready}
          aria-label={playingAt(NORMAL_RATE) ? 'Pause' : 'Play'}
          className={cn(buttonBase, 'size-16 sm:size-[4.5rem]')}
          style={{ background: colour }}
        >
          {ready ? (
            playingAt(NORMAL_RATE) ? (
              <Pause className="size-7 sm:size-8" fill="currentColor" />
            ) : (
              <Play className="ml-1 size-7 sm:size-8" fill="currentColor" />
            )
          ) : (
            <Loader2 className="size-6 animate-spin sm:size-7" />
          )}
        </button>
      )}

      {showSlowButton && (
        <button
          type="button"
          onClick={() => void playAt(SLOW_RATE)}
          disabled={!ready}
          aria-label={playingAt(SLOW_RATE) ? 'Pause slow playback' : 'Play slowly'}
          title="Play slowly"
          className={cn(
            buttonBase,
            'size-12 sm:size-14',
            playingAt(SLOW_RATE) ? 'text-ink' : 'text-white',
          )}
          style={{
            background: playingAt(SLOW_RATE)
              ? colour
              : `color-mix(in oklab, ${colour} 28%, transparent)`,
          }}
        >
          {playingAt(SLOW_RATE) ? (
            <Pause className="size-5 sm:size-6" fill="currentColor" />
          ) : (
            <Snail className="size-6 sm:size-7" strokeWidth={2.25} />
          )}
        </button>
      )}

      <div className="min-w-0 flex-1">
        {(label || sublabel) && (
          <div className="mb-1 flex items-baseline justify-between gap-3">
            {label && (
              <span className="truncate text-base font-extrabold text-white/85">{label}</span>
            )}
            <span className="shrink-0 text-sm font-bold text-white/45 tabular-nums">
              {sublabel ?? (duration ? formatDuration(duration) : '')}
            </span>
          </div>
        )}
        <div ref={containerRef} className="w-full cursor-pointer" title="Tap to play from here" />
      </div>
    </div>
  )
}
