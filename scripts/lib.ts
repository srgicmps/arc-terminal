/// <reference types="node" />
// Herramientas comunes para los scripts que descargan datos.
import { PAGES_SITE, SITE } from './site.ts';

/** Una fuente de datos: cómo se llama, cada cuánto merece la pena refrescarla y cómo descargarla. */
export interface Source<T = unknown> {
	/** Nombre del archivo: static/data/<name>.json */
	name: string;
	/** Texto para la vista de estado: de dónde salen los datos. */
	label: string;
	/** Si la última copia publicada tiene menos de estos minutos, se reutiliza sin llamar a la API. */
	maxAgeMinutes: number;
	/**
	 * Variable de entorno con la clave de la API (viene de GitHub Secrets). Si no existe, la fuente
	 * se salta sin llamar a nadie y aparece en STATUS como «Sin clave», sin contar como fallo.
	 */
	requires?: string;
	/**
	 * Recibe los datos publicados la vez anterior (si los hay), para ir acumulando historial. Las fuentes
	 * `after` reciben además `ctx`, con los datos que las demás fuentes acaban de dejar en esta pasada.
	 */
	fetch: (previous: T | undefined, ctx?: SourceContext) => Promise<T>;
	/**
	 * Si devuelve true, la copia publicada no sirve aunque sea reciente y se descarga de nuevo. Sirve
	 * para cuando la fuente cambia de forma (por ejemplo, series nuevas que la copia aún no tiene).
	 */
	isStale?: (previous: T) => boolean;
	/**
	 * Archivos extra que acompañan a los datos (rutas dentro de static/data). La fuente los escribe con
	 * writeExtra() al descargar; si se reutiliza la copia publicada, update.ts los copia de la web.
	 */
	files?: (data: T) => string[];
	/**
	 * La fuente puede venir vacía (o con muchos menos elementos que la vez anterior) sin que sea un fallo.
	 * Sin esto, update.ts trata un resultado vacío o encogido como error y reutiliza la copia anterior.
	 */
	allowEmpty?: true;
	/** Mínimo de elementos (ver countItems) para dar los datos por buenos. */
	minItems?: number;
	/**
	 * Fuente derivada: no descarga (o casi) y se calcula con los datos de otras fuentes. update.ts la
	 * ejecuta cuando las demás ya han terminado y le pasa sus datos en `ctx`.
	 * `true` (o 1) va justo después de las normales; un número mayor, detrás de las de número menor
	 * (p. ej. la traducción, `after: 2`, usa lo que deja IMP, que es `after: true`).
	 */
	after?: true | number;
	/**
	 * Plazo total de la descarga, en milisegundos (por defecto, DEFAULT_DEADLINE_MS). Solo para fuentes
	 * lentas de verdad, como un ZIP grande; conviene acompañarlo de un maxAgeMinutes alto.
	 */
	deadlineMs?: number;
}

/** Plazo por defecto de cada fuente, con todos sus reintentos: una API colgada no retiene la Action. */
export const DEFAULT_DEADLINE_MS = 90_000;

/** Plazo de una fuente: el suyo, si lo define, o el de por defecto. */
export function deadlineFor(source: Pick<Source, 'deadlineMs'>): number {
	return source.deadlineMs ?? DEFAULT_DEADLINE_MS;
}

/** Lo que reciben las fuentes `after`: los datos de otra fuente en esta misma pasada. */
export interface SourceContext {
	get<D = unknown>(name: string): D | undefined;
}

/** Sin datos de otras fuentes (primera fase y tests). */
export const NO_CONTEXT: SourceContext = { get: () => undefined };

/** Nivel de una fuente: 0 las normales, 1 `after: true`, y el número que diga `after` si es mayor. */
export const level = (s: Pick<Source, 'after'>) => (s.after === true ? 1 : Math.max(0, Math.floor(s.after ?? 0)));

/**
 * Oleadas de update.ts: primero las fuentes normales y luego cada nivel de derivadas, en orden. Las de
 * una oleada van a la vez y ven los datos de las anteriores. Sin derivadas, una sola oleada.
 */
export function waves<S extends Pick<Source, 'after'>>(sources: S[]): S[][] {
	const levels = [...new Set(sources.map(level))].sort((a, b) => a - b);
	return levels.map((n) => sources.filter((s) => level(s) === n));
}

/** Separa las fuentes normales (primera fase) de todas las derivadas (`after`). */
export function phases<S extends Pick<Source, 'after'>>(sources: S[]): [S[], S[]] {
	return [sources.filter((s) => !level(s)), sources.filter((s) => level(s) > 0)];
}

/**
 * Contexto de la segunda fase: primero lo que se ha guardado en esta pasada (`saved`) y, si esa fuente
 * no se ha ejecutado (p. ej. `pnpm data imp`), lo que haya en disco (`fallback`).
 */
export function makeContext(saved: Map<string, unknown>, fallback: (name: string) => unknown = () => undefined): SourceContext {
	return {
		get: <D>(name: string) => (saved.has(name) ? saved.get(name) : fallback(name)) as D | undefined
	};
}

/**
 * Cuántos elementos trae un resultado: la longitud si es una lista, o la suma de las listas de primer
 * nivel si es un objeto. null si no hay ninguna lista que contar (p. ej. un objeto de objetos).
 */
export function countItems(data: unknown): number | null {
	if (Array.isArray(data)) return data.length;
	if (!data || typeof data !== 'object') return null;
	const lists = Object.values(data).filter(Array.isArray);
	return lists.length ? lists.reduce((sum, l) => sum + l.length, 0) : null;
}

/** Por debajo de esta fracción de la vez anterior, se sospecha de una respuesta incompleta. */
const SHRINK = 0.2;

/**
 * Guardia contra datos vacíos o encogidos. Devuelve el motivo para no fiarse de `data`, o null si
 * está bien. Una API que responde «200 OK» con la lista vacía no lanza error, pero publicarla
 * dejaría el panel en blanco: es mejor quedarse con la copia anterior y avisar.
 */
export function checkShrink(
	data: unknown,
	previous: unknown,
	source: Pick<Source, 'allowEmpty' | 'minItems'>
): string | null {
	const count = countItems(data);
	if (count === null) return null;
	if (source.minItems !== undefined && count < source.minItems) {
		return `solo ${count} elementos; se esperan al menos ${source.minItems}`;
	}
	if (source.allowEmpty) return null;
	if (count === 0) return 'datos vacíos';
	const before = countItems(previous);
	if (before && count < before * SHRINK) {
		return `solo ${count} elementos (antes ${before}): parece una respuesta incompleta`;
	}
	return null;
}

/**
 * Espera a `promise` como mucho `ms` milisegundos; si tarda más, falla con `message`. El temporizador se
 * limpia siempre, para no dejar el proceso esperando. Ojo: la descarga de fondo no se cancela (las
 * fuentes no reciben una señal de aborto), pero `request()` ya corta cada petición a los 45 s.
 */
export function withDeadline<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(message)), ms);
	});
	return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/**
 * Cabeceras del service token de Cloudflare Access (Secrets CF_ACCESS_CLIENT_ID y CF_ACCESS_CLIENT_SECRET):
 * con ellas, las Actions leen la web privada sin pasar por el login. Vacío si no están.
 */
export function accessHeaders(): Record<string, string> {
	const id = process.env.CF_ACCESS_CLIENT_ID;
	const secret = process.env.CF_ACCESS_CLIENT_SECRET;
	return id && secret ? { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret } : {};
}

/**
 * Un archivo de la carpeta de datos de la web publicada (`path`, relativo a /data/): la copia anterior que
 * reutilizan las fuentes. Prueba primero la web de Cloudflare (con el service token de Access), en el dominio
 * propio y, si no responde bien, en *.pages.dev. Sin seguir redirecciones: sin token válido, Access
 * redirige al login, y eso cuenta como fallo. Devuelve la primera respuesta buena, la última si ninguna lo
 * es, o null si no hubo respuesta.
 */
export async function fetchPublished(path: string, ms = 30_000): Promise<Response | null> {
	let last: Response | null = null;
	const all: [string, Record<string, string>][] = [
		[SITE, accessHeaders()],
		[PAGES_SITE, accessHeaders()]
	];
	// Sin repetir: SITE_URL puede ser la propia dirección de *.pages.dev.
	const sites = all.filter(([site], i) => all.findIndex(([s]) => s === site) === i);
	for (const [site, headers] of sites) {
		const res = await fetch(`${site}/data/${path}`, { headers, redirect: 'manual', signal: AbortSignal.timeout(ms) }).catch(
			() => null
		);
		if (res?.ok) {
			report(`Copia anterior: leída de ${new URL(site).host}`);
			return res;
		}
		// Un 404 es normal (archivo nuevo); lo demás (login de Access, 5xx, sin respuesta) se avisa una vez.
		if (res?.status !== 404) report(`::warning::Copia anterior: ${new URL(site).host} responde ${res ? `HTTP ${res.status}` : 'sin respuesta'}`);
		if (res) last = res;
	}
	return last;
}

/** Cada aviso de fetchPublished, una sola vez por pasada (se llama cientos de veces). */
const reported = new Set<string>();
function report(line: string) {
	if (reported.has(line)) return;
	reported.add(line);
	console.log(line);
}

/**
 * Qué dice una respuesta de fetchPublished sobre la copia anterior: «ok» (se puede leer), «missing» (no
 * existe: solo con un 404, p. ej. una fuente nueva) o «unreadable» (existe o no, no se sabe: el login de
 * Access porque falta o ha caducado el service token, un 5xx de Cloudflare o sin respuesta).
 */
export type PreviousState = 'ok' | 'missing' | 'unreadable';

export function previousState(res: Pick<Response, 'ok' | 'status'> | null | undefined): PreviousState {
	if (res?.ok) return 'ok';
	if (res?.status === 404) return 'missing';
	return 'unreadable';
}

/**
 * Archivos de la copia anterior que no se han podido leer en esta pasada (ruta sin «.json»). Si hay alguno,
 * update.ts deja `.publish-blocked` y la Action no publica: las fuentes que acumulan historial (IMP del año,
 * FUEL, predicciones…) habrían empezado de cero, y publicarlas lo borraría para siempre.
 */
export const blocked = new Set<string>();

/**
 * Lee un archivo de la copia publicada como fetchPublished, con un reintento a los `retryMs` si no se puede
 * leer. Devuelve la respuesta si es buena y null si no: un 404 es normal; si sigue sin poderse leer, apunta
 * el archivo en `into`. Si la pasada ya está bloqueada, no reintenta: no se va a publicar y así no se alarga
 * (con la web caída, cada intento puede tardar hasta el tiempo límite en los dos dominios).
 */
export async function readPublished(
	path: string,
	ms?: number,
	{ fetcher = fetchPublished, retryMs = 3_000, into = blocked } = {}
): Promise<Response | null> {
	let res = await fetcher(path, ms);
	if (previousState(res) === 'unreadable' && !into.size) {
		await wait(retryMs);
		res = await fetcher(path, ms);
	}
	const state = previousState(res);
	if (state === 'unreadable') into.add(path.replace(/\.json$/, ''));
	return state === 'ok' ? res : null;
}

/** El aviso de una pasada bloqueada (o null si no lo está), con los primeros archivos que no se leyeron. */
export function blockedMessage(paths: Iterable<string>, shown = 5): string | null {
	const all = [...paths].sort();
	if (!all.length) return null;
	const some = all.slice(0, shown).join(', ') + (all.length > shown ? '…' : '');
	return (
		`No se pudo leer la copia publicada de ${all.length} ${all.length === 1 ? 'archivo' : 'archivos'} (${some}). ` +
		'¿Ha caducado el service token de Access (CF_ACCESS_CLIENT_*)? No se publica para no perder historiales.'
	);
}

/** Escribe un archivo extra de una fuente en static/data/<path>. */
export async function writeExtra(path: string, content: unknown) {
	const { mkdir, writeFile } = await import('node:fs/promises');
	const full = `static/data/${path}`;
	await mkdir(full.slice(0, full.lastIndexOf('/')), { recursive: true });
	await writeFile(full, JSON.stringify(content) + '\n');
}

const USER_AGENT = 'ArcTerminal/1.0 (+https://github.com/srgicmps/arc-terminal)';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** fetch con tiempo límite y hasta 3 intentos. Devuelve la respuesta solo si es 2xx. */
export async function request(url: string, init: RequestInit = {}, attempts = 3): Promise<Response> {
	for (let attempt = 1; ; attempt++) {
		try {
			const res = await fetch(url, {
				...init,
				headers: { 'User-Agent': USER_AGENT, ...init.headers },
				signal: AbortSignal.timeout(45_000)
			});
			if (!res.ok) {
				const error = new Error(`HTTP ${res.status} en ${url}`);
				// Los 4xx (salvo 408 y 429) no se arreglan reintentando.
				if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
					throw Object.assign(error, { final: true });
				}
				throw error;
			}
			return res;
		} catch (error) {
			if (attempt >= attempts || (error as { final?: boolean }).final) throw error;
			await wait(attempt * 5_000);
		}
	}
}

export async function getJson<T = any>(url: string, init: RequestInit = {}): Promise<T> {
	const res = await request(url, {
		...init,
		headers: { Accept: 'application/json', ...init.headers }
	});
	return (await res.json()) as T;
}

export async function getText(url: string, init: RequestInit = {}): Promise<string> {
	return (await request(url, init)).text();
}

/** Algunas APIs devuelven un objeto cuando hay un elemento y una lista cuando hay varios. */
export function list<T>(value: T | T[] | null | undefined): T[] {
	if (value === null || value === undefined) return [];
	return Array.isArray(value) ? value : [value];
}

/**
 * Lee un número escrito como texto; vacío, no numérico o con basura («12abc») → null.
 * - «1,599» (carburantes) y «1.599» → 1.599. Con un solo separador, siempre es el decimal: «1.599»
 *   podría ser «mil quinientos noventa y nueve», pero ninguna fuente lo escribe así y las que dan
 *   decimales con punto (Tesoro, BCE, IGN…) dependen de leerlo como 1.599.
 * - Con los dos separadores, el último es el decimal: «1.599,50» y «1,599.50» → 1599.5.
 * - Varios puntos en grupos de tres son miles: «1.234.567» → 1234567.
 */
export function num(value: unknown): number | null {
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	if (typeof value !== 'string') return null;
	let s = value.trim();
	if (/^[+-]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) && /,|\..*\./.test(s)) {
		s = s.replaceAll('.', '').replace(',', '.');
	} else if (/^[+-]?\d{1,3}(,\d{3})+\.\d+$/.test(s)) {
		s = s.replaceAll(',', '');
	} else {
		s = s.replace(/^([+-]?\d*),(\d+)$/, '$1.$2');
	}
	if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return null;
	const n = Number(s);
	return Number.isFinite(n) ? n : null;
}

const ENTITIES: Record<string, string> = {
	nbsp: ' ',
	amp: '&',
	quot: '"',
	apos: '’',
	lt: '<',
	gt: '>'
};

/** Traduce una entidad («amp», «#39», «#x27»); si no la conoce, la deja como estaba. */
function entity(match: string, body: string): string {
	if (body[0] !== '#') return ENTITIES[body.toLowerCase()] ?? match;
	const hex = body[1] === 'x' || body[1] === 'X';
	const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
	if (!(code > 0 && code <= 0x10ffff)) return match;
	// El apóstrofo recto se cambia por el tipográfico, como el resto de la web.
	return code === 39 ? '’' : String.fromCodePoint(code);
}

/** Quita etiquetas HTML y entidades sencillas, y recorta espacios. */
export function plain(value: unknown, max = 400): string {
	const text = String(value ?? '')
		.replace(/<!\[CDATA\[|\]\]>/g, '')
		// Una etiqueta pegada a la puntuación no deja hueco: «<b>2%</b>.» → «2%.», «(<b>x</b>)» → «(x)».
		.replace(/<[^>]*>(?=[.,;:!?)\]»”’%])/g, '')
		.replace(/(?<=[(\[«“¿¡])<[^>]*>/g, '')
		.replace(/<[^>]*>/g, ' ')
		// Todas las entidades de una pasada: «&amp;lt;» se queda en «&lt;», no en «<».
		.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, entity)
		.replace(/\s+/g, ' ')
		.trim();
	return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

/** Fecha de hoy en Madrid como «YYYYMMDD», con un desfase opcional en días. */
export function madridDate(offsetDays = 0): string {
	// Primero el día de hoy en Madrid y luego se suman días de calendario. Sumar 24 h al instante
	// actual falla la noche del cambio de hora (ese día dura 23 o 25 horas).
	const today = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Europe/Madrid',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date());
	const [y, m, d] = today.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d + offsetDays)).toISOString().slice(0, 10).replaceAll('-', '');
}

/**
 * Ejecuta `fn` sobre cada elemento en paralelo y devuelve solo los resultados buenos.
 * Los fallos se apuntan en el registro de la Action con su nombre, sin tumbar el resto.
 */
export async function settle<T, R>(
	tag: string,
	items: T[],
	name: (item: T) => string,
	fn: (item: T) => Promise<R | null>
): Promise<R[]> {
	const results = await Promise.allSettled(items.map(fn));
	const ok: R[] = [];
	results.forEach((r, i) => {
		if (r.status === 'fulfilled' && r.value !== null) ok.push(r.value);
		else {
			const why = r.status === 'rejected' ? String(r.reason?.message ?? r.reason) : 'sin datos';
			console.log(`  ${tag} · ${name(items[i])}: ${why}`);
		}
	});
	return ok;
}

/** Día de hoy en Madrid: «2026-10-14». */
export function madridDay(): string {
	const d = madridDate(0);
	return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

/**
 * Añade (o sustituye, si ya existe ese día) un punto al historial diario y deja solo los últimos `keep`.
 * Así, aunque las APIs solo den el dato de hoy, la web va guardando su propia evolución.
 */
export function appendDaily<P extends { date: string }>(history: P[] | undefined, point: P, keep = 400): P[] {
	const rest = (history ?? []).filter((p) => p.date !== point.date);
	return [...rest, point].sort((a, b) => a.date.localeCompare(b.date)).slice(-keep);
}

const SMALL_WORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'a', 'en', 's/n']);

/** La API escribe muchos textos en mayúsculas: «CARRETERA ME-1 KM 12» → «Carretera ME-1 Km 12». */
export function tidy(value: string | undefined, keepShort = false): string {
	const text = (value ?? '').trim().replace(/\s+/g, ' ');
	if (text !== text.toUpperCase()) return text;
	return text
		.toLowerCase()
		.split(' ')
		.map((word, i, words) => {
			if (i > 0 && SMALL_WORDS.has(word)) return word;
			// «n», «e» y «o» sueltas pueden ser conjunciones («bar o cafetería», «Francia e Italia»):
			// solo son puntos cardinales al final o detrás de «km», «carretera» o una cifra.
			if (/^(n|e|o)$/.test(word)) {
				const cardinal = i === words.length - 1 || /^(km|carretera|ctra\.?|[\d.,]+)$/.test(words[i - 1] ?? '');
				if (cardinal) return word.toUpperCase();
				if (i > 0 && word !== 'n') return word;
			}
			if (/^(s|w|ne|nw|se|sw|no|so|nne|nnw|sse|ssw|ene|ese|wnw|wsw)$/.test(word)) return word.toUpperCase();
			if (/\d/.test(word) || (keepShort && word.length <= 3)) return word.toUpperCase();
			// «atlántico-marruecos» → «Atlántico-Marruecos»
			return word.replace(/(^|-)(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
		})
		.join(' ');
}
