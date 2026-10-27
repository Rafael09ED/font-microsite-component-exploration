import { useState } from 'react';
import { fvs, type Font } from '../fonts';
import type { Rebuild, RebuildProps } from '../types';

// Named instances derived from the font's weight range (the "Variable" entry frees the sliders).
const instances = (font: Font) => {
  const w = font.axes.wght;
  const names: [string, number][] = [['Thin', 100], ['Light', 300], ['Regular', 400], ['Medium', 500], ['Bold', 700], ['Black', 900]];
  return [['Variable', NaN] as [string, number], ...(w ? names.filter(([, v]) => v >= w.min && v <= w.max) : [])];
};

type RowState = { inst: string; size: number; leading: number; align: 'left' | 'center' | 'right'; axes: Record<string, number> };

function Row({ text, font, initial, v }: { text: string; font: Font; initial: RowState; v: RebuildProps['v'] }) {
  const [s, set] = useState<RowState>(initial);
  const insts = instances(font);
  const preset = insts.find(([n]) => n === s.inst)?.[1];
  const axes = Number.isNaN(preset) || preset === undefined ? s.axes : { ...s.axes, wght: preset };
  const ctl = String(v.controlColour);
  const label = { fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: ctl, display: 'flex', alignItems: 'center', gap: 8 };
  const cards = String(v.layout) === 'cards';
  return (
    <div style={cards ? { background: String(v.card), padding: 18, borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 260 } : { padding: '22px 0', borderTop: `1px solid ${ctl}55` }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
        <label style={label}><select value={s.inst} onChange={(e) => set({ ...s, inst: e.target.value })} style={{ ...label, background: 'transparent', border: `1px solid ${ctl}`, padding: '2px 4px' }}>
          {insts.map(([n]) => <option key={n}>{n}</option>)}</select></label>
        <label style={label}>size <input type="range" min={12} max={320} value={s.size} onChange={(e) => set({ ...s, size: +e.target.value })} style={{ accentColor: ctl, width: 110 }} />{s.size}px</label>
        <label style={label}>leading <input type="range" min={0.8} max={2} step={0.05} value={s.leading} onChange={(e) => set({ ...s, leading: +e.target.value })} style={{ accentColor: ctl, width: 80 }} />{s.leading}</label>
        {Object.entries(font.axes).filter(([t]) => t !== 'opsz' && (t !== 'wght' || Number.isNaN(preset))).slice(0, 3).map(([tag, a]) => (
          <label key={tag} style={label}>{tag} <input type="range" min={a.min} max={a.max} step={(a.max - a.min) / 100} value={s.axes[tag] ?? a.default}
            onChange={(e) => set({ ...s, axes: { ...s.axes, [tag]: +e.target.value } })} style={{ accentColor: ctl, width: 90 }} />{Math.round((s.axes[tag] ?? a.default) * 10) / 10}</label>
        ))}
        <span style={label}>{(['left', 'center', 'right'] as const).map((al) => (
          <button key={al} onClick={() => set({ ...s, align: al })} style={{ ...label, border: `1px solid ${ctl}`, background: s.align === al ? ctl : 'transparent', color: s.align === al ? String(v.bg) : ctl, padding: '1px 6px', cursor: 'pointer' }}>{al[0]}</button>
        ))}</span>
      </div>
      <div contentEditable suppressContentEditableWarning spellCheck={false} style={{
        fontFamily: `'${font.family}'`, fontSize: s.size, lineHeight: s.leading, textAlign: s.align, outline: 'none',
        whiteSpace: s.size > 60 ? 'nowrap' : 'normal', overflow: 'hidden', fontVariationSettings: fvs(font, { opsz: Math.min(144, s.size), ...axes }),
        columnCount: s.size < 30 && !cards ? 2 : 1, columnGap: 40,
      }}>{text}</div>
    </div>
  );
}

function PerRowControls({ v, font, width, height }: RebuildProps) {
  const texts = String(v.samples).split('\n').filter(Boolean);
  const sizes = String(v.sizes).split(',').map((n) => Number(n) || 48);
  const cards = String(v.layout) === 'cards';
  return (
    <div style={{ width, height, background: String(v.bg), color: String(v.ink), overflow: 'auto', padding: cards ? 16 : '24px 48px' }}>
      {String(v.title) && <div style={{ fontFamily: `'${font.family}'`, fontSize: 64, letterSpacing: '0.5em', textAlign: 'center', margin: '8px 0 16px' }}>{String(v.title)}</div>}
      <div style={cards ? { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 } : {}}>
        {texts.map((t, i) => (
          <Row key={`${font.id}-${i}`} text={t} font={font} v={v}
            initial={{ inst: 'Variable', size: sizes[i % sizes.length], leading: sizes[i % sizes.length] > 60 ? 1 : 1.4, align: sizes[i % sizes.length] > 60 && !cards ? 'center' : 'left',
              axes: Object.fromEntries(Object.entries(font.axes).map(([tag, a]) => [tag, tag === 'wght' ? [900, 300, 700, 400][i % 4] : a.default])) }} />
        ))}
      </div>
    </div>
  );
}

export const perRowControls: Rebuild = {
  type: 'type-tester', variant: 'per-row-controls',
  title: 'Per-row tester',
  description: 'Several sample rows, each with its own instance, size, leading, axis and alignment controls; click any sample to type. Different defaults per row show the range before anyone touches a control.',
  basedOn: ['gt-america-com#26', 's-u-c-c-e-s-s-com#11', 'halyard-dardenstudio-com#03'],
  params: [
    { key: 'title', label: 'Title', type: 'text', default: 'TESTER' },
    { key: 'samples', label: 'Samples (one per row)', type: 'text', multiline: true, default: 'Call to action\nTasty Mixture\nNo Additional Preservatives\nThe use of fermentation, particularly for beverages, has existed since the Neolithic and has been documented dating from 7000–6600 BCE in Jiahu, China, 5000 BCE in India, and 1500 BC in Sudan.' },
    { key: 'sizes', label: 'Initial sizes (comma list, px)', type: 'text', default: '220, 140, 72, 21' },
    { key: 'layout', label: 'Layout', type: 'select', options: ['stack', 'cards'], default: 'stack' },
    { key: 'bg', label: 'Background', type: 'color', default: '#ff2e93' },
    { key: 'ink', label: 'Sample ink', type: 'color', default: '#ffffff' },
    { key: 'controlColour', label: 'Controls', type: 'color', default: '#39ff14' },
    { key: 'card', label: 'Card (cards layout)', type: 'color', default: '#ffffff' },
  ],
  styles: [
    { name: 'Neon rows (Success)', font: 'roboto-flex', values: {} },
    { name: 'Drawer rows (GT America)', font: 'roboto-flex', values: { title: '', bg: '#ffffff', ink: '#0303fd', controlColour: '#fd3402', samples: 'Tasty Mixture\nNo Additional Preservatives\nКиївські Троянди\nApple pie can be made with many different sorts of apples. The bottom crust may be baked separately to prevent it from getting soggy.', sizes: '150, 72, 72, 16' } },
    { name: 'Cards (Halyard)', font: 'inter', values: { title: '', layout: 'cards', bg: '#e9e9e9', ink: '#111111', controlColour: '#555555', card: '#ffffff', samples: 'Black\nWhenever the black fox jumped the squirrel gazed suspiciously.\nAmbitious\nReadability is the quality of being inviting. These two qualities are threads that run through Halyard.\nNo. 24\nItalic', sizes: '160, 40, 90, 18, 120, 80' } },
  ],
  Component: PerRowControls,
};
