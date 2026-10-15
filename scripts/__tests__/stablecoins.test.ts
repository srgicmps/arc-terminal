import { afterEach, describe, expect, it, vi } from 'vitest';
import { stablecoins, toCoins, toTotal } from '../sources/stablecoins.ts';
import { offPeg } from '../../src/lib/stablecoins.ts';
import { mockFetch } from './mock.ts';

afterEach(() => vi.unstubAllGlobals());

const coin = (id: string, symbol: string, now: number, week: number, month: number, extra = {}) => ({
	id,
	name: symbol,
	symbol,
	pegType: 'peggedUSD',
	pegMechanism: 'fiat-backed',
	circulating: { peggedUSD: now },
	circulatingPrevDay: { peggedUSD: now },
	circulatingPrevWeek: { peggedUSD: week },
	circulatingPrevMonth: { peggedUSD: month },
	price: 1,
	...extra
});

const DAY = 86_400;
const day = (n: number, usd: number, eur = 0) => ({
	date: String(1_700_000_000 - (1_700_000_000 % DAY) + n * DAY),
	totalCirculatingUSD: { peggedUSD: usd, peggedEUR: eur }
});

describe('stablecoins', () => {
	it('se queda con las ligadas al dólar, de mayor a menor, con su variación y su precio', () => {
		const coins = toCoins([
			coin('2', 'USDC', 75e9, 74e9, 70e9),
			coin('1', 'USDT', 184e9, 184e9, 160e9, { price: '0.9991' }),
			coin('50', 'EURC', 2e8, 2e8, 2e8, { pegType: 'peggedEUR' }),
			coin('9', 'MUERTA', 0, 1e6, 1e6),
			coin('7', 'SINPRECIO', 1e9, 0, 1e9, { price: null })
		]);
		expect(coins.map((c) => c.symbol)).toEqual(['USDT', 'USDC', 'SINPRECIO']);
		expect(coins[0]).toMatchObject({ usd: 184e9, week: 0, month: 15, price: 0.9991 });
		expect(coins[1].week).toBe(1.35);
		// Sin dato de hace una semana (0), no hay variación; sin precio, null.
		expect(coins[2]).toMatchObject({ week: null, month: 0, price: null });
	});

	it('suma todas las paridades del total y compara con hace 30 días y un año', () => {
		const days = [day(0, 100e9), day(335, 150e9), day(364, 190e9, 5e9), day(365, 200e9, 0)];
		expect(toTotal(days)).toMatchObject({ total: 200e9, totalMonth: 33.33, totalYear: 100 });
		expect(toTotal([day(1, 0), day(2, 10)]).totalYear).toBeNull();
		expect(() => toTotal([])).toThrow();
	});

	it('marca como fuera de paridad a partir de medio céntimo', () => {
		expect(offPeg(0.996)).toBe(false);
		expect(offPeg(0.995)).toBe(true);
		expect(offPeg(1.01)).toBe(true);
		expect(offPeg(null)).toBe(false);
	});

	it('pide la lista y el total, y acepta la lista envuelta en peggedAssets', async () => {
		mockFetch((url) =>
			url.includes('stablecoincharts') ? [day(0, 1e9), day(30, 2e9)] : { peggedAssets: [coin('1', 'USDT', 1e9, 1e9, 1e9)], chains: [] }
		);
		const data = await stablecoins.fetch(undefined);
		expect(data.coins.map((c) => c.symbol)).toEqual(['USDT']);
		expect(data).toMatchObject({ total: 2e9, totalMonth: 100 });
		expect(data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});
