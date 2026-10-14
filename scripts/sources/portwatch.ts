// Tránsitos diarios por los pasos marítimos clave, de IMF PortWatch (FMI y Universidad de Oxford):
// servicio ArcGIS público «Daily_Chokepoints_Data», sin clave. Es una estimación a partir de señales
// AIS y llega con unos 5 días de retraso.
import type { Chokepoint } from '../../src/lib/types.ts';
import { getJson, list, type Source } from '../lib.ts';

type Raw = Record<string, any>;

const SERVICE =
	'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query';

/** Los pasos que se siguen, con el portid del propio servicio. */
export const CHOKEPOINTS: { id: string; name: string }[] = [
	{ id: 'chokepoint6', name: 'Ormuz' },
	{ id: 'chokepoint1', name: 'Canal de Suez' },
	{ id: 'chokepoint4', name: 'Bab el-Mandeb' },
	{ id: 'chokepoint2', name: 'Canal de Panamá' },
	{ id: 'chokepoint5', name: 'Malaca' },
	{ id: 'chokepoint3', name: 'Bósforo' }
];

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** La fecha llega como «2026-10-09» (campo DateOnly) o, en servicios antiguos, en milisegundos. */
function day(value: unknown): string | null {
	if (typeof value === 'number') return iso(value);
	const m = String(value ?? '').match(/^\d{4}-\d{2}-\d{2}/);
	return m ? m[0] : null;
}

/** URL de una consulta: tránsitos totales de los pasos entre dos fechas (incluidas). */
export function queryUrl(from: string, to: string, offset = 0): string {
	const ids = CHOKEPOINTS.map((c) => `'${c.id}'`).join(',');
	const where = `portid IN (${ids}) AND date >= DATE '${from}' AND date <= DATE '${to}'`;
	const params = new URLSearchParams({
		where,
		outFields: 'date,portid,n_total',
		orderByFields: 'date',
		returnGeometry: 'false',
		resultOffset: String(offset),
		resultRecordCount: '2000',
		f: 'json'
	});
	return `${SERVICE}?${params}`;
}

/** Descarga todas las filas de una consulta, página a página (ArcGIS corta en 2000). */
async function rows(from: string, to: string): Promise<{ date: string; id: string; n: number }[]> {
	const out: { date: string; id: string; n: number }[] = [];
	for (let page = 0; page < 10; page++) {
		const body = await getJson<Raw>(queryUrl(from, to, out.length));
		if (body?.error) throw new Error(`PortWatch: ${body.error.message ?? JSON.stringify(body.error)}`);
		const features = list<Raw>(body?.features);
		for (const f of features) {
			const a = f?.attributes ?? {};
			const date = day(a.date);
			const n = Number(a.n_total);
			if (date && a.portid && Number.isFinite(n)) out.push({ date, id: String(a.portid), n });
		}
		if (!body?.exceededTransferLimit || !features.length) break;
	}
	return out;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/** Con las filas de los últimos ~97 días y las del año anterior, las cifras de cada paso. */
export function summarize(recent: { date: string; id: string; n: number }[], lastYear: { date: string; id: string; n: number }[]): Chokepoint[] {
	return CHOKEPOINTS.flatMap(({ id, name }) => {
		const days = recent.filter((r) => r.id === id).sort((a, b) => a.date.localeCompare(b.date));
		if (!days.length) return [];
		const last = days.at(-1)!.date;
		const lastT = Date.parse(`${last}T00:00:00Z`);
		// Últimos 7 días con datos y los mismos 7 días de calendario un año antes.
		const week = days.filter((d) => Date.parse(`${d.date}T00:00:00Z`) > lastT - 7 * DAY);
		const from = iso(lastT - 365 * DAY - 6 * DAY);
		const to = iso(lastT - 365 * DAY);
		const prev = lastYear.filter((r) => r.id === id && r.date >= from && r.date <= to);
		const avg7 = mean(week.map((d) => d.n)) ?? 0;
		const avg7PrevYear = prev.length >= 4 ? mean(prev.map((d) => d.n)) : null;
		// Media móvil de 7 días de los últimos 90 días.
		const values = days.map((d) => d.n);
		const spark = values
			.map((_, i) => (i >= 6 ? mean(values.slice(i - 6, i + 1))! : null))
			.filter((v): v is number => v !== null)
			.slice(-90)
			.map((v) => Math.round(v * 10) / 10);
		return [
			{
				id,
				name,
				last,
				avg7: Math.round(avg7 * 10) / 10,
				avg7PrevYear: avg7PrevYear === null ? null : Math.round(avg7PrevYear * 10) / 10,
				change: avg7PrevYear ? Math.round(((avg7 - avg7PrevYear) / avg7PrevYear) * 1000) / 10 : null,
				spark
			}
		];
	});
}

export const portwatch: Source<Chokepoint[]> = {
	name: 'portwatch',
	label: 'Rutas marítimas clave (Ormuz, Suez, Panamá…) · IMF PortWatch',
	// Los datos son diarios y llegan con días de retraso: cada 6 h basta.
	maxAgeMinutes: 360,
	async fetch() {
		const now = Date.now();
		// 97 días: 90 para el minigráfico más 6 para empezar la media móvil.
		const recent = await rows(iso(now - 97 * DAY), iso(now));
		if (!recent.length) throw new Error('PortWatch no devuelve tránsitos recientes');
		const last = recent.reduce((m, r) => (r.date > m ? r.date : m), '');
		const lastT = Date.parse(`${last}T00:00:00Z`);
		const lastYear = await rows(iso(lastT - 372 * DAY), iso(lastT - 365 * DAY));
		return summarize(recent, lastYear);
	}
};
