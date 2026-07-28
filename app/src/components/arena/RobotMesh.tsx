'use client';

import { useFrame } from '@react-three/fiber';
import { forwardRef, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { WeaponType } from '@/lib/types';
import { ARENA, accentFor, liveryFor } from './palette';

/**
 * Every robot in the app is generated from primitives at runtime — no .glb, no
 * external assets. The chassis is shared; the weapon assembly is what makes a
 * horizontal spinner read differently from a crusher.
 */
export interface RobotMeshProps {
  weapon: WeaponType;
  /** Robot name, used only to pick a stable team livery. */
  name?: string;
  /** Overrides the weapon-class accent colour. */
  accent?: string;
  /** Runs the weapon animation. Turn off for static/reduced-motion frames. */
  animate?: boolean;
  /** Multiplier on weapon speed — 0.35 for an idle bot, 1 for a live fight. */
  intensity?: number;
  scale?: number;
  /** +1 faces the bot toward +X, -1 toward -X. */
  facing?: 1 | -1;
  /** Dims the livery and stops the weapon, for a knocked-out bot. */
  disabled?: boolean;
  /** Adds an emissive rim so a selected/winning bot reads instantly. */
  highlight?: boolean;
}

type MotionKind = 'spin-y' | 'spin-z' | 'swing' | 'clamp';

interface WeaponSpec {
  motion: MotionKind;
  speed: number;
  /** Swing bounds in radians, for the non-spinning classes. */
  swing?: [number, number];
}

const WEAPON_SPEC: Record<WeaponType, WeaponSpec> = {
  horizontal_spinner: { motion: 'spin-y', speed: 16 },
  vertical_spinner: { motion: 'spin-z', speed: 20 },
  drum_spinner: { motion: 'spin-z', speed: 26 },
  overhead_saw: { motion: 'spin-z', speed: 13 },
  flipper: { motion: 'swing', speed: 1.6, swing: [0, -0.95] },
  lifter: { motion: 'swing', speed: 0.9, swing: [0, -0.5] },
  hammer: { motion: 'swing', speed: 2.1, swing: [1.5, -0.3] },
  crusher: { motion: 'clamp', speed: 1.1, swing: [0.5, 0.02] },
};

/** Extruded wedge profile — the silhouette that makes it read as a combat robot. */
function useChassisGeometry(depth: number) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-1.1, 0.06);
    shape.lineTo(1.34, 0.02);
    shape.lineTo(1.34, 0.2);
    shape.lineTo(0.46, 0.62);
    shape.lineTo(-1.0, 0.62);
    shape.lineTo(-1.1, 0.4);
    shape.closePath();

    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSize: 0.035,
      bevelThickness: 0.035,
      bevelSegments: 2,
      curveSegments: 1,
    });
    g.translate(0, 0, -depth / 2);
    g.computeVertexNormals();
    return g;
  }, [depth]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

export const RobotMesh = forwardRef<THREE.Group, RobotMeshProps>(function RobotMesh(
  {
    weapon,
    name = 'unknown',
    accent,
    animate = true,
    intensity = 1,
    scale = 1,
    facing = 1,
    disabled = false,
    highlight = false,
  },
  ref,
) {
  const weaponRef = useRef<THREE.Group>(null);
  const clockRef = useRef(0);

  const spec = WEAPON_SPEC[weapon];
  const accentColor = accent ?? accentFor(weapon);
  const bodyColor = liveryFor(name);
  const depth = 1.55;
  const chassis = useChassisGeometry(depth);

  // Animate by mutating refs, never React state — this runs 60x a second.
  useFrame((_, delta) => {
    const group = weaponRef.current;
    if (!group || !animate || disabled) return;
    const dt = Math.min(delta, 1 / 20);
    clockRef.current += dt;
    const t = clockRef.current;
    const speed = spec.speed * intensity;

    switch (spec.motion) {
      case 'spin-y':
        group.rotation.y += speed * dt;
        break;
      case 'spin-z':
        group.rotation.z -= speed * dt;
        break;
      case 'swing': {
        const [from, to] = spec.swing ?? [0, 0];
        // Ease-in-out ping-pong so the arm has weight at each extreme.
        const phase = (Math.sin(t * speed) + 1) / 2;
        group.rotation.z = from + (to - from) * phase * phase;
        break;
      }
      case 'clamp': {
        const [open, shut] = spec.swing ?? [0, 0];
        const phase = (Math.sin(t * speed) + 1) / 2;
        group.rotation.z = shut + (open - shut) * phase;
        break;
      }
    }
  });

  const metal = {
    color: bodyColor,
    metalness: 0.85,
    roughness: 0.38,
  } as const;

  return (
    <group ref={ref} scale={scale} rotation={[0, facing === 1 ? 0 : Math.PI, 0]}>
      {/* Chassis */}
      <mesh geometry={chassis} castShadow receiveShadow>
        <meshStandardMaterial
          {...metal}
          color={disabled ? '#1A1F29' : bodyColor}
          emissive={highlight ? accentColor : '#000000'}
          emissiveIntensity={highlight ? 0.12 : 0}
        />
      </mesh>

      {/* Armour stripe along the top deck, in the weapon-class accent. */}
      <mesh position={[-0.28, 0.635, 0]} castShadow>
        <boxGeometry args={[1.4, 0.02, 0.34]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={disabled ? 0.05 : 0.5}
          toneMapped={false}
        />
      </mesh>

      <Wheels depth={depth} disabled={disabled} />

      <group ref={weaponRef} position={weaponAnchor(weapon)}>
        <WeaponAssembly weapon={weapon} accent={accentColor} disabled={disabled} />
      </group>
    </group>
  );
});

/** Where the weapon group pivots. Getting this right is what sells each class. */
function weaponAnchor(weapon: WeaponType): [number, number, number] {
  switch (weapon) {
    case 'horizontal_spinner':
      return [0.15, 0.82, 0];
    case 'vertical_spinner':
      return [1.12, 0.52, 0];
    case 'drum_spinner':
      return [1.3, 0.3, 0];
    case 'overhead_saw':
      return [-0.55, 0.68, 0];
    case 'flipper':
      return [1.3, 0.16, 0];
    case 'lifter':
      return [1.2, 0.14, 0];
    case 'hammer':
      return [-0.6, 0.74, 0];
    case 'crusher':
      return [1.22, 0.42, 0];
  }
}

function Wheels({ depth, disabled }: { depth: number; disabled: boolean }) {
  const z = depth / 2 + 0.09;
  const positions: [number, number, number][] = [
    [0.72, 0.3, z],
    [0.72, 0.3, -z],
    [-0.72, 0.3, z],
    [-0.72, 0.3, -z],
  ];
  return (
    <group>
      {positions.map((p, i) => (
        <mesh key={i} position={p} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.16, 18]} />
          <meshStandardMaterial
            color={disabled ? '#0E1219' : '#14181F'}
            metalness={0.2}
            roughness={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}

function WeaponAssembly({
  weapon,
  accent,
  disabled,
}: {
  weapon: WeaponType;
  accent: string;
  disabled: boolean;
}) {
  const edge = {
    color: disabled ? '#232833' : accent,
    metalness: 0.95,
    roughness: 0.22,
    emissive: disabled ? '#000000' : accent,
    emissiveIntensity: disabled ? 0 : 0.22,
  } as const;

  switch (weapon) {
    // A long bar spinning parallel to the floor — the highest-energy class.
    case 'horizontal_spinner':
      return (
        <>
          <mesh castShadow>
            <boxGeometry args={[2.85, 0.13, 0.24]} />
            <meshStandardMaterial {...edge} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 1.35, 0, 0]} castShadow>
              <boxGeometry args={[0.22, 0.2, 0.3]} />
              <meshStandardMaterial {...edge} />
            </mesh>
          ))}
          <mesh position={[0, -0.1, 0]}>
            <cylinderGeometry args={[0.14, 0.18, 0.22, 12]} />
            <meshStandardMaterial color="#20262F" metalness={0.8} roughness={0.5} />
          </mesh>
        </>
      );

    // A disc spinning perpendicular to the floor, converting hits into launch angle.
    case 'vertical_spinner':
      return (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.58, 0.58, 0.19, 26]} />
            <meshStandardMaterial {...edge} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh
              key={i}
              position={[Math.cos((i * Math.PI * 2) / 3) * 0.5, Math.sin((i * Math.PI * 2) / 3) * 0.5, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <boxGeometry args={[0.2, 0.26, 0.24]} />
              <meshStandardMaterial {...edge} />
            </mesh>
          ))}
        </>
      );

    // Short, dense, fast-spooling.
    case 'drum_spinner':
      return (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.34, 0.34, 1.15, 20]} />
            <meshStandardMaterial {...edge} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.3, 0, 0]} castShadow>
              <boxGeometry args={[0.14, 0.72, 1.16]} />
              <meshStandardMaterial {...edge} />
            </mesh>
          ))}
        </>
      );

    // Articulated arm with a cutting disc: control first, damage second.
    case 'overhead_saw':
      return (
        <group>
          <mesh position={[0.75, 0.34, 0]} rotation={[0, 0, 0.42]} castShadow>
            <boxGeometry args={[1.75, 0.15, 0.18]} />
            <meshStandardMaterial color="#2A303B" metalness={0.9} roughness={0.35} />
          </mesh>
          <mesh position={[1.55, 0.68, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.5, 0.5, 0.07, 30]} />
            <meshStandardMaterial {...edge} />
          </mesh>
          {/* Saw teeth */}
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[1.55 + Math.cos(a) * 0.5, 0.68 + Math.sin(a) * 0.5, 0]}
                rotation={[0, 0, a]}
              >
                <boxGeometry args={[0.11, 0.06, 0.09]} />
                <meshStandardMaterial {...edge} />
              </mesh>
            );
          })}
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.14, 12, 12]} />
            <meshStandardMaterial color="#20262F" metalness={0.8} roughness={0.5} />
          </mesh>
        </group>
      );

    // Launcher: wins by removing the opponent from the floor.
    case 'flipper':
      return (
        <>
          <mesh position={[-0.6, 0.05, 0]} castShadow>
            <boxGeometry args={[1.25, 0.09, 1.4]} />
            <meshStandardMaterial {...edge} />
          </mesh>
          <mesh position={[0.02, 0.03, 0]} castShadow>
            <boxGeometry args={[0.16, 0.16, 1.44]} />
            <meshStandardMaterial color="#20262F" metalness={0.85} roughness={0.4} />
          </mesh>
        </>
      );

    // Wedge and lift — grinds out judges decisions through control.
    case 'lifter':
      return (
        <>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0.62, 0.02, s * 0.42]} castShadow>
              <boxGeometry args={[1.3, 0.09, 0.2]} />
              <meshStandardMaterial {...edge} />
            </mesh>
          ))}
          <mesh position={[0.05, 0.06, 0]} castShadow>
            <boxGeometry args={[0.18, 0.2, 1.05]} />
            <meshStandardMaterial color="#20262F" metalness={0.85} roughness={0.4} />
          </mesh>
        </>
      );

    // Overhead axe: concentrated, punctuated impacts.
    case 'hammer':
      return (
        <>
          <mesh position={[0.62, 0, 0]} castShadow>
            <boxGeometry args={[1.3, 0.13, 0.13]} />
            <meshStandardMaterial color="#2A303B" metalness={0.9} roughness={0.35} />
          </mesh>
          <mesh position={[1.32, -0.02, 0]} castShadow>
            <boxGeometry args={[0.34, 0.32, 0.42]} />
            <meshStandardMaterial {...edge} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.13, 0.13, 0.36, 14]} />
            <meshStandardMaterial color="#20262F" metalness={0.8} roughness={0.5} />
          </mesh>
        </>
      );

    // Hydraulic jaw: slow, theatrical, devastating when it lands.
    case 'crusher':
      return (
        <group>
          <mesh position={[0.5, 0.16, 0]} rotation={[0, 0, -0.12]} castShadow>
            <boxGeometry args={[1.15, 0.14, 0.44]} />
            <meshStandardMaterial {...edge} />
          </mesh>
          <mesh position={[1.05, 0.05, 0]} rotation={[0, 0, 0.9]} castShadow>
            <boxGeometry args={[0.4, 0.12, 0.4]} />
            <meshStandardMaterial {...edge} />
          </mesh>
          <mesh position={[0.5, -0.3, 0]} castShadow>
            <boxGeometry args={[1.05, 0.12, 0.44]} />
            <meshStandardMaterial color="#2A303B" metalness={0.9} roughness={0.35} />
          </mesh>
          <mesh position={[0, -0.06, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.5, 14]} />
            <meshStandardMaterial color={ARENA.pit600} metalness={0.8} roughness={0.5} />
          </mesh>
        </group>
      );
  }
}
