# Ready-to-post copy

Every post must carry **#BattleBotsDev** — the hashtag is mandatory for the competition.

Replace the placeholders before posting:

- `<DEMO_URL>` — the deployed app
- `<REPO_URL>` — the public repository
- `<VIDEO_URL>` — the video walkthrough

Verified figures used below, all computed from the code: 42 robots, 66 recorded matches, 8 seasons
(2016–2024), 8 weapon classes, backtest accuracy 66.7% (44/66) against a 50% baseline, 84.6% on
knockouts versus 55.0% on judges' decisions.

---

## X / Twitter

### Short (256 characters)

```
Built "You Want More?" — a 3D BattleBots fight predictor that shows its work.

Every probability breaks into weighted signals. Backtested: 66.7% on 66 real fights vs a 50% coin flip. Live data verified through Bright Data Web Unlocker.

<DEMO_URL>

#BattleBotsDev
```

### Long (thread)

**1/6**

```
"You Want More?" — a 3D BattleBots intelligence engine.

Pick two bots. Watch the fight in WebGL. Get a win probability that decomposes into the exact signals behind it.

No black box. No hot takes.

<DEMO_URL>

#BattleBotsDev
```

**2/6**

```
The whole model is one line you can read:

score = 0.45·win_rate + 0.25·ko_rate + 0.30·(0.5 + weapon_edge)

Head-to-head nudges it ±0.05 per prior win. Every prediction returns how many points each signal contributed, per robot.

#BattleBotsDev
```

**3/6**

```
And it's validated.

Replayed against every recorded fight: 66.7% (44/66) vs a 50% coin flip.

Head-to-head is disabled during backtesting so the model can't peek at the result it's predicting. The full per-fight sample table is in the app.

#BattleBotsDev
```

**4/6**

```
Where it's weak, published:

84.6% on fights that ended by KO.
55.0% on fights that went to the judges.

It reads damage well and judging panels badly. LOW-confidence matchups get labelled coin flips instead of dressed up.

#BattleBotsDev
```

**5/6**

```
Bright Data's Web Unlocker is the verification layer.

Unlock a robot's wiki page live, then diff it field by field against our own dataset — with URL, zone, byte count and latency on screen.

It's also a callable tool for the AI analyst.

#BattleBotsDev
```

**6/6**

```
The AI can't invent a stat.

The analyst only ever sees numbers the engine produced, and its tool-call trace is visible as it runs.

The voice commentator's script is reconciled figure by figure against a fact sheet. Anything unverified gets flagged.

<REPO_URL>

#BattleBotsDev
```

---

## LinkedIn

### Short

```
I built "You Want More?" for the Bright Data × BattleBots challenge — a 3D BattleBots intelligence engine that predicts fights and, more importantly, proves its work.

Pick two robots, watch the bout play out in WebGL, and get a win probability that decomposes into the exact weighted signals behind it: career form, finishing power, weapon matchup. Replayed against every recorded fight in the dataset, it calls 66.7% of them correctly against a 50% coin-flip baseline — with head-to-head deliberately disabled during backtesting so the model can't peek at the result it's scoring.

Bright Data's Web Unlocker is the verification layer: unlock a robot's wiki page live, then diff it field by field against our bundled dataset with the URL, zone, byte count and latency shown on screen.

Demo: <DEMO_URL>
Code: <REPO_URL>

#BattleBotsDev
```

### Long

```
I built "You Want More?" for the Bright Data × BattleBots challenge. It's a 3D BattleBots intelligence engine, and the interesting part isn't the prediction — it's that you can check it.

THE MODEL IS EXPLAINABLE

One formula, printed in the UI:

score = 0.45·win_rate + 0.25·ko_rate + 0.30·(0.5 + weapon_edge)

Career form, finishing power, and an 8×8 weapon-class matchup table. Head-to-head history nudges the result ±0.05 per prior win. Every prediction returns the exact point contribution of each signal for each robot, so "Tombstone 58%" is never the whole answer — you see which signal earned it.

THE MODEL IS VALIDATED, INCLUDING WHERE IT FAILS

Replayed against all 66 recorded fights across 42 robots and 8 seasons: 66.7% accuracy against a 50% baseline. Head-to-head is disabled during backtesting, because head-to-head record leaks the answer to the fight you're scoring.

The breakdown matters more than the headline. 84.6% on fights that ended by knockout, 55.0% on fights that went to the judges. That gap is the honest story: the model reads damage well and reads control, aggression and judging panels poorly. Low-confidence matchups are labelled coin flips rather than dressed up as calls.

THE DATA IS VERIFIABLE

Bright Data's Web Unlocker unlocks a robot's live wiki page server-side, and the app shows real provenance — URL, zone, byte count, round-trip latency, timestamp, and whether the response was live, cached or a fallback — then diffs the parsed fields against our bundled dataset. Where the live page and our data disagree, the UI says so.

THE AI LAYERS ARE GROUNDED

An AI analyst answers natural-language questions by calling the prediction engine through nine typed tools, with its tool-call trace visible in the UI as it runs and a source line on every answer. It can also call Bright Data mid-conversation to fetch fresh web data. A voice commentator builds a fact sheet first, generates a script under a strict schema second, then extracts every figure it spoke — including ones written as words — and reconciles them against that sheet. Anything that doesn't reconcile is flagged on screen rather than quietly spoken.

Next.js 16, React 19, three.js with all robot geometry generated procedurally from primitives at runtime — no downloaded 3D assets. Every external dependency has a documented fallback: no Bright Data means engine-only facts that say so, no OpenAI means a deterministic script.

Demo: <DEMO_URL>
Code: <REPO_URL>
Walkthrough: <VIDEO_URL>

#BattleBotsDev
```

---

## YouTube description

```
You Want More? — a 3D BattleBots intelligence engine built for the Bright Data × BattleBots challenge.

Pick two robots, watch the fight play out in 3D, and get a win probability that decomposes into the exact weighted signals behind it. The model is explainable, backtested, and checked against live web data collected through Bright Data's Web Unlocker.

CHAPTERS
00:00 The problem with fight predictions
00:20 3D arena and the three model signals
00:50 Predict: choreographed fight, probability, signal breakdown, Monte Carlo
02:00 Roster and per-bot scouting reports
02:30 Tournament: seeded 3D bracket with round-by-round playback
03:00 Model transparency: the backtest, and where it fails
03:45 Live Intel: Bright Data Web Unlocker with byte-level provenance and a verification diff
04:30 AI analyst: a tool-using agent over the engine, with a visible tool trace
05:15 Grounded AI voice commentary
05:45 Architecture and stack

THE MODEL
score = 0.45·win_rate + 0.25·ko_rate + 0.30·(0.5 + weapon_edge)

Head-to-head history applies a symmetric ±0.05 nudge per prior win, and is deliberately disabled during backtesting so the model cannot peek at the result of the fight it is predicting.

VERIFIED NUMBERS
Dataset: 42 robots, 66 recorded matches, 8 seasons (2016–2024), 8 weapon classes
Backtest accuracy: 66.7% (44 of 66) against a 50% coin-flip baseline
By confidence: HIGH 80.0% (4/5), MEDIUM 71.9% (23/32), LOW 58.6% (17/29)
By finish: knockouts 84.6% (22/26), judges' decisions 55.0% (22/40)
Above baseline in 7 of 8 seasons

HOW BRIGHT DATA IS USED
Web Unlocker via the Bright Data API, server-side only, so the token never reaches the browser. Every unlock returns real provenance — URL, zone, byte count, latency, timestamp, and live/cached/fallback status — and the app diffs the parsed page against our bundled dataset field by field. Bright Data is also exposed as a callable tool to the AI analyst and to the voice commentator's fact sheet.

STACK
Next.js 16, React 19, TypeScript, three.js with @react-three/fiber (all robot geometry generated procedurally from primitives — no downloaded 3D assets), Tailwind CSS, Bright Data Web Unlocker, OpenAI.

LINKS
Live demo: <DEMO_URL>
Source: <REPO_URL>
Bright Data: https://brightdata.com
Free hackathon credits: https://brdta.com/battlebotsdev

#BattleBotsDev
```
