import { describe, expect, it } from 'vitest';
import { suggest, type Option } from './cmdline.ts';
import { prepare, searchIndex, searchOptions, symbolOf } from './search.ts';
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
	const opts = (raw: string) => searchOptions(raw, suggest(raw, ALL), index);

	it('convierte titulares y BOE en enlaces externos con su etiqueta', () => {
		const hits = opts('aranceles');
		expect(hits.map((h) => h.code)).toEqual(['NEWS', 'NEWS', 'BOE', 'NEWS']);
		expect(hits[0].url).toMatch(/^https:/);
		expect(hits[0].run).toBeUndefined();
	});

	it('no busca si lo escrito es un comando, un comando con texto o empieza por un comando', () => {
		expect(searchOptions('ECO', [], index)).toEqual([]);
		expect(searchOptions('bolsa', [], prepare([entry('La bolsa sube')]))).toEqual([]); // alias de WS
		expect(searchOptions('sube bolsa', [], prepare([entry('La bolsa sube')]))).toHaveLength(1);
		expect(searchOptions('NEWS aranceles', [], index)).toEqual([]);
		expect(searchOptions('ECO aranceles', [], index)).toEqual([]);
	});

	it('no repite un valor que ya está entre las sugerencias', () => {
		expect(opts('nvidia')).toEqual([]);
		expect(searchOptions('berkshire', [], index)).toEqual([{ code: 'BRK.B', desc: 'Berkshire Hathaway', kind: 'Valor', run: 'BRK.B' }]);
	});

	it('con un código corto sin sugerencias, la ficha del valor va primero', () => {
		const hits = searchOptions('UE', [], prepare([entry('Trump y la UEFA')]));
		expect(hits).toEqual([]); // menos de 3 letras: no se busca
		// «trump» ya no sirve de ejemplo: desde el #61 es un alias de LIDER y no se busca.
		const pymes = searchOptions('pymes', [], index);
		expect(pymes[0]).toEqual({ code: 'PYMES', desc: 'Ficha del valor', kind: 'Valor', run: 'PYMES' });
		expect(pymes[1].code).toBe('NEWS');
		// Más de 5 caracteres: ya no parece un valor y el primero es el titular.
		expect(searchOptions('aranceles', [], index)[0].code).toBe('NEWS');
	});

	it('sin índice (aún no cargado) no hay resultados', () => {
		expect(searchOptions('aranceles', [], null)).toEqual([]);
	});

	it('symbolOf lee el valor de un enlace interno', () => {
		expect(symbolOf('/s?sym=BME%3AREP')).toBe('BME:REP');
		expect(symbolOf('https://a.example/s?sym=X')).toBeNull();
	});
});
