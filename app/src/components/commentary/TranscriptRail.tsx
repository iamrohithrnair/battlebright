'use client';

/**
 * Synchronised captions — the accessibility backbone of the feature.
 *
 * Audio-only content is unusable with sound off, so the entire script is on
 * screen at all times: the active beat is highlighted, and within it the
 * sentence currently being spoken is emphasised by mapping playback progress
 * onto character offsets. The whole feature works with the volume at zero.
 *
 * Beats are also a navigation control — click any one to jump there.
 */
import { AlertTriangle, FileText, Loader2, Volume2, XCircle } from 'lucide-react';

import { cn } from '@/lib/cn';
import type { CommentaryBeat } from '@/lib/commentary/types';

import type { BeatAudioState } from './useCommentary';

/** Split on sentence boundaries, keeping the terminator with its sentence. */
function sentencesOf(text: string): string[] {
  const parts = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length);
  return parts.length ? parts : [text];
}

/**
 * Which sentence is being spoken, estimated from elapsed fraction against
 * cumulative character count. Speech rate is near enough constant within a beat
 * that this tracks well, and it costs nothing — no word-level timing API needed.
 */
function activeSentence(sentences: string[], progress: number): number {
  const total = sentences.reduce((sum, s) => sum + s.length, 0);
  if (!total) return 0;
  let seen = 0;
  for (let i = 0; i < sentences.length; i++) {
    seen += sentences[i].length;
    if (progress <= seen / total) return i;
  }
  return sentences.length - 1;
}

export interface TranscriptRailProps {
  beats: CommentaryBeat[];
  activeIndex: number;
  beatProgress: number;
  audioState: Record<number, BeatAudioState>;
  /** True when playing as text only, which changes the per-beat status icon. */
  textMode: boolean;
  isPlaying: boolean;
  onSelect: (index: number) => void;
  className?: string;
}

export function TranscriptRail({
  beats,
  activeIndex,
  beatProgress,
  audioState,
  textMode,
  isPlaying,
  onSelect,
  className,
}: TranscriptRailProps) {
  return (
    <ol className={cn('space-y-2', className)}>
      {beats.map((beat, index) => {
        const isActive = index === activeIndex;
        const state = audioState[index] ?? 'idle';
        const sentences = sentencesOf(beat.text);
        const current = isActive && isPlaying ? activeSentence(sentences, beatProgress) : -1;

        return (
          <li key={beat.id}>
            <button
              type="button"
              onClick={() => onSelect(index)}
              aria-current={isActive ? 'true' : undefined}
              className={cn(
                'group relative block w-full cursor-pointer border p-3 text-left transition-colors duration-200 sm:p-4',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-pit-950',
                isActive
                  ? 'border-ember/45 bg-ember/[0.06]'
                  : 'border-pit-700 bg-pit-900/50 hover:border-volt/40 hover:bg-pit-850',
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={cn(
                    'font-mono text-[11px] tabular-nums',
                    isActive ? 'text-ember-light' : 'text-ink-mute',
                  )}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span
                  className={cn(
                    'font-mono text-[11px] uppercase tracking-[0.18em]',
                    isActive ? 'text-ember-light' : 'text-ink-soft',
                  )}
                >
                  {beat.label}
                </span>

                {/* Status is never colour-only: each state has its own glyph. */}
                <span className="ml-auto flex items-center gap-2">
                  {beat.flagged && (
                    <span
                      className="inline-flex items-center gap-1 border border-ember/40 bg-ember/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ember-light"
                      title={beat.flag_reason}
                    >
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      Unverified figure
                    </span>
                  )}
                  {state === 'loading' && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-volt-light">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      Synthesising
                    </span>
                  )}
                  {state === 'error' && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-lose">
                      <XCircle className="h-3 w-3" aria-hidden="true" />
                      Text only
                    </span>
                  )}
                  {isActive && isPlaying && state !== 'error' && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-ember-light">
                      {textMode ? (
                        <FileText className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <Volume2 className="h-3 w-3" aria-hidden="true" />
                      )}
                      {textMode ? 'Reading' : 'On air'}
                    </span>
                  )}
                </span>
              </div>

              <p className="text-[15px] leading-relaxed sm:text-base">
                {sentences.map((sentence, i) => (
                  <span
                    key={i}
                    className={cn(
                      'transition-colors duration-200',
                      i === current
                        ? 'bg-ember/15 text-ink'
                        : isActive
                          ? 'text-ink-soft'
                          : 'text-ink-mute',
                    )}
                  >
                    {sentence}{' '}
                  </span>
                ))}
              </p>

              {/* Within-beat progress, drawn on the bottom edge of the card. */}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 h-0.5 bg-ember transition-[width] duration-200 ease-linear"
                  style={{ width: `${Math.round(beatProgress * 100)}%` }}
                  aria-hidden="true"
                />
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
