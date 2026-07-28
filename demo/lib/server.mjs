import { spawn } from 'node:child_process';
import { APP_DIR, BASE_URL, CANDIDATE_PORTS } from './paths.mjs';

const READY_TIMEOUT_MS = Number(process.env.DEMO_SERVER_TIMEOUT_MS ?? 120_000);

async function probe(url, timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'manual' });
    // Any HTTP answer means something is listening; even a 500 beats nothing.
    return res.status;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** True when the response body actually looks like this Next.js app. */
async function looksLikeOurApp(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return false;
    const html = await res.text();
    return /you want more|battlebot/i.test(html);
  } catch {
    return false;
  }
}

/**
 * Reuses whatever a sibling agent already has running before spawning anything.
 * Returns `{ baseUrl, stop }`; `stop` is a no-op when we attached to a server
 * we did not start, because killing someone else's dev server is rude.
 */
export async function ensureServer(log) {
  const explicit = process.env.DEMO_BASE_URL;
  const urls = explicit
    ? [BASE_URL]
    : [...new Set([BASE_URL, ...CANDIDATE_PORTS.map((p) => `http://localhost:${p}`)])];

  for (const url of urls) {
    const status = await probe(`${url}/`);
    if (status === null) continue;
    if (explicit || (await looksLikeOurApp(`${url}/`))) {
      log.info(`Reusing the dev server already listening on ${url} (HTTP ${status}).`);
      return { baseUrl: url, started: false, stop: async () => {} };
    }
    log.warn(`${url} answered HTTP ${status} but does not look like the app — skipping.`);
  }

  log.info(`Nothing serving the app. Starting "npm run dev" in ${APP_DIR}.`);
  const child = spawn('npm', ['run', 'dev'], {
    cwd: APP_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    env: { ...process.env, BROWSER: 'none' },
  });

  let output = '';
  const collect = (chunk) => {
    output += chunk.toString();
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);

  const stop = async () => {
    if (child.exitCode !== null) return;
    log.info('Shutting down the dev server we started.');
    child.kill('SIGTERM');
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 8000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  };

  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      log.error(`Dev server exited early with code ${child.exitCode}.`);
      log.error(output.split('\n').slice(-25).join('\n'));
      throw new Error('The app dev server could not start.');
    }
    // Next.js may pick a different port when 3000 is taken by another stream.
    const announced = output.match(/http:\/\/localhost:(\d+)/);
    const target = announced ? `http://localhost:${announced[1]}` : BASE_URL;
    if (await probe(`${target}/`)) {
      log.info(`Dev server ready at ${target}.`);
      return { baseUrl: target, started: true, stop };
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  await stop();
  log.error(output.split('\n').slice(-25).join('\n'));
  throw new Error(`Dev server was not ready within ${READY_TIMEOUT_MS} ms.`);
}
