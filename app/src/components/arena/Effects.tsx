'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARENA } from './palette';

export interface ImpactBurstProps {
  /**
   * Increment this to fire the burst. Using a counter rather than a boolean means
   * repeat impacts always replay, even back to back.
   */
  trigger: number;
  position?: [number, number, number];
  color?: string;
  count?: number;
  /** Initial outward speed of the sparks. */
  spread?: number;
  /** Seconds the burst lives for. */
  life?: number;
  size?: number;
}

/**
 * A one-shot spark burst for weapon impacts and the tournament champion reveal.
 *
 * Particles live in a single BufferGeometry and are integrated on the GPU-bound
 * frame loop by mutating the position attribute — no React state per frame.
 */
export function ImpactBurst({
  trigger,
  position = [0, 0.7, 0],
  color = ARENA.ember,
  count = 160,
  spread = 7,
  life = 1.1,
  size = 0.07,
}: ImpactBurstProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const ageRef = useRef(Number.POSITIVE_INFINITY);

  const { geometry, velocities } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geometry: g, velocities: vel };
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  // Seed a fresh isotropic burst whenever the trigger advances.
  useEffect(() => {
    if (trigger <= 0) return;
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      pos.setXYZ(i, 0, 0, 0);
      // Random direction, biased upward so sparks arc off the weapon.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(1 - Math.random() * 1.35);
      const speed = spread * (0.35 + Math.random() * 0.65);
      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      velocities[i * 3 + 1] = Math.abs(Math.cos(phi)) * speed * 1.15 + 1.2;
      velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
    }
    pos.needsUpdate = true;
    ageRef.current = 0;
    if (pointsRef.current) pointsRef.current.visible = true;
  }, [trigger, count, spread, geometry, velocities]);

  useFrame((_, delta) => {
    const points = pointsRef.current;
    if (!points || ageRef.current > life) return;

    const dt = Math.min(delta, 1 / 20);
    ageRef.current += dt;

    if (ageRef.current > life) {
      points.visible = false;
      return;
    }

    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      velocities[i3 + 1] -= 14 * dt; // gravity
      arr[i3] += velocities[i3] * dt;
      arr[i3 + 1] += velocities[i3 + 1] * dt;
      arr[i3 + 2] += velocities[i3 + 2] * dt;
      // Bounce off the floor once, losing most of the energy.
      if (arr[i3 + 1] < 0.02) {
        arr[i3 + 1] = 0.02;
        velocities[i3 + 1] *= -0.28;
      }
    }
    pos.needsUpdate = true;

    const material = points.material as THREE.PointsMaterial;
    material.opacity = 1 - ageRef.current / life;
  });

  return (
    <points ref={pointsRef} position={position} geometry={geometry} visible={false}>
      <pointsMaterial
        color={color}
        size={size}
        sizeAttenuation
        transparent
        opacity={1}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

export interface SpotBeamProps {
  position?: [number, number, number];
  color?: string;
  /** Height of the cone. */
  height?: number;
  radius?: number;
  opacity?: number;
}

/** A soft additive light shaft, used to crown a winner. */
export function SpotBeam({
  position = [0, 0, 0],
  color = ARENA.ember,
  height = 7,
  radius = 2.1,
  opacity = 0.11,
}: SpotBeamProps) {
  return (
    <mesh position={[position[0], position[1] + height / 2, position[2]]}>
      <coneGeometry args={[radius, height, 40, 1, true]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

export interface FloorGlowProps {
  position?: [number, number, number];
  color?: string;
  radius?: number;
  opacity?: number;
}

/** A pool of light on the floor beneath a bot, marking its fighting position. */
export function FloorGlow({
  position = [0, 0, 0],
  color = ARENA.volt,
  radius = 2.2,
  opacity = 0.22,
}: FloorGlowProps) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[position[0], 0.006, position[2]]}>
      <circleGeometry args={[radius, 48]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}
