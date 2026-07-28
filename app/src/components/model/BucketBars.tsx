import { cn } from '@/lib/cn';
import type { Bucket } from '@/lib/types';

export interface BucketRow {
  /** Row heading, e.g. "HIGH" or "KO". */
  label: string;
  /** One line of plain-language context for the row. */
  note?: string;
  bucket: Bucket;
}

/**
 * Horizontal accuracy bars built from divs. Each row shows the accuracy bar, the
 * raw correct/total counts, and the row's share of the whole backtest sample —
 * so a strong percentage on a thin slice of fights can't hide.
 */
export function BucketBars({
  rows,
  sampleTotal,
  tone = 'volt',
}: {
  rows: BucketRow[];
  /** Denominator for the share column — the full backtest sample size. */
  sampleTotal: number;
  tone?: 'volt' | 'ember';
}) {
  return (
    <ul className="space-y-4">
      {rows.map(({ label, note, bucket }) => {
        const share = sampleTotal ? (bucket.total / sampleTotal) * 100 : 0;
        return (
          <li key={label}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-ink">
                {label}
              </p>
              <p className="font-mono text-sm text-ink" data-numeric>
                {bucket.accuracy.toFixed(1)}%
                <span className="ml-2 text-xs text-ink-mute">
                  {bucket.correct}/{bucket.total} correct
                </span>
              </p>
            </div>

            <div
              aria-hidden="true"
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-pit-850"
            >
              <div
                className={cn('h-full rounded-full', tone === 'volt' ? 'bg-volt' : 'bg-ember')}
                style={{ width: `${Math.min(100, Math.max(0, bucket.accuracy))}%` }}
              />
            </div>

            <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-xs leading-snug text-ink-mute">{note}</p>
              <p className="font-mono text-[11px] text-ink-mute" data-numeric>
                {share.toFixed(1)}% of sample
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
