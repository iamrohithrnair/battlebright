import type { IntelResult } from '@/lib/types';

/**
 * What `GET /api/intel/:name` returns. `IntelResult` carries the data; the extra
 * fields carry the *story* — a human-readable note and, when the unlock failed,
 * the transparent error so the page can say exactly what happened instead of
 * silently pretending the bundled dataset came off the wire.
 */
export interface IntelPayload extends IntelResult {
  /** One sentence describing where this payload came from. */
  message: string;
  /** Every weight the page lists — robots change class between eras. */
  listed_weights: number[];
  /** Present only when the live unlock could not be completed. */
  error?: { code: string; message: string };
}

export const DIFF_FIELD_LABELS: Record<string, string> = {
  weapon_type: 'Weapon class',
  weight_lb: 'Weight',
  country: 'Country',
  builder: 'Builder',
};

/** 977523 -> "954.6 KB". Bytes are the most persuasive number on the page. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  return ms < 1000 ? `${Math.round(ms)}` : (ms / 1000).toFixed(2);
}

/** ISO timestamp -> "20:14:07 UTC · 28 Jul 2026", stable between server and client. */
export function formatFetchedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const time = d.toISOString().slice(11, 19);
  const date = d.toISOString().slice(0, 10);
  return `${time} UTC · ${date}`;
}
