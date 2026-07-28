/**
 * Fact sheet assembly — SERVER ONLY (imports the Bright Data client).
 *
 * Nothing is written before this runs. The sheet is the *only* source the
 * caller is allowed to draw numbers from, and every entry in `facts` carries an
 * id, a display form and a speech form. The model cites ids in `facts_used`;
 * the validator reconciles spoken figures back against `value`. That loop is
 * what stops the commentary inventing a statistic.
 *
 * Two sources feed it:
 *   1. The prediction engine — records, rates, weapon edge, probabilities,
 *      weighted contributions and the Monte Carlo spread.
 *   2. Bright Data Web Unlocker — a live fetch of each bot's wiki page for
 *      team, builder, seasons and real-world context the bundled CSV lacks.
 *
 * Bright Data failing is never fatal. The sheet degrades to engine-only facts
 * and says so, because the commentary cannot die on stage.
 */
import { BrightDataError, parseRobotPage, unlock, wikiUrl, zoneName } from '@/lib/brightdata';
import { WEAPON_INFO } from '@/lib/data/roster';
import { predict, robotDetail, simulate, weaponEdge, WEIGHTS } from '@/lib/engine';
import type { Provenance } from '@/lib/types';

import {
  integerToWords,
  numberToWords,
  percentToWords,
  recordToWords,
  weaponToWords,
} from './speech';
import type {
  DominantSignal,
  Fact,
  FactSheet,
  FactSheetRobot,
  GroundingLevel,
  LiveRobotFacts,
} from './types';

/**
 * A slow unlock must not hold the broadcast, but the ceiling has to be generous:
 * measured unlocks of these wiki pages range from ~2 s to ~20 s depending on how
 * hard the origin is fighting back. Past this we go engine-only.
 */
const UNLOCK_TIMEOUT_MS = 26_000;

export class UnknownRobotError extends Error {
  constructor(readonly robot: string) {
    super(`"${robot}" is not in the roster.`);
    this.name = 'UnknownRobotError';
  }
}

/* ------------------------------------------------------------- bright data */

interface LiveResult {
  live: LiveRobotFacts | null;
  provenance: Provenance;
  error: string | null;
}

/**
 * Wiki infobox scraping is best-effort by nature: the shared parser sometimes
 * returns a slab of the page's inline JavaScript or a stray sentence instead of
 * a value. That is fine for the intel console, which shows raw findings, but
 * this text may be *spoken*, so anything that doesn't look like a human-written
 * label is dropped rather than read out.
 *
 * Rejecting a good value costs us one nice detail. Accepting a bad one puts
 * `continent:\`XX\`}}let t=f(\`Geo\`)` in the commentator's mouth on stage.
 */
function cleanLiveValue(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.replace(/\s+/g, ' ').trim();

  if (value.length < 2 || value.length > 60) return null;
  // Code-ish punctuation, quotes, or a sentence fragment rather than a label.
  if (/[{}`;=<>|\\"]|=>|\blet\b|\bvar\b|\bfunction\b/.test(value)) return null;
  if (/[.!?]\s|[.!?]$/.test(value)) return null;
  if (value.split(' ').length > 8) return null;
  // Must contain real words, not just symbols and digits.
  if (!/[A-Za-z]{2}/.test(value)) return null;

  return value;
}

/**
 * The parser returns season numbers and calendar years mixed together in
 * discovery order. Sort them into something a caller can read out sensibly.
 */
function tidySeasons(seasons: string[]): string[] {
  const numbers = new Set<number>();
  const years = new Set<number>();
  for (const s of seasons) {
    const n = Number(s);
    if (!Number.isFinite(n)) continue;
    if (n >= 1 && n <= 12) numbers.add(n);
    else if (n >= 2000 && n <= 2030) years.add(n);
  }
  return [
    ...[...numbers].sort((a, b) => a - b).map((n) => `Season ${n}`),
    ...[...years].sort((a, b) => a - b).map(String),
  ].slice(0, 10);
}

/**
 * Fetch one bot's wiki page through the Web Unlocker. Always resolves: a
 * failure comes back as a `fallback` provenance row so the UI can show exactly
 * which fetch degraded and why.
 */
async function fetchLive(robot: string): Promise<LiveResult> {
  const url = wikiUrl(robot);
  const started = Date.now();

  const fallback = (message: string): LiveResult => ({
    live: null,
    provenance: {
      url,
      zone: zoneName(),
      bytes: 0,
      ms: Date.now() - started,
      fetched_at: new Date(started).toISOString(),
      cached: false,
      status: 'fallback',
    },
    error: message,
  });

  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new BrightDataError(`Unlock exceeded ${UNLOCK_TIMEOUT_MS} ms.`, 'timeout')),
        UNLOCK_TIMEOUT_MS,
      ),
    );
    const { html, provenance } = await Promise.race([unlock(url), timeout]);
    const scraped = parseRobotPage(html, robot);

    return {
      live: {
        builder: cleanLiveValue(scraped.builder),
        team: cleanLiveValue(scraped.team),
        country: cleanLiveValue(scraped.country),
        weight_lb: scraped.weight_lb,
        seasons: tidySeasons(scraped.seasons),
        // The excerpt is prose by construction and is context-only — the caller
        // is told not to quote figures from it — so it needs no field cleaning.
        excerpt: scraped.excerpt,
        source_url: url,
      },
      provenance,
      error: null,
    };
  } catch (e) {
    if (e instanceof BrightDataError) return fallback(e.message);
    return fallback(`Live collection failed: ${(e as Error).message}`);
  }
}

/* ------------------------------------------------------------------ robots */

function buildRobot(name: string, live: LiveRobotFacts | null): FactSheetRobot {
  const detail = robotDetail(name);
  if (!detail) throw new UnknownRobotError(name);
  const info = WEAPON_INFO[detail.weapon_type];

  return {
    robot: detail.robot,
    weapon_type: detail.weapon_type,
    weapon_label: info.label,
    weapon_short: info.short,
    weapon_blurb: info.blurb,
    weight_lb: detail.weight_lb,
    wins: detail.wins,
    losses: detail.losses,
    ko_wins: detail.ko_wins,
    win_rate: detail.win_rate,
    ko_rate: detail.ko_rate,
    rank: detail.rank,
    builder: detail.builder,
    country: detail.country,
    recent_form: detail.matches.slice(0, 3),
    live,
  };
}

/* ------------------------------------------------------------------ facts */

/** Small builder so every fact is registered the same way. */
class FactTable {
  private readonly facts: Record<string, Fact> = {};

  add(
    id: string,
    label: string,
    display: string,
    spoken: string,
    value: number | null,
    source: Fact['source'],
  ) {
    this.facts[id] = { id, label, display, spoken, value, source };
  }

  /** Convenience for percentage facts, which are the ones most often misquoted. */
  pct(id: string, label: string, n: number, source: Fact['source']) {
    this.add(id, label, `${n}%`, percentToWords(n), n, source);
  }

  text(id: string, label: string, value: string, source: Fact['source']) {
    this.add(id, label, value, value, null, source);
  }

  build(): Record<string, Fact> {
    return this.facts;
  }
}

/**
 * Percentile bounds of the Monte Carlo distribution, in percentage points.
 * Gives the caller an honest "the model's range is X to Y" line.
 */
function spreadOf(histogram: { bucket: number; count: number }[], trials: number) {
  const at = (target: number) => {
    let seen = 0;
    for (const b of histogram) {
      seen += b.count;
      if (seen >= target) return b.bucket;
    }
    return histogram[histogram.length - 1]?.bucket ?? 0;
  };
  return { spread_low: at(trials * 0.05), spread_high: at(trials * 0.95) + 5 };
}

/** The single heaviest weighted signal behind the call — the "why" of the pick. */
function dominantSignal(
  contributions: { label: string; a: number; b: number }[],
  aName: string,
  bName: string,
): DominantSignal {
  let best = { label: contributions[0]?.label ?? 'Career form', leader: aName, margin: 0 };
  for (const c of contributions) {
    const margin = Math.abs(c.a - c.b);
    if (margin > best.margin) {
      best = { label: c.label, leader: c.a >= c.b ? aName : bName, margin };
    }
  }
  return { ...best, margin: Math.round(best.margin * 1000) / 1000 };
}

/* ------------------------------------------------------------------ public */

export interface BuildOptions {
  /** Skip the live fetch entirely (used by the deterministic fallback path). */
  skipLive?: boolean;
  trials?: number;
}

export async function buildFactSheet(
  aName: string,
  bName: string,
  { skipLive = false, trials = 4000 }: BuildOptions = {},
): Promise<FactSheet> {
  const started = Date.now();

  const prediction = predict(aName, bName, true);
  if (!prediction) {
    // predict() returns null for an unknown name or a bot fighting itself.
    if (!robotDetail(aName)) throw new UnknownRobotError(aName);
    if (!robotDetail(bName)) throw new UnknownRobotError(bName);
    throw new Error('A robot cannot fight itself. Pick two different machines.');
  }

  // Both unlocks run concurrently — sequential would double the wait on stage.
  const [liveA, liveB] = skipLive
    ? [null, null]
    : await Promise.all([fetchLive(aName), fetchLive(bName)]);

  const a = buildRobot(aName, liveA?.live ?? null);
  const b = buildRobot(bName, liveB?.live ?? null);

  const sim = simulate(aName, bName, trials)!;
  const { spread_low, spread_high } = spreadOf(sim.histogram, sim.trials);

  const edgeA = weaponEdge(a.weapon_type, b.weapon_type);
  const edgeB = weaponEdge(b.weapon_type, a.weapon_type);
  const favours = Math.abs(edgeA) < 0.05 ? null : edgeA > 0 ? aName : bName;
  const dominant = dominantSignal(prediction.contributions, aName, bName);

  const provenance = [liveA?.provenance, liveB?.provenance].filter(Boolean) as Provenance[];
  const errors = [liveA?.error, liveB?.error].filter(Boolean) as string[];
  const successes = provenance.filter((p) => p.status !== 'fallback');

  let grounding: GroundingLevel;
  if (skipLive || !successes.length) grounding = 'fallback';
  else if (successes.length < provenance.length) grounding = 'partial';
  else grounding = successes.every((p) => p.cached) ? 'cached' : 'live';

  const degraded_reason = skipLive
    ? 'Live collection was skipped for this request; commentary is engine-only.'
    : errors.length
      ? errors.join(' ')
      : null;

  /* ---- the citable fact table ---- */

  const t = new FactTable();

  for (const [key, r] of [['a', a], ['b', b]] as const) {
    t.text(`${key}.name`, `${r.robot} name`, r.robot, 'roster');
    t.add(
      `${key}.record`,
      `${r.robot} career record`,
      `${r.wins}-${r.losses}`,
      recordToWords(r.wins, r.losses),
      null,
      'roster',
    );
    t.pct(`${key}.win_rate`, `${r.robot} career win rate`, r.win_rate, 'engine');
    t.pct(`${key}.ko_rate`, `${r.robot} share of wins by KO`, r.ko_rate, 'engine');
    t.add(
      `${key}.ko_wins`,
      `${r.robot} knockout wins`,
      String(r.ko_wins),
      integerToWords(r.ko_wins),
      r.ko_wins,
      'roster',
    );
    t.add(
      `${key}.weapon`,
      `${r.robot} weapon class`,
      r.weapon_label,
      weaponToWords(r.weapon_label.toLowerCase()),
      null,
      'roster',
    );
    t.add(
      `${key}.weight`,
      `${r.robot} weight`,
      `${r.weight_lb} lb`,
      `${integerToWords(r.weight_lb)} pounds`,
      r.weight_lb,
      'roster',
    );
    t.text(`${key}.builder`, `${r.robot} builder`, r.builder, 'roster');
    t.text(`${key}.country`, `${r.robot} country`, r.country, 'roster');
    if (r.rank !== null) {
      t.add(
        `${key}.rank`,
        `${r.robot} leaderboard rank`,
        `#${r.rank}`,
        `number ${integerToWords(r.rank)}`,
        r.rank,
        'engine',
      );
    }
    if (r.recent_form.length) {
      const form = r.recent_form
        .map((m) => `S${m.season} ${m.result} vs ${m.opponent} (${m.method})`)
        .join('; ');
      t.text(`${key}.recent_form`, `${r.robot} last three bouts`, form, 'roster');
    }

    // Live web facts are marked as such so the grounding panel can badge them.
    if (r.live) {
      if (r.live.team) t.text(`${key}.live_team`, `${r.robot} team (live web)`, r.live.team, 'bright_data');
      if (r.live.builder) {
        t.text(`${key}.live_builder`, `${r.robot} builder (live web)`, r.live.builder, 'bright_data');
      }
      if (r.live.country) {
        t.text(`${key}.live_country`, `${r.robot} country (live web)`, r.live.country, 'bright_data');
      }
      if (r.live.seasons.length) {
        t.text(
          `${key}.live_seasons`,
          `${r.robot} seasons referenced on the live page`,
          r.live.seasons.join(', '),
          'bright_data',
        );
      }
      if (r.live.excerpt) {
        t.text(`${key}.live_excerpt`, `${r.robot} live wiki summary`, r.live.excerpt, 'bright_data');
      }
    }
  }

  t.add(
    'h2h',
    'Head-to-head record',
    prediction.head_to_head.a + prediction.head_to_head.b === 0
      ? 'Never met'
      : `${aName} ${prediction.head_to_head.a} - ${prediction.head_to_head.b} ${bName}`,
    prediction.head_to_head.a + prediction.head_to_head.b === 0
      ? 'These two have never met in the box'
      : `${aName} leads it ${integerToWords(prediction.head_to_head.a)} to ${integerToWords(prediction.head_to_head.b)}`,
    null,
    'engine',
  );

  t.add(
    'matchup.edge',
    'Weapon matchup edge',
    favours ? `${favours} +${Math.abs(edgeA).toFixed(2)}` : 'Neutral',
    favours
      ? `the weapon matchup favours ${favours}`
      : 'the weapon matchup is close to neutral',
    null,
    'engine',
  );
  t.text(
    'matchup.description',
    'Weapon matchup',
    `${a.weapon_label} vs ${b.weapon_label}`,
    'engine',
  );

  t.pct('model.prob_a', `Model probability for ${aName}`, prediction.prob_a, 'engine');
  t.pct('model.prob_b', `Model probability for ${bName}`, prediction.prob_b, 'engine');
  t.text('model.winner', 'Model favourite', prediction.winner, 'engine');
  t.text('model.underdog', 'Model underdog', prediction.loser, 'engine');
  t.text('model.confidence', 'Model confidence', prediction.confidence, 'engine');
  t.pct('model.ko_likelihood', 'Knockout likelihood', prediction.ko_likelihood, 'engine');
  t.text(
    'model.projected_method',
    'Projected finish',
    prediction.projected_method === 'KO' ? 'Knockout' : "Judges' decision",
    'engine',
  );
  t.text(
    'model.dominant_signal',
    'Dominant signal behind the call',
    `${dominant.label} — favours ${dominant.leader}`,
    'engine',
  );
  t.text(
    'model.weights',
    'Model weighting',
    `Career form ${WEIGHTS.form}, finishing ${WEIGHTS.finishing}, matchup ${WEIGHTS.matchup}, head-to-head ${WEIGHTS.h2h}`,
    'engine',
  );
  prediction.reasons.forEach((reason, i) => {
    t.text(`model.reason_${i + 1}`, `Model reason ${i + 1}`, reason, 'engine');
  });

  t.add(
    'sim.trials',
    'Monte Carlo trials',
    String(sim.trials),
    `${integerToWords(sim.trials)} simulations`,
    sim.trials,
    'simulation',
  );
  t.pct('sim.prob_a', `Simulated win share for ${aName}`, sim.prob_a, 'simulation');
  t.pct('sim.ko_share', 'Simulated share of fights ending by KO', sim.ko_share, 'simulation');
  t.add(
    'sim.spread',
    'Monte Carlo 90% spread',
    `${spread_low}%–${spread_high}%`,
    `${numberToWords(spread_low)} to ${numberToWords(spread_high)} percent`,
    null,
    'simulation',
  );

  return {
    robot_a: a,
    robot_b: b,
    prediction,
    simulation: {
      trials: sim.trials,
      prob_a: sim.prob_a,
      prob_b: sim.prob_b,
      ko_share: sim.ko_share,
      spread_low,
      spread_high,
    },
    weapon_matchup: {
      edge_a: edgeA,
      edge_b: edgeB,
      favours,
      description: `${a.weapon_label} vs ${b.weapon_label}`,
    },
    dominant_signal: dominant,
    provenance,
    grounding,
    degraded_reason,
    facts: t.build(),
    built_at: new Date().toISOString(),
    build_ms: Date.now() - started,
  };
}
