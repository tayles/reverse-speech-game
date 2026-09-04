/**
 * Thin wrapper over the Web Speech API. Used to auto-label a clip with what
 * the player actually said, while MediaRecorder captures the audio.
 *
 * Availability is patchy (Chrome/Edge/Safari yes, Firefox no) and on some
 * browsers it needs a network round-trip, so every caller must treat a
 * transcript as a nice-to-have, never a requirement.
 */

function getCtor(): SpeechRecognitionCtor | undefined {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition
}

export function isSpeechRecognitionSupported(): boolean {
  return !!getCtor()
}

export interface SpeechSessionOptions {
  lang?: string | undefined
  /** Fired as the player speaks, so we can show live captions. */
  onPartial?: ((text: string) => void) | undefined
}

export interface SpeechSession {
  /** Resolves with the best transcript heard, or '' if nothing was understood. */
  finish: () => Promise<string>
  abort: () => void
}

/** Begin listening. Never rejects — a failed session simply yields ''. */
export function startSpeechSession(options: SpeechSessionOptions = {}): SpeechSession {
  const Ctor = getCtor()
  if (!Ctor) {
    return { finish: () => Promise.resolve(''), abort: () => {} }
  }

  let recognition: SpeechRecognitionLike
  try {
    recognition = new Ctor()
  } catch {
    return { finish: () => Promise.resolve(''), abort: () => {} }
  }

  recognition.lang = options.lang || navigator.language || 'en-US'
  recognition.continuous = true
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  let finalText = ''
  let bestInterim = ''
  let ended = false
  let resolveEnd: (() => void) | null = null

  recognition.onresult = (event) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      if (!result) continue
      const text = result[0]?.transcript ?? ''
      if (result.isFinal) finalText += `${text} `
      else interim += text
    }
    if (interim.trim().length > bestInterim.length) bestInterim = interim.trim()
    const live = `${finalText}${interim}`.trim()
    if (live) options.onPartial?.(live)
  }

  recognition.onerror = () => {
    /* no-speech / not-allowed / network — all handled by falling back to '' */
  }

  recognition.onend = () => {
    ended = true
    resolveEnd?.()
  }

  try {
    recognition.start()
  } catch {
    ended = true
  }

  const settle = () => (finalText.trim() || bestInterim).trim()

  return {
    async finish() {
      if (ended) return settle()
      const done = new Promise<void>((resolve) => {
        resolveEnd = resolve
      })
      try {
        recognition.stop()
      } catch {
        return settle()
      }
      // Recognition engines can take a beat to emit their final result.
      await Promise.race([
        done,
        new Promise<void>((r) => {
          setTimeout(r, 1800)
        }),
      ])
      return settle()
    },
    abort() {
      try {
        recognition.abort()
      } catch {
        /* noop */
      }
    },
  }
}
