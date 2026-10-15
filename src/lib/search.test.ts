import { describe, expect, it } from 'vitest';
import { canonical, resolveInput, suggest, targetPath, type Option } from './cmdline.ts';
import { NEWS_SECTIONS } from './news.ts';
import {
	dropSectionFilter,
	hasWords,
	leaderEntries,
	parseNewsQuery,
	prepare,
	queryWords,
	searchIndex,
	searchOptions,
	symbolOf,
	withinHours
} from './search.ts';
import type { SearchEntry } from './types.ts';

const entry = (t: string, s: SearchEntry['s'] = 'NEWS', u = `https://a.example/${encodeURIComponent(t)}`): SearchEntry => ({ t, u, s });

const index = prepare([
	entry('La UE responde a los aranceles de Trump'),
	entry('Aranceles: lo que cambia para el aceite español'),
	entry('Pymes y subaranceles, un análisis'),
	entry('Real Decreto sobre aranceles agrícolas', 'BOE', 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-1'),
	entry('NVDA · NVIDIA', 'Valor', '/s?sym=NVDA'),
	entry('BRK.B · Berkshire Hathaway', 'Valor', '/s?sym=BRK.B')
]);

describe('searchIndex', () => {
	it('da prioridad a lo que empieza por lo escrito, luego a principios de palabra', () => {
		expect(searchIndex('aranceles', index).map((e) => e.t)).toEqual([
			'Aranceles: lo que cambia para el aceite español',
			'La UE responde a los aranceles de Trump',
			'Real Decreto sobre aranceles agrícolas',
			'Pymes y subaranceles, un análisis'
		]);
	});

	it('no distingue tildes ni mayúsculas', () => {
		expect(searchIndex('ESPANOL', index)).toHaveLength(1);
		expect(searchIndex('análisis', index)[0].t).toContain('Pymes');
		expect(searchIndex('AGRICOLAS', index)[0].s).toBe('BOE');
	});

	it('exige todas las palabras (AND), en cualquier orden', () => {
		expect(searchIndex('trump aranceles', index).map((e) => e.t)).toEqual(['La UE responde a los aranceles de Trump']);
		expect(searchIndex('aranceles inexistente', index)).toEqual([]);
	});

	it('respeta el límite y no busca con menos de 3 letras', () => {
		expect(searchIndex('aranceles', index, 2)).toHaveLength(2);
		expect(searchIndex('la', index)).toEqual([]);
		expect(searchIndex('  ', index)).toEqual([]);
	});

	it('descarta entradas mal formadas al preparar', () => {
		expect(prepare([entry('Bien'), { t: 3, u: null } as unknown as SearchEntry])).toHaveLength(1);
	});
});

describe('searchOptions', () => {
	const ALL: Option[] = [
		{ code: 'ECO', desc: 'Economía y macro', kind: 'Función', aliases: ['economia'] },
		{ code: 'NEWS', desc: 'Buscar en los titulares', kind: 'Función' },
		{ code: 'NVDA', desc: 'NVIDIA', kind: 'Valor' }
	];
	// Los resultados del índice, sin la fila «Buscar en NEWS», que tiene su propio test.
	const found = (...args: Parameters<typeof searchOptions>) => searchOptions(...args).filter((o) => o.kind !== 'Buscar');
	const opts = (raw: string) => found(raw, suggest(raw, ALL), index);

	it('convierte titulares y BOE en enlaces externos con su etiqueta', () => {
		const hits = opts('aranceles');
		expect(hits.map((h) => h.code)).toEqual(['NEWS', 'NEWS', 'BOE', 'NEWS']);
		expect(hits[0].url).toMatch(/^https:/);
		expect(hits[0].run).toBeUndefined();
	});

	it('no busca si lo escrito es un comando, un comando con texto o empieza por un comando', () => {
		expect(found('ECO', [], index)).toEqual([]);
		expect(found('bolsa', [], prepare([entry('La bolsa sube')]))).toEqual([]); // alias de WS
		expect(found('sube bolsa', [], prepare([entry('La bolsa sube')]))).toHaveLength(1);
		expect(found('NEWS aranceles', [], index)).toEqual([]);
		expect(found('ECO aranceles', [], index)).toEqual([]);
	});

	it('no repite un valor que ya está entre las sugerencias', () => {
		expect(opts('nvidia')).toEqual([]);
		expect(found('berkshire', [], index)).toEqual([{ code: 'BRK.B', desc: 'Berkshire Hathaway', kind: 'Valor', run: 'BRK.B' }]);
	});

	it('con un código corto sin sugerencias, la ficha del valor va primero', () => {
		const hits = found('UE', [], prepare([entry('Trump y la UEFA')]));
		expect(hits).toEqual([]); // menos de 3 letras: no se busca
		const pymes = found('pymes', [], index);
		expect(pymes[0]).toEqual({ code: 'PYMES', desc: 'Ficha del valor', kind: 'Valor', run: 'PYMES' });
		expect(pymes[1].code).toBe('NEWS');
		// Un líder («trump» abre su ficha en LIDER): con su sugerencia delante, no se ofrece la ficha del valor TRUMP.
		expect(found('trump', suggest('trump', leaderEntries()), index).map((o) => o.code)).not.toContain('TRUMP');
		// Más de 5 caracteres: ya no parece un valor y el primero es el titular.
		expect(found('aranceles', [], index)[0].code).toBe('NEWS');
	});

	it('sin índice (aún no cargado) no hay resultados', () => {
		expect(found('aranceles', [], null)).toEqual([]);
	});

	it('ofrece «Buscar en NEWS», también sin índice, si no es un comando y hay 3 letras', () => {
		const news = { code: 'NEWS', desc: 'Buscar «aranceles» en los titulares y el archivo', kind: 'Buscar', run: 'NEWS aranceles' };
		// Texto suelto sin sugerencias: la primera fila, para que Intro abra NEWS con esa búsqueda.
		expect(searchOptions('aranceles', [], index)[0]).toEqual(news);
		expect(searchOptions(' aranceles ', [], null)).toEqual([news]);
		expect(searchOptions('aranceles china', [], null)[0].run).toBe('NEWS aranceles china');
		// Con sugerencias de comandos delante, al final.
		expect(searchOptions('aranceles', [{ code: 'X', desc: '', kind: 'Función' }], index).at(-1)).toEqual(news);
		expect(searchOptions('UE', [], index)).toEqual([]);
		expect(searchOptions('ECO', [], index)).toEqual([]);
		expect(searchOptions('NEWS aranceles', [], index)).toEqual([]);
		// Un código corto que no está en el índice: primero su ficha, para que Intro haga lo de siempre.
		expect(searchOptions('AMZN', [], null).map((o) => o.kind)).toEqual(['Valor', 'Buscar']);
		// Un valor del índice («berkshire»): también su ficha primero.
		expect(searchOptions('berkshire', [], index)[0].kind).toBe('Valor');
	});

	it('symbolOf lee el valor de un enlace interno', () => {
		expect(symbolOf('/s?sym=BME%3AREP')).toBe('BME:REP');
		expect(symbolOf('https://a.example/s?sym=X')).toBeNull();
	});
});

describe('leaderEntries', () => {
	it('«trump» + Intro abre su ficha en LIDER', () => {
		const target = resolveInput('trump', suggest('trump', leaderEntries()));
		expect(target && canonical(target)).toBe('LIDER trump');
		expect(target && targetPath(target)).toEqual({ route: '/lider', search: '?id=trump' });
	});
});

describe('queryWords y hasWords', () => {
	it('separa palabras sin tildes ni mayúsculas', () => {
		expect(queryWords('  Banco   de ESPAÑA ')).toEqual(['banco', 'de', 'espana']);
		expect(queryWords('   ')).toEqual([]);
	});
	it('encaja con todas las palabras en cualquier orden', () => {
		expect(hasWords('Ayudas a la vivienda en Menorca', queryWords('menorca vivienda'))).toBe(true);
		expect(hasWords('Ayudas a la vivienda', queryWords('vivienda menorca'))).toBe(false);
		expect(hasWords('Cualquier cosa', [])).toBe(true);
	});
});

describe('filtros de NEWS', () => {
	const parse = (q: string) => parseNewsQuery(q, NEWS_SECTIONS);

	it('separa sección y antigüedad del texto', () => {
		expect(parse('inflación /eco /7d')).toEqual({ text: 'inflación', section: 'eco', hours: 168 });
		expect(parse('/24h Lagarde')).toEqual({ text: 'Lagarde', section: null, hours: 24 });
		expect(parse('chips /2s /tecnología')).toEqual({ text: 'chips', section: 'tech', hours: 336 });
		expect(parse('/3m /merc')).toEqual({ text: '', section: 'ws', hours: 2160 });
	});

	it('un «/algo» que no es filtro se queda en el texto', () => {
		expect(parse('24/7 /xyz /0d')).toEqual({ text: '24/7 /xyz /0d', section: null, hours: null });
	});

	it('withinHours filtra por fecha; sin filtro todo vale', () => {
		const now = Date.parse('2026-10-15T12:00:00Z');
		expect(withinHours('2026-10-15T01:00Z', 24, now)).toBe(true);
		expect(withinHours('2026-10-13T01:00Z', 24, now)).toBe(false);
		expect(withinHours(undefined, 24, now)).toBe(false);
		expect(withinHours(undefined, null, now)).toBe(true);
	});

	it('dropSectionFilter quita solo la sección', () => {
		expect(dropSectionFilter('inflación /eco /7d', NEWS_SECTIONS)).toBe('inflación /7d');
	});
});
