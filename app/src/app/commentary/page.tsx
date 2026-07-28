/**
 * /commentary — the broadcast booth.
 *
 * A standalone page for the voice commentator: pick a matchup, hit the amber
 * CTA, and the caller works through six beats with synchronised captions and the
 * data behind every claim on screen beside them.
 *
 * Server component: it only resolves the roster and weapon accents, then hands
 * the interactive surface to the client.
 */
import { AudioLines, ShieldCheck, Waypoints } from 'lucide-react';
import type { Metadata } from 'next';

import { Badge, Panel, SectionLabel } from '@/components/ui';
import { WEAPON_INFO } from '@/lib/data/roster';
import { allRobots, robotNames } from '@/lib/engine';

import { BoothClient } from './BoothClient';

export const metadata: Metadata = {
  title: 'Broadcast Booth — You Want More?',
  description:
    'An AI fight caller for BattleBots. Every number spoken is pulled from the prediction engine and a live Bright Data web fetch, then fact-checked before it is voiced.',
};

/** Sensible opening card: the sport's most recognisable spinner against the champion. */
const DEFAULT_A = 'Tombstone';
const DEFAULT_B = 'End Game';

export default function CommentaryPage() {
  const roster = robotNames();
  const accents = Object.fromEntries(
    allRobots().map((r) => [r.robot, WEAPON_INFO[r.weapon_type].accent]),
  );

  const initialA = roster.includes(DEFAULT_A) ? DEFAULT_A : roster[0];
  const initialB = roster.includes(DEFAULT_B) ? DEFAULT_B : roster[1];

  // `shell` is the app's container utility. The generous top padding clears the
  // fixed nav so the badge row is not tucked underneath it.
  return (
    <main className="shell no-scroll-x pb-10 pt-24 sm:pb-14 sm:pt-28">
      <header className="mb-8 animate-rise">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone="ember" size="md" icon={<AudioLines className="h-3 w-3" aria-hidden="true" />}>
            Voice
          </Badge>
          <Badge tone="volt" size="md" icon={<ShieldCheck className="h-3 w-3" aria-hidden="true" />}>
            Fact-checked
          </Badge>
          <Badge tone="outline" size="md" icon={<Waypoints className="h-3 w-3" aria-hidden="true" />}>
            Live web grounded
          </Badge>
        </div>

        <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Broadcast Booth
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-ink-soft">
          An AI commentator that calls the fight out loud — and can prove every word. Before a
          single line is written, the booth assembles a fact sheet from the prediction engine and a
          live web fetch of both machines. Every figure the caller speaks is then matched back
          against that sheet, so a statistic that cannot be traced never makes it to air.
        </p>
      </header>

      <div className="animate-rise">
        <BoothClient roster={roster} accents={accents} initialA={initialA} initialB={initialB} />
      </div>

      {/* How it works — for judges reading over someone's shoulder. */}
      <Panel className="mt-4" label="Method" title="How the call is built">
        <ol className="grid gap-5 sm:grid-cols-3">
          {[
            {
              n: '01',
              title: 'Ground it',
              body: 'The engine supplies records, win and KO rates, the weapon-matchup edge, head-to-head history, weighted signal contributions and a four-thousand-trial Monte Carlo spread. In parallel, Bright Data unlocks both robots\u2019 wiki pages for team names, seasons and real-world context the bundled dataset does not carry.',
            },
            {
              n: '02',
              title: 'Write it',
              body: 'A language model turns that fact sheet into six beats under a strict JSON schema — introductions, the tape, the call, the clash, the finish, the verdict. It is told that inventing a statistic is a hard failure, and each beat must declare which fact ids it cites.',
            },
            {
              n: '03',
              title: 'Check it, then speak it',
              body: 'Every figure in the script, spoken or written, is extracted and reconciled against the fact sheet. Anything that does not match is repaired or flagged on screen. Only then is the text sent to text-to-speech, with the delivery steered per beat.',
            },
          ].map((step) => (
            <li key={step.n}>
              <SectionLabel rule>
                <span className="font-mono text-ember-light">{step.n}</span>
                <span className="ml-2">{step.title}</span>
              </SectionLabel>
              <p className="mt-2.5 text-sm leading-relaxed text-ink-mute">{step.body}</p>
            </li>
          ))}
        </ol>
      </Panel>
    </main>
  );
}
