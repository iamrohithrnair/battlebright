'use client';

import { ArenaCanvas, ArenaFloor, FloorGlow, LightRig, RobotMesh, SpotBeam } from '@/components/arena';
import { WEAPON_INFO } from '@/lib/data/roster';
import { usePrefersReducedMotion } from '@/lib/hooks';
import type { WeaponType } from '@/lib/types';

export interface RobotShowcaseProps {
  name: string;
  weapon: WeaponType;
  className?: string;
}

/** A single bot on a slowly orbiting camera — the hero of the detail page. */
export function RobotShowcase({ name, weapon, className }: RobotShowcaseProps) {
  const reduced = usePrefersReducedMotion();
  const accent = WEAPON_INFO[weapon].accent;

  return (
    <ArenaCanvas
      className={className}
      camera={{ position: [4.6, 2.4, 5.4], fov: 40 }}
      controls={{
        target: [0, 0.55, 0],
        minDistance: 3.6,
        maxDistance: 12,
        autoRotate: true,
        autoRotateSpeed: 0.75,
      }}
      ariaLabel={`A procedurally generated 3D model of ${name}, a ${WEAPON_INFO[weapon].label.toLowerCase()}. Drag to orbit. All of its statistics are listed alongside in text.`}
      underlay={
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,rgba(59,130,246,0.16),transparent_60%)]"
        />
      }
      overlay={
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-pit-950 to-transparent"
        />
      }
    >
      <LightRig spots />
      <ArenaFloor size={22} walls={false} centreMark={false} />
      <FloorGlow color={accent} radius={2.3} opacity={0.24} />
      <SpotBeam color={accent} opacity={0.1} height={7} radius={2} />
      <RobotMesh
        name={name}
        weapon={weapon}
        scale={1.35}
        intensity={0.8}
        animate={!reduced}
        highlight
      />
    </ArenaCanvas>
  );
}
