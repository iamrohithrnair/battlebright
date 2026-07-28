'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { ArrowRight, Crosshair, Gauge, Radio, Swords, Target } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ArenaCanvas, ArenaFloor, FloorGlow, LightRig, RobotMesh, SpotBeam } from '@/components/arena';
import { SectionLabel } from '@/components/ui';
import { WEAPON_INFO } from '@/lib/data/roster';
import { usePrefersReducedMotion } from '@/lib/hooks';
import type { WeaponType } from '@/lib/types';

export interface HeroStats {
  robots: number;
  matches: number;
  weapons: number;
  accuracy: number;
  knockouts: number;
  seasons: number;
}

interface Beat {
  label: string;
  weight: string;
  title: string;
  body: string;
  icon: typeof Gauge;
}

/** The three signals the model is built from — one scroll beat each. */
const BEATS: Beat[] = [
  {
    label: 'Signal 01',
    weight: '0.45',
    title: 'Career form',
    body: 'How often has this bot actually won? The heaviest term in the model, because a long record is the least noisy thing we know about a machine.',
    icon: Gauge,
  },
  {
    label: 'Signal 02',
    weight: '0.25',
    title: 'Finishing power',
    body: 'What share of those wins came by knockout? A bot that ends fights does not need the judges to agree with it.',
    icon: Target,
  },
  {
    label: 'Signal 03',
    weight: '0.30',
    title: 'Weapon matchup',
    body: 'Rock-paper-scissors with 400lb of steel. A horizontal bar eats a lifter; a vertical disc punishes a flipper. This term is why upsets happen.',
    icon: Crosshair,
  },
];

/** Camera keyframes the scroll position interpolates between. */
const KEYFRAMES: { at: number; pos: [number, number, number]; target: [number, number, number] }[] =
  [
    { at: 0, pos: [0, 1.1, 24], target: [0, 0.7, 0] },
    { at: 0.14, pos: [0, 3.1, 11.5], target: [0, 0.9, 0] },
    { at: 0.42, pos: [-7.4, 2.2, 7.4], target: [-2.1, 0.9, 0] },
    { at: 0.7, pos: [7.4, 2.4, 7.4], target: [2.1, 0.9, 0] },
    { at: 1, pos: [0, 9.5, 12], target: [0, 0.2, 0] },
  ];

const HERO_A: { name: string; weapon: WeaponType } = { name: 'Tombstone', weapon: 'horizontal_spinner' };
const HERO_B: { name: string; weapon: WeaponType } = { name: 'End Game', weapon: 'vertical_spinner' };

export function HeroArena({ stats }: { stats: HeroStats }) {
  const reduced = usePrefersReducedMotion();
  const scrollRef = useRef({ progress: reduced ? 0.14 : 0 });
  const sectionRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  // Scroll-driven camera + the title resolve. Both are GSAP, both are disposed.
  useEffect(() => {
    if (reduced) {
      scrollRef.current.progress = 0.14;
      return;
    }

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        // Feed raw scroll progress into the ref the camera rig reads each frame.
        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
          onUpdate: (self) => {
            scrollRef.current.progress = self.progress;
          },
        });

        // "YOU WANT MORE?" resolves character group by character group.
        const letters = titleRef.current?.querySelectorAll('[data-letter]');
        if (letters?.length) {
          gsap.from(letters, {
            opacity: 0,
            y: 26,
            filter: 'blur(10px)',
            duration: 0.9,
            ease: 'power3.out',
            stagger: 0.045,
            delay: 0.15,
          });
        }

        gsap.from('[data-hero-fade]', {
          opacity: 0,
          y: 18,
          duration: 0.8,
          ease: 'power2.out',
          stagger: 0.1,
          delay: 0.8,
        });

        // Each beat fades in as it reaches the middle of the viewport.
        gsap.utils.toArray<HTMLElement>('[data-beat]').forEach((el) => {
          gsap.from(el, {
            opacity: 0,
            y: 40,
            duration: 0.7,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 80%', end: 'top 45%', scrub: true },
          });
        });
      }, sectionRef);

      cleanup = () => ctx.revert();
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [reduced]);

  return (
    <div ref={sectionRef} className="relative">
      {/* Sticky canvas: the arena stays put while the copy scrolls over it. */}
      <div className="sticky top-0 h-dvh w-full">
        <ArenaCanvas
          className="h-full w-full"
          camera={{ position: [0, 1.1, 24], fov: 44 }}
          ariaLabel={`A 3D BattleBots arena with ${HERO_A.name} and ${HERO_B.name} idling under spotlights, weapons spinning.`}
          underlay={
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_65%,rgba(59,130,246,0.14),transparent_62%)]"
            />
          }
          overlay={
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-pit-950 via-pit-950/70 to-transparent"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-pit-950/90 to-transparent"
              />
            </>
          }
        >
          <LightRig />
          <ArenaFloor size={44} />

          <CameraRig scrollRef={scrollRef} reduced={reduced} />

          <group position={[-2.6, 0, 0]}>
            <FloorGlow position={[0, 0, 0]} color={WEAPON_INFO[HERO_A.weapon].accent} radius={2} />
            <SpotBeam color={WEAPON_INFO[HERO_A.weapon].accent} opacity={0.075} />
            <IdleBot name={HERO_A.name} weapon={HERO_A.weapon} facing={1} animate={!reduced} />
          </group>

          <group position={[2.6, 0, 0]}>
            <FloorGlow position={[0, 0, 0]} color={WEAPON_INFO[HERO_B.weapon].accent} radius={2} />
            <SpotBeam color={WEAPON_INFO[HERO_B.weapon].accent} opacity={0.075} />
            <IdleBot name={HERO_B.name} weapon={HERO_B.weapon} facing={-1} animate={!reduced} />
          </group>
        </ArenaCanvas>
      </div>

      {/* ---- Scrolling content, layered over the sticky canvas ---- */}
      <div className="z-base pointer-events-none relative -mt-[100dvh]">
        {/* Beat 0: the title card */}
        <section className="flex h-dvh flex-col justify-center">
          <div className="shell pointer-events-auto">
            <div data-hero-fade className="mb-6 flex flex-wrap items-center gap-2">
              <span className="inline-flex min-h-[28px] items-center gap-1.5 rounded border border-ember/40 bg-ember/10 px-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ember">
                <Radio aria-hidden="true" className="h-3 w-3" />
                Bright Data × BattleBots
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                #BattleBotsDev
              </span>
            </div>

            <h1
              ref={titleRef}
              className="max-w-4xl font-display text-[clamp(2.4rem,9vw,7rem)] font-bold leading-[0.92] tracking-tighter"
            >
              <span className="block">
                {'YOU WANT'.split(' ').map((word) => (
                  <span key={word} data-letter className="mr-[0.25em] inline-block text-ink">
                    {word}
                  </span>
                ))}
              </span>
              <span data-letter className="inline-block text-ember">
                MORE?
              </span>
            </h1>

            <p
              data-hero-fade
              className="mt-6 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg"
            >
              A 3D intelligence engine for robot combat. Pick two machines, get a win probability
              you can actually audit — then verify it against the live web.
            </p>

            <div data-hero-fade className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/predict"
                className="animate-pulse-ring inline-flex min-h-[52px] items-center gap-2.5 rounded-md border border-ember bg-ember px-6 font-mono text-sm font-semibold uppercase tracking-[0.08em] text-pit-950 transition-colors duration-200 hover:border-ember-light hover:bg-ember-light"
              >
                <Swords aria-hidden="true" className="h-4 w-4" />
                Enter the Pit
              </Link>
              <Link
                href="/model"
                className="inline-flex min-h-[52px] items-center gap-2 rounded-md border border-pit-500 bg-pit-900/80 px-5 font-mono text-sm uppercase tracking-[0.08em] text-ink backdrop-blur transition-colors duration-200 hover:border-volt/60 hover:bg-pit-800"
              >
                See the model
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>

            {/* Live stat strip */}
            <dl
              data-hero-fade
              className="mt-12 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-lg border border-pit-600 bg-pit-600 sm:grid-cols-4"
            >
              {[
                { k: 'Robots', v: stats.robots },
                { k: 'Fights logged', v: stats.matches },
                { k: 'Weapon classes', v: stats.weapons },
                { k: 'Model accuracy', v: `${stats.accuracy}%`, accent: true },
              ].map((s) => (
                <div key={s.k} className="bg-pit-950/85 px-4 py-3 backdrop-blur">
                  <dt className="label-mono">{s.k}</dt>
                  <dd
                    className={`mt-1 font-display text-2xl font-semibold ${
                      s.accent ? 'text-ember-light' : 'text-ink'
                    }`}
                    data-numeric
                  >
                    {s.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Beats 1-3: the three signals */}
        {BEATS.map((beat, i) => (
          <section key={beat.title} className="flex h-dvh items-center">
            <div className="shell pointer-events-auto">
              <div
                data-beat
                className={`max-w-lg rounded-lg border border-pit-600 bg-pit-950/85 p-6 shadow-panel backdrop-blur-md sm:p-8 ${
                  i === 1 ? 'ml-auto' : i === 2 ? 'mx-auto' : ''
                }`}
              >
                <SectionLabel icon={<beat.icon className="h-3.5 w-3.5" />}>
                  {beat.label}
                </SectionLabel>

                <div className="mt-3 flex items-baseline gap-3">
                  <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">
                    {beat.title}
                  </h2>
                  <span
                    className="font-mono text-sm font-semibold text-volt-light"
                    data-numeric
                    aria-label={`Model weight ${beat.weight}`}
                  >
                    ×{beat.weight}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-base">
                  {beat.body}
                </p>

                {i === BEATS.length - 1 ? (
                  <div className="mt-6 rounded-md border border-pit-600 bg-pit-900/80 p-4">
                    <p className="label-mono mb-2">The whole model</p>
                    <code className="block font-mono text-xs leading-relaxed text-volt-light sm:text-sm">
                      score = 0.45·win_rate + 0.25·ko_rate + 0.30·(0.5 + weapon_edge)
                    </code>
                    <p className="mt-3 text-xs leading-relaxed text-ink-mute">
                      That is the entire thing. No neural net, no hidden features — which is why
                      every prediction on this site comes with its own receipt.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/** A hero bot with a slow breathing hover, so the idle frame is never dead. */
function IdleBot({
  name,
  weapon,
  facing,
  animate,
}: {
  name: string;
  weapon: WeaponType;
  facing: 1 | -1;
  animate: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    if (!animate || !groupRef.current) return;
    t.current += Math.min(delta, 1 / 20);
    groupRef.current.position.y = Math.sin(t.current * 1.1) * 0.045;
    groupRef.current.rotation.y = Math.sin(t.current * 0.35) * 0.09;
  });

  return (
    <group ref={groupRef}>
      <RobotMesh
        name={name}
        weapon={weapon}
        facing={facing}
        animate={animate}
        intensity={0.55}
        scale={1.15}
      />
    </group>
  );
}

/**
 * Reads the scroll progress ref every frame and eases the camera toward the
 * interpolated keyframe. Nothing here touches React state.
 */
function CameraRig({
  scrollRef,
  reduced,
}: {
  scrollRef: React.RefObject<{ progress: number }>;
  reduced: boolean;
}) {
  const { camera, invalidate } = useThree();
  const target = useRef(new THREE.Vector3(0, 0.7, 0));
  const desired = useRef(new THREE.Vector3());
  const desiredTarget = useRef(new THREE.Vector3());

  // With reduced motion the frameloop is on-demand, so paint the resting pose once.
  useEffect(() => {
    if (!reduced) return;
    const { pos, tgt } = sampleKeyframes(0.14);
    camera.position.set(pos.x, pos.y, pos.z);
    camera.lookAt(tgt);
    invalidate();
  }, [reduced, camera, invalidate]);

  useFrame(() => {
    if (reduced) return;
    const { pos, tgt } = sampleKeyframes(scrollRef.current?.progress ?? 0);
    desired.current.copy(pos);
    desiredTarget.current.copy(tgt);

    // Critically-damped feel: fast enough to track scrubbing, smooth enough to
    // never look mechanical.
    camera.position.lerp(desired.current, 0.075);
    target.current.lerp(desiredTarget.current, 0.075);
    camera.lookAt(target.current);
  });

  return null;
}

const scratchPos = new THREE.Vector3();
const scratchTarget = new THREE.Vector3();

function sampleKeyframes(progress: number) {
  const p = Math.min(1, Math.max(0, progress));

  let lower = KEYFRAMES[0];
  let upper = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (p >= KEYFRAMES[i].at && p <= KEYFRAMES[i + 1].at) {
      lower = KEYFRAMES[i];
      upper = KEYFRAMES[i + 1];
      break;
    }
  }

  const span = upper.at - lower.at;
  const local = span === 0 ? 0 : (p - lower.at) / span;
  // Smoothstep between keyframes so direction changes are not abrupt.
  const e = local * local * (3 - 2 * local);

  scratchPos.set(
    lower.pos[0] + (upper.pos[0] - lower.pos[0]) * e,
    lower.pos[1] + (upper.pos[1] - lower.pos[1]) * e,
    lower.pos[2] + (upper.pos[2] - lower.pos[2]) * e,
  );
  scratchTarget.set(
    lower.target[0] + (upper.target[0] - lower.target[0]) * e,
    lower.target[1] + (upper.target[1] - lower.target[1]) * e,
    lower.target[2] + (upper.target[2] - lower.target[2]) * e,
  );

  return { pos: scratchPos, tgt: scratchTarget };
}
