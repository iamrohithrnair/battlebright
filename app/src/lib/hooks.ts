'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks the `prefers-reduced-motion` media query.
 *
 * Returns `false` during SSR and the first client render so the markup matches,
 * then flips on mount. Consumers use it to gate GSAP/motion timelines and to
 * drop R3F canvases to `frameloop="never"`.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/** True once the component has mounted on the client. Guards `window` access. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/**
 * Reports whether the element has scrolled into (or near) the viewport, so heavy
 * canvases below the fold can mount lazily.
 */
export function useInView<T extends Element>(
  ref: React.RefObject<T | null>,
  { rootMargin = '200px', once = true }: { rootMargin?: string; once?: boolean } = {},
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin, once]);

  return inView;
}
