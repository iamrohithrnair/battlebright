import { Check, Circle, Trophy } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { TournamentResult } from '@/lib/types';

export interface Bracket2DProps {
  result: TournamentResult;
  /** Matches resolved so far, in flat round-major order. */
  revealed: number;
}

const roundName = (round: number, total: number) => {
  const fromEnd = total - round;
  if (fromEnd === 1) return 'Final';
  if (fromEnd === 2) return 'Semi-finals';
  if (fromEnd === 3) return 'Quarter-finals';
  return `Round ${round + 1}`;
};

/**
 * The accessible bracket. Everything the 3D scene shows is also here as
 * structured, keyboard-navigable, screen-reader-friendly markup.
 */
export function Bracket2D({ result, revealed }: Bracket2DProps) {
  let flat = 0;
  const rounds = result.rounds.map((matches, round) => {
    const withFlat = matches.map((match) => ({ match, flat: flat++ }));
    return { round, matches: withFlat };
  });
  const total = flat;
  const complete = revealed >= total;

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-4 pb-2">
        {rounds.map(({ round, matches }) => (
          <section key={round} className="w-[248px] shrink-0">
            <h3 className="label-mono mb-2.5 flex items-center justify-between gap-2">
              {roundName(round, result.rounds.length)}
              <span data-numeric className="text-ink-mute">
                {matches.filter((m) => m.flat < revealed).length}/{matches.length}
              </span>
            </h3>

            <ol className="flex h-full flex-col justify-around gap-3">
              {matches.map(({ match, flat: index }) => {
                const resolved = index < revealed;
                const active = index === revealed;
                const winnerIsA = match.winner === match.a;

                return (
                  <li
                    key={`${match.a}-${match.b}`}
                    className={cn(
                      'rounded-md border transition-colors duration-300',
                      active
                        ? 'border-ember/60 bg-ember/[0.06]'
                        : resolved
                          ? 'border-pit-500 bg-pit-850'
                          : 'border-pit-700 bg-pit-900/50',
                    )}
                  >
                    <Side
                      name={match.a}
                      prob={match.prob_a}
                      winner={resolved && winnerIsA}
                      loser={resolved && !winnerIsA}
                      resolved={resolved}
                    />
                    <div className="h-px bg-pit-700" />
                    <Side
                      name={match.b}
                      prob={match.prob_b}
                      winner={resolved && !winnerIsA}
                      loser={resolved && winnerIsA}
                      resolved={resolved}
                    />
                    <div className="flex items-center justify-between gap-2 border-t border-pit-700 px-2.5 py-1.5">
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-mute">
                        {resolved ? `${match.confidence} confidence` : active ? 'Resolving…' : 'Pending'}
                      </span>
                      {active ? <Badge tone="ember" size="sm" pulse>Live</Badge> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}

        {/* Champion column */}
        <section className="flex w-[248px] shrink-0 flex-col">
          <h3 className="label-mono mb-2.5">Champion</h3>
          <div
            className={cn(
              'flex flex-1 flex-col items-center justify-center rounded-md border px-4 py-8 text-center transition-colors duration-300',
              complete ? 'border-ember/60 bg-ember/[0.07]' : 'border-dashed border-pit-700',
            )}
          >
            <Trophy
              aria-hidden="true"
              className={cn('h-7 w-7', complete ? 'text-ember' : 'text-pit-500')}
            />
            {complete ? (
              <>
                <Link
                  href={`/roster/${encodeURIComponent(result.champion)}`}
                  className="mt-3 font-display text-lg font-bold text-ember-light transition-colors duration-200 hover:text-ember"
                >
                  {result.champion}
                </Link>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  Won {result.rounds.length} rounds
                </p>
              </>
            ) : (
              <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-ink-mute">
                Undecided
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Side({
  name,
  prob,
  winner,
  loser,
  resolved,
}: {
  name: string;
  prob: number;
  winner: boolean;
  loser: boolean;
  resolved: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-2">
      {/* Icon carries the result as well as the colour. */}
      {winner ? (
        <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ember" />
      ) : (
        <Circle
          aria-hidden="true"
          className={cn('h-3 w-3 shrink-0', loser ? 'text-ink-mute' : 'text-pit-500')}
        />
      )}

      <Link
        href={`/roster/${encodeURIComponent(name)}`}
        className={cn(
          'min-w-0 flex-1 truncate font-display text-[13px] transition-colors duration-200 hover:text-volt-light',
          winner ? 'font-bold text-ember-light' : loser ? 'text-ink-mute' : 'text-ink-soft',
        )}
      >
        {name}
      </Link>

      <span
        className={cn(
          'shrink-0 font-mono text-[11px]',
          winner ? 'font-semibold text-ink' : 'text-ink-mute',
        )}
        data-numeric
      >
        {resolved ? `${prob}%` : '—'}
      </span>

      {winner ? <span className="sr-only">Winner</span> : null}
      {loser ? <span className="sr-only">Eliminated</span> : null}
    </div>
  );
}
