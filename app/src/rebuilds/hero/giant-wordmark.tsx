import { useMemo } from 'react';
import { fvs, type Font } from '../fonts';
import type { Rebuild, RebuildProps } from '../types';

// Deterministic pseudo-random per letter, so the medley and timings are stable across renders.
const hash = (i: number, salt: number) => { const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); };

// Axis values for letter i in "medley" mode: spread across each axis' range.
function medley(font: Font, i: number) {
  return Object.fromEntries(Object.entries(font.axes).map(([tag, a], k) => [tag, a.min + hash(i, k + 1) * (a.max - a.min)]));
}

function GiantWordmark({ v, font, width, height }: RebuildProps) {
  const name = String(v.name);
  const letters = [...name];
  const size = (Number(v.size) / 100) * width;
  const mode = String(v.mode);
  const axes = Object.entries(font.axes).filter(([tag]) => tag !== 'opsz');
  // Rolling: each letter loops between the extremes of the font's axes at its own speed (PP Fragment's
  // letters roll through four cuts at 1.3–2.3s each; with a variable font the "cuts" are axis extremes).
  const keyframes = useMemo(() => axes.length ? `@keyframes gw-roll { 0%, 100% { font-variation-settings: ${fvs(font, Object.fromEntries(axes.map(([t, a]) => [t, a.min])))}; } 50% { font-variation-settings: ${fvs(font, Object.fromEntries(axes.map(([t, a]) => [t, a.max])))}; } }` : '', [font.id]);
  const align = String(v.align);
  return (
    <div style={{ width, height, background: String(v.bg), color: String(v.fg), position: 'relative', overflow: 'hidden', fontFamily: `'${font.family}'` }}>
      <style>{keyframes}</style>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: 40,
        justifyContent: align === 'center' ? 'center' : 'flex-end', alignItems: align === 'center' ? 'center' : 'flex-start',
        transform: v.crop ? `translateX(${-size * 0.35}px)` : undefined }}>
        <h1 style={{ margin: 0, fontSize: size, lineHeight: 0.92, fontWeight: 'normal', whiteSpace: 'nowrap', letterSpacing: `${Number(v.tracking)}em`,
          textTransform: v.caps ? 'uppercase' : 'none', fontVariationSettings: fvs(font, { wght: Number(v.weight) }) }}>
          {letters.map((ch, i) => (
            <span key={i} style={{
              display: 'inline-block',
              fontVariationSettings: mode === 'medley' ? fvs(font, medley(font, i)) : undefined,
              fontStyle: mode === 'medley' && font.italic && hash(i, 9) > 0.6 ? 'italic' : undefined,
              color: mode === 'medley' && v.medleyColour ? `hsl(${Math.round(hash(i, 3) * 360)} 80% 55%)` : undefined,
              animation: mode === 'rolling' ? `gw-roll ${1.3 + hash(i, 5) * 1.0}s ${-hash(i, 7) * 2}s ease-in-out infinite` : undefined,
            }}>{ch === ' ' ? ' ' : ch}</span>
          ))}
        </h1>
        {String(v.labels) && (
          <div style={{ display: 'flex', gap: 24, justifyContent: 'space-between', width: align === 'center' ? Math.min(width - 80, size * letters.length * 0.55) : 'auto', marginTop: 14, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.8 }}>
            {String(v.labels).split(/\s*·\s*|\s*,\s*/).map((l) => <span key={l}>{l}</span>)}
          </div>
        )}
      </div>
      {v.credits && (
        <>
          <div style={{ position: 'absolute', left: 40, bottom: 32, fontSize: 13, maxWidth: 360 }}>{String(v.creditLeft)}</div>
          <div style={{ position: 'absolute', right: 40, bottom: 32, fontSize: 13, textAlign: 'right' }}>{String(v.creditRight)}</div>
        </>
      )}
    </div>
  );
}

export const giantWordmark: Rebuild = {
  type: 'hero', variant: 'giant-wordmark',
  title: 'Giant wordmark',
  description: 'The family name as large as the viewport allows, little else. Modes from the corpus: static, letters rolling through the design space at different speeds, or a medley of styles per letter.',
  basedOn: ['pp-fragment-com#00', 'cnap-fr-sites-infini-en#00', 'karrik-phantom-foundry-com#00', 'excelsiorama-com#00', 'marbla-de#00'],
  params: [
    { key: 'name', label: 'Name', type: 'text', default: 'Fragment' },
    { key: 'labels', label: 'Labels under the name', type: 'text', default: 'Sans · Glare · Serif · Text' },
    { key: 'mode', label: 'Letter behaviour', type: 'select', options: ['static', 'rolling', 'medley'], default: 'rolling' },
    { key: 'size', label: 'Size (vw)', type: 'range', min: 6, max: 40, step: 0.5, default: 15 },
    { key: 'weight', label: 'Weight', type: 'range', min: 100, max: 1000, default: 400 },
    { key: 'tracking', label: 'Tracking (em)', type: 'range', min: -0.08, max: 0.2, step: 0.005, default: -0.01 },
    { key: 'align', label: 'Placement', type: 'select', options: ['center', 'bottom-left'], default: 'center' },
    { key: 'caps', label: 'Uppercase', type: 'toggle', default: true },
    { key: 'crop', label: 'Crop off the left edge', type: 'toggle', default: false },
    { key: 'medleyColour', label: 'Colour each letter (medley)', type: 'toggle', default: false },
    { key: 'credits', label: 'Corner credits', type: 'toggle', default: true },
    { key: 'creditLeft', label: 'Credit, left', type: 'text', default: 'A new font by Francesca Bolognini & Mathieu Desjardins' },
    { key: 'creditRight', label: 'Credit, right', type: 'text', default: 'Available exclusively at the foundry' },
    { key: 'bg', label: 'Background', type: 'color', default: '#020202' },
    { key: 'fg', label: 'Ink', type: 'color', default: '#f9f9f9' },
  ],
  styles: [
    { name: 'Rolling cuts (Fragment)', font: 'roboto-flex', values: { mode: 'rolling', bg: '#020202', fg: '#f9f9f9', caps: true, align: 'center' } },
    { name: 'Monument (Infini)', font: 'big-shoulders', values: { name: 'Infini', mode: 'static', size: 30, weight: 500, labels: 'A typeface by Sandrine Nugue · Public commission, CNAP', bg: '#000000', fg: '#ffffff', credits: false } },
    { name: 'Blunt (Karrik)', font: 'inter', values: { name: 'Karrik regular, italic', mode: 'static', size: 11, weight: 800, caps: false, align: 'bottom-left', labels: '', bg: '#050505', fg: '#ffffff', credits: false } },
    { name: 'Style medley (Excelsiorama)', font: 'fraunces', values: { name: 'Excelsiorama', mode: 'medley', medleyColour: true, size: 13, caps: true, labels: '', bg: '#1d1d1d', fg: '#ffffff', credits: false } },
    { name: 'Cropped soft (Marbla)', font: 'shantell', values: { name: 'marbla', mode: 'static', size: 26, weight: 300, caps: false, crop: true, align: 'center', labels: '', bg: '#d6d0ec', fg: '#2a2a35', credits: false } },
  ],
  Component: GiantWordmark,
};
