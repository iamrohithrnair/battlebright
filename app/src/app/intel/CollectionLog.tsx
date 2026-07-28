'use client';

import { History } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { cn } from '@/lib/cn';
import type { Provenance } from '@/lib/types';
import { formatBytes } from './payload';
import { STATUS_META } from './status';

export interface LogEntry {
  id: number;
  robot: string;
  bytes: number;
  ms: number;
  status: Provenance['status'];
  at: string;
}

/** Session-local record of every unlock, so repeated live activity accumulates. */
export function CollectionLog({ entries }: { entries: LogEntry[] }) {
  if (!entries.length) return null;

  const totalBytes = entries.reduce((sum, e) => sum + e.bytes, 0);

  return (
    <Panel
      as="section"
      label="Session"
      title="Collection log"
      flush
      action={
        <span className="label-mono flex items-center gap-1.5 text-ink-soft">
          <History aria-hidden="true" className="h-3.5 w-3.5 text-volt" />
          {entries.length} {entries.length === 1 ? 'unlock' : 'unlocks'} · {formatBytes(totalBytes)}
        </span>
      }
    >
      <ul className="divide-y divide-pit-800">
        {entries.map((e) => {
          const meta = STATUS_META[e.status];
          return (
            <li
              key={e.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm sm:px-5"
            >
              <span className="min-w-0 flex-1 truncate font-display font-semibold text-ink">
                {e.robot}
              </span>
              <span className="font-mono text-xs text-ink-soft" data-numeric>
                {formatBytes(e.bytes)}
              </span>
              <span className="font-mono text-xs text-ink-soft" data-numeric>
                {e.ms} ms
              </span>
              <span
                className={cn(
                  'font-mono text-[10px] uppercase tracking-[0.12em]',
                  meta.text,
                )}
              >
                {meta.label}
              </span>
              <span className="font-mono text-xs text-ink-mute" data-numeric>
                {e.at}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
