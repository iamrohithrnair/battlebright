/**
 * Voice catalogue and per-beat delivery steering.
 *
 * Safe to import from client components: this module is pure data, so the
 * booth's voice picker and the TTS route agree on the same list by construction.
 *
 * The `instructions` parameter (gpt-4o-mini-tts only, max 4096 chars) is what
 * makes one voice sound like an analyst on the numbers and a lunatic on the
 * clash. See VOICE_NOTES.md for the doc links.
 */
import type { BeatId } from './types';

export const TTS_MODEL = 'gpt-4o-mini-tts';

/**
 * Conservative input cap. The API reference says 4096 characters while the model
 * catalogue says 2000 tokens; the docs never reconcile the two, so stay under both.
 */
export const MAX_SPEECH_CHARS = 1800;

export interface VoiceOption {
  id: string;
  /** Broadcast-desk name shown in the UI. */
  name: string;
  blurb: string;
}

/**
 * A curated six from the thirteen voices available on gpt-4o-mini-tts. `ash` is
 * the default: it is the punchiest of the set, which is what an arena caller
 * needs. `marin` and `cedar` are OpenAI's own quality recommendations.
 */
export const VOICES: VoiceOption[] = [
  { id: 'ash', name: 'Ringside', blurb: 'Punchy, high-energy play-by-play' },
  { id: 'onyx', name: 'Desk', blurb: 'Deep and authoritative' },
  { id: 'marin', name: 'Studio', blurb: 'Highest fidelity, crisp diction' },
  { id: 'cedar', name: 'Analyst', blurb: 'Warm, measured, explanatory' },
  { id: 'ballad', name: 'Headline', blurb: 'Dramatic, film-trailer weight' },
  { id: 'sage', name: 'Pit Reporter', blurb: 'Bright and quick' },
];

export const DEFAULT_VOICE = 'ash';

export const isKnownVoice = (voice: string): boolean => VOICES.some((v) => v.id === voice);

export const voiceName = (voice: string): string =>
  VOICES.find((v) => v.id === voice)?.name ?? voice;

/** Shared house style, prepended to every per-beat instruction. */
const HOUSE_STYLE =
  'You are the lead broadcast caller for "You Want More?", a combat-robotics show. ' +
  'Voice: professional arena fight-caller. Consonants are punchy and clipped, never mumbled. ' +
  'Numbers and robot names are enunciated clearly enough to be understood over crowd noise. ' +
  'Never sound like a text-to-speech read-through.';

/**
 * Per-beat delivery. The arc is deliberate: measured and credible through the
 * analysis, winding up into the clash, then landing the verdict with authority.
 */
export const BEAT_DELIVERY: Record<BeatId, string> = {
  intro:
    `${HOUSE_STYLE} Delivery: big arena introduction. Confident and welcoming, building ` +
    'anticipation. Moderate pace with a lift on each robot name, as though gesturing to ' +
    'each machine in turn. Warm but commanding.',

  tale_of_the_tape:
    `${HOUSE_STYLE} Delivery: analytical and authoritative — this is the numbers segment. ` +
    'Slow down noticeably. Even, deliberate pacing with a clear beat between each statistic ' +
    'so every figure lands. Credible expert at the broadcast desk, not hyped. Slight ' +
    'emphasis on the standout number.',

  prediction:
    `${HOUSE_STYLE} Delivery: measured certainty. Speak like an expert committing to a call ` +
    'on air and owning it. Steady, grounded pace with weight on the probability and the ' +
    'confidence level. Firm, not shouty. A small pause before naming the favourite.',

  clash:
    `${HOUSE_STYLE} Delivery: EXPLOSIVE. This is the moment of impact — the loudest, fastest ` +
    'point of the whole call. Rapid-fire, rising pitch, urgent and breathless, riding over a ' +
    'roaring crowd. Hard emphasis on impact words. Let the excitement genuinely break through.',

  finish:
    `${HOUSE_STYLE} Delivery: high energy coming down off the clash but still charged. ` +
    'Decisive and emphatic on how the fight ends, with a punch on the finishing word. ' +
    'Slightly quicker than conversational, tightening toward the end.',

  verdict:
    `${HOUSE_STYLE} Delivery: authoritative wrap-up. Settle back down to a calm, credible ` +
    'sign-off pace. Confident and conclusive. If the line admits uncertainty, deliver that ' +
    'part with genuine candour rather than glossing over it — honest, not hedging.',
};

/** Falls back to the analytical instruction for anything unrecognised. */
export const deliveryFor = (beat: string): string =>
  BEAT_DELIVERY[beat as BeatId] ?? BEAT_DELIVERY.tale_of_the_tape;
