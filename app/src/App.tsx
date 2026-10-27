import { useEffect, useMemo, useState } from 'react';
import { loadIndex, loadSites, loadTaxonomy, sortRefs, type Index, type Ref, type Site, type Taxonomy } from './data';
import { Sidebar } from './Sidebar';
import { VariantStage } from './VariantStage';
import { TypeOverview, Home } from './Overviews';

// Route: #/<section>/<type>/<variant>/<example index | 'rebuild'>, so every view is linkable.
export type Route = { section?: string; type?: string; variant?: string; i: number; rebuild?: boolean };
const parse = (): Route => {
  const [section, type, variant, i] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  return { section: section || undefined, type: type || undefined, variant: variant || undefined, i: Number(i) || 0, rebuild: i === 'rebuild' };
};
export const href = (r: Route) => '#/' + [r.section, r.type, r.variant, r.variant ? (r.rebuild ? 'rebuild' : String(r.i)) : undefined].filter((x) => x !== undefined).map((x) => encodeURIComponent(x!)).join('/');

export function App() {
  const [taxonomy, setTaxonomy] = useState<Taxonomy>();
  const [index, setIndex] = useState<Index>();
  const [sites, setSites] = useState<Map<string, Site>>(new Map());
  const [route, setRoute] = useState<Route>(parse);
  const [error, setError] = useState<string>();

  useEffect(() => {
    Promise.all([loadTaxonomy(), loadIndex(), loadSites()])
      .then(([t, i, s]) => { setTaxonomy(t); setIndex(i); setSites(new Map(s.map((x) => [x.slug, x]))); })
      .catch((e) => setError(String(e)));
    const onHash = () => setRoute(parse());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  const refsOf = useMemo(() => (section: string, type: string, variant: string): Ref[] =>
    sortRefs(index?.sections[section]?.types[type]?.[variant] ?? []), [index]);

  if (error) return <div className="empty">Could not load data: {error}. Run <code>node scripts/extract.mjs sync</code> first.</div>;
  if (!taxonomy || !index) return <div className="empty">Loading…</div>;

  const { section, type, variant } = route;
  return (
    <div className="app">
      <Sidebar taxonomy={taxonomy} index={index} route={route} />
      <main>
        {section && type && variant ? (
          <VariantStage key={`${type}/${variant}`} taxonomy={taxonomy} route={route as Required<Route>} refs={refsOf(section, type, variant)}
            refsOf={refsOf} sites={sites} />
        ) : section && type ? (
          <TypeOverview taxonomy={taxonomy} section={section} type={type} refsOf={refsOf} />
        ) : (
          <Home taxonomy={taxonomy} index={index} refsOf={refsOf} />
        )}
      </main>
    </div>
  );
}
