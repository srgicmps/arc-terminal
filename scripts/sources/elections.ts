// Próximas elecciones del mundo (90 días): generales o legislativas, presidenciales y referendos.
// Wikidata Query Service (SPARQL), sin clave. Datos de Wikidata: CC0 (dominio público).
// https://query.wikidata.org · Normas de uso: User-Agent identificable y pocas consultas (una al día).
import type { Election, ElectionKind, ElectionsData } from '../../src/lib/types.ts';
import { getJson, madridDay, type Source } from '../lib.ts';

/** Días hacia delante que se miran. */
export const DAYS = 90;

/**
 * Clases de Wikidata y el tipo que les corresponde. Se busca «instancia de» la clase o de cualquier
 * subclase suya (P31/P279*): «elecciones presidenciales de Brasil» es subclase de «elección presidencial».
 * Q858439 elección presidencial · Q1076105 elección general · Q2618461 elección legislativa (se muestra
 * como «General») · Q43109 referéndum. Etiquetas comprobadas con wbgetentities en la Action del PR #89.
 */
export const CLASSES: [qid: string, kind: ElectionKind][] = [
	['Q858439', 'presidential'],
	['Q1076105', 'general'],
	['Q2618461', 'general'],
	['Q43109', 'referendum']
];

/** Si un mismo país vota varias cosas el mismo día, se queda la más importante. */
const PRIORITY: Record<ElectionKind, number> = { presidential: 0, general: 1, referendum: 2 };

/**
 * La consulta SPARQL entre dos días (AAAA-MM-DD, `end` sin incluir). Solo fechas con precisión de día
 * (las de «noviembre de 2026» quedan fuera) y solo de ámbito nacional: si la elección dice a qué
 * territorio se aplica (P1001), tiene que ser el propio país (así no entran las municipales ni las de
 * un estado o región).
 *
 * Para que responda en pocos segundos: la jerarquía baja como mucho un nivel (la clase o una subclase
 * directa, como «elección presidencial de Brasil») en vez de P279* entero, y el optimizador va apagado
 * (hint:optimizer "None"), así que los patrones se resuelven en el orden escrito: primero las clases,
 * luego sus elecciones, el filtro de fecha y, solo con las pocas que quedan, el resto.
 */
export function electionsQuery(start: string, end: string): string {
	const values = CLASSES.map(([qid, kind]) => `(wd:${qid} "${kind}")`).join(' ');
	return `SELECT ?e ?date ?kind ?country ?iso ?countryEs ?countryEn ?nameEs ?nameEn WHERE {
  hint:Query hint:optimizer "None" .
  VALUES (?class ?kind) { ${values} }
  ?type wdt:P279? ?class .
  ?e wdt:P31 ?type .
  ?e wdt:P585 ?date .
  FILTER(?date >= "${start}T00:00:00Z"^^xsd:dateTime && ?date < "${end}T00:00:00Z"^^xsd:dateTime)
  ?e p:P585/psv:P585/wikibase:timePrecision ?precision .
  FILTER(?precision >= 11)
  ?e wdt:P17 ?country .
  OPTIONAL { ?e wdt:P1001 ?scope }
  FILTER(!BOUND(?scope) || ?scope = ?country)
  OPTIONAL { ?country wdt:P297 ?iso }
  OPTIONAL { ?country rdfs:label ?countryEs FILTER(LANG(?countryEs) = "es") }
  OPTIONAL { ?country rdfs:label ?countryEn FILTER(LANG(?countryEn) = "en") }
  OPTIONAL { ?e rdfs:label ?nameEs FILTER(LANG(?nameEs) = "es") }
  OPTIONAL { ?e rdfs:label ?nameEn FILTER(LANG(?nameEn) = "en") }
}
LIMIT 2000`;
}

/** Forma estándar de los resultados SPARQL en JSON (W3C SPARQL 1.1 Query Results JSON Format). */
export interface SparqlJson {
	head?: { vars?: string[] };
	results?: { bindings?: Record<string, { type: string; value: string } | undefined>[] };
}

const isKind = (k: string): k is ElectionKind => k in PRIORITY;

/**
 * Convierte los resultados en la lista de elecciones entre `start` (incluido) y `end` (sin incluir),
 * ordenada por fecha y país. Una fila por país y día: la consulta da varias por elección (una por
 * clase o por etiqueta) y a veces dos elecciones del mismo país el mismo día.
 */
export function readElections(json: SparqlJson, start: string, end: string): Election[] {
	const best = new Map<string, Election>();
	for (const b of json.results?.bindings ?? []) {
		const v = (key: string) => b[key]?.value?.trim() || '';
		const date = v('date').slice(0, 10);
		const kind = v('kind');
		const countryId = v('country').split('/').pop() ?? '';
		const country = v('countryEs') || v('countryEn');
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < start || date >= end) continue;
		if (!isKind(kind) || !countryId || !country) continue;
		const item: Election = {
			date,
			country,
			iso: v('iso').toUpperCase() || null,
			kind,
			name: v('nameEs') || v('nameEn') || country,
			url: v('e').replace(/^http:/, 'https:')
		};
		const key = `${countryId}|${date}`;
		const prev = best.get(key);
		if (!prev || PRIORITY[kind] < PRIORITY[prev.kind]) best.set(key, item);
	}
	return [...best.values()].sort((a, b) => a.date.localeCompare(b.date) || a.country.localeCompare(b.country, 'es'));
}

/** «2026-10-14» + n días → «2027-01-12». */
export function addDays(day: string, n: number): string {
	const [y, m, d] = day.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export const elections: Source<ElectionsData> = {
	name: 'elections',
	label: 'Próximas elecciones · Wikidata',
	// Una consulta al día: las fechas de las elecciones cambian poco y WDQS pide no abusar.
	maxAgeMinutes: 1440,
	// WDQS corta a los 60 s: si no ha respondido para entonces, no va a hacerlo.
	deadlineMs: 60_000,
	async fetch() {
		const start = madridDay();
		const end = addDays(start, DAYS);
		const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(electionsQuery(start, end))}`;
		const json = await getJson<SparqlJson>(url, { headers: { Accept: 'application/sparql-results+json' } });
		const items = readElections(json, start, end);
		// En 90 días siempre hay alguna elección en el mundo: si no sale ninguna, la consulta ha fallado.
		if (!items.length) throw new Error(`Wikidata no devuelve elecciones entre ${start} y ${end}`);
		return { items };
	}
};
