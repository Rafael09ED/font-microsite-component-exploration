import { useEffect, useRef, useState } from 'react';
import { fvs, type Font } from '../fonts';
import type { Rebuild, RebuildProps } from '../types';

// Warp starfield: stars stream from the centre with motion streaks (GT Planar's intro canvas).
function Starfield({ width, height, speed, density, colour }: { width: number; height: number; speed: number; density: number; colour: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    const stars = Array.from({ length: density }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
    let raf = 0;
    const draw = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = colour;
      for (const s of stars) {
        const pz = s.z;
        s.z -= 0.004 * speed;
        if (s.z <= 0.02) { s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; s.z = 1; continue; }
        const k = 0.5 * width;
        const [x0, y0] = [width / 2 + (s.x / pz) * k * 0.5, height / 2 + (s.y / pz) * k * 0.5];
        const [x1, y1] = [width / 2 + (s.x / s.z) * k * 0.5, height / 2 + (s.y / s.z) * k * 0.5];
        ctx.lineWidth = Math.max(0.5, 2.2 * (1 - s.z));
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [width, height, speed, density, colour]);
  return <canvas ref={ref} width={width} height={height} style={{ position: 'absolute', inset: 0 }} />;
}

// Each letter steps one axis from min to max across its word (GT Planar's −25…+25 slant per letter).
function steppedLetters(word: string, font: Font, axis: string) {
  const a = font.axes[axis];
  const chars = [...word];
  return chars.map((ch, i) => {
    const t = chars.length > 1 ? i / (chars.length - 1) : 0.5;
    const val = a ? a.min + t * (a.max - a.min) : 0;
    const skew = !a && axis === 'slnt' ? (t - 0.5) * 30 : 0; // fake slant with skew when the font has no slnt axis
    return <span key={i} style={{ display: 'inline-block', fontVariationSettings: a ? fvs(font, { [axis]: val }) : undefined, transform: skew ? `skewX(${-skew}deg)` : undefined }}>{ch}</span>;
  });
}

function KineticType({ v, font, width, height }: RebuildProps) {
  const lines = String(v.lines).split('\n').filter(Boolean);
  const mode = String(v.mode);
  const axis = String(v.axis);
  const [cycle, setCycle] = useState(0);
  // Restart the fly-in every time the lines change or on the "replay" interval.
  useEffect(() => { const t = setInterval(() => setCycle((c) => c + 1), Number(v.loop) * 1000); return () => clearInterval(t); }, [v.loop]);
  const a = font.axes[axis];
  const waveFrames = a ? `@keyframes kt-wave { 0%,100% { font-variation-settings: ${fvs(font, { [axis]: a.min })}; } 50% { font-variation-settings: ${fvs(font, { [axis]: a.max })}; } }` : '';
  return (
    <div style={{ width, height, background: String(v.bg), color: String(v.ink), position: 'relative', overflow: 'hidden', fontFamily: `'${font.family}'` }}>
      <style>{`@keyframes kt-fly { 0% { transform: translateZ(-2400px); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateZ(0); opacity: 1; } } ${waveFrames}`}</style>
      {mode === 'warp' && <Starfield width={width} height={height} speed={Number(v.speed)} density={Number(v.density)} colour={String(v.ink)} />}
      <div key={cycle} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', perspective: 900 }}>
        {lines.map((line, i) => (
          <div key={i} style={{
            fontSize: Number(v.size), lineHeight: 1, whiteSpace: 'nowrap', textTransform: v.caps ? 'uppercase' : 'none',
            fontVariationSettings: fvs(font, { wght: Number(v.weight) }),
            animation: mode === 'warp' ? `kt-fly ${1.6 / Number(v.speed) * 2}s ${i * 0.45}s cubic-bezier(.2,.7,.2,1) both` : undefined,
          }}>
            {mode === 'warp'
              ? line.split(' ').map((w, k) => <span key={k} style={{ marginRight: '0.3em' }}>{steppedLetters(w, font, axis)}</span>)
              : [...line].map((ch, k) => (
                <span key={k} style={{ display: 'inline-block', animation: a ? `kt-wave ${2.4 / Number(v.speed)}s ${-k * 0.12}s ease-in-out infinite` : undefined }}>{ch === ' ' ? ' ' : ch}</span>
              ))}
          </div>
        ))}
      </div>
      {v.hud && (
        <div style={{ position: 'absolute', inset: 20, border: `1px solid ${String(v.ink)}55`, pointerEvents: 'none', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>
          <span style={{ position: 'absolute', left: 10, top: 8 }}>{String(v.hudLeft)}</span>
          <span style={{ position: 'absolute', right: 0, top: 0, background: String(v.alert), color: '#000', padding: '8px 12px' }}>EXIT</span>
          <span style={{ position: 'absolute', left: 10, bottom: 8 }}>{axis.toUpperCase()} {a ? `${a.min}…${a.max}` : ''}</span>
        </div>
      )}
    </div>
  );
}

export const kineticType: Rebuild = {
  type: 'hero', variant: 'kinetic-type',
  title: 'Kinetic type',
  description: 'The type in motion is the hero. "Warp" flies the title planes out of a starfield with each letter stepped along an axis; "wave" ripples an axis across the letters.',
  basedOn: ['gt-planar-com#00', 'gt-cinetype-com#00', 'gt-zirkon-com#00', 'leon-kim-com#00'],
  params: [
    { key: 'lines', label: 'Lines', type: 'text', multiline: true, default: 'Type\nthe final\nfrontier' },
    { key: 'mode', label: 'Motion', type: 'select', options: ['warp', 'wave'], default: 'warp' },
    { key: 'axis', label: 'Axis stepped / waved', type: 'select', options: ['slnt', 'wght', 'wdth', 'opsz', 'CASL', 'BNCE', 'SOFT'], default: 'slnt' },
    { key: 'size', label: 'Size (px)', type: 'range', min: 40, max: 320, default: 146 },
    { key: 'weight', label: 'Base weight', type: 'range', min: 100, max: 1000, default: 500 },
    { key: 'speed', label: 'Speed', type: 'range', min: 0.3, max: 3, step: 0.1, default: 1 },
    { key: 'density', label: 'Stars', type: 'range', min: 50, max: 900, step: 10, default: 400 },
    { key: 'loop', label: 'Replay every (s)', type: 'range', min: 4, max: 30, default: 9 },
    { key: 'caps', label: 'Uppercase', type: 'toggle', default: true },
    { key: 'hud', label: 'HUD frame', type: 'toggle', default: true },
    { key: 'hudLeft', label: 'HUD label', type: 'text', default: 'GT PLANAR  ENG  PXS  VEC  SNR' },
    { key: 'bg', label: 'Background', type: 'color', default: '#000000' },
    { key: 'ink', label: 'Ink', type: 'color', default: '#ffffff' },
    { key: 'alert', label: 'Alert colour', type: 'color', default: '#fe003c' },
  ],
  styles: [
    { name: 'Hyperspace (Planar)', font: 'roboto-flex', values: { mode: 'warp', axis: 'slnt' } },
    { name: 'Weight wave', font: 'roboto-flex', values: { mode: 'wave', axis: 'wght', lines: 'Variable\nby nature', hud: false, bg: '#f2f0ea', ink: '#111111', size: 180 } },
    { name: 'Casual wave (Recursive)', font: 'recursive', values: { mode: 'wave', axis: 'CASL', lines: 'recursive', hud: false, bg: '#0b0b0b', ink: '#f5f5f5', size: 220, weight: 700, caps: false } },
    { name: 'Bounce (Shantell)', font: 'shantell', values: { mode: 'wave', axis: 'BNCE', lines: 'Shantell\nSans', hud: false, bg: '#fff4d6', ink: '#1a1a1a', size: 200, caps: false } },
  ],
  Component: KineticType,
};
