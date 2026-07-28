import type { NextRequest } from 'next/server';
import { intParam, json } from '@/lib/api';
import { leaderboard } from '@/lib/engine';

/** GET /api/leaderboard?limit=10 — all bots ranked by career win rate. */
export function GET(request: NextRequest) {
  const rows = leaderboard();
  const limit = intParam(request.nextUrl.searchParams, 'limit', rows.length, {
    min: 1,
    max: rows.length,
  });

  return json({ count: Math.min(limit, rows.length), rows: rows.slice(0, limit) });
}
