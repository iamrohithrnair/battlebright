/**
 * POST /api/commentary/transcribe — fallback speech-to-text for voice input.
 *
 * The booth prefers the browser's own `SpeechRecognition`: it streams interim
 * results with no round-trip of ours and costs nothing. But Firefox still ships
 * it disabled by default and Safari's support is partial, so this route is the
 * safety net — the client records with MediaRecorder and posts the clip here.
 *
 * Model choice: `gpt-transcribe` is the currently recommended transcription
 * model. Accounts that don't have it fall back to `whisper-1`, which every key
 * can reach. See src/lib/commentary/VOICE_NOTES.md.
 *
 * Expects multipart/form-data with an `audio` file field.
 */
import { OpenAI } from 'openai';

import { describe } from '@/lib/commentary/generate';
import type { CommentaryErrorBody } from '@/lib/commentary/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const PRIMARY_MODEL = 'gpt-transcribe';
const FALLBACK_MODEL = 'whisper-1';

/** Hold-to-talk clips are seconds long; the API cap is 25 MB. */
const MAX_BYTES = 8 * 1024 * 1024;

export function GET() {
  return Response.json(
    { ok: true, configured: Boolean(process.env.OPENAI_API_KEY), model: PRIMARY_MODEL },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fail(
      'no_api_key',
      'OPENAI_API_KEY is not configured, so voice input is offline. Use the pickers instead.',
      503,
    );
  }

  let file: File;
  try {
    const form = await request.formData();
    const audio = form.get('audio');
    if (!(audio instanceof File)) throw new Error('Expected an `audio` file field.');
    if (!audio.size) throw new Error('The recording was empty.');
    if (audio.size > MAX_BYTES) throw new Error('The recording is too long. Keep it under a few seconds.');
    file = audio;
  } catch (e) {
    return fail('bad_request', (e as Error).message, 400);
  }

  const client = new OpenAI({ apiKey, maxRetries: 1 });

  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    try {
      const result = await client.audio.transcriptions.create(
        { file, model, response_format: 'json' },
        { signal: request.signal },
      );
      return Response.json(
        { text: result.text ?? '', model },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    } catch (e) {
      if (request.signal.aborted) return new Response(null, { status: 499 });
      const status = (e as { status?: number }).status;
      // 404 / 400 here usually means this key cannot reach that model — try the next.
      const retryable = model === PRIMARY_MODEL && (status === 404 || status === 400);
      if (!retryable) {
        if (status === 401) return fail('no_api_key', 'The AI provider rejected the API key.', 502);
        if (status === 429) return fail('rate_limited', 'Transcription is rate-limited. Try again shortly.', 429);
        return fail('upstream', `Transcription failed: ${describe(e)}`, 502);
      }
    }
  }

  return fail('upstream', 'No transcription model was available for this API key.', 502);
}

function fail(code: CommentaryErrorBody['code'], message: string, status: number) {
  const body: CommentaryErrorBody = { error: code, code, message };
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
