/**
 * Bright Data Web Unlocker integration — SERVER ONLY.
 *
 * The API token never reaches the browser: every unlock goes through a Next.js
 * route handler that imports this module. Each fetch returns provenance (URL,
 * zone, byte count, latency) so the UI can prove the data is genuinely live
 * rather than baked in.
 *
 * Docs: https://docs.brightdata.com/scraping-automation/web-unlocker/quickstart
 */
import type { Provenance, ScrapedRobot } from './types';

const ENDPOINT = 'https://api.brightdata.com/request';
const API_KEY = process.env.BRIGHT_API_KEY ?? process.env.BRIGHTDATA_API_KEY ?? '';
const ZONE = process.env.BRIGHTDATA_ZONE ?? 'youwantmore_unlocker';

/** Unlocked pages are stable for a while; cache so demos stay fast and cheap. */
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { html: string; at: number; ms: number }>();

export const isEnabled = () => Boolean(API_KEY);
export const zoneName = () => ZONE;

export class BrightDataError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'BrightDataError';
  }
}

export interface Unlocked {
  html: string;
  provenance: Provenance;
}

export async function unlock(url: string, { fresh = false } = {}): Promise<Unlocked> {
  if (!API_KEY) {
    throw new BrightDataError(
      'BRIGHT_API_KEY is not set. Add it to .env.local to enable live collection.',
      'not_configured',
    );
  }

  const hit = cache.get(url);
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return {
      html: hit.html,
      provenance: {
        url,
        zone: ZONE,
        bytes: hit.html.length,
        ms: hit.ms,
        fetched_at: new Date(hit.at).toISOString(),
        cached: true,
        status: 'cached',
      },
    };
  }

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ zone: ZONE, url, format: 'raw' }),
      cache: 'no-store',
    });
  } catch (e) {
    throw new BrightDataError(
      `Could not reach Bright Data: ${(e as Error).message}`,
      'network',
    );
  }

  // The API answers 200 even when the proxy layer rejected the request; the real
  // verdict is in the x-brd-* headers.
  const brdError = res.headers.get('x-brd-err-msg') ?? res.headers.get('x-brd-error');
  const html = await res.text();

  if (!res.ok) {
    throw new BrightDataError(
      `Bright Data returned HTTP ${res.status}: ${html.slice(0, 200)}`,
      'http_error',
    );
  }
  if (brdError || !html.length) {
    throw new BrightDataError(
      brdError ?? 'Bright Data returned an empty document.',
      res.headers.get('x-brd-err-code') ?? 'empty',
    );
  }

  const ms = Date.now() - started;
  cache.set(url, { html, at: started, ms });

  return {
    html,
    provenance: {
      url,
      zone: ZONE,
      bytes: html.length,
      ms,
      fetched_at: new Date(started).toISOString(),
      cached: false,
      status: 'live',
    },
  };
}

/* ------------------------------------------------------------------ parsing */

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));

const stripTags = (s: string) => decode(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

/**
 * Pull a labelled value out of a Fandom infobox. The markup nests the label and
 * value in sibling elements, so match the label then take the following block.
 */
function infoboxValue(html: string, labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(
      `data-source="[^"]*"[^>]*>\\s*<h3[^>]*>\\s*${label}\\s*</h3>\\s*<div[^>]*>([\\s\\S]{0,400}?)</div>`,
      'i',
    );
    const m = html.match(re);
    if (m) {
      const value = stripTags(m[1]);
      if (value) return value;
    }
  }
  // Fallback: plain-text scan, which also covers non-Fandom sources.
  const text = stripTags(html);
  for (const label of labels) {
    const m = text.match(new RegExp(`${label}\\s*[:\\-]?\\s*([^|\\n]{2,60})`, 'i'));
    if (m) return m[1].trim();
  }
  return null;
}

const WEAPON_KEYWORDS: [RegExp, string][] = [
  [/horizontal(?:ly)?[- ]spinning|horizontal (?:bar|blade|disc|spinner)|spinning bar/i, 'horizontal_spinner'],
  [/vertical(?:ly)?[- ]spinning|vertical (?:disc|drum|spinner)|eggbeater/i, 'vertical_spinner'],
  [/drum|beater bar/i, 'drum_spinner'],
  [/saw|cutting disc|grinder/i, 'overhead_saw'],
  [/flipper|launcher|flipping arm/i, 'flipper'],
  [/lifter|lifting (?:arm|forks)|wedge/i, 'lifter'],
  [/hammer|axe|pickaxe/i, 'hammer'],
  [/crusher|crushing (?:claw|jaw)|piercing/i, 'crusher'],
];

function normaliseWeapon(raw: string | null): string | null {
  if (!raw) return null;
  for (const [re, type] of WEAPON_KEYWORDS) {
    if (re.test(raw)) return type;
  }
  return raw.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '') || null;
}

export function parseRobotPage(html: string, robot: string): ScrapedRobot {
  const weaponRaw = infoboxValue(html, ['Weapon\\(s\\)', 'Weapons?', 'Weapon type']);
  const weightRaw = infoboxValue(html, ['Weight', 'Weight class']);
  const weightMatch = weightRaw?.match(/(\d{2,4})/);

  const imageMatch =
    html.match(/<meta property="og:image" content="([^"]+)"/i) ??
    html.match(/<img[^>]+src="(https:\/\/static\.wikia[^"]+)"/i);

  // The lede is the first substantial paragraph of the article body.
  let excerpt: string | null = null;
  for (const m of html.matchAll(/<p>([\s\S]{80,1200}?)<\/p>/gi)) {
    const text = stripTags(m[1]);
    if (text.length > 80 && !/^\s*(?:This article|For the)/i.test(text)) {
      excerpt = text.length > 420 ? `${text.slice(0, 417)}...` : text;
      break;
    }
  }

  const seasons = [
    ...new Set(
      [...stripTags(html).matchAll(/\b(?:BattleBots\s+)?(?:Season\s+(\d{1,2})|(20[0-2]\d)\s+season)/gi)]
        .map((m) => m[1] ?? m[2])
        .filter(Boolean),
    ),
  ].slice(0, 12);

  return {
    robot,
    weapon_type: normaliseWeapon(weaponRaw),
    weight_lb: weightMatch ? Number(weightMatch[1]) : null,
    country: infoboxValue(html, ['Country', 'Origin', 'Nationality']),
    builder: infoboxValue(html, ['Team Captain', 'Captain', 'Builder', 'Team leader']),
    team: infoboxValue(html, ['Team', 'Team name']),
    excerpt,
    image: imageMatch ? decode(imageMatch[1]) : null,
    seasons,
  };
}

export const wikiUrl = (robot: string) =>
  `https://battlebots.fandom.com/wiki/${encodeURIComponent(robot.replace(/\s+/g, '_'))}`;

/** Headline/news items about a robot, harvested from the wiki category feed. */
export function parseRosterLinks(html: string, limit = 40): { name: string; url: string }[] {
  const out: { name: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a[^>]+href="(\/wiki\/[^":#?]+)"[^>]*>([^<]{2,60})<\/a>/gi)) {
    const name = decode(m[2]).trim();
    if (!name || seen.has(name)) continue;
    if (/^(Category|File|Template|Special|Help|User|Talk|BattleBots Wiki)/i.test(name)) continue;
    seen.add(name);
    out.push({ name, url: `https://battlebots.fandom.com${m[1]}` });
    if (out.length >= limit) break;
  }
  return out;
}
