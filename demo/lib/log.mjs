import fs from 'node:fs';
import path from 'node:path';
import { RUN_LOG } from './paths.mjs';

/** Tokens that must never reach the log, the console, or a video frame. */
const SECRET_KEY_HINT = /(sk-[A-Za-z0-9_-]{8,}|brd_[A-Za-z0-9_-]{6,}|[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,})/g;

/**
 * Anything resembling a credential is masked before it is written anywhere.
 * The app keeps its keys server-side, but a stack trace or a fetch URL could
 * still carry one, and a leaked key in a committed log is unrecoverable.
 */
export function redact(value) {
  return String(value)
    .replace(SECRET_KEY_HINT, '[REDACTED]')
    .replace(/((?:api[_-]?key|token|secret|password|authorization)["'\s:=]+)\S+/gi, '$1[REDACTED]');
}

export function createLogger({ file = RUN_LOG, echo = true } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const stream = fs.createWriteStream(file, { flags: 'w' });
  const started = Date.now();

  const write = (level, message) => {
    const elapsed = ((Date.now() - started) / 1000).toFixed(1).padStart(6);
    const line = `[${elapsed}s] ${level.padEnd(5)} ${redact(message)}`;
    stream.write(`${line}\n`);
    if (echo) console.log(line);
  };

  return {
    info: (m) => write('INFO', m),
    warn: (m) => write('WARN', m),
    error: (m) => write('ERROR', m),
    step: (m) => write('STEP', `— ${m}`),
    elapsedMs: () => Date.now() - started,
    async close() {
      await new Promise((resolve) => stream.end(resolve));
    },
  };
}
