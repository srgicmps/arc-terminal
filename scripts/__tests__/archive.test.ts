import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile, rm } from 'node:fs/promises';
import { archive, entries, mergeMonth, minute, monthOf, monthsBefore } from '../sources/archive.ts';
import { makeContext } from '../lib.ts';
import type { ArchiveEntry, NewsItem } from '../../src/lib/types.ts';
import { mockFetch } from './mock.ts';

const news = (title: string, url: string, time: string | null, source = 'El País'): NewsItem => ({ title, url, source, time, summary: '' });
const e = (t: string, d: string, u = `https://x.example/${t}`): ArchiveEntry => ({ t, s: 'A', d, u });

afterEach(async () => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	await rm('static/data/news-archive', { recursive: true, force: true });
});

describe('archivo de titulares', () => {
	it('guarda la hora al minuto y el mes de Madrid', () => {
		expect(minute('2026-10-14T22:30:59+00:00')).toBe('2026-10-14T22:30Z');
		expect(monthOf('2026-10-31T23:30Z')).toBe('2026-11');
	});

	it('resta meses cruzando el año', () => {
		expect(monthsBefore('2026-02', 3)).toBe('2025-11');
	});

	it('se queda con los titulares con fecha y sin repetir enlace', () => {
		const out = entries([
			[news('Uno', 'https://www.elpais.com/a?utm_source=x', '2026-10-14T10:00:00Z'), news('Sin fecha', 'https://b', null)],
			[news('Uno otra vez', 'https://elpais.com/a', '2026-10-14T11:00:00Z')]
		]);
		expect(out).toEqual([{ t: 'Uno', s: 'El País', d: '2026-10-14T10:00Z', u: 'https://www.elpais.com/a?utm_source=x' }]);
	});

	it('junta un mes sin repetir y del más nuevo al más antiguo', () => {
		const out = mergeMonth([e('a', '2026-10-01T10:00Z'), e('b', '2026-10-02T10:00Z')], [e('a', '2026-10-01T10:00Z'), e('c', '2026-10-03T10:00Z')]);
		expect(out.map((x) => x.t)).toEqual(['c', 'b', 'a']);
	});

	it('añade al mes publicado y escribe el índice', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-10-14T12:00:00Z'));
		mockFetch((url) => (url.endsWith('news-archive/2026-10.json') ? [e('viejo', '2026-10-01T09:00Z')] : undefined));
		const ctx = makeContext(new Map([['news-es', { items: [news('Nuevo', 'https://elpais.com/n', '2026-10-14T10:00:00Z')] }]]));
		const previous = { months: [{ month: '2026-10', count: 1, bytes: 10 }, { month: '2026-05', count: 9, bytes: 99 }] };
		const data = await archive.fetch(previous, ctx);
		expect(data.months.map((m) => [m.month, m.count])).toEqual([['2026-10', 2]]);
		const file = JSON.parse(await readFile('static/data/news-archive/2026-10.json', 'utf8')) as ArchiveEntry[];
		expect(file.map((x) => x.t)).toEqual(['Nuevo', 'viejo']);
		expect(archive.files!(data)).toEqual(['news-archive/2026-10.json']);
	});

	it('falla si no puede leer un mes que ya existía (para no perderlo)', async () => {
		mockFetch(() => new Response('', { status: 500 }));
		const ctx = makeContext(new Map([['news-es', { items: [news('Nuevo', 'https://elpais.com/n', new Date().toISOString())] }]]));
		const month = monthOf(new Date().toISOString());
		await expect(archive.fetch({ months: [{ month, count: 1, bytes: 1 }] }, ctx)).rejects.toThrow(/no se puede leer/);
	});

	it('empieza un mes nuevo si aún no está publicado', async () => {
		mockFetch(() => undefined);
		const ctx = makeContext(new Map([['news-es', { items: [news('Nuevo', 'https://elpais.com/n', new Date().toISOString())] }]]));
		const data = await archive.fetch(undefined, ctx);
		expect(data.months).toHaveLength(1);
		expect(data.months[0].count).toBe(1);
	});
});
