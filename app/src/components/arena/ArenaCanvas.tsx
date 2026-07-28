'use client';

import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/cn';
import { useMounted, usePrefersReducedMotion } from '@/lib/hooks';
import { ARENA } from './palette';

export interface ArenaCanvasProps {
  children: ReactNode;
  className?: string;
  camera?: { position: [number, number, number]; fov?: number };
  /** 'always' for live animation, 'demand' for a scene that only changes on input. */
  frameloop?: 'always' | 'demand';
  /** Adds damped orbit controls. Pass an object to tune the limits. */
  controls?:
    | boolean
    | {
        target?: [number, number, number];
        minDistance?: number;
        maxDistance?: number;
        autoRotate?: boolean;
        autoRotateSpeed?: number;
        enablePan?: boolean;
      };
  /**
   * Describes the scene for screen readers. The canvas is decorative wherever an
   * equivalent DOM readout exists, which is every page in this app.
   */
  ariaLabel?: string;
  /** Rendered underneath the canvas — used for vignettes and gradient washes. */
  underlay?: ReactNode;
  /** Rendered above the canvas — used for HUD overlays. */
  overlay?: ReactNode;
}

/**
 * Single entry point for every 3D scene in the app.
 *
 * Handles the things that are easy to get wrong per-page: SSR safety (the canvas
 * only mounts on the client), capped DPR, colour management, and the
 * reduced-motion contract — when the user asks for less motion we switch to an
 * on-demand frameloop so the scene paints one static frame and then stops.
 */
export function ArenaCanvas({
  children,
  className,
  camera = { position: [0, 4.5, 11], fov: 42 },
  frameloop = 'always',
  controls = false,
  ariaLabel,
  underlay,
  overlay,
}: ArenaCanvasProps) {
  const mounted = useMounted();
  const reduced = usePrefersReducedMotion();

  const controlOpts = typeof controls === 'object' ? controls : {};

  return (
    <div className={cn('relative isolate overflow-hidden', className)}>
      {underlay}

      {mounted ? (
        <Canvas
          className="!absolute inset-0"
          // Capped DPR: retina sharpness without paying for 3x on a phone.
          dpr={[1, 2]}
          frameloop={reduced ? 'demand' : frameloop}
          shadows="soft"
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
          }}
          camera={{ position: camera.position, fov: camera.fov ?? 42, near: 0.1, far: 200 }}
          onCreated={({ gl, scene }) => {
            gl.setClearColor(ARENA.pit950, 0);
            scene.fog = new THREE.Fog(ARENA.pit950, 18, 46);
          }}
          aria-label={ariaLabel}
          role={ariaLabel ? 'img' : 'presentation'}
        >
          {children}

          {controls ? (
            <OrbitControls
              makeDefault
              enableDamping
              dampingFactor={0.08}
              enablePan={controlOpts.enablePan ?? false}
              target={controlOpts.target ?? [0, 0.6, 0]}
              minDistance={controlOpts.minDistance ?? 5}
              maxDistance={controlOpts.maxDistance ?? 26}
              // Never let the camera drop under the floor.
              maxPolarAngle={Math.PI / 2.12}
              minPolarAngle={0.12}
              autoRotate={!reduced && Boolean(controlOpts.autoRotate)}
              autoRotateSpeed={controlOpts.autoRotateSpeed ?? 0.6}
            />
          ) : null}
        </Canvas>
      ) : (
        // Reserve the exact space the canvas will occupy so nothing shifts.
        <div aria-hidden="true" className="absolute inset-0 bg-pit-950">
          <div className="bg-blueprint h-full w-full opacity-40" />
        </div>
      )}

      {overlay}
    </div>
  );
}
