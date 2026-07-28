import { cn } from '@/lib/cn';

export interface RadarAxis {
  label: string;
  /** 0-100. */
  value: number;
  /** What the number means, shown in the companion table. */
  detail: string;
}

export interface SignalRadarProps {
  axes: RadarAxis[];
  /** Colour of the plotted polygon — normally the weapon-class accent. */
  accent: string;
  className?: string;
  /** The roster average, drawn as a faint reference polygon. */
  baseline?: number[];
}

const SIZE = 260;
const CENTRE = SIZE / 2;
const RADIUS = 92;
const RINGS = [25, 50, 75, 100];

/**
 * Hand-built SVG radar. No charting library — this way it inherits the palette
 * and stays a few hundred bytes.
 *
 * The chart is marked up as an image with a summary label, and the same numbers
 * are repeated in the table underneath, so the data is never only in the graphic.
 */
export function SignalRadar({ axes, accent, className, baseline }: SignalRadarProps) {
  const point = (index: number, value: number) => {
    // Start at 12 o'clock and go clockwise.
    const angle = (index / axes.length) * Math.PI * 2 - Math.PI / 2;
    const r = (Math.max(0, Math.min(100, value)) / 100) * RADIUS;
    return [CENTRE + Math.cos(angle) * r, CENTRE + Math.sin(angle) * r] as const;
  };

  const polygon = (values: number[]) =>
    values.map((v, i) => point(i, v).join(',')).join(' ');

  return (
    <div className={cn('flex flex-col gap-5 sm:flex-row sm:items-center', className)}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto h-[240px] w-[240px] shrink-0 sm:mx-0"
        role="img"
        aria-label={`Signal profile: ${axes
          .map((a) => `${a.label} ${Math.round(a.value)} out of 100`)
          .join(', ')}.`}
      >
        {/* Rings */}
        {RINGS.map((ring) => (
          <polygon
            key={ring}
            points={polygon(axes.map(() => ring))}
            fill="none"
            stroke="#1E293B"
            strokeWidth="1"
          />
        ))}

        {/* Spokes + axis labels */}
        {axes.map((axis, i) => {
          const [x, y] = point(i, 100);
          const [lx, ly] = point(i, 128);
          return (
            <g key={axis.label}>
              <line x1={CENTRE} y1={CENTRE} x2={x} y2={y} stroke="#161E2E" strokeWidth="1" />
              <text
                x={lx}
                y={ly}
                textAnchor={lx > CENTRE + 6 ? 'start' : lx < CENTRE - 6 ? 'end' : 'middle'}
                dominantBaseline="middle"
                className="fill-[#6F7F97] font-mono"
                fontSize="8.5"
                letterSpacing="0.7"
              >
                {axis.label.toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* Roster average, for context */}
        {baseline?.length === axes.length ? (
          <polygon
            points={polygon(baseline)}
            fill="none"
            stroke="#2C3A50"
            strokeWidth="1.4"
            strokeDasharray="3 3"
          />
        ) : null}

        {/* This bot */}
        <polygon
          points={polygon(axes.map((a) => a.value))}
          fill={accent}
          fillOpacity="0.16"
          stroke={accent}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {axes.map((axis, i) => {
          const [x, y] = point(i, axis.value);
          return <circle key={axis.label} cx={x} cy={y} r="2.8" fill={accent} />;
        })}
      </svg>

      {/* The same data as text */}
      <dl className="min-w-0 flex-1 space-y-2">
        {axes.map((axis) => (
          <div key={axis.label} className="flex items-baseline gap-3">
            <dt className="w-28 shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
              {axis.label}
            </dt>
            <dd className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-pit-850">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, axis.value)}%`, backgroundColor: accent }}
                  />
                </div>
                <span
                  className="w-9 shrink-0 text-right font-mono text-xs font-semibold text-ink"
                  data-numeric
                >
                  {Math.round(axis.value)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-ink-mute">{axis.detail}</p>
            </dd>
          </div>
        ))}
        {baseline ? (
          <p className="flex items-center gap-2 border-t border-pit-700 pt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
            <span aria-hidden="true" className="h-px w-4 border-t border-dashed border-pit-500" />
            dashed = roster average
          </p>
        ) : null}
      </dl>
    </div>
  );
}
