import { useEffect, useState } from 'react';
import { fvs, type Font } from '../fonts';
import type { Rebuild, RebuildProps } from '../types';

const SETS: [string, string][] = [
  ['Uppercase', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'],
  ['Lowercase', 'abcdefghijklmnopqrstuvwxyz'],
  ['Figures', '0123456789'],
  ['Punctuation', '.,:;…!¡?¿·•*#/\\(){}[]-–—_‚„“”‘’«»‹›"\''],
  ['Accented', 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿŁłŒœŠšŽž'],
  ['Symbols', '&@$€£¥¢%‰+−×÷=≠<>≤≥±~^§¶©®™°'],
];

// Vertical metrics of the loaded font at 1000px, measured from real glyph bounds.
function useMetrics(font: Font, axes: string) {
  const [m, setM] = useState<{ cap: number; x: number; asc: number; desc: number } | null>(null);
  useEffect(() => {
    const spec = `1000px '${font.family}'`;
    document.fonts.load(spec).then(() => {
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.font = spec;
      const up = (s: string) => ctx.measureText(s).actualBoundingBoxAscent / 1000;
      setM({ cap: up('H'), x: up('x'), asc: up('d'), desc: ctx.measureText('p').actualBoundingBoxDescent / 1000 });
    });
  }, [font.id, axes]);
  return m;
}

function GlyphInspector({ v, font, width, height }: RebuildProps) {
  const [glyph, setGlyph] = useState('Á');
  const axes = { wght: Number(v.weight), wdth: Number(v.widthAxis) };
  const m = useMetrics(font, JSON.stringify(axes));
  const previewSize = Number(v.previewSize);
  const disc = String(v.shape) === 'disc';
  const box = previewSize * 1.45;
  const baseline = box * 0.68; // baseline position inside the preview box
  const line = (y: number, label: string) => (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, borderTop: `1px solid ${String(v.metricColour)}`, fontSize: 9, fontFamily: 'ui-monospace, monospace', color: String(v.metricColour), paddingLeft: 6 }}>{label}</div>
  );
  const preview = (
    <div style={{ position: 'sticky', top: 24, flex: 'none' }}>
    <div style={{ position: 'relative', width: box, height: box, background: String(v.previewBg), color: String(v.previewInk), borderRadius: disc ? '50%' : 0, overflow: 'hidden' }}>
      {v.metrics && m && !disc && <>
        {line(baseline - m.asc * previewSize, `ascender ${Math.round(m.asc * 1000)}`)}
        {line(baseline - m.cap * previewSize, `cap height ${Math.round(m.cap * 1000)}`)}
        {line(baseline - m.x * previewSize, `x-height ${Math.round(m.x * 1000)}`)}
        {line(baseline, 'baseline 0')}
        {line(baseline + m.desc * previewSize, `descender −${Math.round(m.desc * 1000)}`)}
      </>}
      <div style={{ position: 'absolute', left: 0, right: 0, top: baseline - previewSize, height: previewSize, lineHeight: `${previewSize}px`, textAlign: 'center',
        fontFamily: `'${font.family}'`, fontSize: previewSize, fontVariationSettings: fvs(font, axes), display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <span style={{ lineHeight: 1, transform: 'translateY(0.22em)' }}>{glyph}</span>
      </div>
      <div style={{ position: 'absolute', left: 12, bottom: 10, fontFamily: 'ui-monospace, monospace', fontSize: 11, opacity: 0.7 }}>
        U+{glyph.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}
      </div>
    </div>
    </div>
  );
  const perRow = Number(v.perRow);
  const grid = (
    <div style={{ flex: 1, minWidth: 0 }}>
      {SETS.map(([name, chars]) => (
        <div key={name} style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', opacity: 0.7, margin: '0 0 6px' }}>{name} <span style={{ opacity: 0.6 }}>{[...chars].length}</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${perRow}, 1fr)`, borderTop: `1px solid ${String(v.rule)}`, borderLeft: `1px solid ${String(v.rule)}` }}>
            {[...chars].map((ch) => (
              <button key={ch} onMouseEnter={() => setGlyph(ch)} onClick={() => setGlyph(ch)} style={{
                aspectRatio: '1', border: 0, borderRight: `1px solid ${String(v.rule)}`, borderBottom: `1px solid ${String(v.rule)}`, cursor: 'pointer',
                background: ch === glyph ? String(v.activeBg) : 'transparent', color: ch === glyph ? String(v.activeInk) : 'inherit',
                fontFamily: `'${font.family}'`, fontSize: Number(v.cellSize), fontVariationSettings: fvs(font, axes),
              }}>{ch}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ width, height, background: String(v.bg), color: String(v.ink), overflow: 'auto', padding: 32 }}>
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexDirection: String(v.previewSide) === 'right' ? 'row-reverse' : 'row' }}>
        {preview}{grid}
      </div>
    </div>
  );
}

export const glyphInspector: Rebuild = {
  type: 'glyph-table', variant: 'glyph-inspector',
  title: 'Glyph inspector',
  description: 'A grid of the character set grouped by category, with a pinned large preview of the hovered glyph on its real vertical metrics (measured from the loaded font) and its code point.',
  basedOn: ['gt-america-com#20', 'editorialnew-com#03', 'floriankarsten-github-io-space-grotesk#10'],
  params: [
    { key: 'previewSide', label: 'Preview side', type: 'select', options: ['left', 'right'], default: 'left' },
    { key: 'shape', label: 'Preview shape', type: 'select', options: ['square', 'disc'], default: 'square' },
    { key: 'previewSize', label: 'Preview glyph size (px)', type: 'range', min: 160, max: 420, default: 300 },
    { key: 'metrics', label: 'Metric lines', type: 'toggle', default: true },
    { key: 'perRow', label: 'Cells per row', type: 'range', min: 6, max: 20, default: 13 },
    { key: 'cellSize', label: 'Grid glyph size (px)', type: 'range', min: 12, max: 40, default: 20 },
    { key: 'weight', label: 'Weight', type: 'range', min: 100, max: 1000, default: 400 },
    { key: 'widthAxis', label: 'Width (if available)', type: 'range', min: 25, max: 151, default: 100 },
    { key: 'bg', label: 'Background', type: 'color', default: '#fd3402' },
    { key: 'ink', label: 'Grid ink', type: 'color', default: '#ffffff' },
    { key: 'rule', label: 'Grid rules', type: 'color', default: '#ff8a6b' },
    { key: 'previewBg', label: 'Preview background', type: 'color', default: '#ffffff' },
    { key: 'previewInk', label: 'Preview ink', type: 'color', default: '#fd3402' },
    { key: 'metricColour', label: 'Metric lines', type: 'color', default: '#9aa0ff' },
    { key: 'activeBg', label: 'Active cell', type: 'color', default: '#ffffff' },
    { key: 'activeInk', label: 'Active glyph', type: 'color', default: '#fd3402' },
  ],
  styles: [
    { name: 'Square on colour (GT America)', font: 'roboto-flex', values: {} },
    { name: 'Disc (Editorial New)', font: 'fraunces', values: { shape: 'disc', previewSide: 'right', bg: '#0e0e0e', ink: '#f2f2f2', rule: '#333333', previewBg: '#1f1f1f', previewInk: '#ffffff', activeBg: '#f2f2f2', activeInk: '#0e0e0e', perRow: 10, weight: 300 } },
    { name: 'Dark metrics (Space Grotesk)', font: 'space-grotesk', values: { bg: '#111111', ink: '#e6e6e6', rule: '#3a3a3a', previewBg: '#1b1b1b', previewInk: '#ffffff', metricColour: '#ff6a2a', activeBg: '#ffffff', activeInk: '#ff6a2a', perRow: 10 } },
  ],
  Component: GlyphInspector,
};
