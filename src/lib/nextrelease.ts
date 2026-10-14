// «Próximo dato»: qué publicación de los calendarios oficiales corresponde a cada serie de la terminal.
// La fuente (scripts/sources/releases-cal.ts) etiqueta cada evento con un tema; SeriesTable busca el de su
// serie con nextFor(). Sin imports de Vite: lo usa también el script de Node.
import type { ReleaseEvent } from './types.ts';

export interface Topic {
	id: string;
	source: ReleaseEvent['source'];
	/** Para reconocer el evento por su título. */
	match: RegExp;
	/** Series de la terminal que actualiza (por su id). */
	series: RegExp;
}

export const TOPICS: Topic[] = [
	// Primero los de España: el PIB de España es también una serie «gdp-…», y gana el primer tema que encaja.
	{ id: 'es-gdp', source: 'INE', match: /Contabilidad Nacional Trimestral/i, series: /^gdp(-yoy)?-es$/ },
	{ id: 'ea-inflation', source: 'Eurostat', match: /inflation|\bHICP\b/i, series: /^inflation-/ },
	{ id: 'ea-unemployment', source: 'Eurostat', match: /unemployment/i, series: /^(youth-)?unemployment-(?!us$)/ },
	{ id: 'ea-gdp', source: 'Eurostat', match: /\bGDP\b/i, series: /^gdp-(?!us$)/ },
	{ id: 'us-cpi', source: 'BLS', match: /^Consumer Price Index/i, series: /^(core-)?cpi-us$/ },
	{ id: 'us-jobs', source: 'BLS', match: /^(The )?Employment Situation/i, series: /^(unemployment|payrolls)-us$/ },
	{ id: 'us-gdp', source: 'BEA', match: /^Gross Domestic Product/i, series: /^gdp-us$/ },
	{ id: 'us-pce', source: 'BEA', match: /^Personal Income and Outlays/i, series: /^core-pce-us$/ },
	{ id: 'us-claims', source: 'DOL', match: /Unemployment Insurance Weekly Claims/i, series: /^claims-us$/ },
	{ id: 'us-h41', source: 'Fed', match: /^H\.4\.1/i, series: /^fed-(balance|net-liquidity)$/ },
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

/** Próxima publicación de cada serie, por su id: lo que recibe SeriesTable en la prop `next`. */
export type NextMap = Record<string, { date: string; title: string }>;

/** Calcula el próximo dato de cada serie (se llama en los +page.server.ts, al construir la web). */
export function nextMap(seriesIds: readonly string[], events: readonly ReleaseEvent[], now = new Date()): NextMap {
	const out: NextMap = {};
	for (const id of seriesIds) {
		const e = nextFor(id, events, now);
		if (e) out[id] = { date: e.date, title: e.title };
	}
	return out;
}
