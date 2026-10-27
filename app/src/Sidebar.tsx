import { useState } from 'react';
import type { Index, Taxonomy } from './data';
import { href, type Route } from './App';

const count = (index: Index, section: string, type: string, variant?: string) => {
  const t = index.sections[section]?.types[type] ?? {};
  return variant ? (t[variant]?.length ?? 0) : Object.values(t).reduce((n, refs) => n + refs.length, 0);
};

// Sections (the original 8) → types (core first, discovered nested) → variants with counts.
export function Sidebar({ taxonomy, index, route }: { taxonomy: Taxonomy; index: Index; route: Route }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = (key: string, active: boolean) => open[key] ?? active;
  return (
    <nav className="sidebar">
      <a className="brand" href="#/">Microsite components<small>{index.sites} sites extracted</small></a>
      {Object.entries(taxonomy.sections).map(([s, sec]) => {
        const total = sec.types.reduce((n, t) => n + count(index, s, t), 0);
        return (
          <div key={s} className="section">
            <a className={`section-title ${route.section === s ? 'active' : ''}`} href={href({ section: s, type: sec.types[0], i: 0 })}>
              {sec.title}<span className="count">{total}</span>
            </a>
            {sec.types.map((t, ti) => {
              const key = `${s}/${t}`;
              const active = route.section === s && route.type === t;
              const n = count(index, s, t);
              return (
                <div key={t} className={`type ${ti > 0 ? 'discovered' : ''}`}>
                  <button className={`type-title ${active ? 'active' : ''}`} onClick={() => { setOpen({ ...open, [key]: !isOpen(key, active) }); location.hash = href({ section: s, type: t, i: 0 }); }}>
                    <span>{ti > 0 && <span className="tag">+</span>}{t}</span><span className="count">{n}</span>
                  </button>
                  {isOpen(key, active) && (
                    <ul>
                      {Object.keys(taxonomy.types[t].variants).map((v) => {
                        const c = count(index, s, t, v);
                        return (
                          <li key={v}>
                            <a className={`${route.variant === v && active ? 'active' : ''} ${c ? '' : 'none'}`} href={href({ section: s, type: t, variant: v, i: 0 })}>
                              {v}<span className="count">{c || ''}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
