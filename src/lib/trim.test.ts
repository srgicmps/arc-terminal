// Recortes de datos de los +page.server.ts.
import { describe, expect, it } from 'vitest';
import { euLexShown, headlines, pickSeries, trim } from './trim.ts';
import type { EuLexDoc, NewsData, SeriesData } from './types.ts';

const series = (id: string, n: number) => ({
	id,
	label: id,
	unit: '%',
	source: 'Test',
	points: Array.from({ length: n }, (_, i) => ({ t: `2026-${String(i + 1).padStart(2, '0')}`, v: i }))
});

describe('trim', () => {
	it('cambia solo los datos y respeta un dataset que falta', () => {
		const set = { name: 'hn', fetchedAt: '2026-10-14T10:00:00Z', data: [1, 2, 3] };
		expect(trim(set, (d) => d.slice(0, 2))).toEqual({ ...set, data: [1, 2] });
		expect(set.data).toEqual([1, 2, 3]);
		expect(trim(null, (d: number[]) => d)).toBeNull();
	});

	it('pickSeries elige por id y deja los últimos puntos', () => {
		const set = { name: 'ecb', fetchedAt: '', data: { series: [series('a', 10), series('b', 10)] } as SeriesData };
		const out = pickSeries(set, ['b'], 3)!;
		expect(out.data.series.map((s) => s.id)).toEqual(['b']);
		expect(out.data.series[0].points.map((p) => p.v)).toEqual([7, 8, 9]);
		expect(pickSeries(set, null)!.data.series).toHaveLength(2);
	});

	it('headlines recorta los titulares y quita el resumen si no se pinta', () => {
		const item = { title: 'T', url: 'u', source: 'S', time: null, summary: 'Resumen' };
		const set = { name: 'news-eco', fetchedAt: '', data: { items: [item, item, item], feeds: [] } as NewsData };
		expect(headlines(set, 2)!.data.items).toEqual([{ ...item, summary: '' }, { ...item, summary: '' }]);
		expect(headlines(set, 1, true)!.data.items).toEqual([item]);
	});
});

describe('euLexShown', () => {
	const doc = (id: string, tags: string[] = []): EuLexDoc => ({ id, title: id, type: 'Reglamento', tags, date: '2026-10-14', url: '' });
	it('deja los primeros y los primeros de cada tema, en su orden', () => {
		const docs = [doc('a'), doc('b', ['Sanciones']), doc('c'), doc('d', ['Sanciones']), doc('e', ['Sanciones']), doc('f', ['Energía'])];
		expect(euLexShown(docs, 2).map((d) => d.id)).toEqual(['a', 'b', 'd', 'f']);
	});
});

