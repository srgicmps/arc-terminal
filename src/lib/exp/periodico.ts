// Periódico (experiencia /x/periodico): ediciones de mañana y de tarde. Lógica pura, para probarla.
// Mañana: de las 20:00 del día anterior a las 14:00. Tarde: de las 14:00 a medianoche. Antes de las 14:00, la
// de tarde es la de ayer. Las horas son de Madrid.

export type Edition = 'manana' | 'tarde';

const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

/** Milisegundos desde la medianoche de Madrid. */
function sinceMidnight(now: number): number {
	const [h, m, s] = fmt.format(new Date(now)).split(':').map(Number);
	return ((h * 60 + m) * 60 + s) * 1000 + (now % 1000);
}

const H = 3600_000;

export const currentEdition = (now: number): Edition => (sinceMidnight(now) < 14 * H ? 'manana' : 'tarde');

/** [desde, hasta) en milisegundos de la edición pedida, la más reciente que haya empezado. */
export function editionWindow(now: number, edition: Edition): { from: number; to: number; yesterday: boolean } {
	const midnight = now - sinceMidnight(now);
	const afternoon = currentEdition(now) === 'tarde';
	if (edition === 'manana') return { from: midnight - 4 * H, to: midnight + 14 * H, yesterday: false };
	return afternoon ? { from: midnight + 14 * H, to: midnight + 24 * H, yesterday: false } : { from: midnight - 10 * H, to: midnight, yesterday: true };
}

/**
 * Lo de una edición: los que caen en su franja. Si quedan menos de `min` (pocas noticias aún), se completa con
 * los más recientes de antes, para que ninguna sección salga vacía.
 */
export function inEdition<T extends { time: string | null }>(items: T[], win: { from: number; to: number }, min = 3): T[] {
	const at = (i: T) => (i.time ? Date.parse(i.time) : NaN);
	const inside = items.filter((i) => at(i) >= win.from && at(i) < win.to);
	if (inside.length >= min) return inside;
	const before = items.filter((i) => !inside.includes(i) && !(at(i) >= win.to)).sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));
	return [...inside, ...before].slice(0, Math.max(min, inside.length));
}
