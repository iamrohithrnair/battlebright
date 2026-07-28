import { json } from '@/lib/api';
import { WEAPON_INFO } from '@/lib/data/roster';
import { weaponMeta } from '@/lib/engine';

/**
 * GET /api/weapon-meta — per-class career win rate vs actual recorded battle rate,
 * which is how you spot an over- or under-rated weapon class.
 */
export function GET() {
  const rows = weaponMeta();
  return json({
    count: rows.length,
    rows: rows.map((row) => ({
      ...row,
      label: WEAPON_INFO[row.weapon].label,
      short: WEAPON_INFO[row.weapon].short,
      accent: WEAPON_INFO[row.weapon].accent,
      blurb: WEAPON_INFO[row.weapon].blurb,
      /** Positive means the class over-performs its career average in real fights. */
      delta: Math.round((row.battle_rate - row.win_rate) * 10) / 10,
    })),
  });
}
