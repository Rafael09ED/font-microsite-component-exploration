# Font microsite component study

A study of the components that type foundries use on font microsites: heroes, type testers, glyph tables, checkouts and more. The goal is to **teach, explore and inspire** people who design and build type specimen sites.

**Live gallery and playground → https://rafael09ed.github.io/font-microsite-component-exploration/**

## What's here

The study is organised by **component**, not by site. A component instance is, for example, "the type tester on recursive.design". Instances are grouped by how the components work and look:

- **8 sections** (Hero, Story, Glyph table, Type tester, Specimen showcase, Design details, Checkout, Footer)
- **20 component types** inside those sections
- **120 pattern variants**, such as `giant-wordmark`, `per-row-controls` or `on-page-cart`

So far, 1,329 instances have been extracted from 119 of the [181 microsites](font-microsite-urls.txt) in the list.

The **gallery** shows each variant with real examples: a screenshot crop of each instance, plus notes on its look, feel, UX and what to learn from it. The **playground** has interactive rebuilds of some variants. Each rebuild has controls and presets based on specific examples. Rebuilds use only open Google Fonts.

## How it was made

The method came first. Each phase has its own protocol in [`methodology/`](methodology/).

1. **Archive.** Capture every site with Playwright: the DOM, stitched full-page screenshots, a scroll video and page signals ([`scripts/archive.mjs`](scripts/archive.mjs)).
2. **Segment and sample.** Cut each page into blocks, then label a sample of them to derive the taxonomy ([METHOD.md](methodology/METHOD.md), [LABELING.md](methodology/LABELING.md)).
3. **Extract.** Go site by site and record each component instance, its variant and design notes ([EXTRACTION.md](methodology/EXTRACTION.md)). Results are in [`data/instances/`](data/instances/).
4. **Patterns.** Turn the taxonomy into readable pattern pages ([PATTERNS.md](methodology/PATTERNS.md)).

[PROGRESS.md](PROGRESS.md) tracks how far each phase has got.

## Running it locally

```sh
npm install
npm run app        # gallery at http://localhost:5178
```

The gallery loads screenshots from `archive/`. That folder isn't in the repo (about 1.4 GB), so build it with `npm run archive && npm run blocks`. Without it, the gallery still runs, but the screenshots are missing. `npm run app:deploy` publishes the gallery to GitHub Pages.

## Credits and takedowns

This is an independent, non-commercial study. **It is not affiliated with, or endorsed by, any of the foundries or designers whose sites are included.** All site designs, text, screenshots and typefaces belong to their owners. Each instance links back to its source site. The repo contains no font files.

If you own one of these sites and want something changed or removed, please [open an issue](https://github.com/Rafael09ED/font-microsite-component-exploration/issues) and I'll deal with it promptly.
