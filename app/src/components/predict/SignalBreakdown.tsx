'use client';

import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Prediction } from '@/lib/types';

/**
 * The receipt for the number. Each weighted term is shown side by side, so a
 * judge can add the bars up and land on the same probability the model did.
 */
export function SignalBreakdown({ prediction }: { prediction: Prediction }) {
  const { contributions, robot_a, robot_b } = prediction;

  // Scale bars against the largest single contribution so small terms stay legible.
  const peak = Math.max(
    0.05,
    ...contributions.flatMap((c) => [Math.abs(c.a), Math.abs(c.b)]),
  );

  const totalA = contributions.reduce((sum, c) => sum + c.a, 0);
  const totalB = contributions.reduce((sum, c) => sum + c.b, 0);

  return (
    <div>
      <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs">
        <span className="truncate text-right font-mono font-medium text-volt-light">{robot_a}</span>
        <span className="label-mono">signal</span>
        <span className="truncate font-mono font-medium text-ember-light">{robot_b}</span>
      </div>

      <ul className="space-y-3.5">
        {contributions.map((c) => {
          const leadsA = c.a > c.b + 0.0001;
          const leadsB = c.b > c.a + 0.0001;
          return (
            <li key={c.label}>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                {/* Bot A — bar grows leftward from the centre. */}
                <div className="flex items-center justify-end gap-2">
                  <span
                    className={cn(
                      'font-mono text-xs',
                      leadsA ? 'font-semibold text-ink' : 'text-ink-mute',
                    )}
                    data-numeric
                  >
                    {c.a.toFixed(3)}
                  </span>
                  <div className="h-2 w-full max-w-[130px] overflow-hidden rounded-l-full bg-pit-850">
                    <div
                      className={cn(
                        'ml-auto h-full rounded-l-full transition-[width] duration-700 ease-out',
                        leadsA ? 'bg-volt' : 'bg-volt-deep',
                      )}
                      style={{ width: `${Math.min(100, (Math.abs(c.a) / peak) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Label + weight */}
                <div className="w-[104px] shrink-0 text-center sm:w-[130px]">
                  <p className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                    {c.label}
                  </p>
                  <p className="font-mono text-[10px] text-ink-mute" data-numeric>
                    weight ×{c.weight.toFixed(2)}
                  </p>
                </div>

                {/* Bot B — bar grows rightward. */}
                <div className="flex items-center gap-2">
                  <div className="h-2 w-full max-w-[130px] overflow-hidden rounded-r-full bg-pit-850">
                    <div
                      className={cn(
                        'h-full rounded-r-full transition-[width] duration-700 ease-out',
                        leadsB ? 'bg-ember' : 'bg-ember-deep',
                      )}
                      style={{ width: `${Math.min(100, (Math.abs(c.b) / peak) * 100)}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      'font-mono text-xs',
                      leadsB ? 'font-semibold text-ink' : 'text-ink-mute',
                    )}
                    data-numeric
                  >
                    {c.b.toFixed(3)}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hairline my-4" />

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex items-center justify-end gap-2">
          <Edge value={totalA - totalB} />
          <span className="font-display text-sm font-bold text-ink" data-numeric>
            {totalA.toFixed(3)}
          </span>
        </div>
        <span className="w-[104px] shrink-0 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft sm:w-[130px]">
          total score
        </span>
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-bold text-ink" data-numeric>
            {totalB.toFixed(3)}
          </span>
          <Edge value={totalB - totalA} />
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink-mute">
        Win probability is each bot&apos;s share of the combined score:{' '}
        <code className="font-mono text-volt-light">
          {totalA.toFixed(3)} / {(totalA + totalB).toFixed(3)} ={' '}
          {((totalA / (totalA + totalB)) * 100).toFixed(1)}%
        </code>
      </p>
    </div>
  );
}

/** Direction marker so the leading side is never signalled by colour alone. */
function Edge({ value }: { value: number }) {
  if (Math.abs(value) < 0.0005) {
    return <Minus aria-label="level" className="h-3.5 w-3.5 text-ink-mute" />;
  }
  return value > 0 ? (
    <TrendingUp aria-label="ahead" className="h-3.5 w-3.5 text-win" />
  ) : (
    <TrendingDown aria-label="behind" className="h-3.5 w-3.5 text-lose" />
  );
}
