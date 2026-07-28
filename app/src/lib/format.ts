/** Small shared formatters so numbers read identically across every page. */

export const pct = (n: number, digits = 1) => `${n.toFixed(digits)}%`;

export const signed = (n: number, digits = 2) =>
  `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}`;

export const bytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

export const ms = (n: number) => (n < 1000 ? `${n} ms` : `${(n / 1000).toFixed(2)} s`);

export const record = (wins: number, losses: number) => `${wins}-${losses}`;

/** Turns a robot name into the URL segment used by /roster/[name]. */
export const robotSlug = (name: string) => encodeURIComponent(name);

/** Deterministic hue derived from a name, for per-bot team colours. */
export function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 100000;
  return h;
}
