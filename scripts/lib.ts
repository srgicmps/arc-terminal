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
	fetch: () => Promise<T>;
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
