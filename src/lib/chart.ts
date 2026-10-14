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
