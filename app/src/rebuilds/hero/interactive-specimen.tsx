import { useEffect, useRef, useState } from 'react';
import { fvs } from '../fonts';
import type { Rebuild, RebuildProps } from '../types';

function InteractiveSpecimen({ v, font, width, height }: RebuildProps) {
  const ax = font.axes[String(v.axisX)] ? String(v.axisX) : Object.keys(font.axes)[0];
  const ay = font.axes[String(v.axisY)] ? String(v.axisY) : Object.keys(font.axes)[1] ?? ax;
  const A = font.axes[ax], B = font.axes[ay];
  const [t, setT] = useState({ x: 0.5, y: 0.5 }); // normalised positions on both axes
  const box = useRef<HTMLDivElement>(null);
  const mode = String(v.mode);

  useEffect(() => {
    const el = box.current!;
    const onMove = (e: PointerEvent) => {
      if (mode !== 'pointer') return;
      const r = el.getBoundingClientRect();
      setT({ x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) });
    };
    // Wheel drives the X axis without scrolling the page (Kachibuwa's contrast).
    const onWheel = (e: WheelEvent) => {
      if (mode !== 'wheel') return;
      e.preventDefault();
      setT((p) => ({ ...p, x: Math.min(1, Math.max(0, p.x + e.deltaY / 1500)) }));
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => { el.removeEventListener('pointermove', onMove); el.removeEventListener('wheel', onWheel); };
  }, [mode]);

  const val = (a: typeof A, k: number) => (a ? Math.round(a.min + k * (a.max - a.min)) : 0);
  const settings = { [ax]: val(A, t.x), ...(ay !== ax ? { [ay]: val(B, t.y) } : {}) };
  const pct = (k: number) => `${Math.round(k * 100)}%`;
  const echoes = Number(v.echoes);
  const readout = { fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' as const };

  return (
    <div ref={box} style={{ width, height, background: String(v.bg), color: String(v.ink), position: 'relative', overflow: 'hidden', fontFamily: `'${font.family}'`, cursor: mode === 'pointer' ? 'crosshair' : 'default', userSelect: 'none' }}>
      {v.readouts && <>
        <div style={{ ...readout, position: 'absolute', top: 18, width: '100%', textAlign: 'center' }}>{ax} {pct(t.x)} · {settings[ax]}</div>
        {ay !== ax && <div style={{ ...readout, position: 'absolute', bottom: 18, width: '100%', textAlign: 'center' }}>{ay} {pct(t.y)} · {settings[ay]}</div>}
        {mode === 'pointer' && <div style={{ position: 'absolute', left: `${t.x * 100}%`, top: 0, bottom: 0, borderLeft: `1px dashed ${String(v.ink)}40` }} />}
      </>}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {Array.from({ length: echoes }, (_, i) => echoes - i).map((k) => (
          <div key={k} style={{ fontSize: Number(v.size) * (1 - k * 0.08), lineHeight: 0.8, opacity: 0.15 + 0.6 * (1 - k / (echoes + 1)) * 0.5, whiteSpace: 'nowrap',
            fontVariationSettings: fvs(font, { [ax]: val(A, Math.max(0, t.x - k * 0.12)), [ay]: val(B, t.y) }) }}>{String(v.text)}</div>
        ))}
        <div contentEditable={!!v.editable} suppressContentEditableWarning spellCheck={false}
          style={{ fontSize: Number(v.size), lineHeight: 1, whiteSpace: 'nowrap', outline: 'none', fontVariationSettings: fvs(font, settings), transition: mode === 'shuffle' ? 'font-variation-settings .6s ease' : undefined }}>
          {String(v.text)}
        </div>
        {String(v.caption) && <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, maxWidth: 520, textAlign: 'center', opacity: 0.8 }}>{String(v.caption)}</p>}
        {(mode === 'sliders' || mode === 'shuffle') && (
          <div style={{ ...readout, display: 'flex', gap: 22, alignItems: 'center', marginTop: 18 }}>
            {[[ax, 'x'], ...(ay !== ax ? [[ay, 'y']] : [])].map(([tag, k]) => (
              <label key={tag} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{tag}
                <input type="range" min={0} max={1} step={0.001} value={t[k as 'x' | 'y']} onChange={(e) => setT({ ...t, [k]: Number(e.target.value) })} style={{ accentColor: String(v.ink) }} />
              </label>
            ))}
            <button onClick={() => setT({ x: Math.random(), y: Math.random() })} style={{ ...readout, background: String(v.ink), color: String(v.bg), border: 0, padding: '6px 10px', cursor: 'pointer' }}>Shuffle!</button>
          </div>
        )}
      </div>
    </div>
  );
}

export const interactiveSpecimen: Rebuild = {
  type: 'hero', variant: 'interactive-specimen',
  title: 'Interactive specimen',
  description: 'The hero is a specimen the visitor drives immediately: by pointer position (x and y each map to an axis), by the scroll wheel, or by sliders with a shuffle button.',
  basedOn: ['kachibuwa-com#00', 'heydon-works-skwar#00', 'garet-typeforward-com#00'],
  params: [
    { key: 'text', label: 'Text', type: 'text', default: 'SKWAR' },
    { key: 'mode', label: 'Driven by', type: 'select', options: ['pointer', 'wheel', 'sliders', 'shuffle'], default: 'pointer' },
    { key: 'axisX', label: 'Axis X / wheel', type: 'select', options: ['wght', 'wdth', 'opsz', 'slnt', 'CASL', 'MONO', 'SOFT', 'BNCE', 'INFM', 'GRAD'], default: 'wght' },
    { key: 'axisY', label: 'Axis Y', type: 'select', options: ['wdth', 'wght', 'opsz', 'slnt', 'CASL', 'MONO', 'SOFT', 'WONK', 'BNCE', 'GRAD'], default: 'wdth' },
    { key: 'size', label: 'Size (px)', type: 'range', min: 60, max: 400, default: 220 },
    { key: 'echoes', label: 'Echo stack (Skwar)', type: 'range', min: 0, max: 8, default: 4 },
    { key: 'readouts', label: 'Axis readouts', type: 'toggle', default: true },
    { key: 'editable', label: 'Editable text', type: 'toggle', default: true },
    { key: 'caption', label: 'Caption', type: 'text', default: 'a very square, monospaced variable font with weight and width axes' },
    { key: 'bg', label: 'Background', type: 'color', default: '#000000' },
    { key: 'ink', label: 'Ink', type: 'color', default: '#ffffff' },
  ],
  styles: [
    { name: 'Echo pyramid (Skwar)', font: 'roboto-flex', values: {} },
    { name: 'Wheel contrast (Kachibuwa)', font: 'fraunces', values: { text: 'Kachi', mode: 'wheel', axisX: 'SOFT', axisY: 'opsz', echoes: 0, size: 340, caption: '', bg: '#000000', ink: '#ffffff' } },
    { name: 'Casual × mono (Recursive)', font: 'recursive', values: { text: 'recursive', mode: 'pointer', axisX: 'CASL', axisY: 'MONO', echoes: 0, size: 200, caption: 'move across: casual → linear, down: sans → mono', bg: '#f7f7f2', ink: '#101010' } },
    { name: 'Sliders + shuffle', font: 'anybody', values: { text: 'Anybody', mode: 'shuffle', axisX: 'wght', axisY: 'wdth', echoes: 0, size: 200, caption: '', bg: '#ff3b4e', ink: '#ffffff' } },
  ],
  Component: InteractiveSpecimen,
};
