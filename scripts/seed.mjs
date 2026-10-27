// Turn font-microsite-urls.txt into data/sites.json and add any new sites to progress.json.
// Safe to re-run: existing progress is kept.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SITES_FILE, writeJsonAtomic, loadProgress, ensureSite, saveProgress } from './lib/progress.mjs';

export function slugFor(url) {
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, '');
  const p = u.pathname.replace(/\/(index)?\.?html?$/i, '').replace(/\.html?$/i, '').replace(/\/+$/, '');
  return `${host}${p}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const lines = fs.readFileSync(path.join(ROOT, 'font-microsite-urls.txt'), 'utf8')
  .split(/\r?\n/).map((l) => l.trim()).filter((l) => /^https?:\/\//.test(l));

const seen = new Set();
const sites = [];
for (const url of lines) {
  const slug = slugFor(url);
  if (seen.has(slug)) { console.warn(`duplicate skipped: ${url}`); continue; }
  seen.add(slug);
  sites.push({ n: sites.length + 1, slug, url, host: new URL(url).hostname.replace(/^www\./, '') });
}
writeJsonAtomic(SITES_FILE, sites);

const progress = loadProgress();
for (const s of sites) ensureSite(progress, s.slug);
saveProgress(progress);
console.log(`${sites.length} sites → data/sites.json, PROGRESS.md updated`);
