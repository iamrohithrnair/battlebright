'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  ArenaCanvas,
  ArenaFloor,
  FloorGlow,
  ImpactBurst,
  LightRig,
  RobotMesh,
  SpotBeam,
} from '@/components/arena';
import { WEAPON_INFO } from '@/lib/data/roster';
import { usePrefersReducedMotion } from '@/lib/hooks';
import type { WeaponType } from '@/lib/types';

export interface Fighter {
  name: string;
  weapon: WeaponType;
}

export type FightPhase = 'idle' | 'charging' | 'clash' | 'aftermath' | 'crowned';

export interface FightSceneProps {
  a: Fighter;
  b: Fighter;
  /** Increment to run the fight. 0 means "never run yet". */
  runId: number;
  /** Which corner the model expects to win. */
  winner: 'a' | 'b';
  onPhase?: (phase: FightPhase) => void;
  onComplete?: () => void;
  className?: string;
}

const START_X = 3.4;

export function FightScene({
  a,
  b,
  runId,
  winner,
  onPhase,
  onComplete,
  className,
}: FightSceneProps) {
  const reduced = usePrefersReducedMotion();

  return (
    <ArenaCanvas
      className={className}
      camera={{ position: [0, 3.4, 10.5], fov: 42 }}
      controls={{ target: [0, 0.7, 0], minDistance: 6, maxDistance: 18 }}
      ariaLabel={`${a.name} faces ${b.name} in the 3D arena. The full prediction is also written out below in text.`}
      underlay={
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_70%,rgba(59,130,246,0.13),transparent_60%)]"
        />
      }
      overlay={
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-pit-950 to-transparent"
        />
      }
    >
      <LightRig />
      <FightStage
        a={a}
        b={b}
        runId={runId}
        winner={winner}
        onPhase={onPhase}
        onComplete={onComplete}
        reduced={reduced}
      />
    </ArenaCanvas>
  );
}

/**
 * The choreography. A GSAP timeline drives the two bots through charge → clash →
 * knockback → coronation, mutating three.js objects directly.
 */
function FightStage({
  a,
  b,
  runId,
  winner,
  onPhase,
  onComplete,
  reduced,
}: Omit<FightSceneProps, 'className'> & { reduced: boolean }) {
  const aRef = useRef<THREE.Group>(null);
  const bRef = useRef<THREE.Group>(null);
  const stageRef = useRef<THREE.Group>(null);
  const shakeRef = useRef({ amount: 0 });

  const [burst, setBurst] = useState(0);
  const [crowned, setCrowned] = useState(false);
  const [fighting, setFighting] = useState(false);

  const aAccent = WEAPON_INFO[a.weapon].accent;
  const bAccent = WEAPON_INFO[b.weapon].accent;

  /** Returns every bot to its corner. */
  const reset = () => {
    const groupA = aRef.current;
    const groupB = bRef.current;
    if (groupA) {
      groupA.position.set(-START_X, 0, 0);
      groupA.rotation.set(0, 0, 0);
    }
    if (groupB) {
      groupB.position.set(START_X, 0, 0);
      groupB.rotation.set(0, 0, 0);
    }
    shakeRef.current.amount = 0;
    if (stageRef.current) stageRef.current.position.set(0, 0, 0);
  };

  // Snap back to the corners whenever the matchup changes.
  useEffect(() => {
    reset();
    setCrowned(false);
    setFighting(false);
  }, [a.name, b.name]);

  useEffect(() => {
    if (runId <= 0) return;

    // Reduced motion: skip the choreography, show the result immediately.
    if (reduced) {
      reset();
      setCrowned(true);
      onPhase?.('crowned');
      onComplete?.();
      return;
    }

    let timeline: gsap.core.Timeline | undefined;
    let cancelled = false;

    (async () => {
      const { default: gsap } = await import('gsap');
      if (cancelled) return;

      reset();
      setCrowned(false);
      setFighting(true);

      const groupA = aRef.current;
      const groupB = bRef.current;
      if (!groupA || !groupB) return;

      const win = winner === 'a' ? groupA : groupB;
      const lose = winner === 'a' ? groupB : groupA;
      const loseDir = winner === 'a' ? 1 : -1;
      const winRestX = winner === 'a' ? -1.5 : 1.5;

      timeline = gsap.timeline({
        onComplete: () => {
          setFighting(false);
          setCrowned(true);
          onPhase?.('crowned');
          onComplete?.();
        },
      });

      // 1 — both bots charge the centre.
      onPhase?.('charging');
      timeline
        .to(groupA.position, { x: -1.15, duration: 0.5, ease: 'power2.in' }, 0)
        .to(groupB.position, { x: 1.15, duration: 0.5, ease: 'power2.in' }, 0);

      // 2 — first clash: sparks, shake, mutual recoil.
      timeline.call(
        () => {
          onPhase?.('clash');
          setBurst((n) => n + 1);
        },
        undefined,
        0.5,
      );
      timeline
        .to(shakeRef.current, { amount: 0.16, duration: 0.06 }, 0.5)
        .to(shakeRef.current, { amount: 0, duration: 0.45, ease: 'power2.out' }, 0.56)
        .to(groupA.position, { x: -2.1, duration: 0.22, ease: 'power3.out' }, 0.52)
        .to(groupB.position, { x: 2.1, duration: 0.22, ease: 'power3.out' }, 0.52);

      // 3 — they re-engage, and this one lands.
      timeline
        .to(groupA.position, { x: -1.0, duration: 0.38, ease: 'power2.in' }, 0.85)
        .to(groupB.position, { x: 1.0, duration: 0.38, ease: 'power2.in' }, 0.85);
      timeline.call(
        () => {
          setBurst((n) => n + 1);
        },
        undefined,
        1.23,
      );
      timeline
        .to(shakeRef.current, { amount: 0.26, duration: 0.06 }, 1.23)
        .to(shakeRef.current, { amount: 0, duration: 0.7, ease: 'power2.out' }, 1.29);

      // 4 — the loser is thrown clear and tips onto its side.
      onPhase?.('aftermath');
      timeline
        .to(
          lose.position,
          { x: loseDir * 6.2, duration: 0.85, ease: 'power2.out' },
          1.26,
        )
        .to(lose.position, { y: 0.9, duration: 0.34, ease: 'power2.out' }, 1.26)
        .to(lose.position, { y: 0, duration: 0.5, ease: 'bounce.out' }, 1.6)
        .to(
          lose.rotation,
          { x: Math.PI / 2.1, z: loseDir * 0.32, duration: 0.9, ease: 'power2.out' },
          1.3,
        );

      // 5 — the winner takes the centre of the floor.
      timeline.to(
        win.position,
        { x: winRestX, duration: 0.9, ease: 'power2.inOut' },
        1.5,
      );
      timeline.to(win.position, { y: 0.12, duration: 0.45, ease: 'power2.out' }, 1.9);
      timeline.to(win.position, { y: 0, duration: 0.6, ease: 'power1.inOut' }, 2.35);
    })();

    return () => {
      cancelled = true;
      // Killing the timeline is what keeps GSAP from writing into a disposed scene.
      timeline?.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, reduced]);

  // Apply the shake by nudging the whole stage — this leaves OrbitControls alone.
  useFrame(() => {
    const stage = stageRef.current;
    const amount = shakeRef.current.amount;
    if (!stage) return;
    if (amount <= 0.0001) {
      if (stage.position.lengthSq() > 0) stage.position.set(0, 0, 0);
      return;
    }
    stage.position.set(
      (Math.random() - 0.5) * amount,
      (Math.random() - 0.5) * amount * 0.6,
      (Math.random() - 0.5) * amount,
    );
  });

  const winnerName = winner === 'a' ? a.name : b.name;
  const winnerAccent = winner === 'a' ? aAccent : bAccent;

  return (
    <group ref={stageRef}>
      <ArenaFloor size={40} />

      <FloorGlow position={[-START_X, 0, 0]} color={aAccent} radius={1.7} opacity={0.18} />
      <FloorGlow position={[START_X, 0, 0]} color={bAccent} radius={1.7} opacity={0.18} />

      <group ref={aRef} position={[-START_X, 0, 0]}>
        <RobotMesh
          name={a.name}
          weapon={a.weapon}
          facing={1}
          intensity={fighting ? 1.45 : 0.6}
          highlight={crowned && winner === 'a'}
          disabled={crowned && winner === 'b'}
        />
      </group>

      <group ref={bRef} position={[START_X, 0, 0]}>
        <RobotMesh
          name={b.name}
          weapon={b.weapon}
          facing={-1}
          intensity={fighting ? 1.45 : 0.6}
          highlight={crowned && winner === 'b'}
          disabled={crowned && winner === 'a'}
        />
      </group>

      <ImpactBurst trigger={burst} position={[0, 0.75, 0]} color="#FFD07A" count={190} spread={8} />

      {crowned ? (
        <group position={[winner === 'a' ? -1.5 : 1.5, 0, 0]} key={winnerName}>
          <SpotBeam color={winnerAccent} opacity={0.16} height={8} radius={2.3} />
          <FloorGlow color={winnerAccent} radius={2.4} opacity={0.3} />
        </group>
      ) : null}
    </group>
  );
}
