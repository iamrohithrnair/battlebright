import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'volt' | 'ember' | 'win' | 'lose' | 'outline';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  size?: BadgeSize;
  /** Leading icon. Colour is never the only signal, so pair tones with an icon. */
  icon?: ReactNode;
  className?: string;
  /** Renders a small pulsing dot, for live/streaming states. */
  pulse?: boolean;
}

const TONES: Record<BadgeTone, string> = {
  neutral: 'border-pit-500 bg-pit-800 text-ink-soft',
  volt: 'border-volt/40 bg-volt/10 text-volt-light',
  ember: 'border-ember/40 bg-ember/10 text-ember-light',
  win: 'border-win/40 bg-win/10 text-win',
  lose: 'border-lose/40 bg-lose/10 text-lose',
  outline: 'border-pit-600 bg-transparent text-ink-mute',
};

const SIZES: Record<BadgeSize, string> = {
  sm: 'h-[22px] px-2 text-[10px] gap-1',
  md: 'h-7 px-2.5 text-[11px] gap-1.5',
};

export function Badge({
  children,
  tone = 'neutral',
  size = 'sm',
  icon,
  className,
  pulse = false,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded border font-mono font-medium uppercase tracking-[0.1em]',
        TONES[tone],
        SIZES[size],
        className,
      )}
    >
      {pulse ? (
        <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      ) : null}
      {icon ? (
        <span aria-hidden="true" className="shrink-0 [&>svg]:h-3 [&>svg]:w-3">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
