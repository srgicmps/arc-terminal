import { describe, expect, it } from 'vitest';
import { addDays, elections, readElections, type SparqlJson } from '../sources/elections.ts';
import { mockFetch } from './mock.ts';

const uri = (value: string) => ({ type: 'uri', value });
const lit = (value: string) => ({ type: 'literal', value });

/** Una fila de resultados SPARQL, como la devuelve WDQS. */
function row(o: { e: string; date: string; kind: string; country: string; iso?: string; es?: string; en?: string; nameEs?: string; nameEn?: string }) {
	return {
		e: uri(`http://www.wikidata.org/entity/${o.e}`),
		date: { type: 'literal', datatype: 'http://www.w3.org/2001/XMLSchema#dateTime', value: `${o.date}T00:00:00Z` },
		kind: lit(o.kind),
		country: uri(`http://www.wikidata.org/entity/${o.country}`),
		...(o.iso ? { iso: lit(o.iso) } : {}),
		...(o.es ? { countryEs: { ...lit(o.es), 'xml:lang': 'es' } } : {}),
		...(o.en ? { countryEn: { ...lit(o.en), 'xml:lang': 'en' } } : {}),
		...(o.nameEs ? { nameEs: lit(o.nameEs) } : {}),
		...(o.nameEn ? { nameEn: lit(o.nameEn) } : {})
	};
}

const json = (...bindings: ReturnType<typeof row>[]): SparqlJson => ({
	head: { vars: ['e', 'date', 'kind', 'country', 'iso', 'countryEs', 'countryEn', 'nameEs', 'nameEn'] },
	results: { bindings }
});

const START = '2026-10-14';
const END = '2027-01-12';

describe('readElections', () => {
	it('lee las filas normales, ordenadas por fecha', () => {
		const items = readElections(
			json(
				row({ e: 'Q2', date: '2026-12-01', kind: 'presidential', country: 'Q298', iso: 'CL', es: 'Chile', en: 'Chile', nameEs: 'Elección presidencial de Chile de 2026' }),
				row({ e: 'Q1', date: '2026-11-03', kind: 'general', country: 'Q30', iso: 'US', es: 'Estados Unidos', en: 'United States' })
			),
			START,
			END
		);
		expect(items).toEqual([
			{ date: '2026-11-03', country: 'Estados Unidos', iso: 'US', kind: 'general', name: 'Estados Unidos', url: 'https://www.wikidata.org/entity/Q1' },
			{ date: '2026-12-01', country: 'Chile', iso: 'CL', kind: 'presidential', name: 'Elección presidencial de Chile de 2026', url: 'https://www.wikidata.org/entity/Q2' }
		]);
	});

	it('sin etiqueta en español usa la inglesa, y sin ninguna descarta la fila', () => {
		const items = readElections(
			json(
				row({ e: 'Q3', date: '2026-11-20', kind: 'referendum', country: 'Q1', en: 'Tuvalu', nameEn: '2026 Tuvalu referendum' }),
				row({ e: 'Q4', date: '2026-11-21', kind: 'general', country: 'Q2' })
			),
			START,
			END
		);
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({ country: 'Tuvalu', name: '2026 Tuvalu referendum', iso: null, kind: 'referendum' });
	});

	it('deja una por país y día, la más importante', () => {
		const items = readElections(
			json(
				row({ e: 'Q5', date: '2026-11-03', kind: 'referendum', country: 'Q30', iso: 'US', es: 'Estados Unidos' }),
				row({ e: 'Q6', date: '2026-11-03', kind: 'general', country: 'Q30', iso: 'US', es: 'Estados Unidos' }),
				row({ e: 'Q6', date: '2026-11-03', kind: 'general', country: 'Q30', iso: 'US', es: 'Estados Unidos' }),
				row({ e: 'Q7', date: '2026-11-04', kind: 'general', country: 'Q30', iso: 'US', es: 'Estados Unidos' })
			),
			START,
			END
		);
		expect(items.map((i) => `${i.date} ${i.kind}`)).toEqual(['2026-11-03 general', '2026-11-04 general']);
	});

	it('descarta las fechas fuera de rango, los tipos desconocidos y las fechas rotas', () => {
		const items = readElections(
			json(
				row({ e: 'Q8', date: '2026-10-13', kind: 'general', country: 'Q1', es: 'Ayer' }),
				row({ e: 'Q9', date: '2026-10-14', kind: 'general', country: 'Q2', es: 'Hoy' }),
				row({ e: 'Q10', date: '2027-01-12', kind: 'general', country: 'Q3', es: 'Tarde' }),
				row({ e: 'Q11', date: '2026-11-01', kind: 'municipal', country: 'Q4', es: 'Municipal' }),
				row({ e: 'Q12', date: 'nunca', kind: 'general', country: 'Q5', es: 'Rota' })
			),
			START,
			END
		);
		expect(items.map((i) => i.country)).toEqual(['Hoy']);
	});

	it('aguanta una respuesta sin results', () => {
		expect(readElections({}, START, END)).toEqual([]);
	});
});

describe('elections', () => {
	it('consulta WDQS con la ventana de 90 días y falla si no sale nada', async () => {
		const fetch = mockFetch(() => json());
		await expect(elections.fetch(undefined)).rejects.toThrow('Wikidata no devuelve elecciones');
		const url = decodeURIComponent(String(fetch.mock.calls[0][0]));
		expect(url).toMatch(/^https:\/\/query\.wikidata\.org\/sparql\?format=json&query=SELECT/);
		expect(url).toContain('?type wdt:P279? ?class');
		expect(url).toContain('hint:optimizer "None"');
		expect(url).not.toContain('wdt:P279*');
		expect(url).toMatch(/"(\d{4}-\d{2}-\d{2})T00:00:00Z".*"(\d{4}-\d{2}-\d{2})T00:00:00Z"/s);
	});

	it('suma días de calendario', () => {
		expect(addDays('2026-10-14', 90)).toBe('2027-01-12');
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
	});
});
