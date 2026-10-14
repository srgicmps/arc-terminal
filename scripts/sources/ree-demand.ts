// Demanda eléctrica nacional en tiempo real según Red Eléctrica (REE): la real, cada 5 minutos, frente a
// la prevista. Si la real cae muy por debajo de la prevista de golpe, es señal de un apagón (como el del
// 28 de abril de 2025). https://www.ree.es/es/apidatos · Sin clave · Reutilización libre citando a REE;
// no publican límite por IP. Se pide cada 10 minutos.
import { getJson, list, madridDate, num, type Source } from '../lib.ts';

type Raw = Record<string, any>;

export interface DemandPoint {
	/** Hora del dato en ISO (UTC). */
	time: string;
	real: number | null;
	forecast: number | null;
}

export interface DemandData {
	/** Último dato con demanda real y su prevista, en MW. */
	time: string;
	real: number;
	forecast: number | null;
	scheduled: number | null;
	/** Cuánto está la real por debajo (+) o por encima (−) de la prevista, en %. */
	gap: number | null;
	/** Las dos últimas horas, para ver si la caída es brusca o progresiva. */
	recent: DemandPoint[];
}

const day = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

/**
 * Desde ayer a las 00:00 hasta hoy a las 23:59 (hora de Madrid): así, a medianoche sigue habiendo datos.
 * Aunque pida `time_trunc=hour`, esta serie viene siempre cada 5 minutos. Se deja
 * porque las demás series de apidatos lo piden.
 */
export const demandUrl = () =>
	'https://apidatos.ree.es/es/datos/demanda/demanda-tiempo-real?' +
	new URLSearchParams({ start_date: `${day(madridDate(-1))}T00:00`, end_date: `${day(madridDate(0))}T23:59`, time_trunc: 'hour' });

/** Serie por título («Real», «Prevista», «Programada») → valores por instante (ms). */
function series(body: Raw, title: RegExp): Map<number, number> {
	const found = list<Raw>(body?.included).find((s) => title.test(String(s?.attributes?.title ?? s?.type ?? '')));
	const out = new Map<number, number>();
	for (const v of list<Raw>(found?.attributes?.values)) {
		const t = Date.parse(v?.datetime ?? '');
		const value = num(v?.value);
		if (Number.isFinite(t) && value !== null) out.set(t, value);
	}
	return out;
}

const RECENT = 24; // 24 puntos de 5 minutos = 2 horas

export function parseDemand(body: Raw): DemandData {
	const real = series(body, /^real/i);
	const forecast = series(body, /^prevista/i);
	const scheduled = series(body, /^programada/i);
	const times = [...real.keys()].sort((a, b) => a - b);
	const last = times.at(-1);
	if (last === undefined) throw new Error('REE no da ningún dato de demanda real');
	const r = real.get(last)!;
	const f = forecast.get(last) ?? null;
	return {
		time: new Date(last).toISOString(),
		real: r,
		forecast: f,
		scheduled: scheduled.get(last) ?? null,
		gap: f ? Math.round((1 - r / f) * 1000) / 10 : null,
		recent: times.slice(-RECENT).map((t) => ({ time: new Date(t).toISOString(), real: real.get(t) ?? null, forecast: forecast.get(t) ?? null }))
	};
}

export const reeDemand: Source<DemandData> = {
	name: 'ree-demand',
	label: 'Demanda eléctrica en tiempo real, real frente a prevista · Red Eléctrica',
	maxAgeMinutes: 10,
	async fetch() {
		return parseDemand(await getJson<Raw>(demandUrl()));
	}
};
