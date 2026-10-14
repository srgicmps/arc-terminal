import { describe, expect, it } from 'vitest';
import { portwatch, queryUrl, summarize } from '../sources/portwatch.ts';
import { mockFetch } from './mock.ts';

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const LAST = Date.parse('2026-10-09T00:00:00Z');

/** `days` días seguidos hasta `end` con `n` tránsitos al día (o lo que diga la función). */
const run = (id: string, end: number, days: number, n: (i: number) => number) =>
	Array.from({ length: days }, (_, i) => ({ id, date: iso(end - (days - 1 - i) * DAY), n: n(i) }));

describe('portwatch', () => {
	it('media de 7 días frente a la del año anterior y minigráfico de 90 días', () => {
		const recent = run('chokepoint6', LAST, 97, (i) => (i >= 90 ? 120 : 100));
		const lastYear = run('chokepoint6', LAST - 365 * DAY, 7, () => 100);
		const [hormuz, ...rest] = summarize(recent, lastYear);
		expect(rest).toEqual([]);
		expect(hormuz).toMatchObject({ id: 'chokepoint6', name: 'Ormuz', last: '2026-10-09', avg7: 120, avg7PrevYear: 100, change: 20 });
		expect(hormuz.spark).toHaveLength(90);
		expect(hormuz.spark.at(-1)).toBe(120);
	});

	it('sin datos del año anterior, no hay comparación', () => {
		const [suez] = summarize(run('chokepoint1', LAST, 10, () => 40), []);
		expect(suez).toMatchObject({ name: 'Canal de Suez', avg7: 40, avg7PrevYear: null, change: null });
	});

	it('pide los seis pasos por fecha, pagina y acepta fechas en milisegundos', async () => {
		const url = new URL(queryUrl('2026-07-01', '2026-10-14')).searchParams.get('where');
		expect(url).toContain("portid IN ('chokepoint6','chokepoint1','chokepoint4','chokepoint2','chokepoint5','chokepoint3')");
		expect(url).toContain("date >= DATE '2026-07-01' AND date <= DATE '2026-10-14'");
		const offsets: string[] = [];
		mockFetch((u) => {
			const params = new URL(u).searchParams;
			offsets.push(params.get('resultOffset')!);
			const recent = params.get('where')!.includes(`DATE '${iso(Date.now())}'`);
			if (!recent) return { features: [] };
			if (params.get('resultOffset') === '0')
				return { exceededTransferLimit: true, features: [{ attributes: { date: '2026-10-08', portid: 'chokepoint2', n_total: 30 } }] };
			return { features: [{ attributes: { date: Date.parse('2026-10-09T00:00:00Z'), portid: 'chokepoint2', n_total: 34 } }] };
		});
		const data = await portwatch.fetch(undefined);
		expect(data).toMatchObject([{ id: 'chokepoint2', last: '2026-10-09', avg7: 32 }]);
		expect(offsets).toEqual(['0', '1', '0']);
	});
});
