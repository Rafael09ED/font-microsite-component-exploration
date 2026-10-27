import { useLayoutEffect, useRef } from 'react';
import { fvs } from '../fonts';
import type { Rebuild, RebuildProps } from '../types';

// Size every line so it exactly fills the column (Lost Type's BigIdeasText), and refit on edit.
function useFitLines(deps: unknown[], minSize = 20) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const fit = () => {
      for (const line of box.querySelectorAll<HTMLElement>('[data-fit]')) {
        line.style.fontSize = '100px';
        const w = line.scrollWidth || 1;
        line.style.fontSize = `${Math.max(minSize, (100 * box.clientWidth) / w)}px`;
      }
    };
    fit();
    document.fonts.ready.then(fit);
    box.addEventListener('input', fit);
    return () => box.removeEventListener('input', fit);
  }, deps);
  return ref;
}

function SentenceAsSpecimen({ v, font, width, height }: RebuildProps) {
  const lines = String(v.lines).split('\n').filter(Boolean);
  const weights = String(v.weights).split(',').map((w) => Number(w.trim()) || 400);
  const colWidth = (Number(v.column) / 100) * width;
  const ref = useFitLines([font.id, v.lines, v.weights, v.column, v.fit, width]);
  return (
    <div style={{ width, height, background: String(v.bg), color: String(v.ink), overflow: 'hidden', fontFamily: `'${font.family}'`, display: 'flex', justifyContent: 'center', alignItems: String(v.valign) === 'center' ? 'center' : 'flex-start' }}>
      <div style={{ width: colWidth, paddingTop: String(v.valign) === 'center' ? 0 : height * 0.08 }}>
        {v.bar && <div style={{ height: 20, background: String(v.accent), marginBottom: 28 }} />}
        {String(v.kicker) && <div style={{ fontSize: 15, opacity: 0.6, marginBottom: 8 }}>{String(v.kicker)}</div>}
        <div ref={ref} contentEditable={!!v.editable} suppressContentEditableWarning spellCheck={false}
          style={{ position: 'relative', outline: 'none', cursor: v.editable ? 'text' : 'default', textAlign: v.fit ? 'left' : 'center' }}>
          {lines.map((line, i) => (
            <div key={`${i}-${line}`} data-fit={v.fit ? '' : undefined} style={{
              whiteSpace: 'nowrap', lineHeight: 1.02, width: v.fit ? 'max-content' : undefined,
              fontSize: v.fit ? undefined : Number(v.size) * (i === 0 ? 1 : 0.45),
              color: i === 0 ? String(v.accent) : undefined, textTransform: i === 0 && v.capsFirst ? 'uppercase' : 'none',
              fontVariationSettings: fvs(font, { wght: weights[i % weights.length], wdth: Number(v.width) }),
            }}>{line}</div>
          ))}
          {v.editable && v.sticker && (
            <span contentEditable={false} style={{ position: 'absolute', right: -18, top: -14, transform: 'rotate(-5deg)', background: String(v.stickerColour), color: '#fff', fontSize: 11, padding: '3px 8px', fontFamily: 'system-ui', letterSpacing: '.04em' }}>Edit me!</span>
          )}
        </div>
        {String(v.byline) && <div style={{ fontSize: 15, opacity: 0.6, marginTop: 16 }}>{String(v.byline)}</div>}
        {String(v.cta) && <span style={{ display: 'inline-block', marginTop: 28, padding: '10px 26px', border: `1.5px solid ${String(v.ink)}`, borderRadius: 999, fontSize: 14 }}>{String(v.cta)}</span>}
      </div>
    </div>
  );
}

export const sentenceAsSpecimen: Rebuild = {
  type: 'hero', variant: 'sentence-as-specimen',
  title: 'Sentence as specimen',
  description: 'The pitch, set in the font, is the hero. Lines can auto-fit the column width and be retyped in place, so the hero is quietly also a tester.',
  basedOn: ['moriston-losttype-com#00', 'faction-losttype-com#00', 'infinite-tragedy-com#00', 'compressa-preusstype-com#00'],
  params: [
    { key: 'kicker', label: 'Kicker', type: 'text', default: 'Introducing' },
    { key: 'lines', label: 'Lines (one per line)', type: 'text', multiline: true, default: 'Moriston\nA sans-serif typeface with\nunusually high contrast—and enthusiasm!' },
    { key: 'weights', label: 'Weight per line (comma list)', type: 'text', default: '900, 400, 600' },
    { key: 'width', label: 'Width axis (if available)', type: 'range', min: 25, max: 151, default: 100 },
    { key: 'fit', label: 'Auto-fit each line to the column', type: 'toggle', default: true },
    { key: 'size', label: 'Size when not fitted (px)', type: 'range', min: 40, max: 260, default: 140 },
    { key: 'column', label: 'Column width (% of viewport)', type: 'range', min: 30, max: 92, default: 50 },
    { key: 'valign', label: 'Vertical placement', type: 'select', options: ['top', 'center'], default: 'top' },
    { key: 'capsFirst', label: 'Uppercase first line', type: 'toggle', default: true },
    { key: 'editable', label: 'Editable in place', type: 'toggle', default: true },
    { key: 'sticker', label: '“Edit me!” sticker', type: 'toggle', default: true },
    { key: 'byline', label: 'Byline', type: 'text', default: 'by Riley Cran' },
    { key: 'cta', label: 'CTA', type: 'text', default: '' },
    { key: 'bar', label: 'Accent bar on top', type: 'toggle', default: true },
    { key: 'bg', label: 'Background', type: 'color', default: '#fbfbfb' },
    { key: 'ink', label: 'Ink', type: 'color', default: '#222222' },
    { key: 'accent', label: 'Accent (first line)', type: 'color', default: '#ef6c6a' },
    { key: 'stickerColour', label: 'Sticker', type: 'color', default: '#0296c9' },
  ],
  styles: [
    { name: 'Fitted & editable (Moriston)', font: 'roboto-flex', values: {} },
    { name: 'Launch shout (Faction)', font: 'anybody', values: { kicker: '', lines: 'Introducing\n→Faction←\nA new display\ntypeface from\nLost Type', weights: '900', width: 50, fit: true, column: 34, valign: 'center', capsFirst: true, bar: false, byline: 'Designed by Shiva Nallaperumal', cta: 'Get Faction', bg: '#000000', ink: '#ffffff', accent: '#ffffff' } },
    { name: 'Literary (NaN Tragedy)', font: 'fraunces', values: { kicker: '', lines: 'Tragedy, an original\ntypeface in Text, Italic\n& Display styles', weights: '600, 300, 400', fit: true, column: 70, valign: 'center', capsFirst: false, bar: false, sticker: false, byline: 'Infinite scroll ↓', bg: '#000000', ink: '#f2f2f2', accent: '#43e04a' } },
    { name: 'Claim beside glyph (Compressa)', font: 'big-shoulders', values: { kicker: '', lines: 'A new typeface.\nNot just condensed,\nit’s Compressa!', weights: '700, 500, 800', fit: true, column: 40, valign: 'center', capsFirst: false, bar: false, sticker: false, byline: '', bg: '#3d98d9', ink: '#ffffff', accent: '#ffffff' } },
  ],
  Component: SentenceAsSpecimen,
};
