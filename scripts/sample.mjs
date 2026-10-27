// Phase 2.2: draw a varied sample of blocks across all cut sites and render contact sheets.
// Grouping is by component, so the sample is drawn from the pool of blocks, not per site.
//   - "diverse": farthest-point sampling over normalized feature vectors (surfaces the unusual)
//   - "typical": seeded random, stratified by position on the page (top / middle / bottom)
// At most MAX_PER_SITE blocks per site so template families don't dominate.
//
//   npm run sample [-- --n 250] [-- --seed 7]
//
// Writes methodology/sample.json + methodology/sample.html (committed),
// and archive/_sheets/sheet-NN.jpg (contact sheets for review, ignored).
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { ROOT, writeJsonAtomic } from './lib/progress.mjs';

const { values: args } = parseArgs({ options: { n: { type: 'string', default: '250' }, seed: { type: 'string', default: '7' } } });
const N = +args.n, MAX_PER_SITE = 3;
const SHEET = { cols: 3, rows: 3, tileW: 440, tileH: 380, labelH: 34 };

function rng(seed) { // mulberry32
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rand = rng(+args.seed);

const pool = [];
for (const f of fs.readdirSync(path.join(ROOT, 'data', 'blocks')).filter((f) => f.endsWith('.json'))) {
  const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'blocks', f), 'utf8'));
  // Blocks under 150px (nav strips, banners) stay in data/blocks but would crowd the sample.
  for (const b of site.blocks) if ((b.kind === 'flow' || b.kind === 'screen') && b.crop && b.box.h >= 150) pool.push({ ...b, slug: site.slug });
}
console.log(`${pool.length} candidate blocks from ${new Set(pool.map((b) => b.slug)).size} sites`);

// z-score each feature dimension so no single feature dominates distances.
const dims = Object.keys(pool[0].vector);
const stats = dims.map((d) => {
  const v = pool.map((b) => b.vector[d]);
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length) || 1;
  return { mean, sd };
});
for (const b of pool) b.z = dims.map((d, i) => (b.vector[d] - stats[i].mean) / stats[i].sd);
const dist = (a, b) => Math.sqrt(a.z.reduce((s, v, i) => s + (v - b.z[i]) ** 2, 0));

const chosen = new Map(); // id -> reason
const perSite = new Map();
const canTake = (b) => !chosen.has(b.id) && (perSite.get(b.slug) ?? 0) < MAX_PER_SITE;
const take = (b, reason) => { chosen.set(b.id, reason); perSite.set(b.slug, (perSite.get(b.slug) ?? 0) + 1); };

// Farthest-point sampling for half the sample.
const minDist = new Map(pool.map((b) => [b.id, Infinity]));
let next = pool[Math.floor(rand() * pool.length)];
while (chosen.size < Math.floor(N / 2) && next) {
  take(next, 'diverse');
  for (const b of pool) minDist.set(b.id, Math.min(minDist.get(b.id), dist(b, next)));
  next = pool.filter(canTake).sort((a, b) => minDist.get(b.id) - minDist.get(a.id))[0];
}

// Stratified random for the rest: top (first block), middle, bottom (last 20% of the page).
const bucket = (b) => (b.vector.order === 0 ? 'top' : b.vector.relY > 0.8 ? 'bottom' : 'middle');
const shuffled = pool.slice().sort(() => rand() - 0.5);
const quotas = { top: 0.25, middle: 0.5, bottom: 0.25 };
const remaining = N - chosen.size;
for (const [bk, q] of Object.entries(quotas)) {
  let want = Math.round(remaining * q);
  for (const b of shuffled) { if (!want) break; if (bucket(b) === bk && canTake(b)) { take(b, 'typical'); want--; } }
}

// Order the sample by page position so sheets read top-of-page → bottom.
const sample = pool.filter((b) => chosen.has(b.id))
  .sort((a, b) => a.vector.relY - b.vector.relY || a.id.localeCompare(b.id))
  .map((b, i) => ({ s: i + 1, id: b.id, slug: b.slug, reason: chosen.get(b.id), position: bucket(b), relY: b.vector.relY,
    heightVh: +Math.expm1(b.vector.heightVh).toFixed(2), headings: b.headings, textPreview: b.textPreview.slice(0, 160),
    hints: Object.keys(b.hints).filter((k) => b.hints[k]), crop: b.crop, html: b.html }));

fs.mkdirSync(path.join(ROOT, 'methodology'), { recursive: true });
writeJsonAtomic(path.join(ROOT, 'methodology', 'sample.json'), sample);
console.log(`sampled ${sample.length} blocks from ${new Set(sample.map((b) => b.slug)).size} sites ` +
  `(${sample.filter((b) => b.reason === 'diverse').length} diverse, ${sample.filter((b) => b.reason === 'typical').length} typical)`);

// Contact sheets: tiles show the top of each block (cover, anchored top) with a label strip.
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const sheetDir = path.join(ROOT, 'archive', '_sheets');
fs.rmSync(sheetDir, { recursive: true, force: true });
fs.mkdirSync(sheetDir, { recursive: true });
const perSheet = SHEET.cols * SHEET.rows;
const W = SHEET.cols * SHEET.tileW, cellH = SHEET.tileH + SHEET.labelH;
for (let p = 0; p * perSheet < sample.length; p++) {
  const items = sample.slice(p * perSheet, (p + 1) * perSheet);
  const comps = [];
  for (const [i, b] of items.entries()) {
    const left = (i % SHEET.cols) * SHEET.tileW, top = Math.floor(i / SHEET.cols) * cellH;
    const tile = await sharp(path.join(ROOT, b.crop)).resize({ width: SHEET.tileW - 8, height: SHEET.tileH - 4, fit: 'cover', position: 'top' }).toBuffer();
    const label = `<svg width="${SHEET.tileW}" height="${SHEET.labelH}"><rect width="100%" height="100%" fill="#111"/>` +
      `<text x="6" y="14" font-family="DejaVu Sans, sans-serif" font-size="13" font-weight="bold" fill="#ffd400">S${b.s}</text>` +
      `<text x="52" y="14" font-family="DejaVu Sans, sans-serif" font-size="12" fill="#fff">${esc(b.slug.slice(0, 38))} #${b.id.split('#')[1]}</text>` +
      `<text x="6" y="29" font-family="DejaVu Sans, sans-serif" font-size="11" fill="#9cf">${esc(`${b.position} · ${b.heightVh}vh · ${b.hints.join(',')}`.slice(0, 64))}</text></svg>`;
    comps.push({ input: Buffer.from(label), left, top }, { input: tile, left: left + 4, top: top + SHEET.labelH });
  }
  await sharp({ create: { width: W, height: SHEET.rows * cellH, channels: 3, background: '#666' } })
    .composite(comps).jpeg({ quality: 78 }).toFile(path.join(sheetDir, `sheet-${String(p + 1).padStart(2, '0')}.jpg`));
}
console.log(`${Math.ceil(sample.length / perSheet)} contact sheets → archive/_sheets/`);

// A browsable HTML version for humans (references the local archive).
const rows = sample.map((b) => `<figure><a href="../${b.crop}"><img loading="lazy" src="../${b.crop}"></a><figcaption><b>S${b.s}</b> ` +
  `<a href="../${b.html ?? b.crop}">${esc(b.id)}</a><br><small>${b.position} · ${b.heightVh}vh · ${b.reason} · ${esc(b.hints.join(', '))}</small></figcaption></figure>`).join('\n');
fs.writeFileSync(path.join(ROOT, 'methodology', 'sample.html'), `<!doctype html><meta charset="utf-8"><title>Block sample</title>
<style>body{font:13px system-ui;margin:16px;background:#eee}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
figure{margin:0;background:#fff;padding:6px}img{width:100%;height:260px;object-fit:cover;object-position:top}small{color:#666}</style>
<h1>Block sample (${sample.length})</h1><main>${rows}</main>`);
