import { afterEach, describe, expect, it, vi } from 'vitest';
import { download, finra, merge, parseFinra, weekdays, type FinraDay } from '../sources/finra.ts';
import type { FinraData } from '../../src/lib/shortvol.ts';
import { mockFetch } from './mock.ts';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

const HEAD = 'Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market';
const file = (date: string, rows: [string, number, number][]) =>
	[HEAD, ...rows.map(([s, short, total]) => `${date}|${s}|${short}|0|${total}|B,Q,N`)].join('\n');

const day = (date: string, rows: [string, number, number][]): FinraDay => ({ date, rows: new Map(rows.map(([s, a, b]) => [s, [a, b]])) });

describe('finra', () => {
	it('lee el archivo de FINRA, con volúmenes con decimales, y salta las líneas raras', () => {
		const text = `${HEAD}\n20261013|NVDA|16424383.997088|64476|33411690.726779|B,Q,N\n20261013|AAPL|100|0|400|Q\nbasura\n`;
		const d = parseFinra(text)!;
		expect(d.date).toBe('2026-10-13');
		expect(d.rows.get('NVDA')).toEqual([16424384, 33411691]);
		expect(d.rows.get('AAPL')).toEqual([100, 400]);
		expect(d.rows.size).toBe(2);
		expect(parseFinra('<html>Forbidden</html>')).toBeNull();
		expect(parseFinra(HEAD)).toBeNull();
	});

	it('busca solo días laborables, del más reciente hacia atrás', () => {
		// 14/10/2026 es miércoles.
		expect(weekdays(new Date('2026-10-14T10:00:00Z'), 7)).toEqual(['20261014', '20261013', '20261012', '20261009', '20261008']);
	});

	it('guarda los valores de la barra y los de más volumen, con la proporción en décimas de %', () => {
		const d = merge([day('2026-10-13', [['NVDA', 50, 100], ['BIG', 10, 1000], ['MID', 1, 500], ['TINY', 1, 2]])], undefined, ['NVDA', 'NOPE'], 2);
		expect(d.dates).toEqual(['2026-10-13']);
		expect(Object.keys(d.rows)).toEqual(['BIG', 'MID', 'NVDA']);
		expect(d.rows.NVDA).toEqual([50, 100]);
		expect(d.ratios).toEqual({ BIG: [10], MID: [2], NVDA: [500] });
	});

	it('acumula el historial con la copia anterior y se queda con los últimos 20 días', () => {
		const dates = Array.from({ length: 20 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
		const previous: FinraData = {
			dates,
			rows: { NVDA: [1, 2] },
			ratios: { NVDA: dates.map((_, i) => 400 + i), OLD: dates.map(() => 1) }
		};
		const d = merge([day('2026-10-01', [['NVDA', 60, 100], ['NEW', 1, 4]])], previous, ['NVDA', 'NEW'], 0);
		expect(d.dates).toHaveLength(20);
		expect(d.dates[0]).toBe('2026-09-02');
		expect(d.dates.at(-1)).toBe('2026-10-01');
		expect(d.ratios.NVDA.slice(0, 2)).toEqual([401, 402]);
		expect(d.ratios.NVDA.at(-1)).toBe(600);
		// Un valor nuevo empieza sin historia; uno que ya no está, se va.
		expect(d.ratios.NEW.filter((r) => r !== null)).toEqual([250]);
		expect(d.ratios.OLD).toBeUndefined();
	});

	it('el día descargado sustituye al de la copia y no usa días de la copia más nuevos', () => {
		const previous: FinraData = { dates: ['2026-10-12', '2026-10-13'], rows: {}, ratios: { A: [100, 200] } };
		const d = merge([day('2026-10-12', [['A', 3, 10]])], previous, ['A']);
		expect(d.dates).toEqual(['2026-10-12']);
		expect(d.ratios.A).toEqual([300]);
	});

	it('salta los días sin archivo y no vuelve a bajar los que ya tiene', async () => {
		const fetch = mockFetch((url) => {
			if (url.endsWith('20261014.txt')) return new Response('Forbidden', { status: 403 });
			if (url.endsWith('20261013.txt')) return file('20261013', [['NVDA', 5, 10]]);
			if (url.endsWith('20261012.txt')) return file('20261012', [['NVDA', 4, 10]]);
			return undefined;
		});
		const days = await download(['20261014', '20261013', '20261012', '20261009'], new Set(['2026-10-09']));
		expect(days.map((d) => d.date)).toEqual(['2026-10-13', '2026-10-12']);
		const urls = fetch.mock.calls.map(([u]) => String(u));
		expect(urls.some((u) => u.endsWith('20261009.txt'))).toBe(false);
		expect(urls[0]).toBe('https://cdn.finra.org/equity/regsho/daily/CNMSshvol20261014.txt');
	});

	it('si la copia ya tiene 20 días, solo baja el último', async () => {
		const have = new Set(Array.from({ length: 20 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`));
		const fetch = mockFetch((url) => (url.endsWith('20261013.txt') ? file('20261013', [['NVDA', 5, 10]]) : undefined));
		const days = await download(['20261013', '20261012', '20261009'], have);
		expect(days).toHaveLength(1);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('falla si FINRA no tiene ningún archivo reciente', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
		mockFetch(() => undefined);
		await expect(finra.fetch(undefined)).rejects.toThrow(/FINRA/);
	});
});
