// INE: IPC, paro (EPA) y turistas internacionales, de España y de Baleares. API JSON de INEbase (Tempus),
// sin clave. https://www.ine.es/dyngs/DataLab/manual.html?cid=45 · Reutilización libre citando al INE.
import type { Point, Series, SeriesData } from '../../src/lib/types.ts';
import { getJson, list, settle, type Source } from '../lib.ts';

type Raw = Record<string, any>;

interface Wanted {
	/** Código de la serie en INEbase. */
	code: string;
	id: string;
	label: string;
	unit: string;
	geo: 'ES' | 'IB';
	/** Divide cada valor (para pasar personas a miles). */
	scale?: number;
	/** Tabla de INEbase donde consultarla en la web. */
	table: number;
}

// Series vigentes, comprobadas con el sondeo de los PR. El IPC está en base 2025 (las de base 2021
// terminan en diciembre de 2025).
const WANTED: Wanted[] = [
	{ code: 'IPC290750', id: 'ipc-es', label: 'IPC, variación anual', unit: '%', geo: 'ES', table: 76134 },
	{ code: 'IPC293827', id: 'ipc-ib', label: 'IPC, variación anual', unit: '%', geo: 'IB', table: 76136 },
	{ code: 'EPA_ES', id: 'paro-es', label: 'Tasa de paro (EPA)', unit: '%', geo: 'ES', table: 14506 },
	{ code: 'EPA_IB', id: 'paro-ib', label: 'Tasa de paro (EPA)', unit: '%', geo: 'IB', table: 14506 },
	{
		code: 'FREG350',
		id: 'turistas-ib',
		label: 'Turistas internacionales',
		unit: 'miles',
		geo: 'IB',
		scale: 1000,
		table: 10823
	}
];

/** Periodo de un dato del INE: «2026-09» si es mensual, «2026-Q2» si es trimestral. */
function periodOf(d: Raw): string | null {
	const year = Number(d.Anyo);
	const p = Number(d.FK_Periodo);
	if (!year || !p) return null;
	if (p >= 1 && p <= 12) return `${year}-${String(p).padStart(2, '0')}`;
	// En el INE, los trimestres son los periodos 19 a 22.
	if (p >= 19 && p <= 22) return `${year}-Q${p - 18}`;
	return null;
}

async function fetchSeries(w: Wanted): Promise<Series | null> {
	const body = await getJson<Raw>(`https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE/${w.code}?nult=25`);
	const points: Point[] = list<Raw>(body.Data)
		.filter((d) => !d.Secreto && typeof d.Valor === 'number')
		.flatMap((d) => {
			const t = periodOf(d);
			return t ? [{ t, v: w.scale ? d.Valor / w.scale : d.Valor }] : [];
		})
		.sort((a, b) => a.t.localeCompare(b.t));
	if (!points.length) return null;
	return {
		id: w.id,
		label: w.label,
		unit: w.unit,
		geo: w.geo,
		points,
		source: 'INE',
		url: `https://www.ine.es/jaxiT3/Tabla.htm?t=${w.table}`
	};
}

export const ine: Source<SeriesData> = {
	name: 'ine',
	label: 'IPC, paro (EPA) y turistas, de España y Baleares · INE',
	// El INE publica una vez al mes: con mirar cada 6 horas sobra.
	maxAgeMinutes: 355,
	async fetch() {
		const series = await settle('ine', WANTED, (w) => `${w.code} (${w.id})`, fetchSeries);
		if (!series.length) throw new Error('ninguna serie del INE');
		return { series };
	}
};
