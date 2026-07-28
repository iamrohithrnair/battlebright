import { WEAPON_INFO } from '@/lib/data/roster';
import type { WeaponType } from '@/lib/types';
import { cn } from '@/lib/cn';

export interface RobotSilhouetteProps {
  weapon: WeaponType;
  className?: string;
  /** Overrides the weapon-class accent. */
  accent?: string;
  /** Adds a spin animation to the weapon element. */
  animate?: boolean;
}

/**
 * A flat, pure-SVG side profile of a robot, drawn with the same weapon-class
 * vocabulary as the 3D mesh.
 *
 * The roster grid shows 42 bots at once, so mounting 42 WebGL contexts would be
 * reckless — these silhouettes carry the same information for the cost of a few
 * paths.
 */
export function RobotSilhouette({
  weapon,
  className,
  accent,
  animate = false,
}: RobotSilhouetteProps) {
  const color = accent ?? WEAPON_INFO[weapon].accent;

  return (
    <svg
      viewBox="0 0 120 58"
      className={cn('h-full w-full', className)}
      role="img"
      aria-label={`${WEAPON_INFO[weapon].label} silhouette`}
      fill="none"
    >
      {/* Floor line */}
      <line x1="4" y1="51.5" x2="116" y2="51.5" stroke="#1E293B" strokeWidth="1" />

      {/* Wheels */}
      <circle cx="34" cy="45" r="6.5" stroke="#2C3A50" strokeWidth="1.5" />
      <circle cx="80" cy="45" r="6.5" stroke="#2C3A50" strokeWidth="1.5" />

      {/* Wedge chassis */}
      <path
        d="M18 43 L96 43 L96 35 L73 25 L23 25 L18 32 Z"
        stroke="#475569"
        strokeWidth="1.6"
        fill="#0B111C"
        strokeLinejoin="round"
      />
      {/* Accent stripe on the top deck */}
      <line x1="27" y1="25" x2="66" y2="25" stroke={color} strokeWidth="2" opacity="0.85" />

      <Weapon weapon={weapon} color={color} animate={animate} />
    </svg>
  );
}

function Weapon({
  weapon,
  color,
  animate,
}: {
  weapon: WeaponType;
  color: string;
  animate: boolean;
}) {
  const stroke = { stroke: color, strokeWidth: 2.4, strokeLinecap: 'round' as const };
  const spin = animate ? 'origin-center motion-safe:animate-[spin_1.4s_linear_infinite]' : '';

  switch (weapon) {
    case 'horizontal_spinner':
      return (
        <g>
          <rect x="12" y="16" width="96" height="5" rx="2.5" fill={color} opacity="0.9" />
          <line x1="60" y1="21" x2="60" y2="25" {...stroke} />
        </g>
      );

    case 'vertical_spinner':
      return (
        <g>
          <circle cx="99" cy="29" r="12.5" {...stroke} />
          <circle cx="99" cy="29" r="4" fill={color} />
          <g className={spin} style={{ transformOrigin: '99px 29px' }}>
            <line x1="99" y1="17" x2="99" y2="41" stroke={color} strokeWidth="1.6" />
            <line x1="87" y1="29" x2="111" y2="29" stroke={color} strokeWidth="1.6" />
          </g>
        </g>
      );

    case 'drum_spinner':
      return (
        <g>
          <circle cx="101" cy="38" r="9" {...stroke} fill="#0B111C" />
          <line x1="95" y1="32" x2="107" y2="44" stroke={color} strokeWidth="2" />
          <line x1="95" y1="44" x2="107" y2="32" stroke={color} strokeWidth="2" />
        </g>
      );

    case 'overhead_saw':
      return (
        <g>
          <path d="M30 24 L84 11" stroke="#475569" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="92" cy="9" r="10" {...stroke} />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <line
                key={i}
                x1={92 + Math.cos(a) * 10}
                y1={9 + Math.sin(a) * 10}
                x2={92 + Math.cos(a) * 13}
                y2={9 + Math.sin(a) * 13}
                stroke={color}
                strokeWidth="1.8"
              />
            );
          })}
        </g>
      );

    case 'flipper':
      return (
        <g>
          <path d="M97 41 L58 25" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <circle cx="97" cy="41" r="2.6" fill={color} />
        </g>
      );

    case 'lifter':
      return (
        <g>
          <line x1="96" y1="39" x2="116" y2="36" {...stroke} />
          <line x1="96" y1="45" x2="116" y2="44" {...stroke} />
          <line x1="96" y1="36" x2="96" y2="46" stroke="#475569" strokeWidth="2" />
        </g>
      );

    case 'hammer':
      return (
        <g>
          <path d="M26 24 L54 9" stroke="#475569" strokeWidth="2.8" strokeLinecap="round" />
          <rect x="52" y="4" width="12" height="9" rx="2" fill={color} />
          <circle cx="26" cy="24" r="3" fill={color} />
        </g>
      );

    case 'crusher':
      return (
        <g>
          <path d="M92 32 L116 24" {...stroke} />
          <path d="M92 40 L114 43" {...stroke} />
          <circle cx="92" cy="36" r="3.4" fill={color} />
        </g>
      );
  }
}
