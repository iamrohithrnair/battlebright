import { WEAPON_INFO } from '@/lib/data/roster';
import { nameHash } from '@/lib/format';
import type { WeaponType } from '@/lib/types';

/** Shared colour constants so the WebGL scenes match the DOM design tokens. */
export const ARENA = {
  pit950: '#04060B',
  pit900: '#080C14',
  pit850: '#0B111C',
  pit700: '#161E2E',
  pit600: '#1E293B',
  volt: '#3B82F6',
  voltDeep: '#1E40AF',
  ember: '#F59E0B',
  win: '#22C55E',
  lose: '#EF4444',
  ink: '#E8EEF9',
} as const;

/**
 * Team liveries. Real teams paint their bots distinctly, so give each robot a
 * stable colour derived from its name rather than one shared grey.
 */
const LIVERY = [
  '#2E3B52',
  '#3A2E52',
  '#52362E',
  '#2E5245',
  '#4A2E3B',
  '#2E4152',
  '#524A2E',
  '#3B3B3B',
];

export const liveryFor = (name: string) => LIVERY[nameHash(name) % LIVERY.length];

export const accentFor = (weapon: WeaponType) => WEAPON_INFO[weapon].accent;
