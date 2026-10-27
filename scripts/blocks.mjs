// Phase 2.1: rough-cut each archived page into unlabelled blocks.
// Refines the archived outline into a flat list of leaf blocks, crops each from the full-page
// screenshot, saves its HTML, and computes a feature vector + text hints used for sampling/clustering.
//
//   npm run blocks [-- --only a,b] [-- --force] [-- --limit N]
//
// Writes data/blocks/<slug>.json (committed) and archive/<slug>/blocks/NN.{jpg,html} (ignored).
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import * as cheerio from 'cheerio';
import { ROOT, loadSites, loadProgress, needsWork, setSitePhase, statusOf, writeJsonAtomic } from './lib/progress.mjs';

const { values: args } = parseArgs({ options: {
  limit: { type: 'string' }, only: { type: 'string' }, force: { type: 'boolean' }, 'retry-failed': { type: 'boolean' },
} });

const CROP_WIDTH = 720;      // thumbnail width for contact sheets
const CROP_MAX_H = 2400;     // taller crops keep only their top part
const HTML_MAX = 300_000;

// Text hints: cheap keyword cues, used to diversify the sample and as clustering features.
// They are hints for a human/LLM reviewer, not labels.
export const HINTS = {
  commerce: /\b(buy|price|pricing|licen[cs]e|licensing|cart|checkout|purchase|desktop|webfont|app license|order)\b/i,
  glyphs: /\b(glyphs?|character set|charset|unicode|characters)\b/i,
  legal: /(©|\bimprint\b|\bimpressum\b|\bprivacy\b|\bterms\b|\bcookies?\b|\ball rights reserved\b|\bcolophon\b)/i,
  story: /\b(history|story|inspired|origins?|began|archive|revival|designer|designed by|the idea|we wanted)\b/i,
  features: /\b(opentype|features?|alternates?|ligatures?|stylistic|ss0\d|tabular|fractions|small caps|kerning|contextual)\b/i,
  tester: /\b(type tester|type here|try it|test|your text|edit this)\b/i,
  languages: /\b(languages?|scripts?|cyrillic|greek|arabic|hebrew|devanagari|vietnamese|latin extended|thai|korean|japanese|chinese)\b/i,
  freeOpen: /\b(download|github|open[- ]source|free|ofl|sil open font|google fonts)\b/i,
  family: /\b(weights?|styles?|family|variable|axes|axis|widths?|italics?|optical size)\b/i,
  newsletter: /\b(newsletter|subscribe|sign up|e-?mail)\b/i,
};

const luminance = (rgb) => {
  const m = rgb?.match(/[\d.]+/g);
  if (!m || (m.length === 4 && +m[3] === 0)) return null; // transparent
  const [r, g, b] = m.slice(0, 3).map((v) => { const c = +v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return +(0.2126 * r + 0.7152 * g + 0.0722 * b).toFixed(3);
};
const log = (n) => +Math.log1p(n ?? 0).toFixed(3);

// Fraction of [0, height) covered by the union of the blocks' vertical extents.
function coverage(blocks, height) {
  const iv = blocks.map((b) => [Math.max(0, b.box.y), Math.min(height, b.box.y + b.box.h)]).filter(([a, z]) => z > a).sort((p, q) => p[0] - q[0]);
  let covered = 0, end = 0;
  for (const [a, z] of iv) { if (z > end) { covered += z - Math.max(a, end); end = z; } }
  return height ? covered / height : 0;
}

// Placeholder outline fields for screen blocks, which have no single DOM element.
const EMPTY_BLOCK = { classes: [], headings: [], textPreview: '', textLength: 0, elementCount: 0, fontFamilies: [], distinctFontSizes: 0,
  maxFontSizePx: 0, maxFontVsViewport: 0, singleCharLeaves: 0, variationSettings: [], links: 0, background: null, color: null,
  controls: { range: 0, text: 0, contenteditable: 0, checkbox: 0, select: 0, buttons: 0, color: 0 },
  media: { img: 0, svg: 0, video: 0, canvas: 0, iframe: 0 } };

// Borrow headings/text from DOM blocks overlapping a screen, so screens still get keyword hints.
function textWithin(blocks, top, bottom) {
  const hit = blocks.filter((b) => b.box.y < bottom && b.box.y + b.box.h > top);
  return { headings: hit.flatMap((b) => b.headings).slice(0, 4), textPreview: hit.map((b) => b.textPreview).join(' ').slice(0, 240) };
}

// Decide which outline entries become leaf blocks and what kind each is.
function refine(outline) {
  const { blocks, pageHeight, viewport } = outline;
  const pageWidth = outline.axis === 'x' ? outline.pageWidth : viewport.w;
  const childrenOf = new Map();
  for (const b of blocks) if (b.parent != null) (childrenOf.get(b.parent) ?? childrenOf.set(b.parent, []).get(b.parent)).push(b);

  const leaves = [];
  // Use a block's children instead of the block when they cover most of it; recurse.
  const walk = (b, kind, parentHeadings) => {
    const kids = childrenOf.get(b.i) ?? [];
    const covered = kids.reduce((s, k) => s + k.box.h, 0);
    if (kind === 'flow' && kids.length && covered >= b.box.h * 0.6)
      for (const k of kids) walk(k, 'flow', b.headings.length ? b.headings : parentHeadings);
    else leaves.push({ ...b, kind, parentHeadings });
  };
  for (const b of blocks.filter((b) => b.depth === 0)) {
    // Sticky elements stay in the flow (their box is where they sit at scroll top); fixed ones float.
    const fixed = b.position === 'fixed';
    if (fixed && b.textLength === 0 && b.elementCount <= 3) continue; // empty scrims, blackouts
    let kind = 'flow';
    if (b.box.y + b.box.h <= 0 || b.box.y >= pageHeight || b.box.x >= pageWidth || b.box.x + b.box.w <= 0) kind = 'offscreen';
    else if (fixed) kind = 'fixed';
    walk(b, kind, null);
  }
  // A flow leaf that vertically contains two or more other flow leaves is a background layer or
  // wrapper sitting beside the content (e.g. a full-page decoration div on DJR sites), not a component.
  const flow = leaves.filter((b) => b.kind === 'flow');
  const contains = (a, b) => a !== b && b.box.y >= a.box.y - 4 && b.box.y + b.box.h <= a.box.y + a.box.h + 4;
  const wrappers = new Set(flow.filter((a) => flow.filter((b) => contains(a, b)).length >= 2));
  const kept = leaves.filter((b) => !wrappers.has(b));
  // Flow blocks in reading order; fixed/offscreen ones after.
  const rank = { flow: 0, fixed: 1, offscreen: 2 };
  kept.sort((a, b) => rank[a.kind] - rank[b.kind] || a.box.y - b.box.y);
  return kept;
}

function features(b, idx, flowCount, outline) {
  const vh = outline.viewport.h, vw = outline.viewport.w;
  const bgL = luminance(b.background), fgL = luminance(b.color);
  const text = [b.headings.join(' '), b.textPreview].join(' ');
  const hints = Object.fromEntries(Object.entries(HINTS).map(([k, re]) => [k, re.test(text)]));
  hints.price = /(?:[€$£¥]|CHF|USD|EUR|GBP)\s?\d|\d\s?(?:[€$£]|CHF|USD|EUR|GBP)\b/.test(b.textPreview);
  return {
    hints,
    vector: {
      order: flowCount > 1 ? +(idx / (flowCount - 1)).toFixed(3) : 0,
      relY: +(b.box.y / outline.pageHeight).toFixed(3),
      heightVh: log(b.box.h / vh), widthRatio: +(b.box.w / vw).toFixed(3),
      text: log(b.textLength), elements: log(b.elementCount), headings: b.headings.length,
      fontSizes: b.distinctFontSizes, maxFontVw: b.maxFontVsViewport, singleChar: log(b.singleCharLeaves),
      varSettings: b.variationSettings.length,
      range: log(b.controls.range), textInput: log(b.controls.text + b.controls.contenteditable),
      toggles: log(b.controls.checkbox + b.controls.select), buttons: log(b.controls.buttons),
      img: log(b.media.img), svg: log(b.media.svg), video: log(b.media.video), canvas: log(b.media.canvas), iframe: log(b.media.iframe),
      links: log(b.links), bgLum: bgL ?? -1, fgLum: fgL ?? -1,
    },
  };
}

async function cropBlock(shot, meta, box, out) {
  const top = Math.max(0, box.y), left = Math.max(0, Math.min(box.x, meta.width - 1));
  const width = Math.min(box.w, meta.width - left), height = Math.min(box.h, meta.height - top);
  if (width < 20 || height < 20) return null;
  const scale = CROP_WIDTH / width;
  const srcH = Math.min(height, Math.round(CROP_MAX_H / Math.min(scale, 1)));
  await sharp(shot).extract({ left, top, width, height: srcH }).resize({ width: Math.min(CROP_WIDTH, width) }).jpeg({ quality: 70 }).toFile(out);
  return { truncated: srcH < height };
}

async function cutSite(site) {
  const dir = path.join(ROOT, 'archive', site.slug);
  const outline = JSON.parse(fs.readFileSync(path.join(dir, 'outline-desktop.json'), 'utf8'));
  const shot = path.join(dir, 'full-desktop.jpg');
  const meta = await sharp(shot).metadata();
  const $ = cheerio.load(fs.readFileSync(path.join(dir, 'dom.html'), 'utf8'));
  const bdir = path.join(dir, 'blocks');
  fs.rmSync(bdir, { recursive: true, force: true });
  fs.mkdirSync(bdir, { recursive: true });

  const capture = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')).desktop ?? {};
  let leaves = refine(outline);
  // Fallback for paged/app-like sites whose DOM boxes don't map to scroll position (Readymag pages,
  // wheel-hijacked scrolling, single-screen apps): cut the stitched screenshot into one block per screen.
  const wheel = capture.mode === 'wheel' || capture.mode === 'single';
  const shotH = wheel ? meta.height : Math.min(meta.height, outline.pageHeight);
  const flowLeaves = leaves.filter((b) => b.kind === 'flow');
  const horizontal = capture.mode === 'horizontal';
  const segmentation = wheel || (!horizontal && (flowLeaves.length < 2 || coverage(flowLeaves, shotH) < 0.5)) ? 'screens' : 'dom';
  if (segmentation === 'screens') {
    const vh = outline.viewport.h;
    const screens = Array.from({ length: Math.max(1, Math.ceil(shotH / vh)) }, (_, k) => ({
      ...EMPTY_BLOCK, kind: 'screen', tag: 'screen', selector: null,
      box: { x: 0, y: k * vh, w: outline.viewport.w, h: Math.min(vh, shotH - k * vh) },
      ...textWithin(flowLeaves, k * vh, (k + 1) * vh),
    })).filter((s) => s.box.h >= 40);
    leaves = [...screens, ...leaves.filter((b) => b.kind !== 'flow')];
  }
  const flowCount = leaves.filter((b) => b.kind === 'flow' || b.kind === 'screen').length;
  const out = [];
  for (const [i, b] of leaves.entries()) {
    const nn = String(i).padStart(2, '0');
    let html = null;
    if (b.selector) try { html = $.html($(b.selector).first().clone().find('script,style').remove().end()) || null; } catch {}
    if (html) fs.writeFileSync(path.join(bdir, `${nn}.html`), html.slice(0, HTML_MAX));
    const crop = b.kind === 'flow' || b.kind === 'screen' ? await cropBlock(shot, meta, b.box, path.join(bdir, `${nn}.jpg`)) : null;
    const { hints, vector } = features(b, i, flowCount, outline);
    out.push({
      id: `${site.slug}#${nn}`, nn, kind: b.kind, sticky: b.position === 'sticky', tag: b.tag, selector: b.selector, classes: b.classes, box: b.box,
      headings: b.headings, parentHeadings: b.parentHeadings ?? null, textPreview: b.textPreview,
      fontFamilies: b.fontFamilies, maxFontSizePx: b.maxFontSizePx, variationSettings: b.variationSettings,
      controls: b.controls, media: b.media, background: b.background, color: b.color,
      hints, vector, crop: crop ? `archive/${site.slug}/blocks/${nn}.jpg` : null, cropTruncated: crop?.truncated ?? null,
      html: html ? `archive/${site.slug}/blocks/${nn}.html` : null,
    });
  }
  writeJsonAtomic(path.join(ROOT, 'data', 'blocks', `${site.slug}.json`), { slug: site.slug, url: site.url, pageHeight: outline.pageHeight, segmentation, blocks: out });
  return out;
}

const progress = loadProgress();
let queue = loadSites().filter((s) => statusOf(progress, s.slug, 'archive') === 'done');
if (args.only) { const only = new Set(args.only.split(',')); queue = queue.filter((s) => only.has(s.slug)); }
queue = queue.filter((s) => needsWork(progress, s.slug, 'blocks', { retryFailed: args['retry-failed'], force: args.force }));
if (args.limit) queue = queue.slice(0, +args.limit);
console.log(`${queue.length} archived site(s) to cut`);

for (const site of queue) {
  try {
    const blocks = await cutSite(site);
    const kinds = blocks.reduce((m, b) => ({ ...m, [b.kind]: (m[b.kind] ?? 0) + 1 }), {});
    setSitePhase(progress, site.slug, 'blocks', 'done', { blocks: blocks.length, kinds });
    console.log(`✓ ${site.n} ${site.slug}: ${blocks.length} blocks ${JSON.stringify(kinds)}`);
  } catch (e) {
    setSitePhase(progress, site.slug, 'blocks', 'failed', { reason: e.message.split('\n')[0].slice(0, 200) });
    console.log(`✗ ${site.n} ${site.slug}: ${e.message.split('\n')[0]}`);
  }
}
