import type { BacktestResult } from '@/lib/types';

type SeasonRow = BacktestResult['by_season'][number];

const VIEW_W = 720;
const VIEW_H = 260;
const PAD = { top: 18, right: 16, bottom: 36, left: 44 } as const;
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;

/**
 * Hand-built line chart — no charting library. Accuracy is plotted against the
 * 50% coin-flip reference so the reader can see, per season, whether the model
 * beat chance. The same figures are repeated in the table below the chart, so
 * nothing lives only inside the SVG.
 */
export function SeasonAccuracyChart({ seasons }: { seasons: SeasonRow[] }) {
  if (seasons.length === 0) {
    return <p className="text-sm text-ink-mute">No seasons in the backtest sample.</p>;
  }

  const x = (i: number) =>
    PAD.left + (seasons.length === 1 ? PLOT_W / 2 : (i / (seasons.length - 1)) * PLOT_W);
  const y = (accuracy: number) => PAD.top + PLOT_H - (Math.min(100, Math.max(0, accuracy)) / 100) * PLOT_H;

  const points = seasons.map((s, i) => `${x(i).toFixed(1)},${y(s.accuracy).toFixed(1)}`).join(' ');

  const first = seasons[0];
  const last = seasons[seasons.length - 1];
  const above = seasons.filter((s) => s.accuracy > 50).length;
  const bestSeason = seasons.reduce((a, b) => (b.accuracy > a.accuracy ? b : a));
  const worstSeason = seasons.reduce((a, b) => (b.accuracy < a.accuracy ? b : a));

  const ariaLabel =
    `Line chart of backtest accuracy by season, ${first.season} to ${last.season}. ` +
    `Accuracy runs from ${first.accuracy}% in ${first.season} to ${last.accuracy}% in ${last.season}, ` +
    `peaking at ${bestSeason.accuracy}% in ${bestSeason.season} and bottoming at ${worstSeason.accuracy}% in ${worstSeason.season}. ` +
    `${above} of ${seasons.length} seasons finish above the 50% coin-flip line.`;

  return (
    <div>
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-auto w-full"
      >
        {/* Y gridlines at 0 / 50 / 100% */}
        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={VIEW_W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-pit-700"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 10}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-ink-mute font-mono text-[11px]"
            >
              {tick}%
            </text>
          </g>
        ))}

        {/* Coin-flip reference, drawn over the grid in amber so it reads as a threshold. */}
        <line
          x1={PAD.left}
          x2={VIEW_W - PAD.right}
          y1={y(50)}
          y2={y(50)}
          className="stroke-ember/70"
          strokeWidth="1.5"
          strokeDasharray="6 5"
        />
        <text
          x={VIEW_W - PAD.right}
          y={y(50) - 8}
          textAnchor="end"
          className="fill-ember-light font-mono text-[11px] uppercase tracking-[0.1em]"
        >
          coin flip 50%
        </text>

        {/* Axes */}
        <line
          x1={PAD.left}
          x2={PAD.left}
          y1={PAD.top}
          y2={PAD.top + PLOT_H}
          className="stroke-pit-600"
          strokeWidth="1"
        />

        <polyline
          points={points}
          fill="none"
          className="stroke-volt"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {seasons.map((s, i) => (
          <g key={s.season}>
            <circle
              cx={x(i)}
              cy={y(s.accuracy)}
              r="4"
              className="fill-pit-950 stroke-volt-light"
              strokeWidth="2"
            />
            <text
              x={x(i)}
              y={PAD.top + PLOT_H + 22}
              textAnchor="middle"
              className="fill-ink-mute font-mono text-[11px]"
            >
              S{s.season}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left">
          <caption className="sr-only">
            Backtest accuracy per season, the same figures plotted in the chart above.
          </caption>
          <thead>
            <tr className="border-b border-pit-600">
              <th scope="col" className="label-mono px-2 py-2">
                Season
              </th>
              <th scope="col" className="label-mono px-2 py-2 text-right">
                Correct
              </th>
              <th scope="col" className="label-mono px-2 py-2 text-right">
                Fights
              </th>
              <th scope="col" className="label-mono px-2 py-2 text-right">
                Accuracy
              </th>
              <th scope="col" className="label-mono px-2 py-2 text-right">
                vs coin flip
              </th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((s) => {
              const delta = s.accuracy - 50;
              return (
                <tr key={s.season} className="border-b border-pit-700/70">
                  <td className="px-2 py-1.5 font-mono text-sm text-ink" data-numeric>
                    S{s.season}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-sm text-ink-soft" data-numeric>
                    {s.correct}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-sm text-ink-soft" data-numeric>
                    {s.total}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-sm text-ink" data-numeric>
                    {s.accuracy.toFixed(1)}%
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-sm" data-numeric>
                    <span className={delta >= 0 ? 'text-win' : 'text-lose'}>
                      {delta >= 0 ? 'above' : 'below'} {Math.abs(delta).toFixed(1)} pts
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
