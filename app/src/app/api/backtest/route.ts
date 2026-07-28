import { json } from '@/lib/api';
import { WEIGHTS, backtest } from '@/lib/engine';

/**
 * GET /api/backtest — replays the model over every recorded fight.
 *
 * Head-to-head is switched off during the replay so the model cannot peek at the
 * result of the fight it is being asked to predict.
 */
export function GET() {
  return json({
    ...backtest(),
    weights: WEIGHTS,
    formula: 'score = 0.45·win_rate + 0.25·ko_rate + 0.30·(0.5 + weapon_edge)',
    head_to_head_applied: false,
  });
}
