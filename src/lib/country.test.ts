import { describe, expect, it } from 'vitest';
import { findCountry } from './countries.ts';
import { countryProfile } from './country.ts';
import type { ImfData, Series, YieldCurveData } from './types.ts';

const s = (id: string, points: [string, number][], extra: Partial<Series> = {}): Series => ({
	id,
	label: id,
	unit: '%',
	points: points.map(([t, v]) => ({ t, v })),
	source: 'X',
	...extra
});

const series: Series[] = [
	s('gdp-es', [['2026-Q1', 0.6], ['2026-Q2', 0.5]], { label: 'PIB, trimestral', source: 'Eurostat' }),
	s('inflation-es', [['2026-08', 2.7], ['2026-09', 2.9]]),
	s('unemployment-es', [['2026-08', 10.6], ['2026-09', 10.4]]),
	s('debt-es', [['2026-Q1', 103.5], ['2026-Q2', 102.9]], { unit: '% PIB' }),
	s('debt-us', [['2026-10-10', 38e12]], { unit: '$' }),
	s('cpi-us', [['2026-09', 2.9]]),
	s('unemployment-us', [['2026-09', 4.3]]),
	s('policy-xm', [['2025-06', 2.15], ['2026-09', 2]], { geo: 'EA', label: 'Zona euro · BCE' }),
	s('policy-gb', [['2026-08', 4]], { geo: 'GB' }),
	s('bond10-es', [['2026-08', 3.2], ['2026-09', 3.1]]),
	s('bond10-de', [['2026-08', 2.6], ['2026-09', 2.55]]),
	s('eurusd', [['2026-09-14', 1.1], ['2026-10-14', 1.2]], { unit: '$' }),
	s('eurgbp', [['2026-09-14', 0.85], ['2026-10-14', 0.9]], { unit: '£' })
];
const imf: ImfData = {
	edition: 'octubre de 2026',
	years: [2026, 2027],
	rows: [
		{ code: 'WEOWORLD', name: 'Mundo', gdp: [3, 3.1], cpi: [4, 3.5] },
		{ code: 'EURO', name: 'Zona euro', gdp: [1, 1.2], cpi: [2, 2] },
		{ code: 'ESP', name: 'España', gdp: [2.5, 2], cpi: [2.4, 2.1] },
		{ code: 'USA', name: 'EE. UU.', gdp: [1.8, 2], cpi: [3, 2.5] }
	]
};
const curve: YieldCurveData = {
	tenors: ['2A', '10A'],
	days: [
		{ date: '2026-09-15', values: [3.6, 4.1] },
		{ date: '2026-10-13', values: [3.5, 4.0] },
		{ date: '2026-10-14', values: [3.5, null] }
	]
};
const sets = { series, imf, curve };

describe('countryProfile', () => {
	it('España: las cuatro cifras, BCE, bono, prima, EUR/USD y FMI con zona euro y mundo', () => {
		const p = countryProfile(findCountry('ES')!, sets);
		expect(p.kpis.map((k) => [k.key, k.value, k.prev])).toEqual([
			['gdp', 0.5, 0.6],
			['cpi', 2.9, 2.7],
			['unemployment', 10.4, 10.6],
			['debt', 102.9, 103.5]
		]);
		expect(p.policy).toMatchObject({ label: 'Zona euro · BCE', value: 2, prev: 2.15, t: '2026-09' });
		expect(p.bond).toMatchObject({ value: 3.1, prev: 3.2 });
		expect(p.premium).toMatchObject({ value: 55, prev: 60, unit: 'pb' });
		expect(p.fx).toHaveLength(1);
		expect(p.fx[0].pair).toBe('EUR/USD');
		expect(p.fx[0].month).toBeCloseTo(9.09, 2);
		expect(p.imf?.rows.map((r) => r.code)).toEqual(['ESP', 'EURO', 'WEOWORLD']);
	});

	it('Alemania no tiene prima frente a sí misma', () => {
		const p = countryProfile(findCountry('DE')!, sets);
		expect(p.premium).toBeNull();
		expect(p.bond?.value).toBe(2.55);
		expect(p.imf).toBeNull();
	});

	it('EE. UU.: la deuda en dólares no cuenta y el bono sale de la curva del Tesoro', () => {
		const p = countryProfile(findCountry('US')!, sets);
		expect(p.kpis.map((k) => k.key)).toEqual(['cpi', 'unemployment']);
		expect(p.bond).toMatchObject({ value: 4.0, prev: 4.1, t: '2026-10-13', source: 'Tesoro de EE. UU.' });
		expect(p.premium).toBeNull();
		expect(p.imf?.rows.map((r) => r.code)).toEqual(['USA', 'WEOWORLD']);
	});

	it('Reino Unido: su banco central y la libra frente al euro y al dólar', () => {
		const p = countryProfile(findCountry('GB')!, sets);
		expect(p.policy?.value).toBe(4);
		expect(p.fx.map((f) => f.pair)).toEqual(['EUR/GBP', 'USD/GBP']);
		expect(p.fx[1].value).toBeCloseTo(0.75, 6);
		// 0,85/1,1 → 0,9/1,2: la libra baja frente al dólar.
		expect(p.fx[1].month).toBeCloseTo((0.75 / (0.85 / 1.1) - 1) * 100, 6);
	});

	it('un país sin datos se queda vacío, sin huecos', () => {
		const p = countryProfile(findCountry('NG')!, sets);
		expect(p).toEqual({ kpis: [], policy: null, bond: null, premium: null, fx: [], imf: null });
	});
});
