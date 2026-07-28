'use client';

import { cn } from '@/lib/cn';
import type { SimulationResult } from '@/lib/engine';

export interface MonteCarloProps {
  simulation: SimulationResult;
  robotA: string;
  robotB: string;
  /** The single-number prediction, drawn as a marker line for comparison. */
  pointEstimate: number;
}

/**
 * Monte Carlo distribution as a hand-rolled histogram.
 *
 * The point is to show judges a *spread* — the model's single number is one line
 * on this chart, not the whole story.
 */
export function MonteCarlo({ simulation, robotA, robotB, pointEstimate }: MonteCarloProps) {
  const peak = Math.max(...simulation.histogram.map((h) => h.count), 1);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <p className="text-xs leading-snug text-ink-soft">
          <span className="font-mono font-semibold text-ink" data-numeric>
            {simulation.trials.toLocaleString()}
          </span>{' '}
          simulated fights, each perturbing the model&apos;s signals with Gaussian noise.
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
          x: P({robotA} wins) · y: frequency
        </p>
      </div>

      <div className="relative">
        {/* Histogram */}
        <div
          className="flex h-36 items-end gap-[3px]"
          role="img"
          aria-label={`Distribution of simulated win probability for ${robotA}, peaking around ${
            simulation.histogram.reduce((best, h) => (h.count > best.count ? h : best)).label
          }. ${robotA} won ${simulation.prob_a} percent of ${simulation.trials} trials.`}
        >
          {simulation.histogram.map((bin) => {
            const height = (bin.count / peak) * 100;
            const favoursA = bin.bucket >= 50;
            return (
              <div key={bin.bucket} className="group relative flex-1">
                <div
                  className={cn(
                    'w-full rounded-t-sm transition-colors duration-200',
                    favoursA ? 'bg-volt/70 group-hover:bg-volt' : 'bg-pit-500 group-hover:bg-pit-500/80',
                  )}
                  style={{ height: `${Math.max(height, bin.count > 0 ? 2 : 0)}%` }}
                />
                {/* Hover readout, positioned so it never causes layout shift. */}
                <div className="z-sticky pointer-events-none absolute bottom-full left-1/2 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded border border-pit-500 bg-pit-850 px-2 py-1 font-mono text-[10px] text-ink group-hover:block">
                  {bin.label} · {bin.count} runs
                </div>
              </div>
            );
          })}
        </div>

        {/* The deterministic prediction, for comparison against the spread. */}
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-ember"
          style={{ left: `${Math.min(99.5, Math.max(0.5, pointEstimate))}%` }}
        >
          <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-ember" />
        </div>
      </div>

      {/* Axis */}
      <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-mute">
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-pit-600 bg-pit-600">
        <Cell label={`${robotA} wins`} value={`${simulation.prob_a}%`} tone="volt" />
        <Cell label={`${robotB} wins`} value={`${simulation.prob_b}%`} tone="ember" />
        <Cell label="Ended by KO" value={`${simulation.ko_share}%`} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2.5 rounded-sm bg-volt/70" />
          favours {robotA}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2.5 rounded-sm bg-pit-500" />
          favours {robotB}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-px bg-ember" />
          model point estimate
        </span>
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'volt' | 'ember';
}) {
  return (
    <div className="bg-pit-900 px-3 py-2.5">
      <p className="label-mono truncate">{label}</p>
      <p
        className={cn(
          'mt-0.5 font-display text-lg font-semibold',
          tone === 'volt' && 'text-volt-light',
          tone === 'ember' && 'text-ember-light',
          tone === 'neutral' && 'text-ink',
        )}
        data-numeric
      >
        {value}
      </p>
    </div>
  );
}
