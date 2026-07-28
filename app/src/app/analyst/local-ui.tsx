import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Local stand-ins for the shared primitives this feature needs but which do not
 * exist in `src/components/ui/` yet (`Badge`, `Skeleton`). `Panel` and
 * `SectionLabel` come from the shared set; these match their visual language so
 * the two can be swapped later without a redesign.
 */

type Tone = 'neutral' | 'data' | 'accent' | 'good' | 'bad';

const TONES: Record<Tone, string> = {
  neutral: 'border-pit-600 bg-pit-850 text-ink-soft',
  data: 'border-volt/40 bg-volt/10 text-volt-light',
  accent: 'border-ember/40 bg-ember/10 text-ember-light',
  good: 'border-win/40 bg-win/10 text-win',
  bad: 'border-lose/40 bg-lose/10 text-lose',
};

export function Badge({
  children,
  tone = 'neutral',
  icon,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em]',
        TONES[tone],
        className,
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}

/** Reserves space for streaming content so nothing jumps when text lands. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('relative block overflow-hidden rounded bg-pit-800', className)}
    >
      <span className="absolute inset-y-0 -left-full w-full animate-sweep bg-gradient-to-r from-transparent via-pit-600/60 to-transparent" />
    </span>
  );
}
