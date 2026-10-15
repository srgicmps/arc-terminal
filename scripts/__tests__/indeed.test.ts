import { afterEach, describe, expect, it, vi } from 'vitest';
import { indeed, INDEED_GEOS, parseIndeed } from '../sources/indeed.ts';
import { mockFetch } from './mock.ts';

afterEach(() => vi.unstubAllGlobals());

const HEAD = 'date,jobcountry,indeed_job_postings_index_SA,indeed_job_postings_index_NSA,variable';

/** CSV como el de Hiring Lab: primero el total de ofertas y luego las nuevas, día a día desde `from`. */
function csv(cc: string, from: string, days: number, sa = (i: number) => 100 + i / 10) {
	const day = (i: number) => new Date(Date.parse(`${from}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
	const rows = (variable: string, shift: number) =>
		Array.from({ length: days }, (_, i) => `${day(i)},${cc},${(sa(i) + shift).toFixed(2)},${(sa(i) + 50).toFixed(2)},${variable}`);
	return [HEAD, ...rows('total postings', 0), ...rows('new postings', -40)].join('\n');
}

describe('indeed', () => {
	it('se queda con el total de ofertas y el índice desestacionalizado (SA)', () => {
		const points = parseIndeed(csv('ES', '2026-09-28', 7));
		// Una semana ISO (del lunes 28 al domingo 4): un solo punto, el último día.
		expect(points).toEqual([{ t: '2026-10-04', v: 100.6 }]);
	});

	it('baja a un punto por semana (el último día de cada una) y el último es el último día publicado', () => {
		// Del jueves 1 de octubre al viernes 16: semanas del 28 sep., del 5 y del 12 de octubre.
		const points = parseIndeed(csv('ES', '2026-10-01', 16));
		expect(points.map((p) => p.t)).toEqual(['2026-10-04', '2026-10-11', '2026-10-16']);
		expect(points.at(-1)!.v).toBeCloseTo(101.5);
	});

	it('guarda solo los últimos dos años, contados desde el último dato', () => {
		const points = parseIndeed(csv('US', '2020-02-01', 2400));
		expect(points.length).toBeGreaterThan(100);
		expect(points.length).toBeLessThan(110);
		expect(points[0].t > '2024-06-01').toBe(true);
		// Sin cabecera esperada o sin filas válidas, nada.
		expect(parseIndeed('date,variable\n2026-10-01,total postings')).toEqual([]);
	});

	it('un país que falla no tumba los demás; si fallan todos, falla la fuente', async () => {
		mockFetch((url) => (url.includes('/DE/') ? undefined : csv(url.match(/_([A-Z]{2})\.csv$/)![1], '2026-10-01', 10)));
		const data = await indeed.fetch(undefined);
		expect(data.series).toHaveLength(INDEED_GEOS.length - 1);
		expect(data.series.find((s) => s.geo === 'DE')).toBeUndefined();
		const es = data.series.find((s) => s.id === 'indeed-es')!;
		expect(es).toMatchObject({ label: 'España', unit: 'índice', geo: 'ES', source: 'Indeed Hiring Lab' });
		expect(es.points.at(-1)).toEqual({ t: '2026-10-10', v: 100.9 });

		mockFetch(() => undefined);
		await expect(indeed.fetch(undefined)).rejects.toThrow();
	});
});
