import {
  Activity,
  CheckCheck,
  FlaskConical,
  Gauge,
  Minus,
  ShieldAlert,
  Sigma,
  TrendingUp,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BucketBars } from '@/components/model/BucketBars';
import { SampleTable } from '@/components/model/SampleTable';
import { SeasonAccuracyChart } from '@/components/model/SeasonAccuracyChart';
import { Badge, Panel, SectionLabel, StatTile } from '@/components/ui';
import { backtest, WEIGHTS } from '@/lib/engine';
import { pct } from '@/lib/format';

export const metadata: Metadata = {
  title: 'The Model',
  description:
    'How the prediction engine performs when replayed against every recorded fight: accuracy versus the coin-flip baseline, the weighted formula, calibration by confidence, and the full sample.',
};

const TERMS = [
  {
    term: 'win_rate',
    label: 'Career form',
    weight: WEIGHTS.form,
    measures: 'Wins divided by total recorded fights.',
    why: 'The single most durable signal in the dataset — a bot that keeps winning keeps winning — so it carries the largest weight.',
  },
  {
    term: 'ko_rate',
    label: 'Finishing power',
    weight: WEIGHTS.finishing,
    measures: 'Share of a bot\u2019s wins that ended by knockout.',
    why: 'Separates bots that end fights from bots that survive them. Weighted below form because it rests on a smaller denominator: wins only.',
  },
  {
    term: '0.5 + weapon_edge',
    label: 'Weapon matchup',
    weight: WEIGHTS.matchup,
    measures: 'Class-versus-class advantage, in −1…+1, centred on 0.5.',
    why: 'Weapon class is the strongest situational term: a spinner against a lifter is a different fight regardless of either record.',
  },
  {
    term: 'h2h',
    label: 'Head-to-head',
    weight: WEIGHTS.h2h,
    measures: 'Prior meetings between exactly these two bots.',
    why: 'Real but thin — most pairs have never met. Deliberately the smallest weight, and switched off entirely for every number on this page.',
  },
] as const;

export default function ModelPage() {
  const bt = backtest();
  const delta = bt.accuracy - bt.baseline;

  const conf = bt.by_confidence;
  const risesFully = conf.HIGH.accuracy > conf.MEDIUM.accuracy && conf.MEDIUM.accuracy > conf.LOW.accuracy;
  const highBeatsLow = conf.HIGH.accuracy > conf.LOW.accuracy;

  const method = bt.by_method;
  const methodGap = method.KO.accuracy - method.JD.accuracy;
  const easierMethod = methodGap >= 0 ? 'knockouts' : 'judges\u2019 decisions';

  const seasonsAbove = bt.by_season.filter((s) => s.accuracy > bt.baseline).length;

  return (
    <div className="shell pb-24 pt-28 sm:pt-32">
      <header className="mb-8 max-w-3xl">
        <SectionLabel icon={<FlaskConical className="h-3.5 w-3.5" />} rule>
          The Model
        </SectionLabel>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-5xl">
          Every number, and how well it held up.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-soft">
          A backtest replays the model over fights that have already happened and asks it to pick a
          winner without being told the answer — so accuracy here is measured against{' '}
          {bt.total} real results, not against a hunch.
        </p>
      </header>

      {/* 2 — Headline accuracy vs baseline */}
      <section className="mb-12" aria-labelledby="headline-heading">
        <h2 id="headline-heading" className="sr-only">
          Headline accuracy
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Backtest accuracy"
            value={pct(bt.accuracy)}
            tone="volt"
            icon={<Gauge />}
            hint={`${bt.correct} of ${bt.total} fights called correctly`}
          />
          <StatTile
            label="Coin-flip baseline"
            value={pct(bt.baseline, 0)}
            icon={<Minus />}
            hint="What guessing at random would score on a two-bot fight"
          />
          <StatTile
            label="Edge over baseline"
            value={`+${delta.toFixed(1)}`}
            unit="pts"
            tone="ember"
            icon={<TrendingUp />}
            hint={`+${delta.toFixed(1)} pts vs coin flip`}
          />
          <StatTile
            label="Correct / total"
            value={`${bt.correct}/${bt.total}`}
            icon={<CheckCheck />}
            hint={`${bt.total - bt.correct} misses across ${bt.by_season.length} seasons`}
          />
        </div>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-ink-soft">
          The model calls {pct(bt.accuracy)} of recorded fights correctly, {delta.toFixed(1)}{' '}
          percentage points clear of a coin flip, and finishes above the baseline in{' '}
          {seasonsAbove} of {bt.by_season.length} seasons. That is a real edge, not a solved
          problem — {bt.total - bt.correct} fights still went the other way.
        </p>
      </section>

      {/* 3 — The formula */}
      <section className="mb-12" aria-labelledby="formula-heading">
        <div className="mb-4">
          <SectionLabel icon={<Sigma className="h-3.5 w-3.5" />} rule>
            The formula
          </SectionLabel>
          <h2
            id="formula-heading"
            className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl"
          >
            Three signals, fixed weights, no black box.
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <Panel label="Score" title="Per-bot score" grid>
            <div className="overflow-x-auto">
              <code className="block whitespace-nowrap font-mono text-xs leading-relaxed text-volt-light sm:text-sm">
                score = {WEIGHTS.form.toFixed(2)}·win_rate + {WEIGHTS.finishing.toFixed(2)}·ko_rate
                + {WEIGHTS.matchup.toFixed(2)}·(0.5 + weapon_edge)
              </code>
            </div>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              Both bots are scored with the same expression. Win probability is each bot&apos;s
              share of the combined score, so the two numbers always sum to 100% and every one of
              them can be recomputed by hand.
            </p>
            <div className="hairline my-4" />
            <p className="text-sm leading-relaxed text-ink-mute">
              Confidence is derived from the margin between the two probabilities: above 20 points
              is HIGH, above 8 is MEDIUM, anything tighter is LOW.
            </p>
          </Panel>

          <Panel label="Terms" title="What each weight buys" flush>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-pit-600">
                    <th scope="col" className="label-mono px-4 py-2">
                      Term
                    </th>
                    <th scope="col" className="label-mono px-4 py-2 text-right">
                      Weight
                    </th>
                    <th scope="col" className="label-mono px-4 py-2">
                      What it measures
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {TERMS.map((t) => (
                    <tr key={t.term} className="border-b border-pit-700/70 align-top">
                      <td className="px-4 py-3">
                        <p className="font-mono text-sm text-ink">{t.label}</p>
                        <code className="font-mono text-[11px] text-volt-light">{t.term}</code>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-sm text-ink" data-numeric>
                          ×{t.weight.toFixed(2)}
                        </span>
                        {t.term === 'h2h' ? (
                          <span className="mt-1.5 block">
                            <Badge tone="ember" icon={<ShieldAlert />}>
                              off here
                            </Badge>
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm leading-relaxed text-ink-soft">{t.measures}</p>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-mute">{t.why}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <Panel
          className="mt-4 border-ember/40 bg-ember/[0.04]"
          label="Methodology"
          title="Why head-to-head is switched off during backtesting"
        >
          <p className="text-base leading-relaxed text-ink-soft">
            Head-to-head history is built from the same match log the backtest scores itself
            against. Leave it on and the model can look up the result of the very fight it is being
            asked to predict — the answer leaks into the input, accuracy inflates, and the number
            stops meaning anything. So{' '}
            <code className="font-mono text-ember-light">h2h</code> is passed as{' '}
            <code className="font-mono text-ember-light">false</code> for every fight on this page.
          </p>
          <p className="mt-3 text-base leading-relaxed text-ink-soft">
            It <em>is</em> applied for live predictions on{' '}
            <Link
              href="/predict"
              className="font-medium text-ember-light underline decoration-ember/40 underline-offset-4 transition-colors duration-200 hover:decoration-ember"
            >
              the matchup page
            </Link>
            , where a prior meeting is legitimate evidence about a fight that has not happened yet.
            Every figure below is therefore a floor, not a showcase: the live model has one more
            signal than the one measured here.
          </p>
        </Panel>
      </section>

      {/* 4 — Accuracy by confidence */}
      <section className="mb-12" aria-labelledby="confidence-heading">
        <div className="mb-4">
          <SectionLabel icon={<Activity className="h-3.5 w-3.5" />} rule>
            Calibration
          </SectionLabel>
          <h2
            id="confidence-heading"
            className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl"
          >
            Does confidence mean anything?
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Panel label="By confidence" title="Accuracy per confidence bucket">
            <BucketBars
              sampleTotal={bt.total}
              rows={[
                {
                  label: 'High',
                  bucket: conf.HIGH,
                  note: 'Margin wider than 20 points.',
                },
                {
                  label: 'Medium',
                  bucket: conf.MEDIUM,
                  note: 'Margin between 8 and 20 points.',
                },
                {
                  label: 'Low',
                  bucket: conf.LOW,
                  note: 'Margin under 8 points — effectively a coin flip.',
                },
              ]}
            />
          </Panel>

          <Panel label="Reading it" title="What the buckets say">
            <p className="text-base leading-relaxed text-ink-soft">
              A model is well calibrated when it is right more often on the fights it claims to be
              sure about.{' '}
              {risesFully
                ? `That holds here: accuracy climbs from ${pct(conf.LOW.accuracy)} on LOW-margin
                   fights to ${pct(conf.MEDIUM.accuracy)} on MEDIUM and ${pct(conf.HIGH.accuracy)}
                   on HIGH, in order and without exception.`
                : highBeatsLow
                  ? `It holds at the ends but not in the middle: HIGH lands ${pct(conf.HIGH.accuracy)}
                     against LOW's ${pct(conf.LOW.accuracy)}, while MEDIUM sits at
                     ${pct(conf.MEDIUM.accuracy)} and breaks the monotonic climb.`
                  : `It does not hold here: HIGH-confidence fights land ${pct(conf.HIGH.accuracy)}
                     against ${pct(conf.LOW.accuracy)} for LOW-margin ones, so the confidence label
                     is not currently earning its place.`}
            </p>
            <div className="hairline my-4" />
            <p className="text-sm leading-relaxed text-ink-mute">
              Bucket sizes matter as much as bucket accuracy. HIGH covers{' '}
              <span data-numeric>{conf.HIGH.total}</span> of{' '}
              <span data-numeric>{bt.total}</span> fights; a small bucket can post a flattering
              percentage on very little evidence, which is why every bar above is labelled with its
              share of the sample.
            </p>
          </Panel>
        </div>
      </section>

      {/* 5 — Accuracy by finish method */}
      <section className="mb-12" aria-labelledby="method-heading">
        <h2
          id="method-heading"
          className="mb-4 font-display text-2xl font-bold tracking-tight sm:text-3xl"
        >
          Accuracy by finish method
        </h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Panel label="By method" title="Knockouts versus judges' decisions">
            <BucketBars
              tone="ember"
              sampleTotal={bt.total}
              rows={[
                {
                  label: 'KO — knockout',
                  bucket: method.KO,
                  note: 'Fight ended by disabling the opponent.',
                },
                {
                  label: 'JD — judges\u2019 decision',
                  bucket: method.JD,
                  note: 'Fight went the distance and was scored.',
                },
              ]}
            />
          </Panel>
          <Panel label="Reading it" title="Why the gap exists">
            <p className="text-base leading-relaxed text-ink-soft">
              The model is {Math.abs(methodGap).toFixed(1)} percentage points better at{' '}
              {easierMethod} — {pct(method.KO.accuracy)} on KOs against{' '}
              {pct(method.JD.accuracy)} on decisions.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-mute">
              That direction is expected. Knockouts are what happens when a mismatch resolves
              physically, and mismatch is exactly what the form, finishing and weapon-edge terms
              measure. Decisions are the close fights — three rounds of damage, aggression and
              control judged by humans — and nothing in this feature set sees them coming.
            </p>
          </Panel>
        </div>
      </section>

      {/* 6 — Season-by-season */}
      <section className="mb-12" aria-labelledby="seasons-heading">
        <h2
          id="seasons-heading"
          className="mb-4 font-display text-2xl font-bold tracking-tight sm:text-3xl"
        >
          Season by season
        </h2>
        <Panel label="Stability" title="Backtest accuracy per season" grid>
          <SeasonAccuracyChart seasons={bt.by_season} />
          <p className="mt-4 text-base leading-relaxed text-ink-soft">
            The point of this chart is not the peak, it is the spread. The model clears the
            coin-flip line in {seasonsAbove} of {bt.by_season.length} seasons; where it dips, the
            season&apos;s sample is small enough that a handful of upsets moves the number several
            points.
          </p>
        </Panel>
      </section>

      {/* 7 — Full sample */}
      <section aria-labelledby="samples-heading">
        <h2
          id="samples-heading"
          className="mb-4 font-display text-2xl font-bold tracking-tight sm:text-3xl"
        >
          The full sample
        </h2>
        <Panel
          label="Receipts"
          title={`All ${bt.total} backtested fights`}
          action={
            <Badge tone="volt">
              h2h off
            </Badge>
          }
        >
          <SampleTable samples={bt.samples} />
        </Panel>
      </section>
    </div>
  );
}
