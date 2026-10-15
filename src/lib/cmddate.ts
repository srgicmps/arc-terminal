// Fechas en la barra (M49): «LUZ mañana», «CAL viernes», «WX sábado». Pasa lo escrito a un día «AAAA-MM-DD»
// a partir de hoy en Madrid. Sin dependencias, para poder probarlo con Vitest.

const fold = (s: string) =>
	s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.trim()
		.toUpperCase()
		.replace(/\s+/g, ' ');

const WEEKDAYS = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const RELATIVE: Record<string, number> = { AYER: -1, HOY: 0, MANANA: 1, 'PASADO MANANA': 2, PASADO: 2 };

/** `day` más `n` días: «2026-10-15» + 2 → «2026-10-17». */
export function addDays(day: string, n: number): string {
	const d = new Date(`${day}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

/** ¿Es un día que existe? («2026-02-30» no). */
const valid = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && addDays(day, 0) === day;

/**
 * El día que pide un texto, o null si no es una fecha. `today` es hoy en Madrid («2026-10-15»).
 * Acepta hoy, mañana, pasado mañana, ayer, un día de la semana (el próximo; si es hoy, hoy), «17/10»
 * (si ya ha pasado, el del año que viene), «17/10/2026» y «2026-10-17».
 */
export function parseDay(raw: string, today: string): string | null {
	const q = fold(raw).replace(/^(EL|ESTE|PROXIMO|EL PROXIMO) /, '');
	if (q in RELATIVE) return addDays(today, RELATIVE[q]);
	const wd = WEEKDAYS.indexOf(q);
	if (wd >= 0) {
		const now = new Date(`${today}T12:00:00Z`).getUTCDay();
		return addDays(today, (wd - now + 7) % 7);
	}
	if (valid(q)) return q;
	const m = q.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/);
	if (!m) return null;
	const pad = (n: string) => n.padStart(2, '0');
	const year = m[3] ?? today.slice(0, 4);
	let day = `${year}-${pad(m[2])}-${pad(m[1])}`;
	if (!m[3] && valid(day) && day < today) day = `${Number(year) + 1}${day.slice(4)}`;
	return valid(day) ? day : null;
}
