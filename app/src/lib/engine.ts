/**
 * The prediction engine.
 *
 * Everything the UI shows is derived here, and every number is traceable to one
 * of three transparent signals — no black box:
 *
 *   score = 0.45·win_rate + 0.25·ko_rate + 0.30·(0.5 + weapon_edge)
 *
 * Head-to-head history then nudges the score symmetrically. It is deliberately
 * disabled during backtesting so the model cannot peek at the result of the very
 * fight it is being asked to predict.
 */
import { MATCHES, ROBOTS, WEAPON_INFO } from './data/roster';
import type {
  BacktestResult,
  BacktestSample,
  BracketMatch,
  Bucket,
  Confidence,
  LeaderboardRow,
  Prediction,
  Robot,
  RobotDetail,
  RobotMatch,
  ScoutingReport,
  TournamentResult,
  Upset,
  WeaponMeta,
  WeaponType,
} from './types';

/** Advantage of the ROW weapon when facing the COLUMN weapon, in -1..+1. */
const WEAPON_EDGE: Record<string, Record<string, number>> = {
  horizontal_spinner: { flipper: 0.30, lifter: 0.35, drum_spinner: 0.05, vertical_spinner: -0.05, overhead_saw: 0.15, hammer: 0.25, crusher: 0.30, horizontal_spinner: 0 },
  vertical_spinner: { flipper: 0.25, lifter: 0.30, horizontal_spinner: 0.05, drum_spinner: 0.10, overhead_saw: 0.10, hammer: 0.25, crusher: 0.30, vertical_spinner: 0 },
  drum_spinner: { flipper: 0.20, lifter: 0.25, horizontal_spinner: -0.05, vertical_spinner: -0.10, overhead_saw: 0.05, hammer: 0.20, crusher: 0.25, drum_spinner: 0 },
  overhead_saw: { flipper: 0.10, lifter: 0.15, horizontal_spinner: -0.15, vertical_spinner: -0.10, drum_spinner: -0.05, hammer: 0.10, crusher: 0.15, overhead_saw: 0 },
  flipper: { horizontal_spinner: -0.30, vertical_spinner: -0.25, drum_spinner: -0.20, overhead_saw: -0.10, lifter: 0.10, hammer: 0.15, crusher: 0.20, flipper: 0 },
  lifter: { horizontal_spinner: -0.35, vertical_spinner: -0.30, drum_spinner: -0.25, overhead_saw: -0.15, flipper: -0.10, hammer: 0.05, crusher: 0.10, lifter: 0 },
  hammer: { horizontal_spinner: -0.25, vertical_spinner: -0.25, drum_spinner: -0.20, overhead_saw: -0.10, flipper: -0.15, lifter: -0.05, crusher: 0.05, hammer: 0 },
  crusher: { horizontal_spinner: -0.30, vertical_spinner: -0.30, drum_spinner: -0.25, overhead_saw: -0.15, flipper: -0.20, lifter: -0.10, hammer: -0.05, crusher: 0 },
};

export const WEIGHTS = { form: 0.45, finishing: 0.25, matchup: 0.30, h2h: 0.05 } as const;

const BY_NAME = new Map(ROBOTS.map((r) => [r.robot, r]));

const round1 = (n: number) => Math.round(n * 10) / 10;

export const robotNames = (): string[] => ROBOTS.map((r) => r.robot);
export const allRobots = (): Robot[] => ROBOTS;
export const getRobot = (name: string): Robot | null => BY_NAME.get(name) ?? null;

export const winRate = (r: Robot) => (r.wins + r.losses ? r.wins / (r.wins + r.losses) : 0.5);
export const koRate = (r: Robot) => (r.wins ? r.ko_wins / r.wins : 0);
export const weaponEdge = (a: string, b: string) => WEAPON_EDGE[a]?.[b] ?? 0;

export function headToHead(a: string, b: string): [number, number] {
  let aw = 0;
  let bw = 0;
  for (const m of MATCHES) {
    const involved =
      (m.robot_a === a && m.robot_b === b) || (m.robot_a === b && m.robot_b === a);
    if (!involved) continue;
    if (m.winner === a) aw++;
    else if (m.winner === b) bw++;
  }
  return [aw, bw];
}

export function leaderboard(): LeaderboardRow[] {
  return ROBOTS.map((r) => ({
    rank: 0,
    robot: r.robot,
    weapon_type: r.weapon_type,
    wins: r.wins,
    losses: r.losses,
    win_rate: round1(winRate(r) * 100),
    ko_rate: round1(koRate(r) * 100),
    builder: r.builder,
  }))
    .sort((a, b) => b.win_rate - a.win_rate || b.wins - a.wins)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

export function robotDetail(name: string): RobotDetail | null {
  const r = BY_NAME.get(name);
  if (!r) return null;

  const rank = leaderboard().find((row) => row.robot === name)?.rank ?? null;
  const matches: RobotMatch[] = MATCHES.filter(
    (m) => m.robot_a === name || m.robot_b === name,
  )
    .map((m) => ({
      season: m.season,
      opponent: m.robot_a === name ? m.robot_b : m.robot_a,
      result: (m.winner === name ? 'Win' : 'Loss') as 'Win' | 'Loss',
      method: m.method,
    }))
    .sort((a, b) => b.season - a.season);

  return {
    ...r,
    win_rate: round1(winRate(r) * 100),
    ko_rate: round1(koRate(r) * 100),
    rank,
    matches,
  };
}

export function predict(aName: string, bName: string, useH2h = true): Prediction | null {
  const a = BY_NAME.get(aName);
  const b = BY_NAME.get(bName);
  if (!a || !b || aName === bName) return null;

  const formA = winRate(a);
  const formB = winRate(b);
  const koA = koRate(a);
  const koB = koRate(b);
  const edgeA = weaponEdge(a.weapon_type, b.weapon_type);
  const edgeB = weaponEdge(b.weapon_type, a.weapon_type);

  let scoreA = WEIGHTS.form * formA + WEIGHTS.finishing * koA + WEIGHTS.matchup * (0.5 + edgeA);
  let scoreB = WEIGHTS.form * formB + WEIGHTS.finishing * koB + WEIGHTS.matchup * (0.5 + edgeB);

  const [h2hA, h2hB] = headToHead(aName, bName);
  if (useH2h && h2hA + h2hB > 0) {
    scoreA += WEIGHTS.h2h * (h2hA - h2hB);
    scoreB += WEIGHTS.h2h * (h2hB - h2hA);
  }

  const total = scoreA + scoreB;
  const probA = total ? scoreA / total : 0.5;
  const probB = 1 - probA;
  const margin = Math.abs(probA - probB);
  const winner = probA >= probB ? aName : bName;

  // A fight is more likely to end in a KO when both bots carry finishing power
  // and the weapon matchup is lopsided enough for one to land cleanly.
  const koLikelihood = Math.min(
    0.95,
    Math.max(0.05, 0.35 + 0.5 * Math.max(koA, koB) + 0.4 * Math.abs(edgeA)),
  );

  return {
    robot_a: aName,
    robot_b: bName,
    prob_a: round1(probA * 100),
    prob_b: round1(probB * 100),
    winner,
    loser: winner === aName ? bName : aName,
    confidence: margin > 0.2 ? 'HIGH' : margin > 0.08 ? 'MEDIUM' : 'LOW',
    head_to_head: { a: h2hA, b: h2hB },
    signals: {
      win_rate: { a: round1(formA * 100), b: round1(formB * 100) },
      ko_rate: { a: round1(koA * 100), b: round1(koB * 100) },
      weapon_edge: { a: edgeA, b: edgeB },
    },
    contributions: [
      { label: 'Career form', weight: WEIGHTS.form, a: WEIGHTS.form * formA, b: WEIGHTS.form * formB },
      { label: 'Finishing power', weight: WEIGHTS.finishing, a: WEIGHTS.finishing * koA, b: WEIGHTS.finishing * koB },
      { label: 'Weapon matchup', weight: WEIGHTS.matchup, a: WEIGHTS.matchup * (0.5 + edgeA), b: WEIGHTS.matchup * (0.5 + edgeB) },
      { label: 'Head-to-head', weight: WEIGHTS.h2h, a: useH2h ? WEIGHTS.h2h * (h2hA - h2hB) : 0, b: useH2h ? WEIGHTS.h2h * (h2hB - h2hA) : 0 },
    ],
    reasons: buildReasons(a, b, formA, formB, koA, koB, edgeA, h2hA, h2hB),
    projected_method: koLikelihood > 0.55 ? 'KO' : 'JD',
    ko_likelihood: round1(koLikelihood * 100),
  };
}

function buildReasons(
  a: Robot,
  b: Robot,
  formA: number,
  formB: number,
  koA: number,
  koB: number,
  edgeA: number,
  h2hA: number,
  h2hB: number,
): string[] {
  const out: string[] = [];
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  if (formA !== formB) {
    const better = formA > formB ? a.robot : b.robot;
    out.push(
      `${better} has the stronger career win rate (${pct(Math.max(formA, formB))} vs ${pct(Math.min(formA, formB))}).`,
    );
  }
  const nameOf = (w: WeaponType) => WEAPON_INFO[w].label.toLowerCase();
  if (edgeA > 0.05) {
    out.push(`${a.robot}'s ${nameOf(a.weapon_type)} matches up well against a ${nameOf(b.weapon_type)}.`);
  } else if (edgeA < -0.05) {
    out.push(`${b.robot}'s ${nameOf(b.weapon_type)} matches up well against a ${nameOf(a.weapon_type)}.`);
  }
  if (koA > koB + 0.1) {
    out.push(`${a.robot} finishes fights — ${pct(koA)} of its wins are KOs.`);
  } else if (koB > koA + 0.1) {
    out.push(`${b.robot} finishes fights — ${pct(koB)} of its wins are KOs.`);
  }
  if (h2hA + h2hB > 0) {
    out.push(`Head-to-head record: ${a.robot} ${h2hA} - ${h2hB} ${b.robot}.`);
  }
  if (!out.length) {
    out.push('These two are evenly matched on every signal — near coin-flip.');
  }
  return out;
}

const bucket = (correct: number, total: number): Bucket => ({
  correct,
  total,
  accuracy: total ? round1((correct / total) * 100) : 0,
});

export function backtest(): BacktestResult {
  const names = new Set(ROBOTS.map((r) => r.robot));
  let total = 0;
  let correct = 0;
  const byConf: Record<Confidence, [number, number]> = { HIGH: [0, 0], MEDIUM: [0, 0], LOW: [0, 0] };
  const byMethod: Record<'KO' | 'JD', [number, number]> = { KO: [0, 0], JD: [0, 0] };
  const bySeason = new Map<number, [number, number]>();
  const samples: BacktestSample[] = [];

  for (const m of MATCHES) {
    if (!names.has(m.robot_a) || !names.has(m.robot_b)) continue;
    if (m.winner !== m.robot_a && m.winner !== m.robot_b) continue;

    const p = predict(m.robot_a, m.robot_b, false);
    if (!p) continue;
    const ok = p.winner === m.winner;
    total++;
    correct += ok ? 1 : 0;

    byConf[p.confidence][1]++;
    byConf[p.confidence][0] += ok ? 1 : 0;
    byMethod[m.method][1]++;
    byMethod[m.method][0] += ok ? 1 : 0;

    const s = bySeason.get(m.season) ?? [0, 0];
    s[1]++;
    s[0] += ok ? 1 : 0;
    bySeason.set(m.season, s);

    samples.push({
      season: m.season,
      robot_a: m.robot_a,
      robot_b: m.robot_b,
      actual: m.winner,
      predicted: p.winner,
      confidence: p.confidence,
      correct: ok,
    });
  }

  return {
    total,
    correct,
    accuracy: total ? round1((correct / total) * 100) : 0,
    baseline: 50,
    by_confidence: {
      HIGH: bucket(...byConf.HIGH),
      MEDIUM: bucket(...byConf.MEDIUM),
      LOW: bucket(...byConf.LOW),
    },
    by_method: { KO: bucket(...byMethod.KO), JD: bucket(...byMethod.JD) },
    by_season: [...bySeason.entries()]
      .sort((x, y) => x[0] - y[0])
      .map(([season, [c, t]]) => ({ season, ...bucket(c, t) })),
    samples,
  };
}

export function weaponMeta(): WeaponMeta[] {
  const nameWeapon = new Map(ROBOTS.map((r) => [r.robot, r.weapon_type]));
  const agg = new Map<WeaponType, { robots: number; wins: number; losses: number; ko: number }>();

  for (const r of ROBOTS) {
    const a = agg.get(r.weapon_type) ?? { robots: 0, wins: 0, losses: 0, ko: 0 };
    a.robots++;
    a.wins += r.wins;
    a.losses += r.losses;
    a.ko += r.ko_wins;
    agg.set(r.weapon_type, a);
  }

  const battle = new Map<WeaponType, [number, number]>();
  for (const m of MATCHES) {
    const loser = m.winner === m.robot_a ? m.robot_b : m.robot_a;
    const wW = nameWeapon.get(m.winner);
    const lW = nameWeapon.get(loser);
    if (wW) {
      const b = battle.get(wW) ?? [0, 0];
      b[0]++;
      battle.set(wW, b);
    }
    if (lW) {
      const b = battle.get(lW) ?? [0, 0];
      b[1]++;
      battle.set(lW, b);
    }
  }

  const rows: WeaponMeta[] = [];
  for (const [weapon, a] of agg) {
    const careerTotal = a.wins + a.losses;
    const [bw, bl] = battle.get(weapon) ?? [0, 0];
    const bt = bw + bl;
    rows.push({
      weapon,
      robots: a.robots,
      wins: a.wins,
      losses: a.losses,
      win_rate: careerTotal ? round1((a.wins / careerTotal) * 100) : 0,
      ko_rate: a.wins ? round1((a.ko / a.wins) * 100) : 0,
      battle_wins: bw,
      battle_losses: bl,
      battle_rate: bt ? round1((bw / bt) * 100) : 0,
    });
  }
  return rows.sort((x, y) => y.battle_rate - x.battle_rate);
}

export function upsets(limit = 10): Upset[] {
  const names = new Set(ROBOTS.map((r) => r.robot));
  const found: Upset[] = [];

  for (const m of MATCHES) {
    if (!names.has(m.robot_a) || !names.has(m.robot_b)) continue;
    if (m.winner !== m.robot_a && m.winner !== m.robot_b) continue;
    const p = predict(m.robot_a, m.robot_b, false);
    if (!p || p.winner === m.winner) continue;
    found.push({
      season: m.season,
      favorite: p.winner,
      fav_prob: p.winner === m.robot_a ? p.prob_a : p.prob_b,
      actual_winner: m.winner,
      method: m.method,
    });
  }
  return found.sort((a, b) => b.fav_prob - a.fav_prob).slice(0, limit);
}

export function tournament(names: string[]): TournamentResult | null {
  const valid = new Set(ROBOTS.map((r) => r.robot));
  const seen = new Set<string>();
  const entrants: string[] = [];
  for (const n of names) {
    if (valid.has(n) && !seen.has(n)) {
      seen.add(n);
      entrants.push(n);
    }
  }

  // Trim to the largest power of two so every round is balanced.
  let size = 1;
  while (size * 2 <= entrants.length) size *= 2;
  if (size < 2) return null;
  const seeds = entrants.slice(0, size);

  const rounds: BracketMatch[][] = [];
  let current = seeds;
  while (current.length > 1) {
    const roundMatches: BracketMatch[] = [];
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const p = predict(current[i], current[i + 1], true)!;
      roundMatches.push({
        a: current[i],
        b: current[i + 1],
        winner: p.winner,
        prob_a: p.prob_a,
        prob_b: p.prob_b,
        confidence: p.confidence,
      });
      next.push(p.winner);
    }
    rounds.push(roundMatches);
    current = next;
  }

  return { size, seeds, rounds, champion: current[0] };
}

/**
 * Seed a bracket the way a real event would, so the top two seeds can only
 * meet in the final. Expands 1-vs-N pairings outward: [1,2] -> [1,4,2,3] -> …
 */
export function seedBracket(count: 4 | 8 | 16): string[] {
  const ranked = leaderboard().slice(0, count).map((r) => r.robot);
  let seeds = [1, 2];
  while (seeds.length < count) {
    const opponentOf = seeds.length * 2 + 1;
    seeds = seeds.flatMap((s) => [s, opponentOf - s]);
  }
  return seeds.map((s) => ranked[s - 1]).filter(Boolean);
}

/**
 * A scouting report built entirely from the model: run this bot against the
 * whole roster and surface the extremes.
 */
export function scoutingReport(name: string): ScoutingReport | null {
  const r = BY_NAME.get(name);
  if (!r) return null;

  const results = ROBOTS.filter((o) => o.robot !== name)
    .map((o) => {
      const p = predict(name, o.robot, true)!;
      return { opponent: o.robot, prob: p.prob_a };
    })
    .sort((x, y) => y.prob - x.prob);

  const form = winRate(r);
  const ko = koRate(r);
  const info = WEAPON_INFO[r.weapon_type];
  const rank = leaderboard().find((row) => row.robot === name)?.rank ?? null;

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (form >= 0.65) strengths.push(`Elite career form at ${Math.round(form * 100)}% (rank #${rank}).`);
  else if (form < 0.45) weaknesses.push(`Losing career record — ${Math.round(form * 100)}% win rate.`);

  if (ko >= 0.5) strengths.push(`Genuine finisher: ${Math.round(ko * 100)}% of wins come by KO.`);
  else if (ko < 0.3) weaknesses.push(`Rarely finishes — only ${Math.round(ko * 100)}% of wins are KOs, so fights go to the judges.`);

  const meta = weaponMeta().find((w) => w.weapon === r.weapon_type);
  if (meta) {
    if (meta.battle_rate >= 55) strengths.push(`Rides a favoured class — ${info.label.toLowerCase()}s win ${meta.battle_rate}% of recorded fights.`);
    else if (meta.battle_rate < 45) weaknesses.push(`Fights out of an unfavoured class — ${info.label.toLowerCase()}s win only ${meta.battle_rate}% of recorded fights.`);
  }

  const beats = results.filter((x) => x.prob >= 50).length;
  if (!strengths.length) strengths.push(`Model favours it in ${beats} of ${results.length} roster matchups.`);
  if (!weaknesses.length) weaknesses.push(`Underdog in ${results.length - beats} of ${results.length} roster matchups.`);

  return {
    robot: name,
    archetype: info.label,
    summary:
      `${name} is a ${info.label.toLowerCase()} built by ${r.builder} (${r.country}), ` +
      `carrying a ${r.wins}-${r.losses} record with ${r.ko_wins} knockouts. ` +
      `Against the full roster the model favours it in ${beats} of ${results.length} matchups.`,
    strengths,
    weaknesses,
    best_matchups: results.slice(0, 4),
    worst_matchups: results.slice(-4).reverse(),
  };
}

/**
 * Monte Carlo fight simulator. Each trial perturbs the model's signals with
 * Gaussian noise, so the output is a *distribution* of outcomes rather than one
 * brittle number — closer to how a fight actually feels.
 */
export function simulate(aName: string, bName: string, trials = 4000) {
  const base = predict(aName, bName, true);
  if (!base) return null;

  const p = base.prob_a / 100;
  // Wider spread when the model is less sure, narrower when it is confident.
  const sigma = 0.06 + 0.14 * (1 - Math.abs(p - 0.5) * 2);

  let aWins = 0;
  let koCount = 0;
  const histogram = new Array(20).fill(0);
  let seed = 1337;
  const rand = () => {
    // Deterministic PRNG so the same matchup always yields the same chart.
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const gauss = () => {
    const u = Math.max(rand(), 1e-9);
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  for (let i = 0; i < trials; i++) {
    const draw = Math.min(0.999, Math.max(0.001, p + gauss() * sigma));
    histogram[Math.min(19, Math.floor(draw * 20))]++;
    if (rand() < draw) aWins++;
    if (rand() < base.ko_likelihood / 100) koCount++;
  }

  return {
    trials,
    prob_a: round1((aWins / trials) * 100),
    prob_b: round1(((trials - aWins) / trials) * 100),
    ko_share: round1((koCount / trials) * 100),
    histogram: histogram.map((count, i) => ({
      bucket: i * 5,
      label: `${i * 5}-${i * 5 + 5}%`,
      count,
      share: round1((count / trials) * 100),
    })),
  };
}

export type SimulationResult = NonNullable<ReturnType<typeof simulate>>;

/** Roster-wide aggregates for the landing page stat strip. */
export function rosterStats() {
  const bt = backtest();
  return {
    robots: ROBOTS.length,
    matches: MATCHES.length,
    seasons: new Set(MATCHES.map((m) => m.season)).size,
    weapons: new Set(ROBOTS.map((r) => r.weapon_type)).size,
    accuracy: bt.accuracy,
    knockouts: MATCHES.filter((m) => m.method === 'KO').length,
  };
}
