# You Want More?

**A 3D BattleBots fight predictor that shows its work.** Every probability decomposes into
weighted signals, gets backtested against real historical fights, and can be checked against
live web data you watch arrive.

Built for the **Bright Data × BattleBots** challenge with [Bright Data](https://brightdata.com)
Web Unlocker · `#BattleBotsDev`

![The Bright Data verification console diffing live wiki data against the bundled dataset](demo/output/highlight.gif)

---

## What it is

Ask anyone who watches BattleBots who wins Tombstone versus End Game and you get an argument.
Ask the internet and you get a hot take with no numbers behind it. This is the opposite of a hot
take.

Pick two robots. A choreographed 3D fight plays out in a WebGL arena, and then you get a number —
not just "Tombstone, 58%", but *why*: how much came from career record, how much from knockout
power, how much from the fact that a horizontal bar eats a lifter for breakfast. Then you get the
receipts. The model has been replayed against every recorded fight in the dataset and its full
report card is published in the app, misses included. And when the data itself is in question, the
app unlocks the robot's live wiki page through Bright Data and diffs it against the bundled dataset
field by field, with byte count and latency on screen.

Three layers check the one below. The prediction engine is pure, deterministic and inspectable.
Bright Data verifies the engine's inputs against the live web. Two AI layers — a tool-using analyst
and a voice commentator — are wired so they can only speak numbers the engine or a live fetch
actually produced. The AI never gets to be the source of truth; it gets to be the interface to one.

## Highlights

- **Explainable, not explainable-in-principle.** One formula, printed in the UI. Every prediction
  returns a `contributions` array showing exactly how many points each weighted signal gave each
  robot.
- **A published backtest, failures included.** 66.7% (44 of 66 fights) against a 50% coin-flip
  baseline, with head-to-head record explicitly disabled during backtesting so the model cannot peek
  at the result of the fight it is scoring. Broken out by confidence bucket, finish method and
  season, with the complete per-fight sample table on `/model`.
- **Data you can verify, not data you're asked to trust.** Live Bright Data collection with
  byte-level provenance — URL, zone, bytes, latency, timestamp, and whether the response was live,
  cached or a fallback — plus a field-by-field diff against the bundled dataset. Where the wiki and
  our numbers disagree, the UI says they disagree.
- **An AI analyst that can go and look.** A streaming tool-call agent over the same engine functions
  the pages render, with Bright Data as one of its nine tools, so it can scrape the web
  mid-conversation. The tool trace renders live beside the answer.
- **A voice commentator that can't invent a statistic.** Every figure in the spoken script is
  extracted after generation — digits and number-words alike — and reconciled against a fact sheet.
  Anything unreconciled is flagged on screen rather than quietly spoken.
- **It admits uncertainty on purpose.** Confidence comes from the probability margin, and the LOW
  bucket — where the model is genuinely weakest at 58.6% — is labelled a coin flip in the UI, in the
  analyst's instructions and in the commentary voice direction.

## Feature tour

In demo order. Every route below is live.

| Route | What it does |
|---|---|
| `/` | The arena. Scroll position drives a WebGL camera through five keyframes, introducing the three model signals one beat at a time. The stat strip is computed, not typed. |
| `/predict` | The centrepiece. Two bots, a choreographed 3D bout, then win probabilities, confidence, projected finish, the weighted signal breakdown, plain-English reasons, and a Monte Carlo histogram over 4,000 perturbed trials. |
| `/roster` | All 42 competitors, searchable by name, builder and weapon label, filterable by class. Every robot's geometry is generated from primitives at runtime — no downloaded assets. |
| `/roster/[name]` | The scouting report. Career stats, leaderboard rank, a signal radar against the roster baseline, match-history timeline, and best/worst matchups found by running this bot against all 41 others. |
| `/leaderboard` | Rankings, every column sortable, with search and weapon-class filtering. |
| `/tournament` | Seed the top 4, 8 or 16 by win rate — expanded outward the way a real event does it — then simulate. Renders as a 3D bracket with round-by-round playback plus a flat 2D view. |
| `/model` | The report card. Formula and weights, accuracy against the baseline, calibration by confidence bucket, accuracy by finish method, per-season accuracy, and the full sample table of every backtested fight. |
| `/intel` | The Bright Data console. Unlock a robot's wiki page live, watch the collection log, then read the parsed payload, the provenance panel and the field-by-field verification diff. Force a fresh fetch to bypass the cache. |
| `/analyst` | Ask it anything. A streaming, tool-using agent over the engine, with its tool-call trace rendered live and a `Source:` line naming the tools it used. |
| `/commentary` | The broadcast booth. A six-beat AI commentary script grounded in a fact sheet, synthesised to speech with per-beat voice direction, alongside the grounding panel and validation report. |

Not built: `/insights`. The weapon-class meta and historical-upset engine functions exist and their
API routes are live and already feed other pages, but there is no dedicated page for them yet.

## Screenshots and video

The Playwright harness in [`demo/`](demo/) records a full walkthrough and a still of every route.
Current captures:

| | |
|---|---|
| ![The 3D arena on the landing page](demo/output/screenshots/01-hero.png) | ![The matchup studio showing the explainable prediction readout](demo/output/screenshots/02-predict.png) |
| ![The Bright Data intel console with provenance and verification diff](demo/output/screenshots/09-intel.png) | ![The AI analyst answering with its tool-call trace visible](demo/output/screenshots/10-analyst.png) |

- Full walkthrough video: [`demo/output/you-want-more-walkthrough.mp4`](demo/output/you-want-more-walkthrough.mp4)
  (also available as [`.webm`](demo/output/you-want-more-walkthrough.webm))
- Per-route stills: [`demo/output/screenshots/`](demo/output/screenshots/)

The Playwright video is silent — Playwright cannot record audio, so the voice commentary is not
audible in it. See [`demo/README.md`](demo/README.md) for how to capture a narrated take.

## Quick start

Prerequisites: Node 20.9 or newer (required by Next.js 16; developed on Node 24).

```bash
cd app
npm install
npm run dev
```

Open http://localhost:3000.

**It runs fully offline with no credentials at all.** Predictions, the backtest, the roster,
brackets and every 3D view are derived from the bundled dataset by a pure TypeScript engine. The
Bright Data and AI layers degrade explicitly rather than breaking: a missing key produces a
structured, reported fallback, never a blank screen.

To enable live collection and the AI layers, copy `.env.example` to `.env` in the repo root (or to
`app/.env.local`) and set these variables:

| Variable | Enables |
|---|---|
| `BRIGHT_API_KEY` | Bright Data Web Unlocker — `/intel`, the analyst's `scrape_live` tool, live commentary facts |
| `BRIGHTDATA_ZONE` | Your Web Unlocker zone name |
| `OPENAI_API_KEY` | The `/analyst` agent and the commentary script, voice and transcription routes |

Optional overrides: `OPENAI_MODEL` for the analyst, `OPENAI_COMMENTARY_MODEL` for script generation,
`OPENAI_TTS_MODEL` for voice. Free Bright Data hackathon credits:
https://brdta.com/battlebotsdev

Both env files are gitignored, and no credential is ever read outside a server route handler.

```bash
npm run typecheck   # strict TypeScript, no emit
npm run build       # production build
```

## How Bright Data is used

Bright Data's **Web Unlocker** is the collection layer, called through the Bright Data API
(`POST https://api.brightdata.com/request`) with a zone and a target URL, returning raw HTML. It is
load-bearing in three distinct places.

**1. Server-side only, so the credential never reaches the browser.** `BRIGHT_API_KEY` is read
exclusively inside `app/src/lib/brightdata.ts`, which is imported only by Node route handlers. The
browser receives parsed payloads and provenance, never a token. The API answers HTTP 200 even when
the proxy layer rejected the request, so the `x-brd-err-*` headers are read for the real verdict
rather than trusting the status code.

**2. Real provenance, and a verification diff.** Every unlock returns the URL, the zone name, the
byte count, the round-trip latency in milliseconds, an ISO timestamp, and a status of `live`,
`cached` or `fallback`. Responses are cached for 10 minutes so a demo stays fast and cheap — the
cache is labelled as such, and a "force fresh" control bypasses it. `/intel` then diffs the parsed
page against the bundled dataset field by field (weapon class, weight, builder, country) and marks
each row as agreeing or disagreeing. Disagreements are shown, not smoothed over.

**3. Bright Data as a callable tool for both AI layers.** `scrape_live` is one of the analyst's nine
tools, so the agent can decide mid-conversation to go and check the web, and its instructions require
it to quote the byte count, latency and zone as proof the collection was real. Separately, the voice
commentator's fact sheet fires two concurrent unlocks — one per robot — to pull team, builder,
country, season references and the article lede, none of which the bundled dataset contains. Those
facts are tagged `bright_data` so the grounding panel can badge them by source.

Parsing is dependency-free: infobox fields, the article lede and season mentions are extracted by a
hand-written parser, with no HTML library in the bundle.

**When Bright Data is unavailable, nothing breaks.** The analyst's tool returns a structured error
telling the model to fall back to the bundled dataset and say so. The commentary fact sheet degrades
to engine-only facts, drops its grounding level, and carries a `degraded_reason` string the UI can
display.

## How the AI layers work

**The analyst** is a streaming server-side tool-call loop with nine tools — `get_robot`,
`predict_matchup`, `get_leaderboard`, `get_weapon_meta`, `get_backtest`, `get_upsets`,
`simulate_tournament`, `scout_robot`, `scrape_live` — every one a typed wrapper over the same pure
engine functions the pages render, or over the Web Unlocker. The loop streams text deltas straight
through, accumulates streaming tool-call fragments, executes tools, feeds results back and repeats,
capped at five iterations with tools switched off on the final pass so the model has to produce
prose instead of looping. Tool telemetry is emitted on request and again on completion, which is what
lets the UI render a live trace rather than a post-hoc log. The tools are the only channel through
which numbers reach the model, and every answer ends with a `Source:` line. Name resolution runs
exact → case-insensitive → substring → Levenshtein, so "witch doctor" or "Minotaurus" is recoverable
rather than fatal.

**The commentator** is a fact sheet, then a script, then speech. The fact sheet is built server-side
from the prediction engine plus two concurrent Bright Data unlocks; every entry carries an id, a
label, a display form, a spoken form, a numeric value where one exists, and a source tag. That sheet
is the only thing the model may draw numbers from. The model then returns six beats — intro, tale of
the tape, prediction, clash, finish, verdict — under a strict JSON schema, normalised into fixed
order and run through deterministic speech cleanup. Then every figure in every beat is extracted,
digits and number-words alike, and reconciled against the fact sheet; failures get one repair pass,
and anything still unreconciled sets a `flagged` bit with a reason so the UI can warn the audience
instead of quietly lying to them. Finally the beats are synthesised with per-beat delivery
instructions. Every stage has a floor under it: with no key or an unreachable model, a deterministic
template script is built from the same fact sheet and labelled `synthetic: true`.

## The model, honestly

```
score = 0.45·win_rate + 0.25·ko_rate + 0.30·(0.5 + weapon_edge)
```

Head-to-head history then applies a symmetric nudge of ±0.05 per prior win. Scores are normalised
across the two robots into probabilities. Confidence comes from the margin: HIGH above 20 points,
MEDIUM above 8, LOW below. `weapon_edge` is a hand-built, antisymmetric 8×8 class-versus-class table
in the range -1 to +1 — a horizontal spinner is +0.35 against a lifter, a lifter -0.35 against a
horizontal spinner.

The backtest replays the model over every recorded fight where both robots are in the roster, with
head-to-head disabled so the model cannot peek at the answer.

| | Accuracy | Sample |
|---|---|---|
| **Overall** | **66.7%** | 44 / 66 |
| Coin-flip baseline | 50.0% | — |
| HIGH confidence | 80.0% | 4 / 5 |
| MEDIUM confidence | 71.9% | 23 / 32 |
| LOW confidence | 58.6% | 17 / 29 |
| Fights that ended by KO | 84.6% | 22 / 26 |
| Fights that went to the judges | 55.0% | 22 / 40 |

Above the baseline in 7 of 8 seasons. The exception is 2019, at 42.9% on 7 fights.

Where it's weak:

- **The sample is small.** 66 fights across 42 robots — enough to beat a coin flip convincingly,
  not enough to claim precision. The HIGH bucket holds five fights, so treat its 80% as directional.
- **The dataset is curated, not exhaustive.** A hand-assembled slice of notable results across 8
  seasons from 2016 to 2024 (2017 is absent), not the whole history of the sport. Every AI layer is
  instructed to say so.
- **Judges' decisions are the blind spot.** 84.6% on knockouts versus 55.0% on decisions. The model
  reads damage well and reads control, aggression and judging panels poorly. Closing that gap needs
  per-fight control and damage data we don't have.
- **The weights are hand-set, not fitted.** 0.45 / 0.25 / 0.30 are reasoned. Fitting them on 66
  fights would overfit; we kept them interpretable and disclosed the choice.
- **The model is stateless in time.** Career win rate is a lifetime aggregate, so it doesn't know a
  bot was rebuilt between seasons or arrived with a new weapon.
- **Monte Carlo widens the picture; it does not add information.** It perturbs the same three
  signals, so it is an honest uncertainty range around the model's own view, not an independent
  estimate.

## Architecture

```
                          browser (React 19 + WebGL)
 ┌──────────────────────────────────────────────────────────────────────┐
 │  /  /predict  /roster  /leaderboard  /tournament  /model             │
 │  /intel  /analyst  /commentary                                       │
 │  three.js scenes · procedural robot geometry · no downloaded assets  │
 └───────────────────────────────┬──────────────────────────────────────┘
                                 │  fetch / streaming
 ┌───────────────────────────────▼──────────────────────────────────────┐
 │                    Next.js route handlers (server)                   │
 │  /api/predict  /api/simulate  /api/backtest  /api/tournament          │
 │  /api/robots   /api/robot/[n]  /api/scout/[n]  /api/leaderboard       │
 │  /api/weapon-meta  /api/upsets  /api/intel/[name]                     │
 │  /api/analyst (streaming NDJSON)                                      │
 │  /api/commentary/{script,speak,transcribe}                            │
 └───────┬───────────────────────┬──────────────────────────┬───────────┘
         │                       │                          │
 ┌───────▼────────┐   ┌──────────▼───────────┐   ┌──────────▼──────────┐
 │  engine.ts     │   │  brightdata.ts       │   │  OpenAI             │
 │  pure, typed   │   │  Web Unlocker API    │   │  analyst agent loop │
 │  no I/O        │   │  provenance + cache  │   │  commentary + TTS   │
 │  42 bots       │   │  dependency-free     │   │  grounded in engine │
 │  66 matches    │   │  HTML parser         │   │  + Bright Data only │
 └────────────────┘   └──────────────────────┘   └─────────────────────┘
                                 │
                      battlebots.fandom.com (live)
```

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| 3D | three.js, `@react-three/fiber`, `@react-three/drei`; geometry generated from primitives at runtime |
| Motion | GSAP and Motion, with a `prefers-reduced-motion` path throughout |
| Styling | Tailwind CSS, OLED-dark palette, Fira Code for display and Fira Sans for body |
| Data collection | Bright Data Web Unlocker via the Bright Data API, server-side only |
| AI | OpenAI — `gpt-4o-mini` for the analyst and script generation, `gpt-4o-mini-tts` for voice |
| Model | Pure TypeScript. No ML runtime, no training step, fully deterministic |

The prediction engine has no I/O and no dependencies. Pages, API routes, analyst tools and the
commentary fact sheet all derive from the same pure functions, which is why the analyst cannot
disagree with the page.

## Project layout

```
.
├── app/          the Next.js application — pages, API routes, engine, Bright Data, AI layers
│   └── src/lib/  engine.ts (the model) · brightdata.ts (Web Unlocker) · analyst/ · commentary/ · data/
├── demo/         standalone Playwright harness: route smoke test, per-route stills, walkthrough video
├── docs/         judge-facing FAQ and ready-to-post #BattleBotsDev social copy
└── PITCH.md      the full pitch: positioning, differentiators, judging-criteria mapping
```

## API reference

Every route below exists under `app/src/app/api/`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/robots?weapon=&q=` | The roster, filterable by weapon class and free-text query. |
| GET | `/api/robot/[name]` | One robot: career stats, rank and full match history. |
| GET | `/api/leaderboard?limit=` | Rankings by win rate. |
| GET | `/api/predict?a=&b=&h2h=` | A prediction with signals, weighted contributions, reasons, confidence and projected finish. |
| GET | `/api/simulate?a=&b=&trials=` | Monte Carlo distribution over the prediction (default 4,000 trials, deterministic). |
| GET | `/api/backtest` | The full backtest: headline accuracy, buckets by confidence, method and season, and every sample. |
| GET | `/api/tournament?robots=&size=` | Seed and simulate a single-elimination bracket round by round. |
| GET | `/api/scout/[name]` | Scouting report: strengths, weaknesses, best and worst matchups across the roster. |
| GET | `/api/weapon-meta` | Per-weapon-class aggregates: roster count, career and recorded-fight win rates. |
| GET | `/api/upsets?limit=` | Historical fights the model gets wrong, ranked by how confident it was. |
| GET | `/api/intel/[name]?fresh=1` | Bright Data unlock of a robot's wiki page: parsed fields, provenance, and the verification diff. `fresh=1` bypasses the cache. |
| POST | `/api/analyst` | The tool-using analyst. Streams NDJSON: text deltas plus tool-call telemetry. |
| POST | `/api/commentary/script` | Builds the grounded fact sheet and the validated six-beat script. |
| POST | `/api/commentary/speak` | Synthesises a script to speech with per-beat voice direction. |
| POST | `/api/commentary/transcribe` | Server-side transcription for voice input where the browser lacks `SpeechRecognition`. |

## Further reading

- [`PITCH.md`](PITCH.md) — the full pitch: positioning, what's hard about it, judging-criteria mapping.
- [`app/README.md`](app/README.md) — the detailed technical and setup document.
- [`app/DEMO.md`](app/DEMO.md) — the demo script, beat by beat.
- [`docs/faq.md`](docs/faq.md) — the questions a judge would actually ask, answered honestly.
- [`docs/social-post.md`](docs/social-post.md) — ready-to-post `#BattleBotsDev` copy.
- [`demo/README.md`](demo/README.md) — the Playwright walkthrough harness.

## Credits

Built with [Bright Data](https://brightdata.com) Web Unlocker for the Bright Data × BattleBots
challenge · `#BattleBotsDev`

BattleBots data is hand-assembled from public records; live page content is fetched from the public
[BattleBots Wiki](https://battlebots.fandom.com). Robot names and the BattleBots trademark belong to
their respective owners. This is an independent hackathon project, not affiliated with BattleBots
Inc.
