import { useEffect, useState } from 'react';
import { fileUrl, loadInstance, type Instance, type Ref, type Site, type SiteDoc, type Taxonomy } from './data';
import { href, type Route } from './App';

type Props = {
  taxonomy: Taxonomy; route: Required<Route>; refs: Ref[]; sites: Map<string, Site>;
  refsOf: (section: string, type: string, variant: string) => Ref[];
};

// One variant at a time: tabs swap between variants of the type, the filmstrip and ←/→ swap
// between example implementations, and the panel shows the notes and reconstruction spec.
export function VariantStage({ taxonomy, route, refs, refsOf, sites }: Props) {
  const { section, type, variant } = route;
  const i = Math.min(route.i, Math.max(0, refs.length - 1));
  const ref = refs[i];
  const go = (n: number) => { location.hash = href({ ...route, i: (n + refs.length) % refs.length }); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || !refs.length) return;
      if (e.key === 'ArrowRight') go(i + 1);
      if (e.key === 'ArrowLeft') go(i - 1);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const t = taxonomy.types[type];
  const v = t.variants[variant];
  return (
    <div className="stage-wrap">
      <header className="stage-head">
        <div className="crumbs"><a href={href({ section, type, i: 0 })}>{taxonomy.sections[section].title} › {type}</a></div>
        <div className="tabs">
          {Object.keys(t.variants).map((name) => {
            const n = refsOf(section, type, name).length;
            return <a key={name} className={`tab ${name === variant ? 'active' : ''} ${n ? '' : 'none'}`} href={href({ section, type, variant: name, i: 0 })}>{name}<span>{n}</span></a>;
          })}
        </div>
        <p className="definition"><strong>{variant}</strong>: {v?.definition ?? 'proposed variant (not yet in the taxonomy)'}{v?.cues && <em> Recognise by: {v.cues}.</em>}</p>
      </header>
      {ref ? (
        <>
          <Example key={ref.id} refItem={ref} type={type} variant={variant} site={sites.get(ref.slug)} position={`${i + 1} / ${refs.length}`} onPrev={() => go(i - 1)} onNext={() => go(i + 1)} />
          <div className="filmstrip">
            {refs.map((r, k) => (
              <a key={r.id} href={href({ ...route, i: k })} className={`thumb ${k === i ? 'active' : ''}`} title={r.slug}>
                {r.crop ? <img loading="lazy" src={fileUrl(r.crop)} alt="" /> : <span className="nocrop">{r.slug}</span>}
                {r.exemplar && <span className="star">★</span>}
              </a>
            ))}
          </div>
        </>
      ) : <div className="empty">No extracted instances of this variant yet.</div>}
    </div>
  );
}

function Example({ refItem, type, variant, site, position, onPrev, onNext }: { refItem: Ref; type: string; variant: string; site?: Site; position: string; onPrev: () => void; onNext: () => void }) {
  const [data, setData] = useState<{ doc: SiteDoc; inst?: Instance }>();
  useEffect(() => { loadInstance(refItem, type, variant).then(setData); }, [refItem, type, variant]);
  const inst = data?.inst;
  return (
    <div className="example">
      <div className="viewer">
        <div className="viewer-bar">
          <button onClick={onPrev} aria-label="Previous example">←</button>
          <span>{position}</span>
          <button onClick={onNext} aria-label="Next example">→</button>
          <a href={site?.url} target="_blank" rel="noreferrer">{site?.host ?? refItem.slug} ↗</a>
        </div>
        <div className="crops">
          {refItem.blocks.map((nn) => <img key={nn} src={fileUrl(`archive/${refItem.slug}/blocks/${nn}.jpg`)} alt={`${refItem.slug} block ${nn}`} onError={(e) => (e.currentTarget.style.display = 'none')} />)}
          {!refItem.crop && <p className="empty">This instance has no screenshot (fixed or off-screen element); see the notes and HTML.</p>}
        </div>
      </div>
      <aside className="notes">
        {!inst ? <p className="muted">Loading notes…</p> : (
          <>
            <div className="badges">
              {inst.exemplar && <span className="badge star">exemplar</span>}
              <span className="badge">{inst.confidence} confidence</span>
              {inst.newVariant && <span className="badge proposed">proposed variant</span>}
            </div>
            {data?.doc.summary && <p className="muted small">{data.doc.summary}</p>}
            <dl className="lfu">
              {(['look', 'feel', 'ux', 'learn'] as const).map((k) => inst[k] && <div key={k}><dt>{k}</dt><dd>{inst[k]}</dd></div>)}
            </dl>
            {inst.rubric && (
              <div className="chips">
                {Object.entries(inst.rubric).map(([k, val]) => <span key={k} className="chip"><b>{k}</b> {Array.isArray(val) ? val.join(', ') : String(val)}</span>)}
              </div>
            )}
            {inst.reconstruction && (
              <section className="recon">
                <h3>Reconstruction</h3>
                {inst.reconstruction.palette && (
                  <div className="swatches">{inst.reconstruction.palette.map((c) => <span key={c} style={{ background: c }} title={c}><code>{c}</code></span>)}</div>
                )}
                <dl>
                  {(['layout', 'typography', 'behaviour', 'content', 'assets', 'html'] as const).map((k) =>
                    inst.reconstruction?.[k] && <div key={k}><dt>{k}</dt><dd>{inst.reconstruction[k]}</dd></div>)}
                </dl>
              </section>
            )}
            {data?.doc.sequence && (
              <section className="sequence">
                <h3>Page sequence</h3>
                <ol>{data.doc.sequence.map((s, k) => <li key={k} className={s === `${type}/${variant}` ? 'here' : ''}>{s}</li>)}</ol>
              </section>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
