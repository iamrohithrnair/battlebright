/**
 * Fast health check across every route: HTTP status, a rendered <h1>, and any
 * browser console errors. Prints a pass/fail table. Run this first whenever the
 * app is mid-build — it tells you which beats the recorder can possibly capture.
 */

import { chromium } from 'playwright';

import { createLogger, redact } from '../lib/log.mjs';
import { OUTPUT_DIR } from '../lib/paths.mjs';
import path from 'node:path';
import { ROUTES } from '../lib/routes.mjs';
import { ensureServer } from '../lib/server.mjs';
import { STAGE_INIT_SCRIPT, VIEWPORT, wait } from '../lib/stage.mjs';

/** Dev-only noise that says nothing about whether the route works. */
const IGNORABLE = [
  /favicon/i,
  /apple-touch-icon/i,
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /Warning: Extra attributes from the server/i,
  /webgl.*deprecated/i,
  // Chromium's generic wrapper for a failed subresource. The `response`
  // listener below reports the same failure with the URL attached, which is
  // the version you can actually act on.
  /^Failed to load resource:/i,
];

async function main() {
  const log = createLogger({ file: path.join(OUTPUT_DIR, 'smoke.log') });
  const server = await ensureServer(log);
  const browser = await chromium.launch({
    headless: true,
    channel: 'chromium',
    args: ['--enable-unsafe-swiftshader', '--mute-audio'],
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: 'dark',
    reducedMotion: 'reduce', // Smoke tests want the DOM, not the choreography.
  });
  context.setDefaultTimeout(20_000);
  await context.addInitScript(STAGE_INIT_SCRIPT);

  const rows = [];

  for (const route of ROUTES) {
    const page = await context.newPage();
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (!IGNORABLE.some((p) => p.test(text))) errors.push(text.slice(0, 160));
    });
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message.slice(0, 160)}`));
    page.on('response', (response) => {
      if (response.status() < 400) return;
      const url = response.url();
      if (IGNORABLE.some((p) => p.test(url))) return;
      // The page's own status is reported separately; this is for subresources.
      if (url === `${server.baseUrl}${route.path}`) return;
      errors.push(`HTTP ${response.status()} on ${url.replace(server.baseUrl, '')}`);
    });

    const started = Date.now();
    let status = 0;
    let heading = '';
    let canvasCount = 0;
    let failure = null;

    try {
      const response = await page.goto(`${server.baseUrl}${route.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45_000,
      });
      status = response?.status() ?? 0;
      await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});
      await wait(600);
      heading = (await page.locator('h1').first().innerText({ timeout: 5000 }).catch(() => '')).replace(/\s+/g, ' ').trim();
      canvasCount = await page.locator('canvas').count();
    } catch (error) {
      failure = error.message.split('\n')[0];
    }

    const ms = Date.now() - started;
    const pass = status === 200 && errors.length === 0 && !failure;
    rows.push({ ...route, status, heading, canvasCount, errors, failure, ms, pass });

    log.info(
      `${pass ? 'PASS' : 'FAIL'} ${String(status).padEnd(3)} ${route.path} (${ms} ms)` +
        (heading ? ` — "${heading.slice(0, 60)}"` : '') +
        (failure ? ` — ${failure}` : ''),
    );
    for (const error of errors.slice(0, 4)) log.warn(`     console: ${redact(error)}`);

    await page.close();
  }

  await context.close();
  await browser.close();
  await server.stop();

  /* ---------------------------------------------------------------- table */

  const width = { path: 22, status: 6, canvas: 7, time: 8 };
  const line = '─'.repeat(width.path + width.status + width.canvas + width.time + 40);

  console.log('');
  console.log(line);
  console.log(
    ' ' +
      'ROUTE'.padEnd(width.path) +
      'HTTP'.padEnd(width.status) +
      'CANVAS'.padEnd(width.canvas) +
      'TIME'.padEnd(width.time) +
      'RESULT',
  );
  console.log(line);

  for (const row of rows) {
    let verdict;
    if (row.pass) verdict = 'pass';
    else if (row.status === 404) verdict = 'FAIL — route not built yet';
    else if (row.failure) verdict = `FAIL — ${row.failure.slice(0, 48)}`;
    else if (row.errors.length) verdict = `FAIL — ${row.errors.length} console error(s)`;
    else verdict = `FAIL — HTTP ${row.status}`;

    console.log(
      ' ' +
        row.path.padEnd(width.path) +
        String(row.status || '—').padEnd(width.status) +
        String(row.canvasCount || '—').padEnd(width.canvas) +
        `${row.ms}ms`.padEnd(width.time) +
        verdict,
    );
  }
  console.log(line);

  const passed = rows.filter((r) => r.pass).length;
  console.log(` ${passed}/${rows.length} routes healthy`);
  const notBuilt = rows.filter((r) => r.status === 404).map((r) => r.path);
  if (notBuilt.length) console.log(` Not built yet: ${notBuilt.join(', ')}`);
  const noisy = rows.filter((r) => r.status === 200 && r.errors.length);
  if (noisy.length) {
    console.log(' Routes that render but log console errors:');
    for (const row of noisy) console.log(`   ${row.path} → ${redact(row.errors[0])}`);
  }
  console.log(` Log: ${path.join(OUTPUT_DIR, 'smoke.log')}`);
  console.log('');

  await log.close();
  process.exitCode = passed === rows.length ? 0 : 1;
}

main().catch((error) => {
  console.error(`Smoke run failed outright: ${error.message}`);
  process.exitCode = 1;
});
