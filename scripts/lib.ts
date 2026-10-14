/// <reference types="node" />
// Herramientas comunes para los scripts que descargan datos.

/** Una fuente de datos: cómo se llama, cada cuánto merece la pena refrescarla y cómo descargarla. */
export interface Source<T = unknown> {
	/** Nombre del archivo: static/data/<name>.json */
	name: string;
	/** Texto para la vista de estado: de dónde salen los datos. */
	label: string;
	/** Si la última copia publicada tiene menos de estos minutos, se reutiliza sin llamar a la API. */
	maxAgeMinutes: number;
	/** Recibe los datos publicados la vez anterior (si los hay), para ir acumulando historial. */
	fetch: (previous: T | undefined) => Promise<T>;
	/**
	 * Archivos extra que acompañan a los datos (rutas dentro de static/data). La fuente los escribe con
	 * writeExtra() al descargar; si se reutiliza la copia publicada, update.ts los copia de la web.
	 */
	files?: (data: T) => string[];
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

/** «1,599» o «1.599» → 1.599; vacío o no numérico → null. */
export function num(value: unknown): number | null {
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	if (typeof value !== 'string') return null;
	const n = Number.parseFloat(value.trim().replace(',', '.'));
	return Number.isFinite(n) ? n : null;
}

/** Quita etiquetas HTML y entidades sencillas, y recorta espacios. */
export function plain(value: unknown, max = 400): string {
	const text = String(value ?? '')
		.replace(/<!\[CDATA\[|\]\]>/g, '')
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;|&apos;|&#8217;/g, '’')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
		.replace(/\s+/g, ' ')
		.trim();
	return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

/** Fecha de hoy en Madrid como «YYYYMMDD», con un desfase opcional en días. */
export function madridDate(offsetDays = 0): string {
	const d = new Date(Date.now() + offsetDays * 86_400_000);
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Europe/Madrid',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(d);
	return parts.replaceAll('-', '');
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
		.map((word, i) => {
			if (i > 0 && SMALL_WORDS.has(word)) return word;
			if (/^(n|s|e|w|o|ne|nw|se|sw|no|so|nne|nnw|sse|ssw|ene|ese|wnw|wsw)$/.test(word)) return word.toUpperCase();
			if (/\d/.test(word) || (keepShort && word.length <= 3)) return word.toUpperCase();
			return word.charAt(0).toUpperCase() + word.slice(1);
		})
		.join(' ');
}
