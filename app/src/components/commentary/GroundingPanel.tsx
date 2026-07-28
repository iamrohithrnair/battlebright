'use client';

/**
 * The receipts panel.
 *
 * Shows, for the beat currently being spoken, exactly which data points it cites
 * and where each one came from — plus the Bright Data provenance for the live
 * fetch that fed the fact sheet. The point is that nothing the commentator says
 * has to be taken on trust: byte counts, latencies and the zone name are all on
 * screen, and the validator's reconciliation count is reported honestly,
 * including when it fails.
 */
import {
  BadgeCheck,
  Braces,
  Database,
  Globe,
  ShieldAlert,
  ShieldCheck,
  Sigma,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge, SectionLabel } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { CommentaryBeat, CommentaryScript, Fact } from '@/lib/commentary/types';
import { bytes as fmtBytes, ms as fmtMs } from '@/lib/format';

/** Source badges: each source gets its own icon so colour is never the only cue. */
const SOURCE_META: Record<Fact['source'], { label: string; icon: ReactNode; tone: 'volt' | 'ember' | 'neutral' }> = {
  engine: { label: 'Engine', icon: <Sigma className="h-3 w-3" aria-hidden="true" />, tone: 'volt' },
  roster: { label: 'Roster', icon: <Database className="h-3 w-3" aria-hidden="true" />, tone: 'neutral' },
  simulation: { label: 'Monte Carlo', icon: <Braces className="h-3 w-3" aria-hidden="true" />, tone: 'volt' },
  bright_data: { label: 'Live web', icon: <Globe className="h-3 w-3" aria-hidden="true" />, tone: 'ember' },
};

const GROUNDING_COPY = {
  live: { label: 'Live web', tone: 'win' as const, text: 'Fetched fresh through Bright Data for this call.' },
  cached: { label: 'Cached web', tone: 'volt' as const, text: 'Served from the 10-minute unlock cache.' },
  partial: { label: 'Partial', tone: 'ember' as const, text: 'One bot was fetched live; the other degraded to engine data.' },
  fallback: { label: 'Engine only', tone: 'lose' as const, text: 'Live collection was unavailable, so commentary uses bundled data only.' },
};

export interface GroundingPanelProps {
  script: CommentaryScript;
  activeBeat: CommentaryBeat | null;
  className?: string;
}

export function GroundingPanel({ script, activeBeat, className }: GroundingPanelProps) {
  const { fact_sheet: sheet, validation } = script;
  const grounding = GROUNDING_COPY[sheet.grounding];
  const cited = (activeBeat?.facts_used ?? [])
    .map((id) => sheet.facts[id])
    .filter(Boolean) as Fact[];

  return (
    <div className={cn('space-y-6', className)}>
      {/* ---- what this beat cites ---- */}
      <div>
        <SectionLabel icon={<BadgeCheck className="h-3 w-3" aria-hidden="true" />} rule>
          Cited in this beat
        </SectionLabel>

        {activeBeat ? (
          cited.length ? (
            <ul className="mt-3 space-y-1.5">
              {cited.map((fact) => {
                const meta = SOURCE_META[fact.source];
                return (
                  <li
                    key={fact.id}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-l border-pit-600 pl-3"
                  >
                    <span className="text-sm text-ink-soft">{fact.label}</span>
                    <span className="font-mono text-sm tabular-nums text-ink">{fact.display}</span>
                    <Badge tone={meta.tone} size="sm" icon={meta.icon} className="ml-auto">
                      {meta.label}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-ink-mute">
              This beat is descriptive — it cites no statistics.
            </p>
          )
        ) : (
          <p className="mt-3 text-sm text-ink-mute">Start the call to see the data behind each line.</p>
        )}
      </div>

      {/* ---- bright data provenance ---- */}
      <div>
        <SectionLabel icon={<Globe className="h-3 w-3" aria-hidden="true" />} rule>
          Bright Data provenance
        </SectionLabel>

        <div className="mt-3 flex items-center gap-2">
          <Badge tone={grounding.tone} size="sm">
            {grounding.label}
          </Badge>
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-mute">
            zone {sheet.provenance[0]?.zone ?? 'n/a'}
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-mute">{grounding.text}</p>

        {sheet.provenance.length > 0 && (
          <table className="mt-3 w-full border-collapse text-left">
            <caption className="sr-only">
              Live fetches performed to build this fact sheet, with byte counts and latency
            </caption>
            <thead>
              <tr className="border-b border-pit-700">
                {['Page', 'Bytes', 'Latency', 'State'].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="pb-1.5 font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-ink-mute"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.provenance.map((p) => (
                <tr key={p.url} className="border-b border-pit-800 last:border-0">
                  <td className="py-1.5 pr-2">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cursor-pointer text-sm text-volt-light underline decoration-volt/30 underline-offset-2 transition-colors duration-200 hover:decoration-volt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-pit-950"
                    >
                      {decodeURIComponent(p.url.split('/').pop() ?? p.url).replace(/_/g, ' ')}
                    </a>
                  </td>
                  <td className="py-1.5 pr-2 font-mono text-xs tabular-nums text-ink-soft">
                    {p.bytes ? fmtBytes(p.bytes) : '—'}
                  </td>
                  <td className="py-1.5 pr-2 font-mono text-xs tabular-nums text-ink-soft">
                    {fmtMs(p.ms)}
                  </td>
                  <td className="py-1.5">
                    <span
                      className={cn(
                        'font-mono text-[10px] uppercase tracking-wider',
                        p.status === 'live' && 'text-win',
                        p.status === 'cached' && 'text-volt-light',
                        p.status === 'fallback' && 'text-lose',
                      )}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {sheet.degraded_reason && (
          <p className="mt-2 border-l-2 border-ember/40 pl-2 text-xs text-ink-mute">
            {sheet.degraded_reason}
          </p>
        )}
      </div>

      {/* ---- fact-check summary ---- */}
      <div>
        <SectionLabel
          icon={
            validation.ok ? (
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ShieldAlert className="h-3 w-3" aria-hidden="true" />
            )
          }
          rule
        >
          Fact check
        </SectionLabel>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
          <Metric label="Figures reconciled" value={String(validation.reconciled)} />
          <Metric
            label="Unverified"
            value={String(validation.unreconciled.length)}
            tone={validation.unreconciled.length ? 'warn' : 'ok'}
          />
          <Metric label="Repair passes" value={String(validation.repairs)} />
          <Metric label="Facts on sheet" value={String(Object.keys(sheet.facts).length)} />
        </dl>

        <p className="mt-3 text-xs text-ink-mute">
          {validation.ok
            ? 'Every number spoken was matched against the fact sheet before playback.'
            : 'Some figures could not be matched to the fact sheet. Affected beats are marked in the transcript.'}
        </p>

        <p className="mt-2 font-mono text-[11px] text-ink-mute">
          script model: {script.model}
          {script.synthetic && ' (deterministic fallback)'} · sheet built in {fmtMs(sheet.build_ms)}
        </p>

        {validation.notes.length > 0 && (
          <ul className="mt-2 space-y-1">
            {validation.notes.map((note, i) => (
              <li key={i} className="text-xs text-ink-mute">
                — {note}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone = 'ok' }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">{label}</dt>
      <dd
        className={cn(
          'font-mono text-lg tabular-nums',
          tone === 'warn' ? 'text-ember-light' : 'text-ink',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
