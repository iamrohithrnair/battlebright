'use client';

import {
  ListOrdered,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  SkipForward,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, EmptyState, Panel, RobotPicker, SectionLabel, StatTile } from '@/components/ui';
import { cn } from '@/lib/cn';
import { WEAPON_INFO } from '@/lib/data/roster';
import { getRobot, seedBracket, tournament } from '@/lib/engine';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { Bracket2D } from './Bracket2D';
import { BracketScene } from './BracketScene';

type Size = 4 | 8 | 16;
const SIZES: Size[] = [4, 8, 16];
const STEP_MS = 1100;

export function TournamentStudio({ robots }: { robots: string[] }) {
  const reduced = usePrefersReducedMotion();
  const [size, setSize] = useState<Size>(8);
  const [manual, setManual] = useState(false);
  const [entrants, setEntrants] = useState<string[]>(() => seedBracket(8));
  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Changing the bracket size re-seeds, because the old entrant list no longer fits.
  const applySize = useCallback((next: Size) => {
    setSize(next);
    setEntrants(seedBracket(next));
    setRevealed(0);
    setPlaying(false);
  }, []);

  const reseed = useCallback(() => {
    setEntrants(seedBracket(size));
    setRevealed(0);
    setPlaying(false);
  }, [size]);

  const randomise = useCallback(() => {
    const pool = [...robots];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setEntrants(pool.slice(0, size));
    setRevealed(0);
    setPlaying(false);
  }, [robots, size]);

  const setSlot = useCallback((index: number, name: string) => {
    setEntrants((prev) => {
      const next = [...prev];
      // Swap if the bot is already seeded elsewhere, so slots stay unique.
      const existing = next.indexOf(name);
      if (existing !== -1 && existing !== index) next[existing] = next[index];
      next[index] = name;
      return next;
    });
    setRevealed(0);
    setPlaying(false);
  }, []);

  const result = useMemo(() => tournament(entrants), [entrants]);
  const totalMatches = useMemo(
    () => result?.rounds.reduce((sum, r) => sum + r.length, 0) ?? 0,
    [result],
  );

  // Playback clock.
  useEffect(() => {
    if (!playing) return;
    if (revealed >= totalMatches) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(
      () => setRevealed((n) => Math.min(totalMatches, n + 1)),
      reduced ? 220 : STEP_MS,
    );
    return () => window.clearTimeout(id);
  }, [playing, revealed, totalMatches, reduced]);

  const complete = totalMatches > 0 && revealed >= totalMatches;

  const run = () => {
    if (complete) setRevealed(0);
    setPlaying(true);
  };

  if (!result) {
    return (
      <EmptyState
        icon={<Users />}
        title="Not enough entrants"
        description="Pick at least two different robots to build a bracket."
        action={
          <Button onClick={reseed} variant="primary">
            Auto-seed the field
          </Button>
        }
      />
    );
  }

  const currentRound = result.rounds.findIndex((_, i) => {
    const before = result.rounds.slice(0, i).reduce((s, r) => s + r.length, 0);
    return revealed < before + result.rounds[i].length;
  });

  return (
    <div className="space-y-6">
      {/* ---------------- Field setup ---------------- */}
      <Panel label="Step 01" title="Build the field" grid>
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <fieldset>
              <legend className="label-mono mb-2">Bracket size</legend>
              <div className="flex gap-2">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => applySize(s)}
                    aria-pressed={size === s}
                    className={cn(
                      'min-h-[44px] min-w-[56px] rounded-md border px-3 font-mono text-sm font-semibold transition-colors duration-200',
                      size === s
                        ? 'border-ember bg-ember/10 text-ember-light'
                        : 'border-pit-600 bg-pit-850 text-ink-soft hover:border-pit-500 hover:text-ink',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="label-mono mb-2">Seeding</legend>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setManual(false);
                    reseed();
                  }}
                  aria-pressed={!manual}
                  className={cn(
                    'min-h-[44px] rounded-md border px-3 font-mono text-xs uppercase tracking-[0.1em] transition-colors duration-200',
                    !manual
                      ? 'border-volt/60 bg-volt/10 text-ink'
                      : 'border-pit-600 bg-pit-850 text-ink-soft hover:border-pit-500 hover:text-ink',
                  )}
                >
                  Auto-seed
                </button>
                <button
                  type="button"
                  onClick={() => setManual(true)}
                  aria-pressed={manual}
                  className={cn(
                    'min-h-[44px] rounded-md border px-3 font-mono text-xs uppercase tracking-[0.1em] transition-colors duration-200',
                    manual
                      ? 'border-volt/60 bg-volt/10 text-ink'
                      : 'border-pit-600 bg-pit-850 text-ink-soft hover:border-pit-500 hover:text-ink',
                  )}
                >
                  Pick manually
                </button>
              </div>
            </fieldset>

            <div className="flex gap-2">
              <Button onClick={reseed} variant="secondary" size="sm" icon={<ListOrdered />}>
                Top {size} by win rate
              </Button>
              <Button onClick={randomise} variant="ghost" size="sm" icon={<Shuffle />}>
                Randomise
              </Button>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-ink-soft">
            {manual
              ? 'Choose each entrant. Slots stay unique — picking a bot that is already seeded swaps the two.'
              : `Auto-seeding takes the top ${size} bots by career win rate and pairs them the way a real event would, so the top two seeds can only meet in the final.`}
          </p>

          {manual ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {entrants.map((name, i) => {
                const robot = getRobot(name);
                return (
                  <RobotPicker
                    key={`slot-${i}`}
                    label={`Seed ${i + 1}`}
                    value={name}
                    onChange={(next) => setSlot(i, next)}
                    options={robots}
                    accent={robot ? WEAPON_INFO[robot.weapon_type].accent : undefined}
                  />
                );
              })}
            </div>
          ) : (
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {entrants.map((name, i) => {
                const robot = getRobot(name);
                const info = robot ? WEAPON_INFO[robot.weapon_type] : null;
                return (
                  <li
                    key={name}
                    className="flex min-h-[44px] items-center gap-2.5 rounded-md border border-pit-600 bg-pit-850 px-3 py-2"
                  >
                    <span
                      className="w-5 shrink-0 font-mono text-[11px] text-ink-mute"
                      data-numeric
                    >
                      {i + 1}
                    </span>
                    {info ? (
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: info.accent }}
                      />
                    ) : null}
                    <span className="min-w-0 truncate font-display text-sm text-ink">{name}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </Panel>

      {/* ---------------- The bracket ---------------- */}
      <Panel
        label="Step 02"
        title="Run the bracket"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={complete ? 'ember' : playing ? 'volt' : 'outline'} pulse={playing}>
              {complete
                ? 'Champion crowned'
                : playing
                  ? `Round ${currentRound + 1}`
                  : `${revealed}/${totalMatches} resolved`}
            </Badge>

            <Button
              onClick={() => (playing ? setPlaying(false) : run())}
              variant="primary"
              size="sm"
              icon={playing ? <Pause /> : <Play />}
            >
              {playing ? 'Pause' : complete ? 'Replay' : revealed > 0 ? 'Resume' : 'Simulate'}
            </Button>

            <Button
              onClick={() => {
                setPlaying(false);
                setRevealed((n) => Math.min(totalMatches, n + 1));
              }}
              variant="secondary"
              size="sm"
              icon={<SkipForward />}
              disabled={complete}
              aria-label="Step forward one match"
            >
              Step
            </Button>

            <Button
              onClick={() => {
                setPlaying(false);
                setRevealed(0);
              }}
              variant="ghost"
              size="sm"
              icon={<RotateCcw />}
              disabled={revealed === 0}
              aria-label="Reset the bracket"
            >
              Reset
            </Button>
          </div>
        }
        flush
      >
        <BracketScene
          result={result}
          revealed={revealed}
          className="h-[48vh] min-h-[360px] w-full sm:h-[58vh]"
        />

        {/* Progress rail */}
        <div className="border-t border-pit-600 px-4 py-3 sm:px-5">
          <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
            <span>Playback</span>
            <span data-numeric>
              {revealed} of {totalMatches} matches
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-pit-850"
            role="progressbar"
            aria-valuenow={revealed}
            aria-valuemin={0}
            aria-valuemax={totalMatches}
            aria-label="Bracket progress"
          >
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-500 ease-out',
                complete ? 'bg-ember' : 'bg-volt',
              )}
              style={{ width: `${totalMatches ? (revealed / totalMatches) * 100 : 0}%` }}
            />
          </div>
        </div>
      </Panel>

      {/* ---------------- Champion ---------------- */}
      {complete ? (
        <Panel label="Result" title="Champion" grid>
          <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-ember/50 bg-ember/10 text-ember">
                <Trophy aria-hidden="true" className="h-6 w-6" />
              </span>
              <div>
                <p className="label-mono">Winner</p>
                <p className="font-display text-2xl font-bold text-ember-light">
                  {result.champion}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile compact label="Bracket size" value={result.size} icon={<Users />} />
              <StatTile compact label="Rounds won" value={result.rounds.length} icon={<Sparkles />} />
              <StatTile
                compact
                label="Final margin"
                value={`${Math.max(
                  result.rounds[result.rounds.length - 1][0].prob_a,
                  result.rounds[result.rounds.length - 1][0].prob_b,
                )}%`}
                tone="ember"
              />
            </div>
          </div>
        </Panel>
      ) : null}

      {/* ---------------- Accessible bracket ---------------- */}
      <div>
        <SectionLabel rule className="mb-3">
          Bracket, in full
        </SectionLabel>
        <Panel flush>
          <div className="p-4 sm:p-5">
            <Bracket2D result={result} revealed={revealed} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
