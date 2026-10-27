import { useEffect, useRef, useState } from 'react';
import { fvs } from '../fonts';
import type { Rebuild, RebuildProps } from '../types';

const PADDLE = { w: 400, h: 50 };

function MiniGame({ v, font, width, height }: RebuildProps) {
  const ball = useRef<HTMLDivElement>(null), top = useRef<HTMLAnchorElement>(null), bottom = useRef<HTMLAnchorElement>(null), name = useRef<HTMLHeadingElement>(null);
  const [axes, setAxes] = useState<Record<string, number>>({});
  const [italic, setItalic] = useState(false);
  const [hits, setHits] = useState(0);

  useEffect(() => {
    const size = Number(v.ball), margin = 69, speed = Number(v.speed);
    const s = { x: width / 2, y: height * 0.3, vx: 4.2 * speed, vy: 3.4 * speed, top: width / 2, bottom: width / 2, cooldown: 0 };
    let raf = 0;
    const randomise = () => {
      setAxes(Object.fromEntries(Object.entries(font.axes).filter(([t]) => t !== 'opsz').map(([t, a]) => [t, a.min + Math.random() * (a.max - a.min)])));
      if (font.italic && v.italic) setItalic(Math.random() > 0.5);
      setHits((h) => h + 1);
    };
    const step = () => {
      s.x += s.vx; s.y += s.vy;
      if (s.x < margin || s.x > width - margin - size) s.vx *= -1;
      // Paddles chase the ball with a little lag, so rallies feel played rather than scripted.
      s.top += (s.x - s.top) * 0.08; s.bottom += (s.x - s.bottom) * 0.08;
      const clampP = (p: number) => Math.min(width - margin - PADDLE.w / 2, Math.max(margin + PADDLE.w / 2, p));
      s.top = clampP(s.top); s.bottom = clampP(s.bottom);
      if (s.y < 40 + PADDLE.h && s.vy < 0) s.vy *= -1;
      if (s.y > height - 40 - PADDLE.h - size && s.vy > 0) s.vy *= -1;
      // Hitting the name changes its axes (with a cooldown so one pass counts once).
      const n = name.current!;
      const box = { l: n.offsetLeft, t: n.offsetTop, r: n.offsetLeft + n.offsetWidth, b: n.offsetTop + n.offsetHeight };
      if (s.cooldown > 0) s.cooldown--;
      else if (s.x + size > box.l && s.x < box.r && s.y + size > box.t && s.y < box.b) { s.vy *= -1; s.cooldown = 40; randomise(); }
      ball.current!.style.transform = `translate(${s.x}px, ${s.y}px)`;
      top.current!.style.transform = `translateX(${s.top - PADDLE.w / 2}px)`;
      bottom.current!.style.transform = `translateX(${s.bottom - PADDLE.w / 2}px)`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [width, height, font.id, v.speed, v.ball, v.italic]);

  const paddle = { position: 'absolute' as const, left: 0, width: PADDLE.w, height: PADDLE.h, border: `1.5px solid ${String(v.ink)}`, display: 'grid', placeItems: 'center',
    fontFamily: `'${font.family}'`, fontSize: 16, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: String(v.ink), background: String(v.bg), textDecoration: 'none' };
  return (
    <div style={{ width, height, background: String(v.bg), color: String(v.ink), position: 'relative', overflow: 'hidden' }}>
      <a ref={top} href="#" onClick={(e) => e.preventDefault()} style={{ ...paddle, top: 40 }}>↗ {String(v.topLabel)}</a>
      <h1 ref={name} style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%', margin: 0, whiteSpace: 'nowrap', fontWeight: 'normal',
        fontFamily: `'${font.family}'`, fontSize: Number(v.size), lineHeight: 1, fontStyle: italic ? 'italic' : 'normal',
        fontVariationSettings: fvs(font, axes), transition: 'font-variation-settings .45s cubic-bezier(.3,1.4,.5,1)' }}>{String(v.name)}</h1>
      <a ref={bottom} href="#" onClick={(e) => e.preventDefault()} style={{ ...paddle, bottom: 40 }}>↗ {String(v.bottomLabel)}</a>
      <div ref={ball} style={{ position: 'absolute', left: 0, top: 0, width: Number(v.ball), height: Number(v.ball), borderRadius: '50%', background: String(v.ballColour) }} />
      {v.score && <div style={{ position: 'absolute', right: 80, top: '50%', fontFamily: 'ui-monospace, monospace', fontSize: 12, opacity: 0.6 }}>hits {hits}</div>}
    </div>
  );
}

export const miniGame: Rebuild = {
  type: 'hero', variant: 'mini-game',
  title: 'Mini-game (Pong)',
  description: 'The hero is a playable game made from the page itself: the two CTAs are paddles, and every time the ball hits the name its axes jump to new values.',
  basedOn: ['gt-flexa-com#00', 'sanssheriff-wtf#01'],
  params: [
    { key: 'name', label: 'Name', type: 'text', default: 'GT Flexa' },
    { key: 'topLabel', label: 'Top paddle', type: 'text', default: 'Free trial fonts' },
    { key: 'bottomLabel', label: 'Bottom paddle', type: 'text', default: 'Buy licensing' },
    { key: 'size', label: 'Name size (px)', type: 'range', min: 60, max: 260, default: 158 },
    { key: 'speed', label: 'Ball speed', type: 'range', min: 0.4, max: 3, step: 0.1, default: 1.2 },
    { key: 'ball', label: 'Ball size (px)', type: 'range', min: 10, max: 60, default: 20 },
    { key: 'italic', label: 'Hits can switch to italic', type: 'toggle', default: true },
    { key: 'score', label: 'Show hit counter', type: 'toggle', default: false },
    { key: 'bg', label: 'Background', type: 'color', default: '#fefefe' },
    { key: 'ink', label: 'Ink', type: 'color', default: '#060606' },
    { key: 'ballColour', label: 'Ball', type: 'color', default: '#fee70d' },
  ],
  styles: [
    { name: 'Pong (Flexa)', font: 'anybody', values: {} },
    { name: 'Night court', font: 'roboto-flex', values: { name: 'Roboto Flex', bg: '#0c0c14', ink: '#e9e9ff', ballColour: '#ff3b6b', score: true } },
    { name: 'Bouncy (Shantell)', font: 'shantell', values: { name: 'Shantell', bg: '#fff1d0', ink: '#24170c', ballColour: '#2bb673', speed: 0.9 } },
  ],
  Component: MiniGame,
};
