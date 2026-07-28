import { cn } from '@/lib/cn';

export interface SkeletonProps {
  className?: string;
  /** Convenience shapes so callers rarely need bespoke classes. */
  variant?: 'block' | 'text' | 'circle';
}

/**
 * Loading placeholder. Callers must size it to match the real content so async
 * data never causes a layout jump.
 */
export function Skeleton({ className, variant = 'block' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden bg-pit-800',
        variant === 'block' && 'h-full w-full rounded-md',
        variant === 'text' && 'h-3.5 w-full rounded',
        variant === 'circle' && 'aspect-square rounded-full',
        className,
      )}
    >
      <span className="absolute inset-0 -translate-x-full animate-sweep bg-gradient-to-r from-transparent via-pit-600/70 to-transparent" />
    </div>
  );
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

/** A paragraph-shaped skeleton with a shortened final line. */
export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} variant="text" className={i === lines - 1 ? 'w-2/3' : 'w-full'} />
      ))}
    </div>
  );
}
