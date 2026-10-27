import { useState } from 'react';
import { fvs, type Font } from '../fonts';
import type { Rebuild, RebuildProps } from '../types';

// Presets that set every axis at once (Recursive's 66 named instances, generated from the font's axes).
function presets(font: Font) {
  const out: [string, Record<string, number>][] = [['Default', Object.fromEntries(Object.entries(font.axes).map(([t, a]) => [t, a.default]))]];
  const w = font.axes.wght;
  for (const [name, wt] of [['Light', 300], ['Regular', 400], ['Bold', 700], ['ExtraBlack', 1000]] as const) {
    if (w && wt >= w.min && wt <= w.max) {
      if (font.axes.CASL) for (const [c, cn] of [[0, 'Linear'], [1, 'Casual']] as const) for (const [m, mn] of [[0, 'Sans'], [1, 'Mono']] as const)
        out.push([`${mn} ${cn} ${name}`, { ...out[0][1], wght: wt, CASL: c, MONO: m }]);
      else out.push([name, { ...out[0][1], wght: wt }]);
    }
  }
  return out;
}

function GlobalToolbar({ v, font, width, height }: RebuildProps) {
  const ps = presets(font);
  const [axes, setAxes] = useState<Record<string, number>>(ps[0][1]);
  const [preset, setPreset] = useState(ps[0][0]);
  const [size, setSize] = useState(Number(v.size));
  const [italic, setItalic] = useState(false);
  const [caps, setCaps] = useState(false);
  const [inverted, setInverted] = useState(false);
  const bg = inverted ? String(v.ink) : String(v.bg), ink = inverted ? String(v.bg) : String(v.ink);
  const chapters = String(v.text).split('\n\n').filter(Boolean);
  const ui = { fontFamily: 'ui-monospace, monospace', fontSize: 12 };
  const buttons = String(v.bar) === 'buttons';
  const Round = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) => (
    <button onClick={onClick} style={{ ...ui, borderRadius: 999, border: `1px solid ${ink}`, background: on ? ink : bg, color: on ? bg : ink, padding: '4px 10px', cursor: 'pointer' }}>{children}</button>
  );
  return (
    <div style={{ width, height, background: bg, color: ink, overflow: 'auto', transition: 'background .3s, color .3s' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: bg, borderBottom: `1px solid ${ink}`, display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', padding: '8px 16px', ...ui }}>
        {buttons ? (
          <>
            {ps.slice(1, 5).map(([n, a]) => <Round key={n} on={preset === n} onClick={() => { setPreset(n); setAxes(a); }}>{n}</Round>)}
            {font.italic && <Round on={italic} onClick={() => setItalic(!italic)}>Italic</Round>}
            <Round on={caps} onClick={() => setCaps(!caps)}>Caps</Round>
            {[['XS', 14], ['S', 18], ['M', 24], ['L', 36], ['XL', 56]].map(([n, s]) => <Round key={n as string} on={size === s} onClick={() => setSize(s as number)}>{n as string}</Round>)}
          </>
        ) : (
          <>
            <select value={preset} onChange={(e) => { setPreset(e.target.value); setAxes(ps.find(([n]) => n === e.target.value)![1]); }} style={{ ...ui, background: bg, color: ink, border: `1px solid ${ink}`, padding: '3px 6px' }}>
              {ps.map(([n]) => <option key={n}>{n}</option>)}
            </select>
            <label>{size}pt <input type="range" min={10} max={72} value={size} onChange={(e) => setSize(+e.target.value)} style={{ width: 90, accentColor: ink }} /></label>
            {Object.entries(font.axes).filter(([t]) => t !== 'opsz').map(([tag, a]) => (
              <label key={tag} style={{ opacity: 0.85 }}>{tag} <b>{Math.round((axes[tag] ?? a.default) * 100) / 100}</b>
                <input type="range" min={a.min} max={a.max} step={(a.max - a.min) / 200} value={axes[tag] ?? a.default} onChange={(e) => { setPreset('Custom'); setAxes({ ...axes, [tag]: +e.target.value }); }} style={{ width: 70, accentColor: ink, verticalAlign: 'middle' }} />
              </label>
            ))}
          </>
        )}
        <button onClick={() => setInverted(!inverted)} title="Invert page" style={{ ...ui, background: ink, color: bg, border: 0, padding: '4px 8px', cursor: 'pointer' }}>◐</button>
      </div>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 40px 120px' }}>
        {chapters.map((c, i) => {
          const [head, ...body] = c.split('\n');
          return (
            <section key={i} style={{ marginBottom: 56 }}>
              <h2 style={{ ...ui, fontSize: 13, fontWeight: 'normal', opacity: 0.6 }}>## {head}</h2>
              <div contentEditable suppressContentEditableWarning spellCheck={false} style={{
                outline: 'none', fontFamily: `'${font.family}'`, fontSize: size, lineHeight: 1.35, fontStyle: italic ? 'italic' : 'normal',
                textTransform: caps ? 'uppercase' : 'none', fontVariationSettings: fvs(font, { opsz: Math.min(144, size), ...axes }), transition: 'font-variation-settings .25s',
              }}>{body.join(' ')}</div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export const globalToolbar: Rebuild = {
  type: 'type-tester', variant: 'global-toolbar',
  title: 'Global toolbar',
  description: 'One persistent toolbar restyles every editable block on the page: named presets that set all axes at once, size, individual axes and an invert switch; or a row of round style buttons.',
  basedOn: ['recursive-design#01', 'gt-super-com#01'],
  params: [
    { key: 'bar', label: 'Toolbar style', type: 'select', options: ['sliders', 'buttons'], default: 'sliders' },
    { key: 'size', label: 'Initial size (pt)', type: 'range', min: 10, max: 72, default: 22 },
    { key: 'text', label: 'Chapters (blank line between; first line = heading)', type: 'text', multiline: true,
      default: 'Maximum utility. Maximum fun.\nBuilt to maximize versatility, control, and performance, this typeface lets you choose from a wide range of predefined styles or dial in exactly what you want for each of its axes.\n\nOne font. Infinite combinations.\nEverything set from the toolbar applies to every editable block on the page, so you test the font across real paragraphs, not a single line.\n\nReady for work. Ready for play.\nSwitch between linear and casual, proportional and mono, light and black, and invert the page to read it in the dark.' },
    { key: 'bg', label: 'Background', type: 'color', default: '#ffffff' },
    { key: 'ink', label: 'Ink', type: 'color', default: '#111111' },
  ],
  styles: [
    { name: 'Axis bar (Recursive)', font: 'recursive', values: {} },
    { name: 'Style bar (GT Super)', font: 'fraunces', values: { bar: 'buttons', bg: '#f6f1e7', ink: '#2a2118', size: 24 } },
    { name: 'Dark reading (Inter)', font: 'inter', values: { bg: '#121212', ink: '#e8e8e8', size: 18 } },
  ],
  Component: GlobalToolbar,
};
