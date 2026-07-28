/**
 * POST /api/analyst — the analyst's streaming endpoint.
 *
 * Responds with an NDJSON event stream (see `src/lib/analyst/protocol.ts`).
 * Nothing here is cached: every answer is a fresh agent run, and the OpenAI key
 * never leaves this process.
 */
import { AnalystConfigError, analystModel, runAnalyst } from '@/lib/analyst/agent';
import {
  MAX_HISTORY_TURNS,
  encodeEvent,
  type AnalystErrorCode,
  type AnalystEvent,
  type ChatTurn,
} from '@/lib/analyst/protocol';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET is a cheap readiness probe for the UI's empty state. */
export function GET() {
  return Response.json(
    { ok: true, configured: Boolean(process.env.OPENAI_API_KEY), model: analystModel() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  let messages: ChatTurn[];
  try {
    messages = parseBody(await request.json());
  } catch (e) {
    return errorResponse('bad_request', (e as Error).message, 400);
  }

  if (!process.env.OPENAI_API_KEY) {
    return errorResponse(
      'no_api_key',
      'OPENAI_API_KEY is not configured on the server, so the analyst is offline. The rest of the engine still works.',
      503,
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AnalystEvent) => {
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          // The client hung up mid-write; the abort handler below tears down.
        }
      };

      try {
        for await (const event of runAnalyst({ messages, signal: request.signal })) {
          send(event);
        }
      } catch (e) {
        if (request.signal.aborted || isAbort(e)) {
          // Client pressed Stop — a normal end, not a failure.
        } else if (e instanceof AnalystConfigError) {
          send({ type: 'error', code: 'no_api_key', message: e.message });
        } else {
          send({ type: 'error', code: 'upstream', message: describe(e) });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      // Stops proxies from buffering the stream into one lump.
      'X-Accel-Buffering': 'no',
    },
  });
}

function parseBody(body: unknown): ChatTurn[] {
  if (typeof body !== 'object' || body === null) throw new Error('Request body must be a JSON object.');
  const raw = (body as { messages?: unknown }).messages;
  if (!Array.isArray(raw) || !raw.length) throw new Error('`messages` must be a non-empty array.');
  if (raw.length > 100) throw new Error('`messages` is too long.');

  const messages: ChatTurn[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) throw new Error('Each message must be an object.');
    const { role, content } = item as { role?: unknown; content?: unknown };
    if (role !== 'user' && role !== 'assistant') throw new Error('Message role must be "user" or "assistant".');
    if (typeof content !== 'string') throw new Error('Message content must be a string.');
    if (role === 'user' && !content.trim()) continue;
    messages.push({ role, content });
  }

  if (!messages.length) throw new Error('No usable messages in the request.');
  if (messages[messages.length - 1].role !== 'user') throw new Error('The last message must be from the user.');
  return messages.slice(-MAX_HISTORY_TURNS);
}

const isAbort = (e: unknown) =>
  e instanceof Error && (e.name === 'AbortError' || e.name === 'APIUserAbortError');

/** Surface enough detail to debug without leaking keys or internals. */
function describe(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  const status = (e as { status?: number }).status;
  if (status === 401) return 'The AI provider rejected the API key.';
  if (status === 429) return 'The AI provider is rate-limiting this key. Wait a moment and retry.';
  if (status && status >= 500) return 'The AI provider is unavailable. Try again shortly.';
  return message.replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***').slice(0, 300);
}

function errorResponse(code: AnalystErrorCode, message: string, status: number) {
  return new Response(encodeEvent({ type: 'error', code, message }), {
    status,
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
