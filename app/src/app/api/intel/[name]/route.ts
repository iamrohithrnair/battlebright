import { NextResponse } from 'next/server';
import {
  BrightDataError,
  isEnabled,
  parseRobotPage,
  unlock,
  wikiUrl,
  zoneName,
} from '@/lib/brightdata';
import { getRobot, robotNames } from '@/lib/engine';
import type { Provenance, Robot, ScrapedRobot } from '@/lib/types';
import type { IntelPayload } from '@/app/intel/payload';

/**
 * GET /api/intel/:name — unlock the robot's wiki page through Bright Data, parse
 * it, and diff the result against our bundled dataset.
 *
 * The API token lives only in this process: the browser sees the parsed payload
 * and its provenance, never a credential. `?fresh=1` bypasses the 10-minute
 * in-process cache so a demo can prove the fetch is real on demand.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* --------------------------------------------------------------- comparison */

const norm = (v: unknown): string =>
  String(v ?? '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Wiki infoboxes and our dataset spell the same country several ways. */
const COUNTRY_ALIASES: Record<string, string> = {
  us: 'usa',
  usa: 'usa',
  'u s a': 'usa',
  america: 'usa',
  'united states': 'usa',
  'united states of america': 'usa',
  uk: 'uk',
  'united kingdom': 'uk',
  england: 'uk',
  'great britain': 'uk',
  scotland: 'uk',
  wales: 'uk',
  nz: 'new zealand',
  'new zealand': 'new zealand',
  netherlands: 'netherlands',
  holland: 'netherlands',
  'the netherlands': 'netherlands',
};

const normCountry = (v: unknown): string => {
  const n = norm(v);
  return COUNTRY_ALIASES[n] ?? n;
};

/** Two people-or-team names agree if either fully contains the other. */
function nameMatches(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true;
  // "Ray Billings" vs "Billings, Ray" — same token set is good enough.
  const ta = new Set(a.split(' ').filter((t) => t.length > 2));
  const tb = new Set(b.split(' ').filter((t) => t.length > 2));
  if (!ta.size || !tb.size) return false;
  const shared = [...ta].filter((t) => tb.has(t)).length;
  return shared >= Math.min(ta.size, tb.size);
}

/** Weapon classes agree when their descriptive words overlap, not just verbatim. */
function weaponMatches(local: string, live: string): boolean {
  if (!local || !live) return false;
  if (local === live) return true;
  const words = (s: string) => new Set(s.split(' ').filter(Boolean));
  const a = words(local);
  const b = words(live);
  const shared = [...a].filter((w) => b.has(w));
  return shared.length >= Math.min(a.size, b.size, 2);
}

/* -------------------------------------------------------------- sanitisation */

/**
 * The parser falls back to a plain-text scan when a Fandom infobox row is
 * missing, which can latch onto inline page script or a stray sentence. Evidence
 * has to be trustworthy, so an implausible proper noun is discarded rather than
 * presented as a scraped fact.
 */
const CODEY = /[{}`;=<>|[\]]|https?:\/\/|\b(?:let|var|const|function|return|null)\b/i;

function plausibleName(value: string | null, maxWords: number, maxLen: number): string | null {
  if (!value) return null;
  const s = value.replace(/\s+/g, ' ').trim().replace(/[,.;:]+$/, '');
  if (!s || s.length > maxLen || CODEY.test(s)) return null;
  const words = s.split(' ');
  if (words.length > maxWords) return null;
  // Proper nouns: every word starts with a capital, an ampersand or a digit.
  return words.every((w) => /^[A-Z0-9&(]/.test(w) && /^[\w&().'’/-]+$/.test(w)) ? s : null;
}

function sanitiseScraped(raw: ScrapedRobot): ScrapedRobot {
  return {
    ...raw,
    country: plausibleName(raw.country, 4, 40),
    builder: plausibleName(raw.builder, 5, 48),
    team: plausibleName(raw.team, 6, 60),
    weight_lb:
      raw.weight_lb !== null && raw.weight_lb >= 10 && raw.weight_lb <= 1000 ? raw.weight_lb : null,
  };
}

const shown = (v: unknown, suffix = ''): string =>
  v === null || v === undefined || v === '' ? '—' : `${v}${suffix}`;

function buildDiff(local: Robot | null, live: ScrapedRobot): IntelPayload['diff'] {
  return [
    {
      field: 'weapon_type',
      local: shown(local?.weapon_type),
      live: shown(live.weapon_type),
      match: Boolean(
        local && live.weapon_type && weaponMatches(norm(local.weapon_type), norm(live.weapon_type)),
      ),
    },
    {
      field: 'weight_lb',
      local: shown(local?.weight_lb, ' lb'),
      live: shown(live.weight_lb, ' lb'),
      match: Boolean(local && live.weight_lb !== null && local.weight_lb === live.weight_lb),
    },
    {
      field: 'country',
      local: shown(local?.country),
      live: shown(live.country),
      match: Boolean(
        local && live.country && normCountry(local.country) === normCountry(live.country),
      ),
    },
    {
      field: 'builder',
      local: shown(local?.builder),
      live: shown(live.builder),
      match: Boolean(local && live.builder && nameMatches(norm(local.builder), norm(live.builder))),
    },
  ];
}

/* ------------------------------------------------------------------- handler */

/** Case-insensitive, underscore-tolerant lookup against the bundled roster. */
function resolveName(input: string): string | null {
  const wanted = norm(decodeURIComponent(input));
  return robotNames().find((n) => norm(n) === wanted) ?? null;
}

function fallbackPayload(
  robot: string,
  local: Robot | null,
  error: { code: string; message: string },
): IntelPayload {
  const provenance: Provenance = {
    url: wikiUrl(robot),
    zone: zoneName(),
    bytes: 0,
    ms: 0,
    fetched_at: new Date().toISOString(),
    cached: false,
    status: 'fallback',
  };

  const scraped: ScrapedRobot = {
    robot,
    weapon_type: null,
    weight_lb: null,
    country: null,
    builder: null,
    team: null,
    excerpt: null,
    image: null,
    seasons: [],
  };

  return {
    scraped,
    local,
    diff: buildDiff(local, scraped),
    provenance,
    message:
      'Live collection is unavailable, so this view is served from the bundled dataset. Nothing is fabricated — the provenance below is marked FALLBACK.',
    error,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const robot = resolveName(name);

  if (!robot) {
    return NextResponse.json(
      {
        error: 'unknown_robot',
        message: `"${decodeURIComponent(name)}" is not in the bundled roster. Pick one of the ${
          robotNames().length
        } tracked robots.`,
        known: robotNames(),
      },
      { status: 404 },
    );
  }

  const local = getRobot(robot);
  const fresh = new URL(request.url).searchParams.get('fresh') === '1';

  if (!isEnabled()) {
    return NextResponse.json(
      fallbackPayload(robot, local, {
        code: 'not_configured',
        message: 'BRIGHT_API_KEY is not set on the server, so no unlock was attempted.',
      }),
      { status: 200 },
    );
  }

  try {
    const { html, provenance } = await unlock(wikiUrl(robot), { fresh });
    const scraped = parseRobotPage(html, robot);
    const diff = buildDiff(local, scraped);
    const verified = diff.filter((d) => d.match).length;

    const payload: IntelPayload = {
      scraped,
      local,
      diff,
      provenance,
      message:
        provenance.status === 'cached'
          ? `Served from this process's 10-minute unlock cache; ${verified} of ${diff.length} fields agree with the bundled dataset.`
          : `Unlocked ${provenance.bytes.toLocaleString('en-US')} bytes through Bright Data in ${
              provenance.ms
            } ms; ${verified} of ${diff.length} fields agree with the bundled dataset.`,
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    const err =
      e instanceof BrightDataError
        ? { code: e.code, message: e.message }
        : { code: 'unexpected', message: (e as Error).message };

    return NextResponse.json(fallbackPayload(robot, local, err), {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
