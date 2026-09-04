# Working on Backwards Brain

A kids' speech game: record a phrase, hear it reversed, copy the reversed sound,
then hear your copy flipped back. Everything runs in the browser — there is no
server, and no recording ever leaves the device.

`README.md` explains what the game does and how the audio works. This file is
the things you would otherwise have to rediscover.

## Commands

```bash
bun install
bun run dev           # vite dev server
bun run format:check  # oxfmt — CI fails on this first, so run it before pushing
bun run lint          # oxlint
bun run build         # tsc -b, then vite build
bun run test          # bun test

bun run optimise-images   # optimizt; run after adding or replacing artwork
```

CI runs exactly those four checks, in that order, as a single job:
`pr.yml` on pull requests, and `deploy.yml` on pushes to `main` before it
publishes to Pages. Run them locally before opening a PR; they are quick.

## Constraints that look like bugs but aren't

**The Web Speech API cannot transcribe a stored clip.** It only ever listens to
the live microphone. That is why phrases are labelled _while_ being spoken, and
why attempts are scored acoustically rather than by comparing transcripts. An
earlier version played a clip through the speakers and listened to it come back;
it was removed because it barely worked. Don't reintroduce it.

**Clips are stored as WAV, forward and reversed, both.** WAV is the one format
every browser can decode _and_ play, which matters because clips are re-decoded
after coming out of IndexedDB. Storing the reversed copy costs space but keeps
playback instant and makes the reveal reliable.

**Hash routing and `base: './'` are deliberate.** Together they let the built app
work from any subpath — GitHub Pages serves it under `/reverse-speech-game/` —
with no rewrite rule and no 404 fallback. Switching to browser history breaks
deep links on Pages.

**The mic button doesn't move when pressed.** Its countdown ring is a separate
element sitting behind it, so any vertical travel slides the button out of its
own ring. It lights up and shrinks instead. Other buttons do travel.

**Hover effects are gated behind `@media (hover: hover)`** by Tailwind v4. That
matters here: this is a touch-first app, and an ungated hover leaves buttons
stuck looking pressed after a tap. Anything revealed on hover needs a tap path
too.

## Images

Everything in `public/` and `src/assets/` is committed already compressed, via
`bun run optimise-images`. That fetches optimizt through `bunx` rather than
installing it, since it is only ever run by hand — so the first run needs a
network connection, and CI never pays for a tool it doesn't use.

It is lossy, so run it on a newly added image, not repeatedly over one that is
already in the repo — recompressing a compressed image costs quality and saves
nothing.

`public/screenshots/` holds the two store-listing shots referenced by the
manifest. Chrome wants at least one `form_factor: 'wide'` for the desktop
install prompt and at least one non-`wide` for mobile, so there is one of each;
they are captured from the home screen with storage cleared, so no stale "game
in progress" card shows. They are excluded from the service worker precache —
the install prompt is online by definition.

Icons have constraints worth not undoing: the maskable one must fill its square
opaquely, since the OS crops it to a circle or squircle, while the others keep
transparent corners so they don't show white against a dark home screen.

## Store

`src/store/game-store.ts`, Zustand with `persist` into localStorage. Audio blobs
go to IndexedDB keyed by id; the store only holds ids.

- **Keep the `merge` in the persist config.** It layers saved settings over the
  current defaults, so adding a new `Settings` key doesn't come back `undefined`
  for anyone with existing saved state.
- **A player's score for a round is their _best_ attempt, not the sum.** They can
  retry as often as they like, every go is kept, and trying again can never cost
  points. `leaderboard()` and `bestAttempt()` both depend on this.
- Deleting a game or round deletes its audio; orphans are pruned on start-up.

## Testing

Pure logic lives in `src/lib` and is unit tested with `bun:test` — the silence
and edge-noise trimming (`audio.test.ts`) and the acoustic scoring
(`acoustic.test.ts`). Both were written to run without Web Audio, which is worth
preserving: prefer extracting a pure function over reaching for a DOM harness.

The scoring constants (`PERFECT_DISTANCE`, `UNRELATED_DISTANCE` in
`acoustic.ts`) are calibrated against synthetic vowels, not real voices. If real
attempts score harshly, those are the numbers to turn.

### Verifying in a browser

Automated browsers usually block two of the things this app is built on:

- **`getUserMedia`** — stub it with an `AudioContext` → `MediaStreamDestination`
  playing a synthetic signal. The real `MediaRecorder` → decode → reverse → WAV
  path still runs, so this catches real pipeline bugs.
- **Service worker registration** — often refused outright. Check the precache
  manifest inside `dist/sw.js` instead, and confirm offline behaviour in a real
  browser.

Layout measurements taken immediately after a hover, a tap or a viewport change
are frequently stale. Re-read once the transition has settled before believing a
surprising number.

## Style

Formatting is whatever `oxfmt` says — 100 columns, no semicolons, single quotes,
trailing commas. Don't hand-format.

Comments earn their place by explaining _why_, especially where the code looks
odd on purpose; most of the traps above are noted at the site as well as here.
Copy is British English and aimed at children — short, concrete, and never
scolding when something goes wrong.
