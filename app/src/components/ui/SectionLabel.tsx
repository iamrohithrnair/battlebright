import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SectionLabelProps {
  children: ReactNode;
  className?: string;
  /** Draws a short rule after the text, which reads as an instrument seam. */
  rule?: boolean;
  /** Optional leading icon (a lucide component). */
  icon?: ReactNode;
}

/** Uppercase tracked-out mono label that heads every section in the app. */
export function SectionLabel({ children, className, rule = false, icon }: SectionLabelProps) {
  return (
    <p className={cn('label-mono flex items-center gap-2', className)}>
      {icon ? (
        <span className="text-volt" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
      {rule ? <span aria-hidden="true" className="hairline ml-1 flex-1" /> : null}
    </p>
  );
}
