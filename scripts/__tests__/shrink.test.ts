import { describe, expect, it } from 'vitest';
import { checkShrink, countItems } from '../lib.ts';
import { loadSources } from '../registry.ts';

const sources = await loadSources();

const items = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('countItems', () => {
	it('cuenta la longitud de una lista', () => {
		expect(countItems([])).toBe(0);
		expect(countItems(items(3))).toBe(3);
	});

	it('suma las listas de primer nivel de un objeto e ignora el resto', () => {
		expect(countItems({ a: items(2), b: items(3), date: '2026-10-14', avg: { x: 1 } })).toBe(5);
		expect(countItems({ a: [], b: [] })).toBe(0);
	});

	it('no mira dentro de los objetos anidados', () => {
		expect(countItems({ nested: { list: items(4) }, top: items(1) })).toBe(1);
	});

	it('devuelve null si no hay nada que contar', () => {
		expect(countItems({ companies: { NVDA: { filings: items(3) } } })).toBeNull();
		expect(countItems({})).toBeNull();
		expect(countItems(null)).toBeNull();
		expect(countItems(undefined)).toBeNull();
		expect(countItems('texto')).toBeNull();
		expect(countItems(42)).toBeNull();
	});
});

describe('checkShrink', () => {
	it('da por buenos los datos normales, con o sin copia anterior', () => {
		expect(checkShrink(items(10), undefined, {})).toBeNull();
		expect(checkShrink(items(10), items(10), {})).toBeNull();
		expect(checkShrink({ a: items(1), b: [] }, undefined, {})).toBeNull();
	});

	it('rechaza una lista vacía', () => {
		expect(checkShrink([], undefined, {})).toBe('datos vacíos');
		expect(checkShrink([], items(5), {})).toBe('datos vacíos');
	});

	it('rechaza un objeto con todas sus listas vacías', () => {
		expect(checkShrink({ storms: [], events: [], date: 'x' }, undefined, {})).toBe('datos vacíos');
	});

	it('no se mete con objetos sin listas de primer nivel', () => {
		expect(checkShrink({ companies: {} }, { companies: { A: {} } }, {})).toBeNull();
		expect(checkShrink({ companies: {} }, items(10), {})).toBeNull();
	});

	it('rechaza una caída de más del 80 % respecto a la vez anterior', () => {
		expect(checkShrink(items(19), items(100), {})).toBe(
			'solo 19 elementos (antes 100): parece una respuesta incompleta'
		);
		expect(checkShrink({ a: items(1), b: items(2) }, { a: items(10), b: items(10) }, {})).toMatch(/antes 20/);
	});

	it('acepta justo el 20 % y cualquier caída menor', () => {
		expect(checkShrink(items(20), items(100), {})).toBeNull();
		expect(checkShrink(items(50), items(100), {})).toBeNull();
		expect(checkShrink(items(1), items(5), {})).toBeNull();
	});

	it('no compara si la copia anterior estaba vacía o no se puede contar', () => {
		expect(checkShrink(items(1), [], {})).toBeNull();
		expect(checkShrink(items(1), { companies: {} }, {})).toBeNull();
		expect(checkShrink(items(1), null, {})).toBeNull();
		expect(checkShrink(items(1), 'basura', {})).toBeNull();
	});

	it('compara aunque la forma haya cambiado (lista antes, objeto ahora)', () => {
		expect(checkShrink({ a: items(1) }, items(100), {})).toMatch(/antes 100/);
	});

	it('con allowEmpty acepta vacíos y caídas grandes', () => {
		expect(checkShrink([], items(30), { allowEmpty: true })).toBeNull();
		expect(checkShrink(items(2), items(30), { allowEmpty: true })).toBeNull();
		expect(checkShrink({ a: [], b: [] }, undefined, { allowEmpty: true })).toBeNull();
	});

	it('exige el mínimo explícito, también con allowEmpty', () => {
		expect(checkShrink(items(4), undefined, { minItems: 5 })).toBe('solo 4 elementos; se esperan al menos 5');
		expect(checkShrink(items(5), undefined, { minItems: 5 })).toBeNull();
		expect(checkShrink([], undefined, { minItems: 1, allowEmpty: true })).toMatch(/al menos 1/);
		expect(checkShrink(items(3), undefined, { minItems: 0 })).toBeNull();
	});

	it('el mínimo explícito no desactiva la guardia de caída', () => {
		expect(checkShrink(items(10), items(100), { minItems: 5 })).toMatch(/antes 100/);
	});
});

describe('fuentes', () => {
	it('solo las que pueden venir vacías llevan allowEmpty', () => {
		const allowed = sources.filter((s) => s.allowEmpty).map((s) => s.name);
		expect(allowed.sort()).toEqual(['alerts', 'hazards', 'hfpapers', 'ioda', 'quakes-es']);
	});

	it('un día sin avisos ni desastres no es un fallo', () => {
		const byName = (name: string) => sources.find((s) => s.name === name)!;
		expect(checkShrink({ zone: 'Menorca', alerts: [] }, { zone: 'Menorca', alerts: items(3) }, byName('alerts'))).toBeNull();
		expect(checkShrink({ storms: [], events: [] }, { storms: items(2), events: items(40) }, byName('hazards'))).toBeNull();
	});
});
