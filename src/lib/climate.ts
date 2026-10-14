// Clima del planeta: temperatura media mundial diaria (Copernicus ERA5) y CO₂ de Mauna Loa (NOAA).
// Funciones puras para leer los CSV y sacar el puesto del día; las usa scripts/sources/climate.ts.

/** Un día de ERA5: temperatura media mundial del aire a 2 m y anomalía frente a 1991–2020, en °C. */
export interface TempDay {
	date: string;
	temp: number;
	anomaly: number;
}

/** Un día de CO₂ en Mauna Loa, en ppm. */
export interface Co2Day {
	date: string;
	ppm: number;
}

export interface ClimateData {
	/** El último día publicado y su puesto entre ese mismo día de todos los años. */
	temp: {
		date: string;
		temp: number;
		anomaly: number;
		/** 1 = el día más cálido de la serie para esa fecha. */
		rank: number;
		/** Años con dato para esa fecha (los que entran en el puesto). */
		years: number;
		/** Primer año de la serie: «desde 1940». */
		since: number;
	} | null;
	co2: {
		date: string;
		ppm: number;
		/** El mismo día del año anterior (o el más cercano, ±7 días). */
		yearAgo: Co2Day | null;
	} | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Líneas de datos de un CSV: sin vacías ni comentarios («#»), partidas por comas. */
function rows(csv: string): string[][] {
	return csv
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l && !l.startsWith('#'))
		.map((l) => l.split(',').map((c) => c.trim()));
}

/**
 * CSV de Copernicus Climate Pulse: «date,2t,clim_91-20,ano_91-20,status». Busca las columnas por nombre
 * en la cabecera y, si no la encuentra, las toma por posición. Las filas sin fecha o sin número se saltan.
 */
export function parseEra5(csv: string): TempDay[] {
	const all = rows(csv);
	const cols = all.find((r) => r.includes('date')) ?? [];
	const at = (i: number, fallback: number) => (i < 0 ? fallback : i);
	const iDate = at(cols.indexOf('date'), 0);
	const iTemp = at(cols.indexOf('2t'), 1);
	const iAno = at(cols.findIndex((c) => c.startsWith('ano')), 3);
	const out: TempDay[] = [];
	for (const r of all) {
		const date = r[iDate] ?? '';
		const temp = r[iTemp] ? Number(r[iTemp]) : NaN;
		const anomaly = r[iAno] ? Number(r[iAno]) : NaN;
		if (!ISO.test(date) || !Number.isFinite(temp) || !Number.isFinite(anomaly)) continue;
		out.push({ date, temp, anomaly });
	}
	return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Puesto de un día entre ese mismo día (mes y día) de todos los años: 1 = el más cálido. Se compara la
 * temperatura absoluta; con la misma climatología para esa fecha, es lo mismo que comparar anomalías.
 */
export function rankDay(days: TempDay[], date: string): { rank: number; years: number } | null {
	const day = days.find((d) => d.date === date);
	if (!day) return null;
	const same = days.filter((d) => d.date.slice(5) === date.slice(5));
	return { rank: 1 + same.filter((d) => d.temp > day.temp).length, years: same.length };
}

/**
 * CSV diario de Mauna Loa de NOAA GML: comentarios con «#» y filas «año,mes,día,fecha decimal,ppm».
 * Los días sin medida vienen con un valor negativo (−999.99) y se saltan.
 */
export function parseCo2(csv: string): Co2Day[] {
	const out: Co2Day[] = [];
	for (const r of rows(csv)) {
		const [y, m, d] = r.slice(0, 3).map(Number);
		const ppm = Number(r[r.length - 1]);
		if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) || !(ppm > 0)) continue;
		out.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, ppm });
	}
	return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Días entre dos fechas «YYYY-MM-DD». */
function daysBetween(a: string, b: string): number {
	return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** La medida del mismo día un año antes; si ese día falta, la más cercana a ±`slack` días. */
export function yearAgo(days: Co2Day[], date: string, slack = 7): Co2Day | null {
	const target = `${Number(date.slice(0, 4)) - 1}${date.slice(4)}`;
	let best: Co2Day | null = null;
	for (const d of days) {
		const gap = Math.abs(daysBetween(d.date, target));
		if (gap <= slack && (!best || gap < Math.abs(daysBetween(best.date, target)))) best = d;
	}
	return best;
}

/** Lo que se guarda de ERA5: el último día y su puesto. */
export function summarizeTemp(days: TempDay[]): ClimateData['temp'] {
	const last = days.at(-1);
	if (!last) return null;
	const rank = rankDay(days, last.date);
	if (!rank) return null;
	return {
		...last,
		...rank,
		since: Number(days[0].date.slice(0, 4))
	};
}

/** Lo que se guarda del CO₂: la última medida y la de hace un año. */
export function summarizeCo2(days: Co2Day[]): ClimateData['co2'] {
	const last = days.at(-1);
	return last ? { ...last, yearAgo: yearAgo(days, last.date) } : null;
}
