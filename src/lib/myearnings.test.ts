import { describe, expect, it } from 'vitest';
import { earningsLine, myEarnings } from './myearnings.ts';
import { cheapestWindow } from './power.ts';
import type { Earnings } from './types.ts';

const e = (symbol: string, date: string, hour: string): Earnings => ({
	date,
	symbol,
	hour,
	quarter: 3,
	year: 2026,
	epsEstimate: null,
	epsActual: null,
	revenueEstimate: null,
	revenueActual: null
});

describe('myEarnings', () => {
	const cal = [e('NVDA', '2026-11-19', 'amc'), e('AAPL', '2026-10-30', 'amc'), e('MSFT', '2026-10-13', 'amc'), e('JPM', '2026-10-14', 'bmo')];

	it('cruza el calendario con tu lista (con o sin bolsa) y quita los que ya pasaron', () => {
		const mine = myEarnings(cal, ['NASDAQ:NVDA', 'msft', 'JPM', 'SAN'], '2026-10-14');
		expect(mine.map((m) => [m.code, m.date])).toEqual([
			['JPM', '2026-10-14'],
			['NASDAQ:NVDA', '2026-11-19']
		]);
	});

	it('escribe la línea para la portada', () => {
		const [jpm, nvda] = myEarnings(cal, ['NVDA', 'JPM'], '2026-10-14');
		expect(earningsLine(jpm, '2026-10-14')).toBe('JPM · resultados hoy, antes de la apertura');
		expect(earningsLine(nvda, '2026-10-14')).toBe('NVDA · resultados 19 nov, tras el cierre');
	});
});

describe('cheapestWindow', () => {
	const prices = [0.2, 0.18, 0.1, 0.09, 0.15, 0.3].map((kwh, hour) => ({ day: '2026-10-14', hour, kwh }));

	it('encuentra las horas seguidas más baratas desde la hora indicada', () => {
		expect(cheapestWindow(prices, '2026-10-14', 2)).toEqual({ start: 2, end: 4, avg: expect.closeTo(0.095, 5) });
		expect(cheapestWindow(prices, '2026-10-14', 2, 3)).toEqual({ start: 3, end: 5, avg: expect.closeTo(0.12, 5) });
		expect(cheapestWindow(prices, '2026-10-15', 2)).toBeNull();
	});
});
