import { useEffect, useState } from 'react'

import { blobUrl, cachedAudio, getAudio, type StoredAudio } from '@/lib/db'

export interface LoadedClip {
  clip: StoredAudio | null
  forwardUrl: string | null
  reversedUrl: string | null
  loading: boolean
  missing: boolean
}

interface Resolution {
  id: string
  clip: StoredAudio | null
}

/** Load a clip out of IndexedDB and hand back stable object URLs for playback. */
export function useClip(audioId: string | undefined): LoadedClip {
  const [resolved, setResolved] = useState<Resolution | null>(null)

  useEffect(() => {
    if (!audioId || cachedAudio(audioId)) return
    let live = true
    getAudio(audioId)
      .then((found) => {
        if (live) setResolved({ id: audioId, clip: found ?? null })
      })
      .catch(() => {
        if (live) setResolved({ id: audioId, clip: null })
      })
    return () => {
      live = false
    }
  }, [audioId])

  const cached = audioId ? (cachedAudio(audioId) ?? null) : null
  const clip = cached ?? (resolved && resolved.id === audioId ? resolved.clip : null)
  const settled = !audioId || !!cached || resolved?.id === audioId

  return {
    clip,
    forwardUrl: clip ? blobUrl(`${clip.id}:fwd`, clip.wav) : null,
    reversedUrl: clip ? blobUrl(`${clip.id}:rev`, clip.reversedWav) : null,
    loading: !settled,
    missing: settled && !!audioId && !clip,
  }
}
