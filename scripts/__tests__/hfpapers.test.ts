// Papers del día de Hugging Face (/api/daily_papers).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hfpapers } from '../sources/hfpapers.ts';
import { mockFetch } from './mock.ts';

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

/** Una entrada con la forma real: el paper va dentro de «paper» y los comentarios fuera. */
const entry = (id: string, over: Record<string, unknown> = {}, paper: Record<string, unknown> = {}) => ({
	paper: {
		id,
		authors: [{ _id: 'a1', name: 'Ana Pérez', hidden: false }, { _id: 'a2', name: 'Bo Li', hidden: false }],
		publishedAt: '2026-10-12T17:00:00.000Z',
		submittedOnDailyAt: '2026-10-13T08:00:00.000Z',
		title: `Paper ${id}`,
		summary: 'Resumen largo del autor.',
		upvotes: 10,
		ai_summary: 'Resumen corto generado.',
		...paper
	},
	publishedAt: '2026-10-13T08:00:00.000Z',
	title: `Paper ${id}`,
	numComments: 2,
	...over
});

describe('hfpapers', () => {
	it('lee los papers, los ordena por votos y acorta los autores', async () => {
		const fetch = mockFetch(() => [
			entry('2610.00001'),
			entry('2610.00002', { numComments: 5 }, {
				upvotes: 42,
				authors: [{ name: 'Carla Ruiz' }, { name: 'Dan' }, { name: 'Eva Gómez Sanz' }],
				ai_summary: ''
			})
		]);
		const data = await hfpapers.fetch(undefined);
		expect(data.map((p) => p.id)).toEqual(['2610.00002', '2610.00001']);
		expect(data[0]).toEqual({
			id: '2610.00002',
			title: 'Paper 2610.00002',
			authors: 'C. Ruiz, Dan et al.',
			upvotes: 42,
			comments: 5,
			url: 'https://huggingface.co/papers/2610.00002',
			arxiv: 'https://arxiv.org/abs/2610.00002',
			time: '2026-10-13T08:00:00.000Z',
			summary: 'Resumen largo del autor.'
		});
		expect(data[1].authors).toBe('A. Pérez, B. Li');
		expect(data[1].summary).toBe('Resumen corto generado.');
		// Sin HF_TOKEN no se manda la cabecera de autorización.
		expect((fetch.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBeUndefined();
	});

	it('usa HF_TOKEN si existe', async () => {
		vi.stubEnv('HF_TOKEN', 'hf_prueba');
		const fetch = mockFetch(() => [entry('1')]);
		await hfpapers.fetch(undefined);
		expect((fetch.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe('Bearer hf_prueba');
	});

	it('descarta entradas sin id, sin título o repetidas y aguanta campos nulos', async () => {
		mockFetch(() => [
			entry('ok', { publishedAt: null, numComments: null, title: 'Título de fuera' }, { title: null, upvotes: null, authors: null, ai_summary: null, summary: null }),
			entry('ok'), // repetida
			entry('', {}, { id: null }), // sin id
			entry('sin-titulo', { title: '' }, { title: '' }),
			{ paper: null },
			null
		]);
		const data = await hfpapers.fetch(undefined);
		expect(data).toEqual([
			{
				id: 'ok',
				title: 'Título de fuera',
				authors: '',
				upvotes: 0,
				comments: 0,
				url: 'https://huggingface.co/papers/ok',
				arxiv: 'https://arxiv.org/abs/ok',
				time: '2026-10-13T08:00:00.000Z',
				summary: ''
			}
		]);
	});

	it('con la lista vacía devuelve [] sin lanzar error (a propósito: hay días sin papers)', async () => {
		mockFetch(() => []);
		await expect(hfpapers.fetch(undefined)).resolves.toEqual([]);
		mockFetch(() => ({ error: 'algo raro' }));
		await expect(hfpapers.fetch(undefined)).resolves.toEqual([]);
	});
});
