'use client';

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARENA, ArenaCanvas, ArenaFloor, ImpactBurst, LightRig, SpotBeam } from '@/components/arena';
import { WEAPON_INFO } from '@/lib/data/roster';
import { getRobot } from '@/lib/engine';
import { usePrefersReducedMotion } from '@/lib/hooks';
import type { BracketMatch, TournamentResult } from '@/lib/types';

export interface BracketSceneProps {
  result: TournamentResult;
  /** How many matches have resolved so far, in flat round-major order. */
  revealed: number;
  className?: string;
}

interface Node {
  match: BracketMatch;
  round: number;
  index: number;
  flat: number;
  x: number;
  y: number;
  z: number;
}

const ROUND_GAP = 4.4;
const BASE_SPACING = 1.5;
const PLATE_W = 3.5;
const PLATE_H = 1.05;

/** Fits the whole tree in frame regardless of bracket size. */
const scaleFor = (size: number) => (size >= 16 ? 0.52 : size >= 8 ? 0.74 : 1);

export function BracketScene({ result, revealed, className }: BracketSceneProps) {
  const reduced = usePrefersReducedMotion();

  const nodes = useMemo(() => {
    const out: Node[] = [];
    const rounds = result.rounds.length;
    let flat = 0;

    result.rounds.forEach((matches, round) => {
      const spacing = BASE_SPACING * 2 ** round;
      matches.forEach((match, index) => {
        out.push({
          match,
          round,
          index,
          flat: flat++,
          x: (round - (rounds - 1) / 2) * ROUND_GAP,
          y: 2.6 + (index - (matches.length - 1) / 2) * spacing,
          // Each round steps back slightly, which gives the tree depth when you orbit.
          z: -round * 0.55,
        });
      });
    });
    return out;
  }, [result]);

  const total = nodes.length;
  const complete = revealed >= total;
  const scale = scaleFor(result.size);

  return (
    <ArenaCanvas
      className={className}
      camera={{ position: [0, 3.4, 15.5], fov: 46 }}
      controls={{ target: [0, 2.2, 0], minDistance: 8, maxDistance: 30, enablePan: true }}
      ariaLabel={`A 3D single-elimination bracket for ${result.size} robots. The same bracket is written out as an accessible table below.`}
      underlay={
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(59,130,246,0.13),transparent_65%)]"
        />
      }
    >
      <LightRig spots={false} shadows={false} />
      <ArenaFloor size={44} walls={false} shadows={false} />

      <group scale={scale}>
        {/* Connectors first, so plates sit on top of them. */}
        {nodes.map((node) => (
          <Connectors key={`c-${node.flat}`} node={node} nodes={nodes} revealed={revealed} />
        ))}

        {nodes.map((node) => (
          <MatchPlate
            key={`${node.round}-${node.index}`}
            node={node}
            resolved={node.flat < revealed}
            active={node.flat === revealed}
            reduced={reduced}
          />
        ))}

        {/* Champion podium at the right-hand end of the tree. */}
        <group
          position={[((result.rounds.length - 1) / 2 + 1.05) * ROUND_GAP, 2.6, -result.rounds.length * 0.55]}
        >
          <ChampionPlinth champion={result.champion} crowned={complete} />
        </group>
      </group>
    </ArenaCanvas>
  );
}

/**
 * Elbow connectors from a match to its parent, drawn as thin boxes so they read
 * like traces on a circuit board.
 */
function Connectors({
  node,
  nodes,
  revealed,
}: {
  node: Node;
  nodes: Node[];
  revealed: number;
}) {
  const parent = nodes.find(
    (n) => n.round === node.round + 1 && n.index === Math.floor(node.index / 2),
  );
  const lit = node.flat < revealed;
  const color = lit ? ARENA.volt : ARENA.pit600;

  // The final match feeds the champion podium rather than another plate.
  const targetX = parent ? parent.x - PLATE_W / 2 : node.x + ROUND_GAP * 0.75;
  const targetY = parent ? parent.y : node.y;
  const targetZ = parent ? parent.z : node.z;

  const startX = node.x + PLATE_W / 2;
  const midX = (startX + targetX) / 2;

  const segments: { pos: [number, number, number]; size: [number, number, number] }[] = [
    // Out of this plate
    {
      pos: [(startX + midX) / 2, node.y, node.z],
      size: [Math.max(0.01, midX - startX), 0.035, 0.035],
    },
    // Vertical run toward the parent's row
    {
      pos: [midX, (node.y + targetY) / 2, (node.z + targetZ) / 2],
      size: [0.035, Math.max(0.01, Math.abs(targetY - node.y)), 0.035],
    },
    // Into the parent
    {
      pos: [(midX + targetX) / 2, targetY, targetZ],
      size: [Math.max(0.01, targetX - midX), 0.035, 0.035],
    },
  ];

  return (
    <group>
      {segments.map((seg, i) => (
        <mesh key={i} position={seg.pos}>
          <boxGeometry args={seg.size} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={lit ? 0.85 : 0.4} />
        </mesh>
      ))}
    </group>
  );
}

function MatchPlate({
  node,
  resolved,
  active,
  reduced,
}: {
  node: Node;
  resolved: boolean;
  active: boolean;
  reduced: boolean;
}) {
  const { match } = node;
  const meshRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  // The match currently resolving pulses, so the eye knows where to look.
  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const material = mesh.material as THREE.MeshStandardMaterial;
    if (active && !reduced) {
      t.current += Math.min(delta, 1 / 20);
      material.emissiveIntensity = 0.35 + Math.sin(t.current * 5) * 0.25;
    } else {
      material.emissiveIntensity = resolved ? 0.22 : 0.04;
    }
  });

  const winnerIsA = match.winner === match.a;
  const aInfo = getRobot(match.a);
  const bInfo = getRobot(match.b);

  return (
    <group position={[node.x, node.y, node.z]}>
      <mesh ref={meshRef}>
        <boxGeometry args={[PLATE_W, PLATE_H, 0.09]} />
        <meshStandardMaterial
          color={resolved || active ? '#0D141F' : '#080C14'}
          metalness={0.6}
          roughness={0.5}
          emissive={active ? ARENA.ember : resolved ? ARENA.volt : ARENA.pit600}
          emissiveIntensity={0.05}
        />
      </mesh>

      {/* Weapon-class accent chips for the two entrants. */}
      {aInfo ? (
        <mesh position={[-PLATE_W / 2 + 0.06, PLATE_H / 4, 0.05]}>
          <boxGeometry args={[0.07, PLATE_H / 2.4, 0.02]} />
          <meshBasicMaterial color={WEAPON_INFO[aInfo.weapon_type].accent} toneMapped={false} />
        </mesh>
      ) : null}
      {bInfo ? (
        <mesh position={[-PLATE_W / 2 + 0.06, -PLATE_H / 4, 0.05]}>
          <boxGeometry args={[0.07, PLATE_H / 2.4, 0.02]} />
          <meshBasicMaterial color={WEAPON_INFO[bInfo.weapon_type].accent} toneMapped={false} />
        </mesh>
      ) : null}

      {/* Labels as real DOM, transformed into the scene: crisp and themeable. */}
      <Html
        transform
        occlude={false}
        distanceFactor={3.4}
        position={[0, 0, 0.07]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        // The canvas already has an accessible description; this is decoration.
        aria-hidden="true"
      >
        <div className="w-[188px] font-mono text-[9px] leading-tight">
          <Row
            name={match.a}
            prob={match.prob_a}
            won={resolved && winnerIsA}
            dim={resolved && !winnerIsA}
            visible={resolved || active}
          />
          <Row
            name={match.b}
            prob={match.prob_b}
            won={resolved && !winnerIsA}
            dim={resolved && winnerIsA}
            visible={resolved || active}
          />
        </div>
      </Html>
    </group>
  );
}

function Row({
  name,
  prob,
  won,
  dim,
  visible,
}: {
  name: string;
  prob: number;
  won: boolean;
  dim: boolean;
  visible: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 border-b border-white/5 px-1.5 py-1 last:border-b-0 ${
        won ? 'text-[#FBBF24]' : dim ? 'text-[#6F7F97]' : 'text-[#E8EEF9]'
      }`}
    >
      <span className="truncate font-semibold tracking-tight">{name}</span>
      <span className="shrink-0 tabular-nums opacity-80">{visible ? `${prob}%` : '—'}</span>
    </div>
  );
}

function ChampionPlinth({ champion, crowned }: { champion: string; crowned: boolean }) {
  const robot = getRobot(champion);
  const accent = robot ? WEAPON_INFO[robot.weapon_type].accent : ARENA.ember;

  return (
    <group>
      <mesh>
        <boxGeometry args={[3.1, 1.5, 0.12]} />
        <meshStandardMaterial
          color="#0D141F"
          metalness={0.7}
          roughness={0.4}
          emissive={crowned ? accent : ARENA.pit600}
          emissiveIntensity={crowned ? 0.4 : 0.05}
        />
      </mesh>

      <Html
        transform
        occlude={false}
        distanceFactor={3.4}
        position={[0, 0, 0.08]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        aria-hidden="true"
      >
        <div className="w-[168px] px-2 text-center font-mono">
          <p className="text-[8px] uppercase tracking-[0.22em] text-[#6F7F97]">Champion</p>
          <p
            className="mt-1 truncate text-[13px] font-bold tracking-tight"
            style={{ color: crowned ? '#FBBF24' : '#3F4C60' }}
          >
            {crowned ? champion : '???'}
          </p>
        </div>
      </Html>

      {crowned ? (
        <>
          <SpotBeam
            position={[0, -1.2, 0]}
            color={accent}
            opacity={0.14}
            height={5}
            radius={1.6}
          />
          <ImpactBurst
            trigger={crowned ? 1 : 0}
            position={[0, 0, 0.3]}
            color="#FBBF24"
            count={240}
            spread={5.5}
            life={2}
            size={0.055}
          />
        </>
      ) : null}
    </group>
  );
}
