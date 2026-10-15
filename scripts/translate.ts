/// <reference types="node" />
// Titulares en inglés traducidos al español con MyMemory (api.mymemory.translated.net/get), sin tarjeta
// ni clave. Lo usa la fuente derivada `translations` (scripts/sources/translate.ts), que va detrás de IMP.
//
// - Solo se traducen los titulares que se ven en TOP, IMP, GEO y ECO (ver pickTitles).
// - Cada traducción se guarda en static/data/translations.json, por el hash del titular, y se publica
//   con la web: la pasada siguiente la reutiliza y nunca se traduce dos veces lo mismo.
// - MyMemory sube el límite diario si se le da un correo en `de=`. Va en el Secret MYMEMORY_EMAIL y no
//   sale nunca en los registros ni en los JSON. Sin el Secret, no se llama a nadie: todo sigue en inglés.
//   En los PR, deploy.yml no lo pasa: así no se gasta el cupo en traducciones que no se publican.
// - Si MyMemory da 429, se acaba el cupo o falla, el titular se queda en inglés y no pasa nada.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import type { ImpData, NewsData, NewsItem } from '../src/lib/types.ts';

/** Lo que se permite gastar. Todo por debajo de los límites de MyMemory, que son por día. */
export const LIMITS = {
	/**
	 * Caracteres al día. MyMemory da 5 000 al día sin correo y 50 000 con un correo válido en `de=`
	 * (mymemory.translated.net/doc/usagelimits.php). Sin correo el límite va por IP, y los runners de
	 * GitHub comparten IP con otros repos: por eso solo se traduce con el correo, y con margen.
	 */
	dailyChars: 40_000,
	/** Caracteres por pasada (hay unas 96 al día): reparte el cupo y la pasada no se alarga. */
	runChars: 4_000,
	/** MyMemory no acepta textos de más de 500 bytes. */
	maxBytes: 500,
	/** Peticiones a la vez. */
	concurrency: 3,
	/** Plazo de cada petición y de toda la traducción, en milisegundos. */
	requestMs: 15_000,
	totalMs: 60_000,
	/** Fallos seguidos (que no sean el cupo) antes de dejarlo para la pasada siguiente. */
	maxErrors: 3,
	/** Días que se recuerda una traducción que ya no sale en ningún titular. */
	keepDays: 3
};

const API = 'https://api.mymemory.translated.net/get';
const USER_AGENT = 'ArcTerminal/1.0 (+https://github.com/srgicmps/arc-terminal)';

/** Lo que se guarda en static/data/translations.json. */
export interface TranslationCache {
	/** Día (UTC) al que corresponde `chars`. */
	day: string;
	/** Caracteres enviados a MyMemory ese día. */
	chars: number;
	/** MyMemory ha dicho que se acabó el cupo de hoy: no se le vuelve a llamar hasta mañana. */
	full?: true;
	/** Hash del titular → traducción y último día en que se vio. */
	entries: Record<string, { es: string; seen: string }>;
}

/** Secciones de titulares que se leen (static/data/news-<clave>.json). */
const TOP_SECTIONS = ['es', 'eco', 'geo', 'ws', 'tech', 'ai'];
/** De cada sección, cuántos titulares se ven en su vista (TOP enseña los 3 primeros de cada una). */
const SHOWN: Record<string, number> = { geo: 60, eco: 25, gov: 15 };

const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);
const bytes = (text: string) => Buffer.byteLength(text, 'utf8');

/** Clave del titular en la caché: sin mayúsculas ni espacios de más, para que no cuente como nuevo. */
export function titleKey(title: string): string {
	const norm = title.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
	return createHash('sha1').update(norm).digest('hex').slice(0, 16);
}

/** Quita el correo de cualquier texto antes de escribirlo en el registro (también codificado en la URL). */
export function redact(text: string, email: string | undefined): string {
	if (!email) return text;
	let out = text;
	for (const form of new Set([email, encodeURIComponent(email), email.replace('@', '%40')])) {
		out = out.split(form).join('[correo]');
	}
	return out;
}

/** Caché vacía, o la publicada si tiene la forma esperada. */
export function loadCache(data: unknown, now: number): TranslationCache {
	const c = data as Partial<TranslationCache> | undefined;
	const entries = c && typeof c.entries === 'object' && c.entries ? c.entries : {};
	const day = utcDay(now);
	// Día nuevo: el contador vuelve a cero.
	if (c?.day !== day || typeof c.chars !== 'number') return { day, chars: 0, entries };
	return { day, chars: c.chars, ...(c.full && { full: true as const }), entries };
}

/** El cupo de hoy se ha acabado (429 o «quota finished»): no merece la pena seguir. */
export class QuotaError extends Error {}

interface MyMemoryReply {
	responseData?: { translatedText?: string };
	responseStatus?: number | string;
	responseDetails?: string;
	quotaFinished?: boolean;
}

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
/** Entidades HTML con nombre y numéricas (&#039;, &#8217;, &#x2019;), en una sola pasada: «&amp;#39;» queda «&#39;». */
const decode = (s: string) =>
	s.replace(/&(?:(amp|quot|apos|lt|gt|nbsp)|#(\d{1,7})|#x([0-9a-f]{1,6}));/gi, (all, name?: string, dec?: string, hex?: string) => {
		if (name) return ENTITIES[name.toLowerCase()];
		const code = dec ? Number(dec) : parseInt(hex!, 16);
		return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all;
	});

/** Traduce un texto del inglés al español. Lanza QuotaError si se acabó el cupo y Error si falla. */
export async function myMemory(text: string, email: string, fetchFn: typeof fetch = fetch): Promise<string> {
	const url = `${API}?${new URLSearchParams({ q: text, langpair: 'en|es', de: email })}`;
	const res = await fetchFn(url, {
		headers: { 'User-Agent': USER_AGENT },
		signal: AbortSignal.timeout(LIMITS.requestMs)
	});
	if (res.status === 429) throw new QuotaError('HTTP 429');
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const body = (await res.json()) as MyMemoryReply;
	const status = Number(body.responseStatus);
	const out = decode(String(body.responseData?.translatedText ?? '').trim());
	if (status === 429 || body.quotaFinished || /MYMEMORY WARNING/i.test(out)) throw new QuotaError('cupo agotado');
	if (status !== 200) throw new Error(`MyMemory ${status || 'sin estado'}`);
	if (!out || /QUERY LENGTH LIMIT|INVALID/i.test(out)) throw new Error('respuesta vacía o no válida');
	return out;
}

export interface TranslateResult {
	cache: TranslationCache;
	/** Titulares traducidos en esta pasada. */
	done: number;
	/** Caracteres enviados en esta pasada. */
	sent: number;
	/** Por qué se paró antes de tiempo, si se paró. */
	stopped?: string;
}

/**
 * Traduce los titulares que aún no están en la caché, en el orden dado (el primero, el más importante),
 * sin pasar del tope de la pasada ni del diario. Nunca lanza: lo que falla se queda en inglés.
 */
export async function translateTitles(
	titles: string[],
	previous: TranslationCache,
	{ email, fetchFn = fetch, now = Date.now() }: { email: string; fetchFn?: typeof fetch; now?: number }
): Promise<TranslateResult> {
	const cache = loadCache(previous, now);
	if (cache.full) return { cache, done: 0, sent: 0, stopped: 'cupo de hoy agotado' };

	// Lo que cabe en esta pasada, por orden de importancia.
	let budget = Math.min(LIMITS.runChars, LIMITS.dailyChars - cache.chars);
	const todo: string[] = [];
	const keys = new Set<string>();
	for (const title of titles) {
		const k = titleKey(title);
		if (cache.entries[k] || keys.has(k) || bytes(title) > LIMITS.maxBytes) continue;
		if (title.length > budget) continue;
		budget -= title.length;
		keys.add(k);
		todo.push(title);
	}

	let done = 0;
	let sent = 0;
	let errors = 0;
	let stopped: string | undefined;
	// El plazo va con el reloj de verdad (`now` solo decide el día).
	const deadline = Date.now() + LIMITS.totalMs;
	const day = utcDay(now);

	async function worker() {
		while (todo.length && !stopped) {
			if (Date.now() > deadline) {
				stopped = 'tiempo agotado';
				return;
			}
			const title = todo.shift()!;
			// Se cuenta antes de pedir: MyMemory cuenta también las peticiones que fallan.
			cache.chars += title.length;
			sent += title.length;
			try {
				const es = await myMemory(title, email, fetchFn);
				cache.entries[titleKey(title)] = { es, seen: day };
				done++;
				errors = 0;
			} catch (error) {
				if (error instanceof QuotaError) {
					cache.full = true;
					stopped = 'cupo de hoy agotado';
				} else if (++errors >= LIMITS.maxErrors) {
					stopped = `MyMemory no responde (${error instanceof Error ? error.message : 'error'})`;
				}
			}
		}
	}
	await Promise.all(Array.from({ length: LIMITS.concurrency }, worker));
	return { cache, done, sent, stopped };
}

/** Pone `titleEs` a los titulares en inglés que estén en la caché y marca esas entradas como vistas hoy. */
export function applyCache<T extends { title: string; lang?: 'en'; titleEs?: string }>(
	items: T[],
	cache: TranslationCache,
	day: string
): void {
	for (const item of items) {
		if (item.lang !== 'en') continue;
		const hit = cache.entries[titleKey(item.title)];
		if (!hit) continue;
		hit.seen = day;
		if (hit.es.toLowerCase() !== item.title.toLowerCase()) item.titleEs = hit.es;
	}
}

/** Olvida las traducciones que llevan más de `keepDays` sin verse. */
export function prune(cache: TranslationCache, now: number): TranslationCache {
	const oldest = utcDay(now - LIMITS.keepDays * 86_400_000);
	const entries = Object.fromEntries(Object.entries(cache.entries).filter(([, e]) => e.seen >= oldest));
	return { ...cache, entries };
}

/**
 * Los titulares en inglés que se ven en TOP, IMP, GEO y ECO, del más importante al menos: IMP de hoy,
 * los 3 primeros de cada sección (TOP) y luego los de GEO (con «Gobiernos») y ECO.
 */
export function pickTitles(news: Record<string, NewsItem[]>, imp: ImpData | undefined): string[] {
	const en = (items: { title: string; lang?: 'en' }[]) => items.filter((i) => i.lang === 'en').map((i) => i.title);
	const today = imp?.days.find((d) => d.date === imp.date)?.items ?? [];
	return [
		...en(imp?.current ?? []),
		...en(today),
		...TOP_SECTIONS.flatMap((s) => en((news[s] ?? []).slice(0, 3))),
		...Object.entries(SHOWN).flatMap(([s, n]) => en((news[s] ?? []).slice(0, n)))
	];
}

async function readJson<T>(path: string): Promise<T | undefined> {
	try {
		return JSON.parse(await readFile(path, 'utf8')) as T;
	} catch {
		return undefined;
	}
}

const write = (path: string, value: unknown) => writeFile(path, JSON.stringify(value) + '\n');

interface Options {
	/** Carpeta de los datos (static/data). */
	dir: string;
	/** Correo para `de=` (Secret MYMEMORY_EMAIL). Sin él no se traduce nada. */
	email: string | undefined;
	/** Los datos de translations.json publicados la vez anterior. */
	previous: unknown;
	fetchFn?: typeof fetch;
	now?: number;
	log?: (line: string) => void;
}

/**
 * Lo que hace la fuente `translations` (scripts/sources/translate.ts): lee los titulares e IMP ya
 * guardados, traduce los nuevos, les pone `titleEs` y devuelve la caché, que update.ts guarda en
 * translations.json. Nunca lanza, y el correo nunca llega al registro ni a los archivos.
 */
export async function translateHeadlines({
	dir,
	email,
	previous,
	fetchFn = fetch,
	now = Date.now(),
	log = console.log
}: Options): Promise<TranslationCache> {
	const say = (line: string) => log(redact(line, email));
	const before = loadCache(previous, now);
	if (!email) {
		say('- translations: sin MYMEMORY_EMAIL, los titulares se quedan en inglés');
		return before;
	}
	try {
		const sections = [...new Set([...TOP_SECTIONS, ...Object.keys(SHOWN)])];
		const files = new Map<string, { data: NewsData }>();
		for (const s of sections) {
			const dataset = await readJson<{ data: NewsData }>(`${dir}/news-${s}.json`);
			if (dataset?.data?.items) files.set(s, dataset);
		}
		const impFile = await readJson<{ data: ImpData }>(`${dir}/imp.json`);
		const imp = impFile?.data?.current && impFile.data.days ? impFile.data : undefined;
		const news = Object.fromEntries([...files].map(([s, d]) => [s, d.data.items]));

		const result = await translateTitles(pickTitles(news, imp), before, { email, fetchFn, now });
		const day = utcDay(now);
		for (const items of Object.values(news)) applyCache(items, result.cache, day);
		if (imp) applyCache([...imp.current, ...imp.days.flatMap((d) => d.items)], result.cache, day);
		const cache = prune(result.cache, now);

		for (const [s, dataset] of files) await write(`${dir}/news-${s}.json`, dataset);
		if (imp) await write(`${dir}/imp.json`, impFile);

		say(
			`  translations: ${result.done} titulares nuevos (${result.sent} caracteres; hoy ${cache.chars} de ${LIMITS.dailyChars})`
		);
		// Que MyMemory no responda es un aviso; quedarse sin cupo o sin tiempo es lo normal algún día.
		if (result.stopped) {
			const prefix = result.stopped.startsWith('MyMemory') ? '::warning title=translations::' : '  translations: ';
			say(`${prefix}${result.stopped}; el resto sigue en inglés`);
		}
		return cache;
	} catch (error) {
		say(
			`::warning title=translations::${error instanceof Error ? error.message : String(error)}; los titulares siguen en inglés`
		);
		return before;
	}
}
