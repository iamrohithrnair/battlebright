/**
 * Independent cross-check for the /api/commentary/script response.
 *
 * Run against a live dev server:
 *   npx tsx src/lib/commentary/verify.mts http://localhost:3000 Tombstone "End Game"
 *
 * It re-derives every headline figure straight from the engine and asserts the
 * fact sheet agrees, then re-extracts the figures the caller actually speaks and
 * asserts each one traces to the sheet. This is the check that proves the
 * commentary is grounded rather than merely claiming to be.
 */
import { predict, simulate } from '../engine';
import { extractFigures } from './speech';
import { allowedValues } from './validate';
import { BEAT_IDS, type CommentaryScript } from './types';

const [base = 'http://localhost:3000', a = 'Tombstone', b = 'End Game'] = process.argv.slice(2);

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!ok) failures++;
};

const res = await fetch(`${base}/api/commentary/script`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ robot_a: a, robot_b: b }),
});
if (!res.ok) {
  console.error(`Request failed: HTTP ${res.status} ${await res.text()}`);
  process.exit(1);
}
const script = (await res.json()) as CommentaryScript;
const sheet = script.fact_sheet;

console.log(`\n=== ${a} vs ${b} — model ${script.model} in ${script.generation_ms} ms ===\n`);

/* ---- 1. the fact sheet must match the engine exactly ---- */

const p = predict(a, b, true)!;
const sim = simulate(a, b, 4000)!;

check('beat count is 6', script.beats.length === 6, `got ${script.beats.length}`);
check(
  'beats in choreography order',
  script.beats.every((beat, i) => beat.id === BEAT_IDS[i]),
  script.beats.map((x) => x.id).join(' > '),
);
check('prob_a matches engine', sheet.prediction.prob_a === p.prob_a, `${sheet.prediction.prob_a} vs ${p.prob_a}`);
check('prob_b matches engine', sheet.prediction.prob_b === p.prob_b, `${sheet.prediction.prob_b} vs ${p.prob_b}`);
check('winner matches engine', sheet.prediction.winner === p.winner, sheet.prediction.winner);
check('confidence matches engine', sheet.prediction.confidence === p.confidence, sheet.prediction.confidence);
check(
  'ko_likelihood matches engine',
  sheet.prediction.ko_likelihood === p.ko_likelihood,
  `${sheet.prediction.ko_likelihood} vs ${p.ko_likelihood}`,
);
check(
  'projected_method matches engine',
  sheet.prediction.projected_method === p.projected_method,
  sheet.prediction.projected_method,
);
check('monte carlo prob matches engine', sheet.simulation.prob_a === sim.prob_a, `${sheet.simulation.prob_a} vs ${sim.prob_a}`);
check(
  'head-to-head matches engine',
  sheet.prediction.head_to_head.a === p.head_to_head.a && sheet.prediction.head_to_head.b === p.head_to_head.b,
  `${sheet.prediction.head_to_head.a}-${sheet.prediction.head_to_head.b}`,
);
check(
  'win rate facts match engine signals',
  sheet.facts['a.win_rate']?.value === p.signals.win_rate.a &&
    sheet.facts['b.win_rate']?.value === p.signals.win_rate.b,
  `${sheet.facts['a.win_rate']?.display} / ${sheet.facts['b.win_rate']?.display}`,
);
check(
  'ko rate facts match engine signals',
  sheet.facts['a.ko_rate']?.value === p.signals.ko_rate.a &&
    sheet.facts['b.ko_rate']?.value === p.signals.ko_rate.b,
  `${sheet.facts['a.ko_rate']?.display} / ${sheet.facts['b.ko_rate']?.display}`,
);

/* ---- 2. Bright Data must have actually fetched something ---- */

check('provenance covers both bots', sheet.provenance.length === 2, `${sheet.provenance.length} entries`);
for (const prov of sheet.provenance) {
  const page = decodeURIComponent(prov.url.split('/').pop() ?? '');
  check(
    `live fetch returned bytes: ${page}`,
    prov.bytes > 10_000,
    `${prov.bytes} bytes in ${prov.ms} ms (${prov.status}), zone ${prov.zone}`,
  );
}

/* ---- 3. every spoken figure must trace to the sheet ---- */

const allowed = allowedValues(sheet);
let spoken = 0;
const orphans: string[] = [];

for (const beat of script.beats) {
  for (const figure of extractFigures(beat.text)) {
    spoken++;
    const ok = [...allowed].some((v) => Math.abs(v - figure.value) <= 0.51);
    if (!ok) orphans.push(`${beat.id}: "${figure.raw}" (${figure.value})`);
  }
}
check(
  'every spoken figure traces to the fact sheet',
  orphans.length === 0,
  orphans.length ? `\n      ${orphans.join('\n      ')}` : `${spoken} figures checked`,
);

/* ---- 4. citations must resolve ---- */

const dangling = script.beats.flatMap((beat) =>
  beat.facts_used.filter((id) => !(id in sheet.facts)).map((id) => `${beat.id}:${id}`),
);
check('all facts_used ids resolve', dangling.length === 0, dangling.join(', '));
check(
  'every beat cites at least one fact or is descriptive',
  script.beats.every((beat) => beat.facts_used.length > 0 || beat.id === 'clash'),
);

/* ---- 5. speech hygiene ---- */

for (const beat of script.beats) {
  check(`${beat.id}: no snake_case spoken`, !/[a-z]_[a-z]/.test(beat.text));
  check(`${beat.id}: no markdown`, !/[*#`]/.test(beat.text));
  check(`${beat.id}: duration is sane`, beat.duration_hint_ms >= 3000 && beat.duration_hint_ms <= 20_000, `${beat.duration_hint_ms} ms`);
}

console.log(
  `\nvalidator: ok=${script.validation.ok} reconciled=${script.validation.reconciled} ` +
    `unreconciled=${script.validation.unreconciled.length} repairs=${script.validation.repairs}`,
);
console.log(`grounding: ${sheet.grounding}, ${Object.keys(sheet.facts).length} facts on sheet\n`);
console.log(failures ? `${failures} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
