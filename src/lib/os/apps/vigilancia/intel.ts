// Vigilancia (Arc OS): el estado de cada objetivo a partir de los datos de la terminal (IMP, titulares,
// terremotos y cotizaciones), su nivel y lo que ha cambiado desde tu última visita. Lógica pura.
import { findCountries } from '../../../countries.ts';
import type { ImpData, NewsData, Quake, Quote } from '../../../types.ts';
import { countryOf, keyOf, matcher, type Target } from './targets.ts';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Un titular ya listo para la tarjeta. `h` es su huella (para saber si es nuevo). */
export interface Headline {
	h: string;
	title: string;
	url: string;
	source: string;
	/** ISO 8601, o null si el feed no trae fecha. */
	time: string | null;
	/** Medios que lo dan (los de IMP); 1 en los titulares sueltos. */
	media: number;
	/** Viene de IMP (lo más importante). */
	imp: boolean;
	/** El texto en que se busca: el titular traducido y el original. */
	text: string;
}

/** Un suceso de GEO en el país del objetivo (de momento, terremotos). */
export interface GeoEvent {
	title: string;
	time: string;
	url: string;
	mag: number;
}

/** Lo que se lee de /data: lo justo para todos los objetivos. */
export interface Feeds {
	imp: ImpData | null;
	news: NewsData[];
	quakes: Quake[];
	quotes: Quote[];
}

export const LEVELS = ['Calma', 'Normal', 'Atención', 'Alto', 'Crítico'] as const;
export type Level = 0 | 1 | 2 | 3 | 4;

/** Umbrales del nivel. */
export const LEVEL_RULES = {
	/** Menciones en 24 h para contar como «subida»: con menos, el ritmo no dice nada. */
	surgeMin: 3,
	surgeRatio: 1.5,
	spikeMin: 5,
	spikeRatio: 3,
	/** Un tema de IMP con estos medios o más suma un punto. */
	impMedia: 5,
	/** Terremotos: magnitud que cuenta y la que cuenta doble. */
	quake: 5.5,
	quakeBig: 6.5,
	/** Variación del valor en el día (en %, en valor absoluto). */
	move: 3,
	moveBig: 6
};

export interface LevelInput {
	/** Menciones en las últimas 24 h. */
	count24: number;
	/** Media diaria de menciones en los días anteriores (hasta 7). */
	baseline: number;
	/** Medios del tema de IMP más grande que lo nombra (0 si ninguno). */
	impMedia: number;
	/** Magnitud del mayor terremoto de las últimas 24 h en su país (0 si ninguno). */
	quakeMag: number;
	/** Variación del día, si es un valor con cotización. */
	changePct: number | null;
}

/** El nivel (0 Calma … 4 Crítico) y por qué, en frases cortas. */
export function levelOf(i: LevelInput): { level: Level; why: string[] } {
	const R = LEVEL_RULES;
	const why: string[] = [];
	let n = 0;
	const ratio = (i.count24 + 1) / (i.baseline + 1);
	if (i.count24 >= R.spikeMin && ratio >= R.spikeRatio) {
		n += 3;
		why.push(`menciones ×${fmt(ratio)} sobre su media`);
	} else if (i.count24 >= R.surgeMin && ratio >= R.surgeRatio) {
		n += 2;
		why.push(`menciones ×${fmt(ratio)} sobre su media`);
	} else if (i.count24 > 0) {
		n += 1;
	}
	if (i.impMedia >= R.impMedia) {
		n += 1;
		why.push(`en IMP con ${i.impMedia} medios`);
	}
	if (i.quakeMag >= R.quakeBig) {
		n += 2;
		why.push(`terremoto de ${fmt(i.quakeMag)}`);
	} else if (i.quakeMag >= R.quake) {
		n += 1;
		why.push(`terremoto de ${fmt(i.quakeMag)}`);
	}
	const move = Math.abs(i.changePct ?? 0);
	if (move >= R.moveBig) {
		n += 2;
		why.push(`se mueve un ${fmt(move)} %`);
	} else if (move >= R.move) {
		n += 1;
		why.push(`se mueve un ${fmt(move)} %`);
	}
	return { level: Math.min(4, n) as Level, why };
}

const fmt = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });

/** Huella corta de un titular (FNV-1a de 32 bits en base 36), sin mirar mayúsculas, tildes ni signos. */
export function hashOf(text: string): string {
	const s = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(36);
}

/** Todos los titulares de las fuentes, sin repetir: primero los de IMP (con sus medios), luego los sueltos. */
export function allHeadlines(f: Feeds): Headline[] {
	const out = new Map<string, Headline>();
	for (const i of f.imp?.current ?? []) {
		const title = i.titleEs ?? i.title;
		const h = hashOf(i.title);
		out.set(h, { h, title, url: i.url, source: i.sources[0] ?? 'IMP', time: i.time ?? i.first, media: i.sources.length, imp: true, text: `${title} ${i.title}` });
	}
	for (const d of f.news)
		for (const n of d.items) {
			const h = hashOf(n.title);
			if (!out.has(h)) out.set(h, { h, title: n.titleEs ?? n.title, url: n.url, source: n.source, time: n.time, media: 1 + (n.also?.length ?? 0), imp: false, text: `${n.titleEs ?? ''} ${n.title}` });
		}
	return [...out.values()];
}

/** El estado de un objetivo ahora. */
export interface Assessment {
	key: string;
	level: Level;
	why: string[];
	count24: number;
	baseline: number;
	/** Titulares que lo nombran, de las últimas 24 h (o sin fecha) primero y por hora. */
	headlines: Headline[];
	geo: GeoEvent[];
	quote: Quote | null;
}

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

/**
 * El estado de un objetivo: menciones en 24 h frente a su media de los días anteriores (titulares con fecha
 * de hasta 7 días y los top 10 de IMP de cada día), el mayor tema de IMP, terremotos en su país y la variación
 * del valor. `heads` son los titulares de allHeadlines (se calculan una vez para todos).
 */
export function assess(t: Target, f: Feeds, heads: Headline[], now: number): Assessment {
	const is = matcher(t);
	const hits = heads.filter((h) => is(h.text));
	const recent = hits.filter((h) => {
		const at = ms(h.time);
		return h.imp || !Number.isFinite(at) || at >= now - DAY;
	});
	const older = hits.filter((h) => {
		const at = ms(h.time);
		return !h.imp && Number.isFinite(at) && at < now - DAY && at >= now - 7 * DAY;
	});
	// Los días anteriores de IMP (el top 10 de cada día), sin hoy: cuántas veces salió.
	const today = f.imp?.date;
	const pastDays = (f.imp?.days ?? []).filter((d) => d.date !== today).slice(-7);
	const pastImp = pastDays.reduce((n, d) => n + d.items.filter((i) => is(i.title) || (!!i.titleEs && is(i.titleEs))).length, 0);
	// Media diaria: los titulares sueltos de 1 a 7 días atrás (6 días) y las veces que salió en el top de IMP.
	const baseline = older.length / 6 + pastImp / Math.max(1, pastDays.length);
	const impMedia = Math.max(0, ...recent.filter((h) => h.imp).map((h) => h.media));

	const code = countryOf(t);
	const geo: GeoEvent[] = code
		? f.quakes
				.filter((q) => ms(q.time) >= now - DAY && q.mag >= 4.5 && findCountries(q.place).some((c) => c.code === code))
				.sort((a, b) => b.mag - a.mag)
				.slice(0, 3)
				.map((q) => ({ title: `Terremoto M${q.mag.toFixed(1)} · ${q.place}`, time: q.time, url: q.url, mag: q.mag }))
		: [];
	const quote = t.kind === 'ticker' ? (f.quotes.find((q) => q.symbol === t.id && Number.isFinite(q.price)) ?? null) : null;

	const { level, why } = levelOf({
		count24: recent.length,
		baseline,
		impMedia,
		quakeMag: geo[0]?.mag ?? 0,
		changePct: quote?.changePct ?? null
	});
	const order = (h: Headline) => (Number.isFinite(ms(h.time)) ? ms(h.time) : 0);
	return {
		key: keyOf(t),
		level,
		why,
		count24: recent.length,
		baseline,
		headlines: recent.sort((a, b) => Number(b.imp) - Number(a.imp) || b.media - a.media || order(b) - order(a)).slice(0, 8),
		geo,
		quote
	};
}

// ---------- Lo que se guarda y lo nuevo desde tu última visita ----------

/** Lo que se recuerda de cada objetivo: lo visto (huellas), el nivel y la cotización de entonces. */
export interface Snap {
	h: string[];
	l: Level;
	p?: number;
}

/** Lo que se guarda en la clave arc-os-watch: tus objetivos, la hora de la última visita y lo visto. */
export interface WatchState {
	targets: Target[];
	/** ISO 8601 de la última visita, o null la primera vez. */
	at: string | null;
	seen: Record<string, Snap>;
}

/** Huellas recordadas por objetivo: lo justo para las tarjetas (8) con margen. */
export const SEEN_MAX = 24;

/** Lo visto ahora, para guardarlo como referencia de la próxima visita. */
export function snapshot(list: Assessment[]): Record<string, Snap> {
	const out: Record<string, Snap> = {};
	for (const a of list) {
		const s: Snap = { h: a.headlines.map((h) => h.h).slice(0, SEEN_MAX), l: a.level };
		if (a.quote) s.p = a.quote.price;
		out[a.key] = s;
	}
	return out;
}

/** Lo que ha cambiado en un objetivo desde la referencia. Sin referencia (objetivo nuevo), nada es «nuevo». */
export interface Changes {
	/** Huellas de los titulares nuevos. */
	fresh: Set<string>;
	/** Nivel de la última visita, si ha cambiado. */
	levelWas: Level | null;
	/** Variación del precio desde la última visita, en %. */
	pricePct: number | null;
	/** ¿Había referencia? */
	known: boolean;
}

export function changes(a: Assessment, ref: Snap | undefined): Changes {
	if (!ref) return { fresh: new Set(), levelWas: null, pricePct: null, known: false };
	const seen = new Set(ref.h);
	const price = a.quote?.price;
	return {
		fresh: new Set(a.headlines.filter((h) => !seen.has(h.h)).map((h) => h.h)),
		levelWas: ref.l !== a.level ? ref.l : null,
		pricePct: price && ref.p ? ((price - ref.p) / ref.p) * 100 : null,
		known: true
	};
}

/** Mezcla lo visto ahora con lo de antes: las huellas nuevas primero, sin perder las vistas (con tope). */
export function mergeSeen(prev: Record<string, Snap>, now: Record<string, Snap>, keep: string[]): Record<string, Snap> {
	const out: Record<string, Snap> = {};
	for (const k of keep) {
		const a = now[k];
		const b = prev[k];
		if (!a && !b) continue;
		out[k] = a ? { ...a, h: [...new Set([...a.h, ...(b?.h ?? [])])].slice(0, SEEN_MAX) } : (b as Snap);
	}
	return out;
}

const isLevel = (v: unknown): v is Level => v === 0 || v === 1 || v === 2 || v === 3 || v === 4;

/** El estado guardado, comprobado; lo que no valga se descarta. `clean` limpia la lista de objetivos. */
export function parseState(raw: unknown, clean: (r: unknown) => Target[]): WatchState {
	const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
	const targets = clean(o.targets);
	const keys = new Set(targets.map(keyOf));
	const seen: Record<string, Snap> = {};
	const s = o.seen && typeof o.seen === 'object' ? (o.seen as Record<string, unknown>) : {};
	for (const [k, v] of Object.entries(s)) {
		const snap = v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
		if (!keys.has(k) || !snap || !Array.isArray(snap.h) || !isLevel(snap.l)) continue;
		const h = snap.h.filter((x): x is string => typeof x === 'string' && /^[0-9a-z]{1,8}$/.test(x)).slice(0, SEEN_MAX);
		seen[k] = typeof snap.p === 'number' && Number.isFinite(snap.p) && snap.p > 0 ? { h, l: snap.l, p: snap.p } : { h, l: snap.l };
	}
	const at = typeof o.at === 'string' && Number.isFinite(Date.parse(o.at)) ? o.at : null;
	return { targets, at, seen };
}

/** Por nivel (de más a menos) y, a igual nivel, por menciones; si no, como estaban. */
export function byLevel<T extends { a: Assessment }>(list: T[]): T[] {
	return list
		.map((x, i) => ({ x, i }))
		.sort((p, q) => q.x.a.level - p.x.a.level || q.x.a.count24 - p.x.a.count24 || p.i - q.i)
		.map((p) => p.x);
}
