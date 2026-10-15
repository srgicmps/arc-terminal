// Ofertas de empleo publicadas en Indeed por país (Indeed Hiring Lab), sin clave. PROVISIONAL (lote 23.5, D35).
// https://github.com/hiring-lab/job_postings_tracker · Licencia CC BY 4.0: hay que citar «Indeed Hiring Lab».
// Un CSV diario por país con el índice de ofertas (1 feb. 2020 = 100), desestacionalizado (SA) y sin
// desestacionalizar (NSA), para el total de ofertas y para las nuevas. Se guarda solo el total desestacionalizado,
// un punto por semana (el último día publicado de cada una) de los dos últimos años: el último punto es el último día.
// Para quitarlo: este archivo, su test, IndeedPanel.svelte y las líneas «indeed» de ECO y PAIS.
import { parseCsv } from '../csv.ts';
import { getText, num, settle, type Source } from '../lib.ts';
import type { Point, Series, SeriesData } from '../../src/lib/types.ts';

const REPO = 'https://raw.githubusercontent.com/hiring-lab/job_postings_tracker/master';
const PAGE = 'https://github.com/hiring-lab/job_postings_tracker';

/** Países (y zona euro) que publica Hiring Lab, con su nombre en español. EA no es un país: solo sale en ECO. */
export const INDEED_GEOS: [string, string][] = [
	['ES', 'España'],
	['EA', 'Zona euro'],
	['DE', 'Alemania'],
	['FR', 'Francia'],
	['IT', 'Italia'],
	['NL', 'Países Bajos'],
	['IE', 'Irlanda'],
	['GB', 'Reino Unido'],
	['US', 'EE. UU.'],
	['CA', 'Canadá'],
	['AU', 'Australia']
];

/** Días de historia que se guardan (dos años y una semana, para comparar con hace un año con margen). */
const KEEP_DAYS = 2 * 365 + 7;

export const indeedUrl = (cc: string) => `${REPO}/${cc}/aggregate_job_postings_${cc}.csv`;

/** Lunes de la semana de un día «YYYY-MM-DD» (semana ISO), para agrupar. */
function monday(day: string): string {
	const d = new Date(`${day}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
	return d.toISOString().slice(0, 10);
}

/**
 * Del CSV, el índice desestacionalizado del total de ofertas: un punto por semana (el último día de cada una)
 * de los últimos `keepDays` días contados desde el último dato, del más antiguo al más reciente.
 */
export function parseIndeed(text: string, keepDays = KEEP_DAYS): Point[] {
	const daily = parseCsv(text)
		.filter((r) => r.variable?.trim() === 'total postings' && /^\d{4}-\d{2}-\d{2}$/.test(r.date ?? ''))
		.map((r) => ({ t: r.date, v: num(r.indeed_job_postings_index_SA) }))
		.filter((p): p is Point => p.v !== null && Number.isFinite(p.v))
		.sort((a, b) => a.t.localeCompare(b.t));
	const lastDay = daily.at(-1)?.t;
	if (!lastDay) return [];
	const from = new Date(Date.parse(`${lastDay}T12:00:00Z`) - keepDays * 86_400_000).toISOString().slice(0, 10);
	const weeks = new Map<string, Point>();
	for (const p of daily) if (p.t >= from) weeks.set(monday(p.t), { t: p.t, v: Math.round(p.v * 100) / 100 });
	return [...weeks.values()];
}

export const indeed: Source<SeriesData> = {
	name: 'indeed',
	label: 'Ofertas de empleo · Indeed Hiring Lab',
	// Hiring Lab actualiza los CSV una vez al día (más o menos).
	maxAgeMinutes: 720,
	minItems: 6,
	async fetch() {
		const series = await settle('indeed', INDEED_GEOS, ([cc]) => cc, async ([cc, name]): Promise<Series | null> => {
			const points = parseIndeed(await getText(indeedUrl(cc)));
			if (!points.length) return null;
			return { id: `indeed-${cc.toLowerCase()}`, label: name, unit: 'índice', geo: cc, points, source: 'Indeed Hiring Lab', url: PAGE };
		});
		if (!series.length) throw new Error('ningún CSV de Indeed Hiring Lab trae datos');
		return { series };
	}
};
