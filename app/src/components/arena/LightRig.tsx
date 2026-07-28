'use client';

import { ARENA } from './palette';

export interface LightRigProps {
  /** Overall exposure. 1 is the tuned default. */
  intensity?: number;
  /** Casts shadows from the key light. Turn off for cheap card-sized scenes. */
  shadows?: boolean;
  /** Blue/amber accent spots pointing at the two fighting positions. */
  spots?: boolean;
}

/**
 * One lighting rig, reused by every scene, so the arena looks identical on the
 * hero, the matchup, the bracket and the robot detail page.
 */
export function LightRig({ intensity = 1, shadows = true, spots = true }: LightRigProps) {
  return (
    <group>
      {/* Just enough fill to keep the shadow side from going pure black. */}
      <ambientLight intensity={0.32 * intensity} color={ARENA.ink} />
      <hemisphereLight
        intensity={0.35 * intensity}
        color={ARENA.volt}
        groundColor={ARENA.pit950}
      />

      {/* Key light, high and slightly behind camera-right. */}
      <directionalLight
        position={[6, 12, 8]}
        intensity={1.5 * intensity}
        color="#DCE7FA"
        castShadow={shadows}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-far={40}
        shadow-bias={-0.0008}
      />

      {/* Cool rim from behind, which separates the bots from the dark floor. */}
      <directionalLight position={[-8, 5, -9]} intensity={0.7 * intensity} color={ARENA.volt} />

      {spots ? (
        <>
          <spotLight
            position={[-7, 9, 2]}
            angle={0.5}
            penumbra={0.85}
            intensity={22 * intensity}
            color={ARENA.volt}
            distance={30}
          />
          <spotLight
            position={[7, 9, 2]}
            angle={0.5}
            penumbra={0.85}
            intensity={22 * intensity}
            color={ARENA.ember}
            distance={30}
          />
        </>
      ) : null}
    </group>
  );
}
