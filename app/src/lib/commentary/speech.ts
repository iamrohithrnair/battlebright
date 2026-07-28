/**
 * Speech-shaped number handling.
 *
 * Commentary is *spoken*, so the script says "sixty-eight point four percent",
 * not "68.4%". That creates a validation problem: to check the caller never
 * invents a statistic we have to read those words back as numbers. This module
 * converts in both directions.
 *
 * Pure functions, no dependencies — imported by both the fact sheet builder and
 * the validator.
 */

const UNITS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Integers 0–999,999 in words. Beyond that we fall back to digits. */
export function integerToWords(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (n < 0) return `minus ${integerToWords(-n)}`;
  const i = Math.round(n);

  if (i < 20) return UNITS[i];
  if (i < 100) {
    const rest = i % 10;
    return rest ? `${TENS[Math.floor(i / 10)]}-${UNITS[rest]}` : TENS[Math.floor(i / 10)];
  }
  if (i < 1000) {
    const rest = i % 100;
    const head = `${UNITS[Math.floor(i / 100)]} hundred`;
    return rest ? `${head} and ${integerToWords(rest)}` : head;
  }
  if (i < 1_000_000) {
    const rest = i % 1000;
    const head = `${integerToWords(Math.floor(i / 1000))} thousand`;
    return rest ? `${head} ${integerToWords(rest)}` : head;
  }
  return String(i);
}

/** "68.4" -> "sixty-eight point four". Only one decimal place is ever spoken. */
export function numberToWords(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  const whole = Math.trunc(Math.abs(rounded));
  const decimal = Math.round((Math.abs(rounded) - whole) * 10);
  const sign = rounded < 0 ? 'minus ' : '';
  if (!decimal) return `${sign}${integerToWords(whole)}`;
  return `${sign}${integerToWords(whole)} point ${UNITS[decimal]}`;
}

/** Percentages drop a trailing ".0" so the caller says "seventy percent". */
export const percentToWords = (n: number): string => `${numberToWords(n)} percent`;

/** "6-2" -> "six wins and two losses". */
export const recordToWords = (wins: number, losses: number): string =>
  `${integerToWords(wins)} ${wins === 1 ? 'win' : 'wins'} and ` +
  `${integerToWords(losses)} ${losses === 1 ? 'loss' : 'losses'}`;

/**
 * Weapon classes arrive as snake_case ids. Never let one reach the speaker:
 * "horizontal_spinner" must be spoken "horizontal spinner".
 */
export const weaponToWords = (weapon: string): string => weapon.replace(/_+/g, ' ').trim();

/* -------------------------------------------------------------- extraction */

const WORD_VALUES = new Map<string, number>();
UNITS.forEach((w, i) => WORD_VALUES.set(w, i));
TENS.forEach((w, i) => {
  if (w) WORD_VALUES.set(w, i * 10);
});

const MULTIPLIERS = new Map<string, number>([
  ['hundred', 100],
  ['thousand', 1000],
]);

/** A figure found in spoken text, with the substring it came from. */
export interface SpokenFigure {
  value: number;
  raw: string;
}

/**
 * Pull every numeric claim out of a spoken sentence — digits ("72", "68.4") and
 * words ("sixty-eight point four") alike. Deliberately over-collects: the
 * validator only cares that everything it finds reconciles against the sheet,
 * so a false positive costs a lookup while a miss would let a hallucinated
 * statistic through.
 */
export function extractFigures(text: string): SpokenFigure[] {
  const found: SpokenFigure[] = [];

  // Digit literals first, including decimals and thousands separators.
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const value = Number(m[0].replace(/,/g, ''));
    if (Number.isFinite(value)) found.push({ value, raw: m[0] });
  }

  // Then spelled-out numbers. Hyphens become separators so "sixty-eight" reads
  // as two tokens.
  const tokens = text
    .toLowerCase()
    .replace(/[-\u2010-\u2015]/g, ' ')
    .split(/[^a-z]+/)
    .filter(Boolean);

  let total = 0;
  let current = 0;
  let active = false;
  let words: string[] = [];

  const flush = () => {
    if (active) {
      found.push({ value: total + current, raw: words.join(' ') });
    }
    total = 0;
    current = 0;
    active = false;
    words = [];
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (WORD_VALUES.has(token)) {
      const value = WORD_VALUES.get(token)!;
      // "twenty two": a tens word already banked, now add the unit.
      current += value;
      active = true;
      words.push(token);
      continue;
    }

    const multiplier = MULTIPLIERS.get(token);
    if (multiplier !== undefined && active) {
      if (multiplier === 1000) {
        total += Math.max(current, 1) * 1000;
        current = 0;
      } else {
        current = Math.max(current, 1) * 100;
      }
      words.push(token);
      continue;
    }

    // "and" joins hundreds to the remainder ("three hundred and four").
    if (token === 'and' && active) {
      words.push(token);
      continue;
    }

    // "point four" completes a decimal, but only when a digit word follows —
    // "percentage points" must not be mistaken for one.
    if (token === 'point' && active) {
      const next = tokens[i + 1];
      const nextValue = next ? WORD_VALUES.get(next) : undefined;
      if (nextValue !== undefined && nextValue < 10) {
        found.push({ value: total + current + nextValue / 10, raw: `${words.join(' ')} point ${next}` });
        total = 0;
        current = 0;
        active = false;
        words = [];
        i += 1;
        continue;
      }
    }

    flush();
  }
  flush();

  return found;
}
