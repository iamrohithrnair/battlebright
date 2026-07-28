/**
 * The agent loop — SERVER ONLY.
 *
 * Drives the full call-model → run-tools → feed-results-back cycle and yields a
 * flat stream of protocol events. Text deltas are forwarded the instant they
 * arrive; tool telemetry is emitted twice per call (once on request, once on
 * completion) so the UI can render a live trace rather than a post-hoc log.
 *
 * The loop is hard-capped. On the final permitted iteration tools are switched
 * off, which forces the model to produce prose instead of looping forever.
 */
import { OpenAI } from 'openai';

import {
  DEFAULT_ANALYST_MODEL,
  MAX_HISTORY_TURNS,
  MAX_MESSAGE_CHARS,
  MAX_TOOL_ITERATIONS,
  type AnalystEvent,
  type ChatTurn,
} from './protocol';
import { SYSTEM_PROMPT } from './prompt';
import { TOOL_DEFINITIONS, executeTool } from './tools';

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export class AnalystConfigError extends Error {}

/**
 * `gpt-4o-mini` is the intended model. `OPENAI_MODEL` overrides it so a
 * deployment whose key is scoped to a different family still works.
 */
export const analystModel = () => process.env.OPENAI_MODEL?.trim() || DEFAULT_ANALYST_MODEL;

/**
 * The reasoning-model families reject `max_tokens` and a custom `temperature`,
 * while the 4o family requires `max_tokens`. Pick per model so one env override
 * cannot break the request.
 */
function tuning(model: string) {
  const reasoning = /^(?:o\d|gpt-5)/.test(model);
  return reasoning
    ? { max_completion_tokens: 2400 }
    : { max_tokens: 900, temperature: 0.3 };
}

/** Streaming tool calls arrive as fragments keyed by index; accumulate them. */
interface PartialCall {
  id: string;
  name: string;
  args: string;
}

export interface RunOptions {
  messages: ChatTurn[];
  signal?: AbortSignal;
}

export function trimHistory(messages: ChatTurn[]): ChatTurn[] {
  return messages.slice(-MAX_HISTORY_TURNS).map((m) => ({
    role: m.role,
    content: m.content.slice(0, MAX_MESSAGE_CHARS),
  }));
}

export async function* runAnalyst({ messages, signal }: RunOptions): AsyncGenerator<AnalystEvent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AnalystConfigError('OPENAI_API_KEY is not set on the server.');

  const client = new OpenAI({ apiKey, maxRetries: 1 });
  const model = analystModel();

  const convo: Msg[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...trimHistory(messages).map((m): Msg => ({ role: m.role, content: m.content })),
  ];

  for (let iteration = 1; iteration <= MAX_TOOL_ITERATIONS; iteration++) {
    const lastPass = iteration === MAX_TOOL_ITERATIONS;

    const stream = await client.chat.completions.create(
      {
        model,
        messages: convo,
        // On the last pass, deny tools so the model has to answer with what it has.
        ...(lastPass ? {} : { tools: TOOL_DEFINITIONS, tool_choice: 'auto' as const }),
        ...tuning(model),
        stream: true,
      },
      { signal },
    );

    let text = '';
    const partials = new Map<number, PartialCall>();
    let finish: string | null = null;

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;
      if (choice.finish_reason) finish = choice.finish_reason;

      const delta = choice.delta;
      if (delta?.content) {
        text += delta.content;
        yield { type: 'text', delta: delta.content };
      }

      for (const part of delta?.tool_calls ?? []) {
        const slot = partials.get(part.index) ?? { id: '', name: '', args: '' };
        if (part.id) slot.id = part.id;
        if (part.function?.name) slot.name += part.function.name;
        if (part.function?.arguments) slot.args += part.function.arguments;
        partials.set(part.index, slot);
      }
    }

    const calls = [...partials.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, c]) => c)
      .filter((c) => c.name);

    if (!calls.length) {
      // No tools requested: this pass produced the final answer.
      if (!text.trim()) {
        yield {
          type: 'text',
          delta:
            finish === 'length'
              ? '\n\n_Response truncated at the token limit._'
              : 'No answer was produced. Try rephrasing the question.',
        };
      }
      yield { type: 'done', iterations: iteration };
      return;
    }

    convo.push({
      role: 'assistant',
      content: text || null,
      tool_calls: calls.map((c) => ({
        id: c.id,
        type: 'function' as const,
        function: { name: c.name, arguments: c.args || '{}' },
      })),
    });

    for (const call of calls) {
      const args = safeParseArgs(call.args);
      yield { type: 'tool_call', id: call.id, name: call.name, args };

      const started = Date.now();
      let outcome;
      try {
        outcome = await executeTool(call.name, args);
      } catch (e) {
        // A tool must never take the request down; report it to the model instead.
        outcome = {
          ok: false,
          data: { error: 'tool_threw', message: (e as Error).message },
          summary: `${call.name} threw: ${(e as Error).message}`,
        };
      }

      yield {
        type: 'tool_result',
        id: call.id,
        name: call.name,
        summary: outcome.summary,
        ms: Date.now() - started,
        ok: outcome.ok,
        meta: outcome.meta,
      };

      convo.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(outcome.data).slice(0, 24_000),
      });

      if (signal?.aborted) return;
    }
  }

  yield { type: 'done', iterations: MAX_TOOL_ITERATIONS };
}

/** Models occasionally emit malformed or empty argument JSON. */
function safeParseArgs(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return { __malformed: raw.slice(0, 200) };
  }
}
