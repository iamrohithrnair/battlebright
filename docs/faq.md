# FAQ — the questions a judge would actually ask

Honest answers, including the ones that aren't flattering.

---

### Is the model just heuristics?

Yes, and deliberately so.

It is a weighted linear score over three signals — career win rate at 0.45, knockout rate at 0.25,
and a hand-built weapon-class matchup table at 0.30 — plus a symmetric head-to-head nudge of ±0.05 per
prior win. There is no training step, no ML runtime, and the weights were reasoned rather than fitted.

The reason is the sample size. With 66 recorded fights, fitting weights would overfit and the resulting
model would be less trustworthy while looking more sophisticated. We'd rather ship something whose
entire logic fits on one line, publish its accuracy, and let you audit every prediction.

What makes it more than a guess is that it is measured. It calls 66.7% of historical fights correctly
against a 50% baseline, and the full per-fight sample table is in the app on `/model`, so you can find
every one of the 22 misses yourself.

The honest framing: this is a well-validated heuristic model with published error characteristics, not
a learned one. Calling it "AI-powered prediction" would be marketing.

---

### Where does the data come from, and is it real?

Two sources, and they're used for different things.

**The bundled dataset** is real BattleBots data — 42 competitors and 66 notable recorded matches across
8 seasons from 2016 to 2024 — but it is hand-assembled and curated, not scraped exhaustively and not
complete. 2017 is absent entirely. It is a slice of the sport, and every AI layer in the app is
explicitly instructed to say so rather than imply it has full historical coverage.

**Live web data** comes through Bright Data's Web Unlocker, which fetches the public BattleBots wiki
page for a given robot server-side and returns raw HTML that our own parser extracts fields from.

We didn't ask you to take the bundled data on trust, which is the point of the `/intel` page: unlock a
robot's page live and the app shows you the URL, the zone, the byte count, the round-trip latency, the
timestamp, and whether the response was live, cached or a fallback — then diffs the parsed fields
against our dataset row by row. Where the wiki and our numbers disagree, the diff says they disagree.
That's a finding we surface, not something we smooth over.

---

### How do I know the AI isn't hallucinating stats?

Because it structurally can't be the source of a number, and we check anyway.

**The analyst** has nine tools, every one a typed wrapper over the same pure engine functions that
render the pages, or over the Web Unlocker. The only figures the model ever sees are figures the engine
computed. Its system prompt states that every quantitative claim must come from a tool result in the
conversation, it ends each answer with a `Source:` line naming the tools it used, and the tool-call
trace is rendered live in the UI — which tool, which arguments, what came back, how long it took. If
it cites something, you can see the call that produced it.

**The commentator** goes further, because a broadcast voice saying a wrong number out loud is worse
than text doing it. The model never sees free-form context. It sees a fact sheet where every entry has
an id, a display form, a spoken form and a source tag. After generation, every figure in every spoken
beat is extracted — including figures written as words like "seventy-two" — and reconciled against
that sheet within half a percentage point of rounding slack. A beat that fails gets one repair pass,
and the rewrite is only accepted if it's genuinely cleaner. Anything still unreconciled is flagged with
a reason so the UI warns the audience rather than quietly lying to them. Fact ids the model cites that
don't exist on the sheet get stripped and reported, because a dangling citation is a false claim of
proof.

**The one honest hole**, documented in the code: small integers 0 through 3 are allowed through
validation without reconciling, because natural speech is full of "these two machines" and "one more
time" and there's no way to distinguish a counting word from a statistic by extraction alone. Anything
that could plausibly be a statistic is 4 or higher.

**And the layer we don't claim to validate:** prose. Grounding covers numbers and cited facts. If the
commentator says a bot "looks nervous", that's colour, not a claim, and nothing verifies it.

---

### What happens if Bright Data or OpenAI is down?

Nothing breaks, and the app tells you what degraded.

**Without any credentials at all**, the app is fully functional: predictions, the Monte Carlo
simulation, the backtest, the roster, scouting reports, brackets, and every 3D view run entirely off
the bundled dataset. The engine has no I/O.

**Bright Data unavailable, blocked, or slow:**

- `/intel` reports the specific error, including the Bright Data error code where the API returns one.
- The analyst's `scrape_live` tool returns a structured error telling the model to fall back to
  `get_robot` and to tell the user live collection failed. The agent loop continues.
- The commentary fact sheet drops to engine-only facts, records the failed fetch as a `fallback`
  provenance row so you can see exactly which fetch degraded and why, lowers its grounding level to
  `partial` or `fallback`, and carries a `degraded_reason` string for the UI to display.
- A 26-second unlock ceiling means a slow origin can't hold up the whole request.

**OpenAI unavailable:**

- The analyst reports the failure rather than silently returning nothing.
- Commentary falls back to a deterministic template script built from the same fact sheet — fact-checked
  by construction, and marked `synthetic: true` so the UI can be honest that no language model was
  involved.
- If a key is scoped to a different model family, script generation walks a candidate list until one is
  reachable and notes in the validation report which models it couldn't use. A rate limit is not
  treated as a model-access error, so we don't silently downgrade the model on a 429.

The `/predict`, `/model`, `/roster`, `/leaderboard` and `/tournament` pages have no external dependency
at all, so the core demo cannot go down because of somebody else's outage.

---

### Why 3D — isn't it just decoration?

Partly, and we'll own that. The choreographed fight sequence is theatre. It exists because "58.2%" is
a number and a fight is an event, and the sport is entertainment before it's statistics.

But the 3D does real work in three places:

- **`/tournament`** renders the bracket spatially with round-by-round playback, which is genuinely
  easier to follow than a table of 15 rows — you watch the field collapse toward a champion.
- **`/roster`** gives each robot a distinct silhouette per weapon class, so a horizontal spinner reads
  differently from a crusher at a glance. That's the taxonomy the model's third signal is built on, made
  visible.
- **The home page** uses scroll-driven camera movement to teach the model one signal at a time, which is
  a better explanation of a weighted sum than three paragraphs of prose.

Two things keep it from being a liability. Every robot is generated procedurally from primitives at
runtime — an extruded wedge chassis plus a per-class weapon assembly with its own motion type and speed
— so there are no downloaded 3D model assets and nothing large to ship. And there's a
`prefers-reduced-motion` path throughout, so the app is usable with the animation turned off, and every
page has a non-3D route to the same information.

If you stripped all of the WebGL out, the intelligence engine would be unchanged. That's the right way
round.

---

### What are the limitations?

The full list, without softening:

**Sample size.** 66 fights. Enough to beat a coin flip convincingly, not enough to claim precision. The
HIGH-confidence bucket holds only 5 fights, so its 80% accuracy is directional, not a measured rate.

**Judges' decisions are the blind spot.** 84.6% accuracy on fights that ended by knockout, 55.0% on
fights that went to the judges — barely better than a coin flip. The model reads damage well and reads
control, aggression and judging panels poorly. Fixing that needs per-fight control and damage data we
don't have.

**Hand-set weights.** 0.45 / 0.25 / 0.30 are reasoned, not fitted. Defensible given the sample size,
but they are a judgement call.

**The weapon-edge table is expert judgement.** An 8×8 antisymmetric matrix that encodes how the sport
actually plays out, built by hand rather than measured. It is the second-heaviest term in the model.

**No temporal awareness.** Career win rate is a lifetime aggregate. The model doesn't know a bot was
rebuilt between seasons, arrived with a new weapon, or is currently on a five-fight run. A 2016 result
counts exactly as much as a 2024 one.

**Curated dataset.** Notable fights from 2016–2024 with 2017 missing. Not the whole sport.

**Monte Carlo adds range, not information.** It perturbs the same three signals with Gaussian noise. It
is an honest uncertainty band around the model's own view, not an independent estimate. Its PRNG is
seeded deterministically, so the same matchup always yields the same chart — good for demos, and worth
knowing before you read it as sampling.

**No driver skill term.** Driving is arguably the single biggest factor in combat robotics and it is
completely absent from the model. It leaks in indirectly through career win rate, which is not the same
thing.

**Live scraping is verification, not ingestion.** Bright Data proves and enriches our dataset field by
field; it does not currently rebuild the dataset from the web. That's the obvious next step.

---

### Why should I trust the 66.7% figure?

Because the way it could be inflated is explicitly closed off, and the raw sample is published.

The obvious way to cheat a fight-prediction backtest is to leave head-to-head record in the model.
Head-to-head partly *is* the result you're trying to predict, so including it produces a flattering
number that means nothing. `backtest()` passes `useH2h = false` for exactly that reason. It costs
accuracy and buys a defensible figure.

Beyond that: the full sample table of all 66 fights is rendered on `/model` with our prediction, the
actual winner and whether we got it right; the breakdown by confidence bucket, finish method and season
is shown alongside; and the losing season is shown rather than hidden. The number is also recomputed
from the code at runtime, not hardcoded in the UI — so it cannot silently drift away from the data.

---

### Isn't this the same as the Angular version in the repo?

No. The earlier Angular and FastAPI prototype established the core idea — an explainable weighted
model with a probability bar and a leaderboard — and this rebuild keeps that formula deliberately, so
the two are comparable.

What's new here: the 3D arena and the choreographed fight, procedural per-weapon-class robot geometry,
Monte Carlo distributions, the seeded 3D tournament bracket with playback, generated per-bot scouting
reports, the full model-transparency page with per-bucket and per-season calibration and the complete
sample table, byte-level Bright Data provenance with a field-by-field verification diff, a
streaming tool-using AI analyst with a visible tool-call trace and Bright Data as one of its tools, and
a grounded voice-commentary pipeline with numeric validation. Single Next.js application, no Python
backend.

---

### What isn't finished?

Two things are built server-side but not yet exposed as pages, and we'd rather say so than have you
find a 404.

- **`/insights`** — weapon-class meta, biggest historical upsets, and a weapon-versus-weapon advantage
  heatmap. The engine functions and the `/api/weapon-meta` and `/api/upsets` endpoints are live and
  already feed the home page, the model page and the analyst. The dedicated page is the remaining piece,
  and the nav currently links to it.
- **`/commentary`** — the AI voice commentator. The pipeline is complete and callable:
  `/api/commentary/script` builds the grounded fact sheet and the validated six-beat script,
  `/api/commentary/speak` synthesises it with per-beat voice direction, and
  `/api/commentary/transcribe` handles voice input. The broadcast-booth UI with synchronised captions
  and the grounding panel is still landing.
