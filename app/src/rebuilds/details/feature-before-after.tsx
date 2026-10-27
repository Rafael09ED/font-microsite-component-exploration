import { useState } from 'react';
import { fvs } from '../fonts';
import type { Rebuild, RebuildProps } from '../types';

type Feature = { tag: string; label: string; sample: string };
const parse = (s: string): Feature[] => s.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p.length >= 3).map(([tag, label, sample]) => ({ tag, label, sample }));

function FeatureRow({ f, v, font, mode, index }: { f: Feature; v: RebuildProps['v']; font: RebuildProps['font']; mode: string; index: number }) {
  const [on, setOn] = useState(true);
  const [hoverSide, setHoverSide] = useState<'alt' | 'std' | null>(null);
  const active = mode === 'halves' ? hoverSide !== 'std' : on;
  const ink = String(v.ink), accent = String(v.accent);
  const sample = (enabled: boolean, muted = false) => (
    <div contentEditable suppressContentEditableWarning spellCheck={false} style={{
      fontFamily: `'${font.family}'`, fontSize: Number(v.size), lineHeight: 1.15, outline: 'none', color: muted ? `${ink}55` : ink,
      fontFeatureSettings: `"${f.tag}" ${enabled ? 1 : 0}`, fontVariationSettings: fvs(font, { wght: Number(v.weight) }),
    }}>{f.sample}</div>
  );
  const pill = { fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase' as const };
  const band = String(v.bands) === 'on' ? { background: index % 2 ? `${accent}14` : 'transparent' } : {};
  return (
    <div style={{ padding: '36px 56px', borderTop: `1px solid ${ink}22`, ...band }}
      onPointerMove={mode === 'halves' ? (e) => { const r = e.currentTarget.getBoundingClientRect(); setHoverSide(e.clientX - r.left < r.width / 2 ? 'alt' : 'std'); } : undefined}
      onPointerLeave={mode === 'halves' ? () => setHoverSide(null) : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        {mode === 'pills' && (
          <button onClick={() => setOn(!on)} style={{ ...pill, border: `1.5px solid ${on ? accent : ink}`, background: on ? accent : 'transparent', color: on ? String(v.bg) : ink, borderRadius: 999, padding: '7px 16px', cursor: 'pointer' }}>
            {f.label} {on ? 'on' : 'off'}
          </button>
        )}
        {mode !== 'pills' && <span style={{ ...pill, color: ink }}>{f.label}</span>}
        <span style={{ ...pill, color: accent }}>[{f.tag}]</span>
        {mode === 'halves' && <span style={{ ...pill, opacity: 0.6, marginLeft: 'auto' }}>● {active ? 'Alternate' : 'Standard'} — move left / right</span>}
      </div>
      {mode === 'pairs' ? <>{sample(false, true)}{sample(true)}</> : sample(active)}
    </div>
  );
}

function FeatureBeforeAfter({ v, font, width, height }: RebuildProps) {
  const features = parse(String(v.features));
  return (
    <div style={{ width, height, background: String(v.bg), color: String(v.ink), overflow: 'auto' }}>
      {String(v.title) && <h2 style={{ fontFamily: `'${font.family}'`, fontWeight: 'normal', fontSize: 56, margin: 0, padding: '40px 56px 24px', fontVariationSettings: fvs(font, { wght: 250 }) }}>{String(v.title)}</h2>}
      {features.map((f, i) => <FeatureRow key={`${f.tag}-${i}-${String(v.mode)}`} f={f} v={v} font={font} mode={String(v.mode)} index={i} />)}
    </div>
  );
}

export const featureBeforeAfter: Rebuild = {
  type: 'design-details', variant: 'feature-before-after',
  title: 'Feature before / after',
  description: 'Each OpenType feature shown off vs on, on an editable sample, with its tag. Three mechanics from the corpus: toggle pills, grey "off" lines above the active ones, or hover halves (left alternate, right standard).',
  basedOn: ['tofino-losttype-com#12', 'andada-huertatipografica-com#14', 'gt-walsheim-com#09', 'mort-modern-losttype-com#03'],
  params: [
    { key: 'title', label: 'Title', type: 'text', default: 'An ocean of features' },
    { key: 'mode', label: 'Mechanic', type: 'select', options: ['pills', 'pairs', 'halves'], default: 'pills' },
    { key: 'features', label: 'Features (tag | label | sample per line)', type: 'text', multiline: true,
      default: 'ss01 | Open digits | 1234567890\ncv11 | Single-storey a | A garage full of javelins\ntnum | Tabular figures | 1,111.11 + 4,444.44\nfrac | Fractions | Surf height 13/16"\nzero | Slashed zero | 0x00F0 / 2040\ncase | Case-sensitive forms | (HAMBURG) — [OK] @HOME' },
    { key: 'size', label: 'Sample size (px)', type: 'range', min: 24, max: 200, default: 72 },
    { key: 'weight', label: 'Weight', type: 'range', min: 100, max: 900, default: 400 },
    { key: 'bands', label: 'Alternating bands', type: 'select', options: ['on', 'off'], default: 'on' },
    { key: 'bg', label: 'Background', type: 'color', default: '#e8f1f6' },
    { key: 'ink', label: 'Ink', type: 'color', default: '#0e2a3d' },
    { key: 'accent', label: 'Accent', type: 'color', default: '#ff6b5b' },
  ],
  styles: [
    { name: 'Pills on bands (Tofino)', font: 'inter', values: {} },
    { name: 'Off/on pairs (Andada)', font: 'inter', values: { mode: 'pairs', title: '', bands: 'off', bg: '#ffffff', ink: '#222222', accent: '#ff6a2a', size: 56 } },
    { name: 'Hover halves (Walsheim)', font: 'recursive', values: { mode: 'halves', title: 'Stylistic alternates', bands: 'off', bg: '#000000', ink: '#ffffff', accent: '#ffffff', size: 120, weight: 600,
      features: 'ss01 | Single-storey a | a garage of gadgets\nss02 | Single-storey g | going, giggling, gargling\ndlig | Code ligatures | => != === -> <= >=' } },
  ],
  Component: FeatureBeforeAfter,
};
