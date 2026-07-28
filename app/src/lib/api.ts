import { NextResponse } from 'next/server';

/**
 * Shared helpers for the route handlers, so every endpoint returns the same
 * envelope shape and the same status codes.
 */

export const json = <T>(data: T, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      // The engine is deterministic, so responses are safely cacheable.
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
    },
  });

export const fail = (message: string, status = 400) =>
  NextResponse.json({ error: message, status }, { status });

/** Reads a bounded integer query param, falling back to a default. */
export function intParam(
  params: URLSearchParams,
  key: string,
  fallback: number,
  { min = 1, max = 1000 }: { min?: number; max?: number } = {},
): number {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** Decodes a `[name]` route segment, which arrives percent-encoded. */
export function decodeName(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}
