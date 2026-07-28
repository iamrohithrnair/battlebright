/**
 * POST /api/commentary/speak — synthesise one beat of commentary.
 *
 * Uses OpenAI's `gpt-4o-mini-tts` via POST /v1/audio/speech. The delivery of the
 * voice is steered per beat with the `instructions` parameter, which is why the
 * numbers segment sounds like an analyst and the clash sounds unhinged — same
 * voice, different direction. See src/lib/commentary/VOICE_NOTES.md.
 *
 * The SDK resolves to a standard web `Response`, so its body is a ReadableStream
 * we forward straight to the client (chunked transfer, audio starts playing
 * before synthesis finishes). We `tee()` it so the same bytes also land in an
 * in-process cache keyed by content hash — replaying a fight is then instant and
 * free.
 *
 * The API key never leaves this process.
 */
import { createHash } from 'node:crypto';

import { OpenAI } from 'openai';

import { describe } from '@/lib/commentary/generate';
import type { CommentaryErrorBody } from '@/lib/commentary/types';
import {
  DEFAULT_VOICE,
  MAX_SPEECH_CHARS,
  TTS_MODEL,
  VOICES,
  deliveryFor,
  isKnownVoice,
} from '@/lib/commentary/voice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * MP3 keeps the payload small enough to hold in memory and plays from an
 * <audio> element everywhere. `wav`/`pcm` shave decode latency but cost ~10x the
 * bytes, which matters more over a venue network.
 */
const RESPONSE_FORMAT = 'mp3';
const CONTENT_TYPE = 'audio/mpeg';

/** Roughly 300 beats of audio. Plenty for a demo, bounded for a long-lived process. */
const CACHE_MAX_BYTES = 48 * 1024 * 1024;
const CACHE_MAX_ENTRIES = 300;

const cache = new Map<string, Buffer>();
let cacheBytes = 0;

function remember(key: string, audio: Buffer) {
  if (cache.has(key)) return;
  cache.set(key, audio);
  cacheBytes += audio.byteLength;
  // Map preserves insertion order, so the first key is the oldest.
  while ((cacheBytes > CACHE_MAX_BYTES || cache.size > CACHE_MAX_ENTRIES) && cache.size > 1) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cacheBytes -= cache.get(oldest)?.byteLength ?? 0;
    cache.delete(oldest);
  }
}

const ttsModel = () => process.env.OPENAI_TTS_MODEL?.trim() || TTS_MODEL;

/** Readiness probe: lets the booth disable the audio UI before the user presses play. */
export function GET() {
  return Response.json(
    {
      ok: true,
      configured: Boolean(process.env.OPENAI_API_KEY),
      model: ttsModel(),
      format: RESPONSE_FORMAT,
      voices: VOICES,
      cached_clips: cache.size,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  let text: string;
  let voice: string;
  let beat: string;

  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null) throw new Error('Request body must be a JSON object.');
    const raw = body as Record<string, unknown>;

    if (typeof raw.text !== 'string' || !raw.text.trim()) throw new Error('`text` is required.');
    text = raw.text.trim();
    voice = typeof raw.voice === 'string' && isKnownVoice(raw.voice) ? raw.voice : DEFAULT_VOICE;
    beat = typeof raw.beat === 'string' ? raw.beat : 'tale_of_the_tape';
  } catch (e) {
    return fail('bad_request', (e as Error).message, 400);
  }

  if (text.length > MAX_SPEECH_CHARS) {
    return fail(
      'text_too_long',
      `Text is ${text.length} characters; the cap is ${MAX_SPEECH_CHARS}. Split it across beats.`,
      413,
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fail(
      'no_api_key',
      'OPENAI_API_KEY is not configured on the server, so voice synthesis is offline. The written transcript still works.',
      503,
    );
  }

  const model = ttsModel();
  const instructions = deliveryFor(beat);
  const key = createHash('sha256')
    .update(`${model}\u0000${voice}\u0000${beat}\u0000${text}`)
    .digest('hex');

  const hit = cache.get(key);
  if (hit) {
    return new Response(new Uint8Array(hit), { headers: audioHeaders(hit.byteLength, voice, beat, true) });
  }

  try {
    const client = new OpenAI({ apiKey, maxRetries: 1 });
    const speech = await synthesise(client, model, voice, text, instructions, request.signal);

    if (!speech.body) {
      // No stream available: fall back to buffering the whole clip.
      const audio = Buffer.from(await speech.arrayBuffer());
      remember(key, audio);
      return new Response(new Uint8Array(audio), {
        headers: audioHeaders(audio.byteLength, voice, beat, false),
      });
    }

    // One branch to the client, one into the cache, from the same bytes.
    const [toClient, toCache] = speech.body.tee();
    void collect(toCache)
      .then((audio) => remember(key, audio))
      .catch(() => {
        // A failed cache fill is not worth surfacing; the client already has the audio.
      });

    return new Response(toClient, { headers: audioHeaders(null, voice, beat, false) });
  } catch (e) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    const status = (e as { status?: number }).status;
    if (status === 401) return fail('no_api_key', 'The AI provider rejected the API key.', 502);
    if (status === 429) {
      return fail('rate_limited', 'Voice synthesis is rate-limited. Try again in a moment.', 429);
    }
    if (isModelAccessError(e)) {
      // A valid key whose project simply has no TTS entitlement. Distinct from a
      // broken key, and the booth uses this to switch to transcript-only mode.
      return fail(
        'no_model_access',
        'This OpenAI project has no access to a text-to-speech model, so the commentary cannot be spoken. The written transcript is fully available.',
        503,
      );
    }
    return fail('upstream', `Voice synthesis failed: ${describe(e)}`, 502);
  }
}

const isModelAccessError = (e: unknown): boolean => {
  const status = (e as { status?: number }).status;
  const message = e instanceof Error ? e.message : '';
  return (
    status === 403 ||
    status === 404 ||
    /does not (?:have access to|exist)|model_not_found|unsupported_model/i.test(message)
  );
};

/**
 * `gpt-4o-mini-tts` is the model we want: it is the only family that supports
 * `instructions`, which is the whole point. `tts-1` is a last resort for keys
 * scoped without it — it loses per-beat delivery steering, so the voice sounds
 * flat, but a flat call beats silence.
 */
async function synthesise(
  client: OpenAI,
  preferred: string,
  voice: string,
  input: string,
  instructions: string,
  signal: AbortSignal,
): Promise<Response> {
  const candidates = preferred === TTS_MODEL ? [TTS_MODEL, 'tts-1'] : [preferred];
  let last: unknown;

  for (const model of candidates) {
    try {
      return await client.audio.speech.create(
        {
          model,
          voice,
          input,
          // The delivery-steering parameter. Supported only on the
          // gpt-4o-mini-tts family — never send it to tts-1.
          ...(model.startsWith('gpt-4o-mini-tts') ? { instructions } : {}),
          response_format: RESPONSE_FORMAT,
        },
        { signal },
      );
    } catch (e) {
      last = e;
      if (!isModelAccessError(e)) throw e;
    }
  }
  throw last ?? new Error('No reachable text-to-speech model.');
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function audioHeaders(bytes: number | null, voice: string, beat: string, cached: boolean) {
  const headers: Record<string, string> = {
    'Content-Type': CONTENT_TYPE,
    'Cache-Control': 'no-store',
    // Partial bodies must not be MIME-sniffed.
    'X-Content-Type-Options': 'nosniff',
    'X-Commentary-Voice': voice,
    'X-Commentary-Beat': beat,
    'X-Commentary-Cached': cached ? '1' : '0',
  };
  if (bytes !== null) headers['Content-Length'] = String(bytes);
  return headers;
}

function fail(code: CommentaryErrorBody['code'], message: string, status: number) {
  const body: CommentaryErrorBody = { error: code, code, message };
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
