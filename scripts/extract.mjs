// Phase 3: per-site extraction support. The extraction itself (looking at every block and writing
// data/instances/<slug>.json) is done by Claude/agents following methodology/EXTRACTION.md; this
// script prepares the evidence and validates the results.
//
//   node scripts/extract.mjs prepare [--only a,b] [--force]   evidence pack per site → archive/<slug>/pack/
//   node scripts/extract.mjs next [--n 8]                     next pending slugs (archived + cut, not extracted)
//   node scripts/extract.mjs check <slug>                     read-only validation of one site (for agents)
//   node scripts/extract.mjs sync                             validate data/instances/*.json, update tracker,
//                                                             build data/instances/index.json + methodology/proposals.md
// Only `sync` writes the tracker, so parallel agents never race on data/progress.json.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { ROOT, loadSites, loadProgress, statusOf, setSitePhase, readJson, writeJsonAtomic } from './lib/progress.mjs';

const { positionals: [cmd], values: args } = parseArgs({ allowPositionals: true, options: {
  only: { type: 'string' }, force: { type: 'boolean' }, n: { type: 'string', default: '8' },
} });
const M = path.join(ROOT, 'methodology');
const INSTANCES = path.join(ROOT, 'data', 'instances');
const FFMPEG = path.join(os.homedir(), '.cache/ms-playwright/ffmpeg-1011/ffmpeg-linux');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const label = (w, h, lines) => Buffer.from(`<svg width="${w}" height="${h}"><rect width="100%" height="100%" fill="#111"/>` +
  lines.map(([text, color, size, bold], i) => `<text x="6" y="${14 + i * 15}" font-family="DejaVu Sans, sans-serif" font-size="${size ?? 12}"${bold ? ' font-weight="bold"' : ''} fill="${color}">${esc(text)}</text>`).join('') + '</svg>');

// ---------- prepare ----------

// Top colours of an image: quantize to 3 bits/channel, return up to 5 hex colours by frequency.
async function palette(file) {
  const { data } = await sharp(file).resize(48, 48, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const bins = new Map();
  for (let i = 0; i < data.length; i += 3) {
    const key = ((data[i] >> 5) << 6) | ((data[i + 1] >> 5) << 3) | (data[i + 2] >> 5);
    const b = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2];
    bins.set(key, b);
  }
  const hex = (v) => Math.round(v).toString(16).padStart(2, '0');
  return [...bins.values()].sort((a, b) => b.n - a.n).filter((b) => b.n >= 46).slice(0, 5)
    .map((b) => ({ hex: `#${hex(b.r / b.n)}${hex(b.g / b.n)}${hex(b.b / b.n)}`, share: +(b.n / 2304).toFixed(2) }));
}

// Numbered overview sheets of all cropped blocks: 3×3 tiles showing the top of each block.
async function overviewSheets(blocks, dir) {
  const TW = 460, TH = 380, LH = 36, perSheet = 9;
  const withCrop = blocks.filter((b) => b.crop);
  const files = [];
  for (let p = 0; p * perSheet < withCrop.length; p++) {
    const items = withCrop.slice(p * perSheet, (p + 1) * perSheet);
    const comps = [];
    for (const [i, b] of items.entries()) {
      const left = (i % 3) * TW, top = Math.floor(i / 3) * (TH + LH);
      comps.push({ input: label(TW, LH, [[`#${b.nn}  ${b.kind}${b.sticky ? ' sticky' : ''} · ${(b.box.h / 900).toFixed(2)}vh · y=${b.box.y}`, '#ffd400', 13, true],
        [(b.headings[0] ?? b.textPreview ?? '').slice(0, 62), '#9cf', 11]]), left, top });
      // Full width, top of the block (tall blocks are cut at the tile height).
      const { data, info } = await sharp(path.join(ROOT, b.crop)).resize({ width: TW - 8 }).toBuffer({ resolveWithObject: true });
      const tile = info.height > TH - 4 ? await sharp(data).extract({ left: 0, top: 0, width: info.width, height: TH - 4 }).toBuffer() : data;
      comps.push({ input: tile, left: left + 4, top: top + LH });
    }
    const file = path.join(dir, `overview-${p + 1}.jpg`);
    await sharp({ create: { width: 3 * TW, height: Math.ceil(items.length / 3) * (TH + LH), channels: 3, background: '#666' } })
      .composite(comps).jpeg({ quality: 78 }).toFile(file);
    files.push(path.relative(ROOT, file));
  }
  return files;
}

// 4×4 storyboard from the scroll-through video: dense at the start (intro animations), then even.
async function storyboard(video, out) {
  if (!fs.existsSync(video) || !fs.existsSync(FFMPEG)) return null;
  let duration = 0;
  try { execFileSync(FFMPEG, ['-hide_banner', '-i', video], { stdio: 'pipe' }); } catch (e) {
    const m = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/);
    if (m) duration = +m[1] * 3600 + +m[2] * 60 + +m[3];
  }
  if (!duration) return null;
  const early = [0.3, 0.9, 1.6].filter((t) => t < duration);
  const rest = Array.from({ length: 16 - early.length }, (_, i) => 2.2 + (i * Math.max(0, duration - 2.7)) / Math.max(1, 15 - early.length));
  const times = [...early, ...rest].filter((t) => t < duration - 0.05);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-'));
  const comps = [];
  const TW = 360, TH = 225, LH = 18;
  for (const [i, t] of times.entries()) {
    const f = path.join(tmp, `${i}.png`);
    try { execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-ss', t.toFixed(2), '-i', video, '-frames:v', '1', f], { stdio: 'pipe' }); } catch { continue; }
    if (!fs.existsSync(f)) continue;
    const left = (i % 4) * TW, top = Math.floor(i / 4) * (TH + LH);
    comps.push({ input: label(TW, LH, [[`t=${t.toFixed(1)}s`, '#fff', 11]]), left, top });
    comps.push({ input: await sharp(f).resize(TW - 4, TH - 2, { fit: 'fill' }).toBuffer(), left: left + 2, top: top + LH });
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  if (!comps.length) return null;
  await sharp({ create: { width: 4 * TW, height: Math.ceil(times.length / 4) * (TH + LH), channels: 3, background: '#333' } }).composite(comps).jpeg({ quality: 75 }).toFile(out);
  return { file: path.relative(ROOT, out), duration: +duration.toFixed(1), note: 't<2s: before scrolling (intro); then the slow scroll-through, top to bottom' };
}

// Mobile full page folded into side-by-side columns so the whole page fits one image.
async function mobileStrip(shot, out) {
  if (!fs.existsSync(shot)) return null;
  const meta = await sharp(shot, { limitInputPixels: false }).metadata();
  const colH = 2400, cols = Math.min(8, Math.ceil(meta.height / colH)), CW = 220;
  const comps = [];
  for (let c = 0; c < cols; c++) {
    const h = Math.min(colH, meta.height - c * colH);
    if (h <= 0) break;
    const buf = await sharp(shot, { limitInputPixels: false }).extract({ left: 0, top: c * colH, width: meta.width, height: h }).resize({ width: CW }).toBuffer();
    comps.push({ input: buf, left: c * (CW + 6), top: 0 });
  }
  await sharp({ create: { width: cols * (CW + 6), height: Math.round((colH * CW) / meta.width), channels: 3, background: '#444' } }).composite(comps).jpeg({ quality: 75 }).toFile(out);
  return { file: path.relative(ROOT, out), mobileHeight: meta.height, truncated: meta.height > colH * 8 };
}

function siteFacts(site, cut, signals, meta) {
  const axes = new Set(Object.keys(signals?.variationSettings ?? {}).flatMap((v) => [...v.matchAll(/"(\w{4})"/g)].map((m) => m[1])));
  const features = new Set(Object.keys(signals?.featureSettings ?? {}).flatMap((v) => [...v.matchAll(/"(\w{4})"/g)].map((m) => m[1])));
  return {
    url: site.url, sourceUrl: meta?.sourceUrl, via: meta?.via, title: signals?.title, description: signals?.description,
    capture: { mode: meta?.desktop?.mode, segmentation: cut.segmentation, pageHeight: meta?.desktop?.pageHeight, scroll: meta?.scroll?.target },
    fonts: [...new Set((signals?.loadedFonts ?? []).map((f) => f.family))].slice(0, 30),
    axesUsed: [...axes], featuresUsed: [...features],
    animations: (signals?.animations ?? []).length, keyframesWithVariation: signals?.keyframesWithVariation ?? [],
    // Repeated testers (one slider set per row) would list the same range dozens of times: dedupe.
    interactivity: signals?.interactivity && { ...signals.interactivity, ranges: Object.values((signals.interactivity.ranges ?? []).reduce((m, r) => {
      const k = `${r.name ?? r.label}|${r.min}|${r.max}`;
      m[k] ??= { name: r.name, label: r.label, min: r.min, max: r.max, count: 0 };
      m[k].count++;
      return m;
    }, {})) },
    glyphGrids: signals?.glyphGrids?.map((g) => g.cells),
    prices: signals?.prices, actionLinks: signals?.actionLinks?.slice(0, 12), subpages: signals?.subpages?.length ?? 0,
    tech: Object.fromEntries(Object.entries(signals?.tech ?? {}).filter(([, v]) => v)),
  };
}

async function prepare(site) {
  const dir = path.join(ROOT, 'archive', site.slug);
  const pack = path.join(dir, 'pack');
  if (fs.existsSync(path.join(pack, 'facts.json')) && !args.force) return 'exists';
  fs.rmSync(pack, { recursive: true, force: true });
  fs.mkdirSync(pack, { recursive: true });
  const cut = readJson(path.join(ROOT, 'data', 'blocks', `${site.slug}.json`), null);
  const signals = readJson(path.join(dir, 'signals.json'), null);
  const meta = readJson(path.join(dir, 'meta.json'), null);
  const blocks = [];
  for (const b of cut.blocks) {
    const htmlFile = b.html && path.join(ROOT, b.html);
    blocks.push({ nn: b.nn, kind: b.kind, sticky: b.sticky, box: b.box, heightVh: +(b.box.h / 900).toFixed(2), tiny: b.box.h < 150,
      headings: b.headings, parentHeadings: b.parentHeadings, textPreview: b.textPreview, fontFamilies: b.fontFamilies,
      maxFontSizePx: b.maxFontSizePx, variationSettings: b.variationSettings, controls: b.controls, media: b.media,
      background: b.background, color: b.color, palette: b.crop ? await palette(path.join(ROOT, b.crop)) : null,
      crop: b.crop, cropTruncated: b.cropTruncated, html: b.html, htmlBytes: htmlFile && fs.existsSync(htmlFile) ? fs.statSync(htmlFile).size : 0 });
  }
  const facts = {
    slug: site.slug, site: siteFacts(site, cut, signals, meta), blocks,
    overview: await overviewSheets(cut.blocks, pack),
    storyboard: await storyboard(path.join(dir, 'scroll-desktop.webm'), path.join(pack, 'storyboard.jpg')),
    mobile: await mobileStrip(path.join(dir, 'full-mobile.jpg'), path.join(pack, 'mobile.jpg')),
  };
  writeJsonAtomic(path.join(pack, 'facts.json'), facts);
  return `${blocks.length} blocks, ${facts.overview.length} sheet(s)`;
}

// ---------- sync ----------

// Raw type/variant names as written by extractors, resolved through taxonomy.json aliases.
// `curated` is true when the result exists in the taxonomy (so it is no longer a proposal).
function canonical(taxonomy, inst) {
  const [type, variant] = (taxonomy.aliases[`${inst.type}/${inst.variant}`]?.to ?? `${inst.type}/${inst.variant}`).split('/');
  return { type, variant, curated: !!taxonomy.types[type]?.variants[variant] };
}

function validate(slug, doc, taxonomy, rubric, cut) {
  const errors = [], warnings = [];
  const nns = new Set(cut.blocks.map((b) => b.nn));
  if (doc.slug !== slug) errors.push(`slug is ${doc.slug}`);
  if (!Array.isArray(doc.instances) || !doc.instances.length) errors.push('no instances');
  const covered = new Set((doc.skipped ?? []).map((s) => s.block));
  for (const [i, inst] of (doc.instances ?? []).entries()) {
    const where = `instance ${i} (${inst.type}/${inst.variant})`;
    if (!Array.isArray(inst.blocks) || !inst.blocks.length) errors.push(`${where}: no blocks`);
    for (const nn of inst.blocks ?? []) { if (!nns.has(nn)) errors.push(`${where}: unknown block ${nn}`); covered.add(nn); }
    const c = canonical(taxonomy, inst);
    const t = taxonomy.types[c.type];
    if (!t && !inst.newType) errors.push(`${where}: unknown type (set newType + typeDefinition + section to propose one)`);
    if (inst.newType && (!inst.typeDefinition || !taxonomy.sections[inst.section])) errors.push(`${where}: newType needs typeDefinition and a valid section`);
    if (t && !c.curated && !inst.newVariant) errors.push(`${where}: unknown variant (set newVariant + variantDefinition to propose one)`);
    if ((inst.newVariant || inst.newType) && !c.curated && !inst.variantDefinition) errors.push(`${where}: newVariant needs variantDefinition`);
    const tiny = inst.blocks?.every((nn) => cut.blocks.find((b) => b.nn === nn)?.box.h < 150);
    const minimal = ['chrome', 'navigation', 'fragment'].includes(inst.type) || tiny;
    for (const f of ['look', 'feel', 'ux', 'learn']) if (!minimal && !inst[f]) errors.push(`${where}: missing ${f}`);
    if (!minimal && inst.type !== 'fragment') {
      if (!inst.reconstruction?.layout || !inst.reconstruction?.typography) errors.push(`${where}: reconstruction.layout and .typography are required`);
      for (const [k, spec] of Object.entries({ ...rubric.crossCutting, ...(rubric.perType[c.type] ?? {}) })) {
        if (spec.auto) continue; // measured from block features, not judged
        const v = inst.rubric?.[k];
        if (v === undefined) { warnings.push(`${where}: rubric.${k} missing`); continue; }
        const allowed = spec.multi ?? (Array.isArray(spec.values) ? spec.values : null);
        if (allowed?.length && ![v].flat().every((x) => allowed.includes(x))) warnings.push(`${where}: rubric.${k}=${JSON.stringify(v)} not in ${allowed.join('|')}`);
      }
    }
  }
  for (const b of cut.blocks) if (b.crop && !covered.has(b.nn)) errors.push(`block ${b.nn} (${b.kind}) not covered by an instance or skipped`);
  return { errors, warnings };
}

function sync() {
  const taxonomy = readJson(path.join(M, 'taxonomy.json'), null);
  const rubric = readJson(path.join(M, 'rubric.json'), null);
  const progress = loadProgress();
  const sectionOf = Object.fromEntries(Object.entries(taxonomy.sections).flatMap(([s, sec]) => sec.types.map((t) => [t, s])));
  const index = Object.fromEntries(Object.entries(taxonomy.sections).map(([s, sec]) => [s, { title: sec.title, types: Object.fromEntries(sec.types.map((t) => [t, {}])) }]));
  const proposals = [], report = [];
  let ok = 0, bad = 0;
  for (const site of loadSites()) {
    const file = path.join(INSTANCES, `${site.slug}.json`);
    if (!fs.existsSync(file)) continue;
    const doc = readJson(file, null);
    const cut = readJson(path.join(ROOT, 'data', 'blocks', `${site.slug}.json`), null);
    const { errors, warnings } = doc ? validate(site.slug, doc, taxonomy, rubric, cut) : { errors: ['unreadable JSON'], warnings: [] };
    if (errors.length) {
      bad++;
      if (statusOf(progress, site.slug, 'extract') !== 'failed' || progress.sites[site.slug].extract.reason !== errors[0])
        setSitePhase(progress, site.slug, 'extract', 'failed', { reason: `${errors.length} error(s): ${errors[0]}` });
      report.push(`✗ ${site.slug}: ${errors.slice(0, 5).join('; ')}`);
      continue;
    }
    ok++;
    const real = doc.instances.filter((i) => i.type !== 'fragment');
    if (statusOf(progress, site.slug, 'extract') !== 'done' || progress.sites[site.slug].extract.instances !== real.length)
      setSitePhase(progress, site.slug, 'extract', 'done', { instances: real.length, warnings: warnings.length });
    if (warnings.length) report.push(`⚠ ${site.slug}: ${warnings.length} rubric warning(s), e.g. ${warnings[0]}`);
    const sequence = [];
    for (const inst of real) {
      const c = canonical(taxonomy, inst);
      const sec = sectionOf[c.type] ?? inst.section;
      const ref = { id: `${site.slug}#${inst.blocks[0]}`, slug: site.slug, blocks: inst.blocks, crop: cut.blocks.find((b) => b.nn === inst.blocks[0])?.crop ?? null,
        exemplar: !!inst.exemplar, confidence: inst.confidence, proposed: !c.curated,
        ...((c.type !== inst.type || c.variant !== inst.variant) && { rawType: inst.type, rawVariant: inst.variant }) };
      ((index[sec].types[c.type] ??= {})[c.variant] ??= []).push(ref);
      if (!c.curated) proposals.push(`- **${c.type}/${c.variant}**${inst.newType ? ' (new type)' : ''} — ${inst.variantDefinition} _(${ref.id})_`);
      if (!['chrome', 'navigation'].includes(c.type) && sequence.at(-1) !== `${c.type}/${c.variant}`) sequence.push(`${c.type}/${c.variant}`);
    }
    if (JSON.stringify(doc.sequence) !== JSON.stringify(sequence)) writeJsonAtomic(file, { ...doc, sequence });
  }
  writeJsonAtomic(path.join(INSTANCES, 'index.json'), { generatedAt: new Date().toISOString(), sites: ok, sections: index });
  fs.writeFileSync(path.join(M, 'proposals.md'), ['# Variant proposals from Phase 3', '', '_Generated by `node scripts/extract.mjs sync`. Curate into taxonomy.json (add the variant, or alias it to an existing one), then re-run sync._', '', ...proposals].join('\n') + '\n');
  for (const r of report) console.log(r);
  console.log(`${ok} site(s) valid, ${bad} invalid; ${proposals.length} proposal(s) → methodology/proposals.md; index → data/instances/index.json`);
}

// ---------- main ----------

const progress = loadProgress();
const ready = (s) => statusOf(progress, s.slug, 'archive') === 'done' && statusOf(progress, s.slug, 'blocks') === 'done';
if (cmd === 'prepare') {
  let sites = loadSites().filter(ready);
  if (args.only) { const only = new Set(args.only.split(',')); sites = sites.filter((s) => only.has(s.slug)); }
  for (const s of sites) {
    try { console.log(`${s.n} ${s.slug}: ${await prepare(s)}`); } catch (e) { console.log(`✗ ${s.slug}: ${e.message.split('\n')[0]}`); }
  }
} else if (cmd === 'next') {
  const pending = loadSites().filter((s) => ready(s) && statusOf(progress, s.slug, 'extract') !== 'done' && !fs.existsSync(path.join(INSTANCES, `${s.slug}.json`)));
  console.log(pending.slice(0, +args.n).map((s) => s.slug).join('\n'));
} else if (cmd === 'sync') {
  sync();
} else if (cmd === 'check') {
  // Read-only validation of one site, safe to run from parallel agents (sync writes shared files).
  const slug = process.argv[3];
  const doc = readJson(path.join(INSTANCES, `${slug}.json`), null);
  const cut = readJson(path.join(ROOT, 'data', 'blocks', `${slug}.json`), null);
  if (!doc || !cut) { console.log(`✗ ${slug}: ${doc ? 'unknown site' : 'missing or unreadable data/instances file'}`); process.exit(1); }
  const { errors, warnings } = validate(slug, doc, readJson(path.join(M, 'taxonomy.json'), null), readJson(path.join(M, 'rubric.json'), null), cut);
  for (const e of errors) console.log(`✗ ${e}`);
  for (const w of warnings) console.log(`⚠ ${w}`);
  console.log(errors.length ? `${slug}: ${errors.length} error(s)` : `${slug}: valid (${warnings.length} warning(s))`);
  process.exit(errors.length ? 1 : 0);
} else {
  console.log('usage: node scripts/extract.mjs prepare|next|sync');
}
