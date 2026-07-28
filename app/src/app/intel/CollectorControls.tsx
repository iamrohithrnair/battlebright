'use client';

import { useId, useMemo } from 'react';
import { Check, RefreshCw, Search, Unlock } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface CollectorControlsProps {
  robots: string[];
  query: string;
  onQueryChange: (value: string) => void;
  fresh: boolean;
  onFreshChange: (value: boolean) => void;
  onSubmit: () => void;
  busy: boolean;
}

/**
 * The console's input row: a searchable roster picker that doubles as a free-text
 * target field, the fresh-unlock switch, and the single amber CTA on the page.
 */
export function CollectorControls({
  robots,
  query,
  onQueryChange,
  fresh,
  onFreshChange,
  onSubmit,
  busy,
}: CollectorControlsProps) {
  const inputId = useId();
  const hintId = useId();
  const listId = useId();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return robots;
    return robots.filter((r) => r.toLowerCase().includes(q));
  }, [robots, query]);

  const exact = robots.some((r) => r.toLowerCase() === query.trim().toLowerCase());

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="label-mono mb-2 block">
            Target robot
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute"
            />
            <input
              id={inputId}
              name="robot"
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Tombstone"
              autoComplete="off"
              spellCheck={false}
              aria-describedby={hintId}
              aria-controls={listId}
              className="h-12 w-full rounded-md border border-pit-600 bg-pit-950 pl-10 pr-3 font-mono text-base text-ink transition-colors duration-200 placeholder:text-ink-mute hover:border-pit-500 focus:border-volt focus:outline-none"
            />
          </div>
          <p id={hintId} className="mt-2 text-sm text-ink-mute">
            Search the {robots.length} tracked robots, or type any wiki page title.
          </p>
        </div>

        <button
          type="submit"
          disabled={busy || !query.trim()}
          className="inline-flex h-12 min-h-[44px] items-center justify-center gap-2 rounded-md border border-ember bg-ember/15 px-5 font-display text-sm font-semibold uppercase tracking-[0.1em] text-ember-light transition-colors duration-200 hover:bg-ember/25 disabled:hover:bg-ember/15 sm:px-6"
        >
          {busy ? (
            <RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Unlock aria-hidden="true" className="h-4 w-4" />
          )}
          {busy ? 'Unlocking' : 'Unlock page'}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FreshToggle checked={fresh} onChange={onFreshChange} disabled={busy} />
        <p className="font-mono text-xs text-ink-mute">
          {exact ? 'In roster — diff available' : 'Free-text target — no bundled record to diff'}
        </p>
      </div>

      <div>
        <p className="label-mono mb-2">
          Roster {query.trim() ? `· ${matches.length} match${matches.length === 1 ? '' : 'es'}` : ''}
        </p>
        <ul
          id={listId}
          className="flex max-h-56 flex-wrap gap-2 overflow-y-auto rounded-md border border-pit-700 bg-pit-950/60 p-3"
        >
          {matches.length ? (
            matches.map((robot) => {
              const active = robot.toLowerCase() === query.trim().toLowerCase();
              return (
                <li key={robot}>
                  <button
                    type="button"
                    onClick={() => onQueryChange(robot)}
                    aria-pressed={active}
                    className={cn(
                      'inline-flex min-h-[44px] items-center gap-1.5 rounded border px-3 font-mono text-sm transition-colors duration-200',
                      active
                        ? 'border-volt bg-volt/15 text-volt-glow'
                        : 'border-pit-600 bg-pit-900 text-ink-soft hover:border-volt/50 hover:text-ink',
                    )}
                  >
                    {active ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : null}
                    {robot}
                  </button>
                </li>
              );
            })
          ) : (
            <li className="px-1 py-2 text-sm text-ink-mute">
              No roster match. You can still unlock this title as free text.
            </li>
          )}
        </ul>
      </div>
    </form>
  );
}

function FreshToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  const labelId = useId();

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-label="Force fresh unlock, bypassing the server cache"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          // The visual switch is 44x24; the ::after box lifts the hit area to 44x44.
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200',
          'after:absolute after:-inset-y-2.5 after:-inset-x-1 after:content-[""]',
          checked ? 'border-ember bg-ember/30' : 'border-pit-500 bg-pit-800',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'ml-0.5 h-4 w-4 rounded-full transition-[transform,background-color] duration-200',
            checked ? 'translate-x-5 bg-ember' : 'translate-x-0 bg-pit-500',
          )}
        />
      </button>
      <span id={labelId} className="text-sm text-ink-soft">
        Force fresh unlock{' '}
        <span className="font-mono text-xs text-ink-mute">(?fresh=1, bypasses cache)</span>
      </span>
    </div>
  );
}
