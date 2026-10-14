// Afiliados a la Seguridad Social (Régimen General + autónomos), total nacional y mensual.
// Sale de una consulta guardada del PXWeb de la Seguridad Social, enlazada desde datos.gob.es: un CSV con «;»,
// en latin1, una fila por mes y sección de actividad («"202609";"TODAS LAS SECCIONES";21281233;…»).
// La consulta solo trae el año en curso (la de afiliados medios se paró en 2025-12), así que el historial
// se acumula con la copia anterior. Datos abiertos: reutilización libre citando la fuente.
import type { Point, SeriesData } from '../../src/lib/types.ts';
import { getText, type Source } from '../lib.ts';

const URL = 'https://w6.seg-social.es/PXWeb/sq/c459066d-091f-4120-b74f-f7a246eb346b';
const WEB = 'https://www.seg-social.es/wps/portal/wss/internet/EstadisticasPresupuestosEstudios/Estadisticas/EST8';

const KEEP = 25;

/** Del CSV, la primera cifra de cada fila del total («TODAS LAS SECCIONES»), en millones, por orden de mes. */
export function parseAfiliacion(csv: string): Point[] {
	const points: Point[] = [];
	for (const line of csv.split(/\r?\n/)) {
		const m = line.match(/^"(\d{4})(\d{2})";"(?:TODAS LAS SECCIONES|Total Nacional)";([\d.]+)/);
		if (m) points.push({ t: `${m[1]}-${m[2]}`, v: Number(m[3]) / 1e6 });
	}
	return points.sort((a, b) => a.t.localeCompare(b.t));
}

/** Junta los meses de la copia anterior con los nuevos (manda el nuevo) y guarda los últimos `keep`. */
export function mergeMonths(previous: Point[], fresh: Point[], keep = KEEP): Point[] {
	const byMonth = new Map(previous.map((p) => [p.t, p]));
	for (const p of fresh) byMonth.set(p.t, p);
	return [...byMonth.values()].sort((a, b) => a.t.localeCompare(b.t)).slice(-keep);
}

export const afiliacion: Source<SeriesData> = {
	name: 'afiliacion',
	label: 'Afiliados a la Seguridad Social (RG + autónomos), total nacional · Seguridad Social',
	// Sale una vez al mes (segundo día hábil): basta con mirar cada seis horas.
	maxAgeMinutes: 355,
	async fetch(previous) {
		const fresh = parseAfiliacion(await getText(URL));
		if (!fresh.length) throw new Error('sin filas «TODAS LAS SECCIONES» en el CSV');
		const points = mergeMonths(previous?.series.find((x) => x.id === 'afiliados-es')?.points ?? [], fresh);
		const last = points.at(-1)!;
		console.log(`  afiliacion · ${last.t} = ${last.v.toFixed(3)} mill.`);
		return {
			series: [
				{ id: 'afiliados-es', label: 'Afiliados a la Seguridad Social', unit: 'mill.', geo: 'ES', points, source: 'Seguridad Social', url: WEB }
			]
		};
	}
};
