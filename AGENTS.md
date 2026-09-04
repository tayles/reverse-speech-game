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
bun run fix           # format and fix lint findings — run this, not the parts
bun run build         # tsc -b, then vite build
bun run test          # bun test

bun run optimise-images   # optimizt; run after adding or replacing artwork
```

**Reach for `fix` rather than its halves.** It is `fmt:fix` then `lint:fix`, so
it rewrites what it can and leaves only what needs a decision. `check` is the
read-only version — `fmt` and `lint` alone are the same thing narrower, and
mostly exist so CI can name them.

CI is a single job running `check:ci`, `build` and `test:ci`: `pr.yml` on pull
requests, and `deploy.yml` on pushes to `main` before it publishes to Pages.
`check:ci` differs from `check` only in passing `--format=github`, so findings
land as annotations on the diff; `test:ci` adds lcov coverage. Run `fix` and
`build` locally before opening a PR; they are quick.

Linting is type-aware (`--type-aware --type-check`), which needs the
`oxlint-tsgolint` binary — that is why it is a devDependency. It reports nothing
at present, and TypeScript runs with every strict flag on, not just `strict`.
Keep it that way: a warning left in place becomes a warning everyone scrolls
past.

Where a rule is switched off in `.oxlintrc.json` there is a comment saying why —
mostly arbitrary size limits, and a couple of rules that contradict each other
or fight React's own contracts. Prefer fixing a finding to adding to that list.

Two things the strict flags make awkward, both deliberate:

- **Indexing in the DSP kernels needs `!`.** Every `data[i]` in a loop bounded by
  `data.length` reads as `number | undefined`. Those get non-null assertions
  rather than `?? 0`, which would put a branch in the hottest loops in the app
  to handle something that cannot happen.
- **`||` is often right where `??` looks righter.** An empty name, emoji or
  phrase has to fall through to its default, and only `||` does that, so
  `prefer-nullish-coalescing` is configured to leave strings alone.

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
in progress" card shows. `opengraph.png` sits alongside them as the share-preview
image, referenced from the Open Graph and Twitter tags rather than the manifest:
Chrome wants every `wide` screenshot to share one aspect ratio, and that card is
1200x670 against the screenshots' 1280x800. All three are excluded from the
service worker precache — share previews and install prompts are online by
definition.

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
