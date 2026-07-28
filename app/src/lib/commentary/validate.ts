/**
 * Fact-checking the generated script.
 *
 * The model is told not to invent statistics; this module verifies it didn't.
 * Every figure spoken in a beat — whether written "72" or "seventy-two" — is
 * extracted and reconciled against the numbers on the fact sheet. Anything that
 * doesn't reconcile is either repaired by a second model pass or, failing that,
 * flagged so the UI can warn the audience rather than quietly lying to them.
 *
 * Also handles deterministic cleanup: markdown, emoji, snake_case identifiers
 * and bare numerals are all fixed here without spending a model call.
 */
import { extractFigures, numberToWords } from './speech';
import { BEAT_IDS, BEAT_LABELS, type BeatId, type CommentaryBeat, type FactSheet } from './types';

/**
 * Rounding slack. A sheet value of 68.4 may honestly be spoken as
 * "sixty-eight percent", so anything within half a point reconciles.
 */
const TOLERANCE = 0.51;

/**
 * Counting words are unavoidable in natural speech — "these two machines",
 * "one more time" — and cannot be distinguished from statistics by extraction
 * alone. Small integers are therefore allowed through. It is a deliberate,
 * documented hole: anything that could plausibly be a *statistic* is ≥ 4.
 */
const COUNTING_ALLOWANCE = new Set([0, 1, 2, 3]);

/* --------------------------------------------------------------- sanitising */

const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu;

/**
 * Force text into something safe to speak. Runs before validation so the
 * validator sees the same words the voice will.
 */
export function cleanSpokenText(raw: string): string {
  return (
    raw
      // Markdown emphasis, headings, code fences, list bullets.
      .replace(/[*`#>]+/g, ' ')
      .replace(/^\s*[-–—•]\s+/gm, '')
      .replace(EMOJI, '')
      // snake_case identifiers must never be read aloud.
      .replace(/([a-z])_([a-z])/gi, '$1 $2')
      .replace(/_/g, ' ')
      // Bare numerals -> spoken words, so the voice never says "seventy two percent sign".
      .replace(/(\d+(?:\.\d+)?)\s*%/g, (_, n: string) => `${numberToWords(Number(n))} percent`)
      .replace(/\b(\d+)\s*(?:lb|lbs|pounds)\b/gi, (_, n: string) => `${numberToWords(Number(n))} pounds`)
      // Records like "6-2" read as a range otherwise.
      .replace(
        /\b(\d{1,2})\s*[-–]\s*(\d{1,2})\b/g,
        (_, w: string, l: string) => `${numberToWords(Number(w))} and ${numberToWords(Number(l))}`,
      )
      .replace(/\bvs\.?\b/gi, 'versus')
      .replace(/\bKO\b/g, 'knockout')
      .replace(/#\s*(\d+)/g, (_, n: string) => `number ${numberToWords(Number(n))}`)
      // Parentheticals are stage directions to the ear; unwrap them.
      .replace(/[()[\]]/g, ' ')
      .replace(/\s+([,.!?;:])/g, '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .trim()
  );
}

/* --------------------------------------------------------------- reconciling */

/**
 * Every number the caller is permitted to say, harvested from the fact sheet:
 * explicit numeric values plus any digits embedded in display or spoken forms
 * (records, season lists, spreads).
 */
export function allowedValues(sheet: FactSheet): Set<number> {
  const allowed = new Set<number>(COUNTING_ALLOWANCE);

  const offer = (n: number) => {
    if (!Number.isFinite(n)) return;
    allowed.add(n);
    allowed.add(Math.round(n));
    allowed.add(Math.floor(n));
    allowed.add(Math.ceil(n));
  };

  for (const fact of Object.values(sheet.facts)) {
    if (fact.value !== null) offer(fact.value);
    for (const source of [fact.display, fact.spoken]) {
      for (const m of source.matchAll(/\d+(?:\.\d+)?/g)) offer(Number(m[0]));
    }
  }

  // Seasons and weights mentioned in the live wiki text are legitimate context.
  for (const robot of [sheet.robot_a, sheet.robot_b]) {
    for (const season of robot.live?.seasons ?? []) offer(Number(season));
    if (robot.live?.weight_lb) offer(robot.live.weight_lb);
  }

  return allowed;
}

const reconciles = (value: number, allowed: Set<number>): boolean => {
  if (allowed.has(value)) return true;
  for (const candidate of allowed) {
    if (Math.abs(candidate - value) <= TOLERANCE) return true;
  }
  return false;
};

export interface BeatCheck {
  /** Figures spoken that reconcile against the sheet. */
  reconciled: number;
  /** Raw substrings that do not reconcile — the repair prompt quotes these. */
  offending: string[];
  /** `facts_used` entries pointing at ids that do not exist on the sheet. */
  unknownIds: string[];
}

export function checkBeat(
  beat: { text: string; facts_used: string[] },
  sheet: FactSheet,
  allowed = allowedValues(sheet),
): BeatCheck {
  let reconciled = 0;
  const offending: string[] = [];
  const seen = new Set<string>();

  for (const figure of extractFigures(beat.text)) {
    if (reconciles(figure.value, allowed)) {
      reconciled++;
    } else if (!seen.has(figure.raw)) {
      seen.add(figure.raw);
      offending.push(figure.raw);
    }
  }

  const unknownIds = beat.facts_used.filter((id) => !(id in sheet.facts));

  return { reconciled, offending, unknownIds };
}

/* --------------------------------------------------------------- structure */

/**
 * Coerce whatever the model returned into exactly the six expected beats in
 * order, cleaning text and clamping durations. Missing beats are reported so the
 * caller can decide whether to fill them deterministically.
 */
export function normaliseBeats(raw: unknown): { beats: CommentaryBeat[]; missing: BeatId[] } {
  const list = Array.isArray((raw as { beats?: unknown })?.beats)
    ? ((raw as { beats: unknown[] }).beats)
    : [];

  const byId = new Map<BeatId, CommentaryBeat>();
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const { id, text, duration_hint_ms, facts_used } = item as Record<string, unknown>;
    if (typeof id !== 'string' || !BEAT_IDS.includes(id as BeatId)) continue;
    if (typeof text !== 'string' || !text.trim()) continue;

    const cleaned = cleanSpokenText(text);
    byId.set(id as BeatId, {
      id: id as BeatId,
      label: BEAT_LABELS[id as BeatId],
      text: cleaned,
      duration_hint_ms: clampDuration(duration_hint_ms, cleaned),
      facts_used: Array.isArray(facts_used)
        ? [...new Set(facts_used.filter((f): f is string => typeof f === 'string' && Boolean(f)))]
        : [],
    });
  }

  const missing = BEAT_IDS.filter((id) => !byId.has(id));
  const beats = BEAT_IDS.map((id) => byId.get(id)).filter(Boolean) as CommentaryBeat[];
  return { beats, missing };
}

/**
 * Trust the model's estimate only within reason; otherwise derive from word
 * count at broadcast pace. The UI uses this to advance the transcript when
 * audio is unavailable, so a wild value would strand the reader.
 */
export function clampDuration(hint: unknown, text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  const derived = Math.round(words * 380) + 500;
  const value = typeof hint === 'number' && Number.isFinite(hint) ? hint : derived;
  // Reject hints that disagree with the word count by more than 2.5x.
  const plausible = value >= derived / 2.5 && value <= derived * 2.5 ? value : derived;
  return Math.min(20_000, Math.max(3000, Math.round(plausible)));
}
