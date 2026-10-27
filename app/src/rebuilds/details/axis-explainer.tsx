import { useEffect, useState } from 'react';
import { fvs, type Font } from '../fonts';
import type { Rebuild, RebuildProps } from '../types';

type Spec = { tag: string; word: string; lo: string; hi: string; note: string };
const parse = (s: string): Spec[] => s.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p.length >= 4)
  .map(([tag, word, lo, hi, note = '']) => ({ tag, word, lo, hi, note }));

function AxisSection({ spec, font, v }: { spec: Spec; font: Font; v: RebuildProps['v'] }) {
  const a = font.axes[spec.tag];
  const [t, setT] = useState(0.5);
  const loop = String(v.mode) === 'loop';
  // Ping-pong animation in loop mode, so the dot and the readout stay in sync with the glyphs.
  useEffect(() => {
    if (!loop || !a) return;
    let raf = 0;
    const start = performance.now(), period = Number(v.period) * 1000;
    const tick = (now: number) => { const p = ((now - start) % period) / period; setT(0.5 - 0.5 * Math.cos(p * 2 * Math.PI)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loop, a, v.period]);
  if (!a) return <div style={{ padding: 24, opacity: 0.5, fontFamily: 'ui-monospace, monospace' }}>{font.family} has no “{spec.tag}” axis — pick another typeface or edit the axis list.</div>;
  const val = a.min + t * (a.max - a.min);
  const ink = String(v.ink), accent = String(v.accent);
  const label = { fontFamily: 'ui-monospace, monospace', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase' as const };
  return (
    <section style={{ padding: '48px 40px', textAlign: 'center', borderTop: `1px solid ${ink}22` }}>
      <div style={{ ...label, display: 'grid', gridTemplateColumns: '1fr 340px 1fr', alignItems: 'center', gap: 16, maxWidth: 760, margin: '0 auto' }}>
        <span style={{ textAlign: 'right' }}>{spec.lo}</span>
        <span style={{ position: 'relative', height: 14 }}>
          <span style={{ position: 'absolute', left: 0, right: 0, top: 6, borderTop: `1px solid ${ink}55` }} />
          <span style={{ position: 'absolute', top: 1, left: `calc(${t * 100}% - 6px)`, width: 12, height: 12, borderRadius: '50%', background: accent }} />
        </span>
        <span style={{ textAlign: 'left' }}>{spec.hi}</span>
      </div>
      <div contentEditable suppressContentEditableWarning spellCheck={false} style={{ outline: 'none', fontFamily: `'${font.family}'`, fontSize: Number(v.size), lineHeight: 1.05, color: accent, margin: '18px 0 10px', fontVariationSettings: fvs(font, { [spec.tag]: val }) }}>{spec.word}</div>
      <div style={{ ...label, opacity: 0.7 }}>{spec.tag} {Math.round(val * 100) / 100}</div>
      {!loop && <input type="range" min={0} max={1} step={0.001} value={t} onChange={(e) => setT(+e.target.value)} style={{ width: 340, accentColor: accent, marginTop: 10 }} />}
      {spec.note && <p style={{ maxWidth: 640, margin: '14px auto 0', fontFamily: `'${font.family}'`, fontSize: 18, lineHeight: 1.5, color: ink }}>{spec.note}</p>}
    </section>
  );
}

function AxisExplainer({ v, font, width, height }: RebuildProps) {
  return (
    <div style={{ width, height, background: String(v.bg), color: String(v.ink), overflow: 'auto' }}>
      {parse(String(v.axes)).map((s, i) => <AxisSection key={`${s.tag}-${i}`} spec={s} font={font} v={v} />)}
    </div>
  );
}

export const axisExplainer: Rebuild = {
  type: 'design-details', variant: 'axis-explainer',
  title: 'Axis explainer',
  description: 'One section per variable axis: endpoint labels with a dot that travels between them, a headline set along the axis (looping or driven by a slider), the live value, and a short note.',
  basedOn: ['gt-alpina-com#03', 'gt-america-com#03', 'marbla-de#02', 'gt-flexa-com#07'],
  params: [
    { key: 'mode', label: 'Driven by', type: 'select', options: ['loop', 'slider'], default: 'loop' },
    { key: 'axes', label: 'Axes (tag | word | low label | high label | note)', type: 'text', multiline: true,
      default: 'wght | Weight | Thin | Black | The stroke thickens while counters stay open.\nwdth | Width | Condensed | Extended | From compressed headlines to wide display settings.\nopsz | Optical size | Caption | Display | Small sizes get sturdier details and looser spacing.' },
    { key: 'size', label: 'Headline size (px)', type: 'range', min: 48, max: 240, default: 144 },
    { key: 'period', label: 'Loop period (s)', type: 'range', min: 1.5, max: 10, step: 0.5, default: 4 },
    { key: 'bg', label: 'Background', type: 'color', default: '#fbfaf7' },
    { key: 'ink', label: 'Ink', type: 'color', default: '#111111' },
    { key: 'accent', label: 'Accent', type: 'color', default: '#e0322b' },
  ],
  styles: [
    { name: 'Looping axes (Alpina)', font: 'roboto-flex', values: {} },
    { name: 'Slider per axis (Marbla)', font: 'shantell', values: { mode: 'slider', bg: '#d6d0ec', ink: '#2a2a35', accent: '#2a2a35',
      axes: 'BNCE | Bounce | Steady | Bouncy | Letters hop off the baseline.\nINFM | Informal | Formal | Informal | Shapes get looser and more handwritten.\nSPAC | Spacing | Tight | Wide | Spacing opens up for small, playful settings.' } },
    { name: 'Casual & mono (Recursive)', font: 'recursive', values: { bg: '#111111', ink: '#f2f2f2', accent: '#ffd400', size: 120,
      axes: 'CASL | Casual | Linear | Casual | From rational sans to brushy casual forms.\nMONO | Monospace | Sans | Mono | Proportional or fixed-width, on one axis.\nslnt | Slant | Upright | Slanted | Up to −15°, with cursive forms kicking in.' } },
  ],
  Component: AxisExplainer,
};
