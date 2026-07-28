/**
 * Types for the voice commentary feature.
 *
 * Safe to import from client components — no server-only dependencies.
 */
import type { Confidence, Prediction, Provenance, WeaponType } from '@/lib/types';

/** The fight choreography. Beats are always generated and played in this order. */
export const BEAT_IDS = [
  'intro',
  'tale_of_the_tape',
  'prediction',
  'clash',
  'finish',
  'verdict',
] as const;

export type BeatId = (typeof BEAT_IDS)[number];

export const BEAT_LABELS: Record<BeatId, string> = {
  intro: 'Introductions',
  tale_of_the_tape: 'Tale of the Tape',
  prediction: 'The Call',
  clash: 'First Contact',
  finish: 'The Finish',
  verdict: 'Verdict',
};

/* ------------------------------------------------------------------- facts */

/**
 * One atomic, citable data point. The model is given this table and may only
 * speak numbers that appear in it; `facts_used` on each beat references these
 * ids, which is what makes the commentary auditable.
 */
export interface Fact {
  id: string;
  label: string;
  /** Speech-ready rendering, e.g. "sixty-eight point four percent". */
  spoken: string;
  /** Display rendering for the grounding panel, e.g. "68.4%". */
  display: string;
  /** Raw number when the fact is numeric — the validator reconciles against these. */
  value: number | null;
  source: 'engine' | 'roster' | 'simulation' | 'bright_data';
}

/** How much of the fact sheet came from a live web fetch. */
export type GroundingLevel = 'live' | 'cached' | 'partial' | 'fallback';

/** Fresh web detail for one bot, pulled through Bright Data. */
export interface LiveRobotFacts {
  builder: string | null;
  team: string | null;
  country: string | null;
  weight_lb: number | null;
  seasons: string[];
  excerpt: string | null;
  source_url: string;
}

export interface FactSheetRobot {
  robot: string;
  weapon_type: WeaponType;
  weapon_label: string;
  weapon_short: string;
  weapon_blurb: string;
  weight_lb: number;
  wins: number;
  losses: number;
  ko_wins: number;
  win_rate: number;
  ko_rate: number;
  rank: number | null;
  builder: string;
  country: string;
  /** Three most recent bouts from the bundled match history. */
  recent_form: { season: number; opponent: string; result: 'Win' | 'Loss'; method: 'KO' | 'JD' }[];
  /** Null when Bright Data was unavailable for this bot. */
  live: LiveRobotFacts | null;
}

/** The single dominant weighted signal behind the model's call. */
export interface DominantSignal {
  label: string;
  leader: string;
  /** Absolute difference in weighted contribution between the two bots. */
  margin: number;
}

export interface FactSheet {
  robot_a: FactSheetRobot;
  robot_b: FactSheetRobot;
  prediction: Prediction;
  simulation: {
    trials: number;
    prob_a: number;
    prob_b: number;
    ko_share: number;
    /** Central 90% of the Monte Carlo distribution, as percentage points. */
    spread_low: number;
    spread_high: number;
  };
  weapon_matchup: {
    edge_a: number;
    edge_b: number;
    favours: string | null;
    description: string;
  };
  dominant_signal: DominantSignal;
  /** One entry per Bright Data fetch attempted, in request order. */
  provenance: Provenance[];
  grounding: GroundingLevel;
  /** Human-readable explanation when grounding is not fully live. */
  degraded_reason: string | null;
  /** The canonical citable fact table, keyed by fact id. */
  facts: Record<string, Fact>;
  built_at: string;
  build_ms: number;
}

/* ------------------------------------------------------------------- script */

export interface CommentaryBeat {
  id: BeatId;
  label: string;
  text: string;
  duration_hint_ms: number;
  /** Fact ids from `FactSheet.facts` that this beat cites. */
  facts_used: string[];
  /** Set when a figure in the text could not be reconciled against the sheet. */
  flagged?: boolean;
  flag_reason?: string;
}

/** Outcome of cross-checking generated text against the fact sheet. */
export interface ValidationReport {
  ok: boolean;
  /** Numbers spoken that reconcile against a fact-sheet value. */
  reconciled: number;
  /** Numbers spoken that do NOT appear anywhere in the fact sheet. */
  unreconciled: { beat: BeatId; figure: string; text: string }[];
  /** `facts_used` entries referencing ids that do not exist. */
  unknown_fact_ids: { beat: BeatId; id: string }[];
  /** How many repair passes were needed. */
  repairs: number;
  notes: string[];
}

export interface CommentaryScript {
  robot_a: string;
  robot_b: string;
  beats: CommentaryBeat[];
  fact_sheet: FactSheet;
  validation: ValidationReport;
  model: string;
  generated_at: string;
  generation_ms: number;
  /** True when the model was unavailable and beats were built deterministically. */
  synthetic: boolean;
}

export interface CommentaryErrorBody {
  error: string;
  code:
    | 'bad_request'
    | 'unknown_robot'
    | 'no_api_key'
    /** The key is valid but its project has no entitlement to the model. */
    | 'no_model_access'
    | 'upstream'
    | 'text_too_long'
    | 'rate_limited';
  message: string;
}

export type { Confidence, Prediction, Provenance };
