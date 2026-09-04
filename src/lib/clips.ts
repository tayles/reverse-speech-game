import type { ProcessedClip } from './audio'
import { putAudio, type StoredAudio } from './db'
import { uid } from './utils'

/** Persist a freshly processed recording and return its IndexedDB key. */
export async function saveClip(processed: ProcessedClip): Promise<StoredAudio> {
  const clip: StoredAudio = {
    id: uid('clip'),
    wav: processed.wav,
    reversedWav: processed.reversedWav,
    duration: processed.duration,
    peaks: processed.peaks,
    createdAt: Date.now(),
  }
  await putAudio(clip)
  return clip
}
