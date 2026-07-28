'use client';

import { useState } from 'react';
import {
  Activity,
  ChevronRight,
  CircleAlert,
  Crosshair,
  Database,
  Gauge,
  Radio,
  Satellite,
  Swords,
  Target,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge } from './local-ui';

export interface TraceEntry {
  id: string;
  name: string;
  args: Record<string, unknown>;
  /** Undefined while the tool is still running. */
  summary?: string;
  ms?: number;
  ok?: boolean;
  meta?: Record<string, unknown>;
}

const ICONS: Record<string, typeof Activity> = {
  get_robot: Database,
  predict_matchup: Swords,
  get_leaderboard: Trophy,
  get_weapon_meta: Gauge,
  get_backtest: Target,
  get_upsets: Crosshair,
  simulate_tournament: Trophy,
  scout_robot: Radio,
  scrape_live: Satellite,
};

/** `predict_matchup(Tombstone, End Game)` — the call as an operator would read it. */
function signature(entry: TraceEntry): string {
  const values = Object.entries(entry.args)
    .filter(([key]) => !key.startsWith('__'))
    .map(([, value]) => (Array.isArray(value) ? value.join(', ') : String(value)));
  return `${entry.name}(${values.join(', ')})`;
}

export function ToolTrace({ entries, live }: { entries: TraceEntry[]; live: boolean }) {
  const [open, setOpen] = useState(true);
  if (!entries.length) return null;

  const running = entries.filter((e) => e.summary === undefined).length;
  const failed = entries.filter((e) => e.ok === false).length;
  const bytes = entries.reduce((sum, e) => sum + provenanceBytes(e), 0);

  return (
    <div className="rounded border border-pit-700 bg-pit-900/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors duration-200 hover:bg-pit-850 focus-visible:bg-pit-850"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn('h-3.5 w-3.5 shrink-0 text-ink-mute transition-transform duration-200', open && 'rotate-90')}
        />
        <span className="label-mono">Agent trace</span>
        <span className="font-mono text-[11px] text-ink-mute">
          {entries.length} {entries.length === 1 ? 'call' : 'calls'}
        </span>
        {running > 0 && live ? <Badge tone="accent">{running} running</Badge> : null}
        {failed > 0 ? (
          <Badge tone="bad" icon={<CircleAlert className="h-3 w-3" />}>
            {failed} failed
          </Badge>
        ) : null}
        {bytes > 0 ? (
          <Badge tone="data" icon={<Satellite className="h-3 w-3" />} className="ml-auto hidden sm:inline-flex">
            {bytes.toLocaleString('en-US')} B live
          </Badge>
        ) : null}
      </button>

      {open ? (
        <ol className="border-t border-pit-700 px-3 py-2">
          {entries.map((entry, index) => (
            <TraceRow key={`${entry.id}-${index}`} entry={entry} index={index} live={live} />
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function TraceRow({ entry, index, live }: { entry: TraceEntry; index: number; live: boolean }) {
  const Icon = ICONS[entry.name] ?? Activity;
  const pending = entry.summary === undefined;
  const failedCall = entry.ok === false;

  return (
    <li className="flex gap-2.5 py-1.5 font-mono text-[13px] leading-relaxed">
      <span aria-hidden="true" className="shrink-0 text-ink-mute">
        {String(index + 1).padStart(2, '0')}
      </span>
      <Icon
        aria-hidden="true"
        className={cn(
          'mt-1 h-3.5 w-3.5 shrink-0',
          failedCall ? 'text-lose' : pending ? 'text-ember' : 'text-volt',
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block break-words text-ink-soft">{signature(entry)}</span>
        <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span aria-hidden="true" className={cn('shrink-0', failedCall ? 'text-lose' : 'text-volt')}>
            →
          </span>
          {pending ? (
            <span className="text-ember">
              {live ? 'collecting…' : 'no result'}
              <span className="sr-only">Tool call in progress</span>
            </span>
          ) : (
            <span className={cn('break-words', failedCall ? 'text-lose' : 'text-ink')}>
              {failedCall ? 'FAILED: ' : ''}
              {entry.summary}
            </span>
          )}
          {entry.ms !== undefined ? <span className="text-ink-mute">{entry.ms}ms</span> : null}
        </span>
      </span>
    </li>
  );
}

function provenanceBytes(entry: TraceEntry): number {
  const provenance = entry.meta?.provenance as { bytes?: unknown } | undefined;
  return typeof provenance?.bytes === 'number' ? provenance.bytes : 0;
}
