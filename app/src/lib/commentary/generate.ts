/**
 * Script generation — SERVER ONLY.
 *
 * Fact sheet in, fact-checked beats out. The pipeline is deliberately paranoid:
 *
 *   1. Ask the model for beats under a strict JSON schema (never parse prose).
 *   2. Normalise: fixed beat order, cleaned speech text, clamped durations.
 *   3. Reconcile every spoken figure against the fact sheet.
 *   4. Re-prompt the model to repair any beat that failed — once.
 *   5. Anything still unreconciled is FLAGGED, not hidden, and the UI says so.
 *
 * At no point can a failure here take the broadcast down: every error path lands
 * on the deterministic fallback script.
 */
import { OpenAI } from 'openai';

import { buildFallbackScript } from './fallback';
import { SCRIPT_SCHEMA, SYSTEM_PROMPT, buildRepairPrompt, buildUserPrompt } from './prompt';
import { BEAT_IDS, type CommentaryBeat, type FactSheet, type ValidationReport } from './types';
import { allowedValues, checkBeat, normaliseBeats } from './validate';

const DEFAULT_MODEL = 'gpt-4o-mini';

/** Bound on repair round-trips, so a stubborn model cannot stall the demo. */
const MAX_REPAIRS = 2;

export class CommentaryConfigError extends Error {}

/**
 * Deliberately NOT `OPENAI_MODEL`: that variable is shared with the analyst
 * stream, and this route depends on strict structured outputs.
 */
export const commentaryModel = () => process.env.OPENAI_COMMENTARY_MODEL?.trim() || DEFAULT_MODEL;

export interface GenerateResult {
  beats: CommentaryBeat[];
  validation: ValidationReport;
  model: string;
  synthetic: boolean;
}

interface GenerateOptions {
  signal?: AbortSignal;
}

export async function generateScript(
  sheet: FactSheet,
  { signal }: GenerateOptions = {},
): Promise<GenerateResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return deterministic(sheet, 'OPENAI_API_KEY is not set, so the script was built deterministically from the fact sheet.');
  }

  const client = new OpenAI({ apiKey, maxRetries: 1 });
  const model = commentaryModel();
  const notes: string[] = [];

  let raw: unknown;
  try {
    raw = await callModel(client, model, buildUserPrompt(sheet), signal);
  } catch (e) {
    if (isAbort(e)) throw e;
    return deterministic(sheet, `The language model was unavailable (${describe(e)}), so the script was built deterministically from the fact sheet.`);
  }

  const { beats, missing } = normaliseBeats(raw);
  if (missing.length) {
    // Patch holes from the deterministic script rather than shipping a short call.
    const filler = new Map(buildFallbackScript(sheet).map((b) => [b.id, b]));
    for (const id of missing) {
      const replacement = filler.get(id);
      if (replacement) beats.push(replacement);
    }
    beats.sort((x, y) => BEAT_IDS.indexOf(x.id) - BEAT_IDS.indexOf(y.id));
    notes.push(`The model omitted ${missing.join(', ')}; those beats were filled from the deterministic script.`);
  }

  /* ---- fact-check, then repair ---- */

  const allowed = allowedValues(sheet);
  const validation: ValidationReport = {
    ok: true,
    reconciled: 0,
    unreconciled: [],
    unknown_fact_ids: [],
    repairs: 0,
    notes,
  };

  for (const b of beats) {
    let check = checkBeat(b, sheet, allowed);

    if (check.offending.length && validation.repairs < MAX_REPAIRS) {
      validation.repairs++;
      try {
        const repaired = await callModel(
          client,
          model,
          buildRepairPrompt(sheet, b, check.offending),
          signal,
        );
        const { beats: fixed } = normaliseBeats(repaired);
        const replacement = fixed.find((x) => x.id === b.id);
        if (replacement) {
          const recheck = checkBeat(replacement, sheet, allowed);
          // Only accept the rewrite if it is genuinely cleaner.
          if (recheck.offending.length < check.offending.length) {
            b.text = replacement.text;
            b.duration_hint_ms = replacement.duration_hint_ms;
            b.facts_used = replacement.facts_used.length ? replacement.facts_used : b.facts_used;
            check = recheck;
            notes.push(`Repaired unsupported figures in the ${b.id} beat.`);
          }
        }
      } catch (e) {
        if (isAbort(e)) throw e;
        notes.push(`Repair pass for the ${b.id} beat failed: ${describe(e)}`);
      }
    }

    validation.reconciled += check.reconciled;

    if (check.offending.length) {
      b.flagged = true;
      b.flag_reason = `Could not reconcile ${check.offending.map((f) => `"${f}"`).join(', ')} against the fact sheet.`;
      for (const figure of check.offending) {
        validation.unreconciled.push({ beat: b.id, figure, text: b.text });
      }
    }

    for (const id of check.unknownIds) {
      validation.unknown_fact_ids.push({ beat: b.id, id });
    }
    // Citations are an audit trail; a dangling id would be a false claim of proof.
    b.facts_used = b.facts_used.filter((id) => id in sheet.facts);
  }

  validation.ok = validation.unreconciled.length === 0;
  if (!validation.ok) {
    notes.push(
      'Beats with unreconciled figures are flagged in the transcript so the audience can see which claims are unverified.',
    );
  }

  return { beats, validation, model, synthetic: false };
}

/* ------------------------------------------------------------------- model */

async function callModel(
  client: OpenAI,
  model: string,
  userPrompt: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const completion = await client.chat.completions.create(
    {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      // Structured output: the shape is guaranteed, so there is no prose to parse.
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'commentary_script', strict: true, schema: SCRIPT_SCHEMA },
      },
      // Enough warmth to sound like a broadcaster, not enough to get creative
      // with the numbers.
      temperature: 0.7,
      max_tokens: 1600,
    },
    { signal },
  );

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('The model returned an empty script.');
  return JSON.parse(content);
}

/* ---------------------------------------------------------------- fallback */

function deterministic(sheet: FactSheet, note: string): GenerateResult {
  const beats = buildFallbackScript(sheet);
  const allowed = allowedValues(sheet);

  const validation: ValidationReport = {
    ok: true,
    reconciled: 0,
    unreconciled: [],
    unknown_fact_ids: [],
    repairs: 0,
    notes: [note],
  };

  // Templated text is fact-checked by construction, but run it anyway: this is
  // also a regression test on the extractor itself.
  for (const b of beats) {
    const check = checkBeat(b, sheet, allowed);
    validation.reconciled += check.reconciled;
    for (const figure of check.offending) {
      validation.unreconciled.push({ beat: b.id, figure, text: b.text });
    }
  }
  validation.ok = validation.unreconciled.length === 0;

  return { beats, validation, model: 'deterministic', synthetic: true };
}

const isAbort = (e: unknown) =>
  e instanceof Error && (e.name === 'AbortError' || e.name === 'APIUserAbortError');

/** Enough detail to debug, never enough to leak a key. */
export function describe(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  const status = (e as { status?: number }).status;
  if (status === 401) return 'the API key was rejected';
  if (status === 429) return 'the provider is rate-limiting this key';
  if (status && status >= 500) return 'the provider is temporarily unavailable';
  return message.replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***').slice(0, 200);
}
