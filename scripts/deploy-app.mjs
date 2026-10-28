// Builds the gallery app as a static site and publishes it to the gh-pages branch.
//   npm run app:build    → app/dist/ only (preview with: npx vite preview --config app/vite.config.ts)
//   npm run app:deploy   → build, then force-push app/dist/ to origin's gh-pages branch
// archive/ is git-ignored, so only the files the app loads are copied: taxonomy, sites, instance docs
// and the block images named in data/instances/index.json.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, readJson } from './lib/progress.mjs';

const dryRun = process.argv.includes('--dry-run');
const DIST = path.join(ROOT, 'app', 'dist');
const run = (cmd, args, cwd = ROOT) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

run('npx', ['vite', 'build', '--config', 'app/vite.config.ts']);

const files = new Set(['methodology/taxonomy.json', 'data/sites.json']);
for (const f of fs.readdirSync(path.join(ROOT, 'data', 'instances'))) if (f.endsWith('.json')) files.add(`data/instances/${f}`);
const index = readJson(path.join(ROOT, 'data', 'instances', 'index.json'));
for (const section of Object.values(index.sections))
  for (const variants of Object.values(section.types))
    for (const refs of Object.values(variants))
      for (const r of refs) {
        if (r.crop) files.add(r.crop);
        for (const nn of r.blocks) files.add(`archive/${r.slug}/blocks/${nn}.jpg`);
      }

let copied = 0, bytes = 0;
const missing = [];
for (const rel of files) {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) { missing.push(rel); continue; }
  const dest = path.join(DIST, 'files', rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  copied++; bytes += fs.statSync(src).size;
}
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
console.log(`copied ${copied} files (${(bytes / 1e6).toFixed(1)} MB) into app/dist/files; ${missing.length} missing`);
if (missing.some((m) => !m.startsWith('archive/'))) throw new Error(`missing data files: ${missing.filter((m) => !m.startsWith('archive/')).join(', ')}`);

if (!dryRun) {
  const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  const origin = git(['remote', 'get-url', 'origin']);
  // Commit as the repo's configured identity, or else as the author of the last commit on main.
  const ident = (key, fmt) => { try { return git(['config', `user.${key}`]); } catch { return git(['log', '-1', `--format=${fmt}`]); } };
  run('git', ['init', '-q', '-b', 'gh-pages'], DIST);
  run('git', ['add', '-A'], DIST);
  run('git', ['-c', `user.name=${ident('name', '%an')}`, '-c', `user.email=${ident('email', '%ae')}`, 'commit', '-q', '-m', `Deploy ${new Date().toISOString()}`], DIST);
  run('git', ['push', '-f', origin, 'gh-pages'], DIST);
  const [, owner, repo] = origin.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/) ?? [];
  console.log(owner ? `published → https://${owner.toLowerCase()}.github.io/${repo}/` : 'published to gh-pages');
}
