import { startSpeechSession, isSpeechRecognitionSupported } from './speech'

export interface RobotVerdict {
  heard: string
  supported: boolean
}

/**
 * "Robot judge": plays a clip out loud and lets the Web Speech API try to
 * transcribe it, so we can score an attempt automatically.
 *
 * This is deliberately best-effort — the Web Speech API only listens to the
 * live microphone, so we go through the speakers and back. It needs the volume
 * up and a fairly quiet room, and echo cancellation can defeat it entirely.
 * Callers must handle an empty transcript gracefully.
 */
export async function robotJudge(
  url: string,
  options: { lang?: string; onPartial?: (text: string) => void; signal?: AbortSignal } = {},
): Promise<RobotVerdict> {
  if (!isSpeechRecognitionSupported()) return { heard: '', supported: false }

  const session = startSpeechSession({ lang: options.lang, onPartial: options.onPartial })
  const audio = new Audio(url)
  audio.volume = 1

  const abort = () => {
    audio.pause()
    session.abort()
  }
  options.signal?.addEventListener('abort', abort, { once: true })

  try {
    // Let recognition warm up before the audio starts.
    await new Promise((r) => setTimeout(r, 350))
    await audio.play()
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve()
      audio.onerror = () => resolve()
      setTimeout(resolve, 20_000)
    })
    // Give the recogniser a moment to flush its final result.
    await new Promise((r) => setTimeout(r, 700))
    const heard = await session.finish()
    return { heard, supported: true }
  } catch {
    session.abort()
    return { heard: '', supported: true }
  } finally {
    options.signal?.removeEventListener('abort', abort)
  }
}
