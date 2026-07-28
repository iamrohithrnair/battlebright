# `demo/` — video walkthrough harness

A standalone Playwright project that drives **You Want More?** end to end and records a
single continuous 1920×1080 walkthrough, plus stills of every route and a route health
table. It is deliberately separate from `app/`: another stream owns `app/package.json` and
`app/node_modules`, so nothing here is ever installed into the app.

## What to show in the demo

Play `output/you-want-more-walkthrough.mp4` from the top. It opens on the 3D arena and
scrolls through the hero's scroll-driven camera, then picks **Tombstone vs End Game** in the
matchup studio, runs the choreographed 3D fight, and holds on the explainable readout —
probability bar, confidence, signal breakdown, Monte Carlo distribution. From there it moves
through the roster (with live search filtering), a robot dossier, sortable rankings, a
tournament bracket played round by round to the champion, and the backtest page showing
accuracy against the 50% coin-flip baseline. **The centrepiece is the `/intel` beat**: it
triggers a genuine cache-bypassing Bright Data Web Unlocker request and holds on the
provenance panel (bytes, latency, zone) and the field-by-field verification diff long enough
to read every figure. It closes on the tool-using AI analyst answering a real question with
its tool-call trace visible, and the AI commentator's synchronised captions.

## Prerequisites

- Node 18+ (developed on Node 24).
- The app's dependencies already installed in `../app` (**do not** run `npm install` there
  yourself — that folder belongs to another stream).
- `ffmpeg` on `PATH` for the MP4 and GIF (`brew install ffmpeg`). Optional: without it you
  still get the `.webm`, and the run says so rather than failing. `ffprobe` (ships with
  ffmpeg) is what reports the video duration.

## Install

```bash
cd demo
npm install
npx playwright install chromium   # downloads the browser; one-off
```

If your shell has `PLAYWRIGHT_BROWSERS_PATH` pointed somewhere ephemeral (some IDE sandboxes
do this), install into the standard cache instead so it survives:

```bash
env -u PLAYWRIGHT_BROWSERS_PATH npx playwright install chromium
```

## Run

```bash
npm run smoke     # every route: HTTP status, rendered <h1>, console errors → pass/fail table
npm run shots     # 1920x1080 viewport + full-page PNG of every route
npm run record    # the full walkthrough video
```

All three will **reuse a dev server that is already running** (they probe ports 3000–3003 and
check the response actually looks like this app). If nothing is serving, they start
`npm run dev` in `../app` themselves and shut it down again at the end. A server they did not
start is never killed.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `DEMO_BASE_URL` | `http://localhost:3000` | Point at a specific server; skips port probing. |
| `DEMO_SPEED` | `1` | Scales every dwell and settle. `0.5` for a quick check, `1.4` for a slower cut. |
| `DEMO_ONLY` | *(unset)* | Comma-separated beat ids to record, e.g. `DEMO_ONLY=intel,analyst`. The fast way to retime one beat. |
| `DEMO_HEADLESS` | `1` | Set `0` to watch it run in a real window. Uses the host GPU, so the 3D looks better. |
| `DEMO_FULL_PAGE` | `1` | Set `0` in `npm run shots` to skip the full-page stills. |
| `DEMO_SERVER_TIMEOUT_MS` | `120000` | How long to wait for a dev server we started. |

## Tuning the pacing

Everything worth retiming is at the top of `scripts/record.mjs`, in two places:

- **`TIMING`** — global pacing: `speed`, post-navigation pause, how long a WebGL canvas gets
  to paint, per-character typing delay, the per-beat time budget, and the generous timeouts
  for the Bright Data unlock and the analyst stream.
- **`BEATS`** — the narrative, in the order the judges are told it. Each entry is
  `{ id, label, path, canvas, dwell, run }`. Change `dwell` to hold longer on a page, reorder
  the array to change the story, or comment an entry out to drop a beat. `path: null` means
  "stay where the previous beat navigated to" (with a `fallbackPath` if it didn't get there).

The current cut runs 3 m 57 s with `/insights` missing; expect roughly 4 m 15 s once that route
lands. Nudge `DEMO_SPEED` rather than editing every number if you just want the whole thing
slower or faster. The `/intel` beat is deliberately the longest hold in the cut — it is the
Bright Data judging criterion, so trim it last.

## Resilience

The app is being built by several agents at once, so the harness assumes the DOM will move:

- Controls are found by accessible role and visible text, never by CSS class, and each one
  has an **ordered list of candidate selectors** — the first that resolves wins, and the log
  records which one matched.
- **Every beat is wrapped in try/catch** with its own time budget. A broken or missing beat is
  logged, skipped, and the run continues from a known-good page. A partial video beats a crash.
- A route that 404s is reported as "not built yet" rather than treated as a failure.
- WebGL canvases are waited on properly: the script polls the encoded size of a canvas
  screenshot until the canvas is demonstrably drawing something, because an all-black canvas
  compresses to almost nothing. `waitForLoadState` alone would film a black rectangle.
- Every action is written to `output/run.log`, and anything resembling a credential is
  redacted before it is logged.

## Outputs

Everything lands in `demo/output/`:

| File | What it is |
|---|---|
| `you-want-more-walkthrough.webm` | What Playwright writes natively. |
| `you-want-more-walkthrough.mp4` | H.264 transcode, if `ffmpeg` was available. |
| `highlight.gif` | Short loop of the Bright Data unlock beat, for the README. |
| `screenshots/NN-<route>.png` | Viewport still per route, plus `-full.png` where the page scrolls. |
| `run.log`, `shots.log`, `smoke.log` | Full action logs. |

## App-side caveats this harness has hit

These are not harness bugs, but they change what the recording can show:

- **`/insights` does not exist yet** (HTTP 404). The beat is written and will record itself the
  moment the route lands — nothing here needs changing.
- **The analyst needs `OPENAI_MODEL` set.** `/analyst` defaults to `gpt-4o-mini`, which the
  current OpenAI project is not entitled to, so it renders a `403 … does not have access to
  model` panel instead of an answer. Starting the app with `OPENAI_MODEL=gpt-5.4` makes it
  work. The commentary module already carries a model-candidate fallback list; the analyst does
  not. The analyst beat detects this error and marks itself skipped rather than filming it.
- **`POST /api/commentary/speak` returns 503**, so no audio is synthesised. The captions and
  grounding panel still render, and the commentary beat advances the transport manually so the
  caption sync is visible regardless.
- **The robot picker dropdown on `/predict` paints beneath the following panel**, so its options
  fail a hit-test click. The harness works around it by dispatching the click directly on the
  element and logs a warning when it does.

## Known limitation: the video is silent

**Playwright cannot record audio.** The app has an AI voice commentator on `/commentary`, and
none of it will be audible in `you-want-more-walkthrough.mp4` — the recording captures the
synchronised captions and the grounding panel, but not the voice. This is a hard limitation of
the tool, not something a flag can turn on.

So: **if the spoken commentary needs to be heard, capture the final submission video with a
real screen recorder.** On macOS, `Cmd+Shift+5` or QuickTime's *New Screen Recording* will
capture system audio (via a loopback device such as BlackHole) or at minimum your microphone;
OBS handles both properly and is the better choice if you want a narrated take.

What this Playwright video *is* ideal for:

- **Silent b-roll** to cut underneath a voiceover recorded separately.
- **The README GIF** — see `output/highlight.gif`.
- **Regression-checking the UI**: re-run `npm run record` after a change and compare, or run
  `npm run shots` for a fast visual diff of all eleven routes.

## Regenerating everything

```bash
cd demo
rm -rf output
npm run smoke && npm run shots && npm run record
```

`npm run smoke` first is worth the twenty seconds: it tells you which beats can possibly be
captured before you spend three minutes recording.

## A note on credentials

The app reads live API keys from `app/.env.local`, which is gitignored. Nothing in this folder
reads, logs, or screenshots a key: `/intel` and `/analyst` keep their tokens server-side and
only ever send parsed payloads to the browser. The logger additionally redacts anything that
pattern-matches a key before writing to disk, so `output/*.log` is safe to share.
