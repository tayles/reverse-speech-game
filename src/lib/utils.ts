import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function uid(prefix = 'id'): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${rnd}`
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0.0s'
  return `${seconds.toFixed(1)}s`
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/**
 * Requires a non-empty tuple, so the result is a `T` rather than a `T` we have
 * merely assumed is there.
 */
export function pickRandom<T>(items: readonly [T, ...T[]]): T {
  return items[Math.floor(Math.random() * items.length)] as T
}

/** Narrowing filter — `filter(Boolean)` does not narrow in TypeScript. */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/** "Ada" -> "Ada's", "Chris" -> "Chris'". */
export function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}
