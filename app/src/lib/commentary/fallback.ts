/**
 * Deterministic commentary, written from the fact sheet with no model involved.
 *
 * This is the bottom rung of the fallback ladder. If OPENAI_API_KEY is missing,
 * the key is rejected, or the provider is down, the booth still has a full
 * six-beat script to display and — since it is plain text — to speak, if TTS is
 * reachable. Every figure is interpolated straight from the sheet, so it is
 * fact-checked by construction.
 *
 * It reads as templated rather than inspired. That is the correct trade: on
 * stage, a slightly stiff caller beats a blank screen.
 */
import { integerToWords, percentToWords, recordToWords } from './speech';
import { clampDuration } from './validate';
import { BEAT_LABELS, type BeatId, type CommentaryBeat, type FactSheet } from './types';

const beat = (id: BeatId, text: string, facts_used: string[]): CommentaryBeat => ({
  id,
  label: BEAT_LABELS[id],
  text: text.replace(/\s+/g, ' ').trim(),
  duration_hint_ms: clampDuration(undefined, text),
  facts_used,
});

export function buildFallbackScript(sheet: FactSheet): CommentaryBeat[] {
  const { robot_a: a, robot_b: b, prediction: p, simulation: sim, weapon_matchup: wm } = sheet;

  const favProb = p.winner === a.robot ? p.prob_a : p.prob_b;
  const favKey = p.winner === a.robot ? 'a' : 'b';
  const teamA = a.live?.team ?? a.builder;
  const teamB = b.live?.team ?? b.builder;
  const met = p.head_to_head.a + p.head_to_head.b > 0;

  return [
    beat(
      'intro',
      `Welcome to the box. In one corner, ${a.robot}, a ${a.weapon_label.toLowerCase()} out of
       ${teamA}, carrying ${recordToWords(a.wins, a.losses)}. Across from it, ${b.robot}, a
       ${b.weapon_label.toLowerCase()} from ${teamB}, ${recordToWords(b.wins, b.losses)}.
       Two very different ways to end a fight.`,
      ['a.name', 'a.weapon', 'a.record', 'b.name', 'b.weapon', 'b.record'].concat(
        a.live?.team ? ['a.live_team'] : ['a.builder'],
        b.live?.team ? ['b.live_team'] : ['b.builder'],
      ),
    ),

    beat(
      'tale_of_the_tape',
      `Now the numbers. ${a.robot} wins ${percentToWords(a.win_rate)} of its fights, and
       ${percentToWords(a.ko_rate)} of those wins come by knockout. ${b.robot} sits at
       ${percentToWords(b.win_rate)}, finishing ${percentToWords(b.ko_rate)} of its wins.
       ${
         wm.favours
           ? `On weapons, the matchup tilts toward ${wm.favours}.`
           : 'On weapons, this one is close to neutral.'
       } ${
        met
          ? `And they have met before: ${a.robot} leads it ${integerToWords(p.head_to_head.a)} to ${integerToWords(p.head_to_head.b)}.`
          : 'These two have never met in the box.'
      }`,
      ['a.win_rate', 'a.ko_rate', 'b.win_rate', 'b.ko_rate', 'matchup.edge', 'h2h'],
    ),

    beat(
      'prediction',
      `Here is the call. The model takes ${p.winner} at ${percentToWords(favProb)}, confidence
       ${p.confidence.toLowerCase()}. The reason is ${sheet.dominant_signal.label.toLowerCase()},
       which swings toward ${sheet.dominant_signal.leader}. Across ${integerToWords(sim.trials)}
       simulations that call holds.`,
      ['model.winner', `model.prob_${favKey}`, 'model.confidence', 'model.dominant_signal', 'sim.trials'],
    ),

    beat(
      'clash',
      `And they are off. ${a.robot} comes forward hard, ${b.robot} squares up, and the first
       exchange is violent. Weapon against armour, sparks off the floor, and the whole crowd is
       on its feet. This is what they came for.`,
      ['a.name', 'b.name'],
    ),

    beat(
      'finish',
      p.projected_method === 'KO'
        ? `The model says this one does not go the distance. Knockout likelihood,
           ${percentToWords(p.ko_likelihood)}. Somebody is getting stopped, and on the numbers it
           is ${p.loser} in trouble.`
        : `The model says this goes to the judges. Knockout likelihood only
           ${percentToWords(p.ko_likelihood)}, so expect three full minutes and a decision on
           damage, aggression and control.`,
      ['model.projected_method', 'model.ko_likelihood', 'model.underdog'],
    ),

    beat(
      'verdict',
      p.confidence === 'LOW'
        ? `So the verdict: ${p.winner} by the thinnest of margins, ${percentToWords(favProb)}. But
           be honest about this one. Confidence is low. That is close enough to a coin flip that
           the model would not be shocked either way.`
        : `So the verdict: ${p.winner} at ${percentToWords(favProb)}, confidence
           ${p.confidence.toLowerCase()}. The numbers back it, the weapon matchup backs it, and
           the simulation backs it. You want more? So do we.`,
      ['model.winner', `model.prob_${favKey}`, 'model.confidence'],
    ),
  ];
}
