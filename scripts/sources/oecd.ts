// Inflación del G20: IPC general, variación interanual mensual, de cada país del G20 y del G20 entero.
// OCDE, dataflow OECD.SDD.TPS,DSD_G20_PRICES@DF_G20_PRICES (SDMX, sin clave). https://sdmx.oecd.org
// La OCDE limita las descargas por IP (20–60 por hora), así que se baja una vez al día. Si su API falla
// (a veces responde 500 a los runners de GitHub), se usa la copia del mismo dataset en DBnomics
// (https://db.nomics.world, agregador abierto y sin clave). La nota de ECO dice de dónde salió el dato.
import type { G20Data, Point, Series } from '../../src/lib/types.ts';
import { parseCsv } from '../csv.ts';
import { getJson, getText, num, type Source } from '../lib.ts';

const FLOW = 'OECD.SDD.TPS,DSD_G20_PRICES@DF_G20_PRICES,1.0';

/** Países del G20 (y el G20 entero), por su código ISO de la OCDE. */
export const AREAS: Record<string, string> = {
	G20: 'G20',
	ARG: 'Argentina',
	AUS: 'Australia',
	BRA: 'Brasil',
	CAN: 'Canadá',
	CHN: 'China',
	FRA: 'Francia',
	DEU: 'Alemania',
	IND: 'India',
	IDN: 'Indonesia',
	ITA: 'Italia',
	JPN: 'Japón',
	KOR: 'Corea del Sur',
	MEX: 'México',
	RUS: 'Rusia',
	SAU: 'Arabia Saudí',
	ZAF: 'Sudáfrica',
	TUR: 'Turquía',
	GBR: 'Reino Unido',
	USA: 'EE. UU.',
	EU27_2020: 'Unión Europea'
};

/** Cuántos meses se guardan de cada país: 13, para la variación y un minigráfico de un año. */
const KEEP = 13;

function toSeries(area: string, points: Point[], via: G20Data['via']): Series {
	return {
		id: `g20cpi-${area.toLowerCase()}`,
		label: AREAS[area],
		unit: '%',
		points: points.sort((a, b) => a.t.localeCompare(b.t)).slice(-KEEP),
		source: via === 'oecd' ? 'OCDE' : 'OCDE vía DBnomics',
		url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_G20_PRICES%40DF_G20_PRICES&df[ag]=OECD.SDD.TPS'
	};
}

/** «2026-04» menos 12 meses: «2025-04». */
const yearBefore = (t: string) => `${Number(t.slice(0, 4)) - 1}${t.slice(4)}`;

/**
 * Ordena como AREAS (el G20 primero) y descarta los países sin datos o con el último dato más de un año
 * más viejo que el más reciente de todos (Rusia dejó de publicarse en 2022).
 */
function ordered(byArea: Map<string, Point[]>, via: G20Data['via']): Series[] {
	const series = Object.keys(AREAS).flatMap((area) => {
		const points = byArea.get(area);
		return points?.length ? [toSeries(area, points, via)] : [];
	});
	const newest = series.map((s) => s.points.at(-1)!.t).sort().at(-1) ?? '';
	return series.filter((s) => s.points.at(-1)!.t >= yearBefore(newest));
}

/** CSV SDMX de la OCDE: una fila por país y mes (REF_AREA, TIME_PERIOD, OBS_VALUE). */
export function parseOecd(csv: string): Map<string, Point[]> {
	// Por país y metodología: algunos países traen la nacional (N) y la armonizada.
	const groups = new Map<string, Map<string, Point[]>>();
	for (const r of parseCsv(csv)) {
		const v = num(r.OBS_VALUE);
		if (!(r.REF_AREA in AREAS) || !/^\d{4}-\d{2}$/.test(r.TIME_PERIOD ?? '') || v === null) continue;
		const byMethod = groups.get(r.REF_AREA) ?? new Map<string, Point[]>();
		const method = r.METHODOLOGY || 'N';
		byMethod.set(method, [...(byMethod.get(method) ?? []), { t: r.TIME_PERIOD, v }]);
		groups.set(r.REF_AREA, byMethod);
	}
	// La nacional si la hay; si no, la primera que venga.
	return new Map([...groups].map(([area, byMethod]) => [area, byMethod.get('N') ?? [...byMethod.values()][0]]));
}

interface DbnomicsDoc {
	dimensions?: Record<string, string>;
	period?: string[];
	value?: (number | string | null)[];
}

/** Respuesta de DBnomics: una serie por país con sus periodos y valores en dos listas paralelas. */
export function parseDbnomics(body: { series?: { docs?: DbnomicsDoc[] } }): Map<string, Point[]> {
	const byArea = new Map<string, Point[]>();
	const docs = [...(body.series?.docs ?? [])]
		// La metodología nacional (N) primero: si hay dos series del mismo país, gana esa.
		.sort((a, b) => Number(b.dimensions?.METHODOLOGY === 'N') - Number(a.dimensions?.METHODOLOGY === 'N'));
	for (const doc of docs) {
		const area = doc.dimensions?.REF_AREA ?? '';
		if (!(area in AREAS) || byArea.has(area)) continue;
		const points = (doc.period ?? []).flatMap((t, i) => {
			const v = num(doc.value?.[i]);
			return /^\d{4}-\d{2}$/.test(t) && v !== null ? [{ t, v }] : [];
		});
		if (points.length) byArea.set(area, points.slice(-KEEP));
	}
	return byArea;
}

async function fromOecd(): Promise<Map<string, Point[]>> {
	const start = new Date();
	start.setUTCMonth(start.getUTCMonth() - 18);
	const url =
		`https://sdmx.oecd.org/public/rest/data/${FLOW}/.M..CPI.PA._T.N.GY` +
		`?startPeriod=${start.toISOString().slice(0, 7)}&dimensionAtObservation=AllDimensions&format=csvfile`;
	return parseOecd(await getText(url, { headers: { Accept: 'application/vnd.sdmx.data+csv; charset=utf-8' } }));
}

async function fromDbnomics(): Promise<Map<string, Point[]>> {
	const dims = JSON.stringify({ FREQ: ['M'], MEASURE: ['CPI'], TRANSFORMATION: ['GY'] });
	const url =
		`https://api.db.nomics.world/v22/series/OECD/DSD_G20_PRICES@DF_G20_PRICES` +
		`?dimensions=${encodeURIComponent(dims)}&observations=1&metadata=false&limit=100`;
	return parseDbnomics(await getJson(url));
}

export const oecd: Source<G20Data> = {
	name: 'oecd',
	label: 'Inflación del G20 · OCDE (o su copia en DBnomics)',
	// Una vez al día: la OCDE limita las descargas por IP.
	maxAgeMinutes: 1435,
	async fetch() {
		try {
			const series = ordered(await fromOecd(), 'oecd');
			// Con menos de 10 países la respuesta no es buena: se prueba la copia.
			if (series.length >= 10) return { series, via: 'oecd' };
			console.log(`  oecd: solo ${series.length} países en la OCDE, se prueba DBnomics`);
		} catch (error) {
			console.log(`  oecd: la OCDE falla (${error instanceof Error ? error.message : error}), se prueba DBnomics`);
		}
		const series = ordered(await fromDbnomics().catch(() => new Map<string, Point[]>()), 'dbnomics');
		if (!series.length) throw new Error('ni la OCDE ni DBnomics devuelven la inflación del G20');
		return { series, via: 'dbnomics' };
	}
};
