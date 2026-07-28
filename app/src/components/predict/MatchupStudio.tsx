'use client';

import {
  ArrowLeftRight,
  CircleDot,
  Dices,
  Gauge,
  ListChecks,
  Play,
  ShieldAlert,
  ShieldCheck,
  Swords,
  Timer,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Panel,
  ProbabilityBar,
  RobotPicker,
  SectionLabel,
  StatTile,
} from '@/components/ui';
import { WEAPON_INFO } from '@/lib/data/roster';
import { getRobot, predict, simulate } from '@/lib/engine';
import { usePrefersReducedMotion } from '@/lib/hooks';
import type { Confidence } from '@/lib/types';
import { FightScene, type FightPhase } from './FightScene';
import { MonteCarlo } from './MonteCarlo';
import { SignalBreakdown } from './SignalBreakdown';

export interface MatchupStudioProps {
  robots: string[];
  initialA: string;
  initialB: string;
}

const PHASE_COPY: Record<FightPhase, string> = {
  idle: 'Awaiting orders',
  charging: 'Bots closing…',
  clash: 'Impact',
  aftermath: 'Recovering',
  crowned: 'Fight resolved',
};

const CONFIDENCE_META: Record<
  Confidence,
  { tone: 'win' | 'volt' | 'neutral'; icon: typeof ShieldCheck; note: string }
> = {
  HIGH: { tone: 'win', icon: ShieldCheck, note: 'Margin over 20 points — the signals agree.' },
  MEDIUM: { tone: 'volt', icon: ShieldAlert, note: 'Margin of 8–20 points. A live underdog.' },
  LOW: { tone: 'neutral', icon: CircleDot, note: 'Inside 8 points. Treat this as a coin flip.' },
};

export function MatchupStudio({ robots, initialA, initialB }: MatchupStudioProps) {
  const reduced = usePrefersReducedMotion();
  const [aName, setAName] = useState(initialA);
  const [bName, setBName] = useState(initialB);
  const [runId, setRunId] = useState(0);
  const [phase, setPhase] = useState<FightPhase>('idle');
  const [revealed, setRevealed] = useState(false);

  const robotA = getRobot(aName);
  const robotB = getRobot(bName);

  const prediction = useMemo(() => predict(aName, bName, true), [aName, bName]);
  const simulation = useMemo(() => simulate(aName, bName, 4000), [aName, bName]);

  // Keep the URL shareable without forcing a re-render on every pick.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('a', aName);
    url.searchParams.set('b', bName);
    window.history.replaceState(null, '', url.toString());
  }, [aName, bName]);

  // Any change of fighters invalidates the previous result.
  useEffect(() => {
    setRevealed(false);
    setPhase('idle');
    setRunId(0);
  }, [aName, bName]);

  const swap = useCallback(() => {
    setAName(bName);
    setBName(aName);
  }, [aName, bName]);

  const randomise = useCallback(() => {
    const pool = robots.filter((r) => r !== aName && r !== bName);
    const pick = () => pool[Math.floor(Math.random() * pool.length)];
    const nextA = pick();
    let nextB = pick();
    while (nextB === nextA && pool.length > 1) nextB = pick();
    setAName(nextA);
    setBName(nextB);
  }, [robots, aName, bName]);

  const runFight = useCallback(() => {
    setRevealed(false);
    setPhase('charging');
    setRunId((n) => n + 1);
  }, []);

  if (!robotA || !robotB || !prediction || !simulation) {
    return (
      <Panel label="Matchup" title="Pick two different robots">
        <p className="text-sm text-ink-soft">
          Choose a robot in each corner to build a prediction.
        </p>
      </Panel>
    );
  }

  const infoA = WEAPON_INFO[robotA.weapon_type];
  const infoB = WEAPON_INFO[robotB.weapon_type];
  const winner: 'a' | 'b' = prediction.winner === aName ? 'a' : 'b';
  const conf = CONFIDENCE_META[prediction.confidence];
  const running = runId > 0 && !revealed;

  return (
    <div className="space-y-6">
      {/* ---------------- Corner selection ---------------- */}
      <Panel label="Step 01" title="Set the matchup" grid>
        <div className="grid items-end gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <CornerPicker
            corner="Blue corner"
            label="Robot A"
            value={aName}
            onChange={setAName}
            robots={robots}
            other={bName}
            accent={infoA.accent}
            weaponLabel={infoA.label}
            record={`${robotA.wins}-${robotA.losses}`}
          />

          <div className="flex items-center justify-center gap-2 lg:flex-col lg:pb-1">
            <Button
              onClick={swap}
              variant="secondary"
              size="sm"
              icon={<ArrowLeftRight />}
              aria-label="Swap the two robots"
              className="px-3"
            >
              <span className="lg:sr-only">Swap</span>
            </Button>
            <Button
              onClick={randomise}
              variant="ghost"
              size="sm"
              icon={<Dices />}
              aria-label="Pick a random matchup"
              className="px-3"
            >
              <span className="lg:sr-only">Random</span>
            </Button>
          </div>

          <CornerPicker
            corner="Amber corner"
            label="Robot B"
            value={bName}
            onChange={setBName}
            robots={robots}
            other={aName}
            accent={infoB.accent}
            weaponLabel={infoB.label}
            record={`${robotB.wins}-${robotB.losses}`}
          />
        </div>
      </Panel>

      {/* ---------------- The arena ---------------- */}
      <Panel
        label="Step 02"
        title="Run the fight"
        action={
          <div className="flex items-center gap-2">
            <Badge tone={running ? 'ember' : 'outline'} pulse={running}>
              {PHASE_COPY[phase]}
            </Badge>
            <Button
              onClick={runFight}
              variant="primary"
              size="md"
              icon={running ? <Timer /> : <Play />}
              disabled={running}
            >
              {running ? 'Fighting' : runId > 0 ? 'Run again' : 'Simulate'}
            </Button>
          </div>
        }
        flush
      >
        <FightScene
          a={{ name: aName, weapon: robotA.weapon_type }}
          b={{ name: bName, weapon: robotB.weapon_type }}
          runId={runId}
          winner={winner}
          onPhase={setPhase}
          onComplete={() => setRevealed(true)}
          className="h-[46vh] min-h-[340px] w-full sm:h-[56vh]"
        />

        <div className="grid grid-cols-2 gap-px border-t border-pit-600 bg-pit-600">
          <CornerReadout
            name={aName}
            weapon={infoA.label}
            accent={infoA.accent}
            align="left"
            active={revealed && winner === 'a'}
          />
          <CornerReadout
            name={bName}
            weapon={infoB.label}
            accent={infoB.accent}
            align="right"
            active={revealed && winner === 'b'}
          />
        </div>
      </Panel>

      {/* ---------------- The readout ---------------- */}
      <AnimatePresence mode="wait">
        {revealed ? (
          <motion.div
            key="readout"
            initial={reduced ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            <Panel label="Step 03 · Verdict" title={`${prediction.winner} takes it`}>
              <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
                <div>
                  <ProbabilityBar
                    labelA={aName}
                    labelB={bName}
                    probA={prediction.prob_a}
                    size="lg"
                  />

                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <StatTile
                      compact
                      label="Confidence"
                      value={prediction.confidence}
                      icon={<conf.icon />}
                      tone={
                        prediction.confidence === 'HIGH'
                          ? 'win'
                          : prediction.confidence === 'MEDIUM'
                            ? 'volt'
                            : 'neutral'
                      }
                      hint={conf.note}
                    />
                    <StatTile
                      compact
                      label="Projected finish"
                      value={prediction.projected_method}
                      icon={<Zap />}
                      tone={prediction.projected_method === 'KO' ? 'ember' : 'neutral'}
                      hint={
                        prediction.projected_method === 'KO'
                          ? 'Expect it to end early.'
                          : 'Likely to go the distance.'
                      }
                    />
                    <StatTile
                      compact
                      label="KO likelihood"
                      value={prediction.ko_likelihood}
                      unit="%"
                      icon={<Gauge />}
                      hint="From both bots' finishing rates."
                    />
                  </div>

                  {prediction.head_to_head.a + prediction.head_to_head.b > 0 ? (
                    <p className="mt-4 flex items-center gap-2 rounded-md border border-pit-600 bg-pit-850 px-3 py-2.5 font-mono text-xs text-ink-soft">
                      <Swords aria-hidden="true" className="h-3.5 w-3.5 text-volt-light" />
                      Head-to-head on record:{' '}
                      <span className="font-semibold text-ink" data-numeric>
                        {aName} {prediction.head_to_head.a}–{prediction.head_to_head.b} {bName}
                      </span>
                    </p>
                  ) : null}
                </div>

                <div>
                  <SectionLabel icon={<ListChecks className="h-3.5 w-3.5" />}>
                    Why the model says so
                  </SectionLabel>
                  <ul className="mt-3 space-y-2.5">
                    {prediction.reasons.map((reason) => (
                      <li
                        key={reason}
                        className="flex gap-2.5 rounded-md border border-pit-600 bg-pit-850/60 px-3 py-2.5 text-sm leading-relaxed text-ink-soft"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-volt"
                        />
                        {reason}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button href={`/roster/${encodeURIComponent(aName)}`} variant="ghost" size="sm">
                      Scout {aName}
                    </Button>
                    <Button href={`/roster/${encodeURIComponent(bName)}`} variant="ghost" size="sm">
                      Scout {bName}
                    </Button>
                  </div>
                </div>
              </div>
            </Panel>

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel label="Traceability" title="Signal breakdown">
                <SignalBreakdown prediction={prediction} />
              </Panel>

              <Panel label="Uncertainty" title="Monte Carlo distribution">
                <MonteCarlo
                  simulation={simulation}
                  robotA={aName}
                  robotB={bName}
                  pointEstimate={prediction.prob_a}
                />
              </Panel>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="prompt"
            initial={false}
            animate={{ opacity: 1 }}
            className="rounded-lg border border-dashed border-pit-600 bg-pit-900/40 px-6 py-10 text-center"
          >
            <p className="font-display text-base font-semibold text-ink">
              {running ? 'Resolving the fight…' : 'The verdict is sealed until you run it'}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
              {running
                ? 'Watch the clash — the readout, signal breakdown and Monte Carlo distribution appear the moment it settles.'
                : 'Press Simulate to watch the fight and unlock the full traceable readout.'}
            </p>
            {!running ? (
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Button onClick={runFight} variant="primary" icon={<Play />}>
                  Simulate
                </Button>
                <Link
                  href="/model"
                  className="inline-flex min-h-[44px] items-center font-mono text-xs uppercase tracking-[0.12em] text-volt-light transition-colors duration-200 hover:text-volt-glow"
                >
                  How accurate is this model?
                </Link>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CornerPicker({
  corner,
  label,
  value,
  onChange,
  robots,
  other,
  accent,
  weaponLabel,
  record,
}: {
  corner: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  robots: string[];
  other: string;
  accent: string;
  weaponLabel: string;
  record: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="label-mono">{corner}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
          {weaponLabel} · {record}
        </span>
      </div>
      <RobotPicker
        label={label}
        value={value}
        onChange={onChange}
        options={robots}
        disabledOptions={[other]}
        accent={accent}
      />
    </div>
  );
}

function CornerReadout({
  name,
  weapon,
  accent,
  align,
  active,
}: {
  name: string;
  weapon: string;
  accent: string;
  align: 'left' | 'right';
  active: boolean;
}) {
  return (
    <div
      className={`bg-pit-900 px-4 py-3 ${align === 'right' ? 'text-right' : ''}`}
      style={active ? { boxShadow: `inset 0 -2px 0 0 ${accent}` } : undefined}
    >
      <div
        className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : ''}`}
      >
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <p className="truncate font-display text-sm font-semibold text-ink">{name}</p>
        {active ? (
          <Badge tone="ember" size="sm">
            Winner
          </Badge>
        ) : null}
      </div>
      <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
        {weapon}
      </p>
    </div>
  );
}
