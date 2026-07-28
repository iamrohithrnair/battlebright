import type { NextRequest } from 'next/server';
import { fail, json } from '@/lib/api';
import { WEIGHTS, getRobot, predict } from '@/lib/engine';

/**
 * GET /api/predict?a=Tombstone&b=End%20Game
 *   &h2h=false   drop the head-to-head nudge (this is what backtesting does)
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const a = params.get('a')?.trim();
  const b = params.get('b')?.trim();

  if (!a || !b) return fail('Both ?a= and ?b= robot names are required.', 400);
  if (a === b) return fail('Pick two different robots.', 400);
  if (!getRobot(a)) return fail(`No robot named "${a}" in the roster.`, 404);
  if (!getRobot(b)) return fail(`No robot named "${b}" in the roster.`, 404);

  const useH2h = params.get('h2h') !== 'false';
  const prediction = predict(a, b, useH2h);
  if (!prediction) return fail('Could not build a prediction for that pairing.', 422);

  return json({ ...prediction, weights: WEIGHTS, head_to_head_applied: useH2h });
}
