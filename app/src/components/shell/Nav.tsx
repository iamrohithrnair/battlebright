'use client';

import { Menu, Swords, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { NAV_LINKS } from './nav-links';

/**
 * Floating glass nav. Deliberately inset from the viewport edge rather than
 * flush to top-0, so it reads as an instrument bezel over the arena.
 */
export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile menu on navigation and lock scroll while it is open.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <header className="z-nav pointer-events-none fixed inset-x-0 top-0 flex justify-center px-3 pt-3 sm:px-6 sm:pt-4">
        <nav
          aria-label="Main"
          className={cn(
            'pointer-events-auto flex w-full max-w-[1400px] items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors duration-300 sm:px-3',
            scrolled
              ? 'border-pit-600 bg-pit-950/85 shadow-panel backdrop-blur-xl'
              : 'border-pit-700/60 bg-pit-950/50 backdrop-blur-md',
          )}
        >
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2.5 rounded-lg px-1.5 py-1"
            aria-label="You Want More? — home"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-ember/40 bg-ember/10 text-ember transition-colors duration-200 group-hover:bg-ember/20">
              <Swords aria-hidden="true" className="h-4 w-4" />
            </span>
            <span className="hidden flex-col leading-none sm:flex">
              <span className="font-display text-[13px] font-bold tracking-tight text-ink">
                YOU WANT MORE?
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-mute">
                Battlebots Intel
              </span>
            </span>
          </Link>

          <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-pit-600 lg:block" />

          {/* Desktop links */}
          <ul className="hidden min-w-0 flex-1 items-center gap-0.5 lg:flex">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex items-center gap-1.5 rounded-md px-2.5 py-2 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors duration-200',
                      active
                        ? 'bg-volt/10 text-volt-light'
                        : 'text-ink-soft hover:bg-pit-800 hover:text-ink',
                    )}
                  >
                    <link.icon aria-hidden="true" className="h-3.5 w-3.5" />
                    {link.label}
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-2.5 -bottom-[3px] h-px bg-volt"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Link
              href="/predict"
              className="hidden min-h-[36px] items-center gap-1.5 rounded-md border border-ember bg-ember px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-pit-950 transition-colors duration-200 hover:border-ember-light hover:bg-ember-light sm:flex"
            >
              Enter the Pit
            </Link>

            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              className="flex h-11 w-11 items-center justify-center rounded-md border border-pit-600 bg-pit-850 text-ink transition-colors duration-200 hover:border-volt/60 lg:hidden"
            >
              {open ? (
                <X aria-hidden="true" className="h-5 w-5" />
              ) : (
                <Menu aria-hidden="true" className="h-5 w-5" />
              )}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile drawer */}
      {open ? (
        <div className="z-overlay fixed inset-0 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full bg-pit-950/80 backdrop-blur-sm"
          />
          <div className="absolute inset-x-3 top-[76px] max-h-[calc(100dvh-96px)] overflow-y-auto rounded-xl border border-pit-600 bg-pit-900 p-2 shadow-panel">
            <ul className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => {
                const active = isActive(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-[52px] items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-200',
                        active ? 'bg-volt/10' : 'hover:bg-pit-800',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border',
                          active
                            ? 'border-volt/40 bg-volt/10 text-volt-light'
                            : 'border-pit-600 bg-pit-850 text-ink-mute',
                        )}
                      >
                        <link.icon aria-hidden="true" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            'block font-mono text-xs uppercase tracking-[0.12em]',
                            active ? 'text-volt-light' : 'text-ink',
                          )}
                        >
                          {link.label}
                        </span>
                        <span className="block truncate text-xs text-ink-mute">{link.blurb}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
