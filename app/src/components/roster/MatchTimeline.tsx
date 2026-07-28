import { Check, X, Zap } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui';
import type { RobotMatch } from '@/lib/types';

/**
 * Season-by-season fight history. Result is carried by an icon and the words
 * "Win"/"Loss" as well as colour.
 */
export function MatchTimeline({ matches, robot }: { matches: RobotMatch[]; robot: string }) {
  if (!matches.length) {
    return (
      <p className="text-sm leading-relaxed text-ink-soft">
        No individual fights for {robot} are recorded in this dataset — its career record still
        feeds the model.
      </p>
    );
  }

  // Newest season first, matching how a team would review tape.
  const seasons = [...new Set(matches.map((m) => m.season))].sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      {seasons.map((season) => {
        const inSeason = matches.filter((m) => m.season === season);
        const wins = inSeason.filter((m) => m.result === 'Win').length;

        return (
          <section key={season}>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h3 className="font-display text-sm font-bold text-ink" data-numeric>
                Season {season}
              </h3>
              <span className="hairline max-w-[120px] flex-1" aria-hidden="true" />
              <Badge tone={wins > inSeason.length - wins ? 'win' : 'outline'}>
                {wins}W · {inSeason.length - wins}L
              </Badge>
            </div>

            <ol className="relative space-y-2 border-l border-pit-700 pl-5">
              {inSeason.map((match, i) => {
                const won = match.result === 'Win';
                return (
                  <li key={`${match.opponent}-${i}`} className="relative">
                    {/* Timeline node */}
                    <span
                      aria-hidden="true"
                      className={`absolute -left-[26px] top-3 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 ${
                        won ? 'border-win bg-pit-950' : 'border-lose bg-pit-950'
                      }`}
                    />
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-pit-700 bg-pit-850/50 px-3 py-2.5 transition-colors duration-200 hover:border-pit-500">
                      <span
                        className={`flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] ${
                          won ? 'text-win' : 'text-lose'
                        }`}
                      >
                        {won ? (
                          <Check aria-hidden="true" className="h-3.5 w-3.5" />
                        ) : (
                          <X aria-hidden="true" className="h-3.5 w-3.5" />
                        )}
                        {match.result}
                      </span>

                      <span className="text-xs text-ink-mute">vs</span>

                      <Link
                        href={`/roster/${encodeURIComponent(match.opponent)}`}
                        className="min-w-0 truncate font-display text-sm font-medium text-ink transition-colors duration-200 hover:text-volt-light"
                      >
                        {match.opponent}
                      </Link>

                      <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
                        {match.method === 'KO' ? (
                          <Zap aria-hidden="true" className="h-3 w-3 text-ember" />
                        ) : null}
                        {match.method === 'KO' ? 'Knockout' : 'Judges decision'}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
