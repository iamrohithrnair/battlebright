/**
 * Records the "You Want More?" walkthrough as one continuous 1920x1080 video.
 *
 * Everything you would want to retime lives in TIMING and BEATS immediately
 * below. Each beat is independent: if one throws, it is logged and skipped and
 * the recording carries on, because a partial video is far more useful than a
 * crash with nothing to show.
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import { toGif, toMp4, videoDuration, humanBytes } from '../lib/encode.mjs';
import { createLogger } from '../lib/log.mjs';
import { OUTPUT_DIR, VIDEO_RAW_DIR } from '../lib/paths.mjs';
import { ensureServer } from '../lib/server.mjs';
import {
  STAGE_INIT_SCRIPT,
  VIEWPORT,
  createPointer,
  dismissOverlays,
  firstVisible,
  humanType,
  showAndClick,
  smoothScroll,
  wait,
  waitForCanvasPaint,
} from '../lib/stage.mjs';

/* ------------------------------------------------------------------ tuning */

/**
 * Global pacing. `speed` scales every dwell and settle at once: 0.6 for a quick
 * check of the script, 1.4 for a slower, more readable cut.
 */
const TIMING = {
  speed: Number(process.env.DEMO_SPEED ?? 1),
  /** Pause after each navigation before anything is filmed. */
  afterNav: 1200,
  /** How long a WebGL canvas gets to draw its first real frame. */
  canvasTimeout: 30_000,
  /** Extra hold once a canvas is confirmed to be painting. */
  canvasSettle: 1800,
  /** Per-character typing delay. */
  typeDelay: 95,
  /** Ceiling on any single beat, so one hung request cannot eat the run. */
  beatBudget: 150_000,
  /** How long we wait for a genuine Bright Data unlock to come back. */
  unlockTimeout: 90_000,
  /** How long the analyst gets to stream a full tool-using answer. */
  analystTimeout: 90_000,
};

const t = (ms) => Math.round(ms * TIMING.speed);

/**
 * The narrative, in the order the judges are told the story. Reorder, retime or
 * comment out entries here and nothing else needs to change.
 *
 *   path   — route to visit, or null to stay wherever the previous beat landed
 *   canvas — wait for a WebGL surface to actually paint before filming
 *   dwell  — hold on the settled page before the beat's actions begin
 *   run    — the beat's choreography; may throw, and will be caught
 */
const BEATS = [
  {
    id: 'hero',
    label: 'Hero — 3D arena and scroll-driven camera',
    path: '/',
    canvas: true,
    dwell: 2600,
    async run({ page, log }) {
      log.step('Scrolling slowly through the hero story beats.');
      await smoothScroll(page, { to: 'bottom', steps: 32, stepDelay: t(180) });
      await wait(t(1200));
      log.step('Easing back up to re-establish the arena.');
      await smoothScroll(page, { to: 'top', steps: 16, stepDelay: t(90) });
      await wait(t(900));
    },
  },

  {
    id: 'predict',
    label: 'Predict — choreographed 3D fight and explainable readout',
    // Land on a different opponent so picking End Game is a visible action.
    path: '/predict?a=Tombstone&b=Minotaur',
    canvas: true,
    dwell: 2200,
    async run({ page, pointer, log }) {
      const picker = await firstVisible(
        [
          { name: 'role=button[name="Robot B"]', locator: page.getByRole('button', { name: 'Robot B', exact: true }) },
          { name: 'role=button[name=/robot b/i]', locator: page.getByRole('button', { name: /robot b/i }) },
          { name: 'combobox aria-haspopup=listbox (2nd)', locator: page.locator('[aria-haspopup="listbox"]').nth(1) },
        ],
        { log },
      );

      if (picker) {
        log.step('Opening the amber-corner picker and choosing End Game.');
        await showAndClick(picker, pointer, { settle: t(500) });

        const search = await firstVisible(
          [
            { name: 'role=textbox[name=/search within robot b/i]', locator: page.getByRole('textbox', { name: /search within robot b/i }) },
            { name: 'placeholder=/search robots/i', locator: page.getByPlaceholder(/search robots/i) },
          ],
          { log, timeout: 4000 },
        );
        if (search) await humanType(search, 'End Ga', pointer, { delay: t(95), settle: t(500) });

        const option = await firstVisible(
          [
            { name: 'role=option[name="End Game"]', locator: page.getByRole('option', { name: 'End Game', exact: true }) },
            { name: 'role=option[name=/end game/i]', locator: page.getByRole('option', { name: /end game/i }) },
          ],
          { log, timeout: 5000 },
        );
        if (option) await showAndClick(option, pointer, { settle: t(800), log });
      } else {
        log.warn('Could not drive the robot picker; falling back to the URL-seeded matchup.');
        await page.goto(`${page.url().split('?')[0]}?a=Tombstone&b=End%20Game`, { waitUntil: 'domcontentloaded' });
        await waitForCanvasPaint(page, { timeout: TIMING.canvasTimeout, settle: t(1200), log });
      }

      const simulate = await firstVisible(
        [
          { name: 'role=button[name=/^simulate$/i]', locator: page.getByRole('button', { name: /^simulate$/i }) },
          { name: 'role=button[name=/simulate|run again|run the fight/i]', locator: page.getByRole('button', { name: /simulate|run again|run the fight/i }) },
        ],
        { log },
      );
      if (!simulate) throw new Error('No simulate control found on /predict.');

      log.step('Running the fight.');
      await showAndClick(simulate, pointer, { settle: t(400), log });

      log.step('Letting the 3D fight choreography play out.');
      const verdict = page.getByText(/takes it/i).first();
      await verdict.waitFor({ state: 'visible', timeout: 60_000 }).catch(() => {
        log.warn('The verdict panel never appeared within 60 s — filming whatever resolved.');
      });
      await wait(t(2000));

      log.step('Holding on the probability bar, confidence and projected finish.');
      await smoothScroll(page, { target: 'text=/takes it/i', steps: 12, stepDelay: t(140) });
      await wait(t(2800));

      log.step('Holding on the signal breakdown and Monte Carlo distribution.');
      await smoothScroll(page, { to: 'bottom', steps: 18, stepDelay: t(170), clearFooter: true });
      await wait(t(3400));
    },
  },

  {
    id: 'roster',
    label: 'Roster — 42 robots, live search filtering',
    path: '/roster',
    canvas: false,
    dwell: 1800,
    async run({ page, pointer, log }) {
      await smoothScroll(page, { to: 620, steps: 10, stepDelay: t(130) });
      await wait(t(1100));
      await smoothScroll(page, { to: 'top', steps: 7, stepDelay: t(80) });

      const search = await firstVisible(
        [
          { name: 'role=searchbox', locator: page.getByRole('searchbox') },
          { name: 'placeholder=/tombstone/i', locator: page.getByPlaceholder(/tombstone/i) },
          { name: 'input[type=search]', locator: page.locator('input[type="search"]') },
        ],
        { log },
      );

      if (search) {
        log.step('Typing into the search to demonstrate filtering.');
        await humanType(search, 'spinner', pointer, { delay: t(105), settle: t(1600) });
        await humanType(search, 'Tombstone', pointer, { delay: t(90), settle: t(1300) });
      } else {
        log.warn('No roster search field found; showing the unfiltered grid instead.');
        await wait(t(1600));
      }

      const card = await firstVisible(
        [
          { name: 'link[href="/roster/Tombstone"]', locator: page.locator('a[href="/roster/Tombstone"]') },
          { name: 'role=link[name=/tombstone/i]', locator: page.getByRole('link', { name: /tombstone/i }) },
          { name: 'first roster card link', locator: page.locator('a[href^="/roster/"]') },
        ],
        { log },
      );
      if (card) {
        log.step('Opening a robot from the grid.');
        await showAndClick(card, pointer, { settle: t(800), log });
        await page.waitForLoadState('domcontentloaded').catch(() => {});
      }
    },
  },

  {
    id: 'robot',
    label: 'Robot detail — 3D model, radar, match history, scouting report',
    // The roster beat clicks through, so only navigate if that fell back.
    path: null,
    fallbackPath: '/roster/Tombstone',
    canvas: true,
    dwell: 2600,
    async run({ page, log }) {
      log.step('Letting the 3D model orbit, then scrolling the full dossier.');
      await wait(t(1500));
      await smoothScroll(page, { to: 'bottom', steps: 30, stepDelay: t(190), clearFooter: true });
      await wait(t(1800));
    },
  },

  {
    id: 'leaderboard',
    label: 'Leaderboard — rankings and column sorting',
    path: '/leaderboard',
    canvas: false,
    dwell: 2200,
    async run({ page, pointer, log }) {
      const header = await firstVisible(
        [
          { name: 'columnheader button "KO rate"', locator: page.getByRole('button', { name: /ko rate/i }) },
          { name: 'columnheader button "Win rate"', locator: page.getByRole('button', { name: /win rate/i }) },
          { name: 'any th button', locator: page.locator('th button') },
        ],
        { log },
      );
      if (!header) throw new Error('No sortable column header found on /leaderboard.');

      log.step('Clicking a column header to re-sort the field.');
      await showAndClick(header, pointer, { settle: t(2000), log });
      await smoothScroll(page, { to: 700, steps: 14, stepDelay: t(160) });
      await wait(t(1500));
    },
  },

  {
    id: 'tournament',
    label: 'Tournament — seeded bracket with round-by-round playback',
    path: '/tournament',
    canvas: true,
    dwell: 2000,
    async run({ page, pointer, log }) {
      const simulate = await firstVisible(
        [
          { name: 'role=button[name=/^simulate$/i]', locator: page.getByRole('button', { name: /^simulate$/i }) },
          { name: 'role=button[name=/simulate|replay|resume/i]', locator: page.getByRole('button', { name: /simulate|replay|resume/i }) },
        ],
        { log },
      );
      if (!simulate) throw new Error('No bracket simulate control found on /tournament.');

      log.step('Starting round-by-round playback.');
      await showAndClick(simulate, pointer, { settle: t(500), log });

      log.step('Running the bracket through to the champion.');
      await page
        .getByText(/champion crowned/i)
        .first()
        .waitFor({ state: 'visible', timeout: 45_000 })
        .catch(() => log.warn('Playback did not report a crowned champion in 45 s.'));
      await wait(t(2000));

      log.step('Holding on the champion, then the full 2D bracket.');
      await smoothScroll(page, { to: 'bottom', steps: 20, stepDelay: t(170), clearFooter: true });
      await wait(t(2200));
    },
  },

  {
    id: 'insights',
    label: 'Insights — weapon-class meta, upsets, matchup heatmap',
    path: '/insights',
    canvas: true,
    canvasOptional: true,
    dwell: 2600,
    async run({ page, log }) {
      log.step('Scrolling through the meta chart, upsets and heatmap.');
      await smoothScroll(page, { to: 'bottom', steps: 26, stepDelay: t(190), clearFooter: true });
      await wait(t(2200));
    },
  },

  {
    id: 'model',
    label: 'Model — backtest accuracy against the coin-flip baseline',
    path: '/model',
    canvas: false,
    dwell: 2800,
    async run({ page, log }) {
      log.step('Holding on the headline accuracy versus the 50% baseline.');
      await wait(t(1400));
      await smoothScroll(page, { to: 'bottom', steps: 22, stepDelay: t(180), clearFooter: true });
      await wait(t(1800));
    },
  },

  {
    id: 'intel',
    label: 'Intel — live Bright Data unlock, provenance and verification diff',
    path: '/intel',
    canvas: false,
    dwell: 2400,
    async run({ page, pointer, log }) {
      const target = await firstVisible(
        [
          { name: 'role=textbox[name=/target robot/i]', locator: page.getByRole('textbox', { name: /target robot/i }) },
          { name: 'input[name=robot]', locator: page.locator('input[name="robot"]') },
          { name: 'placeholder=/tombstone/i', locator: page.getByPlaceholder(/tombstone/i) },
        ],
        { log },
      );
      if (target) {
        log.step('Naming the collection target.');
        await humanType(target, 'Tombstone', pointer, { delay: t(100), settle: t(600) });
      }

      // Bypassing the cache proves the unlock is real rather than replayed.
      const fresh = await firstVisible(
        [{ name: 'role=switch[name=/fresh/i]', locator: page.getByRole('switch', { name: /fresh/i }) }],
        { log, timeout: 3000 },
      );
      if (fresh) {
        log.step('Forcing a fresh unlock so the run bypasses the server cache.');
        await showAndClick(fresh, pointer, { settle: t(650), log });
      }

      const unlock = await firstVisible(
        [
          { name: 'role=button[name=/unlock page/i]', locator: page.getByRole('button', { name: /unlock page/i }) },
          { name: 'role=button[name=/unlock|collect|scrape/i]', locator: page.getByRole('button', { name: /unlock|collect|scrape/i }) },
        ],
        { log },
      );
      if (!unlock) throw new Error('No unlock control found on /intel.');

      log.step('Triggering the live unlock through the Bright Data Web Unlocker.');
      await showAndClick(unlock, pointer, { settle: t(500), log });

      log.step(`Waiting up to ${Math.round(TIMING.unlockTimeout / 1000)} s for the real request to return.`);
      const provenance = page.getByText(/collection receipt|provenance/i).first();
      await provenance.waitFor({ state: 'visible', timeout: TIMING.unlockTimeout }).catch(() => {
        log.warn('The provenance panel did not appear inside the unlock timeout.');
      });
      // The skeleton carries the same heading, so wait for a measured figure.
      await page
        .getByText(/\d+(\.\d+)?\s*(KB|MB|B)\b/)
        .first()
        .waitFor({ state: 'visible', timeout: 20_000 })
        .catch(() => log.warn('No byte count rendered — the unlock may have fallen back to bundled data.'));

      // Deliberately the longest hold in the cut: this is the Bright Data
      // judging criterion, and the figures need to be legible on first watch.
      log.step('Holding on the provenance panel — the key Bright Data shot.');
      await wait(t(6000));

      log.step('Holding on the field-by-field verification diff.');
      await smoothScroll(page, { to: 'bottom', steps: 22, stepDelay: t(190), clearFooter: true });
      await wait(t(5500));
    },
  },

  {
    id: 'analyst',
    label: 'Analyst — streaming tool-using agent with a visible trace',
    path: '/analyst',
    canvas: false,
    dwell: 2600,
    async run({ page, pointer, log }) {
      const input = await firstVisible(
        [
          { name: 'role=textbox[name=/ask about a matchup/i]', locator: page.getByRole('textbox', { name: /ask .*(matchup|analyst)/i }) },
          { name: '#analyst-input', locator: page.locator('#analyst-input') },
          { name: 'textarea', locator: page.locator('textarea') },
        ],
        { log },
      );
      if (!input) throw new Error('No analyst input found on /analyst.');

      log.step('Asking the analyst a real question.');
      await humanType(input, 'Who wins Tombstone vs End Game and why?', pointer, {
        delay: t(58),
        settle: t(900),
      });

      const send = await firstVisible(
        [{ name: 'role=button[name=/^send$/i]', locator: page.getByRole('button', { name: /^send$/i }) }],
        { log, timeout: 4000 },
      );
      if (send) await showAndClick(send, pointer, { settle: t(500), log });
      else await input.press('Enter');

      log.step('Waiting for the tool-call trace to appear.');
      await page
        .getByText(/predict|simulate|scout|tool/i)
        .first()
        .waitFor({ state: 'visible', timeout: 30_000 })
        .catch(() => log.warn('No tool trace became visible within 30 s.'));

      log.step('Letting the answer stream in.');
      // The Send button re-enables the moment the stream closes.
      const idle = page.getByRole('button', { name: /^send$/i }).first();
      const deadline = Date.now() + TIMING.analystTimeout;
      while (Date.now() < deadline) {
        const streaming = await page
          .getByRole('button', { name: /^stop$/i })
          .first()
          .isVisible()
          .catch(() => false);
        if (!streaming) break;
        await wait(1000);
      }
      await idle.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await wait(t(2200));

      log.step('Holding on the visible tool-call trace and the grounded answer.');
      await smoothScroll(page, { to: 'bottom', steps: 14, stepDelay: t(160), clearFooter: true });
      await wait(t(3600));
    },
  },

  {
    id: 'commentary',
    label: 'Commentary — AI voice call with synchronised captions',
    path: '/commentary',
    canvas: false,
    dwell: 2000,
    async run({ page, pointer, log }) {
      const start = await firstVisible(
        [
          { name: 'role=button[name=/call the fight|call it again/i]', locator: page.getByRole('button', { name: /call the fight|call it again/i }) },
          { name: 'role=button[name=/commentate|generate/i]', locator: page.getByRole('button', { name: /commentate|generate/i }) },
          { name: 'role=button[name=/^play commentary$/i]', locator: page.getByRole('button', { name: /^play commentary$/i }) },
        ],
        { log, timeout: 10_000 },
      );
      if (!start) throw new Error('No commentary start control found on /commentary.');

      log.step('Building the fight call.');
      await showAndClick(start, pointer, { settle: t(900), log });

      log.step('Waiting for the generated script to land.');
      await page
        .getByRole('button', { name: /^(play|pause) commentary$/i })
        .first()
        .waitFor({ state: 'visible', timeout: 60_000 })
        .catch(() => log.warn('The transport bar never became available within 60 s.'));
      await wait(t(1600));

      // Headless Chromium has no audio device, so autoplay may never advance the
      // captions. Nudge playback, then step beats manually if it stays put.
      const play = page.getByRole('button', { name: /^play commentary$/i }).first();
      if (await play.isEnabled().catch(() => false)) {
        log.step('Starting playback so the captions track the call.');
        await showAndClick(play, pointer, { settle: t(700), log }).catch(() => {});
      }

      log.step('Holding on the synchronised captions.');
      await wait(t(4500));

      const next = page.getByRole('button', { name: /^next beat$/i }).first();
      for (let i = 0; i < 3; i += 1) {
        if (!(await next.isEnabled().catch(() => false))) break;
        await showAndClick(next, pointer, { settle: t(1500), log }).catch(() => {});
      }

      log.step('Holding on the grounding panel behind each line.');
      await smoothScroll(page, { to: 'bottom', steps: 16, stepDelay: t(170), clearFooter: true });
      await wait(t(3000));
    },
  },
];

/* ------------------------------------------------------------------- runner */

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} exceeded its ${ms} ms budget.`)), ms);
    }),
  ]);
}

async function main() {
  fs.rmSync(VIDEO_RAW_DIR, { recursive: true, force: true });
  fs.mkdirSync(VIDEO_RAW_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const log = createLogger();
  log.info(`Recording at ${VIEWPORT.width}x${VIEWPORT.height}, speed x${TIMING.speed}.`);

  const server = await ensureServer(log);
  const baseUrl = server.baseUrl;

  const headless = process.env.DEMO_HEADLESS !== '0';
  const browser = await chromium.launch({
    headless,
    // The full Chromium build (not headless-shell) is the one with a real
    // WebGL/compositor path, which this app leans on heavily.
    channel: headless ? 'chromium' : undefined,
    args: [
      '--use-angle=default',
      '--enable-unsafe-swiftshader',
      '--hide-scrollbars',
      // Playwright cannot record audio anyway; muting keeps the run silent
      // locally while still letting the commentary transport advance.
      '--mute-audio',
      '--autoplay-policy=no-user-gesture-required',
      '--force-device-scale-factor=1',
      '--disable-dev-shm-usage',
    ],
  });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    // The app honours prefers-reduced-motion, which would flatten the whole demo.
    reducedMotion: 'no-preference',
    recordVideo: { dir: VIDEO_RAW_DIR, size: VIEWPORT },
  });
  context.setDefaultTimeout(20_000);
  await context.addInitScript(STAGE_INIT_SCRIPT);

  const page = await context.newPage();
  const pointer = createPointer(page);
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message.slice(0, 200)}`));

  const results = [];
  const videoStart = Date.now();

  // `DEMO_ONLY=predict,intel` records a subset — the fast way to retime one beat
  // without sitting through the whole walkthrough.
  const only = (process.env.DEMO_ONLY ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const beats = only.length ? BEATS.filter((b) => only.includes(b.id)) : BEATS;
  if (only.length) log.info(`DEMO_ONLY is set — recording only: ${beats.map((b) => b.id).join(', ')}`);

  for (const beat of beats) {
    const beatStart = Date.now();
    const offset = (beatStart - videoStart) / 1000;
    log.info('');
    log.info(`=== ${beat.id}: ${beat.label} ===`);

    try {
      await withTimeout(
        (async () => {
          // A beat with no `path` expects the previous beat to have navigated
          // for it. Verify that actually happened before trusting it.
          let target = beat.path;
          if (!target && beat.fallbackPath) {
            const here = decodeURIComponent(new URL(page.url()).pathname);
            if (here !== beat.fallbackPath) {
              log.warn(`Expected to be on ${beat.fallbackPath} but landed on ${here}; navigating directly.`);
              target = beat.fallbackPath;
            }
          }
          if (target) {
            const url = `${baseUrl}${target}`;
            log.info(`Navigating to ${url}`);
            const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
            const status = response?.status() ?? 0;
            if (status >= 400) {
              throw new Error(`${target} returned HTTP ${status} — the route is not built yet.`);
            }
          }

          await dismissOverlays(page, pointer, log);
          await wait(t(TIMING.afterNav));

          if (beat.canvas) {
            const painted = await waitForCanvasPaint(page, {
              timeout: TIMING.canvasTimeout,
              settle: t(TIMING.canvasSettle),
              log,
            });
            if (!painted && !beat.canvasOptional) {
              log.warn('Canvas never confirmed a paint; continuing with the beat regardless.');
            }
          }

          await wait(t(beat.dwell));
          await beat.run({ page, pointer, log, baseUrl, t });
        })(),
        TIMING.beatBudget * TIMING.speed,
        `Beat "${beat.id}"`,
      );

      const seconds = (Date.now() - beatStart) / 1000;
      results.push({ ...beat, status: 'ok', seconds, offset });
      log.info(`Beat "${beat.id}" captured in ${seconds.toFixed(1)} s.`);
    } catch (error) {
      const seconds = (Date.now() - beatStart) / 1000;
      const reason = error.message.split('\n')[0];
      results.push({ ...beat, status: 'skipped', seconds, offset, reason });
      log.warn(`Beat "${beat.id}" skipped after ${seconds.toFixed(1)} s: ${reason}`);
      // Playwright puts the diagnosis (what intercepted the click, what was
      // unstable) on the lines *after* the summary, so keep all of them.
      for (const line of error.message.split('\n').slice(1, 14)) log.warn(`    ${line}`);
      // Get back to a known-good page so the next beat starts from calm.
      await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
    }
  }

  log.info('');
  log.step('Closing the context to flush the video file.');
  const video = page.video();
  await context.close();

  let webm = null;
  if (video) {
    webm = path.join(OUTPUT_DIR, 'you-want-more-walkthrough.webm');
    await video.saveAs(webm).catch((error) => {
      log.error(`Could not save the video: ${error.message}`);
      webm = null;
    });
  }
  await browser.close();

  let mp4 = null;
  let gif = null;
  let duration = null;

  if (webm && fs.existsSync(webm)) {
    duration = await videoDuration(webm);
    mp4 = await toMp4(webm, path.join(OUTPUT_DIR, 'you-want-more-walkthrough.mp4'), log);

    // The Bright Data beat is the highlight, so that is the README GIF.
    const highlight = results.find((r) => r.id === 'intel' && r.status === 'ok') ?? results.find((r) => r.status === 'ok');
    if (highlight) {
      gif = await toGif(
        mp4 ?? webm,
        path.join(OUTPUT_DIR, 'highlight.gif'),
        { start: Math.max(0, highlight.offset + 6), duration: 6, width: 960 },
        log,
      );
    }
  }

  fs.rmSync(VIDEO_RAW_DIR, { recursive: true, force: true });
  await server.stop();

  /* -------------------------------------------------------------- summary */

  const ok = results.filter((r) => r.status === 'ok');
  const skipped = results.filter((r) => r.status === 'skipped');

  const lines = [
    '',
    '──────────────────────────────────────────────────────────────',
    ` Walkthrough recording — ${ok.length}/${results.length} beats captured`,
    '──────────────────────────────────────────────────────────────',
  ];
  for (const r of results) {
    const mark = r.status === 'ok' ? 'ok     ' : 'SKIPPED';
    const at = `@${r.offset.toFixed(0).padStart(4)}s`;
    lines.push(` ${mark} ${at} ${r.seconds.toFixed(1).padStart(6)}s  ${r.id.padEnd(11)} ${r.label}`);
    if (r.reason) lines.push(`                            ↳ ${r.reason}`);
  }
  lines.push('──────────────────────────────────────────────────────────────');

  if (webm && fs.existsSync(webm)) {
    lines.push(` webm      ${webm} (${humanBytes(fs.statSync(webm).size)})`);
  } else {
    lines.push(' webm      NOT PRODUCED');
  }
  if (mp4) lines.push(` mp4       ${mp4} (${humanBytes(fs.statSync(mp4).size)})`);
  else lines.push(' mp4       skipped (no ffmpeg, or transcode failed)');
  if (gif) lines.push(` gif       ${gif} (${humanBytes(fs.statSync(gif).size)})`);
  lines.push(` duration  ${duration ? `${duration.toFixed(1)} s` : 'unknown (ffprobe not available)'}`);
  lines.push(` log       ${path.join(OUTPUT_DIR, 'run.log')}`);
  if (consoleErrors.length) {
    lines.push(` console   ${consoleErrors.length} browser error(s) — see the log`);
  }
  lines.push('');

  for (const line of lines) log.info(line);
  if (consoleErrors.length) {
    log.info('Browser console errors observed during the run:');
    for (const error of [...new Set(consoleErrors)].slice(0, 20)) log.warn(`  ${error}`);
  }
  if (skipped.length) {
    log.warn(`${skipped.length} beat(s) were skipped: ${skipped.map((s) => s.id).join(', ')}`);
  }

  await log.close();
  // A partial video is a success; only a missing video is a failure.
  process.exitCode = webm && fs.existsSync(webm) ? 0 : 1;
}

main().catch(async (error) => {
  console.error(`\nRecording failed outright: ${error.message}`);
  console.error(error.stack);
  process.exitCode = 1;
});
