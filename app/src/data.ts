// Types and loaders for the study data served under /files/ by vite.config.ts.

export type Variant = { definition: string; cues?: string };
export type Type = { definition: string; variants: Record<string, Variant> };
export type Section = { title: string; definition: string; types: string[] };
export type Taxonomy = { sections: Record<string, Section>; types: Record<string, Type> };

export type Ref = { id: string; slug: string; blocks: string[]; crop: string | null; exemplar: boolean; confidence: string; proposed: boolean; rawType?: string; rawVariant?: string };
export type Index = { generatedAt: string; sites: number; sections: Record<string, { title: string; types: Record<string, Record<string, Ref[]>> }> };

export type Reconstruction = { layout?: string; typography?: string; palette?: string[]; behaviour?: string; content?: string; assets?: string; html?: string };
export type Instance = {
  blocks: string[]; type: string; variant: string; newVariant?: boolean; variantDefinition?: string;
  confidence: string; exemplar?: boolean; rubric?: Record<string, unknown>;
  look?: string; feel?: string; ux?: string; learn?: string; reconstruction?: Reconstruction;
};
export type SiteDoc = { slug: string; summary?: string; instances: Instance[]; sequence?: string[] };
export type Site = { n: number; slug: string; url: string; host: string };

export const fileUrl = (rel: string) => `/files/${rel}`;

async function json<T>(rel: string): Promise<T> {
  const res = await fetch(fileUrl(rel));
  if (!res.ok) throw new Error(`${rel}: ${res.status}`);
  return res.json();
}

export const loadTaxonomy = () => json<Taxonomy>('methodology/taxonomy.json');
export const loadIndex = () => json<Index>('data/instances/index.json');
export const loadSites = () => json<Site[]>('data/sites.json');

const siteCache = new Map<string, Promise<SiteDoc>>();
export function loadSiteDoc(slug: string) {
  if (!siteCache.has(slug)) siteCache.set(slug, json<SiteDoc>(`data/instances/${slug}.json`));
  return siteCache.get(slug)!;
}

// The full instance behind an index ref: same type, variant and first block.
export async function loadInstance(ref: Ref, type: string, variant: string) {
  const doc = await loadSiteDoc(ref.slug);
  const inst = doc.instances.find((i) => i.type === (ref.rawType ?? type) && i.variant === (ref.rawVariant ?? variant) && i.blocks[0] === ref.blocks[0]);
  return { doc, inst };
}

// Exemplars first, then by confidence.
const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
export const sortRefs = (refs: Ref[]) => [...refs].sort((a, b) => Number(b.exemplar) - Number(a.exemplar) || (rank[a.confidence] ?? 3) - (rank[b.confidence] ?? 3));
