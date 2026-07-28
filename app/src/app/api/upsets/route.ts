import type { NextRequest } from 'next/server';
import { intParam, json } from '@/lib/api';
import { upsets } from '@/lib/engine';

/**
 * GET /api/upsets?limit=10 — recorded fights the model got wrong, worst first.
 * Publishing your own misses is the point of the transparency story.
 */
export function GET(request: NextRequest) {
  const limit = intParam(request.nextUrl.searchParams, 'limit', 10, { min: 1, max: 66 });
  const rows = upsets(limit);
  return json({ count: rows.length, upsets: rows });
}
