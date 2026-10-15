import { describe, expect, it } from 'vitest';
import { canonical, resolveInput, suggest, targetPath, type Option } from './cmdline.ts';
import { hasWords, leaderEntries, prepare, queryWords, searchIndex, searchOptions, symbolOf } from './search.ts';
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
	// Los resultados del índice, sin la última fila («Buscar en el archivo»), que tiene su propio test.
	const found = (...args: Parameters<typeof searchOptions>) => searchOptions(...args).filter((o) => o.kind !== 'Archivo');
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

	it('acaba con «Buscar en el archivo», también sin índice, si no es un comando y hay 3 letras', () => {
		const archive = { code: 'NEWS', desc: 'Buscar «aranceles» en el archivo de 3 meses', kind: 'Archivo', run: 'NEWS aranceles' };
		expect(searchOptions('aranceles', [], index).at(-1)).toEqual(archive);
		expect(searchOptions(' aranceles ', [], null)).toEqual([archive]);
		expect(searchOptions('UE', [], index)).toEqual([]);
		expect(searchOptions('ECO', [], index)).toEqual([]);
		expect(searchOptions('NEWS aranceles', [], index)).toEqual([]);
		// Un código corto que no está en el índice: primero su ficha, para que Intro haga lo de siempre.
		expect(searchOptions('AMZN', [], null).map((o) => o.kind)).toEqual(['Valor', 'Archivo']);
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
