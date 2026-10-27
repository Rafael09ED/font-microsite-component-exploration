import { fvs } from '../fonts';
import type { Rebuild, RebuildProps } from '../types';

const roman = (n: number) => [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  .reduce((s, [v, r]) => { while (n >= (v as number)) { s += r; n -= v as number; } return s; }, '');

function TypesetPage({ v, font, width, height }: RebuildProps) {
  const ink = String(v.ink), accent = String(v.accent);
  const f = (axes: Record<string, number>) => ({ fontFamily: `'${font.family}'`, fontVariationSettings: fvs(font, axes) });
  const acts = String(v.acts).split('\n').filter(Boolean);
  const year = roman(new Date().getFullYear());

  if (String(v.layout) === 'dictionary') {
    const senses = String(v.senses).split('\n').filter(Boolean);
    return (
      <div style={{ width, height, background: String(v.bg), display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        <div style={{ width: Math.min(1100, width - 120), background: String(v.paper), color: ink, padding: 70, boxShadow: '0 30px 60px rgb(0 0 0 / 15%)' }}>
          <div style={{ ...f({ wght: 900, opsz: 144 }), fontSize: 92, lineHeight: 1, textAlign: 'center' }}>{String(v.masthead)}</div>
          <div style={{ ...f({ wght: 400, opsz: 12 }), display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${ink}`, borderBottom: `1px solid ${ink}`, padding: '8px 0', margin: '16px 0 36px', fontSize: 14 }}>
            <span style={{ fontStyle: 'italic' }}>{String(v.kicker)}</span><span>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          <div style={{ fontSize: 36, marginBottom: 14 }}><span style={f({ wght: 700, opsz: 72 })}>{String(v.headword)}</span> <span style={{ ...f({ wght: 400, opsz: 72 }), fontStyle: 'italic' }}>noun</span></div>
          <ol style={{ ...f({ wght: 300, opsz: 48 }), fontSize: 34, lineHeight: 1.2, margin: 0, paddingLeft: 44 }}>
            {senses.map((s, i) => <li key={i} style={{ marginBottom: 10, ...(i === senses.length - 1 ? f({ wght: 700, opsz: 48 }) : {}) }}>{s}</li>)}
          </ol>
          <div style={{ ...f({ wght: 400, opsz: 24 }), borderTop: `1px solid ${ink}`, marginTop: 24, paddingTop: 16, fontSize: 22 }}>
            <span style={{ fontStyle: 'italic', color: accent }}>origin</span> {String(v.origin)}
          </div>
        </div>
      </div>
    );
  }

  // Playbill: centred stack of kicker, note, name, three acts, tagline and paragraph (GT Pantheon).
  return (
    <div style={{ width, height, background: String(v.bg), color: ink, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 60px' }}>
      <div style={{ ...f({ wght: 500, opsz: 12 }), fontSize: 16, letterSpacing: '0.18em', textTransform: 'uppercase' }}>·{year}· {String(v.kicker)} ·</div>
      <div style={{ ...f({ wght: 400, opsz: 12 }), fontStyle: 'italic', fontSize: 15, marginTop: 10, opacity: 0.8 }}>{String(v.note)}</div>
      <div style={{ ...f({ wght: Number(v.weight), opsz: 144, SOFT: Number(v.soft) }), fontSize: Number(v.size), lineHeight: 0.95, color: accent, margin: '18px 0 26px' }}>{String(v.name)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${acts.length}, 1fr)`, gap: 40, width: '100%', maxWidth: 1100 }}>
        {acts.map((act, i) => (
          <div key={i} style={{ ...f({ wght: 400, opsz: 36 }), fontStyle: 'italic', fontSize: 22 }}><span style={{ fontStyle: 'normal', letterSpacing: '.1em' }}>·{roman(i + 1)}·</span> {act}</div>
        ))}
      </div>
      <div style={{ fontSize: 76, lineHeight: 1, marginTop: 34 }}>
        {String(v.tagline).split(/(\*[^*]+\*)/).map((part, i) => part.startsWith('*')
          ? <span key={i} style={{ ...f({ wght: 300, opsz: 144 }), textTransform: 'uppercase', letterSpacing: '0.04em' }}>{part.slice(1, -1)}</span>
          : <span key={i} style={{ ...f({ wght: 300, opsz: 144 }), fontStyle: 'italic' }}>{part}</span>)}
      </div>
    </div>
  );
}

export const typesetPage: Rebuild = {
  type: 'hero', variant: 'typeset-page',
  title: 'Typeset page',
  description: 'A classical composition built from the family’s own hierarchy: a playbill in three acts, or a dictionary entry on a newspaper page.',
  basedOn: ['gt-pantheon-com#00', 'prospectus-losttype-com#00', 'gt-canon-com#00'],
  params: [
    { key: 'layout', label: 'Composition', type: 'select', options: ['playbill', 'dictionary'], default: 'playbill' },
    { key: 'kicker', label: 'Kicker', type: 'text', default: 'Grilli Type presents' },
    { key: 'note', label: 'Note', type: 'text', default: 'A Typeface Story in Three Acts' },
    { key: 'name', label: 'Name', type: 'text', default: 'GT Pantheon' },
    { key: 'size', label: 'Name size (px)', type: 'range', min: 80, max: 320, default: 210 },
    { key: 'weight', label: 'Name weight', type: 'range', min: 100, max: 900, default: 300 },
    { key: 'soft', label: 'Softness (Fraunces SOFT)', type: 'range', min: 0, max: 100, default: 0 },
    { key: 'acts', label: 'Acts (one per line)', type: 'text', multiline: true, default: 'Flow and Chisel\nMicro to Display\nThe Epilogue' },
    { key: 'tagline', label: 'Tagline (*caps*)', type: 'text', default: 'A Saga of Modern *Antiquity*' },
    { key: 'masthead', label: 'Masthead', type: 'text', default: 'The Daily Prospectus' },
    { key: 'headword', label: 'Headword', type: 'text', default: 'pro·spec·tus' },
    { key: 'senses', label: 'Senses (one per line)', type: 'text', multiline: true, default: 'A printed document advertising a school or business.\nA new and bold contemporary serif typeface, with optical sizes.' },
    { key: 'origin', label: 'Origin', type: 'text', default: 'Mid-18th century: from Latin, literally ‘view, prospect’, from prospicere.' },
    { key: 'bg', label: 'Background', type: 'color', default: '#040404' },
    { key: 'paper', label: 'Paper (dictionary)', type: 'color', default: '#fac495' },
    { key: 'ink', label: 'Ink', type: 'color', default: '#dcdcdc' },
    { key: 'accent', label: 'Accent', type: 'color', default: '#dcdcdc' },
  ],
  styles: [
    { name: 'Playbill (Pantheon)', font: 'fraunces', values: {} },
    { name: 'Warm playbill', font: 'fraunces', values: { bg: '#f3ead8', ink: '#2b1d14', accent: '#b5341b', soft: 100, weight: 500, kicker: 'A foundry presents', name: 'Fraunces' } },
    { name: 'Dictionary entry (Prospectus)', font: 'fraunces', values: { layout: 'dictionary', bg: '#aaabab', ink: '#1b1b1b', accent: '#ef4d26', kicker: 'A Lost Type Co-op Publication · Drawing new shapes since 2011' } },
    { name: 'Dictionary, sans (Inter)', font: 'inter', values: { layout: 'dictionary', bg: '#1d1d1f', paper: '#ffffff', ink: '#111111', accent: '#3b46e8', masthead: 'The Inter Gazette', headword: 'in·ter', kicker: 'A screen-first typeface' } },
  ],
  Component: TypesetPage,
};
