'use client';

/**
 * Hold-to-talk matchup request: "call Tombstone against End Game".
 *
 * Prefers the browser's own SpeechRecognition — no round-trip of ours, interim
 * results as you speak, no cost. Firefox still ships it disabled by default and
 * Safari's support is partial, so where it is missing we record with
 * MediaRecorder and post the clip to /api/commentary/transcribe. If neither is
 * available the button is not rendered at all and the typed pickers remain the
 * only path, which is why they are always present.
 *
 * The microphone is requested only on an explicit press, and the recording state
 * is unmistakable.
 */
import { Loader2, Mic, MicOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/cn';

/* SpeechRecognition is not in the standard DOM typings; declare what we use. */
interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: RecognitionAlternative;
}
interface RecognitionResultList {
  readonly length: number;
  [index: number]: RecognitionResult;
}
interface RecognitionEvent {
  resultIndex: number;
  results: RecognitionResultList;
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => RecognitionLike;

type Support = 'unknown' | 'browser' | 'server' | 'none';
type State = 'idle' | 'listening' | 'transcribing' | 'error';

export interface HoldToTalkProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export function HoldToTalk({ onTranscript, disabled = false, className }: HoldToTalkProps) {
  const [support, setSupport] = useState<Support>('unknown');
  const [state, setState] = useState<State>('idle');
  const [heard, setHeard] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const recognitionRef = useRef<RecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const finalRef = useRef('');
  const abortRef = useRef<AbortController | null>(null);

  /* Feature-detect once on the client — never assume. */
  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: RecognitionCtor;
      webkitSpeechRecognition?: RecognitionCtor;
    };
    if (w.SpeechRecognition ?? w.webkitSpeechRecognition) {
      setSupport('browser');
    } else if (
      typeof window.MediaRecorder !== 'undefined' &&
      navigator.mediaDevices?.getUserMedia
    ) {
      setSupport('server');
    } else {
      setSupport('none');
    }
  }, []);

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      abortRef.current?.abort();
      releaseMic();
    },
    [releaseMic],
  );

  /* ------------------------------------------------------------- browser path */

  const startBrowser = useCallback(() => {
    const w = window as unknown as {
      SpeechRecognition?: RecognitionCtor;
      webkitSpeechRecognition?: RecognitionCtor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    finalRef.current = '';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) finalRef.current += ` ${text}`;
        else interim += text;
      }
      setHeard(`${finalRef.current} ${interim}`.trim());
    };

    recognition.onerror = (event) => {
      setState('error');
      setMessage(
        event.error === 'not-allowed'
          ? 'Microphone permission was denied. Use the pickers instead.'
          : 'Could not hear that. Try again, or use the pickers.',
      );
      releaseMic();
    };

    recognition.onend = () => {
      const text = finalRef.current.trim() || heard.trim();
      recognitionRef.current = null;
      setState((prev) => (prev === 'error' ? prev : 'idle'));
      if (text) onTranscript(text);
    };

    recognitionRef.current = recognition;
    setMessage(null);
    setHeard('');
    setState('listening');
    try {
      recognition.start();
    } catch {
      setState('error');
      setMessage('Could not start the microphone.');
    }
  }, [heard, onTranscript, releaseMic]);

  /* -------------------------------------------------------------- server path */

  const startServer = useCallback(async () => {
    try {
      setMessage(null);
      setHeard('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        releaseMic();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (!blob.size) {
          setState('idle');
          return;
        }
        setState('transcribing');
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          const form = new FormData();
          form.append('audio', blob, 'clip.webm');
          const res = await fetch('/api/commentary/transcribe', {
            method: 'POST',
            body: form,
            signal: controller.signal,
          });
          const body = (await res.json()) as { text?: string; message?: string };
          if (!res.ok) throw new Error(body.message ?? 'Transcription failed.');
          setState('idle');
          if (body.text?.trim()) {
            setHeard(body.text.trim());
            onTranscript(body.text.trim());
          } else {
            setMessage('Nothing was recognised. Try again.');
          }
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
          setState('error');
          setMessage((e as Error).message);
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setState('listening');
    } catch {
      setState('error');
      setMessage('Microphone permission was denied. Use the pickers instead.');
      releaseMic();
    }
  }, [onTranscript, releaseMic]);

  const start = useCallback(() => {
    if (disabled || state === 'listening' || state === 'transcribing') return;
    if (support === 'browser') startBrowser();
    else if (support === 'server') void startServer();
  }, [disabled, startBrowser, startServer, state, support]);

  const stop = useCallback(() => {
    if (state !== 'listening') return;
    if (support === 'browser') {
      recognitionRef.current?.stop();
    } else if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  }, [state, support]);

  if (support === 'none' || support === 'unknown') {
    // Nothing to offer: the typed pickers are always available, so stay silent
    // rather than showing a control that cannot work.
    return null;
  }

  const listening = state === 'listening';
  const busy = state === 'transcribing';

  return (
    <div className={cn('space-y-2', className)}>
      <button
        type="button"
        disabled={disabled || busy}
        onPointerDown={(e) => {
          e.preventDefault();
          start();
        }}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        // Keyboard users get a toggle, since there is no key-hold equivalent.
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (listening) stop();
            else start();
          }
        }}
        aria-pressed={listening}
        aria-label={
          listening ? 'Stop listening and use what was heard' : 'Hold to name a matchup out loud'
        }
        className={cn(
          'inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 border px-4 font-mono text-xs uppercase tracking-[0.16em] transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-pit-950',
          listening
            ? 'animate-pulse-ring border-ember bg-ember/20 text-ember-light'
            : 'border-pit-500 bg-pit-800 text-ink-soft hover:border-volt/60 hover:text-ink',
          (disabled || busy) && 'cursor-not-allowed opacity-60',
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : listening ? (
          <Mic className="h-4 w-4" aria-hidden="true" />
        ) : (
          <MicOff className="h-4 w-4" aria-hidden="true" />
        )}
        {busy ? 'Transcribing' : listening ? 'Listening — release to send' : 'Hold to talk'}
      </button>

      <p className="text-xs text-ink-mute" aria-live="polite">
        {message ??
          (heard
            ? `Heard: "${heard}"`
            : listening
              ? 'Say something like "call Tombstone against End Game".'
              : support === 'server'
                ? 'Voice input records a short clip and transcribes it on the server.'
                : 'Voice input uses your browser\u2019s own speech recognition.')}
      </p>
    </div>
  );
}
