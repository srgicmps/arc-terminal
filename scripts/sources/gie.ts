// Gas almacenado en Europa: % de llenado de los almacenes de la UE y de los grandes países, cada día.
// GIE AGSI+ (Gas Infrastructure Europe). Necesita una clave gratuita (GIE_API_KEY, en GitHub Secrets),
// que se manda en la cabecera x-key. Sin ella, la fuente se salta. Se cita como «GIE AGSI+».
// https://agsi.gie.eu · Documentación de la API: https://www.gie.eu/transparency-platform/
import type { Point, Series, SeriesData } from '../../src/lib/types.ts';
import { getJson, list, settle, type Source } from '../lib.ts';

const ENV = 'GIE_API_KEY';
const API = 'https://agsi.gie.eu/api';

type Raw = Record<string, any>;

/** La UE entera y los países con más almacenamiento (y España). */
const AREAS = [
	{ code: 'eu', geo: 'EU', label: 'Unión Europea' },
	{ code: 'de', geo: 'DE', label: 'Alemania' },
	{ code: 'it', geo: 'IT', label: 'Italia' },
	{ code: 'fr', geo: 'FR', label: 'Francia' },
	{ code: 'nl', geo: 'NL', label: 'Países Bajos' },
	{ code: 'es', geo: 'ES', label: 'España' }
];

/** Fecha «AAAA-MM-DD» de hace `days` días. */
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

async function area(a: (typeof AREAS)[number], key: string): Promise<Series | null> {
	// Algo más de un año, para comparar con la misma fecha del año pasado.
	const params = new URLSearchParams({ from: ago(400), to: ago(0), size: '500' });
	params.set(a.code === 'eu' ? 'type' : 'country', a.code);
	const body = await getJson<Raw>(`${API}?${params}`, { headers: { 'x-key': key } });
	const points: Point[] = list<Raw>(body.data)
		.map((d) => ({ t: String(d.gasDayStart ?? ''), v: Number(d.full) }))
		.filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.t) && Number.isFinite(p.v))
		.sort((x, y) => x.t.localeCompare(y.t));
	if (!points.length) return null;
	return {
		id: `gas-${a.code}`,
		label: a.label,
		unit: '%',
		geo: a.geo,
		points,
		source: 'GIE AGSI+',
		url: `https://agsi.gie.eu/data-overview/${a.code === 'eu' ? 'eu' : a.code}`
	};
}

export const gie: Source<SeriesData> = {
	name: 'gie',
	label: 'Gas almacenado en Europa (% de llenado) · GIE AGSI+',
	// Se publica una vez al día (por la tarde): con mirar cada 6 h sobra.
	maxAgeMinutes: 355,
	requires: ENV,
	async fetch() {
		const key = process.env[ENV] ?? '';
		const series = await settle('gie', AREAS, (a) => a.code, (a) => area(a, key));
		if (!series.length) throw new Error('GIE AGSI+ no devuelve datos');
		return { series };
	}
};
