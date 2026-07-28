'use client';

import { useState } from 'react';
import { CalendarRange, FileText, ImageOff, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { WEAPON_INFO } from '@/lib/data/roster';
import type { ScrapedRobot, WeaponType } from '@/lib/types';

const weaponInfo = (type: string | null) =>
  type && type in WEAPON_INFO ? WEAPON_INFO[type as WeaponType] : null;

/** Everything the dependency-free parser pulled out of the unlocked HTML. */
export function ScrapedCard({
  scraped,
  weights,
}: {
  scraped: ScrapedRobot;
  weights: number[];
}) {
  const weapon = weaponInfo(scraped.weapon_type);

  return (
    <Panel as="section" label="Parsed payload" title={`${scraped.robot} — extracted fields`}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr),260px]">
        <div className="min-w-0">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Weapon class">
              {weapon ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: weapon.accent }}
                  />
                  <span className="text-ink">{weapon.label}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
                    {weapon.short}
                  </span>
                </span>
              ) : (
                <Raw value={scraped.weapon_type} />
              )}
            </Field>

            <Field label={weights.length > 1 ? 'Weights listed' : 'Weight'}>
              <Raw
                value={
                  weights.length
                    ? `${weights.join(' / ')} lb`
                    : scraped.weight_lb === null
                      ? null
                      : `${scraped.weight_lb} lb`
                }
              />
            </Field>
            <Field label="Country">
              <Raw value={scraped.country} />
            </Field>
            <Field label="Builder">
              <Raw value={scraped.builder} />
            </Field>
            <Field label="Team" className="sm:col-span-2">
              <span className="inline-flex items-center gap-2">
                <Users aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-mute" />
                <Raw value={scraped.team} />
              </span>
            </Field>
          </dl>

          {weapon ? (
            <p className="mt-3 text-sm leading-relaxed text-ink-mute">{weapon.blurb}</p>
          ) : null}

          <div className="mt-5">
            <SectionLabel rule icon={<CalendarRange className="h-3.5 w-3.5" />}>
              Seasons mentioned
            </SectionLabel>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {scraped.seasons.length ? (
                scraped.seasons.map((s) => (
                  <Badge key={s} tone="volt" size="md">
                    {s}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-ink-mute">None found in the page text.</p>
              )}
            </div>
          </div>

          <div className="mt-5">
            <SectionLabel rule icon={<FileText className="h-3.5 w-3.5" />}>
              Page excerpt
            </SectionLabel>
            <blockquote className="mt-2.5 border-l-2 border-volt/40 pl-4 text-base leading-relaxed text-ink-soft">
              {scraped.excerpt ?? 'No lede paragraph could be extracted from this page.'}
            </blockquote>
          </div>
        </div>

        <ScrapedImage src={scraped.image} robot={scraped.robot} />
      </div>
    </Panel>
  );
}

/**
 * A plain <img> on purpose: `next.config.mjs` owns the `remotePatterns` allowlist
 * and static.wikia.nocookie.net is not guaranteed to be in it, so `next/image`
 * would throw at runtime on a perfectly valid scrape.
 */
function ScrapedImage({ src, robot }: { src: string | null; robot: string }) {
  const [broken, setBroken] = useState(false);
  const usable = src && !broken;

  return (
    <figure className="lg:sticky lg:top-6">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-pit-700 bg-pit-950">
        {usable ? (
          <img
            src={src}
            alt={`Photograph of the BattleBots competitor ${robot}, scraped from its wiki page`}
            width={520}
            height={390}
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center">
            <ImageOff aria-hidden="true" className="h-5 w-5 text-ink-mute" />
            <p className="text-sm text-ink-mute">
              {src ? 'The scraped image failed to load.' : 'No image found on the page.'}
            </p>
          </div>
        )}
      </div>
      {usable ? (
        <figcaption className="mt-2 break-all font-mono text-[11px] leading-relaxed text-ink-mute">
          Image URL parsed from the unlocked HTML.
        </figcaption>
      ) : null}
    </figure>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="label-mono">{label}</dt>
      <dd className="mt-1.5 break-words font-mono text-sm">{children}</dd>
    </div>
  );
}

function Raw({ value }: { value: string | number | null }) {
  if (value === null || value === '') {
    return <span className="text-ink-mute">Not present on page</span>;
  }
  return <span className="text-ink">{value}</span>;
}
