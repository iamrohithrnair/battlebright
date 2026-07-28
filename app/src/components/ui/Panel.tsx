import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The base surface of the whole app: a hairline-bordered instrument panel with
 * small bracket accents at the corners.
 */
export interface PanelProps {
  children: ReactNode;
  className?: string;
  /** Optional heading rendered in the panel's title bar. */
  title?: ReactNode;
  /** Small uppercase mono label above the title. */
  label?: string;
  /** Right-aligned slot in the title bar (controls, badges, counts). */
  action?: ReactNode;
  /** Draws the bracket corner accents. */
  brackets?: boolean;
  /** Removes the inner padding, for tables and canvases that bleed to the edge. */
  flush?: boolean;
  /** Renders a faint blueprint grid behind the content. */
  grid?: boolean;
  as?: 'div' | 'section' | 'article' | 'aside';
}

export function Panel({
  children,
  className,
  title,
  label,
  action,
  brackets = true,
  flush = false,
  grid = false,
  as: Tag = 'div',
}: PanelProps) {
  return (
    <Tag
      className={cn(
        'relative rounded-lg border border-pit-600 bg-pit-900/70 shadow-panel backdrop-blur-sm',
        className,
      )}
    >
      {grid ? (
        <div
          aria-hidden="true"
          className="bg-blueprint-fine mask-fade-b pointer-events-none absolute inset-0 rounded-lg opacity-60"
        />
      ) : null}

      {brackets ? <PanelBrackets /> : null}

      {label || title || action ? (
        <header
          className={cn(
            'relative flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-pit-600 px-4 py-3 sm:px-5',
          )}
        >
          <div className="min-w-0">
            {label ? <p className="label-mono mb-1">{label}</p> : null}
            {title ? (
              <h2 className="truncate font-display text-base font-semibold text-ink sm:text-lg">
                {title}
              </h2>
            ) : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </header>
      ) : null}

      <div className={cn('relative', !flush && 'p-4 sm:p-5')}>{children}</div>
    </Tag>
  );
}

/** Four L-shaped corner marks — the app's signature "engineering readout" tell. */
function PanelBrackets() {
  const base = 'pointer-events-none absolute h-2.5 w-2.5 border-volt/40';
  return (
    <span aria-hidden="true">
      <span className={cn(base, '-left-px -top-px rounded-tl-lg border-l border-t')} />
      <span className={cn(base, '-right-px -top-px rounded-tr-lg border-r border-t')} />
      <span className={cn(base, '-bottom-px -left-px rounded-bl-lg border-b border-l')} />
      <span className={cn(base, '-bottom-px -right-px rounded-br-lg border-b border-r')} />
    </span>
  );
}
