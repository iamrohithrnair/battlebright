'use client';

import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TooltipProps {
  /** The trigger. Must be focusable for keyboard users. */
  children: ReactNode;
  /** Tooltip body text. */
  content: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}

/**
 * A dependency-free tooltip that opens on hover *and* on focus, so the
 * information is reachable without a pointer.
 */
export function Tooltip({ children, content, side = 'top', className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>

      {open ? (
        <span
          role="tooltip"
          id={id}
          className={cn(
            'z-overlay pointer-events-none absolute left-1/2 w-max max-w-[240px] -translate-x-1/2 rounded-md border border-pit-500 bg-pit-850 px-2.5 py-1.5 text-xs leading-snug text-ink shadow-panel',
            side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
