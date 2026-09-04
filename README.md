# 🔁 Backwards Brain

A silly speech game for kids. Record a phrase, listen to it played backwards,
then try to copy the backwards sound. Flip _your_ recording around — if you got
it right, your gibberish turns back into the original phrase.

Play solo, or pass the device around with up to eight players. Setting up is one
slider; avatars and colours are handed out by seat, and names can be typed in if
"Player 3" won't do.

## Quick start

```bash
bun install
bun run dev
```

Then open the printed URL. Allow microphone access when asked.

```bash
bun run build         # type-check + production bundle into dist/
bun run preview       # serve the production build
bun run lint          # oxlint
bun run format        # oxfmt, in place
bun run format:check  # oxfmt, no writes — what CI runs
bun run typecheck     # tsc alone
bun run test          # unit tests
```

Artwork is committed already compressed. After adding or replacing an image:

```bash
bun run optimise-images   # optimizt over public/ and src/assets/
```

## How a round works

1. **Record** — one player is the phrase master for the round; they say
   something short and clear. Speech recognition writes down what it heard, and
   it can be corrected by tapping it.
2. **Listen and copy** — one page. The backwards clip plays the moment it opens,
   and the mic is right below it, so there is nothing between hearing the sound
   and having a go. Every clip has a play button and a snail button beside it,
   and tapping anywhere on a waveform plays from that point, so a tricky bit can
   be worried at as many times as you like. If the phrase came out wrong, the
   master can re-record it until somebody has taken their turn.
3. **Reveal** — that attempt is played _backwards_, which should sound like the
   original phrase, and is scored against it automatically. Nobody has to judge
   anything.
4. **Try again, as often as you like** — every go is kept, with its recording
   and its score, and your best one is the one that counts. Trying again can
   only ever help. Hosting a round is worth 10 points, and the phrase master
   rotates each round.

### Tidying up recordings

On by default, and switchable in Setup. Every clip is trimmed down to the part
that actually matters before it is stored, which removes both dead air and the
tap or button press that inevitably bookends a recording made on a phone.

Detection runs on a high-passed copy of the signal, so handling rumble and hum
don't read as speech; the audio that gets kept is never filtered. Frames are
scored for loudness and zero-crossing rate against a threshold derived from the
recording's own noise floor, then grouped into segments with short gaps bridged
so stop consonants don't split a word. Segments are only ever discarded from the
ends — never the middle, which would chop words out — and a segment is treated
as noise when it is very short, or short with the high zero-crossing rate that
marks a click rather than a voice. Each cut gets an 8 ms fade so the edit itself
doesn't add a click, and anything ambiguous falls back to the untouched clip.

Turn it off and clips are stored exactly as captured.

### Scoring an attempt automatically

The flipped-back attempt should say the same thing as the original phrase, so
the reveal screen scores it by comparing the two **as audio**. Nothing to press
and nothing to type — the answer is already in the two clips.

A stored clip cannot be transcribed in the browser at all (the Web Speech API
only ever listens to the live microphone), so comparing sound sidesteps
transcription entirely. The pipeline is the standard one for this job:

1. **MFCC feature frames** — a ~25 ms window, mel filterbank, log, DCT, keeping
   coefficients 1-12 and dropping coefficient 0 so loudness doesn't count.
2. **Mean and variance normalisation** — removes each recording's own speaker
   and microphone colouring, which is what makes two different voices
   comparable at all.
3. **Dynamic time warping** with a Sakoe-Chiba band — saying it more slowly
   still matches, because the alignment stretches.
4. **Mean cost per step** along the best path, mapped onto 0-100.

Frames too quiet to carry spectral shape are dropped first, and a clip with no
usable frames is reported as such rather than being given a made-up score.

It is comparing _sounds_, not meaning: a good impression of the right rhythm
and vowels scores well, and two different speakers will never score as highly
as the same person twice. That is the right shape for the game — you are being
marked on your impression.

The two constants that map distance onto a score live at the top of
`src/lib/acoustic.ts` and are calibrated against the synthetic vowels in
`acoustic.test.ts`, not against real voices. If real attempts ever feel harshly
marked, those are the numbers to turn.

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

| Feature                       | Chrome / Edge | Safari | Firefox                   |
| ----------------------------- | ------------- | ------ | ------------------------- |
| Recording + reversing         | ✅            | ✅     | ✅                        |
| Automatic sound-match scoring | ✅            | ✅     | ✅                        |
| Speech labels for phrases     | ✅            | ✅     | ❌ (type phrases instead) |

Everything degrades gracefully: with no speech recognition you type the phrase.
Automatic scoring needs no speech recognition at all, so it works everywhere.

## Stack

Bun · Vite · React 19 · TanStack Router (hash history, so deep links survive
being served from any path) · Zustand + persist · Tailwind CSS v4 ·
shadcn/ui + Radix · wavesurfer.js · idb · vite-plugin-pwa · oxlint · oxfmt

## Layout

```
src/
  lib/        audio pipeline, recorder, speech, IndexedDB, scoring
              (audio.test.ts covers silence/noise trimming,
               acoustic.test.ts covers the sound-match scoring)
  store/      zustand game store (localStorage-persisted)
  components/ shadcn/ui primitives, waveform, record button, game steps
  routes/     TanStack Router route modules
  data/       phrase ideas, avatars and colours
  assets/     the mascot badge used in the interface
public/       favicon and the installable app icons
```

## CI and deploying

Two workflows, a job each, running the same four checks — formatting, lint,
build (which type-checks) and tests — with each step gating the next:

- `pr.yml` runs them on every pull request, and stops there.
- `deploy.yml` runs them on pushes to `main`, then publishes `dist/` to GitHub
  Pages.

The steps are spelled out in both rather than shared through a reusable
workflow, which would have split the deploy into two jobs to save a dozen
duplicated lines.

Nothing about the build is Pages-specific. Vite emits relative asset URLs
(`base: './'`) and the router uses hash history, so the app works from any
subpath without a rewrite rule or a 404 fallback.

Pages must be enabled for the repo — the workflow asks for that itself via
`configure-pages`, but on a private repo Pages also needs a paid plan.
