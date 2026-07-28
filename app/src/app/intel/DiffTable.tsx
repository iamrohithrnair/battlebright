'use client';

import { CheckCircle2, MinusCircle, ShieldCheck } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { cn } from '@/lib/cn';
import type { IntelResult } from '@/lib/types';
import { DIFF_FIELD_LABELS } from './payload';

type DiffRow = IntelResult['diff'][number];

/**
 * Field-by-field verification of the bundled dataset against the page we just
 * unlocked. A mismatch is not a bug — the wiki phrases things differently, and
 * showing that honestly is the point.
 */
export function DiffTable({ diff, live }: { diff: DiffRow[]; live: boolean }) {
  const verified = diff.filter((d) => d.match).length;

  return (
    <Panel
      as="section"
      label="Verification"
      title="Bundled dataset vs. live page"
      flush
      action={
        <span className="label-mono flex items-center gap-1.5 text-ink-soft">
          <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-volt" />
          {verified} / {diff.length} verified
        </span>
      }
    >
      <p className="border-b border-pit-700 px-4 py-3 text-sm leading-relaxed text-ink-soft sm:px-5">
        {live ? (
          <>
            <strong className="font-semibold text-ink">
              {verified} of {diff.length} fields verified
            </strong>{' '}
            against the live page. Values are normalised before comparison (case, spacing, country
            aliases) so a match means real agreement, not a lucky string.
          </>
        ) : (
          <>No live page to compare against, so every field is unverified. The values below are our bundled dataset only.</>
        )}
      </p>

      {/* Desktop: a real table. */}
      <div className="hidden sm:block">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Comparison of our bundled dataset with the freshly scraped wiki page
          </caption>
          <thead>
            <tr className="border-b border-pit-700">
              <Th className="w-[22%]">Field</Th>
              <Th className="w-[30%]">Bundled dataset</Th>
              <Th className="w-[30%]">Live page</Th>
              <Th className="w-[18%]">Result</Th>
            </tr>
          </thead>
          <tbody>
            {diff.map((row) => (
              <tr
                key={row.field}
                className="border-b border-pit-800 transition-colors duration-200 last:border-0 hover:bg-pit-850/60"
              >
                <td className="px-4 py-3 font-mono text-xs uppercase tracking-[0.12em] text-ink-mute sm:px-5">
                  {DIFF_FIELD_LABELS[row.field] ?? row.field}
                </td>
                <td className="px-4 py-3 font-mono text-ink-soft sm:px-5" data-numeric>
                  {row.local}
                </td>
                <td className="px-4 py-3 font-mono text-ink sm:px-5" data-numeric>
                  {row.live}
                </td>
                <td className="px-4 py-3 sm:px-5">
                  <MatchFlag match={row.match} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked rows, so nothing is squeezed sideways. */}
      <ul className="divide-y divide-pit-800 sm:hidden">
        {diff.map((row) => (
          <li key={row.field} className="px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-mute">
                {DIFF_FIELD_LABELS[row.field] ?? row.field}
              </p>
              <MatchFlag match={row.match} />
            </div>
            <dl className="mt-2.5 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="label-mono pt-0.5">Ours</dt>
              <dd className="break-words font-mono text-ink-soft">{row.local}</dd>
              <dt className="label-mono pt-0.5">Live</dt>
              <dd className="break-words font-mono text-ink">{row.live}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn('label-mono px-4 py-2.5 font-medium sm:px-5', className)}>
      {children}
    </th>
  );
}

function MatchFlag({ match }: { match: boolean }) {
  const Icon = match ? CheckCircle2 : MinusCircle;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.1em]',
        match ? 'border-win/40 bg-win/10 text-win' : 'border-pit-500 bg-pit-800 text-ink-soft',
      )}
    >
      <Icon aria-hidden="true" className="h-3 w-3" />
      {match ? 'Match' : 'No match'}
    </span>
  );
}
