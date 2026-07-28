'use client';

/**
 * The booth's control surface: choose a matchup by picker or by voice, then hand
 * off to <CommentaryDeck /> to do the actual calling.
 *
 * The deck is keyed on the matchup so selecting different bots gives a genuinely
 * fresh call rather than a stale script with new names on it.
 */
import { CornerDownLeft, Mic2, Swords } from 'lucide-react';
import { useCallback, useState } from 'react';

import { CommentaryDeck, HoldToTalk } from '@/components/commentary';
import { Badge, Panel, RobotPicker } from '@/components/ui';
import { parseMatchup } from '@/lib/commentary/parse';

export interface BoothClientProps {
  roster: string[];
  /** Accent colour per robot, keyed by name, for the picker swatches. */
  accents: Record<string, string>;
  initialA: string;
  initialB: string;
}

export function BoothClient({ roster, accents, initialA, initialB }: BoothClientProps) {
  const [robotA, setRobotA] = useState(initialA);
  const [robotB, setRobotB] = useState(initialB);
  const [autoStart, setAutoStart] = useState(false);
  /** Bumped to force a fresh deck when the same matchup is requested again. */
  const [generation, setGeneration] = useState(0);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);

  const pick = useCallback((side: 'a' | 'b', name: string) => {
    setAutoStart(false);
    setVoiceNote(null);
    if (side === 'a') setRobotA(name);
    else setRobotB(name);
  }, []);

  /** A spoken request both selects the bots and starts the call. */
  const onTranscript = useCallback(
    (text: string) => {
      const { robotA: a, robotB: b, matched } = parseMatchup(text, roster);
      if (a && b) {
        setRobotA(a);
        setRobotB(b);
        setAutoStart(true);
        setGeneration((g) => g + 1);
        setVoiceNote(`Heard "${text}" — calling ${a} versus ${b}.`);
        return;
      }
      if (matched.length === 1) {
        setRobotA(matched[0]);
        setVoiceNote(
          `Only caught ${matched[0]}. Name the second machine, or pick it below.`,
        );
        return;
      }
      setVoiceNote(
        `Could not match "${text}" to two robots. Try "call Tombstone against End Game", or use the pickers.`,
      );
    },
    [roster],
  );

  return (
    <div className="space-y-4">
      <Panel
        label="Matchup"
        title="Set the card"
        action={
          <Badge tone="outline" size="sm">
            {roster.length} machines
          </Badge>
        }
      >
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-start">
          <RobotPicker
            label="Red corner"
            value={robotA}
            onChange={(name) => pick('a', name)}
            options={roster}
            disabledOptions={[robotB]}
            accent={accents[robotA]}
            hint="The first machine named in the call."
          />

          <div
            className="hidden self-center pt-6 text-ink-mute md:block"
            aria-hidden="true"
          >
            <Swords className="h-5 w-5" />
          </div>

          <RobotPicker
            label="Blue corner"
            value={robotB}
            onChange={(name) => pick('b', name)}
            options={roster}
            disabledOptions={[robotA]}
            accent={accents[robotB]}
            hint="The challenger."
          />
        </div>

        <div className="mt-5 border-t border-pit-700 pt-4">
          <div className="mb-2 flex items-center gap-2">
            <Mic2 className="h-3.5 w-3.5 text-ink-mute" aria-hidden="true" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
              Or ask out loud
            </span>
          </div>

          <HoldToTalk onTranscript={onTranscript} />

          {voiceNote && (
            <p
              className="mt-2 flex items-start gap-2 text-sm text-ink-soft"
              role="status"
              aria-live="polite"
            >
              <CornerDownLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ember-light" aria-hidden="true" />
              {voiceNote}
            </p>
          )}
        </div>
      </Panel>

      <CommentaryDeck
        key={`${robotA}|${robotB}|${generation}`}
        robotA={robotA}
        robotB={robotB}
        autoStart={autoStart}
      />
    </div>
  );
}
