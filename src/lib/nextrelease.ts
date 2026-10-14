// «Próximo dato»: qué publicación de los calendarios oficiales corresponde a cada serie de la terminal.
// La fuente (scripts/sources/releases-cal.ts) etiqueta cada evento con un tema; SeriesTable busca el de su
// serie con nextFor().
import { dataset } from './data.ts';
import type { ReleaseCalData, ReleaseEvent } from './types.ts';

export interface Topic {
	id: string;
	source: ReleaseEvent['source'];
	/** Para reconocer el evento por su título. */
	match: RegExp;
	/** Series de la terminal que actualiza (por su id). */
	series: RegExp;
}

export const TOPICS: Topic[] = [
	{ id: 'ea-inflation', source: 'Eurostat', match: /inflation|\bHICP\b/i, series: /^inflation-/ },
	{ id: 'ea-unemployment', source: 'Eurostat', match: /unemployment/i, series: /^(youth-)?unemployment-(?!us$)/ },
	{ id: 'ea-gdp', source: 'Eurostat', match: /\bGDP\b/i, series: /^gdp-(?!us$)/ },
	{ id: 'us-cpi', source: 'BLS', match: /^Consumer Price Index/i, series: /^(core-)?cpi-us$/ },
	{ id: 'us-jobs', source: 'BLS', match: /^(The )?Employment Situation/i, series: /^(unemployment|payrolls)-us$/ },
	{ id: 'es-ipc', source: 'INE', match: /Índice de Precios de Consumo|\bIPC\b/i, series: /^ipc-/ },
	{ id: 'es-epa', source: 'INE', match: /Población Activa|\bEPA\b/i, series: /^epa-/ },
	{ id: 'es-ipv', source: 'INE', match: /Precios de Vivienda|\bIPV\b/i, series: /^ipv-/ },
	{ id: 'es-tourism', source: 'INE', match: /FRONTUR|Movimientos Turísticos en Fronteras/i, series: /^turistas-/ }
];

/** Tema de un evento por su organismo y su título, o null. */
export function topicOf(source: ReleaseEvent['source'], title: string): string | null {
	return TOPICS.find((t) => t.source === source && t.match.test(title))?.id ?? null;
}

/** Próxima publicación (desde `now`) de los datos de la serie `seriesId`, o null. */
export function nextFor(seriesId: string, events: readonly ReleaseEvent[], now = new Date()): ReleaseEvent | null {
	const topic = TOPICS.find((t) => t.series.test(seriesId));
	if (!topic) return null;
	const from = now.toISOString();
	return events.find((e) => e.topic === topic.id && e.date >= from) ?? null;
}

/** «30 oct», en hora de Madrid. */
export function shortDay(iso: string): string {
	return new Date(iso)
		.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' })
		.replace('.', '');
}

/** Carga el calendario una sola vez para todas las tablas de la página (vacío si aún no hay datos). */
let cache: Promise<ReleaseEvent[]> | null = null;
export function loadCalendar(): Promise<ReleaseEvent[]> {
	cache ??= dataset<ReleaseCalData>('releases-cal').then(
		(d) => d?.data.events ?? [],
		() => []
	);
	return cache;
}
