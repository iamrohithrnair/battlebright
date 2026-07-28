/**
 * The wire contract between the analyst route handler and the chat UI.
 *
 * Transport is NDJSON: one JSON object per line, flushed as soon as it is
 * produced. That keeps the client parser trivial (split on "\n") while still
 * letting us interleave text deltas with structured tool telemetry, which a
 * plain text stream could not express.
 */

export type ChatRole = 'user' | 'assistant';

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface AnalystRequest {
  messages: ChatTurn[];
}

/** Emitted the moment the model asks for a tool, before it has run. */
export interface ToolCallEvent {
  type: 'tool_call';
  /** Stable id so the client can pair a call with its later result. */
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/** Emitted once the tool has run, carrying a one-line telemetry summary. */
export interface ToolResultEvent {
  type: 'tool_result';
  id: string;
  name: string;
  /** Human-readable readout, e.g. `End Game 58.2% over Tombstone`. */
  summary: string;
  ms: number;
  ok: boolean;
  /** Extra structured detail the UI may surface (provenance, counts). */
  meta?: Record<string, unknown>;
}

export interface TextEvent {
  type: 'text';
  delta: string;
}

export interface DoneEvent {
  type: 'done';
  /** Number of model round-trips used, for the telemetry footer. */
  iterations: number;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  code: AnalystErrorCode;
}

export type AnalystErrorCode =
  | 'bad_request'
  | 'no_api_key'
  | 'upstream'
  | 'aborted'
  | 'internal';

export type AnalystEvent =
  | ToolCallEvent
  | ToolResultEvent
  | TextEvent
  | DoneEvent
  | ErrorEvent;

/** Serialise one event as an NDJSON line. */
export const encodeEvent = (event: AnalystEvent): string => `${JSON.stringify(event)}\n`;

const isEvent = (value: unknown): value is AnalystEvent =>
  typeof value === 'object' && value !== null && typeof (value as AnalystEvent).type === 'string';

/**
 * Incremental NDJSON parser. Chunks arrive on arbitrary byte boundaries, so the
 * trailing partial line is held back until its newline shows up.
 */
export function createEventParser() {
  let buffer = '';
  return {
    push(chunk: string): AnalystEvent[] {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      const events: AnalystEvent[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed: unknown = JSON.parse(trimmed);
          if (isEvent(parsed)) events.push(parsed);
        } catch {
          // A malformed line is never fatal — drop it and keep streaming.
        }
      }
      return events;
    },
    /** Flush anything left over when the stream closes cleanly. */
    end(): AnalystEvent[] {
      const rest = buffer.trim();
      buffer = '';
      if (!rest) return [];
      try {
        const parsed: unknown = JSON.parse(rest);
        return isEvent(parsed) ? [parsed] : [];
      } catch {
        return [];
      }
    },
  };
}

/** Only the last N turns are sent upstream, keeping token cost bounded. */
export const MAX_HISTORY_TURNS = 12;
export const MAX_MESSAGE_CHARS = 4000;
export const MAX_TOOL_ITERATIONS = 5;
export const DEFAULT_ANALYST_MODEL = 'gpt-4o-mini';
