// ES, tráfico (F4): incidencias de la DGT (DATEX II v3.7 del Punto de Acceso Nacional). No cubre Cataluña ni el
// País Vasco, que tienen su propio servicio. Tipos compartidos por la fuente (scripts/sources/traffic.ts) y la vista.

export type TrafficKind = 'retencion' | 'accidente' | 'obras' | 'meteo' | 'obstaculo' | 'otro';

export const KIND_LABEL: Record<TrafficKind, string> = {
	retencion: 'Retención',
	accidente: 'Accidente',
	obras: 'Obras',
	meteo: 'Tiempo',
	obstaculo: 'Obstáculo',
	otro: 'Otra'
};

export interface TrafficItem {
	id: string;
	kind: TrafficKind;
	/** Carretera cortada del todo (todos los carriles o «roadClosed»). */
	closed: boolean;
	/** Detalle en español («Obras», «Tráfico detenido», «Nieve»…), si se sabe. */
	what: string;
	road: string;
	town: string;
	/** Kilómetros, del menor al mayor (iguales si es un punto). */
	km: [number, number] | null;
	/** «ambos sentidos», «creciente», «decreciente» o vacío. */
	direction: string;
	/** Inicio y fin previsto (ISO), si los hay. */
	start: string;
	end: string;
	lat: number | null;
	lon: number | null;
}

export interface TrafficProvince {
	/** Para el archivo: static/data/traffic/<id>.json */
	id: string;
	name: string;
	region: string;
	total: number;
	closed: number;
	/** Por tipo. */
	kinds: Partial<Record<TrafficKind, number>>;
}

export interface TrafficData {
	/** Hora de publicación de la DGT. */
	published: string;
	provinces: TrafficProvince[];
}

/** «Las Palmas» → «las-palmas»; «A Coruña» → «a-coruna». */
export const provinceId = (name: string) =>
	name
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

/** Lo primero que se ve: los cortes, luego accidentes y retenciones, y por último obras y lo demás. */
const ORDER: TrafficKind[] = ['accidente', 'retencion', 'meteo', 'obstaculo', 'obras', 'otro'];
export function sortTraffic<T extends TrafficItem>(items: T[]): T[] {
	return [...items].sort(
		(a, b) => Number(b.closed) - Number(a.closed) || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || b.start.localeCompare(a.start)
	);
}
