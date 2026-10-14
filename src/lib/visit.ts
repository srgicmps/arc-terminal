// «Nuevo desde tu última visita»: la lógica pura (sin runes), para poder probarla con Vitest.
// El estado reactivo y los listeners del navegador están en visit.svelte.ts.

/** localStorage: hora (ISO) de la última vez que se dejó la terminal. */
export const KEY = 'arc-last-visit';
/** sessionStorage: la referencia de esta pestaña, para que recargar no borre los puntos. */
export const SESSION_KEY = 'arc-last-visit-session';
/** Tras estar oculta al menos esto, volver a la pestaña cuenta como una visita nueva. */
export const AWAY_MS = 30 * 60_000;

const TZ = 'Europe/Madrid';

/** Lo mínimo que hace falta de un titular (NewsItem lo cumple). */
export interface Dated {
	time: string | null;
}

function ms(iso: string | null | undefined): number {
	if (!iso) return NaN;
	return Date.parse(iso);
}

/** ¿Es el titular posterior a la última visita? Sin visita anterior o sin fecha, no. */
export function isNew(item: Dated, last: string | null): boolean {
	const l = ms(last);
	const t = ms(item.time);
	return Number.isFinite(l) && Number.isFinite(t) && t > l;
}

/** Cuántos titulares son posteriores a la última visita. */
export function newCount(items: readonly Dated[], last: string | null): number {
	let n = 0;
	for (const item of items) if (isNew(item, last)) n++;
	return n;
}

const fmtHm = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' });
const fmtDate = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «2026-10-14» en Madrid. */
const madridDay = (t: number) => fmtDate.format(new Date(t));

/** «las 9:12», «ayer a las 21:40» o «el 12 oct a las 21:40», según el día en Madrid. */
export function sinceLabel(last: string, now: number): string {
	const t = ms(last);
	const at = `las ${fmtHm.format(new Date(t))}`;
	const day = madridDay(t);
	if (day === madridDay(now)) return at;
	// Ayer: el día de Madrid de hace 24 h (o de hace 23 h / 25 h en los cambios de hora).
	if ([24, 23, 25].some((h) => madridDay(now - h * 3_600_000) === day)) return `ayer a ${at}`;
	const [, m, d] = day.split('-').map(Number);
	return `el ${d} ${MONTHS[m - 1]} a ${at}`;
}

/**
 * «18 titulares nuevos desde las 9:12», «1 titular nuevo desde ayer a las 21:40», «Nada nuevo desde
 * las 9:12». Sin visita anterior (o con una fecha rota), cadena vacía: no hay nada que decir.
 */
export function newSinceText(count: number, last: string | null, now: number): string {
	if (!Number.isFinite(ms(last))) return '';
	const since = `desde ${sinceLabel(last as string, now)}`;
	if (count <= 0) return `Nada nuevo ${since}`;
	return count === 1 ? `1 titular nuevo ${since}` : `${count} titulares nuevos ${since}`;
}

// ---------- Lectura y escritura seguras ----------

/** Lo que usamos de localStorage / sessionStorage (así los tests pueden pasar uno falso). */
export type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** Devuelve el almacén o null si el navegador no lo deja tocar (modo privado, SSR…). */
export function storage(kind: 'localStorage' | 'sessionStorage'): Store | null {
	try {
		return (globalThis as Record<string, unknown>)[kind] as Store | undefined ?? null;
	} catch {
		return null;
	}
}

/** Lee una hora ISO guardada. Si no hay, está rota o el almacén lanza, null. */
export function readStamp(store: Store | null, key = KEY): string | null {
	try {
		const v = store?.getItem(key) ?? null;
		return v && Number.isFinite(Date.parse(v)) ? v : null;
	} catch {
		return null;
	}
}

/** Guarda una hora ISO. Devuelve false si no se pudo (sin almacén, cuota llena, bloqueado…). */
export function writeStamp(store: Store | null, iso: string, key = KEY): boolean {
	if (!store) return false;
	try {
		store.setItem(key, iso);
		return true;
	} catch {
		return false;
	}
}

/**
 * La referencia al abrir la terminal. Si esta pestaña ya tenía una (recarga), se respeta; si no, la
 * de localStorage (null la primera vez). En sessionStorage «none» significa «primera visita».
 */
export function startingPoint(local: Store | null, session: Store | null): string | null {
	try {
		const kept = session?.getItem(SESSION_KEY);
		if (kept === 'none') return null;
		if (kept && Number.isFinite(Date.parse(kept))) return kept;
	} catch {}
	const last = readStamp(local);
	writeStamp(session, last ?? 'none', SESSION_KEY);
	return last;
}
