// Open-licensed variable fonts used by the rebuilds, loaded from Google Fonts at runtime
// (no font files in the repo). Several are themselves in the studied corpus.
import { useEffect } from 'react';

export type Axis = { min: number; max: number; default: number };
export type Font = { id: string; family: string; query: string; axes: Record<string, Axis>; italic?: boolean; corpus?: string };

export const FONTS: Font[] = [
  { id: 'roboto-flex', family: 'Roboto Flex', query: 'Roboto+Flex:opsz,slnt,wdth,wght,GRAD@8..144,-10..0,25..151,100..1000,-200..150',
    axes: { wght: { min: 100, max: 1000, default: 400 }, wdth: { min: 25, max: 151, default: 100 }, opsz: { min: 8, max: 144, default: 14 }, slnt: { min: -10, max: 0, default: 0 }, GRAD: { min: -200, max: 150, default: 0 } } },
  { id: 'recursive', family: 'Recursive', query: 'Recursive:slnt,wght,CASL,CRSV,MONO@-15..0,300..1000,0..1,0..1,0..1', corpus: 'recursive-design',
    axes: { wght: { min: 300, max: 1000, default: 400 }, slnt: { min: -15, max: 0, default: 0 }, CASL: { min: 0, max: 1, default: 0 }, MONO: { min: 0, max: 1, default: 0 }, CRSV: { min: 0, max: 1, default: 0.5 } } },
  { id: 'fraunces', family: 'Fraunces', query: 'Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,100..900,0..100,0..1;1,9..144,100..900,0..100,0..1', italic: true, corpus: 'fraunces-undercase-xyz',
    axes: { wght: { min: 100, max: 900, default: 400 }, opsz: { min: 9, max: 144, default: 144 }, SOFT: { min: 0, max: 100, default: 0 }, WONK: { min: 0, max: 1, default: 0 } } },
  { id: 'anybody', family: 'Anybody', query: 'Anybody:ital,wdth,wght@0,50..150,100..900;1,50..150,100..900', italic: true,
    axes: { wght: { min: 100, max: 900, default: 400 }, wdth: { min: 50, max: 150, default: 100 } } },
  { id: 'shantell', family: 'Shantell Sans', query: 'Shantell+Sans:ital,wght,BNCE,INFM,SPAC@0,300..800,-100..100,0..100,0..100;1,300..800,-100..100,0..100,0..100', italic: true, corpus: 'shantellsans-com',
    axes: { wght: { min: 300, max: 800, default: 400 }, BNCE: { min: -100, max: 100, default: 0 }, INFM: { min: 0, max: 100, default: 0 }, SPAC: { min: 0, max: 100, default: 0 } } },
  { id: 'big-shoulders', family: 'Big Shoulders', query: 'Big+Shoulders:opsz,wght@10..72,100..900', corpus: 'bigshoulders-me',
    axes: { wght: { min: 100, max: 900, default: 700 }, opsz: { min: 10, max: 72, default: 72 } } },
  { id: 'bricolage', family: 'Bricolage Grotesque', query: 'Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800',
    axes: { wght: { min: 200, max: 800, default: 400 }, wdth: { min: 75, max: 100, default: 100 }, opsz: { min: 12, max: 96, default: 96 } } },
  { id: 'unbounded', family: 'Unbounded', query: 'Unbounded:wght@200..900', corpus: 'unbounded-polkadot-network',
    axes: { wght: { min: 200, max: 900, default: 400 } } },
  { id: 'space-grotesk', family: 'Space Grotesk', query: 'Space+Grotesk:wght@300..700', corpus: 'floriankarsten-github-io-space-grotesk',
    axes: { wght: { min: 300, max: 700, default: 400 } } },
  { id: 'inter', family: 'Inter', query: 'Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900', italic: true, corpus: 'rsms-me-inter',
    axes: { wght: { min: 100, max: 900, default: 400 }, opsz: { min: 14, max: 32, default: 32 } } },
  { id: 'instrument-serif', family: 'Instrument Serif', query: 'Instrument+Serif:ital@0;1', italic: true, axes: {} },
];

export const fontById = (id: string) => FONTS.find((f) => f.id === id) ?? FONTS[0];

// Inject each font's stylesheet once.
export function useFonts(ids: string[]) {
  useEffect(() => {
    for (const id of ids) {
      const f = fontById(id);
      const elId = `font-${f.id}`;
      if (document.getElementById(elId)) continue;
      const link = Object.assign(document.createElement('link'), { id: elId, rel: 'stylesheet', href: `https://fonts.googleapis.com/css2?family=${f.query}&display=swap` });
      document.head.append(link);
    }
  }, [ids.join(',')]);
}

// font-variation-settings for a set of axis values, clamped to what the font supports.
export function fvs(font: Font, values: Record<string, number>) {
  return Object.entries(values).filter(([tag]) => font.axes[tag])
    .map(([tag, v]) => `"${tag}" ${Math.min(font.axes[tag].max, Math.max(font.axes[tag].min, v))}`).join(', ') || 'normal';
}
