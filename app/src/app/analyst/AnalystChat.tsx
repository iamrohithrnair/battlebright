'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  BrainCircuit,
  CircleAlert,
  CornerDownLeft,
  Cpu,
  Satellite,
  Send,
  Square,
  Terminal,
  Trash2,
  User,
} from 'lucide-react';

import { Panel } from '@/components/ui/Panel';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { cn } from '@/lib/cn';
import { createEventParser, type AnalystEvent, type ChatTurn } from '@/lib/analyst/protocol';

import { Markdown } from './Markdown';
import { ToolTrace, type TraceEntry } from './ToolTrace';
import { Badge, Skeleton } from './local-ui';

interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  trace: TraceEntry[];
  error?: string;
  /** Set once the stream for this turn has finished. */
  closed: boolean;
}

const STARTERS = [
  'Who wins Tombstone vs End Game and why?',
  'Which weapon class is overrated?',
  'Scout Riptide for me',
  "Scrape Minotaur's wiki page and check it against our data",
  'Simulate an 8-bot tournament of the top seeds',
];

const newId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function AnalystChat({ configured, model }: { configured: boolean; model: string }) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Auto-scroll only while the user is already at the bottom.
  const pinnedRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = logRef.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduced ? 'smooth' : 'auto' });
  }, []);

  const handleScroll = useCallback(() => {
    const el = logRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
    pinnedRef.current = atBottom;
    setShowJump(!atBottom && el.scrollHeight > el.clientHeight + 120);
  }, []);

  useEffect(() => {
    if (pinnedRef.current) scrollToBottom(false);
  }, [messages, scrollToBottom]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const patchLast = useCallback((update: (m: UiMessage) => UiMessage) => {
    setMessages((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      next[next.length - 1] = update(next[next.length - 1]);
      return next;
    });
  }, []);

  const send = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || streaming) return;

      const history: ChatTurn[] = [
        ...messages.filter((m) => !m.error && m.content.trim()).map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: text },
      ];

      setInput('');
      pinnedRef.current = true;
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: 'user', content: text, trace: [], closed: true },
        { id: newId(), role: 'assistant', content: '', trace: [], closed: false },
      ]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/analyst', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history }),
          signal: controller.signal,
        });

        if (!res.body) throw new Error('The analyst returned an empty stream.');

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        const parser = createEventParser();

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          for (const event of parser.push(value)) applyEvent(event, patchLast);
        }
        for (const event of parser.end()) applyEvent(event, patchLast);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          const message = (e as Error).message || 'The analyst connection dropped.';
          patchLast((m) => ({ ...m, error: message }));
        }
      } finally {
        abortRef.current = null;
        setStreaming(false);
        patchLast((m) => ({ ...m, closed: true }));
      }
    },
    [messages, patchLast, streaming],
  );

  const stop = () => abortRef.current?.abort();

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  };

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {!configured ? (
        <Panel className="border-ember/40">
          <div className="flex items-start gap-3">
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-ember" />
            <div className="min-w-0">
              <p className="font-display text-base font-semibold text-ink">Analyst offline</p>
              <p className="mt-1 text-base text-ink-soft">
                <code className="font-mono text-sm text-ember-light">OPENAI_API_KEY</code> is not configured on the
                server, so the language model is unreachable. The prediction engine, leaderboard and live collection
                elsewhere in the app are unaffected.
              </p>
            </div>
          </div>
        </Panel>
      ) : null}

      <Panel
        flush
        label="Channel"
        title="Analyst terminal"
        action={
          <>
            <Badge tone={streaming ? 'accent' : 'data'} icon={<Cpu className="h-3 w-3" />}>
              {streaming ? 'Streaming' : model}
            </Badge>
            {messages.length ? (
              <button
                type="button"
                onClick={() => {
                  stop();
                  setMessages([]);
                }}
                aria-label="Clear conversation"
                title="Clear conversation"
                className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded border border-pit-600 text-ink-mute transition-colors duration-200 hover:border-pit-500 hover:text-ink"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
          </>
        }
      >
        <div className="relative">
          <div
            ref={logRef}
            onScroll={handleScroll}
            role="log"
            aria-live="polite"
            aria-atomic="false"
            aria-label="Analyst conversation"
            className="max-h-[min(62vh,620px)] min-h-[320px] overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
          >
            {empty ? <EmptyState /> : null}

            <div className="space-y-5">
              {messages.map((message) => (
                <MessageBlock key={message.id} message={message} streaming={streaming} />
              ))}
            </div>
          </div>

          {showJump ? (
            <button
              type="button"
              onClick={() => {
                pinnedRef.current = true;
                scrollToBottom();
              }}
              aria-label="Jump to newest message"
              className="absolute bottom-3 right-4 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-volt/50 bg-pit-850 text-volt-light shadow-volt transition-colors duration-200 hover:bg-pit-800"
            >
              <ArrowDown aria-hidden="true" className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="border-t border-pit-600 p-4 sm:p-5">
          {empty ? (
            <div className="mb-4">
              <SectionLabel className="mb-2">Suggested queries</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    disabled={streaming}
                    onClick={() => void send(starter)}
                    className="inline-flex min-h-11 cursor-pointer items-center rounded border border-pit-600 bg-pit-850 px-3 py-2 text-left text-[15px] text-ink-soft transition-colors duration-200 hover:border-volt/50 hover:bg-pit-800 hover:text-ink disabled:hover:border-pit-600"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
          >
            <div className="min-w-0 flex-1">
              <label htmlFor="analyst-input" className="sr-only">
                Ask the BattleBots analyst a question
              </label>
              <textarea
                id="analyst-input"
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
                rows={2}
                maxLength={2000}
                placeholder="Ask about a matchup, a weapon class, or a live wiki check…"
                className="w-full resize-y rounded border border-pit-600 bg-pit-950 px-3 py-2.5 text-base text-ink placeholder:text-ink-mute transition-colors duration-200 focus:border-volt/60 focus:outline-none"
              />
              <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[11px] text-ink-mute">
                <CornerDownLeft aria-hidden="true" className="h-3 w-3" />
                Enter to send · Shift+Enter for a new line
              </p>
            </div>

            <div className="flex gap-2">
              {streaming ? (
                <button
                  type="button"
                  onClick={stop}
                  className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded border border-lose/50 bg-lose/10 px-4 font-mono text-sm uppercase tracking-[0.12em] text-lose transition-colors duration-200 hover:bg-lose/20 sm:flex-none"
                >
                  <Square aria-hidden="true" className="h-3.5 w-3.5" />
                  Stop
                </button>
              ) : null}
              <button
                type="submit"
                disabled={streaming || !input.trim()}
                className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded border border-ember bg-ember/15 px-4 font-mono text-sm font-medium uppercase tracking-[0.12em] text-ember-light transition-colors duration-200 hover:bg-ember/25 disabled:hover:bg-ember/15 sm:flex-none"
              >
                <Send aria-hidden="true" className="h-3.5 w-3.5" />
                Send
              </button>
            </div>
          </form>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function applyEvent(event: AnalystEvent, patchLast: (update: (m: UiMessage) => UiMessage) => void) {
  switch (event.type) {
    case 'text':
      patchLast((m) => ({ ...m, content: m.content + event.delta }));
      break;
    case 'tool_call':
      patchLast((m) => ({
        ...m,
        trace: [...m.trace, { id: event.id, name: event.name, args: event.args }],
      }));
      break;
    case 'tool_result':
      patchLast((m) => ({
        ...m,
        trace: m.trace.map((entry) =>
          entry.id === event.id && entry.summary === undefined
            ? { ...entry, summary: event.summary, ms: event.ms, ok: event.ok, meta: event.meta }
            : entry,
        ),
      }));
      break;
    case 'error':
      patchLast((m) => ({ ...m, error: event.message, closed: true }));
      break;
    case 'done':
      patchLast((m) => ({ ...m, closed: true }));
      break;
  }
}

function MessageBlock({ message, streaming }: { message: UiMessage; streaming: boolean }) {
  if (message.role === 'user') {
    return (
      <article className="animate-rise flex justify-end gap-3">
        <div className="max-w-[85ch] rounded border border-volt/30 bg-volt/[0.07] px-3.5 py-2.5">
          <p className="whitespace-pre-wrap break-words text-base text-ink">{message.content}</p>
        </div>
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-pit-600 bg-pit-850 text-ink-mute"
        >
          <User className="h-4 w-4" />
        </span>
      </article>
    );
  }

  const live = streaming && !message.closed;
  const waiting = live && !message.content && !message.trace.length;

  return (
    <article className="animate-rise flex gap-3">
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border bg-pit-850',
          live ? 'border-ember/50 text-ember' : 'border-volt/40 text-volt',
        )}
      >
        <BrainCircuit className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1 space-y-3">
        {message.trace.length ? <ToolTrace entries={message.trace} live={live} /> : null}

        {waiting ? (
          <div className="space-y-2" aria-hidden="true">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : null}

        {live && !message.content && message.trace.length ? (
          <p className="flex items-center gap-2 font-mono text-[13px] text-ember">
            <Satellite aria-hidden="true" className="h-3.5 w-3.5" />
            Running tools…
          </p>
        ) : null}

        {message.content ? (
          <>
            <Markdown text={message.content} />
            {live ? (
              <span
                aria-hidden="true"
                className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-ember"
              />
            ) : null}
          </>
        ) : null}

        {message.error ? (
          <p className="flex items-start gap-2 rounded border border-lose/40 bg-lose/10 px-3 py-2 text-base text-lose">
            <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0">{message.error}</span>
          </p>
        ) : null}

        {!live && !message.content && !message.error ? (
          <p className="font-mono text-[13px] text-ink-mute">Stopped before an answer was produced.</p>
        ) : null}
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-2xl py-6 text-center">
      <span
        aria-hidden="true"
        className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded border border-volt/40 bg-pit-850 text-volt"
      >
        <Terminal className="h-5 w-5" />
      </span>
      <h2 className="mt-4 font-display text-lg font-semibold text-ink">Analyst standing by</h2>
      <p className="mx-auto mt-2 max-w-prose text-base text-ink-soft">
        Ask anything about the 42-robot roster and 66 recorded fights. Every number comes back from a tool call against
        the prediction engine — never from the model&apos;s memory — and the trace of those calls is printed with each
        answer.
      </p>
      <ul className="mx-auto mt-4 grid gap-2 text-left sm:grid-cols-2">
        {[
          ['Matchups', 'Probabilities, confidence and the signal that drove them'],
          ['Meta', 'Weapon-class win rates and where the model is overrated'],
          ['Scouting', 'Strengths, weaknesses, best and worst matchups'],
          ['Live collection', "Pull a robot's wiki page through Bright Data and diff it"],
        ].map(([title, blurb]) => (
          <li key={title} className="rounded border border-pit-700 bg-pit-900/60 px-3 py-2">
            <p className="label-mono">{title}</p>
            <p className="mt-1 text-[15px] text-ink-soft">{blurb}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
