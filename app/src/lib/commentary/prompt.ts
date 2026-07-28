/**
 * Prompt construction for the fight caller.
 *
 * Two jobs: render the fact sheet into something a language model can quote
 * from without ambiguity, and state the rules hard enough that it doesn't
 * improvise. The output shape is pinned by a strict JSON schema — we never parse
 * prose.
 */
import { BEAT_IDS, BEAT_LABELS, type BeatId, type Fact, type FactSheet } from './types';

/** What each beat has to accomplish. Given to the model verbatim. */
const BEAT_BRIEFS: Record<BeatId, string> = {
  intro:
    'Introduce both machines to the arena. Name each one, its weapon class, its career record, ' +
    'and who builds it — prefer the live team name from the web when one is present. Set the stage.',
  tale_of_the_tape:
    'The numbers segment. Career win rates, share of wins by knockout, the weapon matchup edge, ' +
    'and the head-to-head record if they have ever met (say plainly that they have not, if so). ' +
    'Analytical, not hyped.',
  prediction:
    "The model's call. Name the favourite, give the probability and the confidence level, and " +
    'explain WHY by citing the dominant weighted signal. This is the beat that must be exact.',
  clash:
    'The moment of impact. The most energetic beat. You may describe the collision vividly — ' +
    'weapon against armour, sparks, the crowd — but any NUMBER you speak must still come from ' +
    'the sheet. Prefer zero numbers here and let the writing carry it.',
  finish:
    'How this fight ends: the projected finish and the knockout likelihood. If the projection is ' +
    "a judges' decision, say so and say why the fight is likely to go the distance.",
  verdict:
    'The wrap-up. Restate the favourite and the number one more time. If confidence is LOW, say ' +
    'so honestly and in plain words — that this one is close to a coin flip and the model is not ' +
    'certain. Never oversell a weak call.',
};

export const SYSTEM_PROMPT = `You are the lead broadcast commentator for "You Want More?", a professional combat-robotics intelligence show covering BattleBots.

You write beat-by-beat fight commentary that is spoken aloud by a text-to-speech voice. Your defining trait is that you are ENERGETIC AND PUNCHY BUT ALWAYS FACTUAL.

## The one unbreakable rule

Every single number, name, record, rate, probability and percentage you speak MUST come from the FACT SHEET supplied in the user message. Inventing a statistic — even a plausible one, even a rounded one — is a hard failure that invalidates the whole broadcast. If a figure is not on the sheet, you do not say it. When in doubt, describe the fight qualitatively instead of reaching for a number you do not have.

You must not:
- invent records, seasons, event names, judges, scores, arena hazards, quotes or dates;
- convert or recompute figures (do not turn a win rate into a number of fights, do not average two rates, do not say "roughly three quarters" of a percentage);
- state a number more precisely than the sheet does.

## Writing for the voice, not the page

This text goes straight to a speech synthesiser. It is heard, never read.

- Plain spoken sentences only. NO markdown, NO bullet points, NO headings, NO stage directions, NO speaker labels, NO emoji, NO parentheses.
- Write numbers as WORDS the way a broadcaster says them: "seventy-two percent", not "72%". "six wins and two losses", not "6-2". "number three", not "#3".
- NEVER read out an underscore or an internal identifier. Say "horizontal spinner", never "horizontal_spinner".
- Expand awkward tokens sensibly for the ear: "lb" becomes "pounds", "KO" becomes "knockout", "H2" becomes "H two", "vs" becomes "versus", "S8" becomes "season eight".
- Short sentences. A caller breathes. Two to four sentences per beat, and no sentence longer than about twenty-five words.
- Vary how each beat opens. Do not begin every beat the same way.

## Output contract

Return JSON with a "beats" array holding exactly ${BEAT_IDS.length} beats, in this order: ${BEAT_IDS.join(', ')}.

For each beat:
- "id": the beat id.
- "text": the spoken words. Two to four sentences.
- "duration_hint_ms": your honest estimate of how long this takes to say aloud at broadcast pace, in milliseconds. Roughly 380 ms per word. Between 3000 and 20000.
- "facts_used": the ids of every fact from the FACT SHEET that this beat cites, copied EXACTLY as given in the "id" column. List an id for every figure you speak. This is an audit trail that is shown to the audience, so it must be complete and honest — do not list ids you did not actually use, and do not omit ones you did.`;

/** Renders the fact table as an unambiguous, quotable block. */
function renderFacts(facts: Record<string, Fact>): string {
  const rows = Object.values(facts).map((f) => {
    const spoken = f.spoken && f.spoken !== f.display ? `  |  SAY IT AS: "${f.spoken}"` : '';
    return `- id: ${f.id}  |  ${f.label}  |  VALUE: ${f.display}${spoken}`;
  });
  return rows.join('\n');
}

export function buildUserPrompt(sheet: FactSheet): string {
  const { robot_a: a, robot_b: b, prediction, weapon_matchup, dominant_signal } = sheet;

  const liveBlock = (label: string, robot: typeof a) => {
    if (!robot.live) {
      return `${label} live web data: UNAVAILABLE for this fight. Do not reference team names or seasons for this machine.`;
    }
    const parts = [
      robot.live.team && `team "${robot.live.team}"`,
      robot.live.builder && `builder ${robot.live.builder}`,
      robot.live.country && `country ${robot.live.country}`,
      robot.live.seasons.length && `seasons referenced: ${robot.live.seasons.join(', ')}`,
    ].filter(Boolean);
    const excerpt = robot.live.excerpt
      ? `\n  Live wiki summary (context only — quote no numbers from it): ${robot.live.excerpt}`
      : '';
    return `${label} live web data (fetched moments ago): ${parts.join('; ') || 'none parsed'}.${excerpt}`;
  };

  const briefs = BEAT_IDS.map(
    (id) => `${id} (${BEAT_LABELS[id]}): ${BEAT_BRIEFS[id]}`,
  ).join('\n\n');

  return `# THE FIGHT

${a.robot} versus ${b.robot}.

${a.robot}: ${a.weapon_label}, ${a.weight_lb} lb, ${a.builder} of ${a.country}, record ${a.wins}-${a.losses}.
${b.robot}: ${b.weapon_label}, ${b.weight_lb} lb, ${b.builder} of ${b.country}, record ${b.wins}-${b.losses}.

Weapon matchup: ${weapon_matchup.description}${weapon_matchup.favours ? `, edge to ${weapon_matchup.favours}` : ', close to neutral'}.
${a.weapon_label}: ${a.weapon_blurb}
${b.weapon_label}: ${b.weapon_blurb}

Model call: ${prediction.winner} at ${prediction.winner === a.robot ? prediction.prob_a : prediction.prob_b}%, confidence ${prediction.confidence}.
Dominant signal: ${dominant_signal.label}, favouring ${dominant_signal.leader}.
Projected finish: ${prediction.projected_method === 'KO' ? 'knockout' : "judges' decision"}, knockout likelihood ${prediction.ko_likelihood}%.
${prediction.confidence === 'LOW' ? '\nNOTE: confidence is LOW. The verdict beat MUST admit this openly.\n' : ''}
${liveBlock(a.robot, a)}
${liveBlock(b.robot, b)}

# FACT SHEET — the only figures you may speak

${renderFacts(sheet.facts)}

# BEAT BRIEFS

${briefs}

Write the ${BEAT_IDS.length} beats now. Every figure traceable to an id above, every id you used listed in facts_used.`;
}

/**
 * Strict structured-output schema. `strict: true` requires every property to be
 * listed in `required` and `additionalProperties: false` throughout.
 */
export const SCRIPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['beats'],
  properties: {
    beats: {
      type: 'array',
      description: `Exactly ${BEAT_IDS.length} beats in fixed order.`,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'text', 'duration_hint_ms', 'facts_used'],
        properties: {
          id: { type: 'string', enum: [...BEAT_IDS] },
          text: { type: 'string', description: 'Spoken words. No markdown, no numerals.' },
          duration_hint_ms: { type: 'integer' },
          facts_used: {
            type: 'array',
            items: { type: 'string' },
            description: 'Fact ids cited by this beat, copied exactly.',
          },
        },
      },
    },
  },
} as const;

/**
 * Repair prompt for a beat whose figures did not reconcile. Deliberately narrow:
 * fix the offending numbers, change nothing else.
 */
export function buildRepairPrompt(
  sheet: FactSheet,
  beat: { id: BeatId; text: string },
  offending: string[],
): string {
  return `One beat failed fact-checking and must be rewritten.

Beat: ${beat.id} (${BEAT_LABELS[beat.id]})
Current text: "${beat.text}"

These figures do not appear anywhere in the fact sheet and are therefore inventions: ${offending
    .map((f) => `"${f}"`)
    .join(', ')}

Rewrite this ONE beat. Remove or replace every unsupported figure with a real one from the sheet below, or drop the claim entirely and carry the sentence qualitatively. Keep the same length, energy and beat purpose. Same rules as before: spoken words only, numbers as words, no markdown, no invented statistics.

# FACT SHEET

${renderFacts(sheet.facts)}

Return JSON matching the same beats schema, containing only this one beat.`;
}
