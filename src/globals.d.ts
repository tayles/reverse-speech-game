/**
 * Browser APIs this game relies on that the DOM lib doesn't declare — the
 * vendor-prefixed constructors Safari still needs, and the install-prompt event
 * that only Chromium fires. Declaring them here means reaching for them is an
 * ordinary optional property access rather than a cast through `unknown`.
 */

interface SpeechRecognitionAlternativeLike {
  transcript: string
  confidence: number
}

interface SpeechRecognitionResultLike {
  isFinal: boolean
  length: number
  [index: number]: SpeechRecognitionAlternativeLike | undefined
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number
  results: { length: number; [index: number]: SpeechRecognitionResultLike | undefined }
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: Event & { error?: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

/** Fired by Chromium before it offers to install the app. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

interface Window {
  webkitAudioContext?: typeof AudioContext
  SpeechRecognition?: SpeechRecognitionCtor
  webkitSpeechRecognition?: SpeechRecognitionCtor
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent
}
