/**
 * The analyst's toolbelt — SERVER ONLY.
 *
 * Every tool is a thin, typed wrapper over `src/lib/engine.ts` (the same pure
 * functions the rest of the app renders) or over Bright Data's Web Unlocker.
 * The model therefore cannot invent a statistic: the only numbers it ever sees
 * are the ones the engine computed.
 *
 * Each tool also returns a one-line `summary`, which is what the UI's telemetry
 * trace prints. Summaries are generated here rather than in the client so the
 * wording stays consistent with the engine's own vocabulary.
 */
import type { OpenAI } from 'openai';

import {
  backtest,
  leaderboard,
  predict,
  robotDetail,
  robotNames,
  scoutingReport,
  tournament,
  upsets,
  weaponMeta,
} from '@/lib/engine';
import { BrightDataError, isEnabled, parseRobotPage, unlock, wikiUrl, zoneName } from '@/lib/brightdata';
import type { Provenance } from '@/lib/types';

export interface ToolOutcome {
  ok: boolean;
  /** JSON payload fed back to the model as the tool message. */
  data: unknown;
  /** Compact telemetry line for the UI trace. */
  summary: string;
  meta?: Record<string, unknown>;
}

/* ------------------------------------------------------------ name matching */

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export interface NameMatch {
  name: string | null;
  /** Ranked alternatives, used to build a "did you mean" error for the model. */
  suggestions: string[];
}

/**
 * The model reliably gets robot names slightly wrong ("Tombstone Bot",
 * "witch doctor", "Minotaurus"). Resolve exact → case-insensitive →
 * substring → edit distance, so a near miss is recoverable rather than fatal.
 */
export function resolveRobotName(raw: unknown): NameMatch {
  if (typeof raw !== 'string' || !raw.trim()) return { name: null, suggestions: [] };
  const names = robotNames();
  const query = raw.trim();

  const exact = names.find((n) => n === query);
  if (exact) return { name: exact, suggestions: [] };

  const key = normalise(query);
  if (!key) return { name: null, suggestions: [] };

  const ci = names.find((n) => normalise(n) === key);
  if (ci) return { name: ci, suggestions: [] };

  const contains = names.filter((n) => {
    const nk = normalise(n);
    return nk.includes(key) || key.includes(nk);
  });
  if (contains.length === 1) return { name: contains[0], suggestions: [] };

  const ranked = names
    .map((n) => ({ n, d: editDistance(key, normalise(n)) }))
    .sort((x, y) => x.d - y.d);

  // Allow roughly one typo per four characters before giving up.
  const tolerance = Math.max(1, Math.floor(key.length / 4));
  if (ranked[0] && ranked[0].d <= tolerance) return { name: ranked[0].n, suggestions: [] };

  const suggestions = [...new Set([...contains, ...ranked.slice(0, 5).map((r) => r.n)])].slice(0, 5);
  return { name: null, suggestions };
}

const unknownRobot = (raw: unknown, suggestions: string[]): ToolOutcome => ({
  ok: false,
  data: {
    error: 'unknown_robot',
    message: `"${String(raw)}" is not in the 42-robot roster.`,
    did_you_mean: suggestions,
    hint: 'Call the tool again with one of the did_you_mean names, exactly as spelled.',
  },
  summary: `unknown robot "${String(raw)}"${suggestions.length ? ` — did you mean ${suggestions[0]}?` : ''}`,
});

const clampLimit = (raw: unknown, fallback: number, max: number) => {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(1, Math.round(n)));
};

const fmt = (n: number) => n.toFixed(1);

/* -------------------------------------------------------- tool definitions */

export const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionFunctionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_robot',
      description:
        'Career stats and leaderboard rank for one robot: record, win rate, KO rate, weapon class, builder, and full match history.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Robot name, e.g. "Tombstone".' } },
        required: ['name'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'predict_matchup',
      description:
        'Run the prediction model on a head-to-head fight. Returns win probabilities, confidence, the three weighted signal contributions, head-to-head record, projected finish, and plain-English reasons.',
      parameters: {
        type: 'object',
        properties: {
          a: { type: 'string', description: 'First robot.' },
          b: { type: 'string', description: 'Second robot.' },
        },
        required: ['a', 'b'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_leaderboard',
      description: 'Roster ranked by career win rate.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number', description: 'Rows to return, 1-42. Default 10.' } },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_weapon_meta',
      description:
        'Per-weapon-class aggregates: robot count, career record, KO rate, and head-to-head battle win rate across recorded fights. Use this for "which weapon is best/overrated" questions.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_backtest',
      description:
        'Model accuracy measured against every recorded historical match, broken down by confidence bucket, finish method, and season, versus the 50% coin-flip baseline.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_upsets',
      description: 'Historical fights the model got wrong, worst first — where the favourite lost.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number', description: 'Rows to return, 1-20. Default 8.' } },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'simulate_tournament',
      description:
        'Simulate a single-elimination bracket over the given robots in the order supplied. The field is trimmed to the largest power of two. Returns every round and the projected champion.',
      parameters: {
        type: 'object',
        properties: {
          robots: {
            type: 'array',
            items: { type: 'string' },
            description: 'Entrants in bracket order, 2-16 names.',
          },
        },
        required: ['robots'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scout_robot',
      description:
        'Full scouting report for one robot: archetype, summary, strengths, weaknesses, and its best and worst matchups across the entire roster.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scrape_live',
      description:
        "Collect a robot's BattleBots wiki page live through Bright Data's Web Unlocker and parse it. Returns the parsed fields (weapon, weight, builder, team, country, lede excerpt, seasons), a field-by-field diff against our bundled dataset, and provenance (URL, zone, byte count, latency). Use this whenever the user asks for live, current, or verified data, or asks to check our numbers against the wiki.",
      parameters: {
        type: 'object',
        properties: {
          robot: { type: 'string', description: 'Robot whose wiki page should be collected.' },
          fresh: {
            type: 'boolean',
            description: 'Bypass the 10-minute unlock cache and force a new fetch. Default false.',
          },
        },
        required: ['robot'],
        additionalProperties: false,
      },
    },
  },
];

export const TOOL_NAMES = TOOL_DEFINITIONS.map((t) => t.function.name);

/* --------------------------------------------------------------- execution */

type Args = Record<string, unknown>;

export async function executeTool(name: string, args: Args): Promise<ToolOutcome> {
  switch (name) {
    case 'get_robot':
      return toolGetRobot(args);
    case 'predict_matchup':
      return toolPredict(args);
    case 'get_leaderboard':
      return toolLeaderboard(args);
    case 'get_weapon_meta':
      return toolWeaponMeta();
    case 'get_backtest':
      return toolBacktest();
    case 'get_upsets':
      return toolUpsets(args);
    case 'simulate_tournament':
      return toolTournament(args);
    case 'scout_robot':
      return toolScout(args);
    case 'scrape_live':
      return toolScrapeLive(args);
    default:
      return {
        ok: false,
        data: { error: 'unknown_tool', message: `No tool named "${name}".`, available: TOOL_NAMES },
        summary: `unknown tool "${name}"`,
      };
  }
}

function toolGetRobot(args: Args): ToolOutcome {
  const { name, suggestions } = resolveRobotName(args.name);
  if (!name) return unknownRobot(args.name, suggestions);
  const detail = robotDetail(name);
  if (!detail) return unknownRobot(args.name, suggestions);
  return {
    ok: true,
    data: detail,
    summary: `${detail.robot} — rank #${detail.rank ?? '?'}, ${detail.wins}-${detail.losses}, ${fmt(detail.win_rate)}% win rate`,
  };
}

function toolPredict(args: Args): ToolOutcome {
  const a = resolveRobotName(args.a);
  if (!a.name) return unknownRobot(args.a, a.suggestions);
  const b = resolveRobotName(args.b);
  if (!b.name) return unknownRobot(args.b, b.suggestions);
  if (a.name === b.name) {
    return {
      ok: false,
      data: { error: 'same_robot', message: 'A robot cannot fight itself. Pick two different robots.' },
      summary: `${a.name} vs itself — invalid matchup`,
    };
  }

  const p = predict(a.name, b.name, true);
  if (!p) {
    return {
      ok: false,
      data: { error: 'prediction_failed', message: 'The engine could not score that pairing.' },
      summary: `prediction failed for ${a.name} vs ${b.name}`,
    };
  }
  const winnerProb = p.winner === p.robot_a ? p.prob_a : p.prob_b;
  return {
    ok: true,
    data: { ...p, weights: { career_form: 0.45, finishing: 0.25, weapon_matchup: 0.3, head_to_head: 0.05 } },
    summary: `${p.robot_a} vs ${p.robot_b} → ${p.winner} ${fmt(winnerProb)}% (${p.confidence}, proj. ${p.projected_method})`,
  };
}

function toolLeaderboard(args: Args): ToolOutcome {
  const limit = clampLimit(args.limit, 10, 42);
  const rows = leaderboard().slice(0, limit);
  const top = rows[0];
  return {
    ok: true,
    data: { rows, roster_size: robotNames().length },
    summary: `top ${rows.length}${top ? ` — #1 ${top.robot} at ${fmt(top.win_rate)}%` : ''}`,
  };
}

function toolWeaponMeta(): ToolOutcome {
  const rows = weaponMeta();
  const best = rows[0];
  const worst = rows[rows.length - 1];
  return {
    ok: true,
    data: {
      rows,
      note: 'battle_rate is the class win rate across recorded fights; win_rate is aggregated career record. They can disagree, which is where "overrated" lives.',
    },
    summary: `${rows.length} classes — best ${best?.weapon} ${fmt(best?.battle_rate ?? 0)}%, worst ${worst?.weapon} ${fmt(worst?.battle_rate ?? 0)}%`,
  };
}

function toolBacktest(): ToolOutcome {
  const bt = backtest();
  // The per-fight samples are large and rarely useful to the model; keep a slice.
  const { samples, ...rest } = bt;
  return {
    ok: true,
    data: { ...rest, sample_preview: samples.slice(0, 8), note: 'Head-to-head is disabled during backtesting so the model cannot peek at the result it is predicting.' },
    summary: `${fmt(bt.accuracy)}% on ${bt.total} fights (+${fmt(bt.accuracy - bt.baseline)} vs 50% baseline)`,
  };
}

function toolUpsets(args: Args): ToolOutcome {
  const limit = clampLimit(args.limit, 8, 20);
  const rows = upsets(limit);
  const worst = rows[0];
  return {
    ok: true,
    data: { rows },
    summary: worst
      ? `${rows.length} upsets — worst: ${worst.actual_winner} beat ${worst.favorite} (${fmt(worst.fav_prob)}% favourite, S${worst.season})`
      : 'no upsets found',
  };
}

function toolTournament(args: Args): ToolOutcome {
  const raw = Array.isArray(args.robots) ? args.robots : [];
  if (raw.length < 2) {
    return {
      ok: false,
      data: { error: 'too_few_entrants', message: 'Supply at least 2 robot names (4, 8 or 16 works best).' },
      summary: 'tournament needs at least 2 entrants',
    };
  }

  const entrants: string[] = [];
  const unresolved: { input: string; did_you_mean: string[] }[] = [];
  for (const item of raw.slice(0, 16)) {
    const m = resolveRobotName(item);
    if (m.name) entrants.push(m.name);
    else unresolved.push({ input: String(item), did_you_mean: m.suggestions });
  }
  if (entrants.length < 2) {
    return {
      ok: false,
      data: { error: 'unknown_robots', message: 'Too few entrants resolved to real robots.', unresolved },
      summary: `tournament aborted — ${unresolved.length} unknown name(s)`,
    };
  }

  const result = tournament(entrants);
  if (!result) {
    return {
      ok: false,
      data: { error: 'bracket_failed', message: 'Could not build a balanced bracket from those entrants.' },
      summary: 'bracket could not be built',
    };
  }
  return {
    ok: true,
    data: { ...result, dropped_for_balance: entrants.slice(result.size), unresolved },
    summary: `${result.size}-bot bracket → champion ${result.champion} (${result.rounds.length} rounds)`,
  };
}

function toolScout(args: Args): ToolOutcome {
  const { name, suggestions } = resolveRobotName(args.name);
  if (!name) return unknownRobot(args.name, suggestions);
  const report = scoutingReport(name);
  if (!report) return unknownRobot(args.name, suggestions);
  return {
    ok: true,
    data: report,
    summary: `${report.robot} — ${report.archetype}; best vs ${report.best_matchups[0]?.opponent ?? 'n/a'}, worst vs ${report.worst_matchups[0]?.opponent ?? 'n/a'}`,
  };
}

async function toolScrapeLive(args: Args): Promise<ToolOutcome> {
  const { name, suggestions } = resolveRobotName(args.robot);
  if (!name) return unknownRobot(args.robot, suggestions);

  if (!isEnabled()) {
    return {
      ok: false,
      data: {
        error: 'brightdata_not_configured',
        message: 'Bright Data collection is not configured on this deployment, so no live page can be fetched.',
        hint: 'Answer from the bundled dataset instead, and say that live collection is unavailable.',
      },
      summary: 'Bright Data not configured',
    };
  }

  const url = wikiUrl(name);
  try {
    const { html, provenance } = await unlock(url, { fresh: args.fresh === true });
    const scraped = parseRobotPage(html, name);
    const local = robotDetail(name);

    const diff = local
      ? [
          field('weapon_type', local.weapon_type, scraped.weapon_type),
          field('weight_lb', String(local.weight_lb), scraped.weight_lb === null ? null : String(scraped.weight_lb)),
          field('builder', local.builder, scraped.builder),
          field('country', local.country, scraped.country),
        ]
      : [];

    const agree = diff.filter((d) => d.match).length;
    return {
      ok: true,
      data: {
        scraped,
        local,
        diff,
        provenance,
        note: 'Cite the byte count and zone when reporting this. `diff.match` false means the wiki and our dataset disagree — say so plainly rather than smoothing it over.',
      },
      summary: `${name} wiki via Bright Data — ${provenance.bytes.toLocaleString('en-US')} bytes in ${provenance.ms}ms${diff.length ? `, ${agree}/${diff.length} fields agree` : ''}${provenance.cached ? ' (cached)' : ''}`,
      meta: { provenance: provenance satisfies Provenance, agree, fields: diff.length },
    };
  } catch (e) {
    // A collection failure must never end the agent loop — hand the model a
    // structured error so it can fall back to the bundled dataset and say so.
    const err = e as BrightDataError;
    const code = err instanceof BrightDataError ? err.code : 'unknown';
    return {
      ok: false,
      data: {
        error: 'brightdata_failed',
        code,
        message: err.message,
        url,
        zone: zoneName(),
        hint: 'Fall back to the bundled dataset via get_robot and tell the user live collection failed.',
      },
      summary: `Bright Data failed for ${name} (${code})`,
      meta: { url, zone: zoneName(), code },
    };
  }
}

function field(name: string, local: string, live: string | null) {
  const l = (live ?? '').toLowerCase().trim();
  return {
    field: name,
    local,
    live: live ?? 'not found',
    match: Boolean(l) && (l === local.toLowerCase() || l.includes(local.toLowerCase()) || local.toLowerCase().includes(l)),
  };
}
