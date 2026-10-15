// Línea de tiempo (Arc OS): la escala de tiempo que comparten todos los carriles. Un «dominio» es el
// intervalo visible [desde, hasta] en milisegundos; la escala lo convierte en píxeles y al revés. Zoom y
// arrastre solo cambian el dominio. Lógica pura, sin Svelte, para probarla con Vitest.

export type Domain = readonly [number, number];

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

/** Rangos de los botones. `ahead`: parte del rango que queda a la derecha de «ahora» (la agenda es futura). */
export const RANGES = [
	{ value: '24h', label: '24 h', span: DAY, ahead: 0.25 },
	{ value: '7d', label: '7 d', span: 7 * DAY, ahead: 0.2 },
	{ value: '30d', label: '30 d', span: 30 * DAY, ahead: 0.2 },
	{ value: '1a', label: '1 año', span: 365 * DAY, ahead: 0.1 }
] as const;

export type RangeKey = (typeof RANGES)[number]['value'];

/** Límites del zoom: de una hora a dos años a la vista. */
export const MIN_SPAN = HOUR;
export const MAX_SPAN = 2 * 365 * DAY;

/** El dominio de un rango alrededor de `now`. */
export function rangeDomain(key: RangeKey, now: number): Domain {
	const r = RANGES.find((x) => x.value === key) ?? RANGES[1];
	return [now - r.span * (1 - r.ahead), now + r.span * r.ahead];
}

export interface Scale {
	domain: Domain;
	/** Píxel de la izquierda y de la derecha. */
	range: readonly [number, number];
	x: (t: number) => number;
	t: (x: number) => number;
}

export function scale(domain: Domain, range: readonly [number, number]): Scale {
	const [d0, d1] = domain;
	const [r0, r1] = range;
	const k = (r1 - r0) / (d1 - d0 || 1);
	return { domain, range, x: (t) => r0 + (t - d0) * k, t: (x) => d0 + (x - r0) / k };
}

/** Acerca (factor < 1) o aleja (> 1) dejando quieto el instante `at`, dentro de los límites. */
export function zoom(domain: Domain, at: number, factor: number): Domain {
	const [d0, d1] = domain;
	const span = d1 - d0;
	const next = Math.min(MAX_SPAN, Math.max(MIN_SPAN, span * factor));
	const f = span ? (at - d0) / span : 0.5;
	return [at - next * f, at - next * f + next];
}

/** Desplaza el dominio `dt` milisegundos (positivo: hacia el futuro). */
export const pan = (domain: Domain, dt: number): Domain => [domain[0] + dt, domain[1] + dt];

/** Pasos posibles de la rejilla, de menor a mayor. Los de mes y año van por calendario. */
const STEPS: { ms: number; unit: 'h' | 'd' | 'm' | 'y'; n: number }[] = [
	{ ms: HOUR, unit: 'h', n: 1 },
	{ ms: 3 * HOUR, unit: 'h', n: 3 },
	{ ms: 6 * HOUR, unit: 'h', n: 6 },
	{ ms: 12 * HOUR, unit: 'h', n: 12 },
	{ ms: DAY, unit: 'd', n: 1 },
	{ ms: 2 * DAY, unit: 'd', n: 2 },
	{ ms: 7 * DAY, unit: 'd', n: 7 },
	{ ms: 14 * DAY, unit: 'd', n: 14 },
	{ ms: 30 * DAY, unit: 'm', n: 1 },
	{ ms: 91 * DAY, unit: 'm', n: 3 },
	{ ms: 182 * DAY, unit: 'm', n: 6 },
	{ ms: 365 * DAY, unit: 'y', n: 1 }
];

export interface Tick {
	t: number;
	label: string;
	/** Marca mayor: cambio de día (en pasos de horas) o de año (en pasos de meses). */
	major: boolean;
}

/** Formateadores en caché: crear un Intl.DateTimeFormat es caro y las marcas piden muchos. */
const fmts = new Map<string, Intl.DateTimeFormat>();
const fmt = (opts: Intl.DateTimeFormatOptions, timeZone?: string) => {
	const key = JSON.stringify(opts) + (timeZone ?? '');
	let f = fmts.get(key);
	if (!f) fmts.set(key, (f = new Intl.DateTimeFormat('es-ES', { ...opts, timeZone })));
	return f;
};

/**
 * Marcas del eje para el dominio, como mucho `max`. Se alinean con la hora local (o la de `timeZone`):
 * horas en punto, medianoche, día 1 de mes, 1 de enero.
 */
export function ticks(domain: Domain, max: number, timeZone?: string): Tick[] {
	const [d0, d1] = domain;
	const span = d1 - d0;
	if (!(span > 0) || max < 1) return [];
	const step = STEPS.find((s) => span / s.ms <= max) ?? STEPS[STEPS.length - 1];
	const hm = fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, timeZone);
	const dm = fmt({ day: 'numeric', month: 'short' }, timeZone);
	const my = fmt({ month: 'short', year: '2-digit' }, timeZone);
	const y = fmt({ year: 'numeric' }, timeZone);
	const parts = fmt({ year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23' }, timeZone);
	const get = (t: number) => {
		const p = Object.fromEntries(parts.formatToParts(t).map((x) => [x.type, Number(x.value)]));
		return { y: p.year, m: p.month, d: p.day, h: p.hour };
	};
	const out: Tick[] = [];
	const push = (t: number, label: string, major: boolean) => {
		if (t >= d0 && t <= d1) out.push({ t, label: label.replace('.', ''), major });
	};
	if (step.unit === 'h') {
		// Recorre hora a hora desde una hora antes de d0; vale con cambios de horario.
		for (let t = Math.floor(d0 / HOUR) * HOUR - HOUR; t <= d1 + HOUR; t += HOUR) {
			const p = get(t);
			if (p.h % step.n !== 0) continue;
			push(t, p.h === 0 ? dm.format(t) : hm.format(t), p.h === 0);
			if (out.length > max * 2) break;
		}
		return out;
	}
	if (step.unit === 'd') {
		// Día a día desde la medianoche local del día anterior a d0 (no hora a hora: son 24 veces menos vueltas).
		const s0 = get(d0 - DAY);
		let day = Date.UTC(s0.y, s0.m - 1, s0.d);
		for (let i = 0; i < 1000; i++, day += DAY) {
			const date = new Date(day);
			const t = dayMidnight(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), timeZone);
			if (t > d1) break;
			const dayOfEpoch = Math.round(day / DAY);
			if (step.n === 7 || step.n === 14) {
				// Semanas: los lunes (y uno de cada dos, si son de 14 días).
				if (date.getUTCDay() !== 1 || (step.n === 14 && Math.floor(dayOfEpoch / 7) % 2)) continue;
			} else if (dayOfEpoch % step.n) continue;
			push(t, dm.format(t), date.getUTCDate() === 1);
			if (out.length > max * 2) break;
		}
		return out;
	}
	// Meses y años: del día 1 a medianoche local. Se busca la medianoche real con la hora local de ese día.
	const start = get(d0);
	let yy = start.y;
	let mm = start.m;
	for (let i = 0; i < 400; i++) {
		const t = localMidnight(yy, mm, timeZone);
		if (t > d1) break;
		const monthsFromZero = yy * 12 + mm - 1;
		const keep = step.unit === 'y' ? mm === 1 : monthsFromZero % step.n === 0;
		if (keep) push(t, step.unit === 'y' || mm === 1 ? y.format(t) : my.format(t), mm === 1);
		mm++;
		if (mm > 12) {
			mm = 1;
			yy++;
		}
	}
	return out;
}

/** Medianoche del día 1 del mes `m` (1–12) del año `y`, en la zona dada (o la local). */
export function localMidnight(y: number, m: number, timeZone?: string): number {
	const guess = Date.UTC(y, m - 1, 1);
	return guess - offsetMs(guess, timeZone);
}

/** Medianoche (hora local o de `timeZone`) del día `d` del mes `m` (1–12) del año `y`. */
export function dayMidnight(y: number, m: number, d: number, timeZone?: string): number {
	const guess = Date.UTC(y, m - 1, d);
	// Dos pasadas, como `zoned`: la segunda corrige si el desfase cambia entre la estimación y el resultado.
	return guess - offsetMs(guess - offsetMs(guess, timeZone), timeZone);
}

/** Diferencia entre la hora de la zona y UTC en el instante `t` (en ms; +2 h en Madrid en verano). */
export function offsetMs(t: number, timeZone?: string): number {
	const p = Object.fromEntries(
		fmt({ year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }, timeZone)
			.formatToParts(t)
			.map((x) => [x.type, Number(x.value)])
	);
	return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
}

/** Instante de una hora de reloj en una zona: «2026-10-29» a las «14:15» de Europe/Berlin. */
export function zoned(date: string, hm: string, timeZone: string): number {
	const [y, m, d] = date.split('-').map(Number);
	const [h, min] = hm.split(':').map(Number);
	const guess = Date.UTC(y, m - 1, d, h, min);
	// Dos pasadas: la primera estima el desfase; la segunda lo corrige si cae al otro lado de un cambio de hora.
	const first = guess - offsetMs(guess, timeZone);
	return guess - offsetMs(first, timeZone);
}

/** Columnas del gráfico según el ancho (px): etiquetas a la izquierda, valores a la derecha y, en medio, el área. */
export interface Columns {
	/** Ancho estrecho (teléfono o ventana pequeña): columnas y textos más cortos. */
	narrow: boolean;
	/** Borde izquierdo y derecho del área del gráfico. */
	x0: number;
	x1: number;
	/** Separación mínima entre marcas del eje. */
	tickGap: number;
}

/** Por debajo de este ancho, columnas estrechas. */
export const NARROW_W = 600;

/**
 * Reparte el ancho: 150/92 px de columnas en ancho y 80/56 en estrecho. Si ni así queda un área de 60 px,
 * cede la columna de etiquetas. El área nunca invade la de valores (x1 ≤ ancho − valores).
 */
export function columns(width: number): Columns {
	const w = Math.max(0, width);
	const narrow = w < NARROW_W;
	const value = narrow ? 56 : 92;
	let label = narrow ? 80 : 150;
	const MIN_AREA = 60;
	if (w - label - value < MIN_AREA) label = Math.max(0, Math.min(label, w - value - MIN_AREA));
	return { narrow, x0: label, x1: Math.max(label, w - value), tickGap: narrow ? 56 : 84 };
}

/** Texto corto de un instante para la etiqueta del cursor: «15 oct 14:05» o «15 oct 2025». */
export function stamp(t: number, span: number, timeZone?: string): string {
	const opts: Intl.DateTimeFormatOptions =
		span > 120 * DAY ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
	return fmt(opts, timeZone).format(t).replace('.', '').replace(',', '');
}
