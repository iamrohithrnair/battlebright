# Voice commentary — API research and architecture decisions

Researched live against the official OpenAI docs on **2026-07-28**. Nothing here is from
training-data memory; every claim below has a link.

> **Docs moved.** The API reference now lives on **`developers.openai.com`**
> (`platform.openai.com/docs/...` redirects there). Appending `.md` to any docs URL returns
> clean markdown, and [`developers.openai.com/llms.txt`](https://developers.openai.com/llms.txt)
> is the full index. Useful if you want to re-verify any of this.

---

## Decision 1 — Script-then-TTS, **not** the Realtime API

This is the most important architectural call in the feature, so here is the reasoning.

The commentary must be **factually exact**: every number spoken has to trace back to the
prediction engine or to a live Bright Data scrape. That requirement decides the architecture.

| | Script → validate → TTS (**chosen**) | Realtime speech-to-speech |
|---|---|---|
| Can we gate the words before they're spoken? | **Yes** — `/v1/audio/speech` is a pure text→audio renderer with no model reasoning in the loop, so the audio is a byte-for-byte rendering of a script our validator already approved | **No** — a Realtime session generates text and audio jointly from a live model; there is no point at which an utterance can be checked before it leaves the speaker |
| Audio output cost | **$12.00 / 1M audio output tokens** (`gpt-4o-mini-tts`) | **$64.00 / 1M** (`gpt-realtime-2.1`) or **$20.00 / 1M** (`-mini`) |
| Input cost | $0.60 / 1M text input tokens | $32.00 / 1M audio input ($10 mini) — billed continuously while the mic is open |
| Replayable / cacheable | **Yes** — deterministic per (text, voice), so we cache and replays are free and instant | No — every playback is a fresh billed session |
| Tone control | `instructions` (see below) gives per-beat delivery steering, which was the main reason to reach for Realtime | Built in |

So Realtime is ~5.3× more expensive per spoken token, cannot be cached, and — decisively —
cannot be fact-checked before it speaks.

The docs themselves draw the same line. From the
[Realtime guide](https://developers.openai.com/docs/guides/realtime): *"Realtime sessions are
best for live audio that needs low latency. Request-based audio APIs are best for files,
bounded requests, or generated speech that doesn't need a live session."* Its own decision
table routes "generate speech from text" to the text-to-speech guide, not to Realtime.

Realtime would be the right call for a **conversational** analyst (interruptible, barge-in,
open-ended Q&A). It is the wrong call for pre-scripted, data-grounded fight commentary.

Realtime specifics captured in case a sibling stream wants them: transports are WebRTC /
WebSocket / SIP, the current model is **`gpt-realtime-2.1`** (`-mini` for the cheap tier), and
browser clients must use an ephemeral token minted server-side via
`POST /v1/realtime/client_secrets` — the standard API key must never reach the browser
([WebRTC guide](https://developers.openai.com/docs/guides/realtime-webrtc)).

---

## Decision 2 — Text-to-speech configuration

**Endpoint:** `POST /v1/audio/speech` — unchanged
([reference](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create.md)).

**Model: `gpt-4o-mini-tts`.** The `SpeechModel` enum is exactly four values —
`tts-1`, `tts-1-hd`, `gpt-4o-mini-tts`, `gpt-4o-mini-tts-2025-12-15` (the dated snapshot of
the same model). The [TTS guide](https://developers.openai.com/docs/guides/text-to-speech)
says: *"For intelligent realtime applications, use the `gpt-4o-mini-tts` model, our newest and
most reliable text-to-speech model."* Critically, it is the **only** family that supports the
delivery-steering parameter, which the whole feature depends on. Overridable via
`OPENAI_TTS_MODEL`.

**The delivery-steering parameter is `instructions`** (a plain string). Docs: *"Control the
voice of your generated audio with additional instructions. **Does not work with `tts-1` or
`tts-1-hd`**"*, with **`maxLength 4096`**
([TS reference](https://developers.openai.com/api/reference/typescript/resources/audio/subresources/speech/methods/create)).
It can steer accent, emotional range, intonation, impressions, speed of speech, tone, and
whispering. This is what lets one voice sound like an analyst on `tale_of_the_tape` and
explode on `clash` — see `BEAT_DELIVERY` in [`voice.ts`](./voice.ts), which ships a distinct
instruction per beat. [openai.fm](https://openai.fm) is the playground for iterating on these.

**Voices — 13 available** on `gpt-4o-mini-tts`: `alloy`, `ash`, `ballad`, `coral`, `echo`,
`fable`, `nova`, `onyx`, `sage`, `shimmer`, `verse`, `marin`, `cedar`. The guide notes
*"For best quality, we recommend using `marin` or `cedar`"*, and that the `tts-1` family
supports only a smaller subset.

We default to **`ash`** — the punchiest, most energetic of the set, which is what an arena
fight-caller needs — and expose six curated alternatives (`ash`, `onyx`, `marin`, `cedar`,
`ballad`, `sage`) in the UI. See `VOICES` in [`voice.ts`](./voice.ts).

> SDK gotcha: the TypeScript literal union for `voice` omits `fable`, `onyx`, and `nova` even
> though the docs list all 13. The type is `string | <union> | ID`, so those still compile and
> work — you just lose autocomplete.

**`response_format`: `mp3`** (the default; the six options are mp3/opus/aac/flac/wav/pcm). MP3
plays from an `<audio>` element everywhere and is compact enough to cache in memory. We
deliberately avoid `pcm`, which is headerless raw 24 kHz 16-bit LE and won't play from an
`<audio>` tag at all. `wav`/`pcm` are marginally lower-latency (no decode overhead) but cost
~10× the bytes, which matters more over a demo network.

**Input cap: 4096 characters** (`input` max length). Note the model catalog page separately
states a **2000-token** limit and the docs never reconcile the two — so we cap each request at
**1800 characters** in `speak/route.ts`, comfortably under both. Individual beats are 2–4
sentences, so this is never hit in practice.

**Streaming:** supported two ways. (a) Plain **chunked transfer encoding** by default — read
the response body incrementally, no parameter needed. (b) `stream_format: 'sse' | 'audio'`,
where `sse` is unsupported on the `tts-1` family. We use **(a)**: the SDK resolves to a
standard web `Response`, so `response.body` is a `ReadableStream` we forward straight through.
The SSE event payload schema is *not* published in the API reference and the Node SDK has no
parser for it, so building on it would be guesswork.

**SDK shape** — `client.audio.speech.create()` resolves to a plain web `Response`
(`__binaryResponse: true` internally), so `.arrayBuffer()`, `.blob()` and `.body` are all
directly available. No `.asResponse()` needed.

```ts
const speech = await client.audio.speech.create({
  model: 'gpt-4o-mini-tts',
  voice: 'ash',
  input: beat.text,
  instructions: BEAT_DELIVERY[beat.id],
  response_format: 'mp3',
});
return new Response(speech.body, { headers: { 'Content-Type': 'audio/mpeg' } });
```

**Cost:** `gpt-4o-mini-tts` is token-billed, not character-billed — **$0.60 / 1M text input
tokens** and **$12.00 / 1M audio output tokens**
([model card](https://developers.openai.com/api/docs/models/gpt-4o-mini-tts), rated "Speed:
Fast"). A full six-beat call is a few hundred spoken words, so well under a cent — and our
per-(text, voice) cache makes every replay free.

**Latency:** OpenAI publishes **no** TTFB figures for TTS; the only guidance is qualitative.
Our measured numbers are in the feature report. We mitigate perceived latency two ways: the
next beat is **prefetched while the current one plays**, and synthesised audio is cached
in-process so a replay is instant.

---

## Decision 3 — Speech-to-text: browser first, OpenAI as fallback

The voice-input path is secondary, so the priority is zero added latency and graceful
degradation rather than maximum accuracy.

**Primary: the browser's `SpeechRecognition`.** It streams interim results with no network
round-trip of our own and no cost. Support as of mid-2026: Chrome/Edge/Opera yes (still under
the `webkitSpeechRecognition` prefix), Safari partial since macOS 14.1 / iOS 14.5, and
**Firefox still no** — implemented but disabled behind `dom.webspeech.recognition.enable`.
MDN flags the interface as not Baseline. So it must be feature-detected, never assumed.

**Fallback: `POST /v1/audio/transcriptions`.** Where `SpeechRecognition` is missing we record
with `MediaRecorder` and post the clip to `/api/commentary/transcribe`. The recommended model
is now **`gpt-transcribe`** — the [speech-to-text
guide](https://developers.openai.com/docs/guides/speech-to-text) says *"Start with
`gpt-transcribe`. This is the recommended model for transcribing recorded speech in its
original language"* — which supersedes `gpt-4o-transcribe` / `gpt-4o-mini-transcribe`.
`whisper-1` is now narrowly scoped to word/segment timestamps and translation. Our route
tries `gpt-transcribe` and retries once with `whisper-1` if the key's account doesn't have the
newer model, so it works on older accounts too. Files are capped at 25 MB;
mp3/mp4/mpeg/mpga/m4a/wav/webm accepted — `MediaRecorder` gives us `webm`, which is on the list.

Both paths converge on the same text, which is matched against `robotNames()` from the
engine. If neither is available the UI degrades to the typed pickers, which are always present.

`gpt-live-transcribe` ($0.017/min) exists for true realtime transcription, but a hold-to-talk
button of a few seconds does not justify a session-based transport.

---

## Decision 4 — Next.js route handler details

Both audio routes set `runtime = 'nodejs'` and **`dynamic = 'force-dynamic'`**. The second one
matters more than it looks: without it, routes matching the prerender manifest are treated as
ISR and their response is **fully buffered**, which silently kills streaming. `Content-Type`
must match `response_format` (`mp3` → `audio/mpeg`), and we send `X-Content-Type-Options:
nosniff` plus `Cache-Control: no-store` — the audio is cached by us, in process, keyed by
content hash, not by any HTTP layer.

---

## Not verifiable from official docs

Recorded for honesty, since each one shaped a decision above:

1. The **SSE event payload schema** for `stream_format: 'sse'` is not published, and the Node
   SDK has no parser for it. → we use plain chunked bytes.
2. **`tts-1` / `tts-1-hd` pricing** — the TTS table has been removed from the pricing page.
3. The **4096-character vs 2000-token** input-limit conflict is never reconciled. → we cap at
   1800 characters.
4. Whether `instructions` **400s or is silently ignored** on `tts-1` is unstated. → we only
   ever send it with `gpt-4o-mini-tts`.
5. Any **quantitative latency/TTFB** figures for TTS or Realtime, and any OpenAI-authored
   comparison to the browser Web Speech API. The browser-support facts above come from MDN and
   caniuse, not from OpenAI.
