/** Turn a 0-100 sound match into something worth reading out loud. */
export function scoreBand(score: number): { label: string; emoji: string; tone: string } {
  if (score >= 90) return { label: 'Mind blown!', emoji: '🤯', tone: 'text-lime' }
  if (score >= 70) return { label: 'Brilliant!', emoji: '🌟', tone: 'text-lime' }
  if (score >= 50) return { label: 'Pretty close!', emoji: '😃', tone: 'text-sun' }
  if (score >= 30) return { label: 'Getting there', emoji: '🙂', tone: 'text-sun' }
  if (score > 0) return { label: 'Nice try!', emoji: '😅', tone: 'text-tang' }
  return { label: 'Have another go', emoji: '🎈', tone: 'text-tang' }
}
