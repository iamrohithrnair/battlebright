'use client';

import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  FilterX,
  Medal,
  Search,
  SearchX,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { RobotSilhouette } from '@/components/arena/RobotSilhouette';
import { Button, EmptyState } from '@/components/ui';
import { cn } from '@/lib/cn';
import { WEAPON_INFO, WEAPON_TYPES } from '@/lib/data/roster';
import { robotSlug } from '@/lib/format';
import type { LeaderboardRow, WeaponType } from '@/lib/types';

type SortKey = keyof Pick<
  LeaderboardRow,
  'rank' | 'robot' | 'weapon_type' | 'wins' | 'losses' | 'win_rate' | 'ko_rate' | 'builder'
>;
type Direction = 'asc' | 'desc';

interface Column {
  key: SortKey;
  label: string;
  /** Numeric columns right-align and default to descending on first click. */
  numeric: boolean;
  className?: string;
}

const COLUMNS: Column[] = [
  { key: 'rank', label: 'Rank', numeric: true, className: 'w-[92px]' },
  { key: 'robot', label: 'Robot', numeric: false },
  { key: 'weapon_type', label: 'Class', numeric: false, className: 'w-[124px]' },
  { key: 'wins', label: 'W', numeric: true, className: 'w-[64px]' },
  { key: 'losses', label: 'L', numeric: true, className: 'w-[64px]' },
  { key: 'win_rate', label: 'Win rate', numeric: true, className: 'w-[180px]' },
  { key: 'ko_rate', label: 'KO rate', numeric: true, className: 'w-[180px]' },
  { key: 'builder', label: 'Builder', numeric: false },
];

export function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [direction, setDirection] = useState<Direction>('asc');
  const [query, setQuery] = useState('');
  const [weapon, setWeapon] = useState<WeaponType | 'ALL'>('ALL');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (weapon !== 'ALL' && row.weapon_type !== weapon) return false;
      if (!needle) return true;
      return (
        row.robot.toLowerCase().includes(needle) || row.builder.toLowerCase().includes(needle)
      );
    });

    const factor = direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const left = sortValue(a, sortKey);
      const right = sortValue(b, sortKey);
      if (typeof left === 'number' && typeof right === 'number') {
        // Rank is the stable secondary key so equal figures keep the field order.
        return (left - right) * factor || a.rank - b.rank;
      }
      return String(left).localeCompare(String(right)) * factor || a.rank - b.rank;
    });
  }, [rows, query, weapon, sortKey, direction]);

  const filtersActive = query.trim().length > 0 || weapon !== 'ALL';

  const clearFilters = () => {
    setQuery('');
    setWeapon('ALL');
  };

  const toggleSort = (column: Column) => {
    if (column.key === sortKey) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(column.key);
    setDirection(column.numeric && column.key !== 'rank' ? 'desc' : 'asc');
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full max-w-sm">
          <label className="sr-only" htmlFor="leaderboard-search">
            Search the field by robot or builder
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute"
            />
            <input
              id="leaderboard-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Robot or builder…"
              className="min-h-[44px] w-full rounded-md border border-pit-600 bg-pit-900 pl-9 pr-3 font-mono text-sm text-ink transition-colors duration-200 placeholder:text-ink-mute hover:border-pit-500 focus:border-volt"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="label-mono" id="weapon-filter-label">
            Weapon class
          </p>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-labelledby="weapon-filter-label"
          >
            <FilterChip active={weapon === 'ALL'} onClick={() => setWeapon('ALL')} label="All" />
            {WEAPON_TYPES.map((type) => (
              <FilterChip
                key={type}
                active={weapon === type}
                onClick={() => setWeapon(type)}
                label={WEAPON_INFO[type].short}
                accent={WEAPON_INFO[type].accent}
                title={WEAPON_INFO[type].label}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="mb-3 font-mono text-xs text-ink-mute" data-numeric aria-live="polite">
        Showing {visible.length} of {rows.length} bots
        {filtersActive ? ' (filtered)' : ''}
      </p>

      {visible.length === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title="No bots match those filters"
          description="Nothing in the field satisfies the current search and weapon-class combination."
          action={
            <Button variant="primary" icon={<FilterX />} onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <caption className="sr-only">
              All {rows.length} bots ranked by career win rate. Every column is sortable.
            </caption>
            <thead>
              <tr className="border-b border-pit-600">
                {COLUMNS.map((column) => {
                  const active = column.key === sortKey;
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={
                        active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
                      }
                      className={cn('p-0', column.className)}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className={cn(
                          'label-mono flex min-h-[44px] w-full items-center gap-1.5 px-3 py-2 transition-colors duration-200 hover:text-ink',
                          column.numeric && 'justify-end text-right',
                          active && 'text-volt-light',
                        )}
                      >
                        <span>{column.label}</span>
                        <SortIcon active={active} direction={direction} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const info = WEAPON_INFO[row.weapon_type];
                return (
                  <tr
                    key={row.robot}
                    className="group border-b border-pit-700/70 transition-colors duration-200 hover:bg-pit-850/70"
                  >
                    <td className="px-3 py-2 align-middle">
                      <RankChip rank={row.rank} />
                    </td>

                    <td className="px-3 py-2 align-middle">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="hidden h-8 w-14 shrink-0 sm:block"
                        >
                          <RobotSilhouette weapon={row.weapon_type} />
                        </span>
                        <Link
                          href={`/roster/${robotSlug(row.robot)}`}
                          className="min-h-[44px] items-center font-display text-sm font-semibold text-ink transition-colors duration-200 hover:text-volt-light flex"
                        >
                          {row.robot}
                        </Link>
                      </div>
                    </td>

                    <td className="px-3 py-2 align-middle">
                      <span
                        className="inline-flex min-h-[22px] items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft"
                        style={{ borderColor: `${info.accent}66` }}
                        title={info.label}
                      >
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: info.accent }}
                        />
                        {info.short}
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right align-middle font-mono text-sm text-ink" data-numeric>
                      {row.wins}
                    </td>
                    <td
                      className="px-3 py-2 text-right align-middle font-mono text-sm text-ink-soft"
                      data-numeric
                    >
                      {row.losses}
                    </td>

                    <td className="px-3 py-2 align-middle">
                      <CellBar value={row.win_rate} tone="volt" />
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <CellBar value={row.ko_rate} tone="ember" />
                    </td>

                    <td className="px-3 py-2 align-middle text-sm text-ink-soft">{row.builder}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function sortValue(row: LeaderboardRow, key: SortKey): string | number {
  if (key === 'weapon_type') return WEAPON_INFO[row.weapon_type].label;
  return row[key];
}

function SortIcon({ active, direction }: { active: boolean; direction: Direction }) {
  if (!active) {
    return <ChevronsUpDown aria-hidden="true" className="h-3 w-3 shrink-0 opacity-60" />;
  }
  return direction === 'asc' ? (
    <ArrowUp aria-hidden="true" className="h-3 w-3 shrink-0" />
  ) : (
    <ArrowDown aria-hidden="true" className="h-3 w-3 shrink-0" />
  );
}

function FilterChip({
  active,
  onClick,
  label,
  accent,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  accent?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cn(
        'inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-3 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors duration-200 sm:min-h-[36px]',
        active
          ? 'border-ember bg-ember/15 text-ember-light'
          : 'border-pit-600 bg-pit-900 text-ink-soft hover:border-pit-500 hover:text-ink',
      )}
    >
      {accent ? (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
        />
      ) : null}
      {label}
    </button>
  );
}

/** Top-three ranks get a chip plus an icon, so placement never rests on colour. */
function RankChip({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex min-h-[26px] items-center gap-1.5 rounded border border-ember bg-ember/15 px-2 font-display text-xs font-bold text-ember-light">
        <Trophy aria-hidden="true" className="h-3.5 w-3.5" />
        <span data-numeric>1</span>
        <span className="sr-only">first place</span>
      </span>
    );
  }
  if (rank === 2 || rank === 3) {
    return (
      <span className="inline-flex min-h-[26px] items-center gap-1.5 rounded border border-volt/50 bg-volt/10 px-2 font-display text-xs font-semibold text-volt-light">
        <Medal aria-hidden="true" className="h-3.5 w-3.5" />
        <span data-numeric>{rank}</span>
        <span className="sr-only">{rank === 2 ? 'second place' : 'third place'}</span>
      </span>
    );
  }
  return (
    <span className="pl-2 font-mono text-sm text-ink-mute" data-numeric>
      {rank}
    </span>
  );
}

/** Thin decorative track behind the mono figure that carries the real value. */
function CellBar({ value, tone }: { value: number; tone: 'volt' | 'ember' }) {
  return (
    <div className="flex items-center justify-end gap-3">
      <div aria-hidden="true" className="h-1.5 w-full max-w-[96px] overflow-hidden rounded-full bg-pit-850">
        <div
          className={cn('h-full rounded-full', tone === 'volt' ? 'bg-volt' : 'bg-ember')}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="w-[52px] shrink-0 text-right font-mono text-sm text-ink" data-numeric>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}
