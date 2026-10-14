import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ATTRIBUTION, dailyMeans, energycharts, ZONES } from '../sources/energycharts.ts';
import type { PowerData } from '../../src/lib/types.ts';
import { mockFetch } from './mock.ts';

// Un día de Madrid (CEST, +02:00) en cuartos de hora, con el mismo precio en cada uno.
const day = (date: string, price: number, hours = 24) => {
	const start = Date.parse(`${date}T00:00:00+02:00`) / 1000;
	const n = hours * 4;
	return { unix_seconds: Array.from({ length: n }, (_, i) => start + i * 900), price: Array.from({ length: n }, () => price) };
};
const join = (...parts: { unix_seconds: number[]; price: number[] }[]) => ({
	unix_seconds: parts.flatMap((p) => p.unix_seconds),
	price: parts.flatMap((p) => p.price)
});
const CC = 'CC BY 4.0 (creativecommons.org/licenses/by/4.0) from Bundesnetzagentur | SMARD.de';
const PRIVATE = 'The data provided herein is for private and internal use only.';

describe('energycharts', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('dailyMeans: media por día de Madrid, solo si el día tiene al menos 23 horas', () => {
		const pts = (raw: { unix_seconds: number[]; price: number[] }) => raw.unix_seconds.map((t, i) => ({ t: t * 1000, v: raw.price[i] }));
		const means = dailyMeans(pts(join(day('2026-10-14', 100), day('2026-10-15', 80, 12))));
		expect(means.get('2026-10-14')).toBe(100);
		expect(means.has('2026-10-15')).toBe(false);
	});

	it('guarda solo las zonas CC BY, con hoy y mañana, y pone España de REE', async () => {
		const fetch = mockFetch((url) => {
			const zone = new URL(url).searchParams.get('bzn');
			if (zone === 'DE-LU') return { license_info: CC, ...join(day('2026-10-14', 120), day('2026-10-15', 90)) };
			if (zone === 'FR') return { license_info: CC, ...day('2026-10-14', 70) };
			if (zone === 'PT') return { license_info: PRIVATE, ...day('2026-10-14', 60) };
			return undefined; // 404: esa zona se salta
		});
		const power: PowerData = {
			pvpc: [],
			spot: Array.from({ length: 24 }, (_, h) => ({ t: `2026-10-14T${String(h).padStart(2, '0')}:00:00.000+02:00`, v: 50 }))
		};
		const promise = energycharts.fetch(undefined, { get: <D,>(name: string) => (name === 'power' ? power : undefined) as D });
		const data = await promise;
		expect(fetch).toHaveBeenCalledTimes(ZONES.length);
		expect(String(fetch.mock.calls[0][0])).toContain('start=2026-10-14&end=2026-10-15');
		expect(data.date).toBe('2026-10-14');
		expect(data.zones).toEqual([
			{ zone: 'ES', country: 'ES', name: 'España', today: 50, tomorrow: null, source: 'REE' },
			{ zone: 'FR', country: 'FR', name: 'Francia', today: 70, tomorrow: null, source: ATTRIBUTION },
			{ zone: 'DE-LU', country: 'DE', name: 'Alemania y Luxemburgo', today: 120, tomorrow: 90, source: ATTRIBUTION }
		]);
	});

	it('falla si ninguna zona llega con licencia CC BY', async () => {
		mockFetch(() => ({ license_info: PRIVATE, ...day('2026-10-14', 60) }));
		await expect(energycharts.fetch(undefined)).rejects.toThrow(/CC BY/);
	});
});
