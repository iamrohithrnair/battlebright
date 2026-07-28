import type { Metadata, Viewport } from 'next';
import { Fira_Code, Fira_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { Footer } from '@/components/shell/Footer';
import { Nav } from '@/components/shell/Nav';
import './globals.css';

/** Fira Code carries every number and technical label; Fira Sans carries prose. */
const firaCode = Fira_Code({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fira-code',
  display: 'swap',
});

const firaSans = Fira_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-fira-sans',
  display: 'swap',
});

const TITLE = 'You Want More? — 3D BattleBots Intelligence Engine';
const DESCRIPTION =
  'Pick two robots, get an explainable win prediction, run tournaments, explore the weapon-class meta, scrape live wiki data through Bright Data, and interrogate an AI analyst. 42 bots, 66 fights, one traceable model.';

export const metadata: Metadata = {
  title: { default: TITLE, template: '%s — You Want More?' },
  description: DESCRIPTION,
  applicationName: 'You Want More?',
  keywords: [
    'BattleBots',
    'robot combat',
    'win prediction',
    'Bright Data',
    'BattleBotsDev',
    'three.js',
    'sports analytics',
  ],
  authors: [{ name: 'You Want More?' }],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'You Want More?',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#04060B',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${firaCode.variable} ${firaSans.variable}`} suppressHydrationWarning>
      <body className="no-scroll-x min-h-dvh bg-pit-950 text-ink">
        <a
          href="#content"
          className="z-overlay sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:flex focus:min-h-[44px] focus:items-center focus:rounded-md focus:border focus:border-ember focus:bg-pit-900 focus:px-4 focus:font-mono focus:text-xs focus:uppercase focus:tracking-[0.12em] focus:text-ember"
        >
          Skip to content
        </a>

        <Nav />

        <main id="content" className="min-h-dvh">
          {children}
        </main>

        <Footer />
      </body>
    </html>
  );
}
