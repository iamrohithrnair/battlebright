/**
 * POST /api/commentary/script — build a fact-checked commentary script.
 *
 * Two stages, both server-side: assemble a fact sheet (prediction engine + a
 * live Bright Data unlock of each bot's wiki page), then have a language model
 * turn it into beats under a strict JSON schema and reconcile every spoken
 * figure back against the sheet.
 *
 * The response always includes the fact sheet and the validation report, so the
 * booth can prove on screen where each claim came from.
 *
 * This route never 500s on a degraded dependency. Bright Data down means an
 * engine-only sheet; OpenAI down means the deterministic script. Only a bad
 * request or an unknown robot is an error.
 */
import { UnknownRobotError, buildFactSheet } from '@/lib/commentary/factsheet';
import { commentaryModel, generateScript } from '@/lib/commentary/generate';
import type { CommentaryErrorBody, CommentaryScript } from '@/lib/commentary/types';
import { robotNames } from '@/lib/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Readiness probe for the booth's empty state. */
export function GET() {
  return Response.json(
    {
      ok: true,
      configured: Boolean(process.env.OPENAI_API_KEY),
      model: commentaryModel(),
      bright_data: Boolean(process.env.BRIGHT_API_KEY ?? process.env.BRIGHTDATA_API_KEY),
      robots: robotNames().length,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  let robotA: string;
  let robotB: string;
  let skipLive = false;

  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null) throw new Error('Request body must be a JSON object.');
    const { robot_a, robot_b, skip_live } = body as Record<string, unknown>;
    if (typeof robot_a !== 'string' || !robot_a.trim()) throw new Error('`robot_a` is required.');
    if (typeof robot_b !== 'string' || !robot_b.trim()) throw new Error('`robot_b` is required.');
    robotA = robot_a.trim();
    robotB = robot_b.trim();
    skipLive = skip_live === true;
  } catch (e) {
    return fail('bad_request', (e as Error).message, 400);
  }

  if (robotA === robotB) {
    return fail('bad_request', 'Pick two different machines — a bot cannot fight itself.', 400);
  }

  const started = Date.now();

  try {
    const sheet = await buildFactSheet(robotA, robotB, { skipLive });
    const { beats, validation, model, synthetic } = await generateScript(sheet, {
      signal: request.signal,
    });

    const payload: CommentaryScript = {
      robot_a: robotA,
      robot_b: robotB,
      beats,
      fact_sheet: sheet,
      validation,
      model,
      generated_at: new Date().toISOString(),
      generation_ms: Date.now() - started,
      synthetic,
    };

    return Response.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof UnknownRobotError) {
      return fail('unknown_robot', `"${e.robot}" is not in the roster.`, 404);
    }
    if (request.signal.aborted) {
      // Client navigated away mid-generation; not a failure worth reporting.
      return new Response(null, { status: 499 });
    }
    return fail('upstream', (e as Error).message.slice(0, 300), 502);
  }
}

function fail(code: CommentaryErrorBody['code'], message: string, status: number) {
  const body: CommentaryErrorBody = { error: code, code, message };
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
