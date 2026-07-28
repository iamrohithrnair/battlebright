/**
 * Captures a 1920x1080 still of every route, plus a full-page still where the
 * page scrolls. Useful for the README and as the fallback deliverable when the
 * video recording is unusable.
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import { humanBytes } from '../lib/encode.mjs';
import { createLogger } from '../lib/log.mjs';
import { OUTPUT_DIR, SHOTS_DIR } from '../lib/paths.mjs';
import { ROUTES } from '../lib/routes.mjs';
import { ensureServer } from '../lib/server.mjs';
import {
  STAGE_INIT_SCRIPT,
  VIEWPORT,
  createPointer,
  dismissOverlays,
  smoothScroll,
  wait,
  waitForCanvasPaint,
} from '../lib/stage.mjs';

const FULL_PAGE = process.env.DEMO_FULL_PAGE !== '0';

async function main() {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  const log = createLogger({ file: path.join(OUTPUT_DIR, 'shots.log') });

  const server = await ensureServer(log);
  const browser = await chromium.launch({
    headless: process.env.DEMO_HEADLESS !== '0',
    channel: process.env.DEMO_HEADLESS !== '0' ? 'chromium' : undefined,
    args: ['--use-angle=default', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--mute-audio'],
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
  });
  context.setDefaultTimeout(20_000);
  await context.addInitScript(STAGE_INIT_SCRIPT);

  const page = await context.newPage();
  const pointer = createPointer(page);
  // Park the synthetic cursor off-frame so it never lands on a still.
  await page.mouse.move(-50, -50).catch(() => {});

  const captured = [];
  const failed = [];

  for (const [index, route] of ROUTES.entries()) {
    const prefix = `${String(index + 1).padStart(2, '0')}-${route.id}`;
    try {
      log.info(`Capturing ${route.path}`);
      const response = await page.goto(`${server.baseUrl}${route.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45_000,
      });
      const status = response?.status() ?? 0;
      if (status >= 400) throw new Error(`HTTP ${status} — route not built yet`);

      await dismissOverlays(page, pointer, log);
      await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});
      if (route.canvas) await waitForCanvasPaint(page, { timeout: 30_000, settle: 2200, log });
      await wait(1200);

      const viewportShot = path.join(SHOTS_DIR, `${prefix}.png`);
      await page.screenshot({ path: viewportShot });
      captured.push(viewportShot);

      if (FULL_PAGE) {
        const scrollable = await page.evaluate(
          () => document.documentElement.scrollHeight > window.innerHeight + 80,
        );
        if (scrollable) {
          // Walk the page first so lazy/animated sections have actually run.
          await smoothScroll(page, { to: 'bottom', steps: 16, stepDelay: 120 });
          await wait(900);
          await smoothScroll(page, { to: 'top', steps: 8, stepDelay: 80 });
          await wait(700);
          const fullShot = path.join(SHOTS_DIR, `${prefix}-full.png`);
          await page.screenshot({ path: fullShot, fullPage: true });
          captured.push(fullShot);
        }
      }
    } catch (error) {
      const reason = error.message.split('\n')[0];
      failed.push({ route, reason });
      log.warn(`Skipped ${route.path}: ${reason}`);
    }
  }

  await context.close();
  await browser.close();
  await server.stop();

  console.log('');
  console.log('─'.repeat(74));
  console.log(` Screenshots — ${captured.length} file(s) in ${SHOTS_DIR}`);
  console.log('─'.repeat(74));
  for (const file of captured) {
    console.log(` ${path.basename(file).padEnd(30)} ${humanBytes(fs.statSync(file).size)}`);
  }
  if (failed.length) {
    console.log('─'.repeat(74));
    for (const { route, reason } of failed) console.log(` SKIPPED ${route.path} — ${reason}`);
  }
  console.log('─'.repeat(74));
  console.log('');

  await log.close();
  process.exitCode = captured.length ? 0 : 1;
}

main().catch((error) => {
  console.error(`Screenshot run failed outright: ${error.message}`);
  process.exitCode = 1;
});
