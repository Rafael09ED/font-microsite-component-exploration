// Phase 1: archive every site — rendered DOM, full-page screenshots (desktop + mobile),
// a scroll-through video, the block outline, and page signals. Resumable via data/progress.json.
//
//   npm run archive                          all pending sites
//   npm run archive -- --limit 3             first 3 pending
//   npm run archive -- --only a,b            these slugs (also re-runs them if done, with --force)
//   npm run archive -- --retry-failed        include previously failed sites
//   npm run archive -- --concurrency 2
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { ROOT, loadSites, loadProgress, needsWork, setSitePhase, writeJsonAtomic } from './lib/progress.mjs';
import { extractOutline, extractSignals } from './lib/page-extract.mjs';

const { values: args } = parseArgs({ options: {
  limit: { type: 'string' }, only: { type: 'string' }, force: { type: 'boolean' },
  'retry-failed': { type: 'boolean' }, concurrency: { type: 'string', default: '3' },
} });

const ARCHIVE = path.join(ROOT, 'archive');
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const MAX_SHOT_HEIGHT = 30000; // very long pages get clipped rather than failing the screenshot
const BOT_WALL = /just a moment|attention required|access denied|verify you are human/i;
// Headless Chromium announces itself as "HeadlessChrome", which some hosts answer with 403.
const DESKTOP_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
// Hand-curated replacements for dead or moved sites (e.g. Wayback Machine snapshots), keyed by slug.
const OVERRIDES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'url-overrides.json'), 'utf8'));

const progress = loadProgress();
let queue = loadSites();
if (args.only) { const only = new Set(args.only.split(',')); queue = queue.filter((s) => only.has(s.slug)); }
queue = queue.filter((s) => needsWork(progress, s.slug, 'archive', { retryFailed: args['retry-failed'], force: args.force }));
if (args.limit) queue = queue.slice(0, +args.limit);
console.log(`${queue.length} site(s) to archive`);

// handleSIGINT: false so Ctrl+C lets the current sites finish instead of killing the browser under them.
const browser = await chromium.launch({ channel: 'chromium', handleSIGINT: false });
let stopping = false;
process.on('SIGINT', () => { stopping = true; console.log('\nstopping after current sites… (Ctrl+C again to abort)'); process.once('SIGINT', () => process.exit(130)); });

// Navigate without requiring the 'load' event: heavy pages can keep loading media long after
// the DOM is usable. Returns the main response.
async function open(page, url) {
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
  return res;
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
}

// Work out how the page scrolls. Three models:
//   axis 'y' — the window or an inner container scrolls vertically (most sites; GT America scrolls <body>)
//   axis 'x' — the window or an inner container scrolls horizontally (e.g. DJR Bungee)
//   axis null — nothing scrolls natively: single-screen apps, or wheel-hijacked transform scrolling
// The chosen container gets a data-archive-scroller marker and the axis is stored on <html>,
// so scrolling, measuring and extractOutline all agree.
async function markScroller(page) {
  return page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    const mark = (axis, el) => {
      document.documentElement.dataset.archiveAxis = axis;
      if (el) el.setAttribute('data-archive-scroller', '');
      return { axis, target: el ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className).slice(0, 60)}` : 'window' };
    };
    if (root.scrollHeight > innerHeight * 1.2) return mark('y', null);
    const scrolls = (el, axis) => {
      const [sz, cl, ov, clDim, min] = axis === 'y'
        ? [el.scrollHeight, el.clientHeight, getComputedStyle(el).overflowY, el.clientWidth, innerWidth]
        : [el.scrollWidth, el.clientWidth, getComputedStyle(el).overflowX, el.clientHeight, innerHeight];
      return sz > cl + 100 && cl >= (axis === 'y' ? innerHeight : innerWidth) * 0.6 && clDim >= min * 0.6 && ['auto', 'scroll', 'overlay'].includes(ov);
    };
    let best = null, bestAxis = null;
    for (const el of document.querySelectorAll('body, body *'))
      for (const axis of ['y', 'x'])
        if (scrolls(el, axis)) {
          const extent = axis === 'y' ? el.scrollHeight / innerHeight : el.scrollWidth / innerWidth;
          if (!best || extent > best.extent) { best = { el, extent }; bestAxis = axis; }
        }
    if (best) return mark(bestAxis, best.el);
    if (root.scrollWidth > innerWidth * 1.5) return mark('x', null);
    return { axis: null, target: null };
  });
}

// In-page helpers shared by the evaluate calls below (passed as source text).
const SCROLL_HELPERS = `
  const s = document.querySelector('[data-archive-scroller]');
  const axis = document.documentElement.dataset.archiveAxis || 'y';
  const extent = axis === 'y' ? (s ? s.scrollHeight : document.documentElement.scrollHeight) : (s ? s.scrollWidth : document.documentElement.scrollWidth);
  const view = axis === 'y' ? (s ? Math.min(s.clientHeight, innerHeight) : innerHeight) : (s ? Math.min(s.clientWidth, innerWidth) : innerWidth);
  const pos = () => Math.round(axis === 'y' ? (s ? s.scrollTop : scrollY) : (s ? s.scrollLeft : scrollX));
  const go = (p) => (s ?? window).scrollTo({ [axis === 'y' ? 'top' : 'left']: p, behavior: 'instant' });`;
const scrollMetrics = (page) => page.evaluate(`(() => { ${SCROLL_HELPERS} return { axis, extent, step: view, vw: innerWidth, vh: innerHeight }; })()`);
// Scrolls along the page's axis and returns the position the browser actually reached.
const scrollTo = (page, p) => page.evaluate(`(() => { ${SCROLL_HELPERS} go(${p}); return pos(); })()`);

// Scroll slowly to the end to trigger lazy-loading and scroll animations, then return to the start.
async function scrollThrough(page, { stepRatio = 0.8, delay = 250, maxMs = 45000 } = {}) {
  const t0 = Date.now();
  let p = 0;
  while (Date.now() - t0 < maxMs) {
    const { extent, step } = await scrollMetrics(page);
    if (p + step >= extent || p > 60000) break;
    p += Math.round(step * stepRatio);
    await scrollTo(page, p);
    await page.waitForTimeout(delay);
  }
  await page.waitForTimeout(800);
  await scrollTo(page, 0);
  await page.waitForTimeout(500);
}

const viewportShot = (page) => page.screenshot({ type: 'png', scale: 'css', animations: 'allow', timeout: 30000 });

// Full-page image stitched from viewport screenshots taken while scrolling. A single fullPage
// screenshot misses sections that only reveal while in view (and hide again when they leave);
// stitching records what a visitor sees at each scroll position. Fixed elements repeat per tile.
// Horizontal pages are stitched left to right.
async function fullShot(page, file) {
  const { axis, extent, step, vw, vh } = await scrollMetrics(page);
  const total = Math.min(extent, MAX_SHOT_HEIGHT * (axis === 'x' ? 2 : 1));
  const view = axis === 'y' ? vh : vw;
  const tiles = [];
  for (let p = 0; p < total; p += step) {
    await scrollTo(page, p);
    await page.waitForTimeout(500);
    const at = await scrollTo(page, p); // the browser clamps the last tile
    let buf = await viewportShot(page);
    const fit = Math.min(view, total - at);
    if (fit <= 0) continue;
    if (fit < view) buf = await sharp(buf).extract(axis === 'y' ? { left: 0, top: 0, width: vw, height: fit } : { left: 0, top: 0, width: fit, height: vh }).toBuffer();
    tiles.push({ input: buf, left: axis === 'y' ? 0 : at, top: axis === 'y' ? at : 0 });
  }
  await scrollTo(page, 0);
  const [width, height] = axis === 'y' ? [vw, total] : [total, vh];
  await sharp({ create: { width, height, channels: 3, background: '#ffffff' }, limitInputPixels: false })
    .composite(tiles).jpeg({ quality: 72 }).toFile(file);
  return { mode: axis === 'y' ? 'vertical' : 'horizontal', pageHeight: height, pageWidth: width, clipped: extent > total, tiles: tiles.length };
}

// Tiny greyscale thumbnail, to tell whether two screenshots differ meaningfully.
const signature = (buf) => sharp(buf).resize(48, 30, { fit: 'fill' }).greyscale().raw().toBuffer();
const sigDiff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;

// For pages that don't scroll natively: send wheel events and keep each screen that changed more
// than the page changes on its own (animated pages change without input). Screens are stacked
// vertically; mode 'single' means the wheel did nothing (a one-screen app).
async function wheelShot(page, file) {
  const { vw, vh } = await scrollMetrics(page);
  const frames = [await viewportShot(page)];
  let last = await signature(frames[0]);
  await page.waitForTimeout(800);
  const idle = sigDiff(last, await signature(await viewportShot(page)));
  await page.mouse.move(vw / 2, vh / 2);
  for (let i = 0, still = 0; i < 40 && still < 2; i++) {
    await page.mouse.wheel(0, Math.round(vh * 0.9));
    await page.waitForTimeout(900);
    const buf = await viewportShot(page);
    const sig = await signature(buf);
    if (sigDiff(last, sig) > Math.max(3, idle * 2)) { frames.push(buf); last = sig; still = 0; } else still++;
  }
  await sharp({ create: { width: vw, height: vh * frames.length, channels: 3, background: '#ffffff' }, limitInputPixels: false })
    .composite(frames.map((input, k) => ({ input, left: 0, top: k * vh }))).jpeg({ quality: 72 }).toFile(file);
  return { mode: frames.length > 1 ? 'wheel' : 'single', pageHeight: vh * frames.length, pageWidth: vw, tiles: frames.length, idleDiff: +idle.toFixed(2) };
}

async function archiveSite(site) {
  const dir = path.join(ARCHIVE, site.slug);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const url = OVERRIDES[site.slug]?.url ?? site.url;
  const meta = { slug: site.slug, url: site.url, sourceUrl: url, via: OVERRIDES[site.slug]?.via ?? 'live',
    archivedAt: new Date().toISOString(), consoleErrors: 0, fontRequests: [] };

  // Desktop: video of the scroll-through, DOM, outline, signals, screenshot.
  const ctx = await browser.newContext({ viewport: DESKTOP, userAgent: DESKTOP_UA, recordVideo: { dir, size: { width: 1280, height: 800 } }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') meta.consoleErrors++; });
  page.on('response', (r) => { if (r.request().resourceType() === 'font') meta.fontRequests.push({ url: r.url(), status: r.status() }); });
  try {
    const res = await open(page, url);
    meta.status = res?.status() ?? null;
    meta.finalUrl = page.url();
    if (meta.status >= 400) throw new Error(`HTTP ${meta.status}`);
    await settle(page);
    const title = await page.title();
    if (BOT_WALL.test(title)) throw new Error(`bot wall: "${title}"`);
    await page.waitForTimeout(1500); // let intro animations play on camera
    meta.scroll = await markScroller(page);
    if (meta.scroll.axis) { await scrollThrough(page); await settle(page); }
    fs.writeFileSync(path.join(dir, 'dom.html'), await page.content());
    writeJsonAtomic(path.join(dir, 'outline-desktop.json'), await page.evaluate(extractOutline));
    writeJsonAtomic(path.join(dir, 'signals.json'), await page.evaluate(extractSignals));
    meta.desktop = meta.scroll.axis ? await fullShot(page, path.join(dir, 'full-desktop.jpg')) : await wheelShot(page, path.join(dir, 'full-desktop.jpg'));
  } finally {
    const video = page.video();
    await ctx.close();
    if (video) fs.renameSync(await video.path(), path.join(dir, 'scroll-desktop.webm'));
  }

  // Mobile: layout adaptation only (screenshot + outline).
  const mctx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  const mpage = await mctx.newPage();
  try {
    await open(mpage, url);
    await settle(mpage);
    const { axis } = await markScroller(mpage);
    if (axis) await scrollThrough(mpage, { delay: 150, maxMs: 25000 });
    writeJsonAtomic(path.join(dir, 'outline-mobile.json'), await mpage.evaluate(extractOutline));
    meta.mobile = axis ? await fullShot(mpage, path.join(dir, 'full-mobile.jpg')) : await wheelShot(mpage, path.join(dir, 'full-mobile.jpg'));
  } catch (e) {
    meta.mobileError = e.message.split('\n')[0];
  } finally {
    await mctx.close();
  }

  writeJsonAtomic(path.join(dir, 'meta.json'), meta);
  return meta;
}

async function worker() {
  while (queue.length && !stopping) {
    const site = queue.shift();
    const t0 = Date.now();
    setSitePhase(progress, site.slug, 'archive', 'running');
    try {
      const meta = await archiveSite(site);
      const outline = JSON.parse(fs.readFileSync(path.join(ARCHIVE, site.slug, 'outline-desktop.json'), 'utf8'));
      setSitePhase(progress, site.slug, 'archive', 'done', { blocks: outline.blocks.length, ...(meta.mobileError && { warning: `mobile: ${meta.mobileError}` }) });
      setSitePhase(progress, site.slug, 'blocks', 'pending'); // a new archive invalidates the old cut
      console.log(`✓ ${site.n} ${site.slug} (${outline.blocks.length} blocks, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    } catch (e) {
      const reason = e.message.split('\n')[0].slice(0, 200);
      setSitePhase(progress, site.slug, 'archive', 'failed', { reason });
      console.log(`✗ ${site.n} ${site.slug}: ${reason}`);
    }
  }
}

await Promise.all(Array.from({ length: +args.concurrency }, worker));
await browser.close();
console.log('done — see PROGRESS.md');
