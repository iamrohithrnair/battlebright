import type { Provenance } from '@/lib/types';

/**
 * Status presentation, in one place so the badge, the panel border and the log
 * row can never disagree with each other. Colour is always paired with a label,
 * never used as the only signal.
 */
export const STATUS_META: Record<
  Provenance['status'],
  { label: string; tone: 'win' | 'volt' | 'ember'; text: string; border: string; note: string }
> = {
  live: {
    label: 'Live',
    tone: 'win',
    text: 'text-win',
    border: 'border-win/40',
    note: 'Fetched from the origin through the Bright Data Web Unlocker just now.',
  },
  cached: {
    label: 'Cached',
    tone: 'volt',
    text: 'text-volt-light',
    border: 'border-volt/40',
    note: 'Replayed from this server process\u2019s 10-minute unlock cache. Force a fresh unlock to re-fetch.',
  },
  fallback: {
    label: 'Fallback',
    tone: 'ember',
    text: 'text-ember-light',
    border: 'border-ember/40',
    note: 'The unlock could not be completed, so only the bundled dataset is shown.',
  },
};
