// F18 «Quién lo cuenta» (QUIEN): el mismo hecho contado por varios medios y su cobertura por región, con los
// «ángulos muertos» (regiones que no lo cuentan). Sin IA ni fuentes nuevas: junta los titulares de todas las
// secciones news-* (ya agrupados dentro de cada sección por scripts/cluster.ts) y los vuelve a agrupar entre
// secciones. Para cruzar idiomas compara también la traducción al español (titleEs) de los titulares en inglés.
// Lo calcula +page.server.ts al construir la web; a la página solo le llegan las historias.
import { jaccard, normalize } from '../../scripts/cluster.ts';
import type { NewsItem } from './types.ts';

export type Region = 'es' | 'eu' | 'uk' | 'us' | 'me' | 'asia' | 'africa' | 'org';

/** Regiones en el orden en que se enseñan. Organismos (ONU, OMC…) no cuentan para los ángulos muertos. */
export const REGIONS: { key: Region; label: string; short: string }[] = [
	{ key: 'es', label: 'España', short: 'ES' },
	{ key: 'eu', label: 'Europa', short: 'EU' },
	{ key: 'uk', label: 'Reino Unido', short: 'UK' },
	{ key: 'us', label: 'EE. UU.', short: 'US' },
	{ key: 'me', label: 'Oriente Medio', short: 'OM' },
	{ key: 'asia', label: 'Asia', short: 'AS' },
	{ key: 'africa', label: 'África', short: 'AF' },
	{ key: 'org', label: 'Organismos', short: 'ORG' }
];

/** Región de cada medio de scripts/sources/news.ts. Un medio que no está aquí no cuenta para las regiones. */
export const OUTLET_REGION: Record<string, Region> = {
	'El País': 'es', Expansión: 'es', 'El Confidencial': 'es', RTVE: 'es', 'elDiario.es': 'es', 'El Mundo': 'es', 'Europa Press': 'es',
	IB3: 'es', Xataka: 'es', 'La Moncloa': 'es', 'Banco de España': 'es',
	DW: 'eu', 'France 24': 'eu', BCE: 'eu', 'Comisión Europea': 'eu', 'Comisión Europea (digital)': 'eu', EDPB: 'eu', 'Kyiv Independent': 'eu',
	'Ukrainska Pravda': 'eu',
	BBC: 'uk', 'The Guardian': 'uk', 'Financial Times': 'uk', 'The Economist': 'uk', 'Exteriores británico': 'uk',
	CNBC: 'us', 'CNBC Markets': 'us', MarketWatch: 'us', WSJ: 'us', 'Investing.com': 'us', TechCrunch: 'us', 'The Verge': 'us', 'Ars Technica': 'us',
	Wired: 'us', 'MIT Technology Review': 'us', 'Casa Blanca': 'us', 'Reserva Federal': 'us', 'Foreign Affairs': 'us',
	'Al Jazeera': 'me',
	'South China Morning Post': 'asia', 'The Japan Times': 'asia', 'Nikkei Asia': 'asia',
	Africanews: 'africa', AllAfrica: 'africa',
	ONU: 'org', 'Noticias ONU': 'org', OMC: 'org', OIEA: 'org', 'Crisis Group': 'org'
};

/** Regiones con prensa general: un hecho que no sale en alguna de ellas tiene ahí un ángulo muerto. */
export const PRESS: Region[] = ['es', 'eu', 'uk', 'us', 'me', 'asia', 'africa'];

export interface Outlet {
	source: string;
	url: string;
	region?: Region;
}

export interface Story {
	title: string;
	url: string;
	time: string | null;
	outlets: Outlet[];
	/** Regiones que lo cuentan, en el orden de REGIONS. */
	regions: Region[];
	/** Regiones de PRESS que no lo cuentan. */
	missing: Region[];
}

const WINDOW = 24 * 3_600_000;
const THRESHOLD = 0.45;

interface Group {
	words: Set<string>[];
	urls: Set<string>;
	time: number | null;
	head: NewsItem;
	outlets: Map<string, Outlet>;
}

const cleanUrl = (u: string) => u.replace(/[?#].*$/, '').replace(/\/$/, '');
const common = (a: Set<string>, b: Set<string>) => [...a].filter((w) => b.has(w)).length;
const similar = (a: Set<string>, b: Set<string>) => common(a, b) >= 2 && jaccard(a, b) >= THRESHOLD;

/** Agrupa entre secciones los titulares que cuentan lo mismo y deja las historias de al menos `min` medios. */
export function stories(items: NewsItem[], { min = 2, limit = 25 }: { min?: number; limit?: number } = {}): Story[] {
	const sorted = [...items].sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));
	const groups: Group[] = [];
	for (const item of sorted) {
		const words = [normalize(item.title), ...(item.titleEs ? [normalize(item.titleEs)] : [])];
		const links = [{ source: item.source, url: item.url }, ...(item.also ?? [])];
		const time = item.time ? Date.parse(item.time) : null;
		const group = groups.find(
			(g) =>
				links.some((l) => g.urls.has(cleanUrl(l.url))) ||
				(time !== null && g.time !== null && Math.abs(g.time - time) <= WINDOW && g.words.some((gw) => words.some((w) => similar(gw, w))))
		);
		const target = group ?? { words: [], urls: new Set<string>(), time, head: item, outlets: new Map<string, Outlet>() };
		if (!group) groups.push(target);
		target.words.push(...words);
		for (const l of links) {
			target.urls.add(cleanUrl(l.url));
			if (!target.outlets.has(l.source)) target.outlets.set(l.source, { ...l, region: OUTLET_REGION[l.source] });
		}
	}
	return groups
		.filter((g) => g.outlets.size >= min)
		.map((g) => {
			const outlets = [...g.outlets.values()];
			const have = new Set(outlets.map((o) => o.region).filter(Boolean));
			// Titular en español si lo hay: el de un medio español, o la traducción.
			const es = outlets.find((o) => o.region === 'es');
			const esItem = es && sorted.find((i) => i.url === es.url);
			return {
				title: esItem?.title ?? g.head.titleEs ?? g.head.title,
				url: esItem?.url ?? g.head.url,
				time: g.head.time,
				outlets,
				regions: REGIONS.map((r) => r.key).filter((r) => have.has(r)),
				missing: PRESS.filter((r) => !have.has(r))
			};
		})
		.sort((a, b) => b.regions.length - a.regions.length || b.outlets.length - a.outlets.length || (b.time ?? '').localeCompare(a.time ?? ''))
		.slice(0, limit);
}

export const regionLabel = (r: Region) => REGIONS.find((x) => x.key === r)?.label ?? r;

/** Frase para el modo Sencillo sobre la historia más contada. */
export function coverageSentence(list: Story[]): string {
	const top = list[0];
	if (!top) return '';
	const blind = top.missing.map(regionLabel);
	return `La noticia más repetida la cuentan ${top.outlets.length} medios de ${top.regions.length} ${top.regions.length === 1 ? 'región' : 'regiones'}${blind.length ? `; no sale en ${blind.join(', ')}` : ''}.`;
}
