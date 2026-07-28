/**
 * Turn a spoken request into a matchup.
 *
 * "call Tombstone against End Game" -> ['Tombstone', 'End Game']
 *
 * Client-safe: only touches the bundled roster. Transcription is lossy — it
 * drops hyphens, mangles casing and mishears short names — so matching is done
 * on a normalised form and, failing that, on a light edit-distance pass. Two
 * names in the order they were said wins; anything less returns what it found so
 * the UI can ask for the rest rather than silently guessing.
 */
import { robotNames } from '@/lib/engine';

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Levenshtein, capped — used only to rescue near-misses on a single word. */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  const row = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = row[j];
  }
  return prev[b.length];
}

export interface ParsedMatchup {
  robotA: string | null;
  robotB: string | null;
  /** Roster names recognised, in the order they were spoken. */
  matched: string[];
}

export function parseMatchup(transcript: string, roster: string[] = robotNames()): ParsedMatchup {
  const text = normalise(transcript);
  if (!text) return { robotA: null, robotB: null, matched: [] };

  const hits: { name: string; at: number }[] = [];

  // Longest names first, so "End Game" is not shadowed by a shorter substring.
  const byLength = [...roster].sort((a, b) => b.length - a.length);
  const claimed: [number, number][] = [];
  const overlaps = (start: number, end: number) =>
    claimed.some(([s, e]) => start < e && end > s);

  for (const name of byLength) {
    const needle = normalise(name);
    const at = text.indexOf(needle);
    if (at === -1 || overlaps(at, at + needle.length)) continue;
    claimed.push([at, at + needle.length]);
    hits.push({ name, at });
  }

  // Nothing matched cleanly: try to rescue single-word names from mishearings.
  if (hits.length < 2) {
    const words = text.split(' ');
    for (const name of byLength) {
      if (hits.some((h) => h.name === name)) continue;
      const needle = normalise(name);
      if (needle.includes(' ')) continue;
      for (let i = 0; i < words.length; i++) {
        if (words[i].length < 4) continue;
        if (editDistance(words[i], needle) <= 2) {
          const at = text.indexOf(words[i]);
          if (at !== -1 && !overlaps(at, at + words[i].length)) {
            claimed.push([at, at + words[i].length]);
            hits.push({ name, at });
          }
          break;
        }
      }
      if (hits.length >= 2) break;
    }
  }

  hits.sort((a, b) => a.at - b.at);
  const matched = hits.map((h) => h.name);
  return { robotA: matched[0] ?? null, robotB: matched[1] ?? null, matched };
}
