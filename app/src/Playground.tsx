import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FONTS, fontById, useFonts } from './rebuilds/fonts';
import { defaults, type Param, type Rebuild, type Values } from './rebuilds/types';

const DEVICES = { desktop: { w: 1440, h: 900 }, mobile: { w: 390, h: 844 } };

// A rebuilt component in a scaled device frame, with a controls panel generated from its params.
export function Playground({ rebuild, onExample }: { rebuild: Rebuild; onExample: (id: string) => void }) {
  const [styleIdx, setStyleIdx] = useState(0);
  const [fontId, setFontId] = useState(rebuild.styles[0]?.font ?? FONTS[0].id);
  const [values, setValues] = useState<Values>({ ...defaults(rebuild), ...rebuild.styles[0]?.values });
  const [device, setDevice] = useState<keyof typeof DEVICES>('desktop');
  const [scale, setScale] = useState(0.5);
  const frame = useRef<HTMLDivElement>(null);
  useFonts(FONTS.map((f) => f.id));

  const { w, h } = DEVICES[device];
  useLayoutEffect(() => {
    const el = frame.current!;
    const fit = () => setScale(Math.min((el.clientWidth - 32) / w, (el.clientHeight - 32) / h));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h]);

  const applyStyle = (i: number) => {
    setStyleIdx(i);
    setFontId(rebuild.styles[i].font);
    setValues({ ...defaults(rebuild), ...rebuild.styles[i].values });
  };
  useEffect(() => applyStyle(0), [rebuild]);

  const set = (key: string, val: Values[string]) => setValues((prev) => ({ ...prev, [key]: val }));
  const { Component } = rebuild;
  return (
    <div className="playground">
      <div className="pg-frame" ref={frame}>
        <div className="pg-device" style={{ width: w * scale, height: h * scale }}>
          <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
            <Component v={values} font={fontById(fontId)} width={w} height={h} />
          </div>
        </div>
      </div>
      <aside className="pg-panel">
        <p className="muted small">{rebuild.description}</p>
        <h3>Style</h3>
        <div className="pg-styles">
          {rebuild.styles.map((s, i) => <button key={s.name} className={i === styleIdx ? 'active' : ''} onClick={() => applyStyle(i)}>{s.name}</button>)}
        </div>
        <h3>Typeface</h3>
        <select value={fontId} onChange={(e) => setFontId(e.target.value)}>
          {FONTS.map((f) => <option key={f.id} value={f.id}>{f.family}{Object.keys(f.axes).length ? ` (${Object.keys(f.axes).join(' ')})` : ''}{f.corpus ? ' ★' : ''}</option>)}
        </select>
        <div className="pg-device-toggle">
          {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((d) => <button key={d} className={d === device ? 'active' : ''} onClick={() => setDevice(d)}>{d} {DEVICES[d].w}</button>)}
        </div>
        <h3>Parameters</h3>
        <div className="pg-params">{rebuild.params.map((p) => <Control key={p.key} p={p} value={values[p.key]} onChange={(val) => set(p.key, val)} />)}</div>
        <h3>Reconstructed from</h3>
        <ul className="pg-based">{rebuild.basedOn.map((id) => <li key={id}><button onClick={() => onExample(id)}>{id}</button></li>)}</ul>
        <p className="muted small">★ fonts also appear in the studied corpus. Fonts load from Google Fonts; the originals are commercial and not redistributed.</p>
      </aside>
    </div>
  );
}

function Control({ p, value, onChange }: { p: Param; value: Values[string]; onChange: (v: Values[string]) => void }) {
  switch (p.type) {
    case 'text':
      return <label>{p.label}{p.multiline
        ? <textarea rows={3} value={String(value)} onChange={(e) => onChange(e.target.value)} />
        : <input value={String(value)} onChange={(e) => onChange(e.target.value)} />}</label>;
    case 'range':
      return <label>{p.label} <output>{Number(value)}{p.unit ?? ''}</output>
        <input type="range" min={p.min} max={p.max} step={p.step ?? 1} value={Number(value)} onChange={(e) => onChange(Number(e.target.value))} /></label>;
    case 'select':
      return <label>{p.label}<select value={String(value)} onChange={(e) => onChange(e.target.value)}>{p.options.map((o) => <option key={o}>{o}</option>)}</select></label>;
    case 'toggle':
      return <label className="pg-toggle"><input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /> {p.label}</label>;
    case 'color':
      return <label className="pg-color">{p.label}<input type="color" value={String(value)} onChange={(e) => onChange(e.target.value)} /></label>;
  }
}
