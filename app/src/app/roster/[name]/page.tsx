import {
  ArrowLeft,
  Flag,
  Gauge,
  Radio,
  Scale,
  Swords,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Wrench,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MatchTimeline } from '@/components/roster/MatchTimeline';
import { RobotShowcase } from '@/components/roster/RobotShowcase';
import { SignalRadar, type RadarAxis } from '@/components/roster/SignalRadar';
import { Badge, Button, Panel, ProbabilityBar, SectionLabel, StatTile } from '@/components/ui';
import { WEAPON_INFO } from '@/lib/data/roster';
import {
  allRobots,
  koRate,
  leaderboard,
  predict,
  robotDetail,
  robotNames,
  scoutingReport,
  weaponMeta,
  winRate,
} from '@/lib/engine';

/** The roster is fixed, so every detail page can be prerendered at build time. */
export function generateStaticParams() {
  return robotNames().map((name) => ({ name: encodeURIComponent(name) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const robot = decodeURIComponent(name);
  const detail = robotDetail(robot);
  if (!detail) return { title: 'Robot not found' };

  const info = WEAPON_INFO[detail.weapon_type];
  return {
    title: robot,
    description: `${robot} — a ${info.label.toLowerCase()} by ${detail.builder} (${detail.country}). ${detail.wins}-${detail.losses} record, ${detail.win_rate}% win rate, ${detail.ko_rate}% of wins by KO. Full scouting report and signal profile.`,
  };
}

export default async function RobotDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const robotName = decodeURIComponent(name);

  const detail = robotDetail(robotName);
  const report = scoutingReport(robotName);
  if (!detail || !report) notFound();

  const info = WEAPON_INFO[detail.weapon_type];
  const roster = allRobots();
  const board = leaderboard();

  // How often the model favours this bot across the whole field.
  const coverage = roster.filter((o) => o.robot !== robotName);
  const favoured = coverage.filter((o) => {
    const p = predict(robotName, o.robot, true);
    return p ? p.prob_a >= 50 : false;
  }).length;
  const coveragePct = coverage.length ? (favoured / coverage.length) * 100 : 0;

  const classMeta = weaponMeta().find((w) => w.weapon === detail.weapon_type);
  const maxFights = Math.max(...roster.map((r) => r.wins + r.losses));
  const fights = detail.wins + detail.losses;

  const axes: RadarAxis[] = [
    {
      label: 'Career form',
      value: detail.win_rate,
      detail: `${detail.wins}-${detail.losses} across ${fights} fights`,
    },
    {
      label: 'Finishing',
      value: detail.ko_rate,
      detail: `${detail.ko_wins} of ${detail.wins} wins by KO`,
    },
    {
      label: 'Class strength',
      value: classMeta?.battle_rate ?? 50,
      detail: `${info.label}s win ${classMeta?.battle_rate ?? 50}% of logged fights`,
    },
    {
      label: 'Experience',
      value: maxFights ? (fights / maxFights) * 100 : 0,
      detail: `${fights} fights vs ${maxFights} for the busiest bot`,
    },
    {
      label: 'Matchup edge',
      value: coveragePct,
      detail: `Favoured in ${favoured} of ${coverage.length} pairings`,
    },
  ];

  // Roster averages, drawn as the dashed reference polygon.
  const avgWin = (roster.reduce((s, r) => s + winRate(r), 0) / roster.length) * 100;
  const avgKo = (roster.reduce((s, r) => s + koRate(r), 0) / roster.length) * 100;
  const avgFights =
    (roster.reduce((s, r) => s + r.wins + r.losses, 0) / roster.length / maxFights) * 100;
  const baseline = [avgWin, avgKo, 50, avgFights, 50];

  const rankLabel = detail.rank ? `#${detail.rank} of ${board.length}` : 'Unranked';
  const topOpponent = report.best_matchups[0];

  return (
    <div className="shell pb-24 pt-28 sm:pt-32">
      <Link
        href="/roster"
        className="mb-6 inline-flex min-h-[44px] items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft transition-colors duration-200 hover:text-volt-light"
      >
        <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
        Back to roster
      </Link>

      {/* ---------------- Hero ---------------- */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Panel flush brackets className="overflow-hidden">
          <RobotShowcase
            name={detail.robot}
            weapon={detail.weapon_type}
            className="h-[300px] w-full sm:h-[420px]"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-pit-600 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
              Procedural geometry · no model files
            </p>
            <Badge tone="volt" icon={<Radio />}>
              Drag to orbit
            </Badge>
          </div>
        </Panel>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex min-h-[28px] items-center gap-1.5 rounded border px-2.5 font-mono text-[10px] uppercase tracking-[0.12em]"
              style={{ borderColor: `${info.accent}66`, color: info.accent }}
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: info.accent }}
              />
              {info.label}
            </span>
            <Badge tone={detail.rank && detail.rank <= 5 ? 'ember' : 'outline'} icon={<Trophy />}>
              {rankLabel}
            </Badge>
            <Badge tone="outline">{report.archetype}</Badge>
          </div>

          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            {detail.robot}
          </h1>

          <p className="mt-4 text-base leading-relaxed text-ink-soft">{report.summary}</p>

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile compact label="Record" value={`${detail.wins}-${detail.losses}`} />
            <StatTile
              compact
              label="Win rate"
              value={detail.win_rate}
              unit="%"
              tone="volt"
              icon={<Gauge />}
            />
            <StatTile
              compact
              label="KO rate"
              value={detail.ko_rate}
              unit="%"
              tone="ember"
              icon={<Target />}
            />
            <StatTile compact label="Weight" value={detail.weight_lb} unit="lb" icon={<Scale />} />
          </dl>

          <div className="mt-4 grid gap-2 rounded-lg border border-pit-600 bg-pit-900/60 p-4 sm:grid-cols-2">
            <p className="flex items-center gap-2 text-sm text-ink-soft">
              <Wrench aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-mute" />
              <span className="truncate">{detail.builder}</span>
            </p>
            <p className="flex items-center gap-2 text-sm text-ink-soft">
              <Flag aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-mute" />
              <span className="truncate">{detail.country}</span>
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              href={`/predict?a=${encodeURIComponent(detail.robot)}${
                topOpponent ? `&b=${encodeURIComponent(topOpponent.opponent)}` : ''
              }`}
              variant="primary"
              size="lg"
              icon={<Swords />}
            >
              Fight this bot
            </Button>
            <Button href={`/intel?robot=${encodeURIComponent(detail.robot)}`} variant="secondary" size="lg" icon={<Radio />}>
              Verify with live data
            </Button>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-ink-mute">
            {info.blurb}
          </p>
        </div>
      </div>

      {/* ---------------- Signals + scouting ---------------- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel label="Signal profile" title="How this bot scores" grid>
          <SignalRadar axes={axes} accent={info.accent} baseline={baseline} />
        </Panel>

        <Panel label="Scouting report" title="Strengths and holes">
          <div className="space-y-5">
            <div>
              <SectionLabel icon={<ThumbsUp className="h-3.5 w-3.5" />}>Strengths</SectionLabel>
              <ul className="mt-2.5 space-y-2">
                {report.strengths.map((s) => (
                  <li
                    key={s}
                    className="flex gap-2.5 rounded-md border border-win/25 bg-win/[0.05] px-3 py-2.5 text-sm leading-relaxed text-ink-soft"
                  >
                    <ThumbsUp aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-win" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <SectionLabel icon={<ThumbsDown className="h-3.5 w-3.5" />}>Weaknesses</SectionLabel>
              <ul className="mt-2.5 space-y-2">
                {report.weaknesses.map((s) => (
                  <li
                    key={s}
                    className="flex gap-2.5 rounded-md border border-lose/25 bg-lose/[0.05] px-3 py-2.5 text-sm leading-relaxed text-ink-soft"
                  >
                    <ThumbsDown
                      aria-hidden="true"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lose"
                    />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>
      </div>

      {/* ---------------- Matchups ---------------- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <MatchupList
          label="Best matchups"
          title={`Who ${detail.robot} beats`}
          rows={report.best_matchups}
          robot={detail.robot}
          tone="win"
        />
        <MatchupList
          label="Worst matchups"
          title={`Who beats ${detail.robot}`}
          rows={report.worst_matchups}
          robot={detail.robot}
          tone="lose"
        />
      </div>

      {/* ---------------- History ---------------- */}
      <div className="mt-6">
        <Panel
          label="Fight history"
          title={`${detail.matches.length} recorded fights`}
          action={
            <Badge tone="outline">
              {detail.matches.filter((m) => m.method === 'KO').length} by KO
            </Badge>
          }
        >
          <MatchTimeline matches={detail.matches} robot={detail.robot} />
        </Panel>
      </div>
    </div>
  );
}

function MatchupList({
  label,
  title,
  rows,
  robot,
  tone,
}: {
  label: string;
  title: string;
  rows: { opponent: string; prob: number }[];
  robot: string;
  tone: 'win' | 'lose';
}) {
  return (
    <Panel label={label} title={title} flush>
      <ul className="divide-y divide-pit-700">
        {rows.map((row) => (
          <li key={row.opponent} className="px-4 py-3 sm:px-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <Link
                href={`/predict?a=${encodeURIComponent(robot)}&b=${encodeURIComponent(row.opponent)}`}
                className="min-w-0 truncate font-display text-sm font-semibold text-ink transition-colors duration-200 hover:text-volt-light"
              >
                {row.opponent}
              </Link>
              <span
                className={`shrink-0 font-mono text-xs font-semibold ${
                  tone === 'win' ? 'text-win' : 'text-lose'
                }`}
                data-numeric
              >
                {row.prob.toFixed(1)}%
              </span>
            </div>
            <ProbabilityBar
              labelA={robot}
              labelB={row.opponent}
              probA={row.prob}
              bareBar
              size="sm"
              highlightWinner={false}
            />
          </li>
        ))}
      </ul>
      <p className="border-t border-pit-700 px-4 py-3 text-xs leading-relaxed text-ink-mute sm:px-5">
        Percentages are {robot}&apos;s modelled win probability. Click any opponent to open the
        full matchup.
      </p>
    </Panel>
  );
}
