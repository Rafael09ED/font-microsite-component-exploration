import { fileUrl, type Index, type Ref, type Taxonomy } from './data';
import { href } from './App';

type RefsOf = (section: string, type: string, variant: string) => Ref[];

const Card = ({ to, title, refs, text }: { to: string; title: string; refs: Ref[]; text: string }) => (
  <a className={`card ${refs.length ? '' : 'none'}`} href={to}>
    <div className="card-img">{refs[0]?.crop ? <img loading="lazy" src={fileUrl(refs[0].crop)} alt="" /> : <span>no example yet</span>}</div>
    <div className="card-body"><strong>{title}</strong><span className="count">{refs.length}</span><p>{text}</p></div>
  </a>
);

// All variants of one type as cards, using the best example of each as its thumbnail.
export function TypeOverview({ taxonomy, section, type, refsOf }: { taxonomy: Taxonomy; section: string; type: string; refsOf: RefsOf }) {
  const sec = taxonomy.sections[section];
  const t = taxonomy.types[type];
  return (
    <div className="overview">
      <header>
        <div className="crumbs">{sec.title}{sec.types[0] !== type && <span className="tag">discovered type</span>}</div>
        <h1>{type}</h1>
        <p className="definition">{t.definition}</p>
      </header>
      <div className="cards">
        {Object.entries(t.variants).map(([v, def]) => (
          <Card key={v} to={href({ section, type, variant: v, i: 0 })} title={v} refs={refsOf(section, type, v)} text={def.definition} />
        ))}
      </div>
    </div>
  );
}

// The 8 sections, each with its types as cards.
export function Home({ taxonomy, index, refsOf }: { taxonomy: Taxonomy; index: Index; refsOf: RefsOf }) {
  return (
    <div className="overview">
      <header>
        <h1>Font microsite components</h1>
        <p className="definition">{index.sites} of 181 sites extracted. Pick a section, then swap between variants and between example implementations (←/→).</p>
      </header>
      {Object.entries(taxonomy.sections).map(([s, sec]) => (
        <section key={s} className="home-section">
          <h2>{sec.title}</h2>
          <p className="definition">{sec.definition}</p>
          <div className="cards">
            {sec.types.map((t) => {
              const refs = Object.keys(taxonomy.types[t].variants).flatMap((v) => refsOf(s, t, v));
              return <Card key={t} to={href({ section: s, type: t, i: 0 })} title={t} refs={refs} text={taxonomy.types[t].definition} />;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
