import { cn } from '@/lib/cn';

export interface ProbabilityBarProps {
  /** Left-hand side label, usually robot A. */
  labelA: string;
  /** Right-hand side label, usually robot B. */
  labelB: string;
  /** Probability for A, 0-100. B is inferred as 100 - probA. */
  probA: number;
  /** Highlights the favoured side with the amber CTA colour. */
  highlightWinner?: boolean;
  className?: string;
  /** Hides the numeric readouts, for compact inline use. */
  bareBar?: boolean;
  /** Height of the track. */
  size?: 'sm' | 'md' | 'lg';
}

const TRACK: Record<NonNullable<ProbabilityBarProps['size']>, string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

/**
 * A two-sided win-probability bar. The favoured side is labelled as well as
 * coloured, so the winner is never communicated by colour alone.
 */
export function ProbabilityBar({
  labelA,
  labelB,
  probA,
  highlightWinner = true,
  className,
  bareBar = false,
  size = 'md',
}: ProbabilityBarProps) {
  const a = Math.min(100, Math.max(0, probA));
  const b = Math.round((100 - a) * 10) / 10;
  const aLeads = a >= b;

  return (
    <div className={cn('w-full', className)}>
      {!bareBar ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
          <span
            className={cn(
              'flex min-w-0 items-baseline gap-1.5 font-mono',
              aLeads ? 'text-ink' : 'text-ink-mute',
            )}
          >
            <span className="truncate font-medium">{labelA}</span>
            <span data-numeric className={aLeads && highlightWinner ? 'text-ember-light' : ''}>
              {a.toFixed(1)}%
            </span>
          </span>
          <span
            className={cn(
              'flex min-w-0 items-baseline gap-1.5 font-mono',
              !aLeads ? 'text-ink' : 'text-ink-mute',
            )}
          >
            <span data-numeric className={!aLeads && highlightWinner ? 'text-ember-light' : ''}>
              {b.toFixed(1)}%
            </span>
            <span className="truncate font-medium">{labelB}</span>
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          'flex w-full overflow-hidden rounded-full border border-pit-600 bg-pit-850',
          TRACK[size],
        )}
        role="img"
        aria-label={`${labelA} ${a.toFixed(1)} percent, ${labelB} ${b.toFixed(1)} percent`}
      >
        <div
          className={cn(
            'h-full transition-[width] duration-700 ease-out',
            aLeads && highlightWinner ? 'bg-ember' : 'bg-volt',
          )}
          style={{ width: `${a}%` }}
        />
        <div
          className={cn(
            'h-full flex-1 transition-[width] duration-700 ease-out',
            !aLeads && highlightWinner ? 'bg-ember' : 'bg-volt-deep',
          )}
        />
      </div>
    </div>
  );
}
