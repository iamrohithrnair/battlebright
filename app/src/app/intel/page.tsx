import type { Metadata } from 'next';
import { KeyRound, Lock, ScanText } from 'lucide-react';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { zoneName } from '@/lib/brightdata';
import { robotNames } from '@/lib/engine';
import { IntelConsole } from './IntelConsole';

export const metadata: Metadata = {
  title: 'Live Intel — Bright Data collection console',
  description:
    'Unlock a BattleBots wiki page live through the Bright Data Web Unlocker and verify our bundled dataset against it, field by field.',
};

export const dynamic = 'force-dynamic';

export default function IntelPage() {
  return (
    <main className="shell no-scroll-x py-10 sm:py-14">
      <header className="animate-rise">
        <SectionLabel rule>Bright Data · Web Unlocker</SectionLabel>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Live intel console
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-soft">
          Every figure on this page is measured, not decorated. Pick a robot, unlock its wiki page
          through Bright Data, and read the byte count, latency and field-by-field diff against our
          bundled dataset.
        </p>
      </header>

      <section
        aria-label="How the collection works"
        className="mt-6 grid gap-3 sm:grid-cols-3"
      >
        <Explainer
          icon={<Lock className="h-4 w-4" />}
          title="Unblocked retrieval"
          body="The Web Unlocker handles bot detection, CAPTCHAs and geo-restrictions, so a full wiki page comes back as raw HTML instead of a challenge screen."
        />
        <Explainer
          icon={<KeyRound className="h-4 w-4" />}
          title="Token stays server-side"
          body="The API token is read only inside a Node route handler. The browser receives the parsed payload and its provenance — never a credential."
        />
        <Explainer
          icon={<ScanText className="h-4 w-4" />}
          title="Dependency-free parsing"
          body="The infobox, lede and season mentions are extracted by our own parser, with no HTML library in the bundle."
        />
      </section>

      <div className="mt-8">
        <IntelConsole robots={robotNames()} zone={zoneName()} />
      </div>
    </main>
  );
}

function Explainer({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-lg border border-pit-700 bg-pit-900/50 p-4">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
        <span aria-hidden="true" className="text-volt">
          {icon}
        </span>
        {title}
      </h2>
      <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">{body}</p>
    </article>
  );
}
