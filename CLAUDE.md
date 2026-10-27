# Font microsite component study

Collects and compares components from 181 font microsites ([font-microsite-urls.txt](font-microsite-urls.txt)) to **teach, explore and inspire**. Full plan: methodology-first. Archive everything → sample → derive taxonomy → extract site by site → gallery + playground.

## Resume protocol (start every session here)
1. Read the **Next action** line in [PROGRESS.md](PROGRESS.md) and do that.
2. Never edit PROGRESS.md by hand. It is rendered from `data/progress.json` by `scripts/lib/progress.mjs`. Use `npm run progress` (re-render), `node scripts/progress.mjs set <phase> done [note]`, `... site <slug> <phase> skipped <reason>`, `... note <slug> <text>`.
3. Per-site scripts save after each site, skip finished ones, and treat `running` (interrupted) as pending. `--retry-failed` and `--force` re-run sites.

## Principles
- **Group by component, not by site.** The unit of study is a component instance (e.g. "the type tester on recursive.design"). Cluster instances by how the components work and look. Sites are only sources, and sibling template sites (GT, Lost Type, DJR…) still each count.
- Component types start from: Hero, Story, Glyph table, Type tester, Specimen showcase, Design details, Checkout, Footer. The sample will add new types and pattern variants within each type.
- Don't proceed to Phase 3 extraction until `methodology/METHOD.md` has been reviewed with the user.
- Never download or commit font files; record font URLs only. `archive/` is git-ignored (≈10 MB/site, regenerable).

## Layout
- `scripts/seed.mjs`: txt → `data/sites.json` + tracker
- `scripts/archive.mjs`: Phase 1 → `archive/<slug>/` (dom.html, full-desktop/mobile.jpg, scroll-desktop.webm, outline-{desktop,mobile}.json, signals.json, meta.json)
- `scripts/lib/page-extract.mjs`: in-browser outline and signals extractors
- `scripts/blocks.mjs`: Phase 2.1 → `data/blocks/<slug>.json` (committed) + `archive/<slug>/blocks/NN.{jpg,html}`
- `scripts/sample.mjs`: Phase 2.2 → `methodology/sample.json`, `sample.html`, `archive/_sheets/sheet-NN.jpg`
- `scripts/labels.mjs`: merges `methodology/labels/sheet-NN.json` → `variants.json` + `label-summary.md`. The protocol is in [methodology/LABELING.md](methodology/LABELING.md)
- `scripts/cluster.mjs`: Phase 2.3 → `methodology/cluster-report.md` + per-variant contact sheets in `methodology/variants/` (committed, so the pattern pages show images without the archive)
- `scripts/patterns.mjs`: `methodology/PATTERNS.md` + `patterns/<type>.md` from `taxonomy.json`
- `scripts/extract.mjs`: Phase 3. `prepare` builds the per-site evidence pack in `archive/<slug>/pack/` (facts.json with palettes, numbered overview sheets, video storyboard, mobile strip). `next` lists pending sites. `check <slug>` is read-only validation, safe for parallel agents. `sync` validates all `data/instances/*.json`, updates the tracker, and writes `data/instances/index.json` (section → type → variant) and `methodology/proposals.md`. Only the coordinator runs `sync`. The protocol is in [methodology/EXTRACTION.md](methodology/EXTRACTION.md); `data/instances/gt-america-com.json` is the reference example.
- `methodology/taxonomy.json` has three levels: `sections` (the user's original 8) → `types` (19) → `variants`, plus `aliases`. Curate Phase 3 proposals into it, then re-run `labels`, `patterns` and `extract sync`.
- `app/` (`npm run app` → http://localhost:5178): the gallery and playground. It serves `archive/`, `data/` and `methodology/` under `/files/`. Rebuilds live in `app/src/rebuilds/<area>/<variant>.tsx`. Each exports a `Rebuild` (`types.ts`: params schema → generated controls, style presets reproducing exemplars, `basedOn` instance ids) and is registered in `registry.ts`. Rebuilds use only the open fonts in `fonts.ts` (Google Fonts at runtime); never add font files. Check types with `npm run app:check`.
- `scripts/inspect-dom.mjs <url>…`: debugging helper that prints a page's box tree (position, overflow, scroll height). Use it when a site captures or cuts badly
- Bump a phase's `version` in `scripts/lib/progress.mjs` when its method changes: older results become stale (↻) and get redone.

## Gotchas
- Playwright launches with `channel: 'chromium'` (the headless-shell build is not installed) and `handleSIGINT: false`. Stop a run with Ctrl+C or `kill -INT <node pid>`. Never run `pkill -f archive.mjs` from a shell whose own command line contains that string, because it kills the shell too.
- Full-page images are **stitched** from viewport screenshots while scrolling, because reveal-on-scroll sections are blank in a single fullPage shot. `markScroller` picks one of three scroll models, recorded as `meta.desktop.mode`:
  - `vertical`: the window or an inner container scrolls (GT America scrolls `body`). The container gets a `data-archive-scroller` marker.
  - `horizontal`: stitched left to right (DJR Bungee).
  - `wheel` / `single`: nothing scrolls natively. The archiver sends wheel events and keeps each changed screen (scroll-hijacked sites), or the page is a one-screen app.
- Segmentation (`data/blocks/<slug>.json → segmentation`) is `dom` (outline blocks) or `screens` (one block per viewport). `screens` is used for wheel/single captures and for paged apps whose DOM boxes don't map to scroll position (Readymag/NN sites).
- Outline splitting: a tall block is split only if ≥ 2 children have their own headings or it's > 8 viewports tall. That keeps one-heading story chapters whole.
- `npm run qa` lists sites worth a manual look (few blocks, single screen, Wayback, no webfonts).
