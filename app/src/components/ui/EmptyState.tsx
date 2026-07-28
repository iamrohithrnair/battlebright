import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  title: string;
  /** One or two sentences explaining what happened and what to do next. */
  description?: ReactNode;
  /** A lucide icon element. */
  icon?: ReactNode;
  /** Buttons or links offering the next step. */
  action?: ReactNode;
  /** Amber framing for genuine error states, blue for merely-empty ones. */
  tone?: 'neutral' | 'error';
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  tone = 'neutral',
  className,
}: EmptyStateProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center',
        tone === 'error' ? 'border-ember/40 bg-ember/[0.04]' : 'border-pit-600 bg-pit-900/40',
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className={cn(
            'mb-4 flex h-11 w-11 items-center justify-center rounded-lg border',
            tone === 'error'
              ? 'border-ember/40 bg-ember/10 text-ember'
              : 'border-pit-600 bg-pit-850 text-ink-mute',
            '[&>svg]:h-5 [&>svg]:w-5',
          )}
        >
          {icon}
        </span>
      ) : null}

      <h3 className="font-display text-base font-semibold text-ink">{title}</h3>

      {description ? (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{description}</p>
      ) : null}

      {action ? <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div> : null}
    </div>
  );
}
