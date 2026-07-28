import type { NextRequest } from 'next/server';
import { WEAPON_TYPES } from '@/lib/data/roster';
import { allRobots, koRate, winRate } from '@/lib/engine';
import { fail, json } from '@/lib/api';
import type { WeaponType } from '@/lib/types';

/**
 * GET /api/robots
 *   ?weapon=horizontal_spinner   filter by weapon class
 *   ?q=tomb                      substring search on name or builder
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const weapon = params.get('weapon');
  const q = params.get('q')?.trim().toLowerCase() ?? '';

  if (weapon && !WEAPON_TYPES.includes(weapon as WeaponType)) {
    return fail(
      `Unknown weapon class "${weapon}". Expected one of: ${WEAPON_TYPES.join(', ')}.`,
      400,
    );
  }

  let robots = allRobots();
  if (weapon) robots = robots.filter((r) => r.weapon_type === weapon);
  if (q) {
    robots = robots.filter(
      (r) => r.robot.toLowerCase().includes(q) || r.builder.toLowerCase().includes(q),
    );
  }

  return json({
    count: robots.length,
    robots: robots.map((r) => ({
      ...r,
      win_rate: Math.round(winRate(r) * 1000) / 10,
      ko_rate: Math.round(koRate(r) * 1000) / 10,
    })),
  });
}
