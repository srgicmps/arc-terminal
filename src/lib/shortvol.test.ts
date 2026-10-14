import { describe, expect, it } from 'vitest';
import { average, finraSymbol, shortRatio, shortStat, summarize, type FinraData } from './shortvol.ts';

describe('shortvol', () => {
	it('proporción en corto: corto / total, en %', () => {
		expect(shortRatio(25, 100)).toBe(25);
		expect(shortRatio(1, 0)).toBeNull();
	});

	it('media de los días con dato, con un mínimo de días', () => {
		expect(average([400, null, 500, 600, 500, 500])).toBe(500);
		expect(average([400, 500])).toBeNull();
		expect(average([400, 500], 2)).toBe(450);
	});

	it('símbolo de FINRA: solo valores de EE. UU.', () => {
		expect(finraSymbol('nvda')).toBe('NVDA');
		expect(finraSymbol('NASDAQ:NVDA')).toBe('NVDA');
		expect(finraSymbol('BRK.B')).toBe('BRK.B');
		expect(finraSymbol('SAN')).toBeNull();
		expect(finraSymbol('BME:REP')).toBeNull();
		expect(finraSymbol('SPX')).toBeNull();
	});

	it('resume para la vista y da la diferencia con la media', () => {
		const d: FinraData = {
			dates: ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13'],
			rows: { NVDA: [60, 100], AAPL: [1, 0] },
			ratios: { NVDA: [400, 400, 400, 400, 600], AAPL: [null, null, null, null, null] }
		};
		const s = summarize(d);
		expect(s).toEqual({ date: '2026-10-13', days: 5, rows: { NVDA: [60, 100, 440], AAPL: [1, 0, null] } });
		const nvda = shortStat(s, 'NASDAQ:NVDA')!;
		expect(nvda.ratio).toBe(60);
		expect(nvda.avg).toBe(44);
		expect(nvda.diff).toBeCloseTo(16);
		expect(shortStat(s, 'AAPL')).toBeNull();
		expect(shortStat(s, 'MSFT')).toBeNull();
		expect(shortStat(null, 'NVDA')).toBeNull();
	});
});
