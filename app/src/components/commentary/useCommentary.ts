'use client';

/**
 * The broadcast engine behind <CommentaryDeck />.
 *
 * Owns everything stateful and messy so the components can stay declarative:
 * script fetching, per-beat synthesis with look-ahead prefetch, the audio
 * element and Web Audio graph, beat advancement, and teardown.
 *
 * Two design rules drive the whole thing:
 *   1. A failure never dead-ends. A beat whose audio won't synthesise is marked
 *      and skipped; if voice is unavailable entirely the deck falls back to a
 *      timed transcript so the feature still works with sound off.
 *   2. Nothing leaks. Object URLs are revoked, fetches aborted, timers cleared
 *      and the AudioContext closed on unmount or on any re-call.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CommentaryBeat, CommentaryScript } from '@/lib/commentary/types';
import { DEFAULT_VOICE } from '@/lib/commentary/voice';

export type Phase = 'idle' | 'scripting' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';

export type BeatAudioState = 'idle' | 'loading' | 'ready' | 'error';

/** Why voice output is unavailable, when it is. */
export interface VoiceStatus {
  available: boolean;
  reason: string | null;
}

export interface UseCommentaryOptions {
  robotA: string;
  robotB: string;
  autoStart?: boolean;
}

const SPEAK_URL = '/api/commentary/speak';
const SCRIPT_URL = '/api/commentary/script';

export function useCommentary({ robotA, robotB, autoStart = false }: UseCommentaryOptions) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [script, setScript] = useState<CommentaryScript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [beatProgress, setBeatProgress] = useState(0);
  const [audioState, setAudioState] = useState<Record<number, BeatAudioState>>({});
  const [voice, setVoice] = useState(DEFAULT_VOICE);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [transcriptOnly, setTranscriptOnly] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>({ available: true, reason: null });
  const [announcement, setAnnouncement] = useState('');

  /* ------------------------------------------------------------------ refs */

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  /** Object URLs per beat index, so replays never re-synthesise. */
  const urlsRef = useRef<Map<number, string>>(new Map());
  const scriptAbortRef = useRef<AbortController | null>(null);
  const speakAbortsRef = useRef<Set<AbortController>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  /** Text-mode progress bookkeeping. */
  const textStartRef = useRef<number>(0);
  const scriptRef = useRef<CommentaryScript | null>(null);
  const activeRef = useRef(0);
  const mountedRef = useRef(true);

  scriptRef.current = script;
  activeRef.current = activeIndex;

  const beats = useMemo(() => script?.beats ?? [], [script]);

  /* --------------------------------------------------------------- teardown */

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const revokeAll = useCallback(() => {
    for (const url of urlsRef.current.values()) URL.revokeObjectURL(url);
    urlsRef.current.clear();
  }, []);

  const abortSpeech = useCallback(() => {
    for (const controller of speakAbortsRef.current) controller.abort();
    speakAbortsRef.current.clear();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
      abortSpeech();
      scriptAbortRef.current?.abort();
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      revokeAll();
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      void ctxRef.current?.close().catch(() => {
        // Already closed, or never opened.
      });
      ctxRef.current = null;
    };
  }, [abortSpeech, clearTimer, revokeAll]);

  /* ------------------------------------------------------ audio element/graph */

  /** Created lazily: constructing an AudioContext before a gesture gets it suspended. */
  const ensureAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'auto';
      audioRef.current = audio;
    }
    const audio = audioRef.current;
    audio.volume = muted ? 0 : volume;

    if (!ctxRef.current) {
      try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctor) {
          const ctx = new Ctor();
          const node = ctx.createAnalyser();
          node.fftSize = 256;
          node.smoothingTimeConstant = 0.75;
          // createMediaElementSource may only be called once per element, so this
          // graph is built exactly once and reused for every beat.
          const source = ctx.createMediaElementSource(audio);
          source.connect(node);
          node.connect(ctx.destination);
          ctxRef.current = ctx;
          analyserRef.current = node;
          sourceRef.current = source;
          setAnalyser(node);
        }
      } catch {
        // No Web Audio: playback still works, we just lose the visualiser.
        analyserRef.current = null;
      }
    }
    void ctxRef.current?.resume().catch(() => {
      // Resume is best-effort; a suspended context only costs the visualiser.
    });
    return audio;
  }, [muted, volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [muted, volume]);

  /* -------------------------------------------------------------- synthesis */

  const markAudio = useCallback((index: number, state: BeatAudioState) => {
    setAudioState((prev) => (prev[index] === state ? prev : { ...prev, [index]: state }));
  }, []);

  /**
   * Fetch (or reuse) the audio for one beat. Resolves to null when voice is
   * unavailable — callers treat that as "fall back to text", never as a crash.
   */
  const synthesise = useCallback(
    async (index: number): Promise<string | null> => {
      const existing = urlsRef.current.get(index);
      if (existing) return existing;

      const beat = scriptRef.current?.beats[index];
      if (!beat) return null;

      const controller = new AbortController();
      speakAbortsRef.current.add(controller);
      markAudio(index, 'loading');

      try {
        const res = await fetch(SPEAK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: beat.text, voice, beat: beat.id }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
          // A missing key or entitlement is permanent for this session: stop
          // asking and switch the whole deck to transcript mode.
          if (body?.code === 'no_api_key' || body?.code === 'no_model_access') {
            if (mountedRef.current) {
              setVoiceStatus({ available: false, reason: body.message ?? 'Voice synthesis is unavailable.' });
              setTranscriptOnly(true);
            }
          }
          throw new Error(body?.message ?? `Synthesis failed (${res.status}).`);
        }

        const blob = await res.blob();
        if (!blob.size) throw new Error('The voice returned an empty clip.');
        const url = URL.createObjectURL(blob);

        if (!mountedRef.current) {
          URL.revokeObjectURL(url);
          return null;
        }
        urlsRef.current.set(index, url);
        markAudio(index, 'ready');
        return url;
      } catch (e) {
        if ((e as Error).name !== 'AbortError' && mountedRef.current) markAudio(index, 'error');
        return null;
      } finally {
        speakAbortsRef.current.delete(controller);
      }
    },
    [markAudio, voice],
  );

  /* --------------------------------------------------------------- playback */

  const stopPlayback = useCallback(() => {
    clearTimer();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [clearTimer]);

  /** Text-mode: advance on a timer and drive the progress bar with rAF. */
  const runTextBeat = useCallback(
    (index: number, onDone: () => void) => {
      const beat = scriptRef.current?.beats[index];
      if (!beat) return;
      textStartRef.current = Date.now();
      const duration = beat.duration_hint_ms;

      const tick = () => {
        if (!mountedRef.current) return;
        const elapsed = Date.now() - textStartRef.current;
        setBeatProgress(Math.min(1, elapsed / duration));
        if (elapsed < duration) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      timerRef.current = setTimeout(onDone, duration);
    },
    [],
  );

  const playFrom = useCallback(
    async (index: number) => {
      const current = scriptRef.current;
      if (!current || index >= current.beats.length) {
        if (mountedRef.current) {
          setPhase('ended');
          setBeatProgress(1);
          setAnnouncement('Commentary complete.');
        }
        return;
      }

      clearTimer();
      setActiveIndex(index);
      setBeatProgress(0);
      setPhase('playing');
      const beat = current.beats[index];
      setAnnouncement(`Beat ${index + 1} of ${current.beats.length}: ${beat.label}`);

      const advance = () => {
        if (mountedRef.current) void playFrom(index + 1);
      };

      if (transcriptOnly || !voiceStatus.available) {
        runTextBeat(index, advance);
        return;
      }

      const audio = ensureAudio();
      const url = await synthesise(index);
      if (!mountedRef.current || activeRef.current !== index) return;

      if (!url) {
        // Per-beat synthesis failure: read this beat as text and carry on rather
        // than stranding the audience on a broken beat.
        runTextBeat(index, advance);
        return;
      }

      audio.src = url;
      try {
        await audio.play();
      } catch {
        // Autoplay blocked or decode failure — degrade to the timed transcript.
        if (mountedRef.current && activeRef.current === index) runTextBeat(index, advance);
        return;
      }

      // Warm the next beat while this one plays, so transitions are seamless.
      if (index + 1 < current.beats.length) void synthesise(index + 1);
    },
    [clearTimer, ensureAudio, runTextBeat, synthesise, transcriptOnly, voiceStatus.available],
  );

  /** Wire element events once the element exists. */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      if (audio.duration > 0) setBeatProgress(Math.min(1, audio.currentTime / audio.duration));
    };
    const onEnded = () => {
      void playFrom(activeRef.current + 1);
    };
    const onError = () => {
      markAudio(activeRef.current, 'error');
      void playFrom(activeRef.current + 1);
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
    // audioRef is populated by ensureAudio(); re-run when playback begins.
  }, [markAudio, phase, playFrom]);

  /* ----------------------------------------------------------------- script */

  const call = useCallback(
    async (a = robotA, b = robotB, { start = true }: { start?: boolean } = {}) => {
      if (!a || !b || a === b) {
        setError('Pick two different machines.');
        setPhase('error');
        return;
      }

      scriptAbortRef.current?.abort();
      abortSpeech();
      stopPlayback();
      revokeAll();
      setAudioState({});
      setScript(null);
      setError(null);
      setActiveIndex(0);
      setBeatProgress(0);
      setPhase('scripting');
      setAnnouncement(`Building the fact sheet for ${a} versus ${b}.`);

      const controller = new AbortController();
      scriptAbortRef.current = controller;

      try {
        const res = await fetch(SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ robot_a: a, robot_b: b }),
          signal: controller.signal,
        });
        const body: unknown = await res.json();
        if (!res.ok) {
          throw new Error((body as { message?: string })?.message ?? `Script generation failed (${res.status}).`);
        }
        if (!mountedRef.current) return;

        const next = body as CommentaryScript;
        scriptRef.current = next;
        setScript(next);
        setPhase('ready');
        setAnnouncement(`Script ready. ${next.beats.length} beats for ${a} versus ${b}.`);
        if (start) await playFrom(0);
      } catch (e) {
        if ((e as Error).name === 'AbortError' || !mountedRef.current) return;
        setError((e as Error).message);
        setPhase('error');
        setAnnouncement('Commentary could not be generated.');
      }
    },
    [abortSpeech, playFrom, revokeAll, robotA, robotB, stopPlayback],
  );

  /* ---------------------------------------------------------------- controls */

  const pause = useCallback(() => {
    clearTimer();
    audioRef.current?.pause();
    setPhase('paused');
    setAnnouncement('Paused.');
  }, [clearTimer]);

  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (audio?.src && !transcriptOnly && voiceStatus.available) {
      void audio.play().catch(() => void playFrom(activeRef.current));
      setPhase('playing');
      setAnnouncement('Resumed.');
      return;
    }
    void playFrom(activeRef.current);
  }, [playFrom, transcriptOnly, voiceStatus.available]);

  const stop = useCallback(() => {
    stopPlayback();
    setActiveIndex(0);
    setBeatProgress(0);
    setPhase(scriptRef.current ? 'ready' : 'idle');
    setAnnouncement('Stopped.');
  }, [stopPlayback]);

  const skip = useCallback(() => {
    stopPlayback();
    void playFrom(activeRef.current + 1);
  }, [playFrom, stopPlayback]);

  const previous = useCallback(() => {
    stopPlayback();
    void playFrom(Math.max(0, activeRef.current - 1));
  }, [playFrom, stopPlayback]);

  const goTo = useCallback(
    (index: number) => {
      stopPlayback();
      void playFrom(index);
    },
    [playFrom, stopPlayback],
  );

  const replay = useCallback(() => {
    stopPlayback();
    void playFrom(0);
  }, [playFrom, stopPlayback]);

  /** Changing voice invalidates every cached clip. */
  const changeVoice = useCallback(
    (next: string) => {
      const wasPlaying = phase === 'playing';
      stopPlayback();
      abortSpeech();
      revokeAll();
      setAudioState({});
      setVoice(next);
      if (wasPlaying) {
        // playFrom reads `voice` through the closure, so defer a tick.
        setPhase('paused');
      }
    },
    [abortSpeech, phase, revokeAll, stopPlayback],
  );

  const toggleTranscriptOnly = useCallback(() => {
    stopPlayback();
    setTranscriptOnly((prev) => !prev);
    setPhase(scriptRef.current ? 'ready' : 'idle');
  }, [stopPlayback]);

  /* ------------------------------------------------------------- preflight */

  useEffect(() => {
    let cancelled = false;
    fetch(SPEAK_URL, { method: 'GET' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { configured?: boolean } | null) => {
        if (cancelled || !body) return;
        if (body.configured === false) {
          setVoiceStatus({
            available: false,
            reason: 'No OpenAI key is configured on the server, so commentary cannot be spoken. The written transcript is fully available.',
          });
          setTranscriptOnly(true);
        }
      })
      .catch(() => {
        // Probe failure is not itself a reason to disable voice; the first
        // synthesis attempt will report the real problem.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startedRef = useRef(false);
  useEffect(() => {
    if (!autoStart || startedRef.current || !robotA || !robotB) return;
    startedRef.current = true;
    void call(robotA, robotB, { start: true });
  }, [autoStart, call, robotA, robotB]);

  /* ----------------------------------------------------------------- derived */

  const activeBeat: CommentaryBeat | null = beats[activeIndex] ?? null;
  const isBusy = phase === 'scripting';
  const isPlaying = phase === 'playing';
  const overallProgress = beats.length
    ? Math.min(1, (activeIndex + beatProgress) / beats.length)
    : 0;

  return {
    // state
    phase,
    script,
    beats,
    error,
    activeIndex,
    activeBeat,
    beatProgress,
    overallProgress,
    audioState,
    voice,
    volume,
    muted,
    transcriptOnly,
    voiceStatus,
    announcement,
    analyser,
    isBusy,
    isPlaying,
    // actions
    call,
    play: resume,
    pause,
    stop,
    skip,
    previous,
    goTo,
    replay,
    changeVoice,
    setVolume,
    setMuted,
    toggleTranscriptOnly,
  };
}

export type CommentaryEngine = ReturnType<typeof useCommentary>;
