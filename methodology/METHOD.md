# Method

How this study collects, cuts, classifies and compares the components of font microsites. It covers Phase 1 (archive), Phase 2 (sample → taxonomy) and Phase 3 (extraction).

## Decisions (reviewed 2026-10-27)

1. **Taxonomy structure: three levels.** The 8 original components are **sections**. Each section holds the core type plus the types discovered in the sample, and each type holds its variants (`taxonomy.json → sections`). All 19 types are kept:

   | section | types |
   |---|---|
   | Hero | hero, intro-animation |
   | Story | story |
   | Glyph table | glyph-table, language-support |
   | Type tester | type-tester, playground-app, game |
   | Specimen showcase | specimen-showcase, family-overview, interlude |
   | Design details | design-details, comparison |
   | Checkout | checkout, testimonials, newsletter |
   | Footer | footer, navigation, chrome |

2. **Instance boundaries.** Labels are per block. `continues: previous` merges consecutive blocks into one instance, and a block may carry up to two instances.
3. **Tiny blocks** (< 150px) are labelled only as `chrome` or `navigation`, with no rubric.
4. **Every block is looked at** (full crop, plus HTML where behaviour matters), because Phase 4 rebuilds components and needs high-quality reconstruction notes, not only labels.
5. **Playground.** Within each section and type, you can swap between variants, and within a variant, between example implementations (captured instances and rebuilds) and styles. Rebuilds start with hero variants, then `type-tester/per-row-controls`, `type-tester/global-toolbar`, `glyph-table/glyph-inspector`, `design-details/feature-before-after` and `design-details/axis-explainer`.

## 1. Unit of analysis

The unit is a **component instance**: one component on one site, e.g. "the type tester on recursive.design". Instances are grouped by **how they work and look** (type → variant). Sites are only where instances come from. Sibling sites built from the same template (18 GT sites, DJR, Lost Type…) each still count. Template repetition is itself a finding: some patterns spread across a foundry's sites.

## 2. Corpus and capture (Phase 1)

- **181 URLs** from `font-microsite-urls.txt`. 172 were captured live. 8 dead, moved or blocked sites were captured from **Wayback Machine** snapshots (`data/url-overrides.json`, with reasons). Berkeley Mono needed a non-headless user agent.
- Per site, desktop 1440×900 and mobile 390×844: rendered DOM, **stitched full-page screenshot**, scroll-through video (desktop), block outline, page signals (fonts, variation and feature settings, controls, glyph grids, prices, CTAs, tech stack). Font files are never downloaded; only their URLs are recorded.
- Pages scroll in different ways, so capture mode is detected per site:

  | mode | sites | what it means |
  |---|---|---|
  | vertical | 164 | the window or an inner container scrolls (e.g. GT America scrolls `body`) |
  | horizontal | 1 | sections in a row (DJR Bungee) |
  | wheel | 7 | scroll is hijacked; each screen is captured after a wheel event |
  | single | 9 | one-screen apps (Commit Mono, Universal Sans…) |

- **Caveats.** Captures can include cookie banners, loaders and mid-animation states. Motion and interaction are seen only in the video and HTML, never in stills. Pages taller than 30,000px are clipped (11 sites). Wayback captures can miss assets.

## 3. Segmentation into blocks (Phase 2.1)

- The outline sees through wrappers that have no height of their own (`display: contents`, zero-height roots). A tall block (> 2.5 viewports) is split only if ≥ 2 of its children carry their own headings, or if it is > 8 viewports tall. That keeps one-heading chapters (GT Walsheim's story) whole, while headed components (GT America) separate.
- Background or wrapper layers that contain ≥ 2 other blocks are dropped. Fixed and off-screen elements are kept with their HTML, which is how GT America's hidden tester drawer was found.
- **Fallback:** for paged and app-like sites whose DOM boxes don't match scroll position (Readymag/NN sites, wheel and single captures), the page is cut into **one block per screen**. That applies to 34 sites.
- Result: **2,510 blocks** (2,095 visual blocks ≥ 150px; 340 of them are screens).

## 4. Sampling (Phase 2.2)

The sample is 250 blocks from 130 sites, at most 3 per site. Half were chosen by **farthest-point sampling** over normalised block features, which guarantees the unusual blocks appear. The other half are **stratified random** by page position (25% top, 50% middle, 25% bottom), so typical blocks are represented. Blocks under 150px were excluded.

## 5. Labelling and taxonomy (Phase 2.2–2.4)

- Labels follow [LABELING.md](LABELING.md). I labelled 6 sheets to seed the vocabulary; 4 parallel agents labelled the remaining 22 against it, proposing new variants only when nothing fit. Each label records type, variant, confidence, and one line each for **look**, **feel**, **UX** and **what to learn**. Confidence: 126 high, 115 medium, 9 low.
- Raw labels produced 113 variant names. [taxonomy.json](taxonomy.json) curates them into **19 types and 84 canonical variants**, grouped by mechanism. An explicit alias map lists every merge with its reason. Raw labels are never rewritten, so a merge can be undone by editing the taxonomy.
- 220 of the 246 non-fragment labels fall in the **original 8 types**. The sample also surfaced 11 types: `family-overview` (10), `language-support` (3), `intro-animation`, `testimonials`, `playground-app`, `chrome` (2 each), and `comparison`, `newsletter`, `navigation`, `game`, `interlude` (1 each). Free fonts' "get it" sections were folded into `checkout` as `free-download` and `build-configurator`, so paid and free acquisition can be compared.
- Pages: [PATTERNS.md](PATTERNS.md) indexes one page per type in `patterns/`, with variants, recognition cues, examples and the observed look, feel, UX and lessons.

### What the sample shows

- **Heroes split by what carries the first impression.** The carriers are the name, a sentence, a typeset page, motion, controls, a construction drawing, a photo, material, an illustration, a collage of props, or a product-landing layout. Using the type itself is most common (`giant-wordmark` 8, `sentence-as-specimen` 7, `kinetic-type` 8). Heroes that are already testers (`interactive-specimen`, 5) are a notable minority.
- **Design details are the second-largest type** (36 blocks). Microsites spend a lot of space explaining OpenType features and axes, mostly as off/on pairs (`feature-before-after`, 13) and per-axis demos (`axis-explainer`, 11).
- **Testers differ mainly in control scope:** one sample, per row, a global toolbar, or editable text inside a layout. A distinct cluster of **creative toys** (pattern builders, shareable composers, pairing previews) turns testing into making.
- **Showcases favour pure typography** (`word-stack`, 7) and real-world mockups (`in-use-mockups`, 7). Invented worlds (`prop-collage`) and period pastiches (`poster-series`) are the storytelling end.
- **Footers are mostly credits** (`credits-colophon`, 8 of 18). The colophon doubles as a credibility line.

### Can it be automated? (Phase 2.3)

[cluster-report.md](cluster-report.md) tests whether block features (size, controls, glyph density, text hints, colour…) predict the labels. A leave-one-out nearest-centroid classifier gets the **type right 41%** of the time. **Variants** come out at 10–26% for most types; family-overview reaches 78% and design-details 56%. **Conclusion:** the distinctions that matter are visual and experiential, so Phase 3 must look at each block (crop, HTML, video). Features are useful only as hints: checkout, testers, glyph tables, and footers by position.

## 6. Extraction procedure (Phase 3)

_As run:_ the protocol is [EXTRACTION.md](EXTRACTION.md). Each site gets an evidence pack (`node scripts/extract.mjs prepare`). It holds numbered overview sheets of every block, a 16-frame storyboard from the scroll video (for motion), the mobile page folded into columns, and `facts.json` with per-block colour palettes, fonts, controls and text. Agents look at every block's full crop (and its HTML when behaviour matters), write `data/instances/<slug>.json` with a `reconstruction` section per instance, and self-check with `extract.mjs check`. The coordinator runs `sync` between waves. It validates, updates the tracker, builds the section → type → variant index, and collects variant proposals for curation. GT America was extracted first as the calibration and reference example (22 instances from 27 blocks).

_Original proposal:_

Per site, in tracker order (`npm run extract` will feed the queue; the per-site status in PROGRESS.md resumes after interruption):

1. Gather all of the site's blocks. That means visual blocks plus fixed and off-screen ones, which have HTML only. Gather the page signals and look at the scroll video around each block when motion is involved.
2. For each block, record **type/variant** from `taxonomy.json`, the **rubric** attributes (`rubric.json`: cross-cutting plus per-type), and **look / feel / UX / learn** (one line each). Use `continues: previous` when a component spans blocks, and give a second label when one block holds two components.
3. Record the **page sequence**: the ordered list of components on the site. It enables a second kind of comparison: the narrative arc of a microsite (e.g. hero → story → tester → glyphs → buy).
4. When an instance fits no variant, set `newVariant: true` with a definition. These get curated into `taxonomy.json` between batches, and earlier sites are re-checked against the new variant.
5. Output: `data/instances/<slug>.json`, one file per site, which keeps resumability per site. A generated index, `data/instances/index.json`, regroups instances by type and variant for the gallery.

**Execution:** batches of about 8 sites per agent, a few agents in parallel, so roughly 23 agent runs for 181 sites. After each batch, `npm run labels`-style validation checks that every id exists, every variant is in the taxonomy, and rubric values are legal.

## 7. Gallery and playground (Phase 4, revised)

- The main navigation is **type → variant → instances**: contact-sheet grids filterable by rubric attributes, e.g. "testers with axes + global scope" or "dark heroes with motion". Each instance opens to its crop, the video moment, the captured HTML in a sandboxed iframe, and the look, feel, UX and learn notes.
- **Sequence view:** each site's component sequence as a strip, so arcs can be compared across sites.
- **Matrix:** sites × types, and type × rubric attribute counts, as the quantitative backbone of the case study.
- **Playground:** a Storybook-style sidebar to pick component → variant → implementation, with a controls panel generated from a params schema. Each variant can show captured examples next to rebuilt versions in `app/components/<type>/<variant>`. Rebuilt components take the rubric attributes as props where it makes sense (scope, controls, colour mode, motion), so the playground explores the design space the study maps.

## Reproduce

```
npm run seed       # sites + tracker
npm run archive    # Phase 1 (resumable)
npm run qa         # capture QA
npm run blocks     # Phase 2.1
npm run sample     # Phase 2.2: sample + contact sheets
npm run labels     # merge labels through taxonomy.json
npm run cluster    # Phase 2.3 report + per-variant sheets
npm run patterns   # pattern pages
```
