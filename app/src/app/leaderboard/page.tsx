import { Crown, ListOrdered, Swords, Target, Wrench } from 'lucide-react';
import type { Metadata } from 'next';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { Panel, SectionLabel, StatTile } from '@/components/ui';
import { leaderboard } from '@/lib/engine';
import { pct, record } from '@/lib/format';

export const metadata: Metadata = {
  title: 'The Field',
  description:
    'Every bot on the roster ranked by career win rate, with KO rate, weapon class and builder — sortable on every column.',
};

export default function LeaderboardPage() {
  const rows = leaderboard();

  const best = rows[0];
  const bestKo = [...rows].sort((a, b) => b.ko_rate - a.ko_rate || b.wins - a.wins)[0];
  const classes = new Set(rows.map((r) => r.weapon_type)).size;
  const totalFights = rows.reduce((sum, r) => sum + r.wins + r.losses, 0);

  return (
    <div className="shell pb-24 pt-28 sm:pt-32">
      <header className="mb-8 max-w-3xl">
        <SectionLabel icon={<ListOrdered className="h-3.5 w-3.5" />} rule>
          The Field
        </SectionLabel>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-5xl">
          Forty-two bots, ranked on what they actually did.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-soft">
          No power rankings, no vibes. This is career record, win rate and finishing rate for the
          whole roster, sorted by any column you like. The same numbers feed every prediction the
          model makes.
        </p>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Bots in field"
          value={rows.length}
          icon={<Swords />}
          hint={`${totalFights} career fights on record`}
        />
        <StatTile
          label="Best win rate"
          value={pct(best.win_rate)}
          tone="volt"
          icon={<Crown />}
          hint={`${best.robot} — ${record(best.wins, best.losses)}`}
        />
        <StatTile
          label="Highest KO rate"
          value={pct(bestKo.ko_rate)}
          tone="ember"
          icon={<Target />}
          hint={`${bestKo.robot} — ${bestKo.wins} wins, KO-heavy`}
        />
        <StatTile
          label="Weapon classes"
          value={classes}
          icon={<Wrench />}
          hint="Each class carries its own matchup edges"
        />
      </div>

      <Panel
        label="Roster"
        title="Career leaderboard"
        action={
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
            sortable
          </span>
        }
      >
        <LeaderboardTable rows={rows} />
      </Panel>

      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-mute">
        Win rate is wins divided by total recorded fights. KO rate is the share of a bot&apos;s wins
        that ended by knockout rather than judges&apos; decision — it is a measure of finishing
        power, not of quality, and a bot with few wins can post a high one.
      </p>
    </div>
  );
}
