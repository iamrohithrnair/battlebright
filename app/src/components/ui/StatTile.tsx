import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface StatTileProps {
  /** Uppercase mono caption, e.g. "MODEL ACCURACY". */
  label: string;
  /** The headline figure. Rendered in tabular mono. */
  value: ReactNode;
  /** Small trailing unit such as "%" or "lb". */
  unit?: string;
  /** One line of supporting context under the value. */
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'neutral' | 'volt' | 'ember' | 'win' | 'lose';
  className?: string;
  /** Compact variant for dense strips. */
  compact?: boolean;
}

const VALUE_TONE: Record<NonNullable<StatTileProps['tone']>, string> = {
  neutral: 'text-ink',
  volt: 'text-volt-light',
  ember: 'text-ember-light',
  win: 'text-win',
  lose: 'text-lose',
};

export function StatTile({
  label,
  value,
  unit,
  hint,
  icon,
  tone = 'neutral',
  className,
  compact = false,
}: StatTileProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg border border-pit-600 bg-pit-900/60 transition-colors duration-200 hover:border-pit-500',
        compact ? 'p-3' : 'p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="label-mono">{label}</p>
        {icon ? (
          <span
            aria-hidden="true"
            className="shrink-0 text-ink-mute transition-colors duration-200 group-hover:text-volt [&>svg]:h-4 [&>svg]:w-4"
          >
            {icon}
          </span>
        ) : null}
      </div>

      <p
        className={cn(
          'mt-2 flex items-baseline gap-1 font-display font-semibold leading-none',
          compact ? 'text-xl' : 'text-2xl sm:text-3xl',
          VALUE_TONE[tone],
        )}
        data-numeric
      >
        {value}
        {unit ? <span className="text-sm font-normal text-ink-mute">{unit}</span> : null}
      </p>

      {hint ? <p className="mt-1.5 text-xs leading-snug text-ink-mute">{hint}</p> : null}
    </div>
  );
}
