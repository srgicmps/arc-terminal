// Bureau of Labor Statistics (EE. UU.): API pública v1, sin clave (máx. 25 consultas al día,
// por eso se refresca cada 6 horas). https://www.bls.gov/developers/ · Dominio público.
import type { Point, Series, SeriesData } from '../../src/lib/types.ts';
import { num, request, type Source } from '../lib.ts';

const API = 'https://api.bls.gov/publicAPI/v1/timeseries/data/';

const CPI = 'CUUR0000SA0'; // IPC, todos los artículos, sin desestacionalizar
const CORE_CPI = 'CUUR0000SA0L1E'; // IPC sin alimentos ni energía
const UNEMPLOYMENT = 'LNS14000000'; // Tasa de paro
const PAYROLLS = 'CES0000000001'; // Empleo no agrícola (miles)

type RawPoint = { year: string; period: string; value: string };

function monthly(data: RawPoint[]): Point[] {
	return data
		.filter((d) => /^M(0[1-9]|1[0-2])$/.test(d.period))
		.map((d) => ({ t: `${d.year}-${d.period.slice(1)}`, v: num(d.value) }))
		.filter((p): p is Point => p.v !== null)
		.sort((a, b) => a.t.localeCompare(b.t));
}

/** Variación interanual de un índice: (mes / mismo mes del año anterior − 1) × 100. */
function yoy(points: Point[]): Point[] {
	const byMonth = new Map(points.map((p) => [p.t, p.v]));
	return points.flatMap((p) => {
		const prev = byMonth.get(`${Number(p.t.slice(0, 4)) - 1}${p.t.slice(4)}`);
		return prev ? [{ t: p.t, v: Math.round((p.v / prev - 1) * 1000) / 10 }] : [];
	});
}

/** Diferencia con el mes anterior (para el empleo: puestos creados en el mes, en miles). */
function change(points: Point[]): Point[] {
	return points.slice(1).map((p, i) => ({ t: p.t, v: Math.round(p.v - points[i].v) }));
}

const url = (id: string) => `https://data.bls.gov/timeseries/${id}`;

export const bls: Source<SeriesData> = {
	name: 'bls',
	label: 'Inflación, paro y empleo · Bureau of Labor Statistics (EE. UU.)',
	maxAgeMinutes: 355,
	async fetch() {
		const res = await request(API, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ seriesid: [CPI, CORE_CPI, UNEMPLOYMENT, PAYROLLS] })
		});
		const body = (await res.json()) as {
			status: string;
			message?: string[];
			Results?: { series: { seriesID: string; data: RawPoint[] }[] };
		};
		if (body.status !== 'REQUEST_SUCCEEDED') throw new Error(body.message?.join(' ') || body.status);
		const raw = new Map((body.Results?.series ?? []).map((s) => [s.seriesID, monthly(s.data)]));
		const get = (id: string) => raw.get(id) ?? [];

		const series: Series[] = [
			{ id: 'cpi-us', label: 'Inflación (IPC)', unit: '%', geo: 'US', points: yoy(get(CPI)), source: 'BLS', url: url(CPI) },
			{ id: 'core-cpi-us', label: 'Inflación subyacente', unit: '%', geo: 'US', points: yoy(get(CORE_CPI)), source: 'BLS', url: url(CORE_CPI) },
			{ id: 'unemployment-us', label: 'Paro', unit: '%', geo: 'US', points: get(UNEMPLOYMENT), source: 'BLS', url: url(UNEMPLOYMENT) },
			{ id: 'payrolls-us', label: 'Empleo no agrícola, mensual', unit: 'miles', geo: 'US', points: change(get(PAYROLLS)), source: 'BLS', url: url(PAYROLLS) }
		].filter((s) => s.points.length);
		if (!series.length) throw new Error('el BLS no ha devuelto datos');
		return { series };
	}
};
