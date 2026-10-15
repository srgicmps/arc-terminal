import { describe, expect, it } from 'vitest';
import { logPrices, MY_FUEL_DAYS, myStationStats, parseMyStation, type MyStation } from './myfuel.ts';

const p = (g95: number | null, diesel: number | null = null) => ({ g95, diesel, g98: null, glp: null });
const st: MyStation = { id: 'b', zone: '28', name: 'REPSOL', town: 'MADRID', log: [] };

describe('mi gasolinera (F3)', () => {
	it('parseMyStation: lo guardado o null', () => {
		expect(parseMyStation(JSON.stringify({ ...st, log: [{ d: '2026-10-14', p: p(1.5) }] }))?.log[0].p.g95).toBe(1.5);
		expect(parseMyStation('{"id":1}')).toBeNull();
		expect(parseMyStation('no')).toBeNull();
		expect(parseMyStation(null)).toBeNull();
	});

	it('logPrices: un apunte por día y como mucho MY_FUEL_DAYS', () => {
		let s = logPrices(st, '2026-10-14', p(1.5));
		s = logPrices(s, '2026-10-14', p(1.49));
		s = logPrices(s, '2026-10-15', p(1.48));
		expect(s.log.map((e) => [e.d, e.p.g95])).toEqual([
			['2026-10-14', 1.49],
			['2026-10-15', 1.48]
		]);
		for (let i = 0; i < MY_FUEL_DAYS + 5; i++) s = logPrices(s, `2027-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, p(1.4));
		expect(s.log).toHaveLength(MY_FUEL_DAYS);
	});

	it('myStationStats: puesto, media, ahorro en 50 L y cambio desde el último apunte', () => {
		const stations = [
			{ id: 'a', prices: p(1.4) },
			{ id: 'b', prices: p(1.5) },
			{ id: 'c', prices: p(1.6) },
			{ id: 'd', prices: p(null) }
		];
		const mine = { ...st, log: [{ d: '2026-10-13', p: p(1.55) }, { d: '2026-10-15', p: p(1.5) }] };
		const s = myStationStats(mine, stations, 'g95', '2026-10-15')!;
		expect(s.rank).toBe(2);
		expect(s.of).toBe(3);
		expect(s.avg).toBeCloseTo(1.5);
		expect(s.save).toBeCloseTo(0);
		expect(s.change).toBeCloseTo(-0.05);
		expect(myStationStats(mine, stations, 'diesel', '2026-10-15')).toBeNull();
	});
});
