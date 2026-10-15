// Formatos de números y fechas, siempre en español y con la hora de Madrid.

const TZ = 'Europe/Madrid';

/** 1234.5 → «1.234,50» */
export function nf(n: number | null | undefined, decimals = 2): string {
	if (n === null || n === undefined || !Number.isFinite(n)) return '—';
	const s = n.toLocaleString('es-ES', {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	});
	// Un negativo que se redondea a cero (o el -0 de sumar decimales en un eje) no lleva signo: «0,00», no «-0,00».
	return /^-0(,0+)?$/.test(s) ? s.slice(1) : s;
}

/** Con signo: «+0,25», «−1,30». Usa el signo menos tipográfico, como la maqueta. */
export function signed(n: number | null | undefined, decimals = 2): string {
	if (n === null || n === undefined || !Number.isFinite(n)) return '—';
	const body = nf(Math.abs(n), decimals);
	// Lo que se redondea a cero va sin signo: «0,00», no «+0,00» ni «−0,00».
	const sign = /[1-9]/.test(body) ? (n > 0 ? '+' : '−') : '';
	return sign + body;
}

/** Clase CSS para el color de una variación. */
export function trend(n: number | null | undefined, digits?: number): 'up' | 'down' | 'flat' {
	if (!n || !Number.isFinite(n)) return 'flat';
	// Con `digits`, lo que se escribe como cero con esos decimales («0,0») es plano, sin verde ni rojo.
	if (digits !== undefined && Math.abs(n) < 0.5 * 10 ** -digits) return 'flat';
	return n > 0 ? 'up' : 'down';
}

/** 38.1e12 → «38,10 bill.», 1.9e9 → «1,9 mil M», 2.4e6 → «2,4 M» (escala larga, la española). */
export function compact(n: number | null | undefined): string {
	if (n === null || n === undefined || !Number.isFinite(n)) return '—';
	const a = Math.abs(n);
	if (a >= 1e12) return `${nf(n / 1e12, 2)} bill.`;
	if (a >= 1e9) return `${nf(n / 1e9, 1)} mil M`;
	if (a >= 1e6) return `${nf(n / 1e6, 1)} M`;
	if (a >= 1e3) return `${nf(n / 1e3, 1)} mil`;
	return nf(n, 0);
}

const fmtHm = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
/** Abreviaturas propias: Intl da «sept» para septiembre y aquí se usa «sep» en todas partes. */
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const fmtDm = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, day: 'numeric', month: 'numeric' });
const fmtDay = new Intl.DateTimeFormat('es-ES', {
	timeZone: TZ,
	weekday: 'long',
	day: 'numeric',
	month: 'long',
	year: 'numeric'
});
const fmtWd = new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', weekday: 'short', day: 'numeric' });

/** «14:05» */
export const hm = (iso: string) => fmtHm.format(new Date(iso));
/** «14:05» en otra zona horaria (la de tu sitio); si la zona no vale, en hora de Madrid. */
export function hmIn(iso: string, timeZone: string): string {
	try {
		return new Intl.DateTimeFormat('es-ES', { timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
	} catch {
		return hm(iso);
	}
}
/** «14 oct» */
export function dm(iso: string): string {
	const parts = fmtDm.formatToParts(new Date(iso));
	const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
	return `${part('day')} ${MONTHS[part('month') - 1]}`;
}
/** «martes, 14 de octubre de 2026» */
export const longDay = (iso: string) => fmtDay.format(new Date(iso));
/** «2026-10-14» → «mar 14» */
export const weekday = (date: string) => fmtWd.format(new Date(`${date}T12:00:00Z`)).replace('.', '');

/**
 * «hace 5 min», «hace 3 h» o «14 oct 09:30». `now` es 0 hasta que la página arranca en el navegador:
 * así el HTML generado al construir y el del navegador coinciden.
 */
export function when(iso: string | null | undefined, now: number): string {
	if (!iso) return '';
	const t = Date.parse(iso);
	if (!Number.isFinite(t)) return '';
	const mins = Math.round((now - t) / 60_000);
	if (now && mins >= 0 && mins < 60) return mins < 1 ? 'ahora' : `hace ${mins} min`;
	if (now && mins >= 60 && mins < 24 * 60) return `hace ${Math.floor(mins / 60)} h`;
	return `${dm(iso)} ${hm(iso)}`;
}

/** Periodos de las series: «2026-09» → «sep 26», «2026-Q2» → «T2 26», «2026-10-14» → «14 oct». */
export function period(t: string): string {
	let m = t.match(/^(\d{4})-(\d{2})$/);
	if (m) return `${MONTHS[Number(m[2]) - 1]} ${m[1].slice(2)}`;
	m = t.match(/^(\d{4})-Q(\d)$/);
	if (m) return `T${m[2]} ${m[1].slice(2)}`;
	m = t.match(/^(\d{4})-W(\d{2})$/);
	if (m) return `sem ${Number(m[2])} ${m[1].slice(2)}`;
	m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (m) return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
	// Instante ISO («2026-10-14T19:05:00.000Z»): la hora de Madrid.
	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t)) return hm(t);
	return t;
}

/** Nombres de países y zonas. */
export const GEO: Record<string, string> = {
	ES: 'España',
	IB: 'Baleares',
	EA: 'Zona euro',
	EU: 'UE',
	DE: 'Alemania',
	FR: 'Francia',
	IT: 'Italia',
	PT: 'Portugal',
	US: 'EE. UU.'
};
