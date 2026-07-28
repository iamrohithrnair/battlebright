import type { NextRequest } from 'next/server';
import { fail, json } from '@/lib/api';
import { getRobot, seedBracket, tournament } from '@/lib/engine';

const SIZES = [4, 8, 16] as const;
type Size = (typeof SIZES)[number];

/**
 * GET /api/tournament
 *   ?size=8                          auto-seed the top 8 by win rate
 *   ?robots=Tombstone,Riptide,…      supply your own entrants, in bracket order
 *
 * Manual entrants win over ?size= when both are present.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawRobots = params.get('robots');

  let entrants: string[];
  let seeded: boolean;

  if (rawRobots) {
    const names = rawRobots
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);

    if (names.length < 2) return fail('Supply at least two robots in ?robots=.', 400);

    const unknown = names.filter((n) => !getRobot(n));
    if (unknown.length) {
      return fail(`Not in the roster: ${unknown.join(', ')}.`, 404);
    }
    entrants = names;
    seeded = false;
  } else {
    const size = Number(params.get('size') ?? 8);
    if (!SIZES.includes(size as Size)) {
      return fail(`?size= must be one of ${SIZES.join(', ')}.`, 400);
    }
    entrants = seedBracket(size as Size);
    seeded = true;
  }

  const result = tournament(entrants);
  if (!result) {
    return fail('Could not build a bracket — at least two distinct robots are needed.', 422);
  }

  return json({ ...result, auto_seeded: seeded });
}
