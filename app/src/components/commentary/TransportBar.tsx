'use client';

/**
 * Audio transport for the booth.
 *
 * Every control is a real button with an accessible name and a 44x44 hit area —
 * these are the controls someone reaches for mid-playback, so they cannot be
 * cramped. Icon-only buttons carry both an `aria-label` and a `title`.
 */
import {
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import type { CommentaryEngine } from './useCommentary';

interface IconButtonProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  /** The primary control gets the amber treatment; the rest stay neutral. */
  accent?: boolean;
}

function IconButton({ label, onClick, children, disabled = false, accent = false }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center border transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-pit-950',
        disabled
          ? 'cursor-not-allowed border-pit-700 text-ink-mute/40'
          : 'cursor-pointer',
        !disabled && accent
          ? 'border-ember/50 bg-ember/15 text-ember-light hover:border-ember hover:bg-ember/25'
          : !disabled && 'border-pit-500 bg-pit-800 text-ink-soft hover:border-volt/60 hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

export interface TransportBarProps {
  engine: CommentaryEngine;
  className?: string;
}

export function TransportBar({ engine, className }: TransportBarProps) {
  const {
    phase,
    beats,
    activeIndex,
    isPlaying,
    isBusy,
    muted,
    volume,
    play,
    pause,
    stop,
    skip,
    previous,
    replay,
    setMuted,
    setVolume,
  } = engine;

  const hasScript = beats.length > 0;
  const idle = !hasScript || isBusy;

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      role="group"
      aria-label="Commentary playback controls"
    >
      <IconButton label="Previous beat" onClick={previous} disabled={idle || activeIndex === 0}>
        <SkipBack className="h-4 w-4" aria-hidden="true" />
      </IconButton>

      <IconButton
        label={isPlaying ? 'Pause commentary' : 'Play commentary'}
        onClick={isPlaying ? pause : play}
        disabled={idle}
        accent
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Play className="h-5 w-5" aria-hidden="true" />
        )}
      </IconButton>

      <IconButton
        label="Next beat"
        onClick={skip}
        disabled={idle || activeIndex >= beats.length - 1}
      >
        <SkipForward className="h-4 w-4" aria-hidden="true" />
      </IconButton>

      <IconButton label="Stop and rewind" onClick={stop} disabled={idle || phase === 'ready'}>
        <Square className="h-4 w-4" aria-hidden="true" />
      </IconButton>

      <IconButton label="Replay from the first beat" onClick={replay} disabled={idle}>
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
      </IconButton>

      <div className="mx-1 hidden h-6 w-px bg-pit-600 sm:block" aria-hidden="true" />

      <IconButton
        label={muted ? 'Unmute commentary' : 'Mute commentary'}
        onClick={() => setMuted(!muted)}
      >
        {muted ? (
          <VolumeX className="h-4 w-4 text-ember-light" aria-hidden="true" />
        ) : (
          <Volume2 className="h-4 w-4" aria-hidden="true" />
        )}
      </IconButton>

      <div className="flex min-h-[44px] items-center gap-2">
        <label htmlFor="commentary-volume" className="sr-only">
          Commentary volume
        </label>
        <input
          id="commentary-volume"
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round((muted ? 0 : volume) * 100)}
          onChange={(e) => {
            const next = Number(e.target.value) / 100;
            setVolume(next);
            if (next > 0 && muted) setMuted(false);
          }}
          className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-pit-600 accent-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-pit-950"
        />
        <span className="w-9 shrink-0 font-mono text-[11px] tabular-nums text-ink-mute">
          {Math.round((muted ? 0 : volume) * 100)}%
        </span>
      </div>
    </div>
  );
}
