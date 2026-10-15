// Ayudas para los gráficos propios (LineChart).

/**
 * Qué puntos del eje X llevan etiqueta: la primera, la última y otras repartidas por igual, sin que dos
 * etiquetas queden a menos de `minGap` px. `count` es el número de puntos y `width`, el ancho del eje.
 */
export function axisTicks(count: number, width: number, minGap: number): number[] {
	if (count <= 0) return [];
	if (count === 1) return [0];
	const fit = Math.max(2, Math.floor(width / minGap) + 1);
	const n = Math.min(count, fit);
	const out = new Set<number>();
	for (let k = 0; k < n; k++) out.add(Math.round((k * (count - 1)) / (n - 1)));
	return [...out];
}

/** Periodos que se pueden elegir en un gráfico: los meses hacia atrás desde el último dato (0 = todo). */
export const PERIODS = [
	{ months: 1, label: '1M' },
	{ months: 6, label: '6M' },
	{ months: 12, label: '1A' },
	{ months: 60, label: '5A' }
] as const;

/** Fecha de un periodo del eje X: «2026», «2026-10», «2026-10-14» o «2026-Q3» (el primer día). */
export function periodDate(t: string): Date | null {
	const q = /^(\d{4})-Q([1-4])$/.exec(t);
	if (q) return new Date(Date.UTC(+q[1], (+q[2] - 1) * 3, 1));
	const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(t);
	return m ? new Date(Date.UTC(+m[1], m[2] ? +m[2] - 1 : 0, m[3] ? +m[3] : 1)) : null;
}

/** Primer día que entra en los últimos `months` meses, contados desde el periodo `last`. */
export function periodStart(last: string, months: number): Date | null {
	const d = periodDate(last);
	if (!d) return null;
	d.setUTCMonth(d.getUTCMonth() - months);
	return d;
}

/**
 * Periodos que tiene sentido ofrecer para estos puntos del eje X (ordenados): los que dejan fuera algún
 * punto y aún dejan 3 o más. Si no hay ninguno, no se ofrece nada (ni siquiera «Máx»).
 */
export function periodChoices(ts: string[]): { value: string; label: string }[] {
	const last = ts.at(-1);
	if (!last) return [];
	const out = PERIODS.filter(({ months }) => {
		const start = periodStart(last, months);
		if (!start) return false;
		const kept = ts.filter((t) => (periodDate(t) ?? start) >= start).length;
		return kept >= 3 && kept < ts.length;
	}).map((p) => ({ value: String(p.months), label: p.label }));
	return out.length ? [...out, { value: '0', label: 'Máx' }] : [];
}
