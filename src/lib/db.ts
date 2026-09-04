import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export interface StoredAudio {
  id: string
  /** Forward (as-recorded) audio, always WAV. */
  wav: Blob
  /** The same audio played backwards, always WAV. */
  reversedWav: Blob
  duration: number
  peaks: number[]
  createdAt: number
}

interface GameDB extends DBSchema {
  audio: {
    key: string
    value: StoredAudio
    indexes: { createdAt: number }
  }
}

const DB_NAME = 'backwards-brain'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<GameDB>> | null = null

function db() {
  dbPromise ??= openDB<GameDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      const store = database.createObjectStore('audio', { keyPath: 'id' })
      store.createIndex('createdAt', 'createdAt')
    },
  })
  return dbPromise
}

/**
 * Clips are immutable once written, so keeping them in memory avoids a round
 * trip to IndexedDB every time a waveform re-renders.
 */
const clipCache = new Map<string, StoredAudio>()

export function cachedAudio(id: string): StoredAudio | undefined {
  return clipCache.get(id)
}

export async function putAudio(clip: StoredAudio): Promise<void> {
  const database = await db()
  await database.put('audio', clip)
  clipCache.set(clip.id, clip)
}

export async function getAudio(id: string): Promise<StoredAudio | undefined> {
  const hit = clipCache.get(id)
  if (hit) return hit
  const database = await db()
  const found = await database.get('audio', id)
  if (found) clipCache.set(id, found)
  return found
}

export async function deleteAudio(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  for (const id of ids) {
    clipCache.delete(id)
    releaseBlobUrl(`${id}:fwd`)
    releaseBlobUrl(`${id}:rev`)
  }
  const database = await db()
  const tx = database.transaction('audio', 'readwrite')
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done])
}

export async function listAudioIds(): Promise<string[]> {
  const database = await db()
  return database.getAllKeys('audio')
}

/** Remove any audio no longer referenced by the persisted game state. */
export async function pruneAudio(keepIds: Set<string>): Promise<number> {
  const all = await listAudioIds()
  const orphans = all.filter((id) => !keepIds.has(id))
  await deleteAudio(orphans)
  return orphans.length
}

export async function estimateUsage(): Promise<{ usedMb: number; quotaMb: number } | null> {
  if (typeof navigator.storage?.estimate !== 'function') return null
  const { usage = 0, quota = 0 } = await navigator.storage.estimate()
  return { usedMb: usage / 1024 / 1024, quotaMb: quota / 1024 / 1024 }
}

/**
 * Ask the browser to keep our data around. Without this, iOS Safari can evict
 * IndexedDB after ~7 days of not using the app.
 */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator.storage?.persist !== 'function') return false
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/** Object URL cache so repeatedly rendering a clip doesn't leak blob URLs. */
const urlCache = new Map<string, string>()

export function blobUrl(key: string, blob: Blob): string {
  const existing = urlCache.get(key)
  if (existing) return existing
  const url = URL.createObjectURL(blob)
  urlCache.set(key, url)
  return url
}

export function releaseBlobUrl(key: string): void {
  const url = urlCache.get(key)
  if (url) {
    URL.revokeObjectURL(url)
    urlCache.delete(key)
  }
}
