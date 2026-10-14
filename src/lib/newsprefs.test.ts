import { describe, expect, it } from 'vitest';
import { visibleNews } from './newsprefs.ts';
import type { NewsItem } from './types.ts';

const item = (source: string, lang?: 'en'): NewsItem => ({ title: source, url: source, source, time: null, summary: '', lang });
const items = [item('El País'), item('BBC', 'en'), item('Expansión'), item('Reuters', 'en')];

describe('filtros de los titulares', () => {
	it('sin filtros, todos (la misma lista)', () => {
		expect(visibleNews(items, [], 'all')).toBe(items);
	});

	it('quita los medios silenciados', () => {
		expect(visibleNews(items, ['BBC', 'Expansión'], 'all').map((i) => i.source)).toEqual(['El País', 'Reuters']);
	});

	it('filtra por el idioma original', () => {
		expect(visibleNews(items, [], 'es').map((i) => i.source)).toEqual(['El País', 'Expansión']);
		expect(visibleNews(items, ['Reuters'], 'en').map((i) => i.source)).toEqual(['BBC']);
	});
});
