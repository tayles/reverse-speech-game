# 🔁 Backwards Brain

A silly speech game for kids. Record a phrase, listen to it played backwards,
then try to copy the backwards sound. Flip *your* recording around — if you got
it right, your gibberish turns back into the original phrase.

Play solo, or pass the device around with up to eight players.

## Quick start

```bash
bun install
bun run dev
```

Then open the printed URL. Allow microphone access when asked.

```bash
bun run build     # type-check + production bundle into dist/
bun run preview   # serve the production build
bun run lint      # oxlint
```

## How a round works

1. **Record** — the phrase master says something short and clear. Speech
   recognition writes down what it heard, and it can be corrected by tapping it.
2. **Listen** — everyone hears the clip forwards and backwards. The backwards
   version can be replayed at normal or slow speed as many times as you like.
3. **Copy** — each other player records their best impression of the gibberish.
4. **Reveal** — that attempt is played *backwards*, which should sound like the
   original phrase. Everyone scores it out of five stars.
5. **Score** — 20 points per star, 10 for hosting the round, plus an automatic
   match percentage whenever a phrase has been labelled. The phrase master
   rotates each round.

### Scoring an attempt automatically

Two optional routes to a match percentage, both compared against the round's
phrase with a blend of edit distance and per-word recall:

- **Type what you heard** — someone listens to the flipped-back attempt and
  types it in. Works everywhere.
- **Robot judge** (off by default, in Setup) — plays the flipped-back attempt
  out loud and lets the Web Speech API try to transcribe it. The Web Speech API
  only listens to the live microphone, so this goes through the speakers and
  back: it needs the volume up and a quiet room, and echo cancellation can
  defeat it entirely. Treat it as a party trick, not a referee.

## Offline and privacy

The app is a PWA with a precaching service worker, and every recording is
processed in the browser. Nothing is uploaded — there is no server to upload to.
Add it to your home screen and it works on a plane.

- Game state, players and scores → `localStorage`
- Audio → IndexedDB, as 16-bit mono 22.05 kHz WAV (both the forward and the
  reversed version of every clip), with `navigator.storage.persist()` requested
  so iOS Safari does not evict it
- Deleting a game or clip removes its audio from IndexedDB, and orphaned audio
  is pruned on start-up

## Browser support

| Feature | Chrome / Edge | Safari | Firefox |
| --- | --- | --- | --- |
| Recording + reversing | ✅ | ✅ | ✅ |
| Speech labels / robot judge | ✅ | ✅ | ❌ (type phrases instead) |

Everything degrades gracefully: with no speech recognition you type the phrase,
and star ratings still work.

## Stack

Bun · Vite · React 19 · TanStack Router (hash history, so deep links survive
being served from any path) · Zustand + persist · Tailwind CSS v4 ·
shadcn/ui + Radix · wavesurfer.js · idb · vite-plugin-pwa · oxlint

## Layout

```
src/
  lib/        audio pipeline, recorder, speech, IndexedDB, scoring
  store/      zustand game store (localStorage-persisted)
  components/ shadcn/ui primitives, waveform, record button, game steps
  routes/     TanStack Router route modules
  data/       phrase packs and avatars
```
