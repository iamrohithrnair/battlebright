import { Trophy } from 'lucide-react';
import type { Metadata } from 'next';
import { TournamentStudio } from '@/components/tournament/TournamentStudio';
import { SectionLabel } from '@/components/ui';
import { robotNames } from '@/lib/engine';

export const metadata: Metadata = {
  title: 'Tournament',
  description:
    'Seed a 4, 8 or 16-bot single-elimination bracket and watch it resolve in an orbitable 3D tree, with round-by-round playback and an accessible bracket table.',
};

export default function TournamentPage() {
  return (
    <div className="shell pb-24 pt-28 sm:pt-32">
      <header className="mb-8 max-w-3xl">
        <SectionLabel icon={<Trophy className="h-3.5 w-3.5" />} rule>
          Tournament
        </SectionLabel>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-5xl">
          Run the whole event in fifteen seconds
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-soft">
          Seed a bracket, press play, and watch every matchup resolve through the same model that
          powers a single prediction. Orbit the tree, step through it match by match, or take the
          champion straight to their scouting report.
        </p>
      </header>

      <TournamentStudio robots={robotNames()} />
    </div>
  );
}
