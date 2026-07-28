'use client';

/**
 * <CommentaryDeck /> — the mountable broadcast widget.
 *
 * Entirely self-contained: give it two robot names and it fetches its own
 * fact-checked script, synthesises its own audio and plays itself. It holds no
 * page-level state, so it can be dropped beside the 3D arena on /predict to
 * narrate a fight, or used standalone in the booth at /commentary.
 *
 *   <CommentaryDeck robotA="Tombstone" robotB="End Game" autoStart compact />
 *
 * Layout is two columns on wide screens — transcript left, receipts right — and
 * stacks on mobile. `compact` drops the receipts column and tightens the
 * chrome for embedding.
 */
import { AlertTriangle, AudioLines, FileText, Loader2, Megaphone, Radio } from 'lucide-react';
import { useMemo } from 'react';

import { Badge, Panel, SectionLabel, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';

import { GroundingPanel } from './GroundingPanel';
import { TranscriptRail } from './TranscriptRail';
import { TransportBar } from './TransportBar';
import { VoiceSelect } from './VoiceSelect';
import { Visualiser } from './Visualiser';
import { useCommentary } from './useCommentary';

export interface CommentaryDeckProps {
  /** First robot in the matchup. Must be a roster name. */
  robotA: string;
  /** Second robot in the matchup. Must be a roster name. */
  robotB: string;
  /** Fetch and begin playing as soon as the widget mounts. Default false. */
  autoStart?: boolean;
  /** Tightened, single-column layout for embedding beside other content. */
  compact?: boolean;
  className?: string;
}

export function CommentaryDeck({
  robotA,
  robotB,
  autoStart = false,
  compact = false,
  className,
}: CommentaryDeckProps) {
  const engine = useCommentary({ robotA, robotB, autoStart });
  const {
    phase,
    script,
    beats,
    error,
    activeIndex,
    activeBeat,
    overallProgress,
    audioState,
    voice,
    transcriptOnly,
    voiceStatus,
    announcement,
    analyser,
    isBusy,
    isPlaying,
    call,
    goTo,
    changeVoice,
    toggleTranscriptOnly,
  } = engine;

  const textMode = transcriptOnly || !voiceStatus.available;
  const hot = activeBeat?.id === 'clash';
  const flagged = useMemo(() => beats.filter((b) => b.flagged).length, [beats]);

  return (
    <section
      className={cn('space-y-4', className)}
      aria-label={`Voice commentary for ${robotA} versus ${robotB}`}
    >
      {/* Politely announced so screen-reader users track playback without the audio. */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <Panel
        label="Broadcast booth"
        title={`${robotA} vs ${robotB}`}
        action={
          <>
            {script && (
              <Badge tone={script.validation.ok ? 'win' : 'ember'} size="sm">
                {script.validation.ok
                  ? `${script.validation.reconciled} figures verified`
                  : `${flagged} beat${flagged === 1 ? '' : 's'} flagged`}
              </Badge>
            )}
            {isPlaying && (
              <Badge tone="ember" size="sm" pulse>
                {textMode ? 'Reading' : 'On air'}
              </Badge>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {/* ---- primary CTA ---- */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <button
              type="button"
              onClick={() => void call(robotA, robotB)}
              disabled={isBusy || !robotA || !robotB || robotA === robotB}
              className={cn(
                'inline-flex min-h-[52px] flex-1 cursor-pointer items-center justify-center gap-2.5 border px-6 font-display text-sm font-semibold uppercase tracking-[0.18em] transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-pit-950',
                isBusy || robotA === robotB
                  ? 'cursor-not-allowed border-pit-600 bg-pit-800 text-ink-mute'
                  : 'border-ember bg-ember/15 text-ember-light shadow-ember hover:bg-ember/25',
              )}
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Building the call
                </>
              ) : (
                <>
                  <Megaphone className="h-4 w-4" aria-hidden="true" />
                  {script ? 'Call it again' : 'Call the fight'}
                </>
              )}
            </button>

            <VoiceSelect
              value={voice}
              onChange={changeVoice}
              disabled={!voiceStatus.available}
              className="sm:w-64"
            />
          </div>

          {/* ---- transport + meter ---- */}
          <div className="space-y-3 border-t border-pit-700 pt-4">
            <TransportBar engine={engine} />

            {/* Stacks on mobile: the toggle's label is too wide to sit beside the
                meter at 375px. */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Visualiser
                analyser={analyser}
                active={isPlaying && !textMode}
                hot={hot}
                className="min-w-0 flex-1"
              />
              <button
                type="button"
                onClick={toggleTranscriptOnly}
                aria-pressed={transcriptOnly}
                disabled={!voiceStatus.available}
                className={cn(
                  'inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center gap-2 border px-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-pit-950',
                  transcriptOnly
                    ? 'border-volt/50 bg-volt/10 text-volt-light'
                    : 'border-pit-500 bg-pit-800 text-ink-soft hover:border-volt/60 hover:text-ink',
                  !voiceStatus.available && 'cursor-not-allowed opacity-60',
                )}
              >
                {transcriptOnly ? (
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <AudioLines className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {transcriptOnly ? 'Transcript only' : 'Read transcript only'}
              </button>
            </div>

            {/* ---- beat progress ---- */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                  {beats.length
                    ? `Beat ${Math.min(activeIndex + 1, beats.length)} of ${beats.length} — ${activeBeat?.label ?? ''}`
                    : 'No script loaded'}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-ink-mute">
                  {Math.round(overallProgress * 100)}%
                </span>
              </div>
              <div
                className="h-1 w-full bg-pit-700"
                role="progressbar"
                aria-label="Commentary progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(overallProgress * 100)}
              >
                <div
                  className="h-full bg-ember transition-[width] duration-200 ease-linear"
                  style={{ width: `${Math.round(overallProgress * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* ---- notices ---- */}
          {!voiceStatus.available && voiceStatus.reason && (
            <Notice tone="warn" icon={<Radio className="h-4 w-4" aria-hidden="true" />}>
              <strong className="font-semibold text-ember-light">Voice output offline.</strong>{' '}
              {voiceStatus.reason} The deck has switched to the synchronised transcript, which
              carries the full call.
            </Notice>
          )}

          {phase === 'error' && error && (
            <Notice tone="error" icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}>
              <strong className="font-semibold text-lose">Could not build the call.</strong> {error}
            </Notice>
          )}

          {script?.synthetic && (
            <Notice tone="warn" icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}>
              <strong className="font-semibold text-ember-light">Deterministic script.</strong> The
              language model was unavailable, so these beats were written straight from the fact
              sheet. Every figure is still real.
            </Notice>
          )}
        </div>
      </Panel>

      {/* ---- transcript + receipts ---- */}
      <div className={cn('grid gap-4', !compact && 'lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]')}>
        <Panel
          label="Transcript"
          title="Synchronised captions"
          action={
            beats.length ? (
              <span className="font-mono text-[11px] tabular-nums text-ink-mute">
                {beats.length} beats
              </span>
            ) : null
          }
        >
          {isBusy ? (
            <div className="space-y-2" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : beats.length ? (
            <TranscriptRail
              beats={beats}
              activeIndex={activeIndex}
              beatProgress={engine.beatProgress}
              audioState={audioState}
              textMode={textMode}
              isPlaying={isPlaying}
              onSelect={goTo}
            />
          ) : (
            <div className="py-8 text-center">
              <Megaphone className="mx-auto h-8 w-8 text-pit-500" aria-hidden="true" />
              <p className="mt-3 text-base text-ink-soft">The booth is quiet.</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink-mute">
                Press <span className="font-mono text-ember-light">Call the fight</span> and the
                commentator will work through six beats — every number pulled from the prediction
                engine and a live web fetch, never invented.
              </p>
            </div>
          )}
        </Panel>

        {!compact && (
          <Panel label="Receipts" title="Grounding">
            {isBusy ? (
              <div className="space-y-3" aria-hidden="true">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : script ? (
              <GroundingPanel script={script} activeBeat={activeBeat} />
            ) : (
              <div className="space-y-2">
                <SectionLabel rule>Awaiting a call</SectionLabel>
                <p className="text-sm text-ink-mute">
                  Once the call is built, this panel lists the exact data points behind the line
                  being spoken, plus the Bright Data zone, byte count and latency of the live fetch
                  that produced them.
                </p>
              </div>
            )}
          </Panel>
        )}
      </div>
    </section>
  );
}

function Notice({
  tone,
  icon,
  children,
}: {
  tone: 'warn' | 'error';
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 border p-3 text-sm',
        tone === 'error' ? 'border-lose/40 bg-lose/5 text-ink-soft' : 'border-ember/40 bg-ember/5 text-ink-soft',
      )}
    >
      <span className={cn('mt-0.5 shrink-0', tone === 'error' ? 'text-lose' : 'text-ember-light')}>
        {icon}
      </span>
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}
