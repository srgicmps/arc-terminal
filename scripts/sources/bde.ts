// Banco de España: indicadores financieros diarios (tabla 1.2 de la «Síntesis de indicadores»), sin clave.
// https://www.bde.es/webbe/es/estadisticas/otras-clasificaciones/publicaciones/sintesis-indicadores/capitulo-1.html
// Reutilización libre citando la fuente (aviso legal del BdE). No publican límite por IP: un CSV cada 3 h.
// Un CSV en Latin-1 con una columna por serie (la fila «CÓDIGO DE LA SERIE» dice cuál es cuál) y una fila por
// día hábil, con la fecha como «01 OCT 2026». Los huecos van como «_». De aquí sale la prima de riesgo diaria
// de España; el BCE solo da la media mensual.
import type { Series, SeriesData } from '../../src/lib/types.ts';
import { num, request, type Source } from '../lib.ts';

const CSV = 'https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/si_1_2.csv';
const PAGE = 'https://www.bde.es/webbe/es/estadisticas/otras-clasificaciones/publicaciones/sintesis-indicadores/capitulo-1.html';

/** Series que se guardan: código del BdE, id, etiqueta, unidad y factor (el diferencial viene en puntos porcentuales). */
const WANTED = [
	{ code: 'DPUG0B1F0ZPD', id: 'premium-es-d', label: 'Prima de riesgo de España', unit: 'pb', geo: 'ES', factor: 100 },
	{ code: 'DPUG0B1F0ZP', id: 'bond10-es-d', label: 'Bono español a 10 años', unit: '%', geo: 'ES', factor: 1 },
	{ code: 'DPUDNBBN308', id: 'bond10-de-d', label: 'Bono alemán a 10 años', unit: '%', geo: 'DE', factor: 1 }
];

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/** «01 OCT 2026» → «2026-10-01». Cualquier otra cosa → null. */
export function bdeDate(value: string): string | null {
	const m = /^(\d{1,2}) ([A-Z]{3}) (\d{4})$/.exec(value.trim().toUpperCase());
	const month = m ? MONTHS.indexOf(m[2]) + 1 : 0;
	if (!m || !month) return null;
	return `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** Cuántos días hábiles se guardan: unas seis semanas (ECO pinta el último y el de hace 7 días). */
const KEEP = 30;

/** Lee el CSV (ya pasado a texto): columnas por el código de la serie y una fila por día. */
export function parseBde(text: string): Series[] {
	const rows = text.split(/\r?\n/).map((line) => line.split(',').map((c) => c.trim().replace(/^"|"$/g, '')));
	const codes = rows.find((cells) => WANTED.some((w) => cells.includes(w.code)));
	if (!codes) return [];
	return WANTED.flatMap((w) => {
		const col = codes.indexOf(w.code);
		if (col < 0) return [];
		const points = rows.flatMap((cells) => {
			const t = bdeDate(cells[0] ?? '');
			const v = t ? num(cells[col]) : null;
			return t && v !== null ? [{ t, v: Math.round(v * w.factor * 1000) / 1000 }] : [];
		});
		points.sort((a, b) => a.t.localeCompare(b.t));
		if (!points.length) return [];
		const { id, label, unit, geo } = w;
		return [{ id, label, unit, geo, points: points.slice(-KEEP), source: 'Banco de España', url: PAGE }];
	});
}

export const bde: Source<SeriesData> = {
	name: 'bde',
	label: 'Prima de riesgo diaria · Banco de España',
	// El BdE publica el dato del día anterior por la mañana: con mirar cada 3 h basta.
	maxAgeMinutes: 175,
	async fetch() {
		const bytes = await (await request(CSV)).arrayBuffer();
		const series = parseBde(new TextDecoder('latin1').decode(bytes));
		if (!series.some((s) => s.id === 'premium-es-d')) throw new Error('el CSV no trae la prima de España');
		return { series };
	}
};
