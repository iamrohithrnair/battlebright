'use client';

import { useCallback, useRef, useState } from 'react';
import { Antenna, RotateCcw, ServerCrash, Satellite } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Panel } from '@/components/ui/Panel';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { CollectionLog, type LogEntry } from './CollectionLog';
import { CollectorControls } from './CollectorControls';
import { DiffTable } from './DiffTable';
import { ProvenancePanel } from './ProvenancePanel';
import { ScrapedCard } from './ScrapedCard';
import type { IntelPayload } from './payload';

interface RequestError {
  title: string;
  detail: string;
}

/** The client half of the collection console: request, telemetry, evidence. */
export function IntelConsole({ robots, zone }: { robots: string[]; zone: string }) {
  const [query, setQuery] = useState('Tombstone');
  const [fresh, setFresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payload, setPayload] = useState<IntelPayload | null>(null);
  const [error, setError] = useState<RequestError | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [target, setTarget] = useState<string | null>(null);
  const logId = useRef(0);
  const lastRequest = useRef<{ name: string; fresh: boolean } | null>(null);

  const run = useCallback(async (name: string, forceFresh: boolean) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    lastRequest.current = { name: trimmed, fresh: forceFresh };
    setBusy(true);
    setError(null);
    setTarget(trimmed);

    try {
      const res = await fetch(
        `/api/intel/${encodeURIComponent(trimmed)}${forceFresh ? '?fresh=1' : ''}`,
        { cache: 'no-store' },
      );
      const body = await res.json();

      if (!res.ok) {
        setPayload(null);
        setError({
          title: res.status === 404 ? 'Not in the roster' : `Request failed (HTTP ${res.status})`,
          detail:
            typeof body?.message === 'string'
              ? body.message
              : 'The intel endpoint could not complete this request.',
        });
        return;
      }

      const result = body as IntelPayload;
      setPayload(result);
      logId.current += 1;
      setLog((prev) =>
        [
          {
            id: logId.current,
            robot: result.scraped.robot,
            bytes: result.provenance.bytes,
            ms: result.provenance.ms,
            status: result.provenance.status,
            at: new Date().toLocaleTimeString('en-GB', { hour12: false }),
          },
          ...prev,
        ].slice(0, 12),
      );
    } catch (e) {
      setPayload(null);
      setError({
        title: 'Could not reach the intel endpoint',
        detail: (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  }, []);

  const retry = () => {
    const last = lastRequest.current;
    if (last) void run(last.name, last.fresh);
  };

  const targetUrl = target
    ? `https://battlebots.fandom.com/wiki/${encodeURIComponent(target.replace(/\s+/g, '_'))}`
    : null;

  return (
    <div className="space-y-6">
      <Panel
        as="section"
        label="Collector"
        title="Unlock a live wiki page"
        action={
          <Badge tone="volt" size="md" icon={<Satellite />}>
            zone {zone}
          </Badge>
        }
      >
        <CollectorControls
          robots={robots}
          query={query}
          onQueryChange={setQuery}
          fresh={fresh}
          onFreshChange={setFresh}
          onSubmit={() => void run(query, fresh)}
          busy={busy}
        />
      </Panel>

      {/* Reserved region: telemetry while unlocking, then the evidence. */}
      <div aria-live="polite" aria-busy={busy} className="space-y-6">
        {busy ? <Telemetry url={targetUrl} /> : null}

        {!busy && error ? (
          <EmptyState
            tone="error"
            icon={<ServerCrash />}
            title={error.title}
            description={error.detail}
            action={
              <button
                type="button"
                onClick={retry}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-ember bg-ember/15 px-5 font-display text-sm font-semibold uppercase tracking-[0.1em] text-ember-light transition-colors duration-200 hover:bg-ember/25"
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Retry unlock
              </button>
            }
          />
        ) : null}

        {!busy && !error && payload ? (
          <>
            <ProvenancePanel provenance={payload.provenance} />

            {payload.error ? (
              <div
                role="alert"
                className="rounded-lg border border-ember/40 bg-ember/[0.06] p-4 text-sm leading-relaxed text-ink-soft"
              >
                <p className="font-display font-semibold text-ember-light">
                  Live unlock failed — showing bundled data
                </p>
                <p className="mt-1.5">{payload.message}</p>
                <p className="mt-2 break-words font-mono text-xs text-ink-mute">
                  {payload.error.code}: {payload.error.message}
                </p>
                <button
                  type="button"
                  onClick={retry}
                  className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-ember bg-ember/15 px-4 font-display text-xs font-semibold uppercase tracking-[0.1em] text-ember-light transition-colors duration-200 hover:bg-ember/25"
                >
                  <RotateCcw aria-hidden="true" className="h-4 w-4" />
                  Retry unlock
                </button>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-ink-soft">{payload.message}</p>
            )}

            <DiffTable diff={payload.diff} live={payload.provenance.status !== 'fallback'} />

            {payload.provenance.status === 'fallback' ? (
              <LocalOnlyCard payload={payload} />
            ) : (
              <ScrapedCard scraped={payload.scraped} weights={payload.listed_weights ?? []} />
            )}
          </>
        ) : null}

        {!busy && !error && !payload ? (
          <EmptyState
            icon={<Antenna />}
            title="No collection run yet"
            description="Pick a robot and press Unlock page. The request leaves this server, goes through the Bright Data Web Unlocker to the BattleBots wiki, and comes back with a byte count and a latency you can check."
          />
        ) : null}
      </div>

      <CollectionLog entries={log} />
    </div>
  );
}

/** Multi-second unlocks need honest telemetry, not a spinner in a void. */
function Telemetry({ url }: { url: string | null }) {
  return (
    <>
      <Panel as="section" label="Collecting" title="Unlock in progress">
        <ol className="space-y-2 font-mono text-sm text-ink-soft">
          <li className="flex items-start gap-2">
            <span aria-hidden="true" className="text-volt">
              →
            </span>
            <span className="break-all">
              Requesting <span className="text-volt-light">{url ?? 'target page'}</span>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden="true" className="text-volt">
              →
            </span>
            <span>Web Unlocker negotiating blocks, CAPTCHAs and geo-restrictions…</span>
          </li>
          <li className="flex items-start gap-2 text-ink-mute">
            <span aria-hidden="true">→</span>
            <span>Parsing infobox, lede and season mentions</span>
          </li>
        </ol>

        <div
          role="progressbar"
          aria-label="Unlocking the target page"
          className="relative mt-4 h-1 overflow-hidden rounded-full bg-pit-800"
        >
          <span
            aria-hidden="true"
            className={cn(
              'absolute inset-y-0 w-1/3 animate-sweep rounded-full',
              'bg-gradient-to-r from-transparent via-ember to-transparent',
            )}
          />
        </div>
        <p className="mt-2 text-sm text-ink-mute">
          A real unlock takes a few seconds. This space is reserved so nothing jumps when the
          evidence lands.
        </p>
      </Panel>

      <Panel as="section" label="Provenance" title="Collection receipt">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[76px]" />
          ))}
        </div>
        <Skeleton className="mt-4 h-[72px]" />
        <SkeletonText lines={2} className="mt-4" />
      </Panel>
    </>
  );
}

/** When the unlock fails we still show what we know, clearly marked as bundled. */
function LocalOnlyCard({ payload }: { payload: IntelPayload }) {
  const local = payload.local;
  if (!local) return null;

  return (
    <Panel as="section" label="Bundled dataset" title={`${local.robot} — local record`}>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Weapon class', local.weapon_type.replace(/_/g, ' ')],
          ['Weight', `${local.weight_lb} lb`],
          ['Country', local.country],
          ['Builder', local.builder],
          ['Record', `${local.wins}W – ${local.losses}L`],
          ['KO wins', String(local.ko_wins)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="label-mono">{label}</dt>
            <dd className="mt-1.5 break-words font-mono text-sm text-ink" data-numeric>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
