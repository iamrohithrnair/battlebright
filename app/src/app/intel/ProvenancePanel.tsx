'use client';

import {
  Clock,
  ExternalLink,
  HardDriveDownload,
  Radio,
  Server,
  Timer,
  TriangleAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { cn } from '@/lib/cn';
import type { Provenance } from '@/lib/types';
import { formatBytes, formatFetchedAt, formatMs } from './payload';
import { STATUS_META } from './status';

const STATUS_ICON = {
  live: Radio,
  cached: HardDriveDownload,
  fallback: TriangleAlert,
} as const;

/**
 * The evidence panel: an instrument readout of the actual network transfer.
 * Every figure here comes from the server's own measurement of the unlock, so a
 * sceptical engineer can check the URL themselves and compare byte counts.
 */
export function ProvenancePanel({ provenance }: { provenance: Provenance }) {
  const meta = STATUS_META[provenance.status];
  const StatusIcon = STATUS_ICON[provenance.status];

  return (
    <Panel
      as="section"
      label="Provenance"
      title="Collection receipt"
      className={cn('transition-colors duration-200', meta.border)}
      action={
        <Badge tone={meta.tone} size="md" icon={<StatusIcon />} pulse={provenance.status === 'live'}>
          {meta.label}
        </Badge>
      }
    >
      <dl className="grid gap-px overflow-hidden rounded-md border border-pit-700 bg-pit-700 sm:grid-cols-2 lg:grid-cols-4">
        <Readout label="Bytes transferred" icon={<HardDriveDownload />}>
          <span data-numeric className="text-lg text-ink">
            {formatBytes(provenance.bytes)}
          </span>
          <span className="ml-2 text-xs text-ink-mute" data-numeric>
            ({provenance.bytes.toLocaleString('en-US')} B)
          </span>
        </Readout>

        <Readout label="Unlock latency" icon={<Timer />}>
          <span data-numeric className="text-lg text-ink">
            {formatMs(provenance.ms)}
          </span>
          <span className="ml-1 text-xs text-ink-mute">
            {provenance.ms < 1000 ? 'ms' : 's'}
          </span>
        </Readout>

        <Readout label="Bright Data zone" icon={<Server />}>
          <span className="break-all font-mono text-sm text-volt-light">{provenance.zone}</span>
        </Readout>

        <Readout label="Fetched at" icon={<Clock />}>
          <time dateTime={provenance.fetched_at} className="font-mono text-sm text-ink" data-numeric>
            {formatFetchedAt(provenance.fetched_at)}
          </time>
        </Readout>
      </dl>

      <div className="mt-4 rounded-md border border-pit-700 bg-pit-950/60 p-3">
        <p className="label-mono mb-1.5">Target URL</p>
        <a
          href={provenance.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-start gap-2 break-all font-mono text-sm text-volt-light underline decoration-volt/40 underline-offset-4 transition-colors duration-200 hover:text-volt-glow hover:decoration-volt"
        >
          <ExternalLink aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{provenance.url}</span>
        </a>
      </div>

      <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-ink-soft">
        <StatusIcon aria-hidden="true" className={cn('mt-0.5 h-4 w-4 shrink-0', meta.text)} />
        <span>{meta.note}</span>
      </p>
    </Panel>
  );
}

function Readout({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-pit-900 p-3.5">
      <dt className="label-mono flex items-center gap-1.5">
        <span aria-hidden="true" className="text-ink-mute [&>svg]:h-3.5 [&>svg]:w-3.5">
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-2 font-display font-semibold leading-none">{children}</dd>
    </div>
  );
}
