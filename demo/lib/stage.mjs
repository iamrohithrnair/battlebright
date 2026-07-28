/**
 * Stagecraft: everything that makes a Playwright session look like a person
 * driving the app rather than a robot flashing through it.
 */

export const VIEWPORT = { width: 1920, height: 1080 };

/**
 * Injected into every document. Playwright drives a real mouse but renders no
 * cursor, so we draw one, plus a click pulse, plus the small cosmetic fixes
 * (no scrollbars, no caret blink) that stop the recording looking like a test.
 */
export const STAGE_INIT_SCRIPT = () => {
  const install = () => {
    if (document.getElementById('__demo_cursor__')) return;

    const style = document.createElement('style');
    style.textContent = `
      /* Scrollbars read as chrome, not product. */
      html, body { scrollbar-width: none !important; }
      ::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
      #__demo_cursor__ {
        position: fixed; top: 0; left: 0; z-index: 2147483647;
        width: 22px; height: 22px; margin: -11px 0 0 -11px;
        pointer-events: none; opacity: 0;
        transition: opacity .18s ease;
        will-change: transform;
      }
      #__demo_cursor__ .ring {
        position: absolute; inset: 0; border-radius: 999px;
        border: 2px solid rgba(255,255,255,.92);
        box-shadow: 0 0 0 1px rgba(0,0,0,.55), 0 0 12px rgba(0,0,0,.5);
        background: rgba(255,255,255,.14);
      }
      #__demo_cursor__ .dot {
        position: absolute; left: 50%; top: 50%; width: 5px; height: 5px;
        margin: -2.5px 0 0 -2.5px; border-radius: 999px; background: #fff;
      }
      #__demo_pulse__ {
        position: fixed; z-index: 2147483646; pointer-events: none;
        width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 999px;
        border: 2px solid rgba(255,255,255,.85); opacity: 0;
      }
      @keyframes __demo_pulse_kf__ {
        from { transform: scale(.5); opacity: .95; }
        to   { transform: scale(4.6); opacity: 0; }
      }
      /* A highlight we paint on an element just before clicking it. */
      .__demo_focus__ {
        outline: 2px solid rgba(255,255,255,.85) !important;
        outline-offset: 3px !important;
        border-radius: 6px;
        transition: outline-color .15s ease;
      }
    `;
    document.head.appendChild(style);

    const cursor = document.createElement('div');
    cursor.id = '__demo_cursor__';
    cursor.innerHTML = '<div class="ring"></div><div class="dot"></div>';
    document.body.appendChild(cursor);

    const pulse = document.createElement('div');
    pulse.id = '__demo_pulse__';
    document.body.appendChild(pulse);

    const place = (x, y) => {
      cursor.style.transform = `translate(${x}px, ${y}px)`;
      cursor.style.opacity = '1';
    };

    // Restore position across client-side navigations within the same document.
    const last = window.__demoCursorPos;
    if (last) place(last.x, last.y);

    window.addEventListener(
      'mousemove',
      (event) => {
        window.__demoCursorPos = { x: event.clientX, y: event.clientY };
        place(event.clientX, event.clientY);
      },
      { capture: true, passive: true },
    );

    window.addEventListener(
      'mousedown',
      (event) => {
        pulse.style.left = `${event.clientX}px`;
        pulse.style.top = `${event.clientY}px`;
        pulse.style.animation = 'none';
        // Force a reflow so the animation restarts on every click.
        void pulse.offsetWidth;
        pulse.style.animation = '__demo_pulse_kf__ .55s ease-out';
      },
      { capture: true, passive: true },
    );
  };

  if (document.body) install();
  else document.addEventListener('DOMContentLoaded', install, { once: true });
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Tracks the pointer so mouse moves can be interpolated from where it was. */
export function createPointer(page, start = { x: VIEWPORT.width / 2, y: VIEWPORT.height * 0.4 }) {
  let pos = { ...start };

  return {
    get position() {
      return { ...pos };
    },
    /** Eases the pointer along a short path so the cursor overlay reads as human. */
    async moveTo(x, y, { steps = 22, duration = 420 } = {}) {
      const from = { ...pos };
      const perStep = Math.max(4, Math.round(duration / steps));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        // easeInOutCubic
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
        await wait(perStep);
      }
      pos = { x, y };
    },
  };
}

/**
 * Brings an element somewhere clickable and reports what, if anything, still
 * covers its centre. Sticky headers are the usual culprit: scrolling a control
 * into view can tuck it straight underneath one.
 */
async function positionForClick(locator, page) {
  const viewport = page.viewportSize() ?? VIEWPORT;

  let box = await locator.boundingBox();
  const tooHigh = box && box.y < 140;
  const tooLow = box && box.y + box.height > viewport.height - 90;
  if (!box || tooHigh || tooLow) {
    // Centring dodges both the sticky nav at the top and anything docked below.
    await locator.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
    await wait(350);
    box = await locator.boundingBox();
  }
  if (!box) throw new Error('Element has no bounding box, so it cannot be clicked.');

  const obstruction = await locator.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (!hit || hit === el || el.contains(hit) || hit.contains(el)) return null;
    const hitRect = hit.getBoundingClientRect();
    return { tag: hit.tagName.toLowerCase(), bottom: hitRect.bottom, top: hitRect.top };
  });

  if (obstruction) {
    // Nudge the page so the element clears whatever is sitting on top of it.
    const shift = obstruction.bottom - box.y + 16;
    await page.evaluate((dy) => window.scrollBy(0, -dy), shift);
    await wait(350);
    box = await locator.boundingBox();
    if (!box) throw new Error('Element left the layout while clearing an obstruction.');
  }

  return { box, obstruction };
}

/** Moves to an element, highlights it, pauses, then clicks it. */
export async function showAndClick(locator, pointer, { settle = 620, hold = 260, log } = {}) {
  await locator.waitFor({ state: 'visible', timeout: 15_000 });
  const page = locator.page();
  const { box, obstruction } = await positionForClick(locator, page);

  await locator
    .evaluate((el) => el.classList.add('__demo_focus__'), undefined, { timeout: 1500 })
    .catch(() => {});
  await pointer.moveTo(box.x + box.width / 2, box.y + box.height / 2);
  await wait(hold);

  try {
    // Kept short on purpose: a few app panels paint over an open dropdown, and
    // the direct-dispatch fallback below is a better use of those seconds than
    // waiting out a hit-test that will never pass.
    await locator.click({ timeout: 4000 });
  } catch (error) {
    // Last resort: dispatch the click on the element itself. It bypasses hit
    // testing, so a stubborn overlay cannot block the beat — the cursor is
    // already parked on the control, so the recording still reads correctly.
    log?.warn(
      `Hit-tested click failed${obstruction ? ` (a <${obstruction.tag}> was over it)` : ''}; ` +
        'dispatching the click directly on the element.',
    );
    await locator.evaluate((el) => el.click());
  }

  await wait(140);
  // Most controls here unmount or rename themselves when clicked (Simulate
  // becomes Fighting, a card navigates away), so this cleanup must be given a
  // short leash rather than the context default — otherwise every click pays
  // a full auto-waiting timeout for an element that no longer exists.
  await locator
    .evaluate((el) => el.classList.remove('__demo_focus__'), undefined, { timeout: 1200 })
    .catch(() => {});
  await wait(settle);
}

/** Types one character at a time so the viewer can read the query forming. */
export async function humanType(locator, text, pointer, { delay = 95, settle = 700 } = {}) {
  await locator.waitFor({ state: 'visible', timeout: 15_000 });
  const { box } = await positionForClick(locator, locator.page());
  await pointer.moveTo(box.x + Math.min(box.width - 12, 60), box.y + box.height / 2);
  await locator.click({ timeout: 10_000 }).catch(() => locator.focus());
  await wait(240);
  await locator.fill('');
  await locator.pressSequentially(text, { delay });
  await wait(settle);
}

/**
 * Scrolls in small increments. The hero's camera is driven by scroll position,
 * so a single jump to the bottom would skip every beat of the story.
 */
export async function smoothScroll(
  page,
  { to = 'bottom', steps = 24, stepDelay = 210, target = null, clearFooter = false } = {},
) {
  const metrics = await page.evaluate(() => {
    const footer = document.querySelector('footer');
    return {
      top: window.scrollY,
      max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
      footerHeight: footer ? footer.getBoundingClientRect().height : 0,
    };
  });

  let destination;
  if (typeof to === 'number') destination = to;
  else if (to === 'top') destination = 0;
  // Scrolling to the true bottom parks the shot on the site footer, which is
  // the least interesting thing on any of these pages.
  else if (clearFooter) destination = Math.max(0, metrics.max - metrics.footerHeight);
  else destination = metrics.max;

  if (target) {
    const box = await page.locator(target).first().boundingBox().catch(() => null);
    if (box) destination = Math.min(metrics.max, metrics.top + box.y - 120);
  }

  const distance = destination - metrics.top;
  if (Math.abs(distance) < 8) return;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'auto' }), metrics.top + distance * e);
    await wait(stepDelay);
  }
}

/**
 * WebGL canvases composite asynchronously and `readPixels` comes back blank
 * once the frame is presented, so pixel-sampling the context is unreliable.
 * A PNG of an all-black canvas compresses to almost nothing, so the encoded
 * screenshot size is a robust proxy for "this canvas has drawn something".
 */
export async function waitForCanvasPaint(
  page,
  { selector = 'canvas', timeout = 25_000, minBytes = 12_000, settle = 1400, log } = {},
) {
  const canvas = page.locator(selector).first();
  try {
    await canvas.waitFor({ state: 'visible', timeout });
  } catch {
    log?.warn(`No visible <canvas> matched "${selector}" within ${timeout} ms.`);
    return false;
  }

  const deadline = Date.now() + timeout;
  let best = 0;
  while (Date.now() < deadline) {
    const shot = await canvas.screenshot({ timeout: 8000 }).catch(() => null);
    if (shot) {
      best = Math.max(best, shot.length);
      if (shot.length >= minBytes) {
        log?.info(`Canvas is rendering (${shot.length} B encoded); holding ${settle} ms to settle.`);
        await wait(settle);
        return true;
      }
    }
    await wait(600);
  }

  log?.warn(`Canvas stayed near-blank (best ${best} B < ${minBytes} B) — filming it anyway.`);
  await wait(settle);
  return false;
}

/** Cookie banners and dev overlays are the classic way to ruin a demo frame. */
export async function dismissOverlays(page, pointer, log) {
  const patterns = [
    /^(accept|accept all|allow all|got it|i agree|ok)$/i,
    /^(dismiss|close|no thanks)$/i,
  ];
  for (const pattern of patterns) {
    const button = page.getByRole('button', { name: pattern }).first();
    if (await button.isVisible().catch(() => false)) {
      log?.info(`Dismissing an overlay button matching ${pattern}.`);
      await showAndClick(button, pointer, { settle: 300 }).catch(() => {});
    }
  }

  // Next.js dev tools / error indicator would otherwise sit in the corner.
  await page
    .addStyleTag({
      content: `
        nextjs-portal, [data-nextjs-toast], #__next-build-watcher,
        [data-nextjs-dev-tools-button], [data-nextjs-devtools-panel] { display: none !important; }
      `,
    })
    .catch(() => {});
}

/**
 * Returns the first locator from an ordered candidate list that actually
 * resolves. Selectors are guesses while five agents reshape the DOM, so every
 * interaction gets a fallback chain instead of one brittle assumption.
 */
export async function firstVisible(candidates, { timeout = 6000, log } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const { name, locator } of candidates) {
      const first = locator.first();
      if (await first.isVisible().catch(() => false)) {
        log?.info(`Matched control via "${name}".`);
        return first;
      }
    }
    await wait(300);
  }
  log?.warn(`None of ${candidates.length} candidate selectors resolved: ${candidates.map((c) => c.name).join(', ')}.`);
  return null;
}

export { wait };
