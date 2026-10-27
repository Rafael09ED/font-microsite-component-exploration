// Shared tracker: data/progress.json is the source of truth, PROGRESS.md is rendered from it.
// Every script saves after each site so an interrupted run loses at most one site.
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const SITES_FILE = path.join(ROOT, 'data', 'sites.json');
export const PROGRESS_FILE = path.join(ROOT, 'data', 'progress.json');
export const PROGRESS_MD = path.join(ROOT, 'PROGRESS.md');

// Per-site phases get a status per site; global phases have a single status.
// Bumping a per-site phase's `version` marks results from older versions as stale, i.e. pending again.
export const PHASES = [
  { id: 'archive', perSite: true, version: 4, title: 'Phase 1 — Archive every site (DOM, screenshots, video, outline, signals)', cmd: 'npm run archive' },
  { id: 'blocks', perSite: true, version: 3, title: 'Phase 2.1 — Rough-cut every site into unlabelled blocks', cmd: 'npm run blocks' },
  { id: 'sample', perSite: false, title: 'Phase 2.2 — Sample ~250 blocks across sites, contact sheets, label each sheet', detail: sheetProgress },
  { id: 'cluster', perSite: false, title: 'Phase 2.3 — Cluster instances by component similarity' },
  { id: 'method', perSite: false, title: 'Phase 2.4 — Write METHOD.md + patterns/*.md, review together' },
  { id: 'extract', perSite: true, title: 'Phase 3 — Extract: type + variant + rubric + reconstruction per block', cmd: 'node scripts/extract.mjs next' },
  { id: 'gallery', perSite: false, title: 'Phase 4 — Gallery & playground' },
];

// Labelling progress: one methodology/labels/sheet-NN.json per contact sheet in archive/_sheets.
function sheetProgress() {
  const list = (d, re) => { try { return fs.readdirSync(path.join(ROOT, d)).filter((f) => re.test(f)); } catch { return []; } };
  const sheets = list('archive/_sheets', /^sheet-\d+\.jpg$/).map((f) => f.replace('.jpg', ''));
  if (!sheets.length) return null;
  const labelled = new Set(list('methodology/labels', /^sheet-\d+\.json$/).map((f) => f.replace('.json', '')));
  const todo = sheets.filter((s) => !labelled.has(s));
  return `${sheets.length - todo.length}/${sheets.length} sheets labelled${todo.length ? ` — next: ${todo.slice(0, 4).join(', ')}${todo.length > 4 ? '…' : ''}` : ''}`;
}

const DONE = new Set(['done', 'skipped']);
const MARK = { done: '✓', skipped: '–', failed: '✗', running: '…', stale: '↻', pending: '☐' };

// Effective status: 'done' from an older phase version counts as 'stale'.
export function statusOf(progress, slug, phase) {
  const st = progress.sites[slug]?.[phase];
  const s = st?.status ?? 'pending';
  const version = PHASES.find((p) => p.id === phase)?.version;
  return s === 'done' && version && (st.v ?? 1) !== version ? 'stale' : s;
}

export function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

export function loadSites() {
  const sites = readJson(SITES_FILE, null);
  if (!sites) throw new Error('data/sites.json missing — run `npm run seed` first');
  return sites;
}

export function loadProgress() {
  return readJson(PROGRESS_FILE, { phases: {}, sites: {} });
}

export function ensureSite(progress, slug) {
  progress.sites[slug] ??= {};
  for (const p of PHASES.filter((p) => p.perSite)) progress.sites[slug][p.id] ??= { status: 'pending' };
  return progress.sites[slug];
}

// A site whose status is 'running' was interrupted mid-run, so it counts as pending again.
export function needsWork(progress, slug, phase, { retryFailed = false, force = false } = {}) {
  const s = statusOf(progress, slug, phase);
  if (force) return true;
  if (s === 'failed') return retryFailed;
  return !DONE.has(s);
}

export function setSitePhase(progress, slug, phase, status, extra = {}) {
  const site = ensureSite(progress, slug);
  const v = PHASES.find((p) => p.id === phase)?.version;
  site[phase] = { status, ...(v && { v }), ...extra, updatedAt: new Date().toISOString() };
  saveProgress(progress);
}

export function saveProgress(progress) {
  writeJsonAtomic(PROGRESS_FILE, progress);
  fs.writeFileSync(PROGRESS_MD, renderMarkdown(progress, loadSites()));
}

function counts(progress, sites, phase) {
  const c = { done: 0, skipped: 0, failed: 0, running: 0, stale: 0, pending: 0 };
  for (const s of sites) c[statusOf(progress, s.slug, phase)]++;
  return c;
}

function nextAction(progress, sites) {
  for (const p of PHASES) {
    if (p.perSite) {
      const c = counts(progress, sites, p.id);
      const open = c.pending + c.running + c.stale;
      if (open) return `Run \`${p.cmd}\`${p.id === 'extract' ? ' and extract those sites per methodology/EXTRACTION.md (agents), then `node scripts/extract.mjs sync`' : ''} — ${open} site(s) pending for **${p.id}**${c.failed ? `, ${c.failed} failed` : ''}.`;
      if (c.failed && !progress.phases[p.id]?.failuresReviewed)
        return `Review the ${c.failed} **${p.id}** failure(s) below: retry with \`${p.cmd} -- --retry-failed\`, or mark them skipped with a note, then \`node scripts/progress.mjs set ${p.id}.failuresReviewed\`.`;
    } else if (!DONE.has(progress.phases[p.id]?.status)) {
      const detail = p.detail?.();
      return `${p.title}${detail ? ` (${detail})` : ''}. When finished: \`node scripts/progress.mjs set ${p.id} done\`.`;
    }
  }
  return 'All phases complete.';
}

export function renderMarkdown(progress, sites) {
  const L = [];
  L.push('# Progress', '', '_Generated from `data/progress.json` by `scripts/lib/progress.mjs` — edit via the scripts, not by hand._', '');
  L.push(`**Next action:** ${nextAction(progress, sites)}`, '', '## Phases', '');
  for (const p of PHASES) {
    if (p.perSite) {
      const c = counts(progress, sites, p.id);
      const finished = c.done + c.skipped;
      L.push(`- [${finished === sites.length ? 'x' : ' '}] ${p.title} — ${finished}/${sites.length} done${c.failed ? `, ${c.failed} failed` : ''}`);
    } else {
      const g = progress.phases[p.id] ?? {};
      const detail = p.detail?.();
      L.push(`- [${DONE.has(g.status) ? 'x' : ' '}] ${p.title}${detail ? ` — ${detail}` : ''}${g.note ? ` — ${g.note}` : ''}`);
    }
  }

  const failures = [];
  for (const s of sites)
    for (const p of PHASES.filter((p) => p.perSite)) {
      const st = progress.sites[s.slug]?.[p.id];
      if (statusOf(progress, s.slug, p.id) === 'failed') failures.push(`| ${s.n} | ${s.slug} | ${p.id} | ${(st.reason ?? '').replace(/\|/g, '/').slice(0, 140)} |`);
    }
  if (failures.length) L.push('', '## Failures', '', '| # | site | phase | reason |', '|---|---|---|---|', ...failures);

  const perSite = PHASES.filter((p) => p.perSite);
  L.push('', '## Sites', '', `Legend: ✓ done · ✗ failed · … interrupted · ↻ stale (older method, will redo) · – skipped · ☐ pending`, '');
  for (const s of sites) {
    const st = progress.sites[s.slug] ?? {};
    const status = (p) => statusOf(progress, s.slug, p.id);
    const all = perSite.every((p) => DONE.has(status(p)));
    const cells = perSite.map((p) => `${p.id} ${MARK[status(p)]}`).join(' · ');
    const note = st.note ? ` — _${st.note}_` : '';
    L.push(`- [${all ? 'x' : ' '}] ${String(s.n).padStart(3, '0')} [${s.slug}](${s.url}) — ${cells}${note}`);
  }
  return L.join('\n') + '\n';
}
