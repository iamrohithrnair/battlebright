import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { BadgeCheck, Radar, Satellite } from 'lucide-react';

import { Panel } from '@/components/ui/Panel';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { analystModel } from '@/lib/analyst/agent';
import { isEnabled as brightDataEnabled, zoneName } from '@/lib/brightdata';
import { rosterStats } from '@/lib/engine';

import { AnalystChat } from './AnalystChat';

export const metadata: Metadata = {
  // The root layout appends " — You Want More?" via its title template.
  title: 'Analyst',
  description:
    'A tool-using AI analyst for BattleBots. Every number is grounded in the prediction engine, with live wiki collection through Bright Data.',
};

// The readiness banners depend on server env, so never prerender this page.
export const dynamic = 'force-dynamic';

export default function AnalystPage() {
  const configured = Boolean(process.env.OPENAI_API_KEY);
  const collection = brightDataEnabled();
  const stats = rosterStats();

  return (
    <main className="shell no-scroll-x py-8 sm:py-12">
      <header className="mb-6 max-w-3xl">
        <SectionLabel icon={<Radar className="h-3.5 w-3.5" />} rule>
          Intelligence desk
        </SectionLabel>
        <h1 className="mt-3 font-display text-2xl font-semibold text-ink sm:text-3xl">The Analyst</h1>
        <p className="mt-3 text-base text-ink-soft">
          A tool-using agent, not a chat wrapper. It reads the same prediction engine the rest of this app renders and
          can collect a robot&apos;s wiki page live through Bright Data mid-answer. Every quantitative claim is traced
          back to the tool call that produced it.
        </p>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Readout label="Grounding" value={`${stats.robots} robots · ${stats.matches} fights`} icon={<BadgeCheck className="h-3.5 w-3.5" />} />
        <Readout label="Model accuracy" value={`${stats.accuracy}% vs 50% baseline`} icon={<Radar className="h-3.5 w-3.5" />} />
        <Readout
          label="Live collection"
          value={collection ? `Bright Data · ${zoneName()}` : 'Not configured'}
          icon={<Satellite className="h-3.5 w-3.5" />}
          muted={!collection}
        />
      </div>

      <AnalystChat configured={configured} model={analystModel()} />
    </main>
  );
}

function Readout({
  label,
  value,
  icon,
  muted = false,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  muted?: boolean;
}) {
  return (
    <Panel brackets={false} flush>
      <div className="px-4 py-3">
        <SectionLabel icon={icon}>{label}</SectionLabel>
        <p
          data-numeric
          className={`mt-1.5 font-mono text-sm ${muted ? 'text-ink-mute' : 'text-ink'}`}
        >
          {value}
        </p>
      </div>
    </Panel>
  );
}
