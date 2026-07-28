import type { NextRequest } from 'next/server';
import { fail, intParam, json } from '@/lib/api';
import { getRobot, simulate } from '@/lib/engine';

/**
 * GET /api/simulate?a=Tombstone&b=Riptide&trials=4000
 *
 * Monte Carlo over the model's own signals, returning a distribution rather than
 * a single brittle number.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const a = params.get('a')?.trim();
  const b = params.get('b')?.trim();

  if (!a || !b) return fail('Both ?a= and ?b= robot names are required.', 400);
  if (a === b) return fail('Pick two different robots.', 400);
  if (!getRobot(a)) return fail(`No robot named "${a}" in the roster.`, 404);
  if (!getRobot(b)) return fail(`No robot named "${b}" in the roster.`, 404);

  const trials = intParam(params, 'trials', 4000, { min: 200, max: 20000 });
  const result = simulate(a, b, trials);
  if (!result) return fail('Could not simulate that pairing.', 422);

  return json({ robot_a: a, robot_b: b, ...result });
}
