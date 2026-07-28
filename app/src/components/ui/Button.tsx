import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  // Amber is the single CTA colour in the system — use it sparingly.
  primary:
    'border-ember bg-ember text-pit-950 font-semibold hover:bg-ember-light hover:border-ember-light',
  secondary: 'border-pit-500 bg-pit-800 text-ink hover:border-volt/60 hover:bg-pit-700',
  ghost: 'border-transparent bg-transparent text-ink-soft hover:bg-pit-800 hover:text-ink',
  danger: 'border-lose/50 bg-lose/10 text-lose hover:bg-lose/20 hover:border-lose',
};

const SIZES: Record<ButtonSize, string> = {
  // Every size clears the 44px touch-target minimum on its own or via min-h.
  sm: 'min-h-[44px] px-3 text-xs gap-1.5 sm:min-h-0 sm:h-9',
  md: 'min-h-[44px] px-4 text-sm gap-2',
  lg: 'min-h-[52px] px-6 text-sm gap-2.5',
};

const BASE =
  'inline-flex items-center justify-center whitespace-nowrap rounded-md border font-mono uppercase tracking-[0.08em] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-pit-950 disabled:opacity-50 disabled:cursor-not-allowed';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  /** Icon rendered after the label. */
  iconAfter?: ReactNode;
  className?: string;
  /** When set, renders a Next.js <Link> styled identically. */
  href?: string;
  full?: boolean;
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  iconAfter,
  className,
  href,
  full = false,
  ...rest
}: ButtonProps) {
  const classes = cn(BASE, VARIANTS[variant], SIZES[size], full && 'w-full', className);

  const inner = (
    <>
      {icon ? (
        <span aria-hidden="true" className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
      ) : null}
      {children}
      {iconAfter ? (
        <span aria-hidden="true" className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">
          {iconAfter}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes} aria-label={rest['aria-label']}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...rest}>
      {inner}
    </button>
  );
}
