'use client';

/**
 * Broadcast-desk level meter, driven by the actual playing audio through a Web
 * Audio AnalyserNode.
 *
 * Restrained on purpose: thin bars on a fixed baseline, one accent colour, no
 * rainbow. It should read as studio instrumentation, not a music visualiser.
 *
 * Falls back to a flat idle trace when there is no audio graph (no Web Audio,
 * transcript-only mode) and never animates when the user prefers reduced motion.
 */
import { useEffect, useRef } from 'react';

import { usePrefersReducedMotion } from '@/lib/hooks';
import { cn } from '@/lib/cn';

const BARS = 44;

export interface VisualiserProps {
  analyser: AnalyserNode | null;
  active: boolean;
  /** Amber during the clash beat, blue everywhere else. */
  hot?: boolean;
  className?: string;
}

export function Visualiser({ analyser, active, hot = false, className }: VisualiserProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const accent = hot ? [245, 158, 11] : [59, 130, 246];
    const bins = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      return { width, height };
    };

    let box = resize();

    const draw = (levels: number[]) => {
      const { width, height } = box;
      ctx.clearRect(0, 0, width, height);

      const gap = 2;
      const barWidth = Math.max(1, (width - gap * (BARS - 1)) / BARS);
      const baseline = height - 1;

      for (let i = 0; i < BARS; i++) {
        const level = levels[i] ?? 0;
        const barHeight = Math.max(1.5, level * (height - 4));
        const x = i * (barWidth + gap);
        // Louder bars read brighter, so level is legible without colour alone.
        const alpha = 0.22 + level * 0.68;
        ctx.fillStyle = `rgba(${accent[0]},${accent[1]},${accent[2]},${alpha})`;
        ctx.fillRect(x, baseline - barHeight, barWidth, barHeight);
      }

      // The 1px floor line keeps the meter looking like an instrument at rest.
      ctx.fillStyle = 'rgba(108,127,151,0.35)';
      ctx.fillRect(0, baseline, width, 1);
    };

    /** A shallow, static trace: the meter is present but plainly not moving. */
    const idle = () =>
      Array.from({ length: BARS }, (_, i) => 0.05 + 0.03 * Math.sin((i / BARS) * Math.PI * 3));

    if (reducedMotion || !analyser || !active || !bins) {
      draw(idle());
      const onResize = () => {
        box = resize();
        draw(idle());
      };
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }

    const tick = () => {
      analyser.getByteFrequencyData(bins);
      // Sample logarithmically: the low bins carry the voice, so an even sweep
      // would leave most bars dead.
      const levels = Array.from({ length: BARS }, (_, i) => {
        const from = Math.floor((i / BARS) ** 1.6 * bins.length);
        const to = Math.max(from + 1, Math.floor(((i + 1) / BARS) ** 1.6 * bins.length));
        let sum = 0;
        for (let j = from; j < to; j++) sum += bins[j];
        return sum / (to - from) / 255;
      });
      draw(levels);
      rafRef.current = requestAnimationFrame(tick);
    };

    const onResize = () => {
      box = resize();
    };
    window.addEventListener('resize', onResize);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', onResize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [active, analyser, hot, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('h-12 w-full', className)}
      // Decorative: the transcript and the transport state convey everything
      // this meter shows, so screen readers should skip it.
      aria-hidden="true"
      role="presentation"
    />
  );
}
