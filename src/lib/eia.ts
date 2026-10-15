// EIA (Administración de Información Energética de EE. UU.): inventarios semanales de petróleo.
// scripts/sources/eia.ts los descarga; aquí, los tipos y la cuenta de la variación, puros para probarlos.

export interface EiaStock {
	/** Código de la serie en la EIA («WCESTUS1»). */
	id: string;
	label: string;
	/** Semanas («2026-10-09», el viernes en que acaba) de la más antigua a la más reciente, en millones de barriles. */
	points: { t: string; v: number }[];
	/** Media de la misma semana en los 5 años anteriores, en millones de barriles; null si falta algún año. */
	avg5: number | null;
}

export interface EiaData {
	stocks: EiaStock[];
}

/** Variación frente a la semana anterior, en millones de barriles. */
export function weekChange(points: EiaStock['points']): number | null {
	const [prev, last] = points.slice(-2);
	return prev && last ? last.v - prev.v : null;
}

/** Diferencia con la media de 5 años, en %. */
export function vsAvg5(stock: EiaStock): number | null {
	const last = stock.points.at(-1);
	return last && stock.avg5 ? ((last.v - stock.avg5) / stock.avg5) * 100 : null;
}
