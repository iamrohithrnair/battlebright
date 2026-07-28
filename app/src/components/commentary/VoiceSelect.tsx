'use client';

/**
 * Voice picker. Six curated voices from the thirteen available on
 * gpt-4o-mini-tts, renamed to broadcast-desk roles so the choice means something
 * to the user rather than being an opaque model id.
 */
import { Radio } from 'lucide-react';

import { cn } from '@/lib/cn';
import { VOICES } from '@/lib/commentary/voice';

export interface VoiceSelectProps {
  value: string;
  onChange: (voice: string) => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceSelect({ value, onChange, disabled = false, className }: VoiceSelectProps) {
  const active = VOICES.find((v) => v.id === value);

  return (
    <div className={cn('min-w-0', className)}>
      <label
        htmlFor="commentary-voice"
        className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute"
      >
        <Radio className="h-3 w-3" aria-hidden="true" />
        Caller voice
      </label>
      <select
        id="commentary-voice"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby="commentary-voice-hint"
        className={cn(
          'min-h-[44px] w-full cursor-pointer appearance-none border border-pit-500 bg-pit-800 px-3 pr-8 font-mono text-sm text-ink transition-colors duration-200',
          'hover:border-volt/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-pit-950',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        {VOICES.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name} — {v.blurb}
          </option>
        ))}
      </select>
      <p id="commentary-voice-hint" className="mt-1 text-xs text-ink-mute">
        {active ? active.blurb : 'Choose a broadcast voice.'}
      </p>
    </div>
  );
}
