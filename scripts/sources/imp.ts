// IMP: lo más importante del día, sin IA. Fuente derivada (`after`): no descarga titulares, usa los de
// las secciones news-* de esta misma pasada (ya agrupados por scripts/cluster.ts), más el BOE, el Federal
// Register y, si responde, «In the news» de la Wikipedia en inglés.
//
// Puntuación de cada tema (determinista, ver scoreGroups):
//   2 × (medios distintos − 1)        cuantos más medios lo dan, más importante (hasta 10 medios)
// + 1,5 × (secciones distintas − 1)   sale en España y en Economía a la vez, p. ej.
// + horas vivo / 6, hasta 4           sigue en portada pasada tras pasada (máximo a las 24 h)
// + 3 si lo confirma una fuente oficial (Moncloa, BCE, Fed, Casa Blanca, BOE, Federal Register…)
// + 3 si sale en «In the news» de la Wikipedia en inglés
import { OFFICIAL } from './news.ts';
import type { BoeData, FedRegData, ImpCurrent, ImpLink, ImpData, ImpEntry, ImpSeen, NewsData, NewsItem } from '../../src/lib/types.ts';
import { NEWS_SECTIONS } from '../../src/lib/news.ts';
import { jaccard, normalize } from '../cluster.ts';
import { appendDaily, getJson, list, madridDay, NO_CONTEXT, plain, type Source } from '../lib.ts';

const HOUR = 3_600_000;
/** Titulares más antiguos que esto no cuentan: IMP habla de lo que pasa ahora. */
const MAX_AGE_HOURS = 48;
/** Lo que se recuerda de un tema que ya no sale. */
const FORGET_HOURS = 48;
const TOP = 10;
const KEEP_DAYS = 366;

/** Un tema: un grupo de titulares (de una o varias secciones) que cuentan lo mismo. */
export interface Group {
	title: string;
	/** 'en' si el titular principal está en inglés (para traducirlo, scripts/translate.ts). */
	lang?: 'en';
	url: string;
	time: string | null;
	words: Set<string>;
	sources: string[];
	sections: string[];
	/** Enlaces normalizados de todos sus titulares. */
	urls: string[];
	/** El enlace de cada medio (el primero que se vio), en el mismo orden que `sources`. */
	links: ImpLink[];
}

/** Un grupo ya reconocido entre pasadas: su clave estable y desde cuándo existe. */
export interface Tracked extends Group {
	k: string;
	first: string;
}

/** Un texto oficial con el que confirmar temas. */
export interface OfficialDoc {
	source: string;
	title: string;
}

/** Enlace comparable: sin protocolo, «www.», parámetros de seguimiento, ancla ni barra final. */
export function normUrl(url: string): string {
	try {
		const u = new URL(url);
		for (const key of [...u.searchParams.keys()]) {
			if (/^(utm_|fbclid|gclid|ref$|src$|cmpid|ito|at_)/i.test(key)) u.searchParams.delete(key);
		}
		const query = u.searchParams.toString();
		return `${u.hostname.replace(/^www\./, '').toLowerCase()}${u.pathname.replace(/\/+$/, '')}${query ? `?${query}` : ''}`;
	} catch {
		return url.trim().toLowerCase();
	}
}

/** Huella corta y estable de un texto (FNV-1a de 32 bits en base 36). */
export function hash(text: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(36);
}

function sameStory(a: Set<string>, b: Set<string>): boolean {
	let common = 0;
	for (const w of a) if (b.has(w)) common++;
	return common >= 2 && jaccard(a, b) >= 0.5;
}

/**
 * Junta los grupos de todas las secciones: el mismo tema puede salir agrupado en España y en Economía.
 * Se unen si comparten un enlace o si sus titulares se parecen como en scripts/cluster.ts.
 */
export function mergeSections(sections: Record<string, NewsItem[]>, now: number): Group[] {
	const all = Object.entries(sections)
		.flatMap(([section, items]) => items.map((item) => ({ section, item })))
		.filter(({ item }) => {
			const t = item.time ? Date.parse(item.time) : NaN;
			return Number.isFinite(t) && now - t <= MAX_AGE_HOURS * HOUR;
		})
		.sort((a, b) => (b.item.time ?? '').localeCompare(a.item.time ?? ''));
	const groups: Group[] = [];
	for (const { section, item } of all) {
		const words = normalize(item.title);
		const urls = [item.url, ...(item.also ?? []).map((a) => a.url)].map(normUrl);
		const sources = [item.source, ...(item.also ?? []).map((a) => a.source)];
		const links = [{ source: item.source, url: item.url }, ...(item.also ?? [])];
		const time = Date.parse(item.time!);
		const group = groups.find(
			(g) =>
				urls.some((u) => g.urls.includes(u)) ||
				(Math.abs(Date.parse(g.time!) - time) <= 12 * HOUR && sameStory(g.words, words))
		);
		if (!group) {
			const own = links.filter((l, i) => links.findIndex((m) => m.source === l.source) === i);
			groups.push({
				title: item.title,
				...(item.lang && { lang: item.lang }),
				url: item.url,
				time: item.time,
				words,
				sources: own.map((l) => l.source),
				sections: [section],
				urls: [...new Set(urls)],
				links: own
			});
			continue;
		}
		for (const l of links) {
			if (group.sources.includes(l.source)) continue;
			group.sources.push(l.source);
			group.links.push({ source: l.source, url: l.url });
		}
		for (const u of urls) if (!group.urls.includes(u)) group.urls.push(u);
		if (!group.sections.includes(section)) group.sections.push(section);
	}
	return groups;
}

/**
 * Reconoce cada grupo en lo que se vio en pasadas anteriores (`seen`): por un enlace en común o por un
 * titular parecido. Así hereda su clave y la hora en que apareció. Lo nuevo empieza ahora.
 */
export function track(groups: Group[], seen: ImpSeen[], now: number): { tracked: Tracked[]; seen: ImpSeen[] } {
	const nowIso = new Date(now).toISOString();
	const used = new Set<string>();
	const memory = seen.map((s) => ({ ...s, words: normalize(s.title) }));
	const tracked = groups.map((g) => {
		const match = memory.find(
			(s) => !used.has(s.k) && (g.urls.some((u) => s.urls.includes(u)) || sameStory(s.words, g.words))
		);
		if (match) {
			used.add(match.k);
			match.last = nowIso;
			match.title = g.title;
			match.urls = [...new Set([...g.urls, ...match.urls])].slice(0, 12);
			return { ...g, k: match.k, first: match.first };
		}
		const k = hash(`${normUrl(g.url)}|${nowIso}`);
		used.add(k);
		memory.push({ k, first: nowIso, last: nowIso, title: g.title, urls: g.urls.slice(0, 12), words: g.words });
		return { ...g, k, first: nowIso };
	});
	const keep = memory
		.filter((s) => now - Date.parse(s.last) <= FORGET_HOURS * HOUR)
		.map(({ words: _, ...s }) => s);
	return { tracked, seen: keep };
}

/** Palabras demasiado generales para confirmar nada: salen en casi todo lo oficial. */
const GENERIC = new Set(
	`gobierno ministro ministra ministerio presidente presidenta consejo real decreto orden resolucion ley
	nacional estado espana espanol europea europeo comision parlamento banco central federal reserva junta
	government minister ministry president house white federal reserve board bank central european commission
	parliament national state states united agency department office rule rules notice order executive`.split(/\s+/)
);

/** Palabras con las que se compara con lo oficial: de 4 letras o más, sin años ni términos generales. */
export function keywords(title: string): Set<string> {
	return new Set([...normalize(title)].filter((w) => w.length >= 4 && !/^\d+$/.test(w) && !GENERIC.has(w)));
}

/**
 * ¿Habla `doc` de lo mismo que el tema? Pide 3 palabras clave en común como mínimo y que sean al menos
 * el 40 % de las del tema, para no dar por confirmado algo por una coincidencia suelta («Ucrania»).
 */
export function confirms(topic: Set<string>, doc: Set<string>): boolean {
	if (!topic.size) return false;
	let common = 0;
	for (const w of topic) if (doc.has(w)) common++;
	return common >= 3 && common / topic.size >= 0.4;
}

export interface ScoreInput {
	now: number;
	/** Titulares y textos oficiales (Moncloa, BCE, BOE, Federal Register…). */
	official: OfficialDoc[];
	/** Noticias de «In the news» (Wikipedia en inglés), en texto plano. */
	itn: string[];
}

/** Puntúa los temas con la fórmula de arriba y los ordena de más a menos importante. */
export function scoreGroups(groups: Tracked[], { now, official, itn }: ScoreInput): ImpCurrent[] {
	const docs = official.map((d) => ({ ...d, words: keywords(d.title) }));
	const news = itn.map(keywords);
	return groups
		.map((g) => {
			const press = g.sources.filter((s) => !OFFICIAL.has(s));
			const words = keywords(g.title);
			// Lo oficial solo suma si además lo cuenta la prensa: un comunicado solo no es «lo importante».
			const ownOfficial = g.sources.find((s) => OFFICIAL.has(s));
			const official = press.length
				? (ownOfficial ?? docs.find((d) => !g.sources.includes(d.source) && confirms(words, d.words))?.source)
				: undefined;
			const wiki = news.some((n) => confirms(words, n));
			const hours = Math.max(0, (now - Date.parse(g.first)) / HOUR);
			const score =
				2 * (Math.min(g.sources.length, 10) - 1) +
				1.5 * (g.sections.length - 1) +
				Math.min(hours / 6, 4) +
				(official ? 3 : 0) +
				(wiki ? 3 : 0);
			const item: ImpCurrent = {
				k: g.k,
				title: g.title,
				url: g.url,
				sources: g.sources,
				score: Math.round(score * 10) / 10,
				sections: g.sections,
				first: g.first,
				time: g.time,
				links: g.links
			};
			if (g.lang) item.lang = g.lang;
			if (official) item.official = official;
			if (wiki) item.wiki = true;
			return item;
		})
		.sort((a, b) => b.score - a.score || b.sources.length - a.sources.length || (b.time ?? '').localeCompare(a.time ?? ''));
}

/**
 * Junta el top de ahora con el que ya llevaba el día: cada tema se queda con lo máximo que alcanzó, así un
 * tema que fue importante por la mañana no desaparece del día porque por la noche ya no salga.
 */
export function mergeDay(day: ImpEntry[], now: ImpEntry[], n = TOP): ImpEntry[] {
	const best = new Map<string, ImpEntry>();
	for (const e of [...day, ...now]) {
		const prev = best.get(e.k);
		// La traducción (scripts/translate.ts) llega después de IMP: se conserva la del día si el titular no cambia.
		const kept = prev?.title === e.title && !e.titleEs ? { lang: prev.lang, titleEs: prev.titleEs } : {};
		if (!prev || e.score > prev.score) best.set(e.k, { ...e, ...kept, ...joined(prev, e) });
		else Object.assign(prev, joined(prev, e));
	}
	return [...best.values()].sort((a, b) => b.score - a.score).slice(0, n);
}

/** Medios y enlaces de dos apariciones del mismo tema, sin repetir medio. */
function joined(a: ImpEntry | undefined, b: ImpEntry): Pick<ImpEntry, 'sources' | 'links'> {
	const sources = [...new Set([...(a?.sources ?? []), ...b.sources])];
	if (!a?.links && !b.links) return { sources };
	const links = [...(a?.links ?? []), ...(b.links ?? [])].filter((l, i, all) => all.findIndex((m) => m.source === l.source) === i);
	return { sources, links };
}

/** Lo que se guarda de cada tema en el histórico. Los enlaces, solo el día de hoy (ver `fetch`). */
const entry = ({ k, title, lang, titleEs, url, sources, score, links }: ImpEntry): ImpEntry => ({
	k,
	title,
	...(lang && { lang }),
	...(titleEs && { titleEs }),
	url,
	sources,
	score,
	...(links && { links })
});

/** Textos oficiales de esta pasada: medios oficiales de las secciones, BOE y Federal Register. */
export function officialDocs(
	sections: Record<string, NewsItem[]>,
	boe: BoeData | undefined,
	fedreg: FedRegData | undefined
): OfficialDoc[] {
	const press = Object.values(sections)
		.flat()
		.filter((i) => OFFICIAL.has(i.source))
		.map((i) => ({ source: i.source, title: i.title }));
	const boeDocs = (boe?.sections ?? []).flatMap((s) => s.items.map((i) => ({ source: 'BOE', title: i.title })));
	const fed = [...(fedreg?.presidential ?? []), ...(fedreg?.rules ?? [])].map((d) => ({ source: 'Federal Register', title: d.title }));
	return [...press, ...boeDocs, ...fed];
}

/** «In the news» de la Wikipedia en inglés. Si no responde, IMP sigue sin ese extra. */
async function inTheNews(day: string): Promise<string[]> {
	try {
		const body = await getJson<{ news?: { story?: string }[] }>(
			`https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${day.replaceAll('-', '/')}`
		);
		return list(body.news)
			.map((n) => plain(n.story, 600))
			.filter(Boolean);
	} catch (error) {
		console.log(`  imp · In the news: ${error instanceof Error ? error.message : error}`);
		return [];
	}
}

export const imp: Source<ImpData> = {
	name: 'imp',
	label: 'Lo más importante · puntuación propia sobre todos los titulares, BOE, Federal Register y Wikipedia',
	maxAgeMinutes: 12,
	after: true,
	async fetch(previous, ctx = NO_CONTEXT) {
		const now = Date.now();
		const date = madridDay();
		const sections = Object.fromEntries(
			NEWS_SECTIONS.map((s) => [s.key, ctx.get<NewsData>(`news-${s.key}`)?.items ?? []])
		);
		const groups = mergeSections(sections, now);
		if (!groups.length) throw new Error('sin titulares recientes con los que puntuar');
		const { tracked, seen } = track(groups, previous?.seen ?? [], now);
		const official = officialDocs(sections, ctx.get<BoeData>('boe'), ctx.get<FedRegData>('fedreg'));
		const scored = scoreGroups(tracked, { now, official, itn: await inTheNews(date) });
		const current = scored.slice(0, TOP);
		const today = previous?.days.find((d) => d.date === date)?.items ?? [];
		// Los enlaces de cada medio solo se guardan hoy: en un año de histórico pesarían demasiado.
		const days = appendDaily(previous?.days, { date, items: mergeDay(today, current.map(entry)) }, KEEP_DAYS).map(
			(d) => (d.date === date ? d : { ...d, items: d.items.map(({ links: _, ...e }) => e) })
		);
		return { date, current, days, seen };
	}
};
