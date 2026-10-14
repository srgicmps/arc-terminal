import { describe, expect, it } from 'vitest';
import { newsIndex } from '../news-index.ts';

const item = (title: string, time: string, url = `https://x/${encodeURIComponent(title)}`) => ({ title, url, source: 'Medio', time, summary: 'Resumen largo' });

describe('newsIndex', () => {
	it('junta las secciones, quita duplicados y resúmenes y ordena por fecha', () => {
		const shared = item('Santander gana más', '2026-10-14T08:00:00Z');
		const index = newsIndex([
			{ key: 'eco', data: { feeds: [], items: [shared, item('Zara sube precios', '2026-10-13T08:00:00Z')] } },
			{ key: 'ws', data: { feeds: [], items: [shared, item('Nvidia y Apple, al alza', '2026-10-14T09:00:00Z')] } },
			{ key: 'tech', data: null }
		]);
		expect(index.SAN).toEqual([{ ...shared, summary: '', section: 'eco' }]);
		expect(index.ITX?.map((i) => i.title)).toEqual(['Zara sube precios']);
		expect(Object.keys(index).sort()).toEqual(['AAPL', 'ITX', 'NVDA', 'SAN']);
	});
});
