import { ExternalLink, Swords } from 'lucide-react';
import Link from 'next/link';
import { NAV_LINKS } from './nav-links';

export function Footer() {
  return (
    <footer className="relative mt-24 border-t border-pit-700 bg-pit-950">
      <div
        aria-hidden="true"
        className="bg-blueprint pointer-events-none absolute inset-0 opacity-40"
      />
      <div className="shell relative py-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-md border border-ember/40 bg-ember/10 text-ember">
                <Swords aria-hidden="true" className="h-4 w-4" />
              </span>
              <span className="font-display text-sm font-bold tracking-tight text-ink">
                YOU WANT MORE?
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              A 3D BattleBots intelligence engine. Every prediction is traceable to three
              transparent signals, backtested against 66 recorded fights — and verified against
              live web data collected through Bright Data.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex min-h-[36px] items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft transition-colors duration-200 hover:text-volt-light"
              >
                <link.icon aria-hidden="true" className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hairline my-8" />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-mute">
            Live web data collected with{' '}
            <a
              href="https://brightdata.com"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-volt-light transition-colors duration-200 hover:text-volt-glow"
            >
              Bright Data
              <ExternalLink aria-hidden="true" className="h-3 w-3" />
            </a>{' '}
            Web Unlocker
          </p>

          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ember">
            #BattleBotsDev
          </p>
        </div>
      </div>
    </footer>
  );
}
