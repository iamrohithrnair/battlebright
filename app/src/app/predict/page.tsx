import { Swords } from 'lucide-react';
import type { Metadata } from 'next';
import { MatchupStudio } from '@/components/predict/MatchupStudio';
import { SectionLabel } from '@/components/ui';
import { getRobot, robotNames } from '@/lib/engine';

export const metadata: Metadata = {
  title: 'The Matchup',
  description:
    'Pick two BattleBots and watch the fight play out in 3D, then read a fully traceable win probability with its signal breakdown and Monte Carlo distribution.',
};

const DEFAULT_A = 'Tombstone';
const DEFAULT_B = 'End Game';

export default async function PredictPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;
  const names = robotNames();

  // Deep links from the roster and the AI analyst land here, so validate first.
  const initialA = a && getRobot(a) ? a : DEFAULT_A;
  let initialB = b && getRobot(b) ? b : DEFAULT_B;
  if (initialB === initialA) {
    initialB = names.find((n) => n !== initialA) ?? DEFAULT_B;
  }

  return (
    <div className="shell pb-24 pt-28 sm:pt-32">
      <header className="mb-8 max-w-3xl">
        <SectionLabel icon={<Swords className="h-3.5 w-3.5" />} rule>
          The Matchup
        </SectionLabel>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-5xl">
          Two bots. One number. All of the working.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-soft">
          Choose your fighters and press Simulate. You get the fight in 3D, a win probability, the
          projected finish, and — the part that matters — every weighted term that produced it.
        </p>
      </header>

      <MatchupStudio robots={names} initialA={initialA} initialB={initialB} />
    </div>
  );
}
