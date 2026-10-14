// Reserva de agua de los embalses de España (MITECO, Boletín Hidrológico semanal). El Ministerio publica
// cada semana un ZIP con una base de datos Access (BD-Embalses.mdb) con el agua embalsada desde 1988
// en los embalses peninsulares de más de 5 hm³. Datos «sin validación» según el propio MITECO.
// https://www.miteco.gob.es/es/agua/temas/evaluacion-de-los-recursos-hidricos/boletin-hidrologico.html
import { unzipSync } from 'fflate';
import MDBReader from 'mdb-reader';
import type { WaterData } from '../../src/lib/types.ts';
import { request, type Source } from '../lib.ts';

const ZIP =
	'https://www.miteco.gob.es/content/dam/miteco/es/agua/temas/evaluacion-de-los-recursos-hidricos/' +
	'boletin-hidrologico/Historico-de-embalses/BD-Embalses.zip';

type Row = Record<string, unknown>;

/** Busca la columna cuyo nombre encaja (los nombres pueden variar entre versiones del archivo). */
const column = (names: string[], re: RegExp) => names.find((n) => re.test(n));

const num = (v: unknown) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.')));
const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').slice(0, 10));
const pct = (actual: number, total: number) => Math.round((actual / total) * 1000) / 10;

export const water: Source<WaterData> = {
	name: 'water',
	label: 'Reserva de agua de los embalses de España · MITECO',
	// El MITECO lo actualiza una vez por semana (los martes): con mirar cada 12 horas sobra.
	maxAgeMinutes: 715,
	async fetch() {
		const t0 = Date.now();
		const zip = unzipSync(new Uint8Array(await (await request(ZIP)).arrayBuffer()));
		const t1 = Date.now();
		const mdbName = Object.keys(zip).find((n) => /\.mdb$/i.test(n));
		if (!mdbName) throw new Error(`el ZIP no trae .mdb: ${Object.keys(zip).join(', ')}`);
		const db = new MDBReader(Buffer.from(zip[mdbName]));

		// La tabla de datos es la que tiene fecha, agua actual y capacidad total.
		const tables = db.getTableNames();
		const table = tables
			.map((name) => db.getTable(name))
			.find((t) => {
				const cols = t.getColumnNames();
				return column(cols, /fecha/i) && column(cols, /agua_?actual/i) && column(cols, /agua_?total/i);
			});
		if (!table) {
			const schema = tables.map((n) => `${n}: ${db.getTable(n).getColumnNames().join(', ')}`).join(' | ');
			throw new Error(`no encuentro la tabla de embalses. Tablas: ${schema}`);
		}
		const cols = table.getColumnNames();
		const cDate = column(cols, /fecha/i)!;
		const cNow = column(cols, /agua_?actual/i)!;
		const cTotal = column(cols, /agua_?total/i)!;
		const cBasin = column(cols, /ambito|cuenca/i);

		// Suma de todos los embalses por semana (y por cuenca en la última semana).
		const byDate = new Map<string, { now: number; total: number }>();
		// Solo las columnas que se usan: leer la tabla entera es lo que más tarda.
		const rows = table.getData({ columns: [cDate, cNow, cTotal, ...(cBasin ? [cBasin] : [])] }) as Row[];
		console.log(`  water · descarga ${Math.round((t1 - t0) / 1000)} s, lectura ${Math.round((Date.now() - t1) / 1000)} s, ${rows.length} filas`);
		for (const r of rows) {
			const date = day(r[cDate]);
			const now = num(r[cNow]);
			const total = num(r[cTotal]);
			if (!date || !Number.isFinite(now) || !Number.isFinite(total) || total <= 0) continue;
			const acc = byDate.get(date) ?? { now: 0, total: 0 };
			acc.now += now;
			acc.total += total;
			byDate.set(date, acc);
		}
		const dates = [...byDate.keys()].sort();
		const last = dates.at(-1);
		if (!last) throw new Error('la tabla de embalses está vacía');
		const latest = byDate.get(last)!;

		// La misma semana de hace un año (la fecha más cercana) y la media de esa semana en los 10 años anteriores.
		const ms = (d: string) => Date.parse(`${d}T12:00:00Z`);
		const near = (target: number) =>
			dates.reduce((best, d) => (Math.abs(ms(d) - target) < Math.abs(ms(best) - target) ? d : best), dates[0]);
		const yearAgo = (n: number) => near(ms(last) - n * 365.25 * 86_400_000);
		const share = (d: string) => pct(byDate.get(d)!.now, byDate.get(d)!.total);
		const tenYears = Array.from({ length: 10 }, (_, i) => share(yearAgo(i + 1)));

		const basins = cBasin
			? [
					...rows
						.filter((r) => day(r[cDate]) === last)
						.reduce((m, r) => {
							const name = String(r[cBasin] ?? '').trim();
							const acc = m.get(name) ?? { now: 0, total: 0 };
							acc.now += num(r[cNow]) || 0;
							acc.total += num(r[cTotal]) || 0;
							return m.set(name, acc);
						}, new Map<string, { now: number; total: number }>())
				]
					.filter(([name, v]) => name && v.total > 0)
					.map(([name, v]) => ({ name, hm3: Math.round(v.now), capacity: Math.round(v.total), pct: pct(v.now, v.total) }))
					.sort((a, b) => a.pct - b.pct)
			: [];

		// Historial semanal de los últimos 10 años, en % (unas 520 semanas: poco peso).
		const since = new Date(ms(last) - 10 * 365.25 * 86_400_000).toISOString().slice(0, 10);
		return {
			date: last,
			hm3: Math.round(latest.now),
			capacity: Math.round(latest.total),
			pct: pct(latest.now, latest.total),
			yearAgo: share(yearAgo(1)),
			avg10: Math.round((tenYears.reduce((a, b) => a + b, 0) / tenYears.length) * 10) / 10,
			history: dates.filter((d) => d >= since).map((d) => ({ t: d, v: share(d) })),
			basins
		};
	}
};
