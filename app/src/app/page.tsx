import { ArrowUpRight, Flame, Trophy } from 'lucide-react';
import Link from 'next/link';
import { RobotSilhouette } from '@/components/arena';
import { HeroArena } from '@/components/home/HeroArena';
import { NAV_LINKS } from '@/components/shell/nav-links';
import { Badge, Panel, SectionLabel } from '@/components/ui';
import { WEAPON_INFO } from '@/lib/data/roster';
import { leaderboard, rosterStats, upsets } from '@/lib/engine';

export default function HomePage() {
  const stats = rosterStats();
  const top = leaderboard().slice(0, 6);
  const biggestUpset = upsets(1)[0];

  return (
    <div className="relative">
      <HeroArena stats={stats} />

      {/* ---- Where to go next ---- */}
      <section className="shell relative py-20 sm:py-28">
        <SectionLabel rule>The engine, room by room</SectionLabel>
        <h2 className="mt-4 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Eight instruments pointed at the same question
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft">
          Who wins, and can you prove it? Every page below answers part of that — from a single
          matchup to a live scrape of the wiki to an AI analyst you can interrogate.
        </p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="group flex h-full flex-col rounded-lg border border-pit-600 bg-pit-900/60 p-5 transition-colors duration-200 hover:border-volt/50 hover:bg-pit-850"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-md border border-pit-600 bg-pit-850 text-ink-mute transition-colors duration-200 group-hover:border-volt/40 group-hover:text-volt-light">
                  <link.icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className="mt-4 flex items-center gap-1.5 font-display text-base font-semibold text-ink">
                  {link.label}
                  <ArrowUpRight
                    aria-hidden="true"
                    className="h-3.5 w-3.5 text-ink-mute transition-colors duration-200 group-hover:text-ember"
                  />
                </span>
                <span className="mt-1.5 text-sm leading-snug text-ink-soft">{link.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- A taste of the data ---- */}
      <section className="shell relative grid gap-6 pb-20 lg:grid-cols-[1.4fr_1fr] sm:pb-28">
        <Panel
          label="Top of the table"
          title="The six most reliable machines in the box"
          action={
            <Link
              href="/leaderboard"
              className="flex min-h-[36px] items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-volt-light transition-colors duration-200 hover:text-volt-glow"
            >
              Full leaderboard
              <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          }
          flush
        >
          <ul className="divide-y divide-pit-700">
            {top.map((row) => {
              const info = WEAPON_INFO[row.weapon_type];
              return (
                <li key={row.robot}>
                  <Link
                    href={`/roster/${encodeURIComponent(row.robot)}`}
                    className="group flex min-h-[64px] items-center gap-4 px-4 py-3 transition-colors duration-200 hover:bg-pit-850 sm:px-5"
                  >
                    <span
                      className="w-7 shrink-0 font-mono text-sm font-semibold text-ink-mute"
                      data-numeric
                    >
                      {String(row.rank).padStart(2, '0')}
                    </span>

                    <span className="hidden h-9 w-16 shrink-0 sm:block">
                      <RobotSilhouette weapon={row.weapon_type} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-sm font-semibold text-ink transition-colors duration-200 group-hover:text-volt-light">
                        {row.robot}
                      </span>
                      <span className="block truncate text-xs text-ink-mute">
                        {info.label} · {row.builder}
                      </span>
                    </span>

                    <span className="shrink-0 text-right">
                      <span
                        className="block font-mono text-sm font-semibold text-ink"
                        data-numeric
                      >
                        {row.win_rate}%
                      </span>
                      <span className="block font-mono text-[10px] uppercase tracking-widest text-ink-mute">
                        {row.wins}-{row.losses}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel label="Substance over polish" title="We publish our misses">
            {biggestUpset ? (
              <div>
                <p className="text-sm leading-relaxed text-ink-soft">
                  The model&apos;s worst call on record: it made{' '}
                  <span className="font-mono font-semibold text-ink">{biggestUpset.favorite}</span>{' '}
                  a{' '}
                  <span className="font-mono font-semibold text-volt-light" data-numeric>
                    {biggestUpset.fav_prob}%
                  </span>{' '}
                  favourite in {biggestUpset.season}, and{' '}
                  <span className="font-mono font-semibold text-ember-light">
                    {biggestUpset.actual_winner}
                  </span>{' '}
                  won anyway.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge tone="lose" icon={<Flame />}>
                    Upset by {biggestUpset.method}
                  </Badge>
                  <Badge tone="outline">Season {biggestUpset.season}</Badge>
                </div>
                <Link
                  href="/model"
                  className="mt-5 inline-flex min-h-[36px] items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-volt-light transition-colors duration-200 hover:text-volt-glow"
                >
                  Read the full backtest
                  <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <p className="text-sm text-ink-soft">No upsets on record.</p>
            )}
          </Panel>

          <Panel label="Backtested" title="Scoreboard" grid>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="label-mono">Accuracy</dt>
                <dd
                  className="mt-1 font-display text-3xl font-bold text-ember-light"
                  data-numeric
                >
                  {stats.accuracy}%
                </dd>
              </div>
              <div>
                <dt className="label-mono">Coin-flip baseline</dt>
                <dd className="mt-1 font-display text-3xl font-bold text-ink-mute" data-numeric>
                  50%
                </dd>
              </div>
              <div>
                <dt className="label-mono">Fights replayed</dt>
                <dd className="mt-1 font-display text-xl font-semibold text-ink" data-numeric>
                  {stats.matches}
                </dd>
              </div>
              <div>
                <dt className="label-mono">Knockouts</dt>
                <dd className="mt-1 font-display text-xl font-semibold text-ink" data-numeric>
                  {stats.knockouts}
                </dd>
              </div>
            </dl>

            <Link
              href="/tournament"
              className="mt-6 flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-pit-500 bg-pit-850 font-mono text-xs uppercase tracking-[0.1em] text-ink transition-colors duration-200 hover:border-ember/60 hover:text-ember-light"
            >
              <Trophy aria-hidden="true" className="h-4 w-4" />
              Run a tournament
            </Link>
          </Panel>
        </div>
      </section>
    </div>
  );
}
