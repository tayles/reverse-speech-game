import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { Play, Pause, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { unlockAudio } from '@/lib/audio'
import { formatDuration } from '@/lib/utils'

interface WaveformProps {
  url: string | null
  colour?: string
  height?: number
  className?: string
  label?: string
  sublabel?: string
  /** Big round play button on the left; set false for a bare waveform. */
  showPlayButton?: boolean
  autoPlay?: boolean
  onFinish?: () => void
  onPlay?: () => void
  playbackRate?: number
}

/**
 * Interactive waveform + transport, backed by wavesurfer.js.
 * Tapping the waveform seeks, which kids love for scrubbing back and forth.
 */
export function Waveform({
  url,
  colour = 'var(--color-bubble)',
  height = 64,
  className,
  label,
  sublabel,
  showPlayButton = true,
  autoPlay = false,
  onFinish,
  onPlay,
  playbackRate = 1,
}: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const finishRef = useRef(onFinish)
  const playRef = useRef(onPlay)
  finishRef.current = onFinish
  playRef.current = onPlay

  useEffect(() => {
    if (!containerRef.current || !url) return
    setReady(false)
    setPlaying(false)

    const ws = WaveSurfer.create({
      container: containerRef.current,
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
      ws.setPlaybackRate(playbackRate)
      if (autoPlay) {
        void unlockAudio().then(() => ws.play().catch(() => {}))
      }
    })
    ws.on('play', () => {
      setPlaying(true)
      playRef.current?.()
    })
    ws.on('pause', () => setPlaying(false))
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

  useEffect(() => {
    wsRef.current?.setPlaybackRate(playbackRate)
  }, [playbackRate])

  const toggle = async () => {
    const ws = wsRef.current
    if (!ws || !ready) return
    await unlockAudio()
    try {
      await ws.playPause()
    } catch {
      /* autoplay blocked — the user can tap again */
    }
  }

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {showPlayButton && (
        <button
          type="button"
          onClick={toggle}
          disabled={!ready}
          aria-label={playing ? 'Pause' : 'Play'}
          className={cn(
            'grid size-[4.5rem] shrink-0 place-items-center rounded-full text-ink transition active:scale-95 disabled:opacity-50',
            'shadow-[0_6px_0_0_rgba(0,0,0,0.35)] active:translate-y-[3px] active:shadow-[0_2px_0_0_rgba(0,0,0,0.35)]',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50',
          )}
          style={{ background: colour }}
        >
          {ready ? (
            playing ? (
              <Pause className="size-8" fill="currentColor" />
            ) : (
              <Play className="ml-1 size-8" fill="currentColor" />
            )
          ) : (
            <Loader2 className="size-7 animate-spin" />
          )}
        </button>
      )}
      <div className="min-w-0 flex-1">
        {(label || sublabel) && (
          <div className="mb-1 flex items-baseline justify-between gap-3">
            {label && <span className="truncate text-base font-extrabold text-white/85">{label}</span>}
            <span className="shrink-0 text-sm font-bold tabular-nums text-white/45">
              {sublabel ?? (duration ? formatDuration(duration) : '')}
            </span>
          </div>
        )}
        <div ref={containerRef} className="w-full cursor-pointer" />
      </div>
    </div>
  )
}
