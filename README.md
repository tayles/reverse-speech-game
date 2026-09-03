# 🔁 Backwards Brain

A silly speech game for kids. Record a phrase, listen to it played backwards,
then try to copy the backwards sound. Flip *your* recording around — if you got
it right, your gibberish turns back into the original phrase.

Play solo, or pass the device around with up to eight players. Setting up is one
slider and nothing else — names, avatars and colours are handed out by seat.

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
bun run test      # unit tests
```

## How a round works

1. **Record** — the phrase master says something short and clear. Speech
   recognition writes down what it heard, and it can be corrected by tapping it.
2. **Listen and copy** — one page. The backwards clip plays the moment it opens,
   and the mic is right below it, so there is nothing between hearing the sound
   and having a go. Every clip has a play button and a snail button beside it,
   and tapping anywhere on a waveform plays from that point, so a tricky bit can
   be worried at as many times as you like. If the phrase came out wrong, the
   master can re-record it until somebody has taken their turn.
3. **Reveal** — that attempt is played *backwards*, which should sound like the
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

It is comparing *sounds*, not meaning: a good impression of the right rhythm
and vowels scores well, and two different speakers will never score as highly
as the same person twice. That is the right shape for the game — you are being
marked on your impression.

The score is the whole of it — there are no stars to award and nothing to type.
A clip too quiet or too short to compare says so rather than inventing a number,
and you can simply have another go.

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
| Automatic sound-match scoring | ✅ | ✅ | ✅ |
| Speech labels for phrases | ✅ | ✅ | ❌ (type phrases instead) |

Everything degrades gracefully: with no speech recognition you type the phrase.
Automatic scoring needs no speech recognition at all, so it works everywhere.

## Stack

Bun · Vite · React 19 · TanStack Router (hash history, so deep links survive
being served from any path) · Zustand + persist · Tailwind CSS v4 ·
shadcn/ui + Radix · wavesurfer.js · idb · vite-plugin-pwa · oxlint

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
```
