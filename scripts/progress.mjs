// Small CLI over the tracker.
//   node scripts/progress.mjs                         re-render PROGRESS.md and print the next action
//   node scripts/progress.mjs set <phase> <status> [note]   set a global phase (sample, cluster, method, gallery)
//   node scripts/progress.mjs set <phase>.failuresReviewed  mark failures of a per-site phase as reviewed
//   node scripts/progress.mjs site <slug> <phase> <status> [reason]   set one site's phase (e.g. skipped)
//   node scripts/progress.mjs note <slug> <text>      attach a note to a site
import { loadProgress, saveProgress, setSitePhase, ensureSite, PHASES, PROGRESS_MD } from './lib/progress.mjs';
import fs from 'node:fs';

const [cmd, a, b, ...rest] = process.argv.slice(2);
const progress = loadProgress();
const phaseIds = PHASES.map((p) => p.id);

if (cmd === 'set') {
  const [phase, flag] = a.split('.');
  if (!phaseIds.includes(phase)) throw new Error(`unknown phase ${phase}`);
  progress.phases[phase] ??= {};
  if (flag) progress.phases[phase][flag] = true;
  else Object.assign(progress.phases[phase], { status: b, ...(rest.length && { note: rest.join(' ') }), updatedAt: new Date().toISOString() });
  saveProgress(progress);
} else if (cmd === 'site') {
  if (!progress.sites[a]) throw new Error(`unknown site ${a}`);
  setSitePhase(progress, a, b, rest[0], rest[1] ? { reason: rest.slice(1).join(' ') } : {});
} else if (cmd === 'note') {
  ensureSite(progress, a).note = [b, ...rest].join(' ');
  saveProgress(progress);
} else {
  saveProgress(progress);
}
const next = fs.readFileSync(PROGRESS_MD, 'utf8').match(/\*\*Next action:\*\* (.*)/)?.[1];
console.log(`Next action: ${next}`);
