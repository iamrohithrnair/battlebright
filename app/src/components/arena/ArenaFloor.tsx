'use client';

import { ContactShadows, Grid } from '@react-three/drei';
import { ARENA } from './palette';

export interface ArenaFloorProps {
  /** Radius of the floor plate. */
  size?: number;
  /** Draws the low perimeter wall of the BattleBox. */
  walls?: boolean;
  /** Soft contact shadow under the bots. Disable on static/low-cost scenes. */
  shadows?: boolean;
  /** Highlights the centre clash circle in amber. */
  centreMark?: boolean;
}

/**
 * The BattleBox floor: a dark plate, a blueprint grid that fades toward the
 * horizon, and an optional perimeter wall so the space feels enclosed.
 */
export function ArenaFloor({
  size = 40,
  walls = true,
  shadows = true,
  centreMark = true,
}: ArenaFloorProps) {
  const half = size / 2;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color={ARENA.pit950} metalness={0.35} roughness={0.85} />
      </mesh>

      <Grid
        position={[0, 0.001, 0]}
        args={[size, size]}
        cellSize={1}
        cellThickness={0.6}
        cellColor={ARENA.pit600}
        sectionSize={5}
        sectionThickness={1.1}
        sectionColor={ARENA.volt}
        fadeDistance={size * 0.75}
        fadeStrength={1.4}
        infiniteGrid={false}
        followCamera={false}
      />

      {centreMark ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
          <ringGeometry args={[2.55, 2.7, 64]} />
          <meshBasicMaterial color={ARENA.ember} transparent opacity={0.32} toneMapped={false} />
        </mesh>
      ) : null}

      {shadows ? (
        <ContactShadows
          position={[0, 0.012, 0]}
          scale={size * 0.45}
          opacity={0.75}
          blur={2.4}
          far={5}
          resolution={512}
          color="#000000"
        />
      ) : null}

      {walls ? (
        <group>
          {(
            [
              [0, 0, -half, 0],
              [0, 0, half, 0],
              [-half, 0, 0, Math.PI / 2],
              [half, 0, 0, Math.PI / 2],
            ] as const
          ).map(([x, y, z, ry], i) => (
            <mesh key={i} position={[x, 0.75 + y, z]} rotation={[0, ry, 0]}>
              <boxGeometry args={[size, 1.5, 0.18]} />
              <meshStandardMaterial
                color={ARENA.pit850}
                metalness={0.5}
                roughness={0.7}
                transparent
                opacity={0.55}
              />
            </mesh>
          ))}
        </group>
      ) : null}
    </group>
  );
}
