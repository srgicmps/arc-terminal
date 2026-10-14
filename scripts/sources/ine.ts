// Instituto Nacional de Estadística: API JSON «wstempus» (sin clave). https://www.ine.es/dyngs/DataLab/manual.html
// Reutilización libre citando la fuente. Desde 2026 el IPC va en base 2025 (COICOP 2018): las series
// antiguas (IPC251856…) terminan en diciembre de 2025.
import type { Point, Series, SeriesData } from '../../src/lib/types.ts';
import { getJson, list, settle, type Source } from '../lib.ts';

const API = 'https://servicios.ine.es/wstempus/js/ES';

type Raw = Record<string, any>;

/** FK_Periodo: 1–12 son meses; 19–22, trimestres. */
function period(d: Raw): string | null {
	const year = Number(d.Anyo);
	const p = Number(d.FK_Periodo);
	if (!year) return null;
	if (p >= 1 && p <= 12) return `${year}-${String(p).padStart(2, '0')}`;
	if (p >= 19 && p <= 22) return `${year}-Q${p - 18}`;
	return null;
}

function points(serie: Raw): Point[] {
	return list<Raw>(serie?.Data)
		.map((d) => ({ t: period(d), v: typeof d.Valor === 'number' ? d.Valor : null }))
		.filter((p): p is Point => p.t !== null && p.v !== null)
		.sort((a, b) => a.t.localeCompare(b.t));
}

interface Wanted {
	id: string;
	label: string;
	geo: string;
	/** Unidad de la serie; por defecto, «%». */
	unit?: string;
	/** Divide cada valor (para pasar personas a millones). */
	scale?: number;
	/** Código de la serie (estable) o tabla + patrón del nombre (cuando el código no se conoce). */
	code?: string;
	table?: number;
	match?: RegExp;
	last: number;
}

const WANTED: Wanted[] = [
	{ id: 'ipc-es', label: 'IPC (INE)', geo: 'ES', code: 'IPC290750', last: 25 },
	{ id: 'ipc-ib', label: 'IPC (INE)', geo: 'IB', code: 'IPC293827', last: 25 },
	{ id: 'epa-es', label: 'Paro (EPA)', geo: 'ES', code: 'EPA423474', last: 13 },
	{
		id: 'epa-ib',
		label: 'Paro (EPA)',
		geo: 'IB',
		table: 14506,
		// «Ambos sexos. Balears, Illes. Total. Tasa de paro…»: el orden de las partes puede variar.
		match: /^(?=.*Balears)(?=.*Ambos sexos)(?=.*(Total|Todas las edades))(?!.*(De \d|\d+ y más|Menores))/i,
		last: 13
	},
	// Turistas internacionales que llegan cada mes (FRONTUR), en millones.
	{ id: 'turistas-es', label: 'Turistas internacionales', geo: 'ES', code: 'FREG286', unit: 'mill.', scale: 1e6, last: 25 },
	{ id: 'turistas-ib', label: 'Turistas internacionales', geo: 'IB', code: 'FREG350', unit: 'mill.', scale: 1e6, last: 25 },
	// Índice de Precios de Vivienda, trimestral: variación anual del índice general (tabla 79563).
	{ id: 'ipv-es', label: 'Precio de la vivienda (IPV)', geo: 'ES', code: 'IPV1376', last: 9 },
	{ id: 'ipv-ib', label: 'Precio de la vivienda (IPV)', geo: 'IB', code: 'IPV1670', last: 9 }
];

async function fetchSeries(w: Wanted): Promise<Series | null> {
	let serie: Raw | undefined;
	if (w.code) {
		serie = await getJson<Raw>(`${API}/DATOS_SERIE/${w.code}?nult=${w.last}`);
	} else {
		const table = list(await getJson<Raw[]>(`${API}/DATOS_TABLA/${w.table}?nult=${w.last}`));
		serie = table.find((s) => w.match!.test(String(s.Nombre)));
		if (!serie) {
			const sample = table.filter((s) => /Balears/i.test(String(s.Nombre))).slice(0, 6).map((s) => s.Nombre);
			throw new Error(`sin serie que encaje; candidatas: ${JSON.stringify(sample)}`);
		}
	}
	const pts = points(serie).map((p) => (w.scale ? { t: p.t, v: p.v / w.scale } : p));
	if (!pts.length) return null;
	return {
		id: w.id,
		label: w.label,
		unit: w.unit ?? '%',
		geo: w.geo,
		points: pts,
		source: 'INE',
		url: `https://www.ine.es/consul/serie.do?s=${serie?.COD ?? w.code}`
	};
}

export const ine: Source<SeriesData> = {
	name: 'ine',
	label: 'IPC, paro (EPA), turistas (FRONTUR) y precio de la vivienda (IPV) de España y Baleares · INE',
	maxAgeMinutes: 355,
	// Si se añaden series a WANTED, la copia publicada no las tiene: se descarga de nuevo sin esperar.
	isStale: (previous) => WANTED.some((w) => !previous.series?.some((s) => s.id === w.id)),
	async fetch() {
		const series = await settle('ine', WANTED, (w) => w.id, fetchSeries);
		if (!series.length) throw new Error('ninguna serie del INE');
		// Último dato de cada serie en el registro de la Action, para revisarlo de un vistazo.
		for (const s of series) {
			const last = s.points.at(-1);
			console.log(`  ine · ${s.id} (${s.url?.split('s=')[1]}): ${last?.t} = ${last?.v} ${s.unit}`);
		}
		return { series };
	}
};
