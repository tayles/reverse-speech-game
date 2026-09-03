/** Assigned by seat, not chosen — see the new-game screen. */
export const AVATARS = [
  '🦊',
  '🐼',
  '🐸',
  '🦄',
  '🐙',
  '🐝',
  '🦖',
  '🐨',
  '🦁',
  '🐧',
  '🦉',
  '🐬',
  '🐢',
  '🦋',
  '🐰',
  '🦔',
] as const

export const COLOURS = [
  'var(--color-grape)',
  'var(--color-bubble)',
  'var(--color-lime)',
  'var(--color-sun)',
  'var(--color-sky)',
  'var(--color-tang)',
] as const

/** The lone player in a solo game, shared by both ways of starting one. */
export const SOLO_PLAYER = { name: 'Me', emoji: AVATARS[0], colour: COLOURS[0] }
