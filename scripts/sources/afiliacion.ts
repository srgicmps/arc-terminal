// Afiliados medios a la Seguridad Social (Régimen General + autónomos), total nacional y mensual.
// Sale de una consulta guardada del PXWeb de la Seguridad Social, enlazada desde datos.gob.es: un CSV con «;»,
// en latin1, con una fila por mes y comunidad autónoma («"202609";"Total Nacional";21500000.00;…»).
// Datos abiertos: reutilización libre citando la fuente.
import type { Point, SeriesData } from '../../src/lib/types.ts';
import { getText, type Source } from '../lib.ts';

const URL = 'https://w6.seg-social.es/PXWeb/sq/32ae72f2-64eb-4f1d-b960-92d72a75542d';
const WEB = 'https://www.seg-social.es/wps/portal/wss/internet/EstadisticasPresupuestosEstudios/Estadisticas/EST8';

/** Del CSV, la primera cifra de cada fila «Total Nacional», en millones de afiliados, del mes más antiguo al último. */
export function parseAfiliacion(csv: string, keep = 25): Point[] {
	const points: Point[] = [];
	for (const line of csv.split(/\r?\n/)) {
		const m = line.match(/^"(\d{4})(\d{2})";"Total Nacional";([\d.]+)/);
		if (m) points.push({ t: `${m[1]}-${m[2]}`, v: Number(m[3]) / 1e6 });
	}
	return points.sort((a, b) => a.t.localeCompare(b.t)).slice(-keep);
}

export const afiliacion: Source<SeriesData> = {
	name: 'afiliacion',
	label: 'Afiliados medios a la Seguridad Social, total nacional · Seguridad Social',
	// Sale una vez al mes (segundo día hábil): basta con mirar cada seis horas.
	maxAgeMinutes: 355,
	async fetch() {
		const points = parseAfiliacion(await getText(URL));
		if (!points.length) throw new Error('sin filas «Total Nacional» en el CSV');
		const last = points.at(-1)!;
		console.log(`  afiliacion · ${last.t} = ${last.v.toFixed(3)} mill.`);
		return {
			series: [
				{ id: 'afiliados-es', label: 'Afiliados a la Seguridad Social', unit: 'mill.', geo: 'ES', points, source: 'Seguridad Social', url: WEB }
			]
		};
	}
};
