import { Bot } from 'lucide-react';
import type { Metadata } from 'next';
import { RosterGrid, type RosterEntry } from '@/components/roster/RosterGrid';
import { SectionLabel, StatTile } from '@/components/ui';
import { WEAPON_INFO } from '@/lib/data/roster';
import { allRobots, leaderboard, rosterStats } from '@/lib/engine';

export const metadata: Metadata = {
  title: 'Roster',
  description:
    'All 42 BattleBots in the dataset — records, win rates, KO rates, weapon classes, builders and countries, searchable and sortable.',
};

export default function RosterPage() {
  const ranks = new Map(leaderboard().map((row) => [row.robot, row]));
  const stats = rosterStats();

  const entries: RosterEntry[] = allRobots().map((r) => {
    const row = ranks.get(r.robot);
    return {
      ...r,
      win_rate: row?.win_rate ?? 0,
      ko_rate: row?.ko_rate ?? 0,
      rank: row?.rank ?? 0,
    };
  });

  const heaviest = entries.reduce((best, e) => (e.weight_lb > best.weight_lb ? e : best));
  const mostCommon = [...new Set(entries.map((e) => e.weapon_type))]
    .map((w) => ({ w, n: entries.filter((e) => e.weapon_type === w).length }))
    .sort((a, b) => b.n - a.n)[0];

  return (
    <div className="shell pb-24 pt-28 sm:pt-32">
      <header className="mb-8 max-w-3xl">
        <SectionLabel icon={<Bot className="h-3.5 w-3.5" />} rule>
          Roster
        </SectionLabel>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-5xl">
          Forty-two machines, eight ways to win
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-soft">
          The whole field, drawn procedurally by weapon class. Filter by how a bot fights, sort by
          how well it does it, then open any card for a full scouting report.
        </p>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Robots" value={stats.robots} hint="Every competitor in the dataset" />
        <StatTile
          label="Weapon classes"
          value={stats.weapons}
          tone="volt"
          hint={`Most common: ${WEAPON_INFO[mostCommon.w].label} (${mostCommon.n})`}
        />
        <StatTile
          label="Fights logged"
          value={stats.matches}
          hint={`${stats.knockouts} ended by knockout`}
        />
        <StatTile
          label="Heaviest"
          value={heaviest.weight_lb}
          unit="lb"
          tone="ember"
          hint={heaviest.robot}
        />
      </div>

      <RosterGrid entries={entries} />
    </div>
  );
}
