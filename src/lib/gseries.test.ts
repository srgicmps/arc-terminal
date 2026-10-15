import { describe, expect, it } from 'vitest';
import { catalogOf, extract, parseTokens, rebase, resolve, searchCatalog, SHORTCUTS } from './gseries.ts';

const fred = { series: [{ id: 'sofr-us', label: 'SOFR', unit: '%', geo: 'US', source: 'FRED', points: [{ t: '2026-10-13', v: 4.3 }, { t: '2026-10-14', v: 4.31 }] }] };
const curve = { tenors: ['2A', '10A'], days: [{ date: '2026-10-13', values: [3.5, 4.1] }, { date: '2026-10-14', values: [3.6, null] }] };
const catalog = [...catalogOf('fred', fred), ...catalogOf('uscurve', curve), ...catalogOf('ecb', { series: [{ id: 'euribor-12m', label: 'Euríbor a 12 meses', unit: '%', points: [{ t: '2026-08', v: 2 }, { t: '2026-09', v: 2.1 }] }] })];

describe('catálogo', () => {
	it('series y plazos de las curvas, con desde cuándo hay datos', () => {
		expect(catalog.map((c) => c.id)).toEqual(['sofr-us', 'uscurve-2A', 'uscurve-10A', 'euribor-12m']);
		expect(catalog[2]).toMatchObject({ label: 'Bono de EE. UU. · 10 años', from: '2026-10-13', n: 2 });
		expect(catalogOf('x', [1, 2, 3])).toEqual([]);
	});

	it('extrae los puntos de una serie o de un plazo, sin huecos', () => {
		expect(extract(fred, catalog[0])).toHaveLength(2);
		expect(extract(curve, catalog[2])).toEqual([{ t: '2026-10-13', v: 4.1 }]);
	});
});

describe('resolve', () => {
	it('atajo, id exacto o palabras del nombre, sin tildes', () => {
		expect(resolve('us10', catalog)?.id).toBe('uscurve-10A');
		expect(resolve('SOFR-US', catalog)?.id).toBe('sofr-us');
		expect(resolve('euribor 12', catalog)?.id).toBe('euribor-12m');
		expect(resolve('nada', catalog)).toBeNull();
	});

	it('cada atajo tiene un código único en mayúsculas', () => {
		const codes = SHORTCUTS.map((s) => s.code);
		expect(new Set(codes).size).toBe(codes.length);
		for (const c of codes) expect(c).toBe(c.toUpperCase());
	});

	it('trozos por comas o espacios, sin repetir, como mucho 6', () => {
		expect(parseTokens('us10, euribor 12 ,us10')).toEqual(['us10', 'euribor 12']);
		expect(parseTokens('us10 bund')).toEqual(['us10', 'bund']);
		expect(searchCatalog('bono 10', catalog).map((c) => c.id)).toEqual(['uscurve-10A']);
	});
});

describe('rebase', () => {
	it('base 100 desde la primera fecha común', () => {
		const out = rebase([
			[{ t: '2026-01', v: 1 }, { t: '2026-02', v: 2 }, { t: '2026-03', v: 3 }],
			[{ t: '2026-02', v: 50 }, { t: '2026-03', v: 25 }]
		]);
		expect(out[0]).toEqual([{ t: '2026-02', v: 100 }, { t: '2026-03', v: 150 }]);
		expect(out[1]).toEqual([{ t: '2026-02', v: 100 }, { t: '2026-03', v: 50 }]);
	});
});

describe('barra', () => {
	it('«G US10, bu» completa la última serie tras la coma', async () => {
		const { argOptions } = await import('./argcomplete.ts');
		expect(argOptions('G US10, bu')?.[0]).toMatchObject({ code: 'BUND', run: 'G US10,BUND' });
	});
});
