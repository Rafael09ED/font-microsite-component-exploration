# Labelling protocol (Phase 2.2)

The goal of labelling the sample is to **discover** the taxonomy, not to confirm it. The unit is a block (a component instance). We label what the block *is* and *how it works*. The site it came from doesn't matter.

## Inputs
- `archive/_sheets/sheet-NN.jpg`: 9 tiles per sheet. Each tile shows the **top** of a block, labelled `S<n> · site #block · position · height in viewports · keyword hints`.
- `methodology/sample.json`: per-tile metadata (`s`, `id`, headings, text preview, crop and HTML paths).
- Full crop: `archive/<slug>/blocks/NN.jpg`. Block HTML: `archive/<slug>/blocks/NN.html`. Scroll video: `archive/<slug>/scroll-desktop.webm`.
- Look at the full crop when the tile is ambiguous or the block is tall (> 2vh). Read the HTML when the behaviour matters (controls, editable text, toggles).

## Component types (seed — extend it)
| type | what it is |
|---|---|
| `hero` | Above-the-fold first impression: big specimen, name, tagline, maybe a CTA |
| `story` | Origin, brief, references, designer's voice; mostly prose and archival imagery |
| `glyph-table` | The character set shown as glyphs, all or in categories |
| `type-tester` | Interactive: editable text and/or controls (axes, size, features) |
| `specimen-showcase` | The family in use: waterfalls, posters, mockups, editorial walls, language samples |
| `design-details` | Micro-decisions: annotated letterforms, alternates, OpenType features, optical sizes, italics, spacing |
| `checkout` | Purchase/licensing: price, formats, buy/trial/download CTAs |
| `footer` | Colophon, credits, contact, legal |

The types are a starting point. When a block is none of these, propose a type such as `family-overview` (styles/weights listing), `language-support`, `navigation`, `newsletter`, `download-open-source`, `comparison` or `intro-animation`, and use it consistently. Use `fragment` for bad cuts (a slice of a component, an empty spacer) and `chrome` for nav bars and sticky bars.

## Variants
A **variant** is a named way of doing a type, recognisable across sites. Examples: `hero/illustration-collage`, `hero/kinetic-3d-type`, `type-tester/global-toolbar`, `type-tester/per-row-controls`, `specimen-showcase/multiscript-lines`. Name variants in kebab-case by **how the component works and looks**, never by site or foundry. Reuse the variants in `methodology/variants.json`. If none fits, propose a new one with `"newVariant": true` and a one-line definition.

## Output — `methodology/labels/sheet-NN.json`
One file per sheet, written when the sheet is finished (the tracker counts these files):
```json
{
  "sheet": "sheet-01",
  "labelledBy": "claude | agent | human",
  "labels": [
    {
      "s": 1, "id": "gt-america-com#00",
      "type": "hero", "variant": "illustration-collage", "newVariant": false,
      "variantDefinition": "only when newVariant is true",
      "confidence": "high | medium | low",
      "look": "visual traits: scale, colour, layout, imagery",
      "feel": "tone/motion/personality",
      "ux": "what the visitor can do or perceives; interaction model; 'static' if none",
      "learn": "one line: the idea worth teaching or stealing"
    }
  ]
}
```
Keep `look`, `feel`, `ux` and `learn` to one short line each. They feed the case study.

## After labelling
The merge step folds new variants into `variants.json` and counts how often each type/variant occurs (`npm run labels`). The result drives `METHOD.md` and `patterns/<type>.md`.
