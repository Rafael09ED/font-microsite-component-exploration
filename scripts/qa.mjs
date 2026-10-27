// Capture QA: one row per site with how it was captured and cut, plus flags worth a human look.
//   npm run qa            → prints flagged sites, writes data/capture-qa.json
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadSites, readJson, writeJsonAtomic } from './lib/progress.mjs';

const rows = [];
for (const s of loadSites()) {
  const dir = path.join(ROOT, 'archive', s.slug);
  const meta = readJson(path.join(dir, 'meta.json'), null);
  const signals = readJson(path.join(dir, 'signals.json'), null);
  const cut = readJson(path.join(ROOT, 'data', 'blocks', `${s.slug}.json`), null);
  if (!meta) { rows.push({ n: s.n, slug: s.slug, flags: ['not-archived'] }); continue; }
  const kinds = cut?.blocks.reduce((m, b) => ({ ...m, [b.kind]: (m[b.kind] ?? 0) + 1 }), {}) ?? {};
  const visual = (kinds.flow ?? 0) + (kinds.screen ?? 0);
  const flags = [];
  if (!cut) flags.push('not-cut');
  else if (visual <= 2) flags.push(`few-blocks(${visual})`);
  if (meta.desktop?.mode === 'single') flags.push('single-screen');
  if (meta.desktop?.clipped) flags.push('clipped');
  if (meta.mobileError) flags.push('mobile-error');
  if (meta.via !== 'live') flags.push(`via-${meta.via}`);
  if (signals && !meta.fontRequests.length && !signals.fontFaceRules.length) flags.push('no-webfonts');
  if ((kinds.offscreen ?? 0) >= 3) flags.push(`offscreen(${kinds.offscreen})`);
  rows.push({ n: s.n, slug: s.slug, mode: meta.desktop?.mode, scroll: meta.scroll?.target ?? null, segmentation: cut?.segmentation,
    blocks: kinds, pageHeight: meta.desktop?.pageHeight, title: signals?.title?.slice(0, 60), flags });
}
writeJsonAtomic(path.join(ROOT, 'data', 'capture-qa.json'), rows);

const count = (k) => rows.reduce((m, r) => ({ ...m, [r[k]]: (m[r[k]] ?? 0) + 1 }), {});
console.log('capture modes:', count('mode'));
console.log('segmentation:', count('segmentation'));
const flagged = rows.filter((r) => r.flags.length);
for (const r of flagged) console.log(`${String(r.n).padStart(3)} ${r.slug.padEnd(40)} ${r.flags.join(' ')}`);
console.log(`${flagged.length} flagged → data/capture-qa.json`);
