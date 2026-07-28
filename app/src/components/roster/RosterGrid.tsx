'use client';

import { ArrowUpRight, Flag, LayoutGrid, Search, SlidersHorizontal, Wrench, X } from 'lucide-react';
import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { RobotSilhouette } from '@/components/arena';
import { Badge, Button, EmptyState, Panel, SectionLabel } from '@/components/ui';
import { cn } from '@/lib/cn';
import { WEAPON_INFO, WEAPON_TYPES } from '@/lib/data/roster';
import type { WeaponType } from '@/lib/types';

export interface RosterEntry {
  robot: string;
  weapon_type: WeaponType;
  weight_lb: number;
  wins: number;
  losses: number;
  ko_wins: number;
  builder: string;
  country: string;
  win_rate: number;
  ko_rate: number;
  rank: number;
}

type SortKey = 'rank' | 'name' | 'win_rate' | 'ko_rate' | 'wins' | 'weight_lb';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'rank', label: 'Rank' },
  { key: 'name', label: 'Name A–Z' },
  { key: 'win_rate', label: 'Win rate' },
  { key: 'ko_rate', label: 'KO rate' },
  { key: 'wins', label: 'Total wins' },
  { key: 'weight_lb', label: 'Weight' },
];

export function RosterGrid({ entries }: { entries: RosterEntry[] }) {
  const [query, setQuery] = useState('');
  const [weapons, setWeapons] = useState<Set<WeaponType>>(new Set());
  const [sort, setSort] = useState<SortKey>('rank');
  const searchId = useId();
  const sortId = useId();

  const toggleWeapon = (w: WeaponType) => {
    setWeapons((prev) => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w);
      else next.add(w);
      return next;
    });
  };

  const clearAll = () => {
    setQuery('');
    setWeapons(new Set());
    setSort('rank');
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = entries.filter((e) => {
      if (weapons.size && !weapons.has(e.weapon_type)) return false;
      if (!q) return true;
      return (
        e.robot.toLowerCase().includes(q) ||
        e.builder.toLowerCase().includes(q) ||
        e.country.toLowerCase().includes(q) ||
        WEAPON_INFO[e.weapon_type].label.toLowerCase().includes(q)
      );
    });

    const sorted = [...rows];
    switch (sort) {
      case 'name':
        sorted.sort((a, b) => a.robot.localeCompare(b.robot));
        break;
      case 'win_rate':
        sorted.sort((a, b) => b.win_rate - a.win_rate);
        break;
      case 'ko_rate':
        sorted.sort((a, b) => b.ko_rate - a.ko_rate);
        break;
      case 'wins':
        sorted.sort((a, b) => b.wins - a.wins);
        break;
      case 'weight_lb':
        sorted.sort((a, b) => b.weight_lb - a.weight_lb);
        break;
      default:
        sorted.sort((a, b) => a.rank - b.rank);
    }
    return sorted;
  }, [entries, query, weapons, sort]);

  const filtersActive = query.trim().length > 0 || weapons.size > 0;

  return (
    <div className="space-y-6">
      <Panel label="Filter the field" title="Find a machine" grid>
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor={searchId} className="label-mono mb-1.5 block">
                Search by robot, builder, country or weapon
              </label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute"
                />
                <input
                  id={searchId}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tombstone, Hardcore Robotics, USA…"
                  className="min-h-[44px] w-full rounded-md border border-pit-600 bg-pit-850 pl-9 pr-9 text-base text-ink transition-colors duration-200 placeholder:text-ink-mute hover:border-pit-500 focus:border-volt/70"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-ink-mute transition-colors duration-200 hover:bg-pit-800 hover:text-ink"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>

            <div>
              <label htmlFor={sortId} className="label-mono mb-1.5 block">
                Sort by
              </label>
              <select
                id={sortId}
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="min-h-[44px] w-full rounded-md border border-pit-600 bg-pit-850 px-3 font-mono text-sm text-ink transition-colors duration-200 hover:border-pit-500 focus:border-volt/70 sm:w-48"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset>
            <legend className="label-mono mb-2 flex items-center gap-2">
              <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5 text-volt" />
              Weapon class
            </legend>
            <div className="flex flex-wrap gap-2">
              {WEAPON_TYPES.map((w) => {
                const info = WEAPON_INFO[w];
                const on = weapons.has(w);
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => toggleWeapon(w)}
                    aria-pressed={on}
                    className={cn(
                      'flex min-h-[36px] items-center gap-2 rounded-md border px-3 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors duration-200',
                      on
                        ? 'border-volt/60 bg-volt/10 text-ink'
                        : 'border-pit-600 bg-pit-850 text-ink-soft hover:border-pit-500 hover:text-ink',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: info.accent }}
                    />
                    {info.short}
                    {on ? <X aria-hidden="true" className="h-3 w-3" /> : null}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-pit-700 pt-3">
            <p className="font-mono text-xs text-ink-soft" data-numeric aria-live="polite">
              Showing <span className="font-semibold text-ink">{filtered.length}</span> of{' '}
              {entries.length} robots
            </p>
            {filtersActive ? (
              <Button onClick={clearAll} variant="ghost" size="sm" icon={<X />}>
                Clear filters
              </Button>
            ) : null}
          </div>
        </div>
      </Panel>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid />}
          title="No robot matches those filters"
          description="Loosen the weapon-class selection or clear the search to see the whole field again."
          action={
            <Button onClick={clearAll} variant="primary">
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <SectionLabel rule>The field</SectionLabel>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((entry) => (
              <li key={entry.robot}>
                <RobotCard entry={entry} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function RobotCard({ entry }: { entry: RosterEntry }) {
  const info = WEAPON_INFO[entry.weapon_type];

  return (
    // The 3D tilt lives on a wrapper with perspective, so nothing reflows on hover.
    <div className="group h-full [perspective:1000px]">
      <Link
        href={`/roster/${encodeURIComponent(entry.robot)}`}
        className="relative flex h-full flex-col overflow-hidden rounded-lg border border-pit-600 bg-pit-900/70 transition-[border-color,box-shadow,transform] duration-300 [transform-style:preserve-3d] hover:border-volt/50 hover:shadow-volt motion-safe:group-hover:[transform:rotateX(5deg)_rotateY(-7deg)]"
      >
        {/* Accent seam in the weapon-class colour */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px opacity-70"
          style={{ backgroundColor: info.accent }}
        />

        <div className="relative flex items-start justify-between gap-3 p-4 pb-0">
          <div className="min-w-0">
            <p className="label-mono">Rank #{entry.rank}</p>
            <h3 className="mt-1 truncate font-display text-lg font-bold leading-tight text-ink transition-colors duration-200 group-hover:text-volt-light">
              {entry.robot}
            </h3>
          </div>
          <ArrowUpRight
            aria-hidden="true"
            className="mt-1 h-4 w-4 shrink-0 text-ink-mute transition-colors duration-200 group-hover:text-ember"
          />
        </div>

        {/* Procedural silhouette — 42 of these instead of 42 WebGL contexts. */}
        <div className="relative mx-4 mt-3 h-20 rounded-md border border-pit-700 bg-pit-950/60">
          <div
            aria-hidden="true"
            className="bg-blueprint-fine absolute inset-0 rounded-md opacity-50"
          />
          <div className="relative h-full px-3 py-2">
            <RobotSilhouette weapon={entry.weapon_type} />
          </div>
        </div>

        <div className="p-4">
          <div
            className="inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em]"
            style={{ borderColor: `${info.accent}55`, color: info.accent }}
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: info.accent }}
            />
            {info.label}
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-pit-700 pt-3">
            <div>
              <dt className="label-mono">Record</dt>
              <dd className="mt-0.5 font-display text-sm font-semibold text-ink" data-numeric>
                {entry.wins}-{entry.losses}
              </dd>
            </div>
            <div>
              <dt className="label-mono">Win rate</dt>
              <dd className="mt-0.5 font-display text-sm font-semibold text-volt-light" data-numeric>
                {entry.win_rate}%
              </dd>
            </div>
            <div>
              <dt className="label-mono">KO rate</dt>
              <dd
                className="mt-0.5 font-display text-sm font-semibold text-ember-light"
                data-numeric
              >
                {entry.ko_rate}%
              </dd>
            </div>
          </dl>

          <div className="mt-3 space-y-1.5">
            <p className="flex items-center gap-1.5 truncate text-xs text-ink-mute">
              <Wrench aria-hidden="true" className="h-3 w-3 shrink-0" />
              {entry.builder}
            </p>
            <p className="flex items-center gap-1.5 truncate text-xs text-ink-mute">
              <Flag aria-hidden="true" className="h-3 w-3 shrink-0" />
              {entry.country}
              <span aria-hidden="true">·</span>
              <span data-numeric>{entry.weight_lb} lb</span>
            </p>
          </div>
        </div>

        {entry.rank <= 3 ? (
          <div className="absolute right-3 top-14">
            <Badge tone="ember" size="sm">
              Top {entry.rank}
            </Badge>
          </div>
        ) : null}
      </Link>
    </div>
  );
}
