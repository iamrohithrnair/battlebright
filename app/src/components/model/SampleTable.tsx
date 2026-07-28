'use client';

import { Check, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { BacktestSample, Confidence } from '@/lib/types';

type Filter = 'ALL' | 'HITS' | 'MISSES';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'HITS', label: 'Hits only' },
  { key: 'MISSES', label: 'Misses only' },
];

const CONFIDENCE_TONE: Record<Confidence, 'volt' | 'neutral' | 'outline'> = {
  HIGH: 'volt',
  MEDIUM: 'neutral',
  LOW: 'outline',
};

/** Every backtested fight, filterable down to just the misses. */
export function SampleTable({ samples }: { samples: BacktestSample[] }) {
  const [filter, setFilter] = useState<Filter>('ALL');

  const visible = useMemo(() => {
    if (filter === 'HITS') return samples.filter((s) => s.correct);
    if (filter === 'MISSES') return samples.filter((s) => !s.correct);
    return samples;
  }, [samples, filter]);

  const hits = samples.filter((s) => s.correct).length;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter backtest samples">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn(
                'inline-flex min-h-[44px] items-center rounded-md border px-3 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors duration-200 sm:min-h-[36px]',
                filter === key
                  ? 'border-ember bg-ember/15 text-ember-light'
                  : 'border-pit-600 bg-pit-900 text-ink-soft hover:border-pit-500 hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="font-mono text-xs text-ink-mute" data-numeric aria-live="polite">
          Showing {visible.length} of {samples.length} fights · {hits} hits ·{' '}
          {samples.length - hits} misses
        </p>
      </div>

      <div className="max-h-[560px] overflow-x-auto overflow-y-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <caption className="sr-only">
            Every fight in the backtest sample with the model&apos;s prediction and whether it was
            correct.
          </caption>
          <thead className="sticky top-0 z-base bg-pit-900">
            <tr className="border-b border-pit-600">
              <th scope="col" className="label-mono px-3 py-2">
                Season
              </th>
              <th scope="col" className="label-mono px-3 py-2">
                Fight
              </th>
              <th scope="col" className="label-mono px-3 py-2">
                Actual
              </th>
              <th scope="col" className="label-mono px-3 py-2">
                Predicted
              </th>
              <th scope="col" className="label-mono px-3 py-2">
                Confidence
              </th>
              <th scope="col" className="label-mono px-3 py-2">
                Result
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s, i) => (
              <tr
                key={`${s.season}-${s.robot_a}-${s.robot_b}-${i}`}
                className="border-b border-pit-700/70 transition-colors duration-200 hover:bg-pit-850/70"
              >
                <td className="px-3 py-2 font-mono text-sm text-ink-mute" data-numeric>
                  S{s.season}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  <span className="font-mono">{s.robot_a}</span>
                  <span className="mx-1.5 text-ink-mute">vs</span>
                  <span className="font-mono">{s.robot_b}</span>
                </td>
                <td className="px-3 py-2 font-mono text-sm text-ink">{s.actual}</td>
                <td className="px-3 py-2 font-mono text-sm text-ink-soft">{s.predicted}</td>
                <td className="px-3 py-2">
                  <Badge tone={CONFIDENCE_TONE[s.confidence]}>{s.confidence}</Badge>
                </td>
                <td className="px-3 py-2">
                  {s.correct ? (
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.1em] text-win">
                      <Check aria-hidden="true" className="h-3.5 w-3.5" />
                      Hit
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.1em] text-lose">
                      <X aria-hidden="true" className="h-3.5 w-3.5" />
                      Miss
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
