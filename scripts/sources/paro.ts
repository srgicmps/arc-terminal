// Paro registrado del SEPE por comunidad autónoma, mensual. Sale del CSV de datos abiertos «Paro por municipios»
// (uno por año, en latin1 y con «;»): una fila por mes y municipio («202601;Enero de 2026;1;Andalucía;4;Almería;
// 04001;Abla;65;…»). Se suman los municipios de cada comunidad. Para no identificar a nadie, el SEPE escribe «<5»
// en vez de las cifras pequeñas: se cuentan como 2, así que el total sale aproximado (difiere en unas centenas).
// Se baja el año en curso y el anterior, para la variación anual. Datos abiertos: reutilización citando la fuente.
import type { ParoData, ParoRegion } from '../../src/lib/paro.ts';
import { request, type Source } from '../lib.ts';

const URL = (year: number) =>
	`https://sede.sepe.gob.es/es/portaltrabaja/resources/sede/datos_abiertos/datos/Paro_por_municipios_${year}_csv.csv`;

/** Nombres cortos por código de comunidad del INE (el CSV los trae largos y en latin1). */
const NAMES: Record<number, string> = {
	1: 'Andalucía',
	2: 'Aragón',
	3: 'Asturias',
	4: 'Baleares',
	5: 'Canarias',
	6: 'Cantabria',
	7: 'Castilla y León',
	8: 'Castilla-La Mancha',
	9: 'Cataluña',
	10: 'C. Valenciana',
	11: 'Extremadura',
	12: 'Galicia',
	13: 'Madrid',
	14: 'Murcia',
	15: 'Navarra',
	16: 'País Vasco',
	17: 'La Rioja',
	18: 'Ceuta',
	19: 'Melilla'
};

/** Totales por mes («2026-01») y comunidad (código del INE). */
export type Totals = Map<string, Map<number, number>>;

/** Suma el «total Paro Registrado» (9.ª columna) de los municipios de cada comunidad y mes. */
export function sumCsv(csv: string, into: Totals = new Map()): Totals {
	for (const line of csv.split(/\r?\n/)) {
		const cells = line.split(';');
		const m = cells[0]?.trim().match(/^(\d{4})(\d{2})$/);
		const code = Number(cells[2]);
		if (!m || !Number.isInteger(code) || code < 1) continue;
		const raw = (cells[8] ?? '').trim();
		const value = raw === '<5' ? 2 : Number(raw.replace(/\./g, ''));
		if (!Number.isFinite(value)) continue;
		const month = `${m[1]}-${m[2]}`;
		const byRegion = into.get(month) ?? new Map<number, number>();
		byRegion.set(code, (byRegion.get(code) ?? 0) + value);
		into.set(month, byRegion);
	}
	return into;
}

const pct = (now: number, before: number | undefined) =>
	before ? Math.round(((now - before) / before) * 1000) / 10 : null;

/** Del total por mes y comunidad, el último mes con sus variaciones y la serie de España. */
export function buildParo(totals: Totals): ParoData | null {
	const months = [...totals.keys()].sort();
	const month = months.at(-1);
	if (!month) return null;
	const prev = totals.get(months.at(-2) ?? '');
	const lastYear = totals.get(`${Number(month.slice(0, 4)) - 1}${month.slice(4)}`);
	const regions: ParoRegion[] = [...totals.get(month)!].map(([code, value]) => ({
		code,
		name: NAMES[code] ?? `Comunidad ${code}`,
		value,
		mom: pct(value, prev?.get(code)),
		yoy: pct(value, lastYear?.get(code))
	}));
	regions.sort((a, b) => b.value - a.value);
	const national = months.map((t) => ({ t, v: [...totals.get(t)!.values()].reduce((a, b) => a + b, 0) }));
	return { month, national, regions };
}

async function download(year: number): Promise<string | null> {
	try {
		const res = await request(URL(year));
		return new TextDecoder('latin1').decode(await res.arrayBuffer());
	} catch (error) {
		console.log(`  paro · sin el CSV de ${year}: ${(error as Error).message}`);
		return null;
	}
}

export const paro: Source<ParoData> = {
	name: 'paro',
	label: 'Paro registrado por comunidad autónoma · SEPE (datos abiertos)',
	maxAgeMinutes: 720,
	minItems: 17,
	deadlineMs: 180_000,
	async fetch() {
		const year = new Date().getUTCFullYear();
		// En enero y febrero el CSV del año aún no trae (o casi) meses: el último dato es de diciembre y, para
		// compararlo con hace un año, hace falta también el de hace dos.
		const early = new Date().getUTCMonth() < 2;
		const [current, previous, older] = await Promise.all([download(year), download(year - 1), early ? download(year - 2) : null]);
		const totals = sumCsv(older ?? '');
		sumCsv(previous ?? '', totals);
		sumCsv(current ?? '', totals);
		const data = buildParo(totals);
		if (!data || data.regions.length < 17) throw new Error('El CSV del SEPE no trae el paro por comunidades');
		const last = data.national.at(-1)!;
		console.log(`  paro · ${last.t} = ${last.v} parados en ${data.regions.length} comunidades`);
		return data;
	}
};
