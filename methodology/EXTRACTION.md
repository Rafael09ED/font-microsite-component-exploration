# Extraction protocol (Phase 3)

One site at a time. Look at **every** block, classify it against the taxonomy, record the rubric, and write notes good enough to **rebuild the component** later (Phase 4 playground). The output is one file per site: `data/instances/<slug>.json`.

## Inputs for a site
Prepare the pack with `node scripts/extract.mjs prepare --only <slug>` if `archive/<slug>/pack/` is missing.

| file | what it is |
|---|---|
| `archive/<slug>/pack/facts.json` | site facts (fonts, axes and features used, controls, prices, CTAs, tech, capture mode) and, per block: box, headings, text, fonts, max size, controls, media, **palette** (hex + share), crop and HTML paths |
| `archive/<slug>/pack/overview-N.jpg` | every cropped block on numbered tiles (`#NN`), 9 per sheet, top of each block |
| `archive/<slug>/pack/storyboard.jpg` | 16 frames of the recorded video. Frames before t≈2s show the intro (loader or animation) before any scrolling. The video then holds the slow scroll-through and, after it, the screenshot pass, so the page can appear twice top to bottom. Use it to judge **motion** |
| `archive/<slug>/pack/mobile.jpg` | the mobile page folded into columns, for the `mobile` rubric attribute |
| `archive/<slug>/blocks/NN.jpg` | full crop of block NN, 720px wide (= 1440 CSS px, so halve sizes measured on it) |
| `archive/<slug>/blocks/NN.html` | block HTML (scripts and styles stripped); grep it for controls, labels and features |
| `methodology/taxonomy.json` | sections → types → variants, with definitions and cues. **Classify against this.** |
| `methodology/rubric.json` | rubric attributes and allowed values |
| `methodology/patterns/<type>.md` | examples and notes per variant, for calibration |

## Procedure
1. Read `facts.json`, then view the overview sheets, the storyboard and the mobile strip to understand the page as a whole.
2. For **each block** in `facts.json → blocks`, in order:
   - Blocks with a crop: **open the full crop** (`blocks/NN.jpg`). Tiles only show the top. When the block has controls, editable text, toggles or a buy flow (see `controls` in facts), also grep its HTML for what the controls do.
   - Blocks without a crop (`fixed`, `offscreen`): read the HTML head. These are often navs, overlays, drawers (e.g. a hidden tester) or loaders.
   - Decide its instance: type/variant, or `continues` the previous instance, or skip it (`fragment`: empty, duplicate, bad cut).
3. Tiny blocks (`tiny: true`, under 150px) only need `type` (`chrome` or `navigation`), `variant` and one `look` line. No rubric and no reconstruction.
4. Write `data/instances/<slug>.json` (schema below), then run `node scripts/extract.mjs check <slug>`. It validates without writing anything. Fix every ✗ error, and fix ⚠ rubric warnings where you can. Don't run `sync` while other extractions run in parallel; the coordinator runs it.

## Classification rules
- Use the most specific existing variant. Propose a new one (`newVariant: true` plus `variantDefinition`) only if the block works differently from every variant of its type. Name variants by mechanism, never by site. Propose a new type only if no type fits (`newType: true`, `typeDefinition`, `section`).
- One instance may span several consecutive blocks: list them all in `blocks`. A block may belong to at most two instances, e.g. a tester with a glyph grid underneath.
- Cookie banners and loaders covering a capture: classify what is underneath if you can tell, mention the overlay in `look`, and lower the confidence.
- `exemplar: true` marks an instance that would be a strong reference for rebuilding its variant: clear, well executed, representative. At most ~2 per site.

## Reference example
`data/instances/gt-america-com.json` is a complete, validated extraction (22 instances from 27 blocks). Match its level of detail, especially in `reconstruction`.

## Instance schema
```json
{
  "slug": "gt-america-com",
  "extractedBy": "claude | agent",
  "summary": "One or two sentences: what this microsite does overall and what is special about it.",
  "instances": [
    {
      "blocks": ["00"],
      "type": "hero", "variant": "illustration-scene",
      "newVariant": false, "variantDefinition": null,
      "confidence": "high | medium | low",
      "exemplar": true,
      "rubric": { "colorMode": "light", "motion": "scroll-driven", "interactivity": "links", "density": "dense", "realism": "themed",
                  "tone": "playful, retro packaging", "mobile": "adapts", "carrier": "illustration", "cta": "multiple", "rangeShown": "several", "navVisible": true },
      "look": "one line", "feel": "one line", "ux": "one line", "learn": "one line: the transferable idea",
      "reconstruction": {
        "layout": "structure, grid, alignment, proportions in CSS px or vw/vh (e.g. 'full-bleed 100vh; collage fills top 80%; name 140px bottom-left')",
        "typography": "each text role: size (px at 1440 wide), weight or axis values, case, tracking, leading, font family",
        "palette": ["#1d1dff", "#ff3b1f", "#ffffff"],
        "behaviour": "what moves or responds, and how: triggers, durations, ranges (e.g. 'collage parallax on scroll; boxes rotate slightly')",
        "content": "the sample-text strategy and copy (themed words, pangrams, real articles, quotes)",
        "assets": "images, video, illustration or 3D needed to rebuild",
        "html": "optional: selectors or structure worth reusing from the HTML (e.g. 'input[type=range] per axis inside .tester-row')"
      }
    }
  ],
  "skipped": [ { "block": "24", "reason": "empty spacer" } ]
}
```
- `rubric`: the cross-cutting attributes plus that type's attributes from `rubric.json`, using only the allowed values. Multi-select attributes are arrays.
- `reconstruction` is what makes Phase 4 possible. Be concrete: measure from the crop (720px crop = 1440 CSS px, so halve), take colours from `palette` in facts, and take axis, feature and control facts from facts and HTML. `layout` and `typography` are required for every non-tiny instance.
- `sync` adds `sequence` (the site's ordered component list) automatically; don't write it.
- Every block that has a crop must appear in some instance's `blocks` or in `skipped`.
